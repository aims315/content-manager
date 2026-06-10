'use client'

import { useState } from 'react'
import { useFileUpload } from '@/hooks/use-file-upload'
import { FileUpload } from '@/components/file-upload'
import type { Project, ProjectStep, StepStatus, StepKey, ProviderType } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  CalendarIcon,
  Trash2Icon,
  UserIcon,
  FileIcon,
  PencilIcon,
  CheckCircleIcon,
  DownloadIcon,
  ExternalLinkIcon,
  SendIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LockIcon,
  InstagramIcon,
  TwitterIcon,
  CalendarDaysIcon,
  LinkIcon,
  BuildingIcon,
  WrenchIcon,
  CopyIcon,
  CheckIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function downloadFile(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function getFilename(url: string, names?: string[], index?: number) {
  if (names && index !== undefined && names[index]) return names[index]
  const raw = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '')
  return raw || 'ファイル'
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(amount)
}

function TextWithLinks({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return (
    <span>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-primary underline break-all hover:opacity-80"
            onClick={(e) => e.stopPropagation()}>{part}</a>
        ) : part
      )}
    </span>
  )
}

const stepStatusColors: Record<StepStatus, string> = {
  '未着手': 'bg-muted text-muted-foreground',
  'ロック中': 'bg-slate-100 text-slate-400',
  '素材待ち': 'bg-amber-100 text-amber-800',
  '素材受領': 'bg-yellow-100 text-yellow-800',
  '進行中': 'bg-blue-100 text-blue-800',
  '確認待ち': 'bg-violet-100 text-violet-800',
  '完了': 'bg-emerald-100 text-emerald-800',
}

const providerBadge: Record<ProviderType, { label: string; icon: React.ReactNode; className: string }> = {
  client: { label: 'クライアント', icon: <BuildingIcon className="size-2.5" />, className: 'bg-amber-100 text-amber-800' },
  freelancer: { label: '外注', icon: <UserIcon className="size-2.5" />, className: 'bg-violet-100 text-violet-800' },
  self: { label: '自分', icon: <WrenchIcon className="size-2.5" />, className: 'bg-sky-100 text-sky-800' },
}

const STEP_STATUSES: StepStatus[] = ['未着手', 'ロック中', '素材待ち', '素材受領', '進行中', '確認待ち', '完了']

const projectTypeConfig = {
  instagram: { label: 'Instagram', icon: <InstagramIcon className="size-3.5" />, color: 'text-pink-600' },
  twitter: { label: 'X / Twitter', icon: <TwitterIcon className="size-3.5" />, color: 'text-sky-600' },
  event: { label: 'イベント', icon: <CalendarDaysIcon className="size-3.5" />, color: 'text-violet-600' },
}

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 text-[10px] rounded border border-dashed border-muted-foreground/40 px-1.5 py-0.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      title="提出URLをコピー"
    >
      {copied ? <CheckIcon className="size-2.5 text-emerald-500" /> : <CopyIcon className="size-2.5" />}
      {copied ? 'コピー済み' : '提出URL'}
    </button>
  )
}

interface StepRowProps {
  step: ProjectStep
  allSteps: ProjectStep[]
  onStatusChange: (stepId: string, status: StepStatus) => Promise<void>
  onSubmit: (stepId: string, data: { url?: string; note?: string; fileUrls?: string[]; fileNames?: string[] }) => Promise<void>
}

