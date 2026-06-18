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
import { PencilIcon, CalendarIcon, CheckIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Project, CustomDate } from '@/lib/types'
import { BAR_COLORS } from '@/components/schedule-view'

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
  const [customDates, setCustomDates] = useState<CustomDate[]>(project.custom_dates ?? [])
  const [barColor, setBarColor] = useState<string | null>(project.bar_color ?? null)

  useEffect(() => {
    if (!open) return
    setTitle(project.title)
    setAssignee(project.assignee)
    setDescription(project.description ?? '')
    setDueDate(project.due_date ? parseISO(project.due_date) : undefined)
    setReminderDays(project.reminder_days != null ? String(project.reminder_days) : '')
    setCustomDates(project.custom_dates ?? [])
    setBarColor(project.bar_color ?? null)
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
    const cleanDates = customDates.filter((d) => d.label.trim() && d.date)
    await supabase.from('projects').update({
      title: title.trim(),
      assignee: assignee.trim(),
      description: description.trim() || null,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      reminder_days: rd,
      custom_dates: cleanDates,
      bar_color: barColor,
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

          {/* 名前付きの追加期日 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">追加の期日（名前付き）</Label>
              <button type="button"
                onClick={() => setCustomDates((prev) => [...prev, { id: `date_${Date.now()}`, label: '', date: '' }])}
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
                <PlusIcon className="size-3" />追加
              </button>
            </div>
            {customDates.length === 0 && (
              <p className="text-[10px] text-muted-foreground">例：投稿期日 / 確認完了期日 など、好きな名前で期日を追加できます。</p>
            )}
            {customDates.map((cd) => (
              <div key={cd.id} className="flex items-center gap-1.5">
                <Input value={cd.label} placeholder="名前（例: 投稿期日）" className="h-8 text-xs flex-1"
                  onChange={(e) => setCustomDates((prev) => prev.map((x) => x.id === cd.id ? { ...x, label: e.target.value } : x))} />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm"
                      className={cn('h-8 text-xs gap-1 shrink-0', !cd.date && 'text-muted-foreground')}>
                      <CalendarIcon className="size-3" />
                      {cd.date ? format(parseISO(cd.date), 'M/d', { locale: ja }) : '日付'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" locale={ja}
                      selected={cd.date ? parseISO(cd.date) : undefined}
                      onSelect={(date) => setCustomDates((prev) => prev.map((x) => x.id === cd.id ? { ...x, date: date ? format(date, 'yyyy-MM-dd') : '' } : x))} />
                  </PopoverContent>
                </Popover>
                <button type="button" title="削除"
                  onClick={() => setCustomDates((prev) => prev.filter((x) => x.id !== cd.id))}
                  className="text-muted-foreground hover:text-destructive shrink-0"><Trash2Icon className="size-3.5" /></button>
              </div>
            ))}
          </div>

          {/* ガントバーの色 */}
          <div className="space-y-1.5">
            <Label className="text-sm">ガントチャートのバー色</Label>
            <div className="flex flex-wrap gap-1.5 items-center">
              <button type="button" onClick={() => setBarColor(null)} title="種別の色（既定）"
                className={cn('size-6 rounded-full border-2 bg-muted flex items-center justify-center text-[9px] text-muted-foreground',
                  !barColor ? 'border-foreground' : 'border-transparent')}>自動</button>
              {BAR_COLORS.map((c) => (
                <button key={c.key} type="button" onClick={() => setBarColor(c.key)} title={c.label}
                  className={cn('size-6 rounded-full border-2 transition-transform hover:scale-110', c.bg,
                    barColor === c.key ? 'border-foreground' : 'border-transparent')} />
              ))}
            </div>
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
