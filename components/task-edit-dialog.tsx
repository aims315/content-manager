'use client'

import { useState, useEffect } from 'react'
import type { Task } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
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

interface TaskEditDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (
    taskId: string,
    updates: { title: string; assignee: string; due_date: string | null; draft_due_date: string | null; description?: string; client_slug?: string | null; amount?: number | null }
  ) => Promise<boolean>
}

export function TaskEditDialog({ task, open, onOpenChange, onSave }: TaskEditDialogProps) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [clientSlug, setClientSlug] = useState('')
  const [amount, setAmount] = useState('')
  const [existingClientSlugs, setExistingClientSlugs] = useState<string[]>([])
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [draftDueDate, setDraftDueDate] = useState<Date | undefined>()
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setCategory(task.assignee)
      setDescription(task.description ?? '')
      setClientSlug(task.client_slug ?? '')
      setAmount(task.amount != null ? String(task.amount) : '')
      setDueDate(task.due_date ? parseISO(task.due_date) : undefined)
      setDraftDueDate(task.draft_due_date ? parseISO(task.draft_due_date) : undefined)
    }
  }, [task])

  useEffect(() => {
    async function fetchClientSlugs() {
      const [{ data: taskRows }, { data: settingRows }] = await Promise.all([
        supabase.from('tasks').select('client_slug').not('client_slug', 'is', null),
        supabase.from('client_settings').select('slug'),
      ])

      const slugs = new Set<string>()
      taskRows?.forEach((row) => {
        if (row.client_slug) slugs.add(row.client_slug)
      })
      settingRows?.forEach((row) => {
        if (row.slug) slugs.add(row.slug)
      })
      setExistingClientSlugs([...slugs].sort())
    }

    if (open) fetchClientSlugs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSave = async () => {
    if (!task || !title.trim() || !category) return
    setIsSaving(true)
    const normalizedClientSlug = clientSlug.trim()
    const amountValue = parseAmount(amount)
    if (Number.isNaN(amountValue)) {
      setIsSaving(false)
      return
    }
    const success = await onSave(task.id, {
      title: title.trim(),
      assignee: category,
      description: description.trim() || undefined,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      draft_due_date: draftDueDate ? format(draftDueDate, 'yyyy-MM-dd') : null,
      client_slug: normalizedClientSlug || null,
      amount: amountValue,
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
              id="edit-client-slug"
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

          <div className="space-y-2">
            <Label htmlFor="edit-amount">金額</Label>
            <Input
              id="edit-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例: 50000"
            />
          </div>

          <div className="space-y-2">
            <Label>初校締切日</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !draftDueDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {draftDueDate ? format(draftDueDate, 'yyyy/MM/dd', { locale: ja }) : '初校締切日を選択'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={draftDueDate} onSelect={setDraftDueDate} locale={ja} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>最終締切日</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dueDate ? format(dueDate, 'yyyy/MM/dd', { locale: ja }) : '最終締切日を選択'}
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
