'use client'

import { useState } from 'react'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { isSameDay, parseISO, format, compareAsc, isPast, isToday } from 'date-fns'
import { ja } from 'date-fns/locale'
import { InstagramIcon, TwitterIcon, CalendarDaysIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project, ProjectStep } from '@/lib/types'

interface ScheduleItem {
  date: string
  projectId: string
  projectTitle: string
  projectType: string
  label: string
  isStep: boolean
  isDone: boolean
}

const typeIcon: Record<string, React.ReactNode> = {
  instagram: <InstagramIcon className="size-3.5 text-pink-500 shrink-0" />,
  twitter: <TwitterIcon className="size-3.5 text-sky-500 shrink-0" />,
  event: <CalendarDaysIcon className="size-3.5 text-violet-500 shrink-0" />,
}

const typeBorder: Record<string, string> = {
  instagram: 'border-l-pink-400',
  twitter: 'border-l-sky-400',
  event: 'border-l-violet-400',
}

interface ScheduleViewProps {
  projects: Project[]
  allSteps: Record<string, ProjectStep[]>
}

export function ScheduleView({ projects, allSteps }: ScheduleViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()

  // 全スケジュールアイテムを収集
  const items: ScheduleItem[] = []
  projects.forEach((p) => {
    if (p.due_date) {
      items.push({
        date: p.due_date,
        projectId: p.id,
        projectTitle: p.title,
        projectType: p.project_type,
        label: '納期',
        isStep: false,
        isDone: false,
      })
    }
    const steps = allSteps[p.id] ?? []
    steps.forEach((s) => {
      if (s.step_due_date) {
        items.push({
          date: s.step_due_date,
          projectId: p.id,
          projectTitle: p.title,
          projectType: p.project_type,
          label: s.label,
          isStep: true,
          isDone: s.status === '完了',
        })
      }
    })
  })

  const sorted = [...items].sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))

  const hasItemOnDate = (date: Date) =>
    items.some((d) => isSameDay(parseISO(d.date), date))

  const displayed = selectedDate
    ? sorted.filter((d) => isSameDay(parseISO(d.date), selectedDate))
    : sorted

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* 左：カレンダー */}
      <div className="shrink-0 lg:w-72">
        <Calendar
          locale={ja}
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date && selectedDate && isSameDay(date, selectedDate)) {
              setSelectedDate(undefined) // 同じ日クリックで解除
            } else {
              setSelectedDate(date)
            }
          }}
          modifiers={{ hasItem: (date) => hasItemOnDate(date) }}
          components={{
            DayButton: (props) => {
              const has = props.modifiers?.hasItem
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
          className="rounded-md border w-full"
        />
        {selectedDate && (
          <button
            onClick={() => setSelectedDate(undefined)}
            className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground text-center py-1"
          >
            ← すべて表示
          </button>
        )}
      </div>

      {/* 右：スリムカード一覧 */}
      <div className="flex-1 min-w-0">
        {selectedDate && (
          <p className="text-sm font-medium mb-3 text-muted-foreground">
            {format(selectedDate, 'M月d日(E)', { locale: ja })}のスケジュール
          </p>
        )}
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">スケジュールがありません</p>
            <p className="text-xs mt-1">プロジェクトの納期やステップの締め切りを設定してください</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* 日付ヘッダー付きグループ表示 */}
            {(() => {
              const grouped: { date: string; items: ScheduleItem[] }[] = []
              displayed.forEach((item) => {
                const last = grouped[grouped.length - 1]
                if (last && last.date === item.date) {
                  last.items.push(item)
                } else {
                  grouped.push({ date: item.date, items: [item] })
                }
              })
              return grouped.map(({ date, items: groupItems }) => {
                const d = parseISO(date)
                const past = isPast(d) && !isToday(d)
                const today = isToday(d)
                return (
                  <div key={date}>
                    {/* 日付ヘッダー */}
                    <div className={cn(
                      'flex items-center gap-2 px-1 py-1 text-xs font-semibold sticky top-0 bg-background',
                      today ? 'text-primary' : past ? 'text-muted-foreground' : 'text-foreground'
                    )}>
                      <span className={cn(
                        'inline-flex items-center justify-center w-10 h-5 rounded text-[11px] font-bold',
                        today ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}>
                        {format(d, 'M/d', { locale: ja })}
                      </span>
                      <span className="text-muted-foreground font-normal">
                        {format(d, '(E)', { locale: ja })}
                      </span>
                      {today && <span className="text-[10px] text-primary font-normal">今日</span>}
                    </div>

                    {/* その日のカード */}
                    <div className="space-y-1 ml-2 mb-2">
                      {groupItems.map((item, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center gap-3 rounded-md border-l-2 bg-card px-3 py-2 shadow-sm',
                            typeBorder[item.projectType],
                            item.isDone && 'opacity-40',
                            past && !item.isDone && 'bg-rose-50 border-rose-200 border-l-rose-400'
                          )}
                        >
                          {typeIcon[item.projectType]}
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium truncate', item.isDone && 'line-through')}>
                              {item.projectTitle}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">{item.label}</p>
                          </div>
                          {item.isDone && (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">完了</span>
                          )}
                          {!item.isDone && past && (
                            <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded shrink-0">遅延</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
