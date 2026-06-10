'use client'

import { useState } from 'react'
import { useProjects } from '@/hooks/use-projects'
import { useProviderLabels } from '@/hooks/use-provider-labels'
import { useStepStatuses } from '@/hooks/use-step-statuses'
import { useProjectTypes } from '@/hooks/use-project-types'
import { ProjectCard } from '@/components/project-card'
import { ScheduleView } from '@/components/schedule-view'
import type { StepStatus, ProviderType } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { InstagramIcon, TwitterIcon, CalendarDaysIcon, SearchIcon, LayoutGridIcon, CalendarIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TYPE_FILTERS = [
  { value: '', label: 'すべて' },
  { value: 'instagram', label: 'Instagram', icon: <InstagramIcon className="size-3.5" /> },
  { value: 'twitter', label: 'X / Twitter', icon: <TwitterIcon className="size-3.5" /> },
  { value: 'event', label: 'イベント', icon: <CalendarDaysIcon className="size-3.5" /> },
]

export function ProjectListClient() {
  const { projects, steps, loading, updateStepStatus, submitStep, deleteProject, duplicateProject, updateStepProvider, updateStepDueDate, updateStepDependencies, refetch } = useProjects()
  const { labels: providerLabels, roles: providerRoles } = useProviderLabels()
  const { statuses: statusDefs } = useStepStatuses()
  const { customTypes: customProjectTypes } = useProjectTypes()
  const [typeFilter, setTypeFilter] = useState('')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'list' | 'schedule'>('list')
  const [statusTab, setStatusTab] = useState<'active' | 'done' | 'all'>('active')
  const [highlightId] = useState<string | null>(null)

  const findProjectId = (stepId: string) =>
    Object.keys(steps).find((pid) => steps[pid].some((s) => s.id === stepId))

  // ステータス更新の完了判定ラベル（自動ロック解除用）
  const doneLabels = statusDefs.filter((s) => s.isDone).map((s) => s.label)

  // プロジェクトが「完了」かどうか：ステップが1つ以上あり、全ステップが isDone:true のステータス
  const isProjectDone = (projectId: string) => {
    const ps = steps[projectId]
    if (!ps || ps.length === 0) return false
    // ステップが1件も isDone でないものがなければ完了
    return ps.length > 0 && ps.every((s) => doneLabels.includes(s.status))
  }

  const handleStepStatusChange = async (stepId: string, status: StepStatus) => {
    const projectId = findProjectId(stepId)
    const project = projects.find((p) => p.id === projectId)
    const step = projectId ? steps[projectId]?.find((s) => s.id === stepId) : undefined
    await updateStepStatus(stepId, status, {
      projectTitle: project?.title,
      stepLabel: step?.label,
    }, projectId, doneLabels)
  }

  const handleStepSubmit = async (stepId: string, data: { url?: string; note?: string; fileUrls?: string[]; fileNames?: string[] }) => {
    const projectId = findProjectId(stepId)
    if (!projectId) return
    await submitStep(stepId, projectId, { url: data.url, note: data.note, fileUrls: data.fileUrls, fileNames: data.fileNames })
  }

  const handleStepProviderChange = async (stepId: string, providerType: ProviderType, providerName: string | null) => {
    const projectId = findProjectId(stepId)
    if (!projectId) return
    await updateStepProvider(stepId, projectId, providerType, providerName)
  }

  const handleStepDueDateChange = async (stepId: string, dueDate: string | null) => {
    const projectId = findProjectId(stepId)
    if (!projectId) return
    await updateStepDueDate(stepId, projectId, dueDate)
  }

  const handleStepDependenciesChange = async (stepId: string, dependsOn: string[]) => {
    const projectId = findProjectId(stepId)
    if (!projectId) return
    await updateStepDependencies(stepId, projectId, dependsOn)
  }

  // 検索・種別フィルター適用後のプロジェクト
  const baseFiltered = projects
    .filter((p) => !typeFilter || p.project_type === typeFilter)
    .filter((p) => !query.trim() || p.title.includes(query) || p.assignee.includes(query) || p.client_slug?.includes(query))

  // 進行中 / 完了 に分類
  const activeProjects = baseFiltered.filter((p) => !isProjectDone(p.id))
  const doneProjects   = baseFiltered.filter((p) => isProjectDone(p.id))
  const filtered = statusTab === 'active' ? activeProjects : statusTab === 'done' ? doneProjects : baseFiltered

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── 進行中 / 完了 タブ ── */}
      <div className="flex items-center gap-4 border-b pb-0">
        <button
          onClick={() => setStatusTab('active')}
          className={cn(
            'pb-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            statusTab === 'active'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          進行中
          <span className={cn(
            'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
            statusTab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            {activeProjects.length}
          </span>
        </button>
        <button
          onClick={() => setStatusTab('done')}
          className={cn(
            'pb-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            statusTab === 'done'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          完了
          <span className={cn(
            'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
            statusTab === 'done' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            {doneProjects.length}
          </span>
        </button>
        <button
          onClick={() => setStatusTab('all')}
          className={cn(
            'pb-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            statusTab === 'all'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          すべて
          <span className={cn(
            'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
            statusTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            {baseFiltered.length}
          </span>
        </button>
      </div>

      {/* ── 検索・フィルター・ビュー切替 ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル・コードで検索" className="pl-9 h-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <Button key={f.value} size="sm"
              variant={typeFilter === f.value ? 'default' : 'outline'}
              className="h-9 gap-1.5 text-xs"
              onClick={() => setTypeFilter(f.value)}>
              {f.icon}{f.label}
            </Button>
          ))}
          {customProjectTypes.map((t) => (
            <Button key={t.id} size="sm"
              variant={typeFilter === t.id ? 'default' : 'outline'}
              className="h-9 gap-1 text-xs"
              onClick={() => setTypeFilter(typeFilter === t.id ? '' : t.id)}>
              <span>{t.emoji}</span>{t.label}
            </Button>
          ))}
          <div className="flex rounded-md border overflow-hidden ml-1">
            <button onClick={() => setView('list')}
              title="制作管理"
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <LayoutGridIcon className="size-3.5" />
              <span className="hidden sm:inline">制作管理</span>
            </button>
            <button onClick={() => setView('schedule')}
              title="投稿スケジュール"
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-l', view === 'schedule' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <CalendarIcon className="size-3.5" />
              <span className="hidden sm:inline">スケジュール</span>
            </button>
          </div>
        </div>
      </div>

      {/* スケジュールビュー */}
      {view === 'schedule' && (
        <ScheduleView projects={filtered} allSteps={steps} />
      )}

      {/* 制作管理ビュー */}
      {view !== 'schedule' && (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-sm">
              {statusTab === 'done' ? '完了したプロジェクトはありません' : statusTab === 'all' ? 'プロジェクトがありません' : '進行中のプロジェクトはありません'}
            </p>
            {statusTab === 'active' && (
              <p className="text-xs mt-1">右上の「新規プロジェクト」から作成してください</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <div key={project.id} id={`project-${project.id}`}
                className={cn('rounded-lg transition-all', highlightId === project.id && 'ring-2 ring-primary ring-offset-2')}>
                <ProjectCard
                  project={project}
                  steps={steps[project.id] || []}
                  onProjectUpdated={refetch}
                  onStepStatusChange={handleStepStatusChange}
                  onStepSubmit={handleStepSubmit}
                  onStepProviderChange={handleStepProviderChange}
                  onStepDueDateChange={handleStepDueDateChange}
                  onStepDependenciesChange={handleStepDependenciesChange}
                  onDuplicate={duplicateProject}
                  onDelete={deleteProject}
                  providerLabels={providerLabels}
                  providerRoles={providerRoles}
                  statusDefs={statusDefs}
                  customProjectTypes={customProjectTypes}
                />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