function StepRow({ step, allSteps, onStatusChange, onSubmit }: StepRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const files = useFileUpload()

  const completedKeys = allSteps.filter((s) => s.status === '完了').map((s) => s.step_key as StepKey)
  const isLocked = step.status === 'ロック中'
  const hasContent = step.url || step.note || (step.file_urls?.length > 0)

  const prov = providerBadge[step.provider_type]
  const provLabel = step.provider_type === 'freelancer' && step.provider_name
    ? step.provider_name
    : prov.label

  // 提出URL（外部提出者向け）
  const submitUrl = step.provider_type !== 'self'
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/submit/step/${step.id}`
    : null

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await onSubmit(step.id, {
        url: url.trim() || undefined,
        note: note.trim() || undefined,
        fileUrls: files.uploadedFiles.map((f) => f.url),
        fileNames: files.uploadedFiles.map((f) => f.name),
      })
      setUrl(''); setNote(''); files.reset(); setExpanded(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSubmit = async () => {
    setSubmitting(true)
    try {
      await onSubmit(step.id, {
        url: url.trim() || undefined,
        note: note.trim() || undefined,
        fileUrls: files.uploadedFiles.length > 0 ? files.uploadedFiles.map((f) => f.url) : step.file_urls,
        fileNames: files.uploadedFiles.length > 0 ? files.uploadedFiles.map((f) => f.name) : step.file_names,
      })
      setEditing(false)
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = () => {
    setUrl(step.url ?? ''); setNote(step.note ?? ''); files.reset()
    setEditing(true); setExpanded(true)
  }

  return (
    <div className={cn(
      'rounded-md border transition-all',
      isLocked && 'opacity-50',
      step.status === '完了' && 'border-emerald-200 bg-emerald-50/50'
    )}>
      <div className="flex items-center gap-2 px-3 py-2">
        {isLocked
          ? <LockIcon className="size-3 shrink-0 text-muted-foreground" />
          : step.status === '完了'
          ? <CheckCircleIcon className="size-3 shrink-0 text-emerald-500" />
          : <div className="size-3 shrink-0 rounded-full border-2 border-muted-foreground" />
        }
        <span className={cn('text-xs font-medium flex-1 min-w-0 truncate', isLocked && 'text-muted-foreground')}>
          {step.label}
        </span>

        {/* 担当者バッジ */}
        <span className={cn('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded shrink-0', prov.className)}>
          {prov.icon}
          {provLabel}
        </span>

        {/* 提出URLコピー */}
        {!isLocked && submitUrl && (
          <CopyUrlButton url={submitUrl} />
        )}

        <Badge className={cn(stepStatusColors[step.status], 'text-[10px] px-1.5 py-0 shrink-0')} variant="secondary">
          {step.status}
        </Badge>

        {!isLocked && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            {expanded ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
          </button>
        )}
      </div>

      {expanded && !isLocked && (
        <div className="px-3 pb-3 space-y-3 border-t pt-2">
          {/* ステータス変更 */}
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0 text-muted-foreground">ステータス</Label>
            <Select value={step.status} onValueChange={(v) => onStatusChange(step.id, v as StepStatus)}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 提出URLのリンク表示（外部提出者向け） */}
          {submitUrl && (
            <div className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1.5 text-xs">
              <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-muted-foreground font-mono text-[10px]">{submitUrl}</span>
              <a href={submitUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary hover:underline">
                <ExternalLinkIcon className="size-3" />
              </a>
            </div>
          )}

          {/* 提出済みコンテンツ */}
          {hasContent && !editing && (
            <div className="space-y-1.5 rounded bg-muted/50 p-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium flex items-center gap-1">
                  <CheckCircleIcon className="size-3 text-emerald-500" /> 提出済み
                  {step.submitted_at && (
                    <span className="text-muted-foreground font-normal">
                      （{format(new Date(step.submitted_at), 'M/d HH:mm', { locale: ja })}）
                    </span>
                  )}
                  {step.submitted_by && (
                    <span className="text-muted-foreground font-normal">by {step.submitted_by}</span>
                  )}
                </p>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={startEdit}>
                  <PencilIcon className="size-3 mr-1" /> 編集
                </Button>
              </div>
              {step.url && (
                <a href={step.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLinkIcon className="size-3" /> データを見る
                </a>
              )}
              {step.note && <p className="text-xs text-muted-foreground"><TextWithLinks text={step.note} /></p>}
              {step.file_urls?.map((u, i) => (
                <div key={i} className="flex items-center gap-2 rounded bg-background px-2 py-1">
                  <FileIcon className="size-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-xs">{getFilename(u, step.file_names, i)}</span>
                  <Button type="button" variant="ghost" size="icon" className="size-5" onClick={() => downloadFile(u)}>
                    <DownloadIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 入力フォーム */}
          {(!hasContent || editing) && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">URLでデータを共有（Googleドライブなど）</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://drive.google.com/..." className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs">メモ・備考</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="補足など（任意）" rows={2} className="text-xs resize-none mt-1" />
              </div>
              <FileUpload
                uploadedFiles={files.uploadedFiles}
                isUploading={files.isUploading}
                uploadError={files.uploadError}
                onUpload={files.uploadFiles}
                onRemove={files.removeFile}
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-8 text-xs"
                  onClick={editing ? handleEditSubmit : handleSubmit}
                  disabled={submitting || files.isUploading || (!url.trim() && !note.trim() && files.uploadedFiles.length === 0)}>
                  <SendIcon className="size-3 mr-1.5" />
                  {submitting ? '保存中...' : editing ? '変更を保存' : '提出 → 素材受領へ'}
                </Button>
                {editing && (
                  <Button size="sm" variant="ghost" className="h-8 text-xs"
                    onClick={() => { setEditing(false); setUrl(''); setNote(''); files.reset() }}>
                    キャンセル
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ProjectCardProps {
  project: Project
  steps: ProjectStep[]
  onStepStatusChange: (stepId: string, status: StepStatus) => Promise<void>
  onStepSubmit: (stepId: string, data: { url?: string; note?: string; fileUrls?: string[]; fileNames?: string[] }) => Promise<void>
  onDelete: (projectId: string) => Promise<boolean>
}

export function ProjectCard({ project, steps, onStepStatusChange, onStepSubmit, onDelete }: ProjectCardProps) {
  const [stepsOpen, setStepsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const typeConfig = projectTypeConfig[project.project_type]
  const totalSteps = steps.length
  const completedSteps = steps.filter((s) => s.status === '完了').length
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  // 素材待ちの外部ステップをカウント
  const pendingExternal = steps.filter(
    (s) => s.provider_type !== 'self' && (s.status === '素材待ち' || s.status === '未着手')
  ).length

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete(project.id)
    setIsDeleting(false)
  }

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className={cn('flex items-center gap-1.5 mb-1', typeConfig.color)}>
              {typeConfig.icon}
              <span className="text-xs font-medium">{typeConfig.label}</span>
            </div>
            <CardTitle className="text-sm font-semibold leading-tight">{project.title}</CardTitle>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 shrink-0" disabled={isDeleting}>
                <Trash2Icon className="size-3.5 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>プロジェクトを削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  「{project.title}」とすべてのステップを削除します。この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>削除する</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {project.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            <TextWithLinks text={project.description} />
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <UserIcon className="size-3" />
            <span className="bg-muted px-1.5 py-0.5 rounded font-medium">{project.assignee}</span>
          </div>
          {project.amount != null && (
            <span className="text-emerald-700 font-medium">{formatAmount(project.amount)}</span>
          )}
          {project.due_date && (
            <div className="flex items-center gap-1">
              <CalendarIcon className="size-3" />
              <span>{format(new Date(project.due_date), 'M/d', { locale: ja })}</span>
            </div>
          )}
        </div>

        {/* 進捗バー */}
        {totalSteps > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>進捗 {completedSteps}/{totalSteps}</span>
              {pendingExternal > 0 && (
                <span className="text-amber-600 font-medium">素材待ち {pendingExternal}件</span>
              )}
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* ステップ一覧トグル */}
        <button
          type="button"
          onClick={() => setStepsOpen((v) => !v)}
          className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground py-1 border-t"
        >
          <span className="font-medium">ステップを{stepsOpen ? '閉じる' : '表示'}</span>
          {stepsOpen ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
        </button>

        {stepsOpen && steps.length > 0 && (
          <div className="space-y-1.5">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                allSteps={steps}
                onStatusChange={onStepStatusChange}
                onSubmit={onStepSubmit}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
