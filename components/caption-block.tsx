'use client'

import { useEffect, useState } from 'react'
import type { PostCaption, CaptionCandidate, CaptionStatus } from '@/lib/types'
import type { CaptionPatch } from '@/hooks/use-captions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  MessageSquareTextIcon, CheckCircleIcon, CopyIcon, CheckIcon,
  PencilIcon, SendIcon, Undo2Icon, FileTextIcon, UploadIcon, PlusIcon, XIcon,
} from 'lucide-react'
import { uid, parseCaptionCsv, type CaptionGroup } from '@/lib/caption-csv'

const STATUS_STYLE: Record<CaptionStatus, string> = {
  '未確認': 'bg-slate-100 text-slate-600',
  '選択済': 'bg-sky-100 text-sky-700',
  '修正依頼': 'bg-amber-100 text-amber-800',
  '差し戻し': 'bg-rose-100 text-rose-700',
  '確定': 'bg-emerald-100 text-emerald-700',
}

function CopyButton({ text, label = 'コピー' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
    >
      {copied ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
      {copied ? 'コピー済み' : label}
    </Button>
  )
}

interface Props {
  projectId: string
  caption?: PostCaption
  clientMode: boolean
  actorName: string
  onSave: (projectId: string, patch: CaptionPatch) => Promise<boolean | void>
}

export function CaptionBlock({ projectId, caption, clientMode, actorName, onSave }: Props) {
  const candidates = caption?.candidates ?? []
  const status = caption?.status ?? '未確認'
  const hasCandidates = candidates.length > 0

  // クライアントが何も無いカードでは表示しない（社内は登録ボタンを出す）
  if (clientMode && !hasCandidates) return null

  return (
    <div className="rounded-lg border bg-muted/30 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <MessageSquareTextIcon className="size-3.5 text-primary" />
          キャプション
          {hasCandidates && <span className="text-muted-foreground font-normal">（候補{candidates.length}件）</span>}
        </div>
        {hasCandidates && (
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[status])}>
            {status}
          </span>
        )}
      </div>

      {clientMode
        ? <ClientView projectId={projectId} caption={caption!} actorName={actorName} onSave={onSave} />
        : <InternalView projectId={projectId} caption={caption} onSave={onSave} />}
    </div>
  )
}

// ── 社内側：候補の登録・編集 + クライアントの結果確認 ──────────────
interface EditorRow { id: string; text: string; memo: string }

