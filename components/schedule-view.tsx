'use client'

import { useState } from 'react'
import {
  parseISO, format, isSameDay, isToday,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, isSameMonth, getDay, differenceInCalendarDays,
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
  { key: 'due_date',      label: '納期' },
  { key: 'step_due_date', label: 'ステップ締切' },
  { key: 'custom_date',   label: '追加期日' },
] as const

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// 日本の祝日（2026〜2027）。YYYY-MM-DD → 名称
const HOLIDAYS: Record<string, string> = {
  '2026-01-01': '元日', '2026-01-12': '成人の日', '2026-02-11': '建国記念の日',
  '2026-02-23': '天皇誕生日', '2026-03-20': '春分の日', '2026-04-29': '昭和の日',
  '2026-05-03': '憲法記念日', '2026-05-04': 'みどりの日', '2026-05-05': 'こどもの日', '2026-05-06': '振替休日',
  '2026-07-20': '海の日', '2026-08-11': '山の日', '2026-09-21': '敬老の日', '2026-09-22': '国民の休日',
  '2026-09-23': '秋分の日', '2026-10-12': 'スポーツの日', '2026-11-03': '文化の日', '2026-11-23': '勤労感謝の日',
  '2027-01-01': '元日', '2027-01-11': '成人の日', '2027-02-11': '建国記念の日',
  '2027-02-23': '天皇誕生日', '2027-03-21': '春分の日', '2027-03-22': '振替休日', '2027-04-29': '昭和の日',
  '2027-05-03': '憲法記念日', '2027-05-04': 'みどりの日', '2027-05-05': 'こどもの日',
  '2027-07-19': '海の日', '2027-08-11': '山の日', '2027-09-20': '敬老の日', '2027-09-23': '秋分の日',
  '2027-10-11': 'スポーツの日', '2027-11-03': '文化の日', '2027-11-23': '勤労感謝の日',
}

interface ScheduleViewProps {
  projects: Project[]
  allSteps: Record<string, ProjectStep[]>
  warningDays?: number
  progressByProject?: Record<string, { done: number; total: number }>
  onJumpToProject?: (projectId: string) => void
}

