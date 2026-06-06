'use client'

import { useState, useEffect, useRef, forwardRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFileUpload } from '@/hooks/use-file-upload'
import { FileUpload } from '@/components/file-upload'
import type { Task, TaskRevision, TaskStatus } from '@/lib/types'
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
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  CalendarIcon,
  Trash2Icon,
  UserIcon,
  FileIcon,
  PencilIcon,
  WrenchIcon,
  CheckCircleIcon,
  DownloadIcon,
  ExternalLinkIcon,
  SendIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  XIcon,
  PlusIcon,
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
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount)
}

interface TaskCardProps {
  task: Task
  revisions?: TaskRevision[]
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<boolean>
  onDelete: (taskId: string) => Promise<boolean>
  onEdit?: (task: Task) => void
  onSubmitDraft?: (taskId: string, draftUrl: string, draftNote: string, fileUrls: string[], fileNames: string[]) => Promise<boolean>
  onSubmitResponse?: (taskId: string, responseUrl: string, responseNote: string, fileUrls: string[], fileNames: string[]) => Promise<boolean>
  onRevisionOpen?: (taskId: string) => void
  highlighted?: boolean
  compact?: boolean
}

const statusColors: Record<TaskStatus, string> = {
  '未着手': 'bg-muted text-muted-foreground',
  '制作要項待ち': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  '制作要項受領': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  '進行中': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  '初校提出': 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  '修正': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
  '修正対応完了': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  '完了': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(
  {
    task,
    revisions = [],
    onStatusChange,
    onDelete,
    onEdit,
    onSubmitDraft,
    onSubmitResponse,
    onRevisionOpen,
    highlighted = false,
    compact = false,
  },
  ref
) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [responseOpen, setResponseOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftUrl, setDraftUrl] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [isDrafting, setIsDrafting] = useState(false)
  const [draftSuccess, setDraftSuccess] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [responseUrl, setResponseUrl] = useState('')
  const [responseNote, setResponseNote] = useState('')
  const [isResponding, setIsResponding] = useState(false)
  const [responseSuccess, setResponseSuccess] = useState(false)
  const [responseError, setResponseError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const [editingDraft, setEditingDraft] = useState(false)
  const [editingResponse, setEditingResponse] = useState(false)
  const supabase = createClient()
  const draftFiles = useFileUpload()
  const responseFiles = useFileUpload()

  // 修正指示削除
  const [deletingRevisionId, setDeletingRevisionId] = useState<string | null>(null)
  const handleRevisionDelete = async (revisionId: string) => {
    if (!confirm('この修正指示を削除しますか？')) return
    setDeletingRevisionId(revisionId)
    await supabase.from('task_revisions').delete().eq('id', revisionId)
    setDeletingRevisionId(null)
    onRevisionOpen?.(task.id)
  }

  // 担当者（staff）インライン編集
  const STAFF_KEY = 'task_staff_names'
  const loadStaffNames = (): string[] => {
    try { return JSON.parse(localStorage.getItem(STAFF_KEY) ?? '[]') } catch { return [] }
  }
  const saveStaffNames = (names: string[]) => {
    localStorage.setItem(STAFF_KEY, JSON.stringify([...names].sort()))
  }
  const [staffEdit, setStaffEdit] = useState(false)
  const [staffNames, setStaffNames] = useState<string[]>([])
  const [newStaffInput, setNewStaffInput] = useState('')
  const [showNewStaffInput, setShowNewStaffInput] = useState(false)
  const [renamingStaff, setRenamingStaff] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const staffInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (staffEdit) {
      setStaffNames(loadStaffNames())
      setNewStaffInput('')
      setShowNewStaffInput(false)
      setRenamingStaff(null)
    }
  }, [staffEdit])

  const saveStaff = async (name: string | null) => {
    await supabase.from('tasks').update({ staff: name }).eq('id', task.id)
    if (name) {
      const names = loadStaffNames()
      if (!names.includes(name)) saveStaffNames([...names, name])
    }
    setStaffEdit(false)
  }

  const addNewStaff = () => {
    const name = newStaffInput.trim()
    if (!name) return
    saveStaff(name)
  }

  const deleteStaffName = (name: string) => {
    const updated = loadStaffNames().filter(n => n !== name)
    saveStaffNames(updated)
    setStaffNames(updated)
    // このタスクがその担当者だった場合は解除
    if (task.staff === name) {
      supabase.from('tasks').update({ staff: null }).eq('id', task.id)
    }
  }

  const commitRename = async () => {
    const newName = renameValue.trim()
    if (!newName || !renamingStaff) return
    const names = loadStaffNames()
    const updated = names.map(n => n === renamingStaff ? newName : n)
    saveStaffNames(updated)
    setStaffNames([...updated].sort())
    // このタスクに古い名前がついていたら新しい名前に更新
    if (task.staff === renamingStaff) {
      await supabase.from('tasks').update({ staff: newName }).eq('id', task.id)
    }
    setRenamingStaff(null)
    setRenameValue('')
  }

  useEffect(() => {
    if (highlighted) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1500)
      return () => clearTimeout(t)
    }
  }, [highlighted])

  const handleStatusChange = async (value: string) => {
    setIsUpdating(true)
    await onStatusChange(task.id, value as TaskStatus)
    setIsUpdating(false)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete(task.id)
    setIsDeleting(false)
  }

  const handleDraftSubmit = async () => {
    if (!onSubmitDraft) return
    setIsDrafting(true)
    setDraftError(null)
    try {
      const fileUrls = draftFiles.uploadedFiles.map(f => f.url)
      const fileNames = draftFiles.uploadedFiles.map(f => f.name)
      const success = await onSubmitDraft(task.id, draftUrl.trim(), draftNote.trim(), fileUrls, fileNames)
      if (success) {
        setDraftSuccess(true)
        setDraftUrl('')
        setDraftNote('')
        draftFiles.reset()
        setDraftOpen(false)
        setTimeout(() => setDraftSuccess(false), 3000)
      } else {
        setDraftError('送信に失敗しました')
      }
    } catch (e) {
      setDraftError(`エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsDrafting(false)
    }
  }

  const handleResponseSubmit = async () => {
    if (!onSubmitResponse) return
    setIsResponding(true)
    setResponseError(null)
    try {
      const fileUrls = responseFiles.uploadedFiles.map(f => f.url)
      const fileNames = responseFiles.uploadedFiles.map(f => f.name)
      const success = await onSubmitResponse(task.id, responseUrl.trim(), responseNote.trim(), fileUrls, fileNames)
      if (success) {
        setResponseSuccess(true)
        setResponseUrl('')
        setResponseNote('')
        responseFiles.reset()
        setTimeout(() => setResponseSuccess(false), 3000)
      } else {
        setResponseError('送信に失敗しました。Supabaseのエラーをご確認ください。')
      }
    } catch (e) {
      setResponseError(`エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsResponding(false)
    }
  }

  const handleDraftEdit = () => {
    setDraftUrl(task.draft_url ?? '')
    setDraftNote(task.draft_note ?? '')
    draftFiles.reset()
    setEditingDraft(true)
  }

  const handleDraftEditSubmit = async () => {
    setIsDrafting(true)
    setDraftError(null)
    try {
      const fileUrls = draftFiles.uploadedFiles.length > 0 ? draftFiles.uploadedFiles.map(f => f.url) : (task.draft_file_urls ?? [])
      const fileNames = draftFiles.uploadedFiles.length > 0 ? draftFiles.uploadedFiles.map(f => f.name) : (task.draft_file_names ?? [])
      const { error } = await supabase.from('tasks').update({
        draft_url: draftUrl.trim() || null,
        draft_note: draftNote.trim() || null,
        draft_file_urls: fileUrls,
        draft_file_names: fileNames,
        draft_submitted_at: new Date().toISOString(),
      }).eq('id', task.id)
      if (error) { setDraftError(`エラー: ${error.message}`); return }
      setEditingDraft(false)
      setDraftUrl('')
      setDraftNote('')
      draftFiles.reset()
    } catch (e) {
      setDraftError(`エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsDrafting(false)
    }
  }

  const handleResponseEdit = () => {
    setResponseUrl(task.response_url ?? '')
    setResponseNote(task.response_note ?? '')
    responseFiles.reset()
    setEditingResponse(true)
  }

  const handleResponseEditSubmit = async () => {
    setIsResponding(true)
    setResponseError(null)
    try {
      const fileUrls = responseFiles.uploadedFiles.length > 0 ? responseFiles.uploadedFiles.map(f => f.url) : (task.response_file_urls ?? [])
      const fileNames = responseFiles.uploadedFiles.length > 0 ? responseFiles.uploadedFiles.map(f => f.name) : (task.response_file_names ?? [])
      const { error } = await supabase.from('tasks').update({
        response_url: responseUrl.trim() || null,
        response_note: responseNote.trim() || null,
        response_file_urls: fileUrls,
        response_file_names: fileNames,
        responded_at: new Date().toISOString(),
      }).eq('id', task.id)
      if (error) { setResponseError(`エラー: ${error.message}`); return }
      setEditingResponse(false)
      setResponseUrl('')
      setResponseNote('')
      responseFiles.reset()
    } catch (e) {
      setResponseError(`エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsResponding(false)
    }
  }

  if (compact) {
    return (
      <Card className="p-3" ref={ref}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{task.title}</p>
            <p className="text-xs text-muted-foreground">{task.assignee}</p>
          </div>
          <Badge className={statusColors[task.status]} variant="secondary">
            {task.status}
          </Badge>
        </div>
      </Card>
    )
  }

  return (
    <Card
      ref={ref}
      className={cn(
        'relative transition-all duration-300',
        flash && 'ring-2 ring-primary ring-offset-2 shadow-lg shadow-primary/20'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight line-clamp-2">
            {task.title}
          </CardTitle>
          <Badge className={`${statusColors[task.status]} shrink-0`} variant="secondary">
            {task.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {task.description && (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <UserIcon className="size-3" />
            <span className="font-medium bg-muted px-1.5 py-0.5 rounded">{task.assignee}</span>
          </div>
          {task.client_slug && (
            <div className="flex items-center gap-1">
              <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded text-xs font-mono">
                {task.client_slug}
              </span>
            </div>
          )}
          {task.client_slug === 'task_aims' && task.amount != null && (
            <div className="flex items-center gap-1">
              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-medium">
                {formatAmount(task.amount)}
              </span>
            </div>
          )}
          {task.draft_due_date && (
            <div className="flex items-center gap-1 text-violet-600">
              <CalendarIcon className="size-3" />
              <span>初校 {format(new Date(task.draft_due_date), 'M/d', { locale: ja })}</span>
            </div>
          )}
          {task.due_date && (
            <div className="flex items-center gap-1">
              <CalendarIcon className="size-3" />
              <span>最終 {format(new Date(task.due_date), 'M/d', { locale: ja })}</span>
            </div>
          )}
        </div>

        {/* 担当者（管理画面のみ・クライアントポータルには表示しない） */}
        <div className="flex items-center gap-1.5">
          {!staffEdit ? (
            <button
              type="button"
              onClick={() => setStaffEdit(true)}
              className="flex items-center gap-1 text-xs rounded px-1.5 py-0.5 border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <UserIcon className="size-3" />
              {task.staff ? <span className="font-medium">{task.staff}</span> : <span>担当者を設定</span>}
              <PencilIcon className="size-2.5 opacity-50" />
            </button>
          ) : (
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-1 flex-wrap">
                {task.staff && (
                  <button type="button" onClick={() => saveStaff(null)}
                    className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-rose-100 hover:text-rose-600 transition-colors">
                    未設定にする
                  </button>
                )}
                {staffNames.map((name) => (
                  renamingStaff === name ? (
                    // リネーム入力中
                    <div key={name} className="flex items-center gap-1">
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenamingStaff(null); setRenameValue('') } }}
                        className="h-6 w-24 text-xs rounded border border-input bg-background px-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button type="button" onClick={commitRename}
                        className="text-xs text-primary hover:underline">保存</button>
                      <button type="button" onClick={() => { setRenamingStaff(null); setRenameValue('') }}
                        className="text-muted-foreground hover:text-foreground">
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  ) : (
                    // 通常表示
                    <div key={name} className="flex items-center gap-0.5 group">
                      <button type="button" onClick={() => saveStaff(name)}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-l border transition-colors',
                          task.staff === name
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-input hover:bg-muted'
                        )}>
                        {name}
                      </button>
                      <button type="button"
                        onClick={() => { setRenamingStaff(name); setRenameValue(name) }}
                        className="h-[22px] px-1 text-xs border border-l-0 border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="名前を編集">
                        <PencilIcon className="size-2.5" />
                      </button>
                      <button type="button"
                        onClick={() => { if (confirm(`「${name}」を担当者リストから削除しますか？`)) deleteStaffName(name) }}
                        className="h-[22px] px-1 text-xs rounded-r border border-l-0 border-input bg-background hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors"
                        title="削除">
                        <XIcon className="size-2.5" />
                      </button>
                    </div>
                  )
                ))}
                <button type="button" onClick={() => { setShowNewStaffInput(v => !v); setTimeout(() => staffInputRef.current?.focus(), 50) }}
                  className="text-xs px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/40 hover:border-primary text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
                  <PlusIcon className="size-3" /> 新しい担当者
                </button>
                <button type="button" onClick={() => setStaffEdit(false)}
                  className="text-xs text-muted-foreground hover:text-foreground ml-auto">
                  <XIcon className="size-3" />
                </button>
              </div>
              {showNewStaffInput && (
                <div className="flex gap-1">
                  <input ref={staffInputRef} type="text" value={newStaffInput}
                    onChange={e => setNewStaffInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addNewStaff() }}
                    placeholder="名前を入力 → Enter"
                    className="flex-1 h-7 text-xs rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button size="sm" className="h-7 text-xs px-2" onClick={addNewStaff} disabled={!newStaffInput.trim()}>
                    追加
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {task.file_urls && task.file_urls.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">添付ファイル</p>
            {task.file_urls.map((url, index) => (
              <div key={index} className="flex items-center gap-2 rounded bg-muted px-2 py-1.5">
                <FileIcon className="size-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-xs">{getFilename(url, task.file_names, index)}</span>
                <Button type="button" variant="ghost" size="icon" className="size-5 shrink-0"
                  title="ダウンロード" onClick={() => downloadFile(url)}>
                  <DownloadIcon className="size-3 text-primary" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* 初校提出フォーム（進行中のとき） */}
        {task.status === '進行中' && onSubmitDraft && (
          <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50 p-2.5 dark:border-violet-800 dark:bg-violet-950">
            <p className="text-xs font-medium text-violet-800 dark:text-violet-200">初校を提出する</p>
            {draftSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircleIcon className="size-3" /> 初校を送信しました！
              </div>
            )}
            {task.draft_url && (
              <div className="space-y-1 p-2 rounded bg-violet-100 border border-violet-200 dark:bg-violet-900">
                <p className="text-xs font-medium text-violet-700 flex items-center gap-1">
                  <CheckCircleIcon className="size-3" /> 提出済み
                </p>
                <a href={task.draft_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                  <ExternalLinkIcon className="size-3" /> 提出データを見る
                </a>
                {task.draft_note && <p className="text-xs text-violet-600">{task.draft_note}</p>}
              </div>
            )}
            <div className="space-y-2">
              {draftError && <p className="text-xs text-red-600">{draftError}</p>}
              <div>
                <Label className="text-xs text-violet-700">データのURL（Googleドライブなど）</Label>
                <Input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)}
                  placeholder="https://drive.google.com/..." className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs text-violet-700">備考</Label>
                <Textarea value={draftNote} onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="補足など（任意）" rows={2} className="text-xs resize-none mt-1" />
              </div>
              <FileUpload
                uploadedFiles={draftFiles.uploadedFiles}
                isUploading={draftFiles.isUploading}
                uploadError={draftFiles.uploadError}
                onUpload={draftFiles.uploadFiles}
                onRemove={draftFiles.removeFile}
              />
              <Button size="sm" className="w-full h-8 text-xs bg-violet-600 hover:bg-violet-700"
                onClick={handleDraftSubmit}
                disabled={isDrafting || draftFiles.isUploading || (!draftUrl.trim() && !draftNote.trim() && draftFiles.uploadedFiles.length === 0)}>
                <SendIcon className="size-3 mr-1.5" />
                {isDrafting ? '送信中...' : '初校提出 → ステータス更新'}
              </Button>
            </div>
          </div>
        )}

        {/* 初校提出済み表示（初校提出ステータスのとき） */}
        {task.status === '初校提出' && (task.draft_url || task.draft_note || task.draft_file_urls?.length > 0) && (
          <div className="space-y-1.5 rounded-md border border-violet-200 bg-violet-50 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-violet-800 flex items-center gap-1">
                <CheckCircleIcon className="size-3" /> 初校提出済み
              </p>
              {!editingDraft && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-violet-600 hover:bg-violet-100"
                  onClick={handleDraftEdit}>
                  <PencilIcon className="size-3 mr-1" /> 編集
                </Button>
              )}
            </div>
            {!editingDraft ? (
              <>
                {task.draft_url && (
                  <a href={task.draft_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                    <ExternalLinkIcon className="size-3" /> 提出データを見る
                  </a>
                )}
                {task.draft_note && <p className="text-xs text-violet-600">{task.draft_note}</p>}
                {task.draft_file_urls?.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 rounded bg-violet-100 px-2 py-1">
                    <FileIcon className="size-3 shrink-0 text-violet-500" />
                    <span className="flex-1 truncate text-xs text-violet-700">{task.draft_file_names?.[i] ?? `ファイル${i+1}`}</span>
                    <Button type="button" variant="ghost" size="icon" className="size-5 shrink-0" onClick={() => downloadFile(url)}>
                      <DownloadIcon className="size-3 text-violet-600" />
                    </Button>
                  </div>
                ))}
              </>
            ) : (
              <div className="space-y-2 pt-1">
                {draftError && <p className="text-xs text-red-600">{draftError}</p>}
                <div>
                  <Label className="text-xs text-violet-700">データのURL（Googleドライブなど）</Label>
                  <Input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)}
                    placeholder="https://drive.google.com/..." className="h-8 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-violet-700">備考</Label>
                  <Textarea value={draftNote} onChange={(e) => setDraftNote(e.target.value)}
                    placeholder="補足など（任意）" rows={2} className="text-xs resize-none mt-1" />
                </div>
                <FileUpload
                  uploadedFiles={draftFiles.uploadedFiles}
                  isUploading={draftFiles.isUploading}
                  uploadError={draftFiles.uploadError}
                  onUpload={draftFiles.uploadFiles}
                  onRemove={draftFiles.removeFile}
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs bg-violet-600 hover:bg-violet-700"
                    onClick={handleDraftEditSubmit}
                    disabled={isDrafting || draftFiles.isUploading}>
                    <SendIcon className="size-3 mr-1.5" />
                    {isDrafting ? '保存中...' : '変更を保存'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs"
                    onClick={() => { setEditingDraft(false); setDraftUrl(''); setDraftNote(''); draftFiles.reset() }}>
                    キャンセル
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 修正指示セクション（クライアントからの依頼表示のみ） */}
        {revisions.length > 0 && revisionOpen && (
          <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 dark:border-rose-800 dark:bg-rose-950">
            {/* 最新の修正指示 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-rose-800 dark:text-rose-200">最新の修正指示</p>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-rose-600 flex items-center gap-1">
                    <ClockIcon className="size-3" />
                    {format(parseISO(revisions[0].created_at), 'MM/dd HH:mm', { locale: ja })}
                  </span>
                  <Button variant="ghost" size="icon" className="size-5 text-rose-300 hover:text-rose-700"
                    disabled={deletingRevisionId === revisions[0].id}
                    onClick={() => handleRevisionDelete(revisions[0].id)}>
                    <Trash2Icon className="size-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300">{revisions[0].note}</p>
              <p className="text-xs text-rose-500 mt-0.5">by {revisions[0].created_by}</p>
              {revisions[0].file_urls?.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {revisions[0].file_urls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 rounded bg-rose-100 px-2 py-1">
                      <FileIcon className="size-3 shrink-0 text-rose-500" />
                      <span className="flex-1 truncate text-xs text-rose-700">
                        {getFilename(url, revisions[0].file_names, i)}
                      </span>
                      <Button type="button" variant="ghost" size="icon" className="size-5 shrink-0"
                        onClick={() => downloadFile(url)}>
                        <DownloadIcon className="size-3 text-rose-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 過去の履歴（折り畳み） */}
            {revisions.length > 1 && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700"
                onClick={() => setHistoryOpen((v) => !v)}
              >
                {historyOpen ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
                過去の修正履歴 ({revisions.length - 1}件)
              </button>
            )}
            {historyOpen && revisions.slice(1).map((rev) => (
              <div key={rev.id} className="rounded bg-rose-100 px-2 py-1.5 text-xs dark:bg-rose-900">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-rose-600">{rev.created_by}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-rose-400 flex items-center gap-1">
                      <ClockIcon className="size-3" />
                      {format(parseISO(rev.created_at), 'MM/dd HH:mm', { locale: ja })}
                    </span>
                    <Button variant="ghost" size="icon" className="size-5 text-rose-300 hover:text-rose-700"
                      disabled={deletingRevisionId === rev.id}
                      onClick={() => handleRevisionDelete(rev.id)}>
                      <Trash2Icon className="size-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-rose-700">{rev.note}</p>
              </div>
            ))}

            {/* 修正対応フォーム */}
            {onSubmitResponse && (
              <div className="pt-2 border-t border-rose-200 dark:border-rose-700 space-y-2">
                {responseSuccess && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <CheckCircleIcon className="size-3" /> 送信しました！
                  </div>
                )}
                {responseError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                    {responseError}
                  </div>
                )}
                {(task.response_url || task.response_note || task.response_file_urls?.length > 0) && (
                  <div className="space-y-1.5 p-2 rounded bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
                        <CheckCircleIcon className="size-3" /> 送信済み
                      </p>
                      {!editingResponse && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-blue-600 hover:bg-blue-100"
                          onClick={handleResponseEdit}>
                          <PencilIcon className="size-3 mr-1" /> 編集
                        </Button>
                      )}
                    </div>
                    {!editingResponse ? (
                      <>
                        {task.response_url && (
                          <a href={task.response_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <ExternalLinkIcon className="size-3" /> 納品データを見る
                          </a>
                        )}
                        {task.response_note && (
                          <p className="text-xs text-blue-600">{task.response_note}</p>
                        )}
                        {task.response_file_urls?.map((url, i) => (
                          <div key={i} className="flex items-center gap-2 rounded bg-blue-100 px-2 py-1">
                            <FileIcon className="size-3 shrink-0 text-blue-500" />
                            <span className="flex-1 truncate text-xs text-blue-700">{task.response_file_names?.[i] ?? `ファイル${i+1}`}</span>
                            <Button type="button" variant="ghost" size="icon" className="size-5 shrink-0" onClick={() => downloadFile(url)}>
                              <DownloadIcon className="size-3 text-blue-600" />
                            </Button>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {responseError && <p className="text-xs text-red-600">{responseError}</p>}
                        <div>
                          <Label className="text-xs text-blue-700">納品データのURL（Googleドライブなど）</Label>
                          <Input value={responseUrl} onChange={(e) => setResponseUrl(e.target.value)}
                            placeholder="https://drive.google.com/..." className="h-8 text-xs mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs text-blue-700">備考</Label>
                          <Textarea value={responseNote} onChange={(e) => setResponseNote(e.target.value)}
                            placeholder="補足など（任意）" rows={2} className="text-xs resize-none mt-1" />
                        </div>
                        <FileUpload
                          uploadedFiles={responseFiles.uploadedFiles}
                          isUploading={responseFiles.isUploading}
                          uploadError={responseFiles.uploadError}
                          onUpload={responseFiles.uploadFiles}
                          onRemove={responseFiles.removeFile}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700"
                            onClick={handleResponseEditSubmit}
                            disabled={isResponding || responseFiles.isUploading}>
                            <SendIcon className="size-3 mr-1.5" />
                            {isResponding ? '保存中...' : '変更を保存'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs"
                            onClick={() => { setEditingResponse(false); setResponseUrl(''); setResponseNote(''); responseFiles.reset() }}>
                            キャンセル
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!editingResponse && (
                  <>
                    <div>
                      <Label className="text-xs text-rose-700">納品データのURL（Googleドライブなど）</Label>
                      <Input
                        value={responseUrl}
                        onChange={(e) => setResponseUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-rose-700">備考</Label>
                      <Textarea
                        value={responseNote}
                        onChange={(e) => setResponseNote(e.target.value)}
                        placeholder="補足など（任意）"
                        rows={2}
                        className="text-xs resize-none mt-1"
                      />
                    </div>
                    <FileUpload
                      uploadedFiles={responseFiles.uploadedFiles}
                      isUploading={responseFiles.isUploading}
                      uploadError={responseFiles.uploadError}
                      onUpload={responseFiles.uploadFiles}
                      onRemove={responseFiles.removeFile}
                    />
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={handleResponseSubmit}
                      disabled={isResponding || responseFiles.isUploading || (!responseUrl.trim() && !responseNote.trim() && responseFiles.uploadedFiles.length === 0)}
                    >
                      <SendIcon className="size-3 mr-1.5" />
                      {isResponding ? '送信中...' : '修正対応を送信 → 修正対応完了'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <Select value={task.status} onValueChange={handleStatusChange} disabled={isUpdating}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="未着手">未着手</SelectItem>
              <SelectItem value="制作要項待ち">制作要項待ち</SelectItem>
              <SelectItem value="制作要項受領">制作要項受領</SelectItem>
              <SelectItem value="進行中">進行中</SelectItem>
              <SelectItem value="初校提出">初校提出</SelectItem>
              <SelectItem value="修正">修正</SelectItem>
              <SelectItem value="修正対応完了">修正対応完了</SelectItem>
              <SelectItem value="完了">完了</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            {revisions.length > 0 && (
              <Button
                variant={revisionOpen ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7 relative"
                onClick={() => {
                  const next = !revisionOpen
                  setRevisionOpen(next)
                  if (next) onRevisionOpen?.(task.id)
                }}
                title="修正指示・対応"
              >
                <WrenchIcon className="size-3.5" />
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-bold">
                  {revisions.length}
                </span>
              </Button>
            )}
            {onEdit && (
              <Button variant="ghost" size="icon" className="size-7"
                onClick={() => onEdit(task)} title="タスクを編集">
                <PencilIcon className="size-3.5" />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" disabled={isDeleting}>
                  <Trash2Icon className="size-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>タスクを削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    この操作は取り消せません。タスク「{task.title}」を完全に削除します。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>削除する</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

      </CardContent>
    </Card>
  )
})
