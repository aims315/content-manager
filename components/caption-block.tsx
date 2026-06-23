'use client'

import { useEffect, useState } from 'react'
import type { PostCaption, CaptionCandidate, CaptionStatus, ProjectStep, Project } from '@/lib/types'
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
  PaperclipIcon, ExternalLinkIcon, FileIcon, ChevronDownIcon, ChevronUpIcon,
} from 'lucide-react'

// 本文中のURLをクリック可能にして表示
function LinkText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/)
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        /^https?:\/\//.test(p)
          ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all" onClick={(e) => e.stopPropagation()}>{p}</a>
          : p
      )}
    </span>
  )
}

// 納品リンクのステージ優先順位（前ほど優先）。ステータス名・ステップ名どちらでも部分一致で判定。
const DELIVERED_STAGE_PRIORITY = ['修正完了', '初稿確認', '初校確認']

function hasLink(s: ProjectStep): boolean {
  return !!(s.url && s.url.trim()) || (s.file_urls?.length ?? 0) > 0
}

function latestBySubmitted(list: ProjectStep[]): ProjectStep | null {
  if (list.length === 0) return null
  return [...list].sort((a, b) => {
    const ta = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
    const tb = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
    return tb - ta
  })[0] ?? null
}

// 納品物リンク：修正完了（最新）→ 初稿確認 の順で、提出URL/ファイルがあるステップを採用。
// 該当が無ければ、提出物のあるステップのうち提出日が最新のものを採用。
function latestDelivered(steps: ProjectStep[]): ProjectStep | null {
  const withLink = steps.filter(hasLink)
  if (withLink.length === 0) return null
  for (const stage of DELIVERED_STAGE_PRIORITY) {
    const matches = withLink.filter((s) => (s.status?.includes(stage)) || (s.label?.includes(stage)))
    const picked = latestBySubmitted(matches)
    if (picked) return picked
  }
  return latestBySubmitted(withLink)
}

// 説明文から納品リンクを優先順位で拾う：修正完了（修正校）→ 初稿確認。
// 該当ステージ語が無ければ、最後に出てくるURL（最新の追記とみなす）を採用。
const STAGE_KEYWORDS: { label: string; kws: string[] }[] = [
  { label: '修正完了', kws: ['修正完了', '修正校', '修正版', '修正済'] },
  { label: '初稿確認', kws: ['初稿', '初校'] },
]
function deliveredFromDescription(desc?: string | null): { url: string; stage: string } | null {
  if (!desc) return null
  const urls = [...desc.matchAll(/https?:\/\/[^\s　）)」』】、。]+/g)].map((m) => ({ url: m[0], idx: m.index ?? 0 }))
  if (urls.length === 0) return null
  for (const stage of STAGE_KEYWORDS) {
    for (const kw of stage.kws) {
      const ki = desc.indexOf(kw)
      if (ki >= 0) {
        const after = urls.find((u) => u.idx >= ki)
        return { url: (after ?? urls[urls.length - 1]).url, stage: stage.label }
      }
    }
  }
  return { url: urls[urls.length - 1].url, stage: '納品物' }
}

function fileLabel(url: string, names: string[] | undefined, i: number): string {
  if (names && names[i]) return names[i]
  const raw = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '')
  return raw || `ファイル${i + 1}`
}

// 文字単位の差分（orig → edited）。editedの追加・変更部分を赤で表示する。
function DiffText({ orig, edited, className }: { orig: string; edited: string; className?: string }) {
  const a = orig, b = edited
  const n = a.length, m = b.length
  // LCS長テーブル
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const segs: { text: string; added: boolean }[] = []
  const push = (ch: string, added: boolean) => {
    const last = segs[segs.length - 1]
    if (last && last.added === added) last.text += ch
    else segs.push({ text: ch, added })
  }
  let i = 0, j = 0
  while (j < m) {
    if (i < n && a[i] === b[j]) { push(b[j], false); i++; j++ }
    else if (i < n && dp[i + 1][j] >= dp[i][j + 1]) { i++ } // origの削除はスキップ
    else { push(b[j], true); j++ }
  }
  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap' }}>
      {segs.map((s, k) => s.added
        ? <span key={k} className="text-rose-600 font-semibold bg-rose-50">{s.text}</span>
        : <span key={k}>{s.text}</span>)}
    </span>
  )
}

import { uid, parseCaptionCsv, parseTextCandidates, type CaptionGroup } from '@/lib/caption-csv'

