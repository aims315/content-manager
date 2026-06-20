'use client'

import { useMemo, useState } from 'react'
import type { Project, PostCaption, CaptionCandidate } from '@/lib/types'
import type { CaptionPatch } from '@/hooks/use-captions'
import { uid, parseCaptionCsv, type CaptionGroup } from '@/lib/caption-csv'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  MessageSquareTextIcon, UploadIcon, CheckIcon, ArrowRightIcon, RotateCcwIcon,
} from 'lucide-react'

export function CaptionBulkDialog({ projects, captions, onSave }: {
  projects: Project[]
  captions: Record<string, PostCaption>
  onSave: (projectId: string, patch: CaptionPatch) => Promise<boolean | void>
}) {
  const [open, setOpen] = useState(false)
  const [codeFilter, setCodeFilter] = useState('')
  const [groups, setGroups] = useState<CaptionGroup[] | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({}) // 投稿名 → projectId
  const [dragOver, setDragOver] = useState(false)
  const [csvMsg, setCsvMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: number; skipped: number } | null>(null)

  const uniqueCodes = useMemo(
    () => [...new Set(projects.map((p) => p.assignee).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')),
    [projects]
  )

  // キャプションは Instagram 種別のカードだけが対象
  const igProjects = useMemo(() => projects.filter((p) => p.project_type === 'instagram'), [projects])

  const sorted = useMemo(
    () => [...igProjects].sort((a, b) =>
      (a.assignee ?? '').localeCompare(b.assignee ?? '', 'ja') || a.title.localeCompare(b.title, 'ja')
    ),
    [igProjects]
  )

  // コード絞り込み後のカード候補（マッピング済みのカードは絞り込み外でも残す）
  const cardOptions = (forTitle: string) => {
    const base = codeFilter ? sorted.filter((p) => p.assignee === codeFilter) : sorted
    const mapped = mapping[forTitle]
    if (mapped && !base.some((p) => p.id === mapped)) {
      const m = projects.find((p) => p.id === mapped)
      return m ? [m, ...base] : base
    }
    return base
  }

  const reset = () => { setGroups(null); setMapping({}); setCsvMsg(''); setResult(null) }

  const loadCsvText = (raw: string) => {
    const gs = parseCaptionCsv(raw)
    if (gs.length === 0) { setCsvMsg('CSVから候補を読み取れませんでした（投稿名・キャプション/備考の列を確認）'); return }
    setGroups(gs)
    setResult(null)
    // タイトル完全一致で自動マッピング
    const map: Record<string, string> = {}
    const matchedCodes: string[] = []
    for (const g of gs) {
      const hit = igProjects.find((p) => p.title.trim() === g.title.trim())
      if (hit) { map[g.title] = hit.id; if (hit.assignee) matchedCodes.push(hit.assignee) }
    }
    setMapping(map)
    // 自動一致したカードのコードが1種類なら、コード絞り込みも合わせる
    const uniq = [...new Set(matchedCodes)]
    if (uniq.length === 1) setCodeFilter(uniq[0])
    const matched = Object.keys(map).length
    setCsvMsg(`${gs.length}件の投稿を検出（うち${matched}件はタイトル一致でカードを自動選択）。各投稿のカードを確認してください`)
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => loadCsvText(String(reader.result ?? ''))
    reader.readAsText(file, 'utf-8')
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = Array.from(e.dataTransfer.files).find((f) => /\.csv$/i.test(f.name) || f.type === 'text/csv') ?? e.dataTransfer.files[0]
    if (file) handleFile(file); else setCsvMsg('CSVファイルが見つかりませんでした')
  }

  const assignedCount = groups ? groups.filter((g) => mapping[g.title]).length : 0

  const handleRegister = async () => {
    if (!groups) return
    setSaving(true)
    let ok = 0, skipped = 0
    for (const g of groups) {
      const projectId = mapping[g.title]
      if (!projectId) { skipped++; continue }
      const cands: CaptionCandidate[] = g.cands
        .map((c) => ({ id: uid(), text: c.text.trim(), memo: c.memo.trim() || undefined }))
        .filter((c) => c.text)
      const existing = captions[projectId]
      const nextStatus = (existing?.status && existing.status !== '未確認') ? existing.status : '未確認'
      const r = await onSave(projectId, { candidates: cands, status: nextStatus })
      if (r === false) skipped++; else ok++
    }
    setSaving(false)
    setResult({ ok, skipped })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
          <MessageSquareTextIcon className="size-3.5" />
          キャプション一括登録
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquareTextIcon className="size-4" />
            キャプションを一括登録
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* クライアントコード絞り込み */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground shrink-0">クライアントコード</label>
            <select
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value)}
              className="h-8 text-xs rounded-md border bg-background px-2 flex-1 min-w-0"
            >
              <option value="">すべてのコード</option>
              {uniqueCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* CSVドロップ */}
          {!result && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
              onDrop={handleDrop}
              onClick={() => document.getElementById('cap-bulk-csv')?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-5 cursor-pointer transition-colors text-center',
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/60'
              )}
            >
              <UploadIcon className="size-5 text-muted-foreground" />
              <p className="text-xs font-medium">CSVをドラッグ&ドロップ（複数投稿OK）</p>
              <p className="text-[10px] text-muted-foreground">またはクリックして選択・投稿名／キャプションの列を読み込みます</p>
              <input id="cap-bulk-csv" type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}
          {csvMsg && !result && <p className="text-[11px] text-muted-foreground">{csvMsg}</p>}

          {/* 投稿 → カード の割り当て表 */}
          {groups && !result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">投稿ごとに登録先カードを選択（{assignedCount}/{groups.length} 件設定済み）</p>
                <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <RotateCcwIcon className="size-3" />やり直す
                </button>
              </div>
              {groups.map((g) => {
                const opts = cardOptions(g.title)
                const mapped = mapping[g.title]
                return (
                  <div key={g.title} className="rounded-md border p-2 bg-card space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium flex-1 min-w-0 truncate">{g.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">候補{g.cands.length}件</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRightIcon className="size-3.5 text-muted-foreground shrink-0" />
                      <select
                        value={mapped ?? ''}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [g.title]: e.target.value }))}
                        className={cn('h-8 text-xs rounded-md border bg-background px-2 flex-1 min-w-0',
                          !mapped && 'text-muted-foreground')}
                      >
                        <option value="">（このカードに入れない／スキップ）</option>
                        {opts.map((p) => (
                          <option key={p.id} value={p.id}>{p.assignee || '—'} — {p.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 結果 */}
          {result && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckIcon className="size-10 text-emerald-500" />
              <div className="text-center">
                <p className="text-base font-semibold">登録完了！</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.ok}件のカードに登録{result.skipped > 0 ? ` · スキップ ${result.skipped}件` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>続けて別のCSVを取り込む</Button>
                <Button size="sm" onClick={() => { setOpen(false); reset() }}>閉じる</Button>
              </div>
            </div>
          )}
        </div>

        {groups && !result && (
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); reset() }}>キャンセル</Button>
            <Button size="sm" onClick={handleRegister} disabled={saving || assignedCount === 0}>
              {saving ? '登録中…' : `${assignedCount}件のカードに登録する`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
