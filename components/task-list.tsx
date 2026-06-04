'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTasks } from '@/hooks/use-tasks'
import { TaskCard } from '@/components/task-card'
import { TaskCalendar } from '@/components/task-calendar'
import { TaskEditDialog } from '@/components/task-edit-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { Task, TaskStatus } from '@/lib/types'
import { isSameDay, parseISO, format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ArrowUpIcon, ArrowDownIcon, Trash2Icon, RotateCcwIcon, BellIcon } from 'lucide-react'

type SortKey = 'created_at' | 'due_date' | 'staff'

export function TaskList() {
  const { tasks, deletedTasks, revisions, loading, updateTaskStatus, updateTask, deleteTask, restoreTask, permanentDeleteTask, permanentDeleteTasks, addRevision, submitResponse, submitDraft, fetchRevisions } = useTasks()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set())
  const [staffFilter, setStaffFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [earlyDays, setEarlyDays] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('early_completion_days') ?? '3', 10) || 3 } catch { return 3 }
  })
  const [earlyDaysEdit, setEarlyDaysEdit] = useState(false)
  const [earlyDaysInput, setEarlyDaysInput] = useState('')

  // 締切リマインダー設定（Supabase の app_settings から取得）
  const [reminderDays, setReminderDays] = useState<number>(3)
  const [reminderDaysEdit, setReminderDaysEdit] = useState(false)
  const [reminderDaysInput, setReminderDaysInput] = useState('')
  const [reminderSaving, setReminderSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings?key=due_reminder_days')
      .then((r) => r.json())
      .then((d) => { if (d.value) setReminderDays(parseInt(d.value, 10) || 3) })
      .catch(() => {})
  }, [])

  const saveReminderDays = async (days: number) => {
    setReminderSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'due_reminder_days', value: days }),
      })
      setReminderDays(days)
    } finally {
      setReminderSaving(false)
      setReminderDaysEdit(false)
    }
  }

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const clientSlugs = Array.from(
    new Set(tasks.map((t) => t.client_slug).filter(Boolean) as string[])
  ).sort()

  const staffList = Array.from(
    new Set(tasks.map((t) => t.staff).filter(Boolean) as string[])
  ).sort()

  const assigneeList = Array.from(
    new Set(tasks.map((t) => t.assignee).filter(Boolean) as string[])
  ).sort()

  const handleTaskSelect = useCallback((taskId: string) => {
    setHighlightedTaskId(taskId)
    const el = cardRefs.current[taskId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setHighlightedTaskId(null), 1800)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    )
  }

  const sortTasks = (list: Task[]) => {
    return [...list].sort((a, b) => {
      let va: string | null = null
      let vb: string | null = null
      if (sortKey === 'created_at') { va = a.created_at; vb = b.created_at }
      else if (sortKey === 'due_date') { va = a.due_date; vb = b.due_date }
      else if (sortKey === 'staff') { va = a.staff; vb = b.staff }
      if (!va && !vb) return 0
      if (!va) return 1
      if (!vb) return -1
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortAsc ? cmp : -cmp
    })
  }

  const applyFilters = (tasksToFilter: Task[]) => {
    let result = tasksToFilter
    if (clientFilter === 'none') result = result.filter((t) => !t.client_slug)
    else if (clientFilter !== 'all') result = result.filter((t) => t.client_slug === clientFilter)
    if (staffFilter === 'none') result = result.filter((t) => !t.staff)
    else if (staffFilter !== 'all') result = result.filter((t) => t.staff === staffFilter)
    if (assigneeFilter !== 'all') result = result.filter((t) => t.assignee === assigneeFilter)
    return sortTasks(result)
  }

  const filterByStatus = (status: TaskStatus | 'all') => {
    const base = status === 'all'
      ? tasks.filter((t) => t.status !== '完了')
      : tasks.filter((t) => t.status === status)
    return applyFilters(base)
  }

  // フィルター済みタスク（ステータス問わず・削除なし）
  const filteredTasksAll = applyFilters(tasks)

  const getTasksForDate = (date: Date) =>
    filteredTasksAll.filter((task) => task.due_date && isSameDay(parseISO(task.due_date), date))

  const handleStatusChange = async (taskId: string, status: TaskStatus) =>
    updateTaskStatus(taskId, status)

  const renderTasks = (status: TaskStatus | 'all') => {
    const filteredTasks = filterByStatus(status)
    if (filteredTasks.length === 0) {
      return <div className="py-12 text-center text-muted-foreground">タスクがありません</div>
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            ref={(el) => { cardRefs.current[task.id] = el }}
            task={task}
            revisions={revisions[task.id] || []}
            onStatusChange={handleStatusChange}
            onDelete={deleteTask}
            onEdit={(task) => { setEditTask(task); setEditDialogOpen(true) }}

            onSubmitDraft={submitDraft}
            onSubmitResponse={submitResponse}
            onRevisionOpen={fetchRevisions}
            highlighted={highlightedTaskId === task.id}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 左：カレンダー */}
        <div className="shrink-0 lg:w-72">
          <TaskCalendar
            tasks={filteredTasksAll}
            onDateSelect={setSelectedDate}
            onTaskSelect={handleTaskSelect}
          />
          {selectedDate && (
            <div className="mt-4">
              <h3 className="mb-2 font-medium text-sm">
                {selectedDate.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}のタスク
              </h3>
              {getTasksForDate(selectedDate).length === 0 ? (
                <p className="text-sm text-muted-foreground">タスクなし</p>
              ) : (
                <div className="grid gap-2">
                  {getTasksForDate(selectedDate).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onDelete={deleteTask}
                      onEdit={(task) => { setEditTask(task); setEditDialogOpen(true) }}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右：タスク一覧 */}
        <div className="flex-1 min-w-0">
          {/* フィルタ・ソートバー */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {clientSlugs.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground">クライアント:</span>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="none">未設定</SelectItem>
                    {clientSlugs.map((slug) => (
                      <SelectItem key={slug} value={slug}>{slug}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {staffList.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground">担当者:</span>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="none">未設定</SelectItem>
                    {staffList.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {assigneeList.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground">カテゴリ:</span>
                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {assigneeList.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <span className="text-xs text-muted-foreground ml-auto">ソート:</span>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">登録順</SelectItem>
                <SelectItem value="due_date">締切順</SelectItem>
                <SelectItem value="staff">担当者順</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSortAsc((v) => !v)}
              title={sortAsc ? '昇順' : '降順'}
            >
              {sortAsc ? <ArrowUpIcon className="size-3.5" /> : <ArrowDownIcon className="size-3.5" />}
            </Button>

            {/* 通知設定エリア */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* 締切リマインダー（Vercel Cron → Discord） */}
              <div className="flex items-center gap-1.5 rounded border border-dashed border-amber-300 bg-amber-50 px-2 py-1">
                <BellIcon className="size-3 text-amber-500 shrink-0" />
                {!reminderDaysEdit ? (
                  <>
                    <span className="text-xs text-amber-700">締切<span className="font-medium text-amber-900 mx-0.5">{reminderDays}</span>日前に未完了通知</span>
                    <button type="button" onClick={() => { setReminderDaysInput(String(reminderDays)); setReminderDaysEdit(true) }}
                      className="text-xs text-primary hover:underline ml-0.5">変更</button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-amber-700">締切</span>
                    <input
                      autoFocus
                      type="number"
                      min={1}
                      max={365}
                      value={reminderDaysInput}
                      onChange={(e) => setReminderDaysInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = parseInt(reminderDaysInput, 10)
                          if (v > 0) saveReminderDays(v)
                          else setReminderDaysEdit(false)
                        }
                        if (e.key === 'Escape') setReminderDaysEdit(false)
                      }}
                      className="w-12 h-6 text-xs rounded border border-input bg-background px-1.5 focus:outline-none focus:ring-1 focus:ring-ring text-center"
                    />
                    <span className="text-xs text-amber-700">日前に未完了通知</span>
                    <button type="button" onClick={() => { const v = parseInt(reminderDaysInput, 10); if (v > 0) saveReminderDays(v); else setReminderDaysEdit(false) }}
                      disabled={reminderSaving}
                      className="text-xs text-primary hover:underline disabled:opacity-50">
                      {reminderSaving ? '保存中...' : '保存'}
                    </button>
                    <button type="button" onClick={() => setReminderDaysEdit(false)}
                      className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                  </>
                )}
              </div>

              {/* 早期完了通知しきい値設定（localStorage） */}
              <div className="flex items-center gap-1.5 rounded border border-dashed border-muted-foreground/30 px-2 py-1">
                <BellIcon className="size-3 text-muted-foreground shrink-0" />
                {!earlyDaysEdit ? (
                  <>
                    <span className="text-xs text-muted-foreground">期日<span className="font-medium text-foreground mx-0.5">{earlyDays}</span>日前完了で早期完了通知</span>
                    <button type="button" onClick={() => { setEarlyDaysInput(String(earlyDays)); setEarlyDaysEdit(true) }}
                      className="text-xs text-primary hover:underline ml-0.5">変更</button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">期日</span>
                    <input
                      autoFocus
                      type="number"
                      min={1}
                      max={365}
                      value={earlyDaysInput}
                      onChange={(e) => setEarlyDaysInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = parseInt(earlyDaysInput, 10)
                          if (v > 0) { setEarlyDays(v); try { localStorage.setItem('early_completion_days', String(v)) } catch { /* noop */ } }
                          setEarlyDaysEdit(false)
                        }
                        if (e.key === 'Escape') setEarlyDaysEdit(false)
                      }}
                      className="w-12 h-6 text-xs rounded border border-input bg-background px-1.5 focus:outline-none focus:ring-1 focus:ring-ring text-center"
                    />
                    <span className="text-xs text-muted-foreground">日前完了で早期完了通知</span>
                    <button type="button" onClick={() => {
                      const v = parseInt(earlyDaysInput, 10)
                      if (v > 0) { setEarlyDays(v); try { localStorage.setItem('early_completion_days', String(v)) } catch { /* noop */ } }
                      setEarlyDaysEdit(false)
                    }} className="text-xs text-primary hover:underline">保存</button>
                    <button type="button" onClick={() => setEarlyDaysEdit(false)}
                      className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                  </>
                )}
              </div>
            </div>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="all" className="text-xs">すべて ({filterByStatus('all').length})</TabsTrigger>
              <TabsTrigger value="未着手" className="text-xs">未着手 ({filterByStatus('未着手').length})</TabsTrigger>
              <TabsTrigger value="制作要項待ち" className="text-xs">要項待ち ({filterByStatus('制作要項待ち').length})</TabsTrigger>
              <TabsTrigger value="制作要項受領" className="text-xs">要項受領 ({filterByStatus('制作要項受領').length})</TabsTrigger>
              <TabsTrigger value="進行中" className="text-xs">進行中 ({filterByStatus('進行中').length})</TabsTrigger>
              <TabsTrigger value="初校提出" className="text-xs">初校提出 ({filterByStatus('初校提出').length})</TabsTrigger>
              <TabsTrigger value="修正" className="text-xs">
                修正 ({filterByStatus('修正').length})
                {filterByStatus('修正').length > 0 && <span className="ml-1 inline-flex size-1.5 rounded-full bg-rose-500" />}
              </TabsTrigger>
              <TabsTrigger value="修正対応完了" className="text-xs">修正対応完了 ({filterByStatus('修正対応完了').length})</TabsTrigger>
              <TabsTrigger value="完了" className="text-xs">完了 ({filterByStatus('完了').length})</TabsTrigger>
              <TabsTrigger value="trash" className="text-xs text-muted-foreground">
                🗑️ ゴミ箱 {deletedTasks.length > 0 && `(${deletedTasks.length})`}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all">{renderTasks('all')}</TabsContent>
            <TabsContent value="未着手">{renderTasks('未着手')}</TabsContent>
            <TabsContent value="制作要項待ち">{renderTasks('制作要項待ち')}</TabsContent>
            <TabsContent value="制作要項受領">{renderTasks('制作要項受領')}</TabsContent>
            <TabsContent value="進行中">{renderTasks('進行中')}</TabsContent>
            <TabsContent value="初校提出">{renderTasks('初校提出')}</TabsContent>
            <TabsContent value="修正">{renderTasks('修正')}</TabsContent>
            <TabsContent value="修正対応完了">{renderTasks('修正対応完了')}</TabsContent>
            <TabsContent value="完了">{renderTasks('完了')}</TabsContent>
            <TabsContent value="trash">
              {deletedTasks.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">ゴミ箱は空です</div>
              ) : (
                <div className="space-y-3">
                  {/* 一括操作バー */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedTrashIds.size === deletedTasks.length && deletedTasks.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTrashIds(new Set(deletedTasks.map(t => t.id)))
                          else setSelectedTrashIds(new Set())
                        }}
                        className="rounded"
                      />
                      すべて選択
                    </label>
                    {selectedTrashIds.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={async () => {
                          if (!confirm(`選択した ${selectedTrashIds.size} 件を完全削除しますか？\nこの操作は取り消せません。`)) return
                          await permanentDeleteTasks(Array.from(selectedTrashIds))
                          setSelectedTrashIds(new Set())
                        }}
                      >
                        <Trash2Icon className="size-3 mr-1" />
                        選択した {selectedTrashIds.size} 件を完全削除
                      </Button>
                    )}
                  </div>

                  {/* ゴミ箱内タスク一覧 */}
                  {deletedTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedTrashIds.has(task.id)}
                        onChange={(e) => {
                          const next = new Set(selectedTrashIds)
                          if (e.target.checked) next.add(task.id)
                          else next.delete(task.id)
                          setSelectedTrashIds(next)
                        }}
                        className="rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-muted-foreground line-through">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {task.assignee}
                          {task.client_slug && <span className="ml-2 font-mono">[{task.client_slug}]</span>}
                          {task.deleted_at && (
                            <span className="ml-2">
                              削除日時: {format(parseISO(task.deleted_at), 'MM/dd HH:mm', { locale: ja })}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => restoreTask(task.id)}
                        >
                          <RotateCcwIcon className="size-3" />
                          元に戻す
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            if (!confirm(`「${task.title}」を完全削除しますか？\nこの操作は取り消せません。`)) return
                            await permanentDeleteTask(task.id)
                          }}
                          title="完全削除"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <TaskEditDialog
        task={editTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={updateTask}
      />
    </>
  )
}
