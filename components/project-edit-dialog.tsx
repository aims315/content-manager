'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { PencilIcon, CalendarIcon, CheckIcon } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/types'

interface ProjectEditDialogProps {
  project: Project
  onUpdated: () => void
}

export function ProjectEditDialog({ project, onUpdated }: ProjectEditDialogProps) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(project.title)
  const [assignee, setAssignee] = useState(project.assignee)
  const [description, setDescription] = useState(project.description ?? '')
  const [dueDate, setDueDate] = useState<Date | undefined>(
    project.due_date ? parseISO(project.due_date) : undefined
  )
  const [saving, setSaving] = useState(false)
  const [existingAssignees, setExistingAssignees] = useState<string[]>([])
  const [reminderDays, setReminderDays] = useState<string>(project.reminder_days != null ? String(project.reminder_days) : '')

  useEffect(() => {
    if (!open) return
    setTitle(project.title)
    setAssignee(project.assignee)
    setDescription(project.description ?? '')
    setDueDate(project.due_date ? parseISO(project.due_date) : undefined)
    setReminderDays(project.reminder_days != null ? String(project.reminder_days) : '')
    async function fetchAssignees() {
      const { data } = await supabase.from('projects').select('assignee').is('deleted_at', null)
      if (data) setExistingAssignees([...new Set(data.map((d) => d.assignee).filter(Boolean))])
    }
    fetchAssignees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSave = async () => {
    if (!title.trim() || !assignee.trim()) return
    setSaving(true)
    const rd = reminderDays.trim() === '' ? null : Math.max(1, parseInt(reminderDays, 10) || 1)
    await supabase.from('projects').update({
      title: title.trim(),
      assignee: assignee.trim(),
      description: description.trim() || null,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      reminder_days: rd,
    }).eq('id', project.id)
    setSaving(false)
    setOpen(false)
    onUpdated()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="プロジェクトを編集"
          onClick={(e) => e.stopPropagation()}
        >
          <PencilIcon className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>プロジェクトを編集</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-sm">タイトル *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">プロジェクトコード *</Label>
            <Input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              list="edit-assignee-list"
              className="h-9"
            />
            <datalist id="edit-assignee-list">
              {existingAssignees.map((a) => <option key={a} value={a} />)}
            </datalist>
            {existingAssignees.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {existingAssignees.map((a) => (
                  <button key={a} type="button"
                    onClick={() => setAssignee(a)}
                    className={cn('text-[11px] px-2 py-0.5 rounded-full border transition-all',
                      assignee === a ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'
                    )}>
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">内容・備考</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="resize-none text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">全体の納期</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start font-normal h-9',
                  !dueDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 size-4" />
                  {dueDate ? format(dueDate, 'yyyy/MM/dd', { locale: ja }) : '納期を選択'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ja} />
                {dueDate && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
                      onClick={() => setDueDate(undefined)}>クリア</Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">締切リマインダー（このプロジェクト）</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">締切の</span>
              <Input type="number" min={1} value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                placeholder="全体設定" className="h-8 text-sm w-24" />
              <span className="text-xs text-muted-foreground">日前から</span>
            </div>
            <p className="text-[10px] text-muted-foreground">空欄なら全体設定に従います。数字を入れるとこのプロジェクトだけその日数で通知します。</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>キャンセル</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? '保存中...' : <><CheckIcon className="size-4 mr-1" />保存</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
