'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProviderRole } from '@/hooks/use-provider-labels'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { UploadIcon, FileTextIcon, CheckCircleIcon, AlertCircleIcon, XIcon, DownloadIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CsvRow {
  title: string
  type: string
  code: string
  dueDate: string
  stepLabel: string
  provider: string
  stepDueDate: string
  note: string
}

interface ParsedProject {
  title: string
  type: string
  code: string
  dueDate: string
  steps: { label: string; provider: string; providerName: string | null; stepDueDate: string; note: string }[]
  error?: string
}

const SAMPLE_CSV = `タイトル,種別,コード,納期,ステップ名,担当,ステップ期日,備考
A社6月Instagram投稿,instagram,client-a,2026-06-30,企画・構成,自分,2026-06-10,
A社6月Instagram投稿,instagram,client-a,2026-06-30,デザイン制作,外注,2026-06-20,参考URL: https://example.com
A社6月Instagram投稿,instagram,client-a,2026-06-30,投稿,自分,2026-06-30,
B社イベント企画,event,client-b,2026-07-15,会場手配,自分,2026-06-15,
B社イベント企画,event,client-b,2026-07-15,告知画像作成,外注,2026-06-25,サイズ: 1080x1080
`

const TYPE_MAP: Record<string, string> = {
  instagram: 'instagram', 'Instagram': 'instagram', 'IG': 'instagram',
  twitter: 'twitter', 'Twitter': 'twitter', 'X': 'twitter', 'x': 'twitter',
  event: 'event', 'イベント': 'event', 'Event': 'event',
}

const PROVIDER_MAP: Record<string, string> = {
  '自分': 'self', 'self': 'self',
  '外注': 'freelancer', 'freelancer': 'freelancer',
  'クライアント': 'client', 'client': 'client',
}

// カンマ・改行・ダブルクォートを正しく扱うCSVパーサー
function parseCsvLine(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuote = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue } // escaped quote
        inQuote = false; i++; continue
      }
      field += ch; i++
    } else {
      if (ch === '"') { inQuote = true; i++; continue }
      if (ch === ',') { row.push(field.trim()); field = ''; i++; continue }
      if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(field.trim()); rows.push(row); row = []; field = ''; i++; continue
      }
      field += ch; i++
    }
  }
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function parseCSV(text: string): CsvRow[] {
  const rows = parseCsvLine(text)
  if (rows.length < 2) return []
  return rows.slice(1).map((cols) => ({
    title: cols[0] ?? '',
    type: cols[1] ?? '',
    code: cols[2] ?? '',
    dueDate: cols[3] ?? '',
    stepLabel: cols[4] ?? '',
    provider: cols[5] ?? '',
    stepDueDate: cols[6] ?? '',
    note: cols[7] ?? '',
  }))
}

function resolveProvider(value: string, roles: ProviderRole[]): { providerType: string; providerName: string | null } {
  if (!value) return { providerType: 'self', providerName: null }
  // 固定マッピング優先
  if (PROVIDER_MAP[value]) return { providerType: PROVIDER_MAP[value], providerName: null }
  // カスタム役割名でマッチング（部分一致も許容）
  const matched = roles.find((r) => r.label === value || value.includes(r.label) || r.label.includes(value))
  if (matched) return { providerType: matched.id, providerName: matched.label }
  // マッチしなければ値をそのまま名前として保存
  return { providerType: 'self', providerName: value }
}

function groupRows(rows: CsvRow[], roles: ProviderRole[]): ParsedProject[] {
  const map = new Map<string, ParsedProject>()
  for (const row of rows) {
    if (!row.title) continue
    if (!map.has(row.title)) {
      const mappedType = TYPE_MAP[row.type] ?? row.type
      map.set(row.title, {
        title: row.title,
        type: mappedType,
        code: row.code,
        dueDate: row.dueDate,
        steps: [],
      })
    }
    const proj = map.get(row.title)!
    if (row.stepLabel) {
      const { providerType, providerName } = resolveProvider(row.provider, roles)
      proj.steps.push({
        label: row.stepLabel,
        provider: providerType,
        providerName,
        stepDueDate: row.stepDueDate,
        note: row.note,
      })
    }
  }
  return Array.from(map.values()).map((p) => ({
    ...p,
    error: !p.type ? '種別が不明です' : p.steps.length === 0 ? 'ステップがありません' : undefined,
  }))
}

