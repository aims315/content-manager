'use client'

import { useEffect, useState } from 'react'
import type { PostCaption, CaptionCandidate, CaptionStatus } from '@/lib/types'
import type { CaptionPatch } from '@/hooks/use-captions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  MessageSquareTextIcon, CheckCircleIcon, CopyIcon, CheckIcon,
  PencilIcon, SendIcon, Undo2Icon, FileTextIcon,
} from 'lucide-react'

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

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
function InternalView({ projectId, caption, onSave }: {
  projectId: string; caption?: PostCaption; onSave: Props['onSave']
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const candidates = caption?.candidates ?? []

  const openEditor = () => {
    setText(candidates.map((c) => c.text).join('\n---\n'))
    setEditOpen(true)
  }

  const parseCandidates = (raw: string): CaptionCandidate[] =>
    raw.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean).map((t) => ({ id: uid(), text: t }))

  const handleSave = async () => {
    setSaving(true)
    const parsed = parseCandidates(text)
    // 候補を入れたらステータスは「未確認」スタート（既に進行中なら維持）
    const nextStatus = (caption?.status && caption.status !== '未確認') ? caption.status : '未確認'
    await onSave(projectId, { candidates: parsed, status: nextStatus })
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileTextIcon className="size-4" /> キャプション候補を登録
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              候補が複数あるときは、候補と候補の間に <code className="bg-muted px-1 rounded">---</code>（ハイフン3つだけの行）を入れて区切ってください。
            </p>
            <Textarea
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'1案目のキャプション本文…\n---\n2案目のキャプション本文…'}
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>キャンセル</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
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
