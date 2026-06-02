'use client'

import { useState, useEffect } from 'react'
import type { Task } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = ['デザイン', '動画', 'その他'] as const

interface TaskEditDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (
    taskId: string,
    updates: { title: string; assignee: string; due_date: string | null; description?: string; client_slug?: string | null }
  ) => Promise<boolean>
}

export function TaskEditDialog({ task, open, onOpenChange, onSave }: TaskEditDialogProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [clientSlug, setClientSlug] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setCategory(task.assignee)
      setDescription(task.description ?? '')
      setClientSlug(task.client_slug ?? '')
      setDueDate(task.due_date ? parseISO(task.due_date) : undefined)
    }
  }, [task])

  const handleSave = async () => {
    if (!task || !title.trim() || !category) return
    setIsSaving(true)
    const success = await onSave(task.id, {
      title: title.trim(),
      assignee: category,
      description: description.trim() || undefined,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      client_slug: clientSlug.trim() || null,
    })
    setIsSaving(false)
    if (success) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>タスクを編集</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>カテゴリ *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="カテゴリを選択" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-title">タイトル *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タスクのタイトル"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">説明</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="説明（任意）"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-client-slug">クライアントコード</Label>
            <Input
              id="edit-client-slug"
              value={clientSlug}
              onChange={(e) => setClientSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="例: yamada-sangyo（英数字・ハイフン）"
            />
            {clientSlug.trim() && (
              <p className="text-xs text-muted-foreground">
                クライアントURL: <span className="font-mono text-primary">/submit/{clientSlug.trim()}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>期限日</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dueDate ? format(dueDate, 'yyyy/MM/dd', { locale: ja }) : '期限日を選択'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ja} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim() || !category}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