function InternalView({ projectId, caption, onSave }: {
  projectId: string; caption?: PostCaption; onSave: Props['onSave']
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [rows, setRows] = useState<EditorRow[]>([])
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [csvGroups, setCsvGroups] = useState<CaptionGroup[] | null>(null)
  const [csvMsg, setCsvMsg] = useState('')
  const candidates = caption?.candidates ?? []

  const toRows = (cands: { text: string; memo?: string }[]): EditorRow[] =>
    cands.length
      ? cands.map((c) => ({ id: uid(), text: c.text, memo: c.memo ?? '' }))
      : [{ id: uid(), text: '', memo: '' }]

  const openEditor = () => {
    setRows(toRows(candidates))
    setCsvGroups(null); setCsvMsg('')
    setEditOpen(true)
  }

  const loadCsvText = (raw: string) => {
    const groups = parseCaptionCsv(raw)
    if (groups.length === 0) { setCsvMsg('CSVから候補を読み取れませんでした（投稿名・キャプション/備考の列を確認してください）'); return }
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
    if (file) handleFile(file)
    else setCsvMsg('CSVファイルが見つかりませんでした')
  }

  const chooseGroup = (g: CaptionGroup) => {
    setRows(toRows(g.cands)); setCsvGroups(null)
    setCsvMsg(`✓「${g.title}」から${g.cands.length}件の候補を読み込みました`)
  }

  const updateRow = (id: string, patch: Partial<EditorRow>) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))
  const addRow = () => setRows((prev) => [...prev, { id: uid(), text: '', memo: '' }])
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))

  const handleSave = async () => {
    setSaving(true)
    const cands: CaptionCandidate[] = rows
      .map((r) => ({ id: uid(), text: r.text.trim(), memo: r.memo.trim() || undefined }))
      .filter((c) => c.text)
    // 候補を入れたらステータスは「未確認」スタート（既に進行中なら維持）
    const nextStatus = (caption?.status && caption.status !== '未確認') ? caption.status : '未確認'
    await onSave(projectId, { candidates: cands, status: nextStatus })
    setSaving(false)
    setEditOpen(false)
  }

  return (
    <div className="space-y-2">
      {candidates.length === 0 ? (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full" onClick={openEditor}>
          <PencilIcon className="size-3" /> ＋ キャプション候補を登録
        </Button>
      ) : (
        <>
          {/* 候補プレビュー（先頭のみ簡易表示） */}
          <div className="space-y-1">
            {candidates.map((c, i) => (
              <div key={c.id} className="rounded bg-background border px-2 py-1.5">
                <div className="text-[10px] text-muted-foreground mb-0.5">候補{i + 1}{c.memo ? `・${c.memo}` : ''}</div>
                <div className="text-[11px] line-clamp-2 whitespace-pre-wrap text-foreground/80">{c.text}</div>
              </div>
            ))}
          </div>

          {/* クライアントの選択・コメント・確定結果 */}
          {caption?.client_comment && (caption.status === '修正依頼' || caption.status === '差し戻し') && (
            <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1.5">
              <div className="text-[10px] font-semibold text-amber-800 mb-0.5">
                クライアントからの{caption.status === '差し戻し' ? '差し戻し' : '修正依頼'}
                {caption.decided_by && <span className="font-normal"> (by {caption.decided_by})</span>}
              </div>
              <div className="text-[11px] whitespace-pre-wrap text-amber-900">{caption.client_comment}</div>
            </div>
          )}

          {caption?.status === '確定' && caption.draft_text && (
            <div className="rounded bg-emerald-50 border border-emerald-200 px-2 py-1.5 space-y-1">
              <div className="text-[10px] font-semibold text-emerald-800 flex items-center gap-1">
                <CheckCircleIcon className="size-3" /> 確定キャプション
                {caption.decided_by && <span className="font-normal">(by {caption.decided_by})</span>}
              </div>
              <div className="text-[11px] whitespace-pre-wrap text-emerald-900">{caption.draft_text}</div>
              <CopyButton text={caption.draft_text} label="確定をコピー" />
            </div>
          )}

          <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-muted-foreground" onClick={openEditor}>
            <PencilIcon className="size-3" /> 候補を編集
          </Button>
        </>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileTextIcon className="size-4" /> キャプション候補を登録
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* CSVドラッグ&ドロップ */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
              onDrop={handleDrop}
              onClick={() => document.getElementById(`cap-csv-${projectId}`)?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-5 cursor-pointer transition-colors text-center',
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/60'
              )}
            >
              <UploadIcon className="size-5 text-muted-foreground" />
              <p className="text-xs font-medium">CSVをドラッグ&ドロップして一括登録</p>
              <p className="text-[10px] text-muted-foreground">またはクリックして選択（投稿名・キャプション/備考の列を読み込みます）</p>
              <input id={`cap-csv-${projectId}`} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
            {csvMsg && (
              <p className={cn('text-[11px]', csvMsg.startsWith('✓') ? 'text-emerald-600' : 'text-amber-600')}>{csvMsg}</p>
            )}

            {/* 複数投稿が見つかった場合：このカードに入れる投稿を選ぶ */}
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

            {/* 候補の編集（行ごと） */}
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
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>キャンセル</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || csvGroups !== null}>
              {saving ? '保存中…' : '保存する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── クライアント側：選択・修正・コメント・承認/差し戻し ──────────────
function ClientView({ projectId, caption, actorName, onSave }: {
  projectId: string; caption: PostCaption; actorName: string; onSave: Props['onSave']
}) {
  const candidates = caption.candidates
  const [selectedId, setSelectedId] = useState<string | null>(caption.selected_candidate_id)
  const [draft, setDraft] = useState(caption.draft_text ?? '')
  const [comment, setComment] = useState(caption.client_comment ?? '')
  const [busy, setBusy] = useState(false)

  // 別端末での更新を反映
  useEffect(() => {
    setSelectedId(caption.selected_candidate_id)
    setDraft(caption.draft_text ?? '')
    setComment(caption.client_comment ?? '')
  }, [caption.selected_candidate_id, caption.draft_text, caption.client_comment])

  const isConfirmed = caption.status === '確定'

  const pick = async (c: CaptionCandidate) => {
    setSelectedId(c.id)
    setDraft(c.text)
    await onSave(projectId, { selected_candidate_id: c.id, draft_text: c.text, status: '選択済' })
  }

  const saveDraft = async () => {
    if (draft === (caption.draft_text ?? '')) return
    await onSave(projectId, { draft_text: draft })
  }

  const approve = async () => {
    setBusy(true)
    await onSave(projectId, {
      draft_text: draft, status: '確定',
      decided_by: actorName, decided_at: new Date().toISOString(),
    })
    setBusy(false)
  }

  const requestEdit = async () => {
    setBusy(true)
    await onSave(projectId, {
      client_comment: comment, status: '修正依頼',
      decided_by: actorName, decided_at: new Date().toISOString(),
    })
    setBusy(false)
  }

  const sendBack = async () => {
    setBusy(true)
    await onSave(projectId, {
      client_comment: comment, status: '差し戻し',
      decided_by: actorName, decided_at: new Date().toISOString(),
    })
    setBusy(false)
  }

  return (
    <div className="space-y-2.5">
      {isConfirmed && (
        <div className="rounded bg-emerald-50 border border-emerald-200 px-2 py-1.5 flex items-center gap-1.5 text-xs text-emerald-800">
          <CheckCircleIcon className="size-3.5" /> このキャプションは確定済みです。修正したい場合は下で選び直して再度承認できます。
        </div>
      )}

      {/* 候補一覧（選択） */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">使う案を選んでください</p>
        {candidates.map((c, i) => {
          const active = selectedId === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c)}
              className={cn(
                'w-full text-left rounded-md border px-2.5 py-2 transition-all',
                active ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border hover:border-muted-foreground/60 bg-background'
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn('size-3.5 rounded-full border flex items-center justify-center shrink-0',
                  active ? 'border-primary bg-primary' : 'border-muted-foreground')}>
                  {active && <CheckIcon className="size-2.5 text-primary-foreground" />}
                </span>
                <span className="text-[11px] font-medium">候補{i + 1}{c.memo ? `・${c.memo}` : ''}</span>
              </div>
              <div className="text-[11px] whitespace-pre-wrap text-foreground/80 pl-5">{c.text}</div>
            </button>
          )
        })}
      </div>

      {/* 選択中の本文を修正 */}
      {selectedId && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <PencilIcon className="size-3" /> 本文を修正（必要なら直接編集できます）
          </p>
          <Textarea
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveDraft}
            className="text-xs"
          />
          <CopyButton text={draft} />
        </div>
      )}

      {/* 修正依頼コメント */}
      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">修正依頼・コメント（任意）</p>
        <Textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="例：2案目で、最後の一文をもう少し柔らかく"
          className="text-xs resize-none"
        />
      </div>

      {/* アクション */}
      <div className="flex flex-wrap gap-2 pt-0.5">
        <Button size="sm" className="h-8 text-xs gap-1 flex-1 min-w-[120px]"
          onClick={approve} disabled={busy || !selectedId}>
          <CheckCircleIcon className="size-3.5" /> 承認する（確定）
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
          onClick={requestEdit} disabled={busy || !comment.trim()}>
          <SendIcon className="size-3" /> 修正依頼を送る
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
          onClick={sendBack} disabled={busy}>
          <Undo2Icon className="size-3" /> 差し戻し
        </Button>
      </div>
    </div>
  )
}
