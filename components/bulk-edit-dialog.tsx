'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project } from '@/lib/types'
import { useProviderLabels, COLOR_STYLES } from '@/hooks/use-provider-labels'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ListChecksIcon, CalendarIcon, PlusIcon, CheckIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = { instagram: 'Instagram', twitter: 'X', event: 'イベント' }

export function BulkEditDialog() {
  const supabase = createClient()
  const { roles } = useProviderLabels()
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  // プロジェクトごとの新規ステップ入力
  const [stepLabel, setStepLabel] = useState<Record<string, string>>({})
  const [stepDue, setStepDue] = useState<Record<string, string>>({})
  const [stepRole, setStepRole] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('projects').select('*').is('deleted_at', null)
      .order('assignee', { ascending: true }).order('title', { ascending: true })
    const list = (data as Project[]) || []
    setProjects(list)
    // ステップ数
    if (list.length) {
      const { data: steps } = await supabase.from('project_steps').select('project_id').in('project_id', list.map((p) => p.id))
      const counts: Record<string, number> = {}
      for (const s of (steps || [])) counts[s.project_id] = (counts[s.project_id] ?? 0) + 1
      setStepCounts(counts)
    }
    setLoading(false)
  }

  const flash = (id: string) => { setSavedId(id); setTimeout(() => setSavedId((v) => v === id ? null : v), 1200) }

  const setDue = async (p: Project, date: string | null) => {
    setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, due_date: date } : x))
    await supabase.from('projects').update({ due_date: date }).eq('id', p.id)
    flash(p.id)
  }

  const addStep = async (p: Project) => {
    const label = (stepLabel[p.id] ?? '').trim()
    if (!label) return
    const provider = stepRole[p.id] ?? roles[0]?.id ?? 'self'
    const order = stepCounts[p.id] ?? 0
    await supabase.from('project_steps').insert({
      project_id: p.id, step_key: 'text', step_order: order, label,
      status: '未着手', provider_type: provider, provider_name: null,
      file_urls: [], file_names: [], is_client_step: provider !== 'self',
      step_due_date: stepDue[p.id] || null,
    })
    setStepCounts((c) => ({ ...c, [p.id]: order + 1 }))
    setStepLabel((m) => ({ ...m, [p.id]: '' }))
    setStepDue((m) => ({ ...m, [p.id]: '' }))
    flash(p.id)
  }

  // コード（クライアント）ごとにグループ化
  const groups: { code: string; items: Project[] }[] = []
  for (const p of projects) {
    const code = p.assignee || '（未設定）'
    const last = groups[groups.length - 1]
    if (last && last.code === code) last.items.push(p)
    else groups.push({ code, items: [p] })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) load() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
          <ListChecksIcon className="size-3.5" />一括入力
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecksIcon className="size-4" />締切・ステップ 一括入力
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          クライアント（コード）ごとに並んでいます。納期の設定とステップ追加がその場で保存されます。
        </p>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading && <p className="text-sm text-muted-foreground text-center py-8">読み込み中...</p>}
          {!loading && projects.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">プロジェクトがありません</p>}

          {groups.map((g) => (
            <div key={g.code} className="space-y-1.5">
              <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
                <span className="text-xs font-bold">{g.code}</span>
                <span className="text-[10px] text-muted-foreground">({g.items.length}件)</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {g.items.map((p) => (
                <div key={p.id} className={cn('rounded-md border p-2.5 space-y-2 transition-colors', savedId === p.id && 'border-emerald-400 bg-emerald-50/40')}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{TYPE_LABEL[p.project_type] ?? p.project_type}</span>
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{p.title}</span>
                    {savedId === p.id && <CheckIcon className="size-3.5 text-emerald-500 shrink-0" />}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 納期 */}
                    <span className="text-[11px] text-muted-foreground">納期</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className={cn('h-7 text-xs gap-1', !p.due_date && 'text-muted-foreground')}>
                          <CalendarIcon className="size-3" />{p.due_date ? format(new Date(p.due_date), 'M/d', { locale: ja }) : '設定なし'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" locale={ja}
                          selected={p.due_date ? new Date(p.due_date) : undefined}
                          onSelect={(d) => setDue(p, d ? format(d, 'yyyy-MM-dd') : null)} />
                        {p.due_date && <div className="p-2 border-t"><Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground" onClick={() => setDue(p, null)}>クリア</Button></div>}
                      </PopoverContent>
                    </Popover>
                    <span className="text-[10px] text-muted-foreground">ステップ {stepCounts[p.id] ?? 0}件</span>
                  </div>

                  {/* ステップ追加 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Input value={stepLabel[p.id] ?? ''} placeholder="ステップ名を追加"
                      onChange={(e) => setStepLabel((m) => ({ ...m, [p.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addStep(p)}
                      className="h-7 text-xs flex-1 min-w-[120px]" />
                    {/* 担当 */}
                    <select value={stepRole[p.id] ?? roles[0]?.id ?? 'self'}
                      onChange={(e) => setStepRole((m) => ({ ...m, [p.id]: e.target.value }))}
                      className="h-7 text-xs border rounded px-1 bg-background">
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    {/* ステップ締切 */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className={cn('h-7 text-xs gap-1', !stepDue[p.id] && 'text-muted-foreground')}>
                          <CalendarIcon className="size-3" />{stepDue[p.id] ? format(new Date(stepDue[p.id]), 'M/d', { locale: ja }) : '締切'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="single" locale={ja}
                          selected={stepDue[p.id] ? new Date(stepDue[p.id]) : undefined}
                          onSelect={(d) => setStepDue((m) => ({ ...m, [p.id]: d ? format(d, 'yyyy-MM-dd') : '' }))} />
                      </PopoverContent>
                    </Popover>
                    <Button type="button" size="sm" className="h-7 text-xs px-2 gap-0.5" disabled={!(stepLabel[p.id] ?? '').trim()} onClick={() => addStep(p)}>
                      <PlusIcon className="size-3" />追加
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <Button className="w-full" onClick={() => setOpen(false)}>完了</Button>
      </DialogContent>
    </Dialog>
  )
}
