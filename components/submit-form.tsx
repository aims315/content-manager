'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileUpload } from '@/components/file-upload'
import { useFileUpload } from '@/hooks/use-file-upload'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarIcon, CheckCircleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/types'

const CATEGORIES = ['デザイン', '動画', 'その他'] as const
const TASK_AIMS_CLIENT_CODE = 'task_aims'

function normalizeClientSlug(value: string) {
  return value.toLowerCase().replace(/\s+/g, '-')
}

function parseAmount(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : NaN
}

export function SubmitForm() {
  const supabase = createClient()

  // 新規タスク
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [clientSlug, setClientSlug] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [existingClientSlugs, setExistingClientSlugs] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newSuccess, setNewSuccess] = useState(false)
  const [newError, setNewError] = useState<string | null>(null)
  const newFiles = useFileUpload()

  // 修正指示
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [revisionCategory, setRevisionCategory] = useState('')
  const [revisionNote, setRevisionNote] = useState('')
  const [isRevisionSubmitting, setIsRevisionSubmitting] = useState(false)
  const [revisionSuccess, setRevisionSuccess] = useState(false)
  const [revisionError, setRevisionError] = useState<string | null>(null)
  const revisionFiles = useFileUpload()

  useEffect(() => {
    supabase
      .from('tasks')
      .select('id, title, assignee, status, client_slug')
      .neq('status', '完了')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTasks(data as Task[] || [])
        const slugs = new Set<string>()
        data?.forEach((task) => {
          if (task.client_slug) slugs.add(task.client_slug)
        })
        setExistingClientSlugs([...slugs].sort())
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    supabase
      .from('client_settings')
      .select('slug')
      .then(({ data }) => {
        setExistingClientSlugs((prev) => {
          const slugs = new Set(prev)
          data?.forEach((row) => {
            if (row.slug) slugs.add(row.slug)
          })
          return [...slugs].sort()
        })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendDiscordNotification = async (type: string, taskTitle: string, taskAssignee: string, note?: string, modifiedBy?: string, clientSlug?: string, description?: string, fileUrls?: string[]) => {
    try {
      await fetch('/api/discord/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: taskTitle, assignee: taskAssignee, note, modifiedBy, clientSlug, description, fileUrls }),
      })
    } catch {}
  }

  const handleNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNewError(null)
    if (!title.trim() || !category) {
      setNewError('タイトルとカテゴリは必須です')
      return
    }
    const normalizedClientSlug = clientSlug.trim()
    const amountValue = normalizedClientSlug === TASK_AIMS_CLIENT_CODE ? parseAmount(amount) : null
    if (Number.isNaN(amountValue)) {
      setNewError('金額は数値で入力してください')
      return
    }
    setIsSubmitting(true)
    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      assignee: category,
      description: description.trim() || null,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      file_urls: newFiles.uploadedFiles.map((f) => f.url),
      file_names: newFiles.uploadedFiles.map((f) => f.name),
      client_slug: normalizedClientSlug || null,
      ...(normalizedClientSlug === TASK_AIMS_CLIENT_CODE ? { amount: amountValue } : {}),
    })
    if (error) {
      setNewError('送信に失敗しました')
      setIsSubmitting(false)
      return
    }
    await sendDiscordNotification('created', title.trim(), category, undefined, undefined, normalizedClientSlug || undefined, description.trim() || undefined, newFiles.uploadedFiles.map((f) => f.url))
    setIsSubmitting(false)
    setNewSuccess(true)
    setTitle('')
    setCategory('')
    setDescription('')
    setClientSlug('')
    setAmount('')
    setDueDate(undefined)
    newFiles.reset()
    setTimeout(() => setNewSuccess(false), 3000)
  }

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRevisionError(null)
    if (!selectedTaskId || !revisionNote.trim() || !revisionCategory) {
      setRevisionError('タスク・カテゴリ・修正内容はすべて必須です')
      return
    }
    setIsRevisionSubmitting(true)
    const { error } = await supabase.from('task_revisions').insert({
      task_id: selectedTaskId,
      note: revisionNote.trim(),
      created_by: revisionCategory,
      file_urls: revisionFiles.uploadedFiles.map((f) => f.url),
      file_names: revisionFiles.uploadedFiles.map((f) => f.name),
    })
    if (error) {
      setRevisionError('送信に失敗しました')
      setIsRevisionSubmitting(false)
      return
    }
    const task = tasks.find((t) => t.id === selectedTaskId)
    if (task) {
      await sendDiscordNotification('revision', task.title, task.assignee, revisionNote.trim(), revisionCategory, task.client_slug ?? undefined)
    }
    setIsRevisionSubmitting(false)
    setRevisionSuccess(true)
    setSelectedTaskId('')
    setRevisionCategory('')
    setRevisionNote('')
    revisionFiles.reset()
    setTimeout(() => setRevisionSuccess(false), 3000)
  }

  return (
    <Tabs defaultValue="new">
      <TabsList className="w-full mb-6">
        <TabsTrigger value="new" className="flex-1">新規タスク</TabsTrigger>
        <TabsTrigger value="revision" className="flex-1">修正指示</TabsTrigger>
      </TabsList>

      {/* 新規タスク */}
      <TabsContent value="new">
        <Card>
          <CardContent className="pt-6">
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
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">タイトル *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="案件名・タスク名" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientSlug">
                  クライアントコード
                  <span className="ml-2 text-xs text-muted-foreground font-normal">任意・設定すると専用URLを発行</span>
                </Label>
                {existingClientSlugs.length > 0 && (
                  <Select
                    value={existingClientSlugs.includes(clientSlug.trim()) ? clientSlug.trim() : ''}
                    onValueChange={setClientSlug}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="以前のコードから選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingClientSlugs.map((slug) => (
                        <SelectItem key={slug} value={slug}>{slug}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input
                  id="clientSlug"
                  value={clientSlug}
                  onChange={(e) => setClientSlug(normalizeClientSlug(e.target.value))}
                  placeholder="新しく入力: yamada-sangyo（英数字・ハイフン）"
                />
                {clientSlug.trim() && (
                  <p className="text-xs text-muted-foreground">
                    クライアントURL: <span className="font-mono text-primary">/submit/{clientSlug.trim()}</span>
                  </p>
                )}
              </div>
              {clientSlug.trim() === TASK_AIMS_CLIENT_CODE && (
                <div className="space-y-2">
                  <Label htmlFor="amount">金額</Label>
                  <Input
                    id="amount"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="例: 50000"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="description">内容・備考</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="詳細を入力（任意）" rows={3} />
              </div>
              <div className="space-y-2">
                <Label>期限日</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 size-4" />
                      {dueDate ? format(dueDate, 'yyyy/MM/dd', { locale: ja }) : '期限日を選択'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ja} />
                  </PopoverContent>
                </Popover>
              </div>
              <FileUpload
                uploadedFiles={newFiles.uploadedFiles}
                isUploading={newFiles.isUploading}
                uploadError={newFiles.uploadError}
                onUpload={newFiles.uploadFiles}
                onRemove={newFiles.removeFile}
              />
              <Button type="submit" disabled={isSubmitting || newFiles.isUploading} className="w-full">
                {isSubmitting ? '送信中...' : '送信する'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* 修正指示 */}
      <TabsContent value="revision">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleRevisionSubmit} className="space-y-4">
              {revisionError && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{revisionError}</div>}
              {revisionSuccess && (
                <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-md flex items-center gap-2">
                  <CheckCircleIcon className="size-4" /> 修正指示を送信しました！
                </div>
              )}
              <div className="space-y-2">
                <Label>タスクを選択 *</Label>
                <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                  <SelectTrigger><SelectValue placeholder="対象タスクを選ぶ" /></SelectTrigger>
                  <SelectContent>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}（{task.assignee}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>カテゴリ *</Label>
                <Select value={revisionCategory} onValueChange={setRevisionCategory}>
                  <SelectTrigger><SelectValue placeholder="カテゴリを選択" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="revisionNote">修正内容 *</Label>
                <Textarea id="revisionNote" value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} placeholder="修正指示の内容を入力" rows={4} />
              </div>
              <FileUpload
                uploadedFiles={revisionFiles.uploadedFiles}
                isUploading={revisionFiles.isUploading}
                uploadError={revisionFiles.uploadError}
                onUpload={revisionFiles.uploadFiles}
                onRemove={revisionFiles.removeFile}
              />
              <Button type="submit" disabled={isRevisionSubmitting || revisionFiles.isUploading} className="w-full">
                {isRevisionSubmitting ? '送信中...' : '修正指示を送信'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
