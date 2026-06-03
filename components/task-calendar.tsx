'use client'

import { useState } from 'react'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { Task } from '@/lib/types'
import { isSameDay, parseISO, format, compareAsc } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'

interface TaskCalendarProps {
  tasks: Task[]
  onDateSelect?: (date: Date) => void
  onTaskSelect?: (taskId: string) => void
}

const statusColors: Record<string, string> = {
  '未着手': 'bg-muted text-muted-foreground',
  '進行中': 'bg-amber-100 text-amber-800',
  '修正': 'bg-rose-100 text-rose-800',
  '修正対応完了': 'bg-blue-100 text-blue-800',
  '完了': 'bg-emerald-100 text-emerald-800',
}

type DateMode = '最終' | '初校'

export function TaskCalendar({ tasks, onDateSelect, onTaskSelect }: TaskCalendarProps) {
  const [mode, setMode] = useState<DateMode>('最終')

  const getDate = (task: Task) => mode === '初校' ? task.draft_due_date : task.due_date

  const tasksWithDate = tasks.filter((task) => getDate(task) && task.status !== '完了')

  const hasTaskOnDate = (date: Date) =>
    tasksWithDate.some((task) => isSameDay(parseISO(getDate(task)!), date))

  const sortedTasks = [...tasksWithDate].sort((a, b) =>
    compareAsc(parseISO(getDate(a)!), parseISO(getDate(b)!))
  )

  return (
    <div className="flex flex-col gap-4">
      {/* 切り替えボタン */}
      <div className="flex rounded-md border overflow-hidden text-xs w-fit">
        {(['最終', '初校'] as DateMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 transition-colors ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* 期日一覧 */}
      {sortedTasks.length > 0 && (
        <div className="rounded-md border p-3 space-y-1 order-first md:order-last">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {mode}締切一覧
          </p>
          {sortedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-2 py-1 group"
              onClick={() => onTaskSelect?.(task.id)}
            >
              <span className="text-xs font-mono text-muted-foreground shrink-0 w-8">
                {format(parseISO(getDate(task)!), 'M/d', { locale: ja })}
              </span>
              <p className="text-sm truncate flex-1 group-hover:text-primary transition-colors">
                {task.title}
              </p>
              <Badge className={`${statusColors[task.status]} shrink-0 text-xs`} variant="secondary">
                {task.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
      {sortedTasks.length === 0 && (
        <p className="text-xs text-muted-foreground">{mode}締切が設定されたタスクがありません</p>
      )}

      {/* カレンダー */}
      <div className="order-last md:order-first">
        <Calendar
          locale={ja}
          mode="single"
          onSelect={(date) => date && onDateSelect?.(date)}
          modifiers={{ hasTask: (date) => hasTaskOnDate(date) }}
          components={{
            DayButton: (props) => {
              const hasTask = props.modifiers?.hasTask
              return (
                <CalendarDayButton {...props}>
                  {props.children}
                  {hasTask && (
                    <span className={`block w-1 h-1 rounded-full mx-auto -mt-0.5 ${mode === '初校' ? 'bg-violet-500' : 'bg-primary'}`} />
                  )}
                </CalendarDayButton>
              )
            },
          }}
          className="rounded-md border"
        />
      </div>
    </div>
  )
}