const STATUS_STYLE: Record<CaptionStatus, string> = {
  '未確認': 'bg-slate-100 text-slate-600',
  '選択済': 'bg-sky-100 text-sky-700',
  '修正依頼': 'bg-rose-100 text-rose-700',
  '差し戻し': 'bg-rose-100 text-rose-700',
  '確定': 'bg-emerald-100 text-emerald-700',
}

const ALL_STATUSES: CaptionStatus[] = ['未確認', '選択済', '修正依頼', '差し戻し', '確定']

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
  steps?: ProjectStep[]
  project?: Project
  onSave: (projectId: string, patch: CaptionPatch) => Promise<boolean | void>
}

export function CaptionBlock({ projectId, caption, clientMode, actorName, steps = [], project, onSave }: Props) {
  const candidates = caption?.candidates ?? []
  const status = caption?.status ?? '未確認'
  const hasCandidates = candidates.length > 0

  // 納品物リンクの判定：
  //  - response_url（修正完了）は実納品物として表示
  //  - draft_url（初稿）は「説明文に含まれていない＝実提出」のときだけ表示。
  //    説明文と同じURL（指示用の資料リンク）は納品物として扱わない
  //  - 同期URLが無ければ、提出されたステップを使う
  const descriptionText = (project?.description ?? '').trim()
  const draftIsBrief = !!project?.draft_url && !!descriptionText && descriptionText.includes(project.draft_url)
  const syncedUrl = project?.response_url || (project?.draft_url && !draftIsBrief ? project.draft_url : null) || null
  const stepDeliv = syncedUrl ? null : latestDelivered(steps)
  const deliveredUrl = syncedUrl || stepDeliv?.url || null
  const deliveredStage = project?.response_url ? '修正完了' : (syncedUrl ? '初稿確認' : (stepDeliv?.status || ''))
  const deliveredSource = syncedUrl ? '納品データ' : (stepDeliv?.label ?? '')
  const deliveredDate = stepDeliv?.submitted_at ?? null
  const hasDelivered = !!(deliveredUrl || (stepDeliv && (stepDeliv.file_urls?.length ?? 0) > 0))
  // 参考表示する文（ステップの提出メモ or 説明文）
  const deliveredText = (stepDeliv ? (stepDeliv.note ?? '') : descriptionText).trim()
  const [showSource, setShowSource] = useState(false)
  const [showDesc, setShowDesc] = useState(false)

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
        <div className="flex items-center gap-1.5">
          {clientMode && hasCandidates && status !== '確定' && !caption?.selected_candidate_id && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 animate-pulse">
              要選択
            </span>
          )}
          {hasCandidates && (
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[status])}>
              {status}
            </span>
          )}
        </div>
      </div>

      {/* 最新の納品物リンク（候補の上に表示） */}
      {hasDelivered && (
        <div className="rounded-md border bg-background px-2.5 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
            <PaperclipIcon className="size-3 text-primary shrink-0" />
            <span className="font-semibold shrink-0">最新の納品物</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] shrink-0">{deliveredStage}</span>
            <span className="text-muted-foreground truncate flex-1 min-w-0">{deliveredSource}</span>
            {deliveredDate && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(deliveredDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
              </span>
            )}
          </div>
          {deliveredUrl && (
            <a href={deliveredUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-primary underline break-all hover:opacity-80">
              <ExternalLinkIcon className="size-3 shrink-0" /> 納品リンクを開く
            </a>
          )}
          {stepDeliv?.file_urls?.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-primary underline break-all hover:opacity-80">
              <FileIcon className="size-3 shrink-0" /> {fileLabel(u, stepDeliv.file_names, i)}
            </a>
          ))}

          {/* 引っ張ってきた元の文（折りたたみ） */}
          {deliveredText && (
            <div className="pt-0.5">
              <button type="button" onClick={() => setShowSource((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                {showSource ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
                {stepDeliv ? '提出メモ' : '元の説明文'}を{showSource ? '閉じる' : '見る'}
              </button>
              {showSource && (
                <div className="mt-1 text-[11px] text-foreground/80 border-t pt-1.5 max-h-40 overflow-y-auto">
                  <LinkText text={deliveredText} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 納品物が無い場合：無い表記＋説明文を参考表示 */}
      {!hasDelivered && (
        <div className="rounded-md border bg-background px-2.5 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px]">
            <PaperclipIcon className="size-3 text-muted-foreground shrink-0" />
            <span className="font-semibold text-muted-foreground">最新の納品物</span>
            <span className="text-muted-foreground">まだありません</span>
          </div>
          {descriptionText && (
            <div className="pt-0.5">
              <button type="button" onClick={() => setShowDesc((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                {showDesc ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
                説明文を{showDesc ? '閉じる' : '見る'}
              </button>
              {showDesc && (
                <div className="mt-1 text-[11px] text-foreground/80 border-t pt-1.5 max-h-40 overflow-y-auto">
                  <LinkText text={descriptionText} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
  const [pasteText, setPasteText] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [replySaving, setReplySaving] = useState(false)
  const candidates = caption?.candidates ?? []

  const sendReply = async () => {
    if (!reply.trim()) return
    setReplySaving(true)
    await onSave(projectId, { team_reply: reply.trim(), team_reply_at: new Date().toISOString() })
    setReply('')
    setReplySaving(false)
  }

  const toRows = (cands: { text: string; memo?: string }[]): EditorRow[] =>
    cands.map((c) => ({ id: uid(), text: c.text, memo: c.memo ?? '' }))

  // 既存の入力行（空行は除く）に追記する
  const appendRows = (cands: { text: string; memo?: string }[]) =>
    setRows((prev) => [...prev.filter((r) => r.text.trim()), ...toRows(cands)])

  const openEditor = () => {
    setRows(candidates.length ? toRows(candidates) : [{ id: uid(), text: '', memo: '' }])
    setCsvGroups(null); setCsvMsg(''); setPasteText('')
    setEditOpen(true)
  }

  const loadCsvText = (raw: string) => {
    const groups = parseCaptionCsv(raw)
    if (groups.length === 0) { setCsvMsg('CSVから候補を読み取れませんでした（投稿名・キャプション/備考の列を確認してください）'); return }
    if (groups.length === 1) {
      appendRows(groups[0].cands); setCsvGroups(null)
      setCsvMsg(`✓「${groups[0].title}」から${groups[0].cands.length}件の候補を追加しました`)
    } else {
      setCsvGroups(groups)
      setCsvMsg(`${groups.length}件の投稿が見つかりました。このカードに追加する投稿を選んでください`)
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
    appendRows(g.cands); setCsvGroups(null)
    setCsvMsg(`✓「${g.title}」から${g.cands.length}件の候補を追加しました`)
  }

  const importPaste = () => {
    const parsed = parseTextCandidates(pasteText)
    if (parsed.length === 0) { setCsvMsg('テキストから候補を読み取れませんでした'); return }
    appendRows(parsed)
    setPasteText('')
    setCsvMsg(`✓ テキストから${parsed.length}件の候補を追加しました`)
  }

  const updateRow = (id: string, patch: Partial<EditorRow>) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))
  const addRow = () => setRows((prev) => [...prev, { id: uid(), text: '', memo: '' }])
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))

  const handleSave = async () => {
    setSaving(true)
    const cands: CaptionCandidate[] = rows
      .map((r) => ({ id: uid(), text: r.text.trim(), memo: r.memo.trim() || undefined, orig: r.text.trim() }))
      .filter((c) => c.text)
    // 候補を入れたらステータスは「未確認」スタート（既に進行中なら維持）
    const nextStatus = (caption?.status && caption.status !== '未確認') ? caption.status : '未確認'
    await onSave(projectId, { candidates: cands, status: nextStatus })
    setSaving(false)
    setEditOpen(false)
  }

  // 社内側からの手動ステータス変更
  const changeStatus = async (status: CaptionStatus) => {
    const patch: { status: CaptionStatus; selected_candidate_id?: string; draft_text?: string; decided_by?: string; decided_at?: string } = { status }
    const sel = candidates.find((c) => c.id === caption?.selected_candidate_id) ?? candidates[0]
    if (status === '確定') {
      patch.draft_text = (caption?.draft_text && caption.draft_text.trim()) ? caption.draft_text : (sel?.text ?? '')
      if (sel && !caption?.selected_candidate_id) patch.selected_candidate_id = sel.id
      patch.decided_by = '社内'; patch.decided_at = new Date().toISOString()
    } else if (status === '選択済' && !caption?.selected_candidate_id && sel) {
      patch.selected_candidate_id = sel.id
      patch.draft_text = caption?.draft_text || sel.text
    }
    await onSave(projectId, patch)
  }

  // この候補で確定（代理）
  const confirmCandidate = async (c: CaptionCandidate) => {
    await onSave(projectId, {
      selected_candidate_id: c.id, draft_text: c.text, status: '確定',
      decided_by: '社内', decided_at: new Date().toISOString(),
    })
  }

  return (
    <div className="space-y-2">
      {candidates.length === 0 ? (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full" onClick={openEditor}>
          <PencilIcon className="size-3" /> ＋ キャプション候補を登録
        </Button>
      ) : (
        <>
          {/* 社内ステータス操作 */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground shrink-0">ステータス変更</span>
            <select
              value={caption?.status ?? '未確認'}
              onChange={(e) => changeStatus(e.target.value as CaptionStatus)}
              className="h-7 text-xs rounded-md border bg-background px-2 flex-1 min-w-0"
            >
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 候補プレビュー（各候補を「この案で確定」できる） */}
          <div className="space-y-1">
            {candidates.map((c, i) => {
              const isSelected = caption?.selected_candidate_id === c.id
              return (
                <div key={c.id} className={cn('rounded border px-2 py-1.5', isSelected ? 'border-emerald-300 bg-emerald-50/50' : 'bg-background')}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] text-muted-foreground flex-1 min-w-0 truncate">
                      候補{i + 1}{c.memo ? `・${c.memo}` : ''}{isSelected ? '（選択中）' : ''}
                    </span>
                    <CopyButton text={c.text} />
                    <button type="button" onClick={() => confirmCandidate(c)}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 shrink-0">
                      この案で確定
                    </button>
                  </div>
                  <div className={cn('text-[11px] whitespace-pre-wrap text-foreground/80', expandedId !== c.id && 'line-clamp-2')}>
                    {c.orig && c.orig !== c.text
                      ? <DiffText orig={c.orig} edited={c.text} />
                      : c.text}
                  </div>
                  {c.orig && c.orig !== c.text && (
                    <span className="text-[9px] text-rose-600">● クライアントが修正（赤字が変更箇所）</span>
                  )}
                  <button type="button" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="mt-0.5 text-[10px] text-primary hover:underline">
                    {expandedId === c.id ? '▲ 閉じる' : '▼ 全文を見る'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* クライアントの選択・コメント・確定結果 */}
          {caption?.client_comment && (caption.status === '修正依頼' || caption.status === '差し戻し') && (
            <div className="rounded bg-rose-50 border border-rose-300 px-2 py-1.5">
              <div className="text-[10px] font-semibold text-rose-700 mb-0.5">
                クライアントからの{caption.status === '差し戻し' ? '差し戻し' : '修正依頼'}
                {caption.decided_by && <span className="font-normal"> (by {caption.decided_by})</span>}
              </div>
              <div className="text-[11px] whitespace-pre-wrap text-rose-700 font-medium">{caption.client_comment}</div>
            </div>
          )}

          {/* 制作チームからの返信（差し戻し/修正依頼へ） */}
          {(caption?.status === '修正依頼' || caption?.status === '差し戻し') && (
            <div className="space-y-1">
              {caption?.team_reply && (
                <div className="rounded bg-sky-50 border border-sky-300 px-2 py-1.5">
                  <div className="text-[10px] font-semibold text-sky-700 mb-0.5 flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded-full bg-sky-600 text-white text-[9px]">制作チームの返信</span>
                    {caption.team_reply_at && <span className="font-normal text-sky-600">{new Date(caption.team_reply_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</span>}
                  </div>
                  <div className="text-[11px] whitespace-pre-wrap text-sky-800">{caption.team_reply}</div>
                </div>
              )}
              <div className="flex gap-1.5">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)}
                  placeholder={caption?.team_reply ? '返信を更新…' : 'クライアントへ返信…'} rows={1}
                  className="text-[11px] min-h-8 resize-none flex-1" />
                <Button type="button" size="sm" className="h-8 text-xs px-2 self-end" disabled={!reply.trim() || replySaving} onClick={sendReply}>
                  <SendIcon className="size-3" />返信
                </Button>
              </div>
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
              <p className="text-xs font-medium">CSVをドラッグ&ドロップして候補に追加</p>
              <p className="text-[10px] text-muted-foreground">またはクリックして選択（既存の候補に追加されます）</p>
              <input id={`cap-csv-${projectId}`} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>

            {/* テキストで貼り付けて追加 */}
            <div className="rounded-md border p-2 space-y-1.5 bg-muted/20">
              <p className="text-[11px] text-muted-foreground">
                テキストで貼り付けて追加（複数の候補は <code className="bg-muted px-1 rounded">---</code>（ハイフン3つだけの行）で区切る）
              </p>
              <Textarea rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                placeholder={'1案目の本文…\n---\n2案目の本文…'} className="text-xs" />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={importPaste} disabled={!pasteText.trim()}>
                <PlusIcon className="size-3" /> テキストを候補に追加
              </Button>
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

// ── クライアント側：全候補をその場で編集・選択・コメント・承認/差し戻し ──────
function ClientView({ projectId, caption, actorName, onSave }: {
  projectId: string; caption: PostCaption; actorName: string; onSave: Props['onSave']
}) {
  const [cands, setCands] = useState<CaptionCandidate[]>(caption.candidates)
  const [selectedId, setSelectedId] = useState<string | null>(caption.selected_candidate_id)
  const [comment, setComment] = useState(caption.client_comment ?? '')
  const [busy, setBusy] = useState(false)

  // 別端末での更新を反映
  useEffect(() => {
    setCands(caption.candidates)
    setSelectedId(caption.selected_candidate_id)
    setComment(caption.client_comment ?? '')
  }, [caption.candidates, caption.selected_candidate_id, caption.client_comment])

  const isConfirmed = caption.status === '確定'
  const needsSelection = !selectedId

  const editCand = (id: string, text: string) => setCands((prev) => prev.map((c) => c.id === id ? { ...c, text } : c))
  const saveCands = async () => { await onSave(projectId, { candidates: cands }) }

  const pick = async (c: CaptionCandidate) => {
    setSelectedId(c.id)
    await onSave(projectId, { candidates: cands, selected_candidate_id: c.id, draft_text: c.text, status: '選択済' })
  }

  const approve = async () => {
    if (!selectedId) return
    setBusy(true)
    const text = cands.find((c) => c.id === selectedId)?.text ?? ''
    await onSave(projectId, {
      candidates: cands, selected_candidate_id: selectedId, draft_text: text,
      status: '確定', decided_by: actorName, decided_at: new Date().toISOString(),
    })
    setBusy(false)
  }

  const requestEdit = async () => {
    setBusy(true)
    await onSave(projectId, {
      candidates: cands, client_comment: comment, status: '修正依頼',
      decided_by: actorName, decided_at: new Date().toISOString(),
    })
    setBusy(false)
  }

  const sendBack = async () => {
    setBusy(true)
    await onSave(projectId, {
      candidates: cands, client_comment: comment, status: '差し戻し',
      decided_by: actorName, decided_at: new Date().toISOString(),
    })
    setBusy(false)
  }

  return (
    <div className="space-y-2.5">
      {/* 制作チームからの返信（差し戻し/修正依頼への回答） */}
      {caption.team_reply && (
        <div className="rounded bg-sky-50 border border-sky-300 px-2 py-1.5">
          <div className="text-[10px] font-semibold text-sky-700 mb-0.5 flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded-full bg-sky-600 text-white text-[9px]">制作チームからの返信</span>
            {caption.team_reply_at && <span className="font-normal text-sky-600">{new Date(caption.team_reply_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</span>}
          </div>
          <div className="text-[11px] whitespace-pre-wrap text-sky-800">{caption.team_reply}</div>
        </div>
      )}
      {isConfirmed ? (
        <div className="rounded bg-emerald-50 border border-emerald-200 px-2 py-1.5 flex items-center gap-1.5 text-xs text-emerald-800">
          <CheckCircleIcon className="size-3.5" /> このキャプションは確定済みです。直したい場合は別の案を選び直して再度承認できます。
        </div>
      ) : needsSelection && (
        <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1.5 flex items-center gap-1.5 text-xs text-amber-800">
          <CheckCircleIcon className="size-3.5" /> 使う案を1つ選んでから「承認」してください
        </div>
      )}

      {/* 候補一覧：全候補をその場で編集できる */}
      <div className="space-y-1.5">
        {cands.map((c, i) => {
          const active = selectedId === c.id
          return (
            <div key={c.id}
              className={cn('rounded-md border px-2.5 py-2 transition-all',
                active ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border bg-background')}>
              <div className="flex items-center gap-1.5 mb-1.5">
                {/* 選択ボタン */}
                <button type="button" onClick={() => pick(c)}
                  className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors shrink-0',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary')}>
                  <span className={cn('size-2.5 rounded-full border flex items-center justify-center',
                    active ? 'border-primary-foreground' : 'border-current')}>
                    {active && <CheckIcon className="size-2 text-primary-foreground" />}
                  </span>
                  {active ? 'この案を選択中' : 'この案を選ぶ'}
                </button>
                <span className="text-[11px] font-medium text-muted-foreground flex-1 min-w-0 truncate">候補{i + 1}{c.memo ? `・${c.memo}` : ''}</span>
                <CopyButton text={c.text} />
              </div>
              {/* その場で編集できる本文 */}
              <Textarea
                rows={5}
                value={c.text}
                onChange={(e) => editCand(c.id, e.target.value)}
                onBlur={saveCands}
                className="text-xs"
              />
            </div>
          )
        })}
      </div>

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
