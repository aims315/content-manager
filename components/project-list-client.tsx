'use client'

import { useState } from 'react'
import { useProjects } from '@/hooks/use-projects'
import { useProviderLabels } from '@/hooks/use-provider-labels'
import { useStepStatuses } from '@/hooks/use-step-statuses'
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
  const { projects, steps, loading, updateStepStatus, submitStep, deleteProject, updateStepProvider, updateStepDueDate, updateStepDependencies, refetch } = useProjects()
  const { labels: providerLabels, roles: providerRoles } = useProviderLabels()
  const { statuses: statusDefs } = useStepStatuses()
  const [typeFilter, setTypeFilter] = useState('')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'list' | 'schedule'>('list')
  const [highlightId] = useState<string | null>(null)

  const findProjectId = (stepId: string) =>
    Object.keys(steps).find((pid) => steps[pid].some((s) => s.id === stepId))

  const handleStepStatusChange = async (stepId: string, status: StepStatus) => {
    const projectId = findProjectId(stepId)
    const project = projects.find((p) => p.id === projectId)
    const step = projectId ? steps[projectId]?.find((s) => s.id === stepId) : undefined
    await updateStepStatus(stepId, status, {
      projectTitle: project?.title,
      stepLabel: step?.label,
    }, projectId)
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

  const handleProjectSelect = (_projectId: string) => {
    // スケジュールビューではハイライト不要（そのまま表示）
  }

  const filtered = projects
    .filter((p) => !typeFilter || p.project_type === typeFilter)
    .filter((p) => !query.trim() || p.title.includes(query) || p.assignee.includes(query) || p.client_slug?.includes(query))

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* フィルター＋ビュー切替 */}
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
            <p className="text-sm">プロジェクトがありません</p>
            <p className="text-xs mt-1">右上の「新規プロジェクト」から作成してください</p>
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
                  onDelete={deleteProject}
                  providerLabels={providerLabels}
                  providerRoles={providerRoles}
                  statusDefs={statusDefs}
                />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