export function CsvImportDialog() {
  const supabase = createClient()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<ParsedProject[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ ok: number; fail: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [roles, setRoles] = useState<ProviderRole[]>([])

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'provider_roles').single()
      .then(({ data }) => {
        if (data?.value) {
          try { setRoles(JSON.parse(data.value)) } catch { /* ignore */ }
        }
      })
  }, [])

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      setProjects(groupRows(rows, roles))
      setResult(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
  }

  const handleImport = async () => {
    setImporting(true)
    let ok = 0, fail = 0
    for (const proj of projects) {
      if (proj.error) { fail++; continue }
      try {
        // 同タイトルの既存プロジェクトを検索（deleted_at が null のもの）
        const { data: existing } = await supabase
          .from('projects')
          .select('id')
          .eq('title', proj.title)
          .is('deleted_at', null)
          .single()

        let projectId: string

        if (existing) {
          // 上書き：プロジェクト情報を更新 + 既存ステップを全削除
          await supabase.from('projects').update({
            project_type: proj.type,
            assignee: proj.code,
            due_date: proj.dueDate || null,
          }).eq('id', existing.id)
          await supabase.from('project_steps').delete().eq('project_id', existing.id)
          projectId = existing.id
        } else {
          // 新規作成
          const { data: projectData, error } = await supabase
            .from('projects')
            .insert({
              title: proj.title,
              project_type: proj.type,
              assignee: proj.code,
              due_date: proj.dueDate || null,
              discord_channels: [],
            })
            .select().single()
          if (error || !projectData) { fail++; continue }
          projectId = projectData.id
        }

        const stepsToInsert = proj.steps.map((s, i) => ({
          project_id: projectId,
          step_key: 'text',
          step_order: i,
          label: s.label,
          status: '未着手',
          provider_type: s.provider,
          provider_name: s.providerName,
          file_urls: [],
          file_names: [],
          is_client_step: s.provider !== 'self',
          step_due_date: s.stepDueDate || null,
          note: s.note || null,
        }))
        await supabase.from('project_steps').insert(stepsToInsert)
        ok++
      } catch { fail++ }
    }
    setResult({ ok, fail })
    setImporting(false)
    if (ok > 0) router.refresh()
  }

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'sample_import.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => { setProjects([]); setResult(null) }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
          <UploadIcon className="size-3.5" />
          CSV取込
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="size-4" />
            CSVからプロジェクトを一括作成
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* サンプルダウンロード */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              形式: <code className="text-xs bg-muted px-1 rounded">タイトル, 種別, コード, 納期, ステップ名, 担当, ステップ期日, 備考</code>
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={downloadSample}>
              <DownloadIcon className="size-3" />サンプルCSV
            </Button>
          </div>

          {/* ドロップゾーン */}
          {projects.length === 0 && !result && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 cursor-pointer transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/60 hover:bg-muted/30'
              )}
            >
              <UploadIcon className="size-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">CSVファイルをドロップ</p>
                <p className="text-xs text-muted-foreground mt-1">またはクリックして選択</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}

          {/* プレビュー */}
          {projects.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{projects.length}件のプロジェクトを検出</p>
                <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <XIcon className="size-3" />やり直す
                </button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {projects.map((p, i) => (
                  <div key={i} className={cn('rounded-lg border p-3 space-y-1.5', p.error ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.type} · {p.code}{p.dueDate ? ` · 納期 ${p.dueDate}` : ''}
                        </p>
                      </div>
                      {p.error
                        ? <span className="flex items-center gap-1 text-xs text-destructive shrink-0"><AlertCircleIcon className="size-3" />{p.error}</span>
                        : <span className="text-xs text-emerald-600 shrink-0">{p.steps.length}ステップ</span>
                      }
                    </div>
                    {!p.error && (
                      <div className="flex flex-wrap gap-1">
                        {p.steps.map((s, j) => (
                          <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {s.label}
                            {s.stepDueDate && <span className="ml-1 text-[9px]">({s.stepDueDate})</span>}
                            {s.note && <span className="ml-1 text-[9px] text-blue-500">📝</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button className="w-full gap-2" onClick={handleImport} disabled={importing || projects.every((p) => !!p.error)}>
                <UploadIcon className="size-4" />
                {importing ? '作成中...' : `${projects.filter((p) => !p.error).length}件を一括作成`}
              </Button>
            </div>
          )}

          {/* 結果 */}
          {result && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircleIcon className="size-12 text-emerald-500" />
              <div className="text-center">
                <p className="text-lg font-semibold">作成完了！</p>
                <p className="text-sm text-muted-foreground mt-1">
                  成功 {result.ok}件{result.fail > 0 ? ` · 失敗 ${result.fail}件` : ''}
                </p>
              </div>
              <Button variant="outline" onClick={() => { setOpen(false); reset() }}>閉じる</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
