'use client'

import { useState } from 'react'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { isSameDay, parseISO, format, compareAsc } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarIcon, InstagramIcon, TwitterIcon, CalendarDaysIcon } from 'lucide-react'
import type { Project, ProjectStep } from '@/lib/types'

interface DeadlineItem {
  date: string
  label: string
  projectTitle: string
  projectType: string
  isStep: boolean
}

const typeIcon: Record<string, React.ReactNode> = {
  instagram: <InstagramIcon className="size-3 text-pink-500 shrink-0" />,
  twitter: <TwitterIcon className="size-3 text-sky-500 shrink-0" />,
  event: <CalendarDaysIcon className="size-3 text-violet-500 shrink-0" />,
}

interface ProjectCalendarProps {
  projects: Project[]
  allSteps: Record<string, ProjectStep[]>
  onProjectSelect?: (projectId: string) => void
}

export function ProjectCalendar({ projects, allSteps, onProjectSelect }: ProjectCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()

  // 全締切アイテムを収集（プロジェクト納期 + ステップ締切）
  const deadlines: DeadlineItem[] = []

  projects.forEach((p) => {
    if (p.due_date) {
      deadlines.push({
        date: p.due_date,
        label: '納期',
        projectTitle: p.title,
        projectType: p.project_type,
        isStep: false,
      })
    }
    const steps = allSteps[p.id] ?? []
    steps.forEach((s) => {
      if (s.step_due_date && s.status !== '完了') {
        deadlines.push({
          date: s.step_due_date,
          label: s.label,
          projectTitle: p.title,
          projectType: p.project_type,
          isStep: true,
        })
      }
    })
  })

  const sorted = [...deadlines].sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))

  const hasDeadlineOnDate = (date: Date) =>
    deadlines.some((d) => isSameDay(parseISO(d.date), date))

  const deadlinesOnSelected = selectedDate
    ? deadlines.filter((d) => isSameDay(parseISO(d.date), selectedDate))
    : []

  return (
    <div className="flex flex-col gap-4">
      {/* カレンダー */}
      <Calendar
        locale={ja}
        mode="single"
        selected={selectedDate}
        onSelect={(date) => setSelectedDate(date)}
        modifiers={{ hasDeadline: (date) => hasDeadlineOnDate(date) }}
        components={{
          DayButton: (props) => {
            const has = props.modifiers?.hasDeadline
            return (
              <CalendarDayButton {...props}>
                {props.children}
                {has && (
                  <span className="block w-1 h-1 rounded-full mx-auto -mt-0.5 bg-primary" />
                )}
              </CalendarDayButton>
            )
          },
        }}
        className="rounded-md border"
      />

      {/* 選択日のアイテム */}
      {selectedDate && (
        <div className="rounded-md border p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {format(selectedDate, 'M月d日(E)', { locale: ja })}の締切
          </p>
          {deadlinesOnSelected.length === 0 ? (
            <p className="text-xs text-muted-foreground">締切なし</p>
          ) : (
            deadlinesOnSelected.map((d, i) => (
              <div key={i} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer"
                onClick={() => {
                  const p = projects.find((p) => p.title === d.projectTitle)
                  if (p) onProjectSelect?.(p.id)
                }}>
                {typeIcon[d.projectType]}
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate font-medium">{d.projectTitle}</p>
                  <p className="text-[10px] text-muted-foreground">{d.label}</p>
                </div>
                {!d.isStep && <Badge variant="secondary" className="text-[10px] px-1 shrink-0">納期</Badge>}
              </div>
            ))
          )}
        </div>
      )}

      {/* 締切一覧 */}
      {sorted.length > 0 && (
        <div className="rounded-md border p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <CalendarIcon className="size-3" />締切一覧
          </p>
          {sorted.map((d, i) => (
            <div key={i}
              className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer group"
              onClick={() => {
                const p = projects.find((p) => p.title === d.projectTitle)
                if (p) onProjectSelect?.(p.id)
              }}>
              <span className="text-xs font-mono text-muted-foreground shrink-0 w-8">
                {format(parseISO(d.date), 'M/d', { locale: ja })}
              </span>
              {typeIcon[d.projectType]}
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate group-hover:text-primary transition-colors">{d.projectTitle}</p>
                <p className="text-[10px] text-muted-foreground">{d.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
