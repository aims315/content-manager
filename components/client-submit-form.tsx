'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FileUpload } from '@/components/file-upload'
import { useFileUpload } from '@/hooks/use-file-upload'
import { EmailNotificationSettings } from '@/components/email-notification-settings'
import { format, parseISO, isSameDay, compareAsc } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  CheckCircleIcon, ClockIcon, ExternalLinkIcon,
  PencilIcon, XIcon, ChevronDownIcon, ChevronUpIcon, MessageSquareIcon, FileIcon, DownloadIcon, Trash2Icon, ArrowUpIcon, ArrowDownIcon, RefreshCwIcon, CalendarIcon,
} from 'lucide-react'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import type { Task, TaskRevision, TaskStatus } from '@/lib/types'

const CATEGORIES = ['デザイン', '動画', 'その他'] as const

const statusColors: Record<TaskStatus, string> = {
  '未着手': 'bg-muted text-muted-foreground',
  '制作要項待ち': 'bg-orange-100 text-orange-800',
  '制作要項受領': 'bg-yellow-100 text-yellow-800',
  '進行中': 'bg-amber-100 text-amber-800',
  '初校提出': 'bg-violet-100 text-violet-800',
  '修正': 'bg-rose-100 text-rose-800',
  '修正対応完了': 'bg-blue-100 text-blue-800',
  '投稿OK': 'bg-teal-100 text-teal-800',
  '完了': 'bg-emerald-100 text-emerald-800',
}

interface ClientSubmitFormProps {
  clientSlug: string
}

