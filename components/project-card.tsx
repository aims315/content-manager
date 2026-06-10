'use client'

import { useState } from 'react'
import { useFileUpload } from '@/hooks/use-file-upload'
import { FileUpload } from '@/components/file-upload'
import type { Project, ProjectStep, StepStatus, StepKey, ProviderType } from '@/lib/types'
import type { ProviderLabels, ProviderRole } from '@/hooks/use-provider-labels'
import { COLOR_STYLES } from '@/hooks/use-provider-labels'
import type { StepStatusDef } from '@/hooks/use-step-statuses'
import { STATUS_COLOR_STYLES } from '@/hooks/use-step-statuses'
import { ProjectEditDialog } from '@/components/project-edit-dialog'
import { StepManagerDialog } from '@/components/step-manager-dialog'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
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
  Link2Icon,
  AlertTriangleIcon,
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

// ステータス定義はprops経由で受け取り動的に扱う（後方互換フォールバック付き）
function getStatusDef(statusDefs: StepStatusDef[], label: string): StepStatusDef {
  return statusDefs.find((s) => s.label === label) ?? {
    id: label, label, color: 'slate', dim: false,
  }
}

const providerBadge: Record<ProviderType, { label: string; icon: React.ReactNode; className: string }> = {
  client: { label: 'クライアント', icon: <BuildingIcon className="size-2.5" />, className: 'bg-amber-100 text-amber-800' },
  freelancer: { label: '外注', icon: <UserIcon className="size-2.5" />, className: 'bg-violet-100 text-violet-800' },
  self: { label: '自分', icon: <WrenchIcon className="size-2.5" />, className: 'bg-sky-100 text-sky-800' },
}

const PROVIDER_OPTIONS: { value: ProviderType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'client', label: 'クライアント', icon: <BuildingIcon className="size-3" />, color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'freelancer', label: '外注', icon: <UserIcon className="size-3" />, color: 'bg-violet-100 text-violet-800 border-violet-300' },
  { value: 'self', label: '自分', icon: <WrenchIcon className="size-3" />, color: 'bg-sky-100 text-sky-800 border-sky-300' },
]

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
  projectType: string
  providerLabels: ProviderLabels
  providerRoles: ProviderRole[]
  statusDefs: StepStatusDef[]
  onStatusChange: (stepId: string, status: StepStatus) => Promise<void>
  onSubmit: (stepId: string, data: { url?: string; note?: string; fileUrls?: string[]; fileNames?: string[] }) => Promise<void>
  onProviderChange: (stepId: string, providerType: ProviderType, providerName: string | null) => Promise<void>
  onDueDateChange: (stepId: string, dueDate: string | null) => Promise<void>
  onDependenciesChange: (stepId: string, dependsOn: string[]) => Promise<void>
}

