'use client'

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

export function TaskCalendar({ tasks, onDateSelect, onTaskSelect }: TaskCalendarProps) {
  const tasksWithDate = tasks.filter((task) => task.due_date && task.status !== '完了')

  const hasTaskOnDate = (date: Date) =>
    tasksWithDate.some((task) => isSameDay(parseISO(task.due_date!), date))

  const sortedTasks = [...tasksWithDate].sort((a, b) =>
    compareAsc(parseISO(a.due_date!), parseISO(b.due_date!))
  )

  return (
    <div className="flex flex-col gap-4">
      {/* 期日一覧：スマホでは上、PCでは下 */}
      {sortedTasks.length > 0 && (
        <div className="rounded-md border p-3 space-y-1 order-first md:order-last">
          <p className="text-xs font-medium text-muted-foreground mb-2">期日一覧</p>
          {sortedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-2 py-1 group"
              onClick={() => onTaskSelect?.(task.id)}
            >
              <span className="text-xs font-mono text-muted-foreground shrink-0 w-8">
                {format(parseISO(task.due_date!), 'M/d', { locale: ja })}
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

      {/* カレンダー：スマホでは下、PCでは上 */}
      <div className="order-last md:order-first">
        <Calendar
          locale={ja}
          mode="single"
          onSelect={(date) => date && onDateSelect?.(date)}
          modifiers={{
            hasTask: (date) => hasTaskOnDate(date),
          }}
          components={{
            DayButton: (props) => {
              const hasTask = props.modifiers?.hasTask
              return (
                <CalendarDayButton {...props}>
                  {props.children}
                  {hasTask && (
                    <span className="block w-1 h-1 rounded-full bg-primary mx-auto -mt-0.5" />
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
