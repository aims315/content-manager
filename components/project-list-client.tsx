'use client'

import { useState } from 'react'
import { useProjects } from '@/hooks/use-projects'
import { ProjectCard } from '@/components/project-card'
import type { StepStatus } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { InstagramIcon, TwitterIcon, CalendarDaysIcon, SearchIcon } from 'lucide-react'
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
  const { projects, steps, loading, updateStepStatus, submitStep, deleteProject } = useProjects()
  const [typeFilter, setTypeFilter] = useState('')
  const [query, setQuery] = useState('')

  const handleStepStatusChange = async (stepId: string, status: StepStatus) => {
    await updateStepStatus(stepId, status)
  }

  const handleStepSubmit = async (stepId: string, data: { url?: string; note?: string; fileUrls?: string[]; fileNames?: string[] }) => {
    // find project for this step
    const projectId = Object.keys(steps).find((pid) =>
      steps[pid].some((s) => s.id === stepId)
    )
    if (!projectId) return
    await submitStep(stepId, projectId, {
      url: data.url,
      note: data.note,
      fileUrls: data.fileUrls,
      fileNames: data.fileNames,
    })
  }

  const filtered = projects
    .filter((p) => !typeFilter || p.project_type === typeFilter)
    .filter((p) => !query.trim() || p.title.includes(query) || p.assignee.includes(query) || p.client_slug?.includes(query))

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル・クライアント名で検索"
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={typeFilter === f.value ? 'default' : 'outline'}
              className="h-9 gap-1.5 text-xs"
              onClick={() => setTypeFilter(f.value)}
            >
              {f.icon}
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-sm">プロジェクトがありません</p>
          <p className="text-xs mt-1">右上の「新規プロジェクト」から作成してください</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              steps={steps[project.id] || []}
              onStepStatusChange={handleStepStatusChange}
              onStepSubmit={handleStepSubmit}
              onDelete={deleteProject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
