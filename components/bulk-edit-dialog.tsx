'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project, ProjectStep } from '@/lib/types'
import { useProviderLabels } from '@/hooks/use-provider-labels'
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
  const [code, setCode] = useState('')
  const [projectId, setProjectId] = useState('')
  const [steps, setSteps] = useState<ProjectStep[]>([])
  const [saved, setSaved] = useState(false)
  // 新規ステップ
  const [newLabel, setNewLabel] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newDue, setNewDue] = useState('')

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1000) }

  const load = async () => {
    const { data } = await supabase.from('projects').select('*').is('deleted_at', null)
      .order('assignee', { ascending: true }).order('title', { ascending: true })
    setProjects((data as Project[]) || [])
  }

  const loadSteps = async (pid: string) => {
    const { data } = await supabase.from('project_steps').select('*').eq('project_id', pid)
      .order('step_order', { ascending: true })
    setSteps((data as ProjectStep[]) || [])
  }

  useEffect(() => { if (projectId) loadSteps(projectId); else setSteps([]) /* eslint-disable-next-line */ }, [projectId])

  const codes = [...new Set(projects.map((p) => p.assignee).filter(Boolean))].sort()
  const codeProjects = projects.filter((p) => p.assignee === code)
  const project = projects.find((p) => p.id === projectId)

  const setProjectDue = async (date: string | null) => {
    if (!project) return
    setProjects((prev) => prev.map((x) => x.id === project.id ? { ...x, due_date: date } : x))
    await supabase.from('projects').update({ due_date: date }).eq('id', project.id)
    flash()
  }

  const setStepDueDate = async (stepId: string, date: string | null) => {
    setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, step_due_date: date } : s))
    await supabase.from('project_steps').update({ step_due_date: date }).eq('id', stepId)
    flash()
  }

  const addStep = async () => {
    if (!project || !newLabel.trim()) return
    const provider = newRole || roles[0]?.id || 'self'
    await supabase.from('project_steps').insert({
      project_id: project.id, step_key: 'text', step_order: steps.length, label: newLabel.trim(),
      status: '未着手', provider_type: provider, provider_name: null,
      file_urls: [], file_names: [], is_client_step: provider !== 'self', step_due_date: newDue || null,
    })
    setNewLabel(''); setNewDue('')
    await loadSteps(project.id)
    flash()
  }

  const roleLabel = (id: string) => roles.find((r) => r.id === id)?.label ?? id

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { load(); setCode(''); setProjectId('') } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
          <ListChecksIcon className="size-3.5" />一括入力
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecksIcon className="size-4" />締切・ステップ 一括入力
            {saved && <span className="text-xs text-emerald-600 flex items-center gap-0.5"><CheckIcon className="size-3" />保存しました</span>}
          </DialogTitle>
        </DialogHeader>

        {/* クライアント選択 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">クライアント（コード）</label>
          <select value={code} onChange={(e) => { setCode(e.target.value); setProjectId('') }}
            className="w-full h-9 text-sm border rounded-md px-2 bg-background">
            <option value="">選択してください</option>
            {codes.map((c) => <option key={c} value={c}>{c}（{projects.filter((p) => p.assignee === c).length}件）</option>)}
          </select>
        </div>

        {/* プロジェクト選択 */}
        {code && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium">プロジェクト</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-9 text-sm border rounded-md px-2 bg-background">
              <option value="">選択してください</option>
              {codeProjects.map((p) => <option key={p.id} value={p.id}>{TYPE_LABEL[p.project_type] ?? p.project_type}｜{p.title}</option>)}
            </select>
          </div>
        )}

        {/* 選択プロジェクトの編集 */}
        {project && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 border-t pt-3">
            {/* 全体の締切 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium w-20 shrink-0">全体の締切</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className={cn('h-8 text-xs gap-1', !project.due_date && 'text-muted-foreground')}>
                    <CalendarIcon className="size-3" />{project.due_date ? format(new Date(project.due_date), 'M/d(E)', { locale: ja }) : '設定なし'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" locale={ja} selected={project.due_date ? new Date(project.due_date) : undefined}
                    onSelect={(d) => setProjectDue(d ? format(d, 'yyyy-MM-dd') : null)} />
                  {project.due_date && <div className="p-2 border-t"><Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground" onClick={() => setProjectDue(null)}>クリア</Button></div>}
                </PopoverContent>
              </Popover>
            </div>

            {/* ステップの締切 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">各ステップの締切</p>
              {steps.length === 0 && <p className="text-xs text-muted-foreground">ステップがありません。下で追加できます。</p>}
              {steps.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                  <span className="text-xs flex-1 min-w-0 truncate">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{roleLabel(s.provider_type)}</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className={cn('h-7 text-xs gap-1 shrink-0', !s.step_due_date && 'text-muted-foreground')}>
                        <CalendarIcon className="size-3" />{s.step_due_date ? format(new Date(s.step_due_date), 'M/d', { locale: ja }) : '締切'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar mode="single" locale={ja} selected={s.step_due_date ? new Date(s.step_due_date) : undefined}
                        onSelect={(d) => setStepDueDate(s.id, d ? format(d, 'yyyy-MM-dd') : null)} />
                      {s.step_due_date && <div className="p-2 border-t"><Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground" onClick={() => setStepDueDate(s.id, null)}>クリア</Button></div>}
                    </PopoverContent>
                  </Popover>
                </div>
              ))}
            </div>

            {/* ステップ追加 */}
            <div className="rounded-md border border-dashed p-2.5 space-y-2 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">ステップを追加</p>
              <Input value={newLabel} placeholder="ステップ名（例: 原稿確認）" className="h-8 text-xs"
                onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addStep()} />
              <div className="flex items-center gap-1.5 flex-wrap">
                <select value={newRole || roles[0]?.id || 'self'} onChange={(e) => setNewRole(e.target.value)}
                  className="h-7 text-xs border rounded px-1 bg-background">
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className={cn('h-7 text-xs gap-1', !newDue && 'text-muted-foreground')}>
                      <CalendarIcon className="size-3" />{newDue ? format(new Date(newDue), 'M/d', { locale: ja }) : '締切'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" locale={ja} selected={newDue ? new Date(newDue) : undefined}
                      onSelect={(d) => setNewDue(d ? format(d, 'yyyy-MM-dd') : '')} />
                  </PopoverContent>
                </Popover>
                <Button type="button" size="sm" className="h-7 text-xs px-2 gap-0.5 ml-auto" disabled={!newLabel.trim()} onClick={addStep}>
                  <PlusIcon className="size-3" />追加
                </Button>
              </div>
            </div>
          </div>
        )}

        <Button className="w-full" onClick={() => setOpen(false)}>完了</Button>
      </DialogContent>
    </Dialog>
  )
}