function StepRow({ step, allSteps, projectType, providerLabels, providerRoles, statusDefs, onStatusChange, onSubmit, onProviderChange, onDueDateChange, onDependenciesChange }: StepRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingProvider, setEditingProvider] = useState(false)
  const [newProviderType, setNewProviderType] = useState<string>(step.provider_type)
  const [newProviderName, setNewProviderName] = useState(step.provider_name ?? '')
  const files = useFileUpload()

  const isLocked = step.status === 'ロック中'
  const hasContent = step.url || step.note || (step.file_urls?.length > 0)

  const currentRole = providerRoles.find((r) => r.id === step.provider_type)
  const provBadgeClass = currentRole ? COLOR_STYLES[currentRole.color].badge : 'bg-muted text-muted-foreground'
  const provLabel = step.provider_name || providerLabels[step.provider_type] || step.provider_type

  const submitUrl = step.provider_type !== 'self'
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/submit/step/${step.id}`
    : null

  const handleStatusChange = async (v: string) => {
    setStatusChanging(true)
    await onStatusChange(step.id, v as StepStatus)
    setStatusChanging(false)
  }

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

  const handleProviderSave = async () => {
    await onProviderChange(step.id, newProviderType as ProviderType, newProviderName.trim() || null)
    setEditingProvider(false)
  }

  const currentStatusDef = getStatusDef(statusDefs, step.status)
  const isDimmed = currentStatusDef.dim ?? false
  const statusBadgeClass = STATUS_COLOR_STYLES[currentStatusDef.color].badge
  const statusSelectClass = STATUS_COLOR_STYLES[currentStatusDef.color].select

  // 依存ステップの計算
  const dependsOnIds: string[] = step.depends_on ?? []
  const depSteps = allSteps.filter((s) => dependsOnIds.includes(s.id))
  const doneStatusLabels = statusDefs.filter((s) => s.dim).map((s) => s.label)
  const blockedBy = depSteps.filter((s) => !doneStatusLabels.includes(s.status))
  const isBlocked = blockedBy.length > 0

  const toggleDependency = async (targetId: string) => {
    const current = dependsOnIds
    const next = current.includes(targetId)
      ? current.filter((id) => id !== targetId)
      : [...current, targetId]
    await onDependenciesChange(step.id, next)
  }

  return (
    <div className={cn(
      'rounded-md border transition-all',
      isDimmed ? 'opacity-50 bg-slate-50/60' : 'bg-card'
    )}>
      {/* ── 上段：アイコン・ラベル・担当者・[▼] ── */}
      <div className="flex items-center gap-2 px-3 py-2">
        {isLocked
          ? <LockIcon className="size-3 shrink-0 text-muted-foreground" />
          : step.status === '完了'
          ? <CheckCircleIcon className="size-3 shrink-0 text-emerald-500" />
          : <div className="size-3 shrink-0 rounded-full border-2 border-muted-foreground" />
        }
        <span className={cn('text-xs font-medium flex-1 min-w-0 truncate', isDimmed && 'text-muted-foreground')}>
          {step.label}
          {step.step_due_date && (
            <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
              〆{format(new Date(step.step_due_date), 'M/d', { locale: ja })}
            </span>
          )}
        </span>

        {/* 前提ステップ設定ポップオーバー */}
        {allSteps.filter((s) => s.id !== step.id).length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="前提ステップを設定"
                className={cn(
                  'flex items-center gap-0.5 shrink-0 rounded px-1 py-0.5 transition-colors',
                  dependsOnIds.length > 0
                    ? isBlocked
                      ? 'text-rose-500 hover:text-rose-600'
                      : 'text-emerald-500 hover:text-emerald-600'
                    : 'text-muted-foreground/40 hover:text-muted-foreground'
                )}
              >
                {isBlocked
                  ? <AlertTriangleIcon className="size-3" />
                  : <Link2Icon className="size-3" />
                }
                {dependsOnIds.length > 0 && (
                  <span className="text-[10px]">{dependsOnIds.length}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <p className="text-xs font-semibold mb-2 text-muted-foreground">前提ステップ</p>
              <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                チェックしたステップが完了しないと、このステップがブロックされます。
              </p>
              <div className="space-y-1">
                {allSteps
                  .filter((s) => s.id !== step.id)
                  .map((s) => {
                    const checked = dependsOnIds.includes(s.id)
                    const sDef = getStatusDef(statusDefs, s.status)
                    const sDone = sDef.dim ?? false
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDependency(s.id)}
                          className="rounded"
                        />
                        <span className={cn('text-xs flex-1 truncate', sDone && 'line-through text-muted-foreground')}>
                          {s.label}
                        </span>
                        <span className={cn('text-[10px] px-1 py-0 rounded', STATUS_COLOR_STYLES[sDef.color].badge)}>
                          {s.status}
                        </span>
                      </label>
                    )
                  })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* 担当者バッジ（クリックで編集） */}
        <button
          type="button"
          onClick={() => { setEditingProvider(true); setExpanded(true); setNewProviderType(step.provider_type); setNewProviderName(step.provider_name ?? '') }}
          className={cn('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded shrink-0 hover:opacity-75 transition-opacity', provBadgeClass)}
          title="担当者を変更"
        >
          {provLabel}
        </button>

        {/* 展開ボタン（常に表示） */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          {expanded ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
        </button>
      </div>

      {/* ── ステータス変更行：常時表示 ── */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <Select value={step.status} onValueChange={handleStatusChange} disabled={statusChanging}>
          <SelectTrigger className={cn(
            'h-7 text-xs flex-1 font-medium transition-colors',
            isBlocked ? 'bg-rose-50 border-rose-300 text-rose-700' : statusSelectClass,
            statusChanging && 'opacity-60'
          )}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusDefs.map((s) => (
              <SelectItem key={s.id} value={s.label}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 提出URLコピー */}
        {submitUrl && <CopyUrlButton url={submitUrl} />}
      </div>

      {/* ── 展開パネル：担当者編集・締め切り・ファイル提出 ── */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t pt-2">

          {/* 担当者編集 */}
          {editingProvider && (
            <div className="rounded-md border border-dashed p-2 space-y-2 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">担当者を変更</p>
              <div className="flex gap-1.5 flex-wrap">
                {providerRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setNewProviderType(role.id)}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                      newProviderType === role.id
                        ? COLOR_STYLES[role.color].button + ' border-current'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                    )}
                  >
                    {role.label}
                  </button>
                ))}
                <Input
                  value={newProviderName}
                  onChange={(e) => setNewProviderName(e.target.value)}
                  placeholder="名前（任意）"
                  className="h-7 text-xs w-40"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleProviderSave}>保存</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingProvider(false)}>キャンセル</Button>
              </div>
            </div>
          )}

          {/* 締め切り編集（全種別） */}
          {(
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0 text-muted-foreground">締め切り</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn('h-7 text-xs gap-1.5', !step.step_due_date && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="size-3" />
                    {step.step_due_date
                      ? format(new Date(step.step_due_date), 'M/d(E)', { locale: ja })
                      : '設定なし'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={step.step_due_date ? new Date(step.step_due_date) : undefined}
                    onSelect={(date) => onDueDateChange(step.id, date ? format(date, 'yyyy-MM-dd') : null)}
                    locale={ja}
                  />
                  {step.step_due_date && (
                    <div className="p-2 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs text-muted-foreground"
                        onClick={() => onDueDateChange(step.id, null)}
                      >
                        クリア
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* 提出URLのリンク表示 */}
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
  providerLabels: ProviderLabels
  providerRoles: ProviderRole[]
  statusDefs: StepStatusDef[]
  onProjectUpdated: () => void
  onStepStatusChange: (stepId: string, status: StepStatus) => Promise<void>
  onStepSubmit: (stepId: string, data: { url?: string; note?: string; fileUrls?: string[]; fileNames?: string[] }) => Promise<void>
  onStepProviderChange: (stepId: string, providerType: ProviderType, providerName: string | null) => Promise<void>
  onStepDueDateChange: (stepId: string, dueDate: string | null) => Promise<void>
  onStepDependenciesChange: (stepId: string, dependsOn: string[]) => Promise<void>
  onDelete: (projectId: string) => Promise<boolean>
}

export function ProjectCard({ project, steps, providerLabels, providerRoles, statusDefs, onProjectUpdated, onStepStatusChange, onStepSubmit, onStepProviderChange, onStepDueDateChange, onStepDependenciesChange, onDelete }: ProjectCardProps) {
  const [stepsOpen, setStepsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const typeConfig = projectTypeConfig[project.project_type]
  const totalSteps = steps.length
  const completedSteps = steps.filter((s) => s.status === '完了').length
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

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
            <div className="flex items-center gap-1.5 mt-0.5">
              <CardTitle className="text-sm font-semibold leading-tight">{project.title}</CardTitle>
              <ProjectEditDialog project={project} onUpdated={onProjectUpdated} />
            </div>
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
        <div className="flex items-center justify-between py-1 border-t">
          <StepManagerDialog
            projectId={project.id}
            steps={steps}
            providerRoles={providerRoles}
            onUpdated={onProjectUpdated}
          />
          <button
            type="button"
            onClick={() => setStepsOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <span className="font-medium">ステップを{stepsOpen ? '閉じる' : '表示'}</span>
            {stepsOpen ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
          </button>
        </div>

        {stepsOpen && steps.length > 0 && (
          <div className="space-y-1.5">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                allSteps={steps}
                projectType={project.project_type}
                providerLabels={providerLabels}
                providerRoles={providerRoles}
                statusDefs={statusDefs}
                onStatusChange={onStepStatusChange}
                onSubmit={onStepSubmit}
                onProviderChange={onStepProviderChange}
                onDueDateChange={onStepDueDateChange}
                onDependenciesChange={onStepDependenciesChange}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
