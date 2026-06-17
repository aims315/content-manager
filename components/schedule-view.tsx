'use client'

import { useState } from 'react'
import {
  parseISO, format, isSameDay, isToday,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, isSameMonth, getDay,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { InstagramIcon, TwitterIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
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

const typeDot: Record<string, string> = {
  instagram: 'bg-pink-500',
  twitter: 'bg-sky-500',
  event: 'bg-violet-500',
}
const typeChip: Record<string, string> = {
  instagram: 'bg-pink-50 text-pink-700 border-pink-200',
  twitter: 'bg-sky-50 text-sky-700 border-sky-200',
  event: 'bg-violet-50 text-violet-700 border-violet-200',
}

const TYPE_FILTERS = [
  { key: 'instagram', label: 'Instagram', color: 'text-pink-600',   bg: 'bg-pink-50 border-pink-300' },
  { key: 'twitter',   label: 'X',         color: 'text-sky-600',    bg: 'bg-sky-50 border-sky-300' },
  { key: 'event',     label: 'イベント',  color: 'text-violet-600', bg: 'bg-violet-50 border-violet-300' },
] as const

const KIND_FILTERS = [
  { key: 'due_date',      label: '納期・期日' },
  { key: 'step_due_date', label: 'ステップ締切' },
] as const

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

interface ScheduleViewProps {
  projects: Project[]
  allSteps: Record<string, ProjectStep[]>
  warningDays?: number
  progressByProject?: Record<string, { done: number; total: number }>
  onJumpToProject?: (projectId: string) => void
}

export function ScheduleView({ projects, allSteps, progressByProject = {}, onJumpToProject }: ScheduleViewProps) {
  const [mode, setMode] = useState<'calendar' | 'cards'>('calendar')
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()))
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(['instagram', 'twitter', 'event']))
  const [kindFilter, setKindFilter] = useState<Set<string>>(new Set(['due_date', 'step_due_date']))

  const toggleType = (key: string) => setTypeFilter((prev) => {
    const next = new Set(prev); if (next.has(key)) { if (next.size > 1) next.delete(key) } else next.add(key); return next
  })
  const toggleKind = (key: string) => setKindFilter((prev) => {
    const next = new Set(prev); if (next.has(key)) { if (next.size > 1) next.delete(key) } else next.add(key); return next
  })

  // アイテム収集
  const allItems: ScheduleItem[] = []
  projects.forEach((p) => {
    const typeOk = typeFilter.has(p.project_type)
    if (p.due_date && kindFilter.has('due_date') && typeOk) {
      allItems.push({ date: p.due_date, projectId: p.id, projectTitle: p.title, projectType: p.project_type, label: '納期', isStep: false, isDone: false })
    }
    if (kindFilter.has('step_due_date') && typeOk) {
      (allSteps[p.id] ?? []).forEach((s) => {
        if (s.step_due_date) allItems.push({ date: s.step_due_date, projectId: p.id, projectTitle: p.title, projectType: p.project_type, label: s.label, isStep: true, isDone: s.status === '完了' })
      })
    }
    if (kindFilter.has('due_date') && typeOk && p.custom_dates) {
      p.custom_dates.forEach((cd) => {
        if (cd.date) allItems.push({ date: cd.date, projectId: p.id, projectTitle: p.title, projectType: p.project_type, label: cd.label, isStep: false, isDone: false })
      })
    }
  })

  // 日付ごとにまとめる
  const itemsByDate: Record<string, ScheduleItem[]> = {}
  for (const it of allItems) (itemsByDate[it.date] ??= []).push(it)

  // 月グリッドの日付（前後の週も埋める）
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className="space-y-3">
      {/* ヘッダー：月移動 + フィルター */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* 表示モード切替 */}
          <div className="flex rounded-md border overflow-hidden mr-1">
            <button onClick={() => setMode('calendar')}
              className={cn('px-2.5 py-1 text-xs transition-colors', mode === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>カレンダー</button>
            <button onClick={() => setMode('cards')}
              className={cn('px-2.5 py-1 text-xs transition-colors border-l', mode === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>カード</button>
          </div>
          {mode === 'calendar' && (<>
            <button onClick={() => setMonth((m) => addMonths(m, -1))} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><ChevronLeftIcon className="size-4" /></button>
            <span className="text-base font-bold w-28 text-center">{format(month, 'yyyy年 M月', { locale: ja })}</span>
            <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><ChevronRightIcon className="size-4" /></button>
            <button onClick={() => setMonth(startOfMonth(new Date()))} className="ml-1 text-xs px-2 py-1 rounded border text-muted-foreground hover:bg-muted">今月</button>
          </>)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter.has(f.key)
            return (
              <button key={f.key} type="button" onClick={() => toggleType(f.key)}
                className={cn('flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all',
                  active ? f.bg + ' ' + f.color : 'border-border text-muted-foreground opacity-40')}>
                <span className={cn('size-1.5 rounded-full', active ? 'bg-current' : 'bg-muted-foreground')} />{f.label}
              </button>
            )
          })}
          {KIND_FILTERS.map((f) => {
            const active = kindFilter.has(f.key)
            return (
              <button key={f.key} type="button" onClick={() => toggleKind(f.key)}
                className={cn('text-[11px] px-2 py-0.5 rounded-full border transition-all',
                  active ? 'bg-foreground/5 border-foreground/20 text-foreground' : 'border-border text-muted-foreground opacity-40')}>
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 曜日ヘッダー */}
      {mode === 'calendar' && (
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={cn('text-center text-[11px] font-semibold py-1',
            i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-500' : 'text-muted-foreground')}>
            {w}
          </div>
        ))}
      </div>
      )}

      {/* 月グリッド */}
      {mode === 'calendar' && (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayItems = itemsByDate[key] ?? []
          const dow = getDay(day)
          const inMonth = isSameMonth(day, month)
          const today = isToday(day)
          return (
            <div key={key} className={cn(
              'min-h-[92px] bg-card p-1 flex flex-col gap-0.5',
              !inMonth && 'bg-muted/30',
              dow === 0 && 'bg-rose-50/40',
              dow === 6 && 'bg-sky-50/40',
            )}>
              <div className={cn('text-[11px] font-medium px-0.5',
                today && 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground',
                !today && dow === 0 && 'text-rose-500',
                !today && dow === 6 && 'text-sky-500',
                !today && dow !== 0 && dow !== 6 && 'text-foreground',
                !inMonth && !today && 'opacity-40',
              )}>
                {format(day, 'd')}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayItems.slice(0, 4).map((it, i) => (
                  <button key={i} type="button" onClick={() => onJumpToProject?.(it.projectId)}
                    title={`${it.projectTitle}：${it.label}`}
                    className={cn('flex items-center gap-1 text-[9px] leading-tight px-1 py-0.5 rounded border text-left truncate',
                      typeChip[it.projectType] ?? 'bg-muted text-muted-foreground border-border',
                      it.isDone && 'opacity-40 line-through',
                      onJumpToProject && 'hover:brightness-95 cursor-pointer')}>
                    <span className={cn('size-1.5 rounded-full shrink-0', typeDot[it.projectType] ?? 'bg-muted-foreground')} />
                    <span className="truncate">{it.label === '納期' ? it.projectTitle : `${it.projectTitle}・${it.label}`}</span>
                  </button>
                ))}
                {dayItems.length > 4 && (
                  <span className="text-[9px] text-muted-foreground px-1">＋{dayItems.length - 4}件</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* カード（時系列）表示 */}
      {mode === 'cards' && (() => {
        const sorted = [...allItems].sort((a, b) => a.date.localeCompare(b.date))
        // 行を埋めるため、3の倍数になるよう空の白カードを足す
        const padCount = sorted.length === 0 ? 0 : (3 - (sorted.length % 3)) % 3
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sorted.map((it, i) => {
              const prog = progressByProject[it.projectId]
              const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0
              return (
                <button key={i} type="button" onClick={() => onJumpToProject?.(it.projectId)}
                  className={cn('text-left rounded-lg border bg-card p-3 min-h-[110px] flex flex-col gap-1.5 shadow-sm transition-colors',
                    it.isDone && 'opacity-50', onJumpToProject && 'hover:bg-accent/50 cursor-pointer')}>
                  <div className="flex items-center gap-2">
                    <span className={cn('size-2 rounded-full shrink-0', typeDot[it.projectType] ?? 'bg-muted-foreground')} />
                    <span className="text-sm font-bold tabular-nums">{format(parseISO(it.date), 'M/d', { locale: ja })}</span>
                    <span className="text-[10px] text-muted-foreground">({format(parseISO(it.date), 'E', { locale: ja })})</span>
                    <span className={cn('ml-auto text-[10px] px-1.5 py-0.5 rounded border', typeChip[it.projectType])}>{it.label}</span>
                  </div>
                  <p className={cn('text-sm font-medium truncate', it.isDone && 'line-through')}>{it.projectTitle}</p>
                  {prog && prog.total > 0 && (
                    <div className="flex items-center gap-1.5 mt-auto">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{prog.done}/{prog.total}</span>
                    </div>
                  )}
                </button>
              )
            })}
            {/* 空きスロットを同サイズの白カードで埋める */}
            {Array.from({ length: padCount }).map((_, i) => (
              <div key={`pad_${i}`} className="rounded-lg border border-dashed bg-card/50 min-h-[110px]" />
            ))}
            {sorted.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground text-sm">予定がありません</div>
            )}
          </div>
        )
      })()}

      <p className="text-[11px] text-muted-foreground">予定をクリックするとそのカードに移動します。{allItems.length}件表示中。</p>
    </div>
  )
}