export function ClientSubmitForm({ clientSlug }: ClientSubmitFormProps) {
  const supabase = createClient()

  const [tasks, setTasks] = useState<Task[]>([])
  const [revisions, setRevisions] = useState<Record<string, TaskRevision[]>>({})
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [sortKey, setSortKey] = useState<'created' | 'due'>('created')
  const [sortAsc, setSortAsc] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [calendarMode, setCalendarMode] = useState<'最終' | '初校' | '一覧'>('一覧')
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // 新規タスク
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [newDueDate, setNewDueDate] = useState<Date | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newSuccess, setNewSuccess] = useState(false)
  const [newError, setNewError] = useState<string | null>(null)
  const newFiles = useFileUpload()

  // 修正指示
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [revisionCategory, setRevisionCategory] = useState('')
  const [revisionNote, setRevisionNote] = useState('')
  const [isRevisionSubmitting, setIsRevisionSubmitting] = useState(false)
  const [revisionSuccess, setRevisionSuccess] = useState(false)
  const [revisionError, setRevisionError] = useState<string | null>(null)
  const revisionFiles = useFileUpload()

  // 期日一覧クリック → スクロール＆ハイライト
  const handleCalendarTaskClick = useCallback((taskId: string) => {
    setExpandedTaskId(taskId)
    setHighlightedId(taskId)
    setTimeout(() => {
      cardRefs.current[taskId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    setTimeout(() => setHighlightedId(null), 1800)
  }, [])

  // ソート＆フィルター後のタスク一覧（完了は別セクションで表示）
  const displayTasks = tasks
    .filter(t => (statusFilter === 'all' ? t.status !== '完了' : t.status === statusFilter))
    .sort((a, b) => {
      let diff = 0
      if (sortKey === 'due') {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity
        diff = da - db
      } else {
        diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return sortAsc ? diff : -diff
    })

  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [postedOkEnabled, setPostedOkEnabled] = useState(false)
  const [postedOkTaskId, setPostedOkTaskId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('client_settings').select('posted_ok_enabled').eq('slug', clientSlug).single()
      .then(({ data }) => { if (data?.posted_ok_enabled) setPostedOkEnabled(true) })
  }, [clientSlug, supabase])

  // Supabase Storage のURLからパスを抽出するヘルパー
  const extractStoragePath = (url: string): string | null => {
    try {
      const marker = '/object/public/task-files/'
      const idx = url.indexOf(marker)
      if (idx === -1) return null
      return decodeURIComponent(url.slice(idx + marker.length))
    } catch {
      return null
    }
  }

  // タスク本体のファイルのみ削除（修正履歴のファイルは保持）
  const deleteTaskFiles = async (task: Task) => {
    const paths: string[] = []
    for (const url of task.file_urls ?? []) {
      const p = extractStoragePath(url)
      if (p) paths.push(p)
    }
    if (paths.length > 0) {
      await supabase.storage.from('task-files').remove(paths)
    }
  }

  // タスクを完了にする（ステータス更新 + ファイル削除）
  const handleCompleteTask = async (task: Task) => {
    setCompletingTaskId(task.id)
    await supabase.from('tasks').update({
      status: '完了',
      completed_at: new Date().toISOString(),
    }).eq('id', task.id)
    await deleteTaskFiles(task)
    await sendDiscordNotification('completed', task.title, task.assignee)
    setCompletingTaskId(null)
    await fetchTasks()
  }

  // タスク削除
  const handleDeleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId)
    await fetchTasks()
  }

  // 修正指示の編集
  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks').select('*').eq('client_slug', clientSlug)
      .order('created_at', { ascending: false })
    setTasks((data as Task[]) || [])
    setLoadingTasks(false)
  }

  const fetchAllRevisions = async (taskIds: string[]) => {
    if (taskIds.length === 0) return
    const { data } = await supabase
      .from('task_revisions').select('*').in('task_id', taskIds)
      .order('created_at', { ascending: false })
    const grouped: Record<string, TaskRevision[]> = {}
    for (const rev of (data as TaskRevision[] || [])) {
      if (!grouped[rev.task_id]) grouped[rev.task_id] = []
      grouped[rev.task_id].push(rev)
    }
    setRevisions(grouped)
  }

  useEffect(() => {
    fetchTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSlug])

  useEffect(() => {
    if (tasks.length > 0) fetchAllRevisions(tasks.map(t => t.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length])

  useEffect(() => {
    const taskChannel = supabase
      .channel(`client-tasks-${clientSlug}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, async (payload) => {
        const updated = payload.new as Task
        if (updated.client_slug !== clientSlug) return
        fetchTasks()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, fetchTasks)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe()
    const revChannel = supabase
      .channel(`client-revisions-${clientSlug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_revisions' }, () => {
        fetchAllRevisions(tasks.map(t => t.id))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(taskChannel)
      supabase.removeChannel(revChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSlug, tasks.length])

  const sendDiscordNotification = async (type: string, taskTitle: string, taskAssignee: string, note?: string, modifiedBy?: string) => {
    try {
      await fetch('/api/discord/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: taskTitle, assignee: taskAssignee, note, modifiedBy, clientSlug }),
      })
    } catch {}
  }

  const handleNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNewError(null)
    if (!title.trim() || !category) { setNewError('タイトルとカテゴリは必須です'); return }
    setIsSubmitting(true)
    const { error } = await supabase.from('tasks').insert({
      title: title.trim(), assignee: category,
      description: description.trim() || null,
      due_date: newDueDate ? format(newDueDate, 'yyyy-MM-dd') : null,
      file_urls: newFiles.uploadedFiles.map((f) => f.url),
      file_names: newFiles.uploadedFiles.map((f) => f.name),
      client_slug: clientSlug,
    })
    if (error) { setNewError('送信に失敗しました'); setIsSubmitting(false); return }
    await sendDiscordNotification('created', title.trim(), category)
    setIsSubmitting(false); setNewSuccess(true)
    setTitle(''); setCategory(''); setDescription(''); setNewDueDate(undefined); newFiles.reset()
    await fetchTasks()
    setTimeout(() => setNewSuccess(false), 3000)
  }

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRevisionError(null)
    if (!selectedTaskId || !revisionNote.trim() || !revisionCategory) {
      setRevisionError('タスク・カテゴリ・修正内容はすべて必須です'); return
    }
    setIsRevisionSubmitting(true)

    // 修正指示を追加
    const { error } = await supabase.from('task_revisions').insert({
      task_id: selectedTaskId, note: revisionNote.trim(),
      created_by: revisionCategory,
      file_urls: revisionFiles.uploadedFiles.map((f) => f.url),
      file_names: revisionFiles.uploadedFiles.map((f) => f.name),
    })
    if (error) { setRevisionError('送信に失敗しました'); setIsRevisionSubmitting(false); return }

    // タスクのステータスを「修正」に変更
    await supabase.from('tasks').update({ status: '修正' }).eq('id', selectedTaskId)

    const task = tasks.find((t) => t.id === selectedTaskId)
    if (task) await sendDiscordNotification('revision', task.title, task.assignee, revisionNote.trim(), revisionCategory)

    setIsRevisionSubmitting(false); setRevisionSuccess(true)
    setRevisionCategory(''); setRevisionNote(''); revisionFiles.reset()
    await fetchTasks()
    setTimeout(() => setRevisionSuccess(false), 3000)
  }

  const [deletingRevisionId, setDeletingRevisionId] = useState<string | null>(null)

  const handleEditRevision = async (revisionId: string) => {
    if (!editingNote.trim()) return
    setIsSavingEdit(true)
    const { error } = await supabase.from('task_revisions').update({ note: editingNote.trim() }).eq('id', revisionId)
    setIsSavingEdit(false)
    if (!error) {
      await fetchAllRevisions(tasks.map(t => t.id))
      setEditingRevisionId(null); setEditingNote('')
    }
  }

  const handleDeleteRevision = async (revisionId: string) => {
    if (!confirm('この修正指示を削除しますか？')) return
    setDeletingRevisionId(revisionId)
    await supabase.from('task_revisions').delete().eq('id', revisionId)
    setDeletingRevisionId(null)
    await fetchAllRevisions(tasks.map(t => t.id))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">タスク管理</h1>
            <p className="text-sm text-muted-foreground mt-1">新規依頼の送信・修正指示・進捗確認</p>
          </div>
          <button
            type="button"
            onClick={() => { fetchTasks(); fetchAllRevisions(tasks.map(t => t.id)) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-2.5 py-1.5 hover:bg-muted transition-colors mt-1"
            title="最新の情報に更新"
          >
            <RefreshCwIcon className="size-3.5" />
            更新
          </button>
        </div>

        <Tabs defaultValue="new">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="new" className="flex-1">新規依頼</TabsTrigger>
            <TabsTrigger value="revision" className="flex-1">修正指示</TabsTrigger>
            <TabsTrigger value="status" className="flex-1">
              進捗確認
              {tasks.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs w-4 h-4">
                  {tasks.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 新規依頼 */}
          <TabsContent value="new">
            <Card><CardContent className="pt-6">
              <form onSubmit={handleNewSubmit} className="space-y-4">
                {newError && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{newError}</div>}
                {newSuccess && (
                  <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-md flex items-center gap-2">
                    <CheckCircleIcon className="size-4" /> 送信しました！
                  </div>
                )}
                <div className="space-y-2">
                  <Label>カテゴリ *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="カテゴリを選択" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">タイトル *</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="案件名・タスク名" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">内容・備考</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="詳細を入力（任意）" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>希望納期</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" type="button" className={cn('w-full justify-start text-left font-normal', !newDueDate && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 size-4" />
                        {newDueDate ? format(newDueDate, 'yyyy/MM/dd', { locale: ja }) : '日付を選択（任意）'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={newDueDate} onSelect={setNewDueDate} locale={ja} />
                      {newDueDate && (
                        <div className="p-2 border-t">
                          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setNewDueDate(undefined)}>
                            クリア
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <FileUpload uploadedFiles={newFiles.uploadedFiles} isUploading={newFiles.isUploading} uploadError={newFiles.uploadError} onUpload={newFiles.uploadFiles} onRemove={newFiles.removeFile} />
                <Button type="submit" disabled={isSubmitting || newFiles.isUploading} className="w-full">
                  {isSubmitting ? '送信中...' : '送信する'}
                </Button>
              </form>
            </CardContent></Card>
          </TabsContent>

          {/* 修正指示 */}
          <TabsContent value="revision">
            <Card><CardContent className="pt-6">
              <form onSubmit={handleRevisionSubmit} className="space-y-4">
                {revisionError && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{revisionError}</div>}
                {revisionSuccess && (
                  <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-md flex items-center gap-2">
                    <CheckCircleIcon className="size-4" /> 修正指示を送信しました！進捗確認で履歴を確認できます。
                  </div>
                )}
                <div className="space-y-2">
                  <Label>タスクを選択 *</Label>
                  <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                    <SelectTrigger><SelectValue placeholder="対象タスクを選ぶ" /></SelectTrigger>
                    <SelectContent>
                      {tasks.filter(t => t.status !== '完了').map((task) => (
                        <SelectItem key={task.id} value={task.id}>{task.title}（{task.assignee}）</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>カテゴリ *</Label>
                  <Select value={revisionCategory} onValueChange={setRevisionCategory}>
                    <SelectTrigger><SelectValue placeholder="カテゴリを選択" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revisionNote">修正内容 *</Label>
                  <Textarea id="revisionNote" value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} placeholder="修正指示の内容を入力" rows={4} />
                </div>
                <FileUpload uploadedFiles={revisionFiles.uploadedFiles} isUploading={revisionFiles.isUploading} uploadError={revisionFiles.uploadError} onUpload={revisionFiles.uploadFiles} onRemove={revisionFiles.removeFile} />
                <Button type="submit" disabled={isRevisionSubmitting || revisionFiles.isUploading} className="w-full">
                  {isRevisionSubmitting ? '送信中...' : '修正指示を送信'}
                </Button>
              </form>
            </CardContent></Card>
          </TabsContent>

          {/* 進捗確認 */}
          <TabsContent value="status">
            <div className="space-y-4">
              <EmailNotificationSettings clientSlug={clientSlug} />

              {/* カレンダー */}
              {tasks.length > 0 && (() => {
                const getDate = (t: typeof tasks[0]) => calendarMode === '初校' ? t.draft_due_date : calendarMode === '最終' ? t.due_date : null
                const tasksWithDate = tasks.filter(t => (t.due_date || t.draft_due_date) && t.status !== '完了')
                type DateEntry = { date: string; type: '初校' | '最終'; task: typeof tasks[0] }
                const allEntries: DateEntry[] = []
                tasksWithDate.forEach(t => {
                  if (t.draft_due_date) allEntries.push({ date: t.draft_due_date, type: '初校', task: t })
                  if (t.due_date) allEntries.push({ date: t.due_date, type: '最終', task: t })
                })
                allEntries.sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))
                const singleModeEntries = calendarMode !== '一覧'
                  ? tasksWithDate.filter(t => getDate(t)).sort((a, b) => compareAsc(parseISO(getDate(a)!), parseISO(getDate(b)!)))
                  : []
                return (
                  <div className="flex flex-col gap-3">
                    <div className="flex rounded-md border overflow-hidden text-xs w-fit">
                      {(['一覧', '初校', '最終'] as const).map((m) => (
                        <button key={m} onClick={() => setCalendarMode(m)}
                          className={`px-3 py-1 transition-colors ${calendarMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                    {calendarMode === '一覧' && allEntries.length > 0 && (
                      <div className="rounded-md border p-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">期日一覧</p>
                        {allEntries.map((entry, i) => (
                          <div key={`${entry.task.id}-${entry.type}-${i}`}
                            className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted group"
                            onClick={() => handleCalendarTaskClick(entry.task.id)}
                          >
                            <span className="text-xs font-mono text-muted-foreground shrink-0 w-8">
                              {format(parseISO(entry.date), 'M/d', { locale: ja })}
                            </span>
                            <span className={`text-xs shrink-0 px-1 rounded ${entry.type === '初校' ? 'text-violet-600 bg-violet-50' : 'text-muted-foreground bg-muted'}`}>
                              {entry.type}
                            </span>
                            <p className="text-sm truncate flex-1 group-hover:text-primary transition-colors">{entry.task.title}</p>
                            <Badge className={`${statusColors[entry.task.status]} shrink-0 text-xs`} variant="secondary">
                              {entry.task.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    {calendarMode !== '一覧' && (
                      <>
                        {singleModeEntries.length > 0 && (
                          <div className="rounded-md border p-3 space-y-1">
                            <p className="text-xs font-medium text-muted-foreground mb-2">{calendarMode}締切一覧</p>
                            {singleModeEntries.map((task) => (
                              <div key={task.id}
                                className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted group"
                                onClick={() => handleCalendarTaskClick(task.id)}
                              >
                                <span className="text-xs font-mono text-muted-foreground shrink-0 w-8">
                                  {format(parseISO(getDate(task)!), 'M/d', { locale: ja })}
                                </span>
                                <p className="text-sm truncate flex-1 group-hover:text-primary transition-colors">{task.title}</p>
                                <Badge className={`${statusColors[task.status]} shrink-0 text-xs`} variant="secondary">
                                  {task.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                        {singleModeEntries.length === 0 && (
                          <p className="text-xs text-muted-foreground">{calendarMode}締切が設定されたタスクがありません</p>
                        )}
                        <Calendar
                          locale={ja}
                          mode="single"
                          modifiers={{ hasTask: (date) => singleModeEntries.some(t => isSameDay(parseISO(getDate(t)!), date)) }}
                          components={{
                            DayButton: (props) => {
                              const hasTask = props.modifiers?.hasTask
                              return (
                                <CalendarDayButton {...props}>
                                  {props.children}
                                  {hasTask && <span className={`block w-1 h-1 rounded-full mx-auto -mt-0.5 ${calendarMode === '初校' ? 'bg-violet-500' : 'bg-primary'}`} />}
                                </CalendarDayButton>
                              )
                            },
                          }}
                          className="rounded-md border"
                        />
                      </>
                    )}
                  </div>
                )
              })()}

            {/* ソート・フィルター */}
            {tasks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as TaskStatus | 'all')}
                  className="h-8 text-xs rounded-md border bg-background px-2 pr-6"
                >
                  <option value="all">すべて</option>
                  <option value="未着手">未着手</option>
                  <option value="進行中">進行中</option>
                  <option value="初校提出">初校提出</option>
                  <option value="修正">修正</option>
                  <option value="修正対応完了">修正対応完了</option>
                  <option value="投稿OK">投稿OK</option>
                  <option value="完了">完了</option>
                </select>
                <select
                  value={sortKey}
                  onChange={e => setSortKey(e.target.value as 'created' | 'due')}
                  className="h-8 text-xs rounded-md border bg-background px-2 pr-6"
                >
                  <option value="created">登録順</option>
                  <option value="due">締切順</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortAsc(v => !v)}
                  className="h-8 w-8 flex items-center justify-center rounded-md border bg-background hover:bg-muted"
                >
                  {sortAsc ? <ArrowUpIcon className="size-3.5" /> : <ArrowDownIcon className="size-3.5" />}
                </button>
              </div>
            )}

            <div className="space-y-3">
              {loadingTasks ? (
                <p className="text-center text-muted-foreground py-8">読み込み中...</p>
              ) : tasks.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p>まだタスクがありません</p>
                  <p className="text-sm mt-1">「新規依頼」タブから依頼を送信してください</p>
                </div>
              ) : displayTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">該当するタスクがありません</p>
              ) : (
                displayTasks.map((task) => {
                  const taskRevisions = revisions[task.id] || []
                  const isExpanded = expandedTaskId === task.id
                  return (
                    <Card
                      key={task.id}
                      ref={(el) => { cardRefs.current[task.id] = el }}
                      className={`overflow-hidden transition-all duration-300 ${highlightedId === task.id ? 'ring-2 ring-primary ring-offset-2 shadow-lg shadow-primary/20' : ''}`}
                    >
                      {/* タスクヘッダー（クリックで展開） */}
                      <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedTaskId(open ? task.id : null)}>
                        <CollapsibleTrigger className="w-full text-left">
                          <div className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{task.title}</p>
                                {taskRevisions.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">
                                    <MessageSquareIcon className="size-3" />
                                    修正指示 {taskRevisions.length}件
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{task.assignee}</span>
                                {task.draft_due_date && (
                                  <span className="text-xs text-violet-600 flex items-center gap-0.5">
                                    <ClockIcon className="size-3" />
                                    初校 {format(new Date(task.draft_due_date), 'M/d', { locale: ja })}
                                  </span>
                                )}
                                {task.due_date && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <ClockIcon className="size-3" />
                                    最終 {format(new Date(task.due_date), 'yyyy/MM/dd', { locale: ja })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={statusColors[task.status]} variant="secondary">
                                {task.status}
                              </Badge>
                              {task.status === '修正対応完了' && (
                                <button
                                  type="button"
                                  className="text-xs font-bold px-2 py-0.5 rounded-full border border-teal-400 text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-50"
                                  disabled={completingTaskId === task.id}
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    setCompletingTaskId(task.id)
                                    await supabase.from('tasks').update({ status: '投稿OK' }).eq('id', task.id)
                                    setCompletingTaskId(null)
                                    await fetchTasks()
                                  }}
                                  title="投稿OKにする"
                                >
                                  投稿OK
                                </button>
                              )}
                              {task.status !== '完了' && task.status !== '投稿OK' && (
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-emerald-100 text-muted-foreground hover:text-emerald-600 transition-colors disabled:opacity-50"
                                  disabled={completingTaskId === task.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (confirm(`「${task.title}」を完了にしますか？\n※添付ファイルはサーバーから削除されます。`)) {
                                      handleCompleteTask(task)
                                    }
                                  }}
                                  title="完了にする"
                                >
                                  {completingTaskId === task.id
                                    ? <span className="text-xs text-emerald-600 px-0.5">...</span>
                                    : <CheckCircleIcon className="size-3.5" />
                                  }
                                </button>
                              )}
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (confirm(`「${task.title}」を削除しますか？`)) {
                                    handleDeleteTask(task.id)
                                  }
                                }}
                                title="削除"
                              >
                                <Trash2Icon className="size-3.5" />
                              </button>
                              {isExpanded
                                ? <ChevronUpIcon className="size-4 text-muted-foreground" />
                                : <ChevronDownIcon className="size-4 text-muted-foreground" />
                              }
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border-t px-4 pb-4 pt-3 space-y-3">
                            {task.description && (
                              <p className="text-sm text-muted-foreground">{task.description}</p>
                            )}

                            {/* 依頼時の添付ファイル */}
                            {task.file_urls && task.file_urls.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">添付ファイル</p>
                                {task.file_urls.map((url, i) => {
                                  const name = task.file_names?.[i] || `ファイル${i + 1}`
                                  return (
                                    <div key={i} className="flex items-center gap-2 rounded bg-muted px-2 py-1.5">
                                      <FileIcon className="size-3 shrink-0 text-muted-foreground" />
                                      <span className="flex-1 truncate text-xs">{name}</span>
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                        <DownloadIcon className="size-3 text-primary" />
                                      </a>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* 初校提出データ */}
                            {(task.status === '初校提出' || task.status === '修正' || task.status === '修正対応完了' || task.status === '完了') && (task.draft_url || task.draft_note || task.draft_file_urls?.length > 0) && (
                              <div className="p-3 rounded-md border bg-violet-50 border-violet-200 space-y-1.5">
                                <p className="text-xs font-medium text-violet-700 flex items-center gap-1">
                                  <CheckCircleIcon className="size-3" /> 初校データ
                                </p>
                                {task.draft_url && (
                                  <a href={task.draft_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:underline">
                                    <ExternalLinkIcon className="size-4" /> 初校を確認する
                                  </a>
                                )}
                                {task.draft_note && <p className="text-xs text-violet-600">{task.draft_note}</p>}
                                {task.draft_file_urls?.map((url, i) => {
                                  const name = task.draft_file_names?.[i] || `ファイル${i + 1}`
                                  return (
                                    <div key={i} className="flex items-center gap-2 rounded bg-violet-100 px-2 py-1.5">
                                      <FileIcon className="size-3 shrink-0 text-violet-500" />
                                      <span className="flex-1 truncate text-xs text-violet-700">{name}</span>
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                        <DownloadIcon className="size-3 text-violet-600" />
                                      </a>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* 修正対応完了：納品データ */}
                            {(task.status === '修正対応完了' || task.status === '完了') && (task.response_url || task.response_note || task.response_file_urls?.length > 0) && (
                              <div className={`p-3 rounded-md border space-y-1.5 ${task.status === '完了' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
                                <p className={`text-xs font-medium flex items-center gap-1 ${task.status === '完了' ? 'text-emerald-700' : 'text-blue-700'}`}>
                                  <CheckCircleIcon className="size-3" /> 納品データ
                                </p>
                                {task.response_url && (
                                  <a href={task.response_url} target="_blank" rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-1 text-sm font-medium hover:underline ${task.status === '完了' ? 'text-emerald-600' : 'text-blue-600'}`}>
                                    <ExternalLinkIcon className="size-4" /> 納品ファイルを確認する
                                  </a>
                                )}
                                {task.response_note && (
                                  <p className={`text-xs ${task.status === '完了' ? 'text-emerald-600' : 'text-blue-600'}`}>{task.response_note}</p>
                                )}
                                {task.response_file_urls?.map((url, i) => {
                                  const name = task.response_file_names?.[i] || `ファイル${i + 1}`
                                  const colorClass = task.status === '完了' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                  const iconClass = task.status === '完了' ? 'text-emerald-500' : 'text-blue-500'
                                  const dlClass = task.status === '完了' ? 'text-emerald-600' : 'text-blue-600'
                                  return (
                                    <div key={i} className={`flex items-center gap-2 rounded px-2 py-1.5 ${colorClass}`}>
                                      <FileIcon className={`size-3 shrink-0 ${iconClass}`} />
                                      <span className="flex-1 truncate text-xs">{name}</span>
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                        <DownloadIcon className={`size-3 ${dlClass}`} />
                                      </a>
                                    </div>
                                  )
                                })}
                                {task.responded_at && (
                                  <p className="text-xs text-muted-foreground">
                                    {format(parseISO(task.responded_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* 修正指示履歴 */}
                            {taskRevisions.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">修正指示の履歴</p>
                                {taskRevisions.map((rev) => (
                                  <div key={rev.id} className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-amber-800">{rev.created_by}</span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-amber-600 flex items-center gap-1">
                                          <ClockIcon className="size-3" />
                                          {format(parseISO(rev.created_at), 'MM/dd HH:mm', { locale: ja })}
                                        </span>
                                        {editingRevisionId !== rev.id && (
                                          <Button variant="ghost" size="icon" className="size-5"
                                            onClick={(e) => { e.stopPropagation(); setEditingRevisionId(rev.id); setEditingNote(rev.note) }}>
                                            <PencilIcon className="size-3 text-amber-600" />
                                          </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="size-5"
                                          disabled={deletingRevisionId === rev.id}
                                          onClick={(e) => { e.stopPropagation(); handleDeleteRevision(rev.id) }}>
                                          <Trash2Icon className="size-3 text-amber-500 hover:text-rose-600" />
                                        </Button>
                                      </div>
                                    </div>
                                    {editingRevisionId === rev.id ? (
                                      <div className="space-y-2 mt-1">
                                        <Textarea value={editingNote} onChange={(e) => setEditingNote(e.target.value)} rows={3} className="text-sm resize-none" />
                                        <div className="flex gap-2">
                                          <Button size="sm" className="h-7 text-xs flex-1"
                                            onClick={() => handleEditRevision(rev.id)}
                                            disabled={isSavingEdit || !editingNote.trim()}>
                                            {isSavingEdit ? '保存中...' : '保存'}
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-7 text-xs"
                                            onClick={() => { setEditingRevisionId(null); setEditingNote('') }}>
                                            <XIcon className="size-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-amber-900">{rev.note}</p>
                                    )}
                                    {rev.file_urls?.length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {rev.file_urls.map((url, i) => (
                                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                            className="text-xs text-amber-700 hover:underline flex items-center gap-0.5">
                                            <ExternalLinkIcon className="size-3" /> ファイル{i + 1}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {taskRevisions.length === 0 && !task.description && (
                              <p className="text-xs text-muted-foreground">修正指示はまだありません</p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  )
                })
              )}
            {/* 完了済みタスク */}
            {tasks.filter(t => t.status === '完了' || t.status === '投稿OK').length > 0 && (
              <div className="mt-6 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowCompleted(v => !v)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full text-left"
                >
                  <CheckCircleIcon className="size-4 text-emerald-500" />
                  完了したタスク（{tasks.filter(t => t.status === '完了' || t.status === '投稿OK').length}件）
                  <span className="ml-auto text-xs">{showCompleted ? '▲ 閉じる' : '▼ 見る'}</span>
                </button>
                {showCompleted && (
                  <div className="mt-3 space-y-2">
                    {tasks
                      .filter(t => t.status === '完了' || t.status === '投稿OK')
                      .sort((a, b) => (b.completed_at ?? b.created_at) > (a.completed_at ?? a.created_at) ? 1 : -1)
                      .map(task => (
                        <div key={task.id} className="rounded-md border bg-muted/30 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{task.title}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{task.assignee}</span>
                                {task.completed_at && (
                                  <span className="text-xs text-muted-foreground">
                                    完了: {format(new Date(task.completed_at), 'M/d HH:mm', { locale: ja })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge className={`${statusColors[task.status]} shrink-0 text-xs`} variant="secondary">
                              {task.status}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-2">{task.description}</p>
                          )}
                          {(task.draft_url || (task.draft_file_urls?.length > 0)) && (
                            <div className="mt-2 text-xs">
                              <span className="text-muted-foreground">初校: </span>
                              {task.draft_url && <a href={task.draft_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{task.draft_url}</a>}
                            </div>
                          )}
                          {(task.response_url || (task.response_file_urls?.length > 0)) && (
                            <div className="mt-1 text-xs">
                              <span className="text-muted-foreground">納品: </span>
                              {task.response_url && <a href={task.response_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{task.response_url}</a>}
                            </div>
                          )}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
            </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