export function ScheduleView({ projects, allSteps, progressByProject = {}, onJumpToProject }: ScheduleViewProps) {
  const [mode, setMode] = useState<'calendar' | 'cards' | 'gantt'>('calendar')
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()))
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(['instagram', 'twitter', 'event']))
  const [kindFilter, setKindFilter] = useState<Set<string>>(new Set(['due_date', 'step_due_date', 'custom_date']))

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
    if (kindFilter.has('custom_date') && typeOk && p.custom_dates) {
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
            <button onClick={() => setMode('gantt')}
              className={cn('px-2.5 py-1 text-xs transition-colors border-l', mode === 'gantt' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>ガント</button>
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
          const holiday = HOLIDAYS[key]
          const isRed = dow === 0 || !!holiday   // 日曜・祝日は赤
          return (
            <div key={key} className={cn(
              'min-h-[92px] bg-card p-1 flex flex-col gap-0.5',
              !inMonth && 'bg-muted/30',
              isRed && 'bg-rose-50/40',
              dow === 6 && !holiday && 'bg-sky-50/40',
            )}>
              <div className="flex items-center gap-1">
                <span className={cn('text-[11px] font-medium px-0.5',
                  today && 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground',
                  !today && isRed && 'text-rose-500',
                  !today && !isRed && dow === 6 && 'text-sky-500',
                  !today && !isRed && dow !== 6 && 'text-foreground',
                  !inMonth && !today && 'opacity-40',
                )}>
                  {format(day, 'd')}
                </span>
                {holiday && inMonth && <span className="text-[8px] text-rose-500 truncate">{holiday}</span>}
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

      {/* カード（日付順リスト）表示 */}
      {mode === 'cards' && (() => {
        const sorted = [...allItems].sort((a, b) => a.date.localeCompare(b.date))
        if (sorted.length === 0) {
          return <div className="text-center py-16 text-muted-foreground text-sm">予定がありません</div>
        }
        // 日付ごとにグループ化
        const groups: { date: string; items: ScheduleItem[] }[] = []
        for (const it of sorted) {
          const last = groups[groups.length - 1]
          if (last && last.date === it.date) last.items.push(it)
          else groups.push({ date: it.date, items: [it] })
        }
        return (
          <div className="space-y-1.5">
            {groups.map(({ date, items }) => {
              const d = parseISO(date)
              const dow = getDay(d)
              const hol = HOLIDAYS[date]
              const red = dow === 0 || !!hol
              return (
                <div key={date}>
                  <div className="flex items-center gap-2 px-1 py-1 text-xs font-semibold sticky top-0 bg-background">
                    <span className={cn('inline-flex items-center justify-center min-w-12 h-5 px-1 rounded text-[11px] font-bold',
                      isToday(d) ? 'bg-primary text-primary-foreground' : red ? 'bg-rose-100 text-rose-600' : dow === 6 ? 'bg-sky-100 text-sky-600' : 'bg-muted')}>
                      {format(d, 'M/d', { locale: ja })}
                    </span>
                    <span className={cn('font-normal', red ? 'text-rose-500' : dow === 6 ? 'text-sky-500' : 'text-muted-foreground')}>
                      ({format(d, 'E', { locale: ja })}){hol ? ` ${hol}` : ''}
                    </span>
                  </div>
                  <div className="space-y-1 ml-2 mb-2">
                    {items.map((it, i) => {
                      const prog = progressByProject[it.projectId]
                      const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0
                      return (
                        <button key={i} type="button" onClick={() => onJumpToProject?.(it.projectId)}
                          className={cn('w-full text-left flex items-center gap-3 rounded-md border-l-2 bg-card px-3 py-2 shadow-sm transition-colors',
                            it.projectType === 'instagram' && 'border-l-pink-400', it.projectType === 'twitter' && 'border-l-sky-400', it.projectType === 'event' && 'border-l-violet-400',
                            it.isDone && 'opacity-40', onJumpToProject && 'hover:bg-accent/50 cursor-pointer')}>
                          <span className={cn('size-2 rounded-full shrink-0', typeDot[it.projectType] ?? 'bg-muted-foreground')} />
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium truncate', it.isDone && 'line-through')}>{it.projectTitle}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{it.label}</p>
                            {prog && prog.total > 0 && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden max-w-[160px]">
                                  <div className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[9px] text-muted-foreground shrink-0">{prog.done}/{prog.total}</span>
                              </div>
                            )}
                            {/* 未完了ステップ */}
                            {(() => {
                              const remaining = (allSteps[it.projectId] ?? []).filter((s) => s.status !== '完了')
                              if (remaining.length === 0) return null
                              return (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {remaining.map((s) => (
                                    <span key={s.id} className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                                      {s.label}<span className="opacity-60">・{s.status}</span>
                                    </span>
                                  ))}
                                </div>
                              )
                            })()}
                          </div>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0', typeChip[it.projectType])}>{it.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ガントチャート表示 */}
      {mode === 'gantt' && (() => {
        // プロジェクトごとに開始〜終了（このスケジュールに出ている日付の最小〜最大）を集計
        const byProject: Record<string, { title: string; type: string; min: string; max: string }> = {}
        for (const it of allItems) {
          const e = byProject[it.projectId]
          if (!e) byProject[it.projectId] = { title: it.projectTitle, type: it.projectType, min: it.date, max: it.date }
          else { if (it.date < e.min) e.min = it.date; if (it.date > e.max) e.max = it.date }
        }
        const rows = Object.entries(byProject).map(([projectId, v]) => ({ projectId, ...v }))
          .sort((a, b) => a.min.localeCompare(b.min))
        if (rows.length === 0) {
          return <div className="text-center py-16 text-muted-foreground text-sm">予定がありません</div>
        }
        // 全体の日付範囲
        let rangeStart = rows[0].min, rangeEnd = rows[0].max
        for (const r of rows) { if (r.min < rangeStart) rangeStart = r.min; if (r.max > rangeEnd) rangeEnd = r.max }
        const start = parseISO(rangeStart), end = parseISO(rangeEnd)
        const totalDays = differenceInCalendarDays(end, start) + 1
        const DAY_W = 26
        const dayList = eachDayOfInterval({ start, end })
        const todayOffset = differenceInCalendarDays(new Date(), start)

        const dotBg: Record<string, string> = { instagram: 'bg-pink-400', twitter: 'bg-sky-400', event: 'bg-violet-400' }

        return (
          <div className="overflow-x-auto border rounded-lg">
            <div style={{ width: 180 + totalDays * DAY_W }}>
              {/* 日付ヘッダー */}
              <div className="flex sticky top-0 bg-background border-b">
                <div className="w-[180px] shrink-0 px-2 py-1 text-[11px] font-semibold text-muted-foreground">プロジェクト</div>
                <div className="flex">
                  {dayList.map((d) => {
                    const dow = getDay(d); const hol = HOLIDAYS[format(d, 'yyyy-MM-dd')]
                    const red = dow === 0 || !!hol
                    return (
                      <div key={d.toISOString()} style={{ width: DAY_W }}
                        className={cn('text-center text-[9px] py-1 border-l',
                          red ? 'text-rose-500 bg-rose-50/40' : dow === 6 ? 'text-sky-500 bg-sky-50/40' : 'text-muted-foreground',
                          isToday(d) && 'bg-primary/10 font-bold')}>
                        {format(d, 'd')}
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* 行 */}
              {rows.map((r) => {
                const offset = differenceInCalendarDays(parseISO(r.min), start)
                const span = differenceInCalendarDays(parseISO(r.max), parseISO(r.min)) + 1
                const prog = progressByProject[r.projectId]
                const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0
                return (
                  <div key={r.projectId} className="flex items-center border-b hover:bg-accent/30">
                    <button type="button" onClick={() => onJumpToProject?.(r.projectId)}
                      className="w-[180px] shrink-0 px-2 py-2 text-left text-xs font-medium truncate hover:text-primary">
                      {r.title}
                    </button>
                    <div className="relative flex" style={{ width: totalDays * DAY_W, height: 32 }}>
                      {/* 今日ライン */}
                      {todayOffset >= 0 && todayOffset < totalDays && (
                        <div className="absolute top-0 bottom-0 w-px bg-primary/50" style={{ left: todayOffset * DAY_W + DAY_W / 2 }} />
                      )}
                      <button type="button" onClick={() => onJumpToProject?.(r.projectId)}
                        title={`${r.title}（${r.min}〜${r.max}）進捗${pct}%`}
                        className={cn('absolute top-1.5 h-5 rounded-full overflow-hidden border cursor-pointer',
                          dotBg[r.type] ?? 'bg-muted-foreground')}
                        style={{ left: offset * DAY_W + 2, width: Math.max(DAY_W * span - 4, 10) }}>
                        <div className="h-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      <p className="text-[11px] text-muted-foreground">予定をクリックするとそのカードに移動します。{allItems.length}件表示中。</p>
    </div>
  )
}
