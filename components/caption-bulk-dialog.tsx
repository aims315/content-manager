'use client'

import { useMemo, useState } from 'react'
import type { Project, PostCaption, CaptionCandidate } from '@/lib/types'
import type { CaptionPatch } from '@/hooks/use-captions'
import { uid, parseCaptionCsv, type CaptionGroup } from '@/lib/caption-csv'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  MessageSquareTextIcon, UploadIcon, PlusIcon, XIcon, SearchIcon, CheckIcon, ChevronLeftIcon,
} from 'lucide-react'

interface EditorRow { id: string; text: string; memo: string }

export function CaptionBulkDialog({ projects, captions, onSave }: {
  projects: Project[]
  captions: Record<string, PostCaption>
  onSave: (projectId: string, patch: CaptionPatch) => Promise<boolean | void>
}) {
  const [open, setOpen] = useState(false)
  const [projectId, setProjectId] = useState<string>('')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<EditorRow[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [csvGroups, setCsvGroups] = useState<CaptionGroup[] | null>(null)
  const [csvMsg, setCsvMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const selected = projects.find((p) => p.id === projectId)

  const sorted = useMemo(() =>
    [...projects].sort((a, b) =>
      (a.assignee ?? '').localeCompare(b.assignee ?? '', 'ja') || a.title.localeCompare(b.title, 'ja')
    ), [projects])

  const filtered = sorted.filter((p) =>
    !query.trim() || p.title.includes(query) || (p.assignee ?? '').includes(query)
  )

  const toRows = (cands: { text: string; memo?: string }[]): EditorRow[] =>
    cands.length ? cands.map((c) => ({ id: uid(), text: c.text, memo: c.memo ?? '' })) : [{ id: uid(), text: '', memo: '' }]

  const selectProject = (id: string) => {
    setProjectId(id)
    setRows(toRows(captions[id]?.candidates ?? []))
    setCsvGroups(null); setCsvMsg(''); setSavedMsg('')
  }

  const backToList = () => { setProjectId(''); setRows([]); setCsvGroups(null); setCsvMsg(''); setSavedMsg('') }

  const loadCsvText = (raw: string) => {
    const groups = parseCaptionCsv(raw)
    if (groups.length === 0) { setCsvMsg('CSVから候補を読み取れませんでした（投稿名・キャプション/備考の列を確認）'); return }
    if (groups.length === 1) {
      setRows(toRows(groups[0].cands)); setCsvGroups(null)
      setCsvMsg(`✓「${groups[0].title}」から${groups[0].cands.length}件の候補を読み込みました`)
    } else {
      setCsvGroups(groups)
      setCsvMsg(`${groups.length}件の投稿が見つかりました。このカードに入れる投稿を選んでください`)
    }
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
  const chooseGroup = (g: CaptionGroup) => {
    setRows(toRows(g.cands)); setCsvGroups(null)
    setCsvMsg(`✓「${g.title}」から${g.cands.length}件の候補を読み込みました`)
  }

  const updateRow = (id: string, patch: Partial<EditorRow>) => setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))
  const addRow = () => setRows((prev) => [...prev, { id: uid(), text: '', memo: '' }])
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))

  const handleSave = async () => {
    if (!projectId) return
    setSaving(true)
    const cands: CaptionCandidate[] = rows
      .map((r) => ({ id: uid(), text: r.text.trim(), memo: r.memo.trim() || undefined }))
      .filter((c) => c.text)
    const existing = captions[projectId]
    const nextStatus = (existing?.status && existing.status !== '未確認') ? existing.status : '未確認'
    await onSave(projectId, { candidates: cands, status: nextStatus })
    setSaving(false)
    setSavedMsg(`✓「${selected?.title}」に${cands.length}件の候補を登録しました`)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) backToList() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
          <MessageSquareTextIcon className="size-3.5" />
          キャプション一括登録
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquareTextIcon className="size-4" />
            キャプション候補を登録
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* ステップ1：カードをプルダウン（検索付き）で選ぶ */}
          {!selected ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">① 登録するカードを選んでください</p>
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="タイトル・コードで絞り込み" className="pl-8 h-9 text-sm" />
              </div>
              <div className="max-h-80 overflow-y-auto rounded-md border divide-y">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">該当するカードがありません</p>
                ) : filtered.map((p) => {
                  const cnt = captions[p.id]?.candidates?.length ?? 0
                  return (
                    <button key={p.id} type="button" onClick={() => selectProject(p.id)}
                      className="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2">
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded shrink-0">{p.assignee || '—'}</span>
                      <span className="text-xs flex-1 min-w-0 truncate">{p.title}</span>
                      {cnt > 0 && <span className="text-[10px] text-emerald-600 shrink-0">候補{cnt}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <>
              {/* 選択中カード */}
              <div className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-2.5 py-2">
                <button type="button" onClick={backToList} className="text-muted-foreground hover:text-foreground shrink-0" title="カードを選び直す">
                  <ChevronLeftIcon className="size-4" />
                </button>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded shrink-0">{selected.assignee || '—'}</span>
                <span className="text-xs font-medium flex-1 min-w-0 truncate">{selected.title}</span>
              </div>

              {/* ステップ2：CSVドロップ */}
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
                <p className="text-xs font-medium">② CSVをドラッグ&ドロップ</p>
                <p className="text-[10px] text-muted-foreground">またはクリックして選択（投稿名・キャプション/備考の列を読み込みます）</p>
                <input id="cap-bulk-csv" type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
              {csvMsg && <p className={cn('text-[11px]', csvMsg.startsWith('✓') ? 'text-emerald-600' : 'text-amber-600')}>{csvMsg}</p>}

              {/* 複数投稿が見つかった場合のピッカー */}
              {csvGroups && (
                <div className="rounded-md border p-2 space-y-1 bg-muted/30">
                  {csvGroups.map((g) => (
                    <button key={g.title} type="button" onClick={() => chooseGroup(g)}
                      className="w-full text-left rounded px-2 py-1.5 text-xs hover:bg-background border border-transparent hover:border-border transition-colors">
                      <span className="font-medium">{g.title}</span>
                      <span className="text-muted-foreground ml-1">（候補{g.cands.length}件）</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 候補の編集 */}
              {!csvGroups && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">候補（{rows.filter((r) => r.text.trim()).length}件）— 直接編集・追加もできます</p>
                  {rows.map((r, i) => (
                    <div key={r.id} className="rounded-md border p-2 space-y-1.5 bg-card">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground shrink-0">候補{i + 1}</span>
                        <Input value={r.memo} onChange={(e) => updateRow(r.id, { memo: e.target.value })}
                          placeholder="メモ（任意・例：A案）" className="h-6 text-[11px] flex-1" />
                        <button type="button" onClick={() => removeRow(r.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0" title="この候補を削除">
                          <XIcon className="size-3.5" />
                        </button>
                      </div>
                      <Textarea value={r.text} onChange={(e) => updateRow(r.id, { text: e.target.value })}
                        rows={3} placeholder="キャプション本文" className="text-xs" />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addRow}>
                    <PlusIcon className="size-3" /> 候補を追加
                  </Button>
                </div>
              )}

              {savedMsg && (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-2 text-[11px] text-emerald-700 flex items-center gap-1.5">
                  <CheckIcon className="size-3.5" /> {savedMsg}
                </div>
              )}
            </>
          )}
        </div>

        {selected && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={backToList}>別のカードに登録</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || csvGroups !== null}>
              {saving ? '保存中…' : 'このカードに登録する'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
