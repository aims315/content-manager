'use client'

import { useState, useMemo, useEffect } from 'react'
import { useProjects } from '@/hooks/use-projects'
import { useCaptions } from '@/hooks/use-captions'
import { extractUrl } from '@/lib/caption-csv'
import { useProviderLabels } from '@/hooks/use-provider-labels'
import { useStepStatuses } from '@/hooks/use-step-statuses'
import { useProjectTypes } from '@/hooks/use-project-types'
import { ProjectCard } from '@/components/project-card'
import { CaptionBulkDialog } from '@/components/caption-bulk-dialog'
import { ScheduleView } from '@/components/schedule-view'
import { TrashDialog } from '@/components/trash-dialog'
import { ProjectForm } from '@/components/project-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useDeadlineConfig } from '@/hooks/use-deadline-config'
import { useClientDisplayConfig } from '@/hooks/use-client-display-config'
import type { StepStatus, ProviderType } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { InstagramIcon, TwitterIcon, CalendarDaysIcon, SearchIcon, LayoutGridIcon, CalendarIcon, ArrowUpDownIcon, UsersIcon, LinkIcon, MessageSquareTextIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 列数 → グリッドクラス（Tailwindが拾えるよう完全な文字列で持つ）
const GRID_COLS: Record<1 | 2 | 3, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
}

const TYPE_FILTERS = [
  { value: '', label: 'すべて' },
  { value: 'instagram', label: 'Instagram', icon: <InstagramIcon className="size-3.5" /> },
  { value: 'twitter', label: 'X / Twitter', icon: <TwitterIcon className="size-3.5" /> },
  { value: 'event', label: 'イベント', icon: <CalendarDaysIcon className="size-3.5" /> },
]

export function ProjectListClient({ lockedCode }: { lockedCode?: string } = {}) {
  // ?code= は「自分用の絞り込み」。lockedCode は /c/[code] のコード限定モード。
  const [urlCode, setUrlCode] = useState<string | null>(null)
  useEffect(() => {
    if (lockedCode) { setUrlCode(lockedCode); return }
    const params = new URLSearchParams(window.location.search)
    setUrlCode(params.get('code'))
  }, [lockedCode])

  const { projects, deletedProjects, steps, loading, updateStepStatus, submitStep, deleteProject, restoreProject, permanentDeleteProject, emptyTrash, duplicateProject, updateStepProvider, updateStepDueDate, updateStepDependencies, setProjectDoneOverride, refetch } = useProjects(lockedCode)
  const { captions, saveCaption } = useCaptions()
  const { labels: providerLabels, roles: providerRoles } = useProviderLabels()
  const { statuses: statusDefs } = useStepStatuses()
  const { customTypes: customProjectTypes } = useProjectTypes()
  const { config: deadlineConfig } = useDeadlineConfig()
  const { config: clientDisplayConfig } = useClientDisplayConfig()
  // クライアントページ(lockedCode)で隠す担当ロール
  const hiddenRoles = lockedCode ? (clientDisplayConfig[lockedCode]?.hiddenRoles ?? []) : undefined
  // クライアントページでは選択肢から非表示ロールを除外
  const effectiveRoles = hiddenRoles && hiddenRoles.length
    ? providerRoles.filter((r) => !hiddenRoles.includes(r.id))
    : providerRoles
  const [typeFilter, setTypeFilter] = useState('')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'list' | 'schedule'>('list')
  const [statusTab, setStatusTab] = useState<'active' | 'done' | 'all'>('active')
  const [sortOrder, setSortOrder] = useState<'created' | 'due' | 'code' | 'caption'>('created')
  const [cols, setCols] = useState<1 | 2 | 3>(3)

  // 並び替え・種別フィルター・列数をローカルに保持（リロードしても維持）
  const stateKey = `cm_list_${lockedCode ?? 'main'}`
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(stateKey) || '{}')
      if (saved.sortOrder) setSortOrder(saved.sortOrder)
      if (saved.typeFilter !== undefined) setTypeFilter(saved.typeFilter)
      if (saved.statusTab) setStatusTab(saved.statusTab)
      if (saved.cols === 1 || saved.cols === 2 || saved.cols === 3) setCols(saved.cols)
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    try { localStorage.setItem(stateKey, JSON.stringify({ sortOrder, typeFilter, statusTab, cols })) } catch { /* ignore */ }
  }, [sortOrder, typeFilter, statusTab, cols, stateKey])
  const [codeFilter, setCodeFilter] = useState(urlCode ?? '')
  const [copiedLink, setCopiedLink] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // スケジュールからカードへジャンプ
  const jumpToProject = (projectId: string) => {
    setView('list')
    setStatusTab('all')
    setSortOrder('created')
    setHighlightId(projectId)
    setTimeout(() => {
      document.getElementById(`project-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => setHighlightId(null), 2500)
    }, 120)
  }

  const findProjectId = (stepId: string) =>
    Object.keys(steps).find((pid) => steps[pid].some((s) => s.id === stepId))

  // ステータス更新の完了判定ラベル（自動ロック解除用）
  const doneLabels = statusDefs.filter((s) => s.isDone).map((s) => s.label)

  // プロジェクトが「完了」かどうか
  //  手動指定(done_override)があればそれを優先。なければ自動判定。
  const isProjectDone = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (project && project.done_override != null) return project.done_override
    const ps = steps[projectId]
    if (!ps || ps.length === 0) return false
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

  // ユニークなコード一覧
  const uniqueCodes = useMemo(() =>
    [...new Set(projects.map((p) => p.assignee).filter(Boolean))].sort(),
    [projects]
  )

  // 共有リンク（/c/コード）をコピー。渡した相手はそのコードだけ編集できる。
  const copyFilterLink = () => {
    if (!codeFilter) return
    const shareUrl = `${window.location.origin}/c/${encodeURIComponent(codeFilter)}`
    navigator.clipboard.writeText(shareUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  // 検索・種別・コードフィルター適用後のプロジェクト
  // urlCode（?code= または lockedCode）がある時はそのコードに完全一致で限定。
  // 無い時は手動のcodeFilter（部分一致）を適用。
  const baseFiltered = projects
    .filter((p) => !typeFilter || p.project_type === typeFilter)
    .filter((p) => urlCode ? p.assignee === urlCode : (!codeFilter || p.assignee?.includes(codeFilter)))
    .filter((p) => !query.trim() || p.title.includes(query) || p.assignee?.includes(query) || p.client_slug?.includes(query))

  // キャプション状態のランク（小さいほど上）：要キャプション → 候補あり → 対象外
  const captionRank = (projectId: string) => {
    const hasCaption = (captions[projectId]?.candidates?.length ?? 0) > 0
    if (hasCaption) return 1
    const project = projects.find((p) => p.id === projectId)
    const hasDeliveryUrl = !!extractUrl(project?.description) ||
      (steps[projectId] ?? []).some((s) => (s.url && s.url.trim()) || (s.file_urls && s.file_urls.length > 0))
    return hasDeliveryUrl ? 0 : 2  // 納品URLあり＆候補なし＝要キャプション（最上位）
  }

  // ソート
  const sortProjects = (list: typeof projects) => [...list].sort((a, b) => {
    if (sortOrder === 'due') {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    }
    if (sortOrder === 'code') {
      return (a.assignee ?? '').localeCompare(b.assignee ?? '', 'ja')
    }
    if (sortOrder === 'caption') {
      const ra = captionRank(a.id), rb = captionRank(b.id)
      if (ra !== rb) return ra - rb
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    }
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  })

  // 進行中 / 完了 に分類
  const activeProjects = sortProjects(baseFiltered.filter((p) => !isProjectDone(p.id)))
  const doneProjects   = sortProjects(baseFiltered.filter((p) => isProjectDone(p.id)))
  const filtered = statusTab === 'active' ? activeProjects : statusTab === 'done' ? doneProjects : sortProjects(baseFiltered)

  // コード順の時はグループ表示
  const groupedByCode = useMemo(() => {
    if (sortOrder !== 'code') return null
    const groups: Record<string, typeof filtered> = {}
    for (const p of filtered) {
      const key = p.assignee ?? '（未設定）'
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    }
    return groups
  }, [sortOrder, filtered])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* コード限定ページ：クライアントも新規作成できる */}
      {lockedCode && (
        <div className="flex justify-end">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">＋ 新規プロジェクト</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>新規プロジェクト</DialogTitle>
              </DialogHeader>
              <ProjectForm lockedCode={lockedCode} onCreated={() => { setCreateOpen(false); refetch() }} />
            </DialogContent>
          </Dialog>
        </div>
      )}

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
          {/* ソート */}
          <div className="flex rounded-md border overflow-hidden">
            <button onClick={() => setSortOrder('created')}
              title="登録順"
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors', sortOrder === 'created' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <ArrowUpDownIcon className="size-3.5" />
              <span className="hidden sm:inline">登録順</span>
            </button>
            <button onClick={() => setSortOrder('due')}
              title="締切順"
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-l', sortOrder === 'due' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <CalendarIcon className="size-3.5" />
              <span className="hidden sm:inline">締切順</span>
            </button>
            <button onClick={() => setSortOrder('code')}
              title="コード順"
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-l', sortOrder === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <UsersIcon className="size-3.5" />
              <span className="hidden sm:inline">コード順</span>
            </button>
            <button onClick={() => setSortOrder('caption')}
              title="キャプション順（要キャプション→候補ありの順）"
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-l', sortOrder === 'caption' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <MessageSquareTextIcon className="size-3.5" />
              <span className="hidden sm:inline">キャプション順</span>
            </button>
          </div>

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

          {/* 列数切替（制作管理ビューのみ） */}
          {view === 'list' && (
            <div className="flex rounded-md border overflow-hidden ml-1">
              {([1, 2, 3] as const).map((n) => (
                <button key={n} onClick={() => setCols(n)}
                  title={`${n}列で表示`}
                  className={cn('flex items-center px-2.5 py-1.5 text-xs transition-colors', n > 1 && 'border-l',
                    cols === n ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                  {n}列
                </button>
              ))}
            </div>
          )}

          {!lockedCode && (
            <div className="ml-1">
              <CaptionBulkDialog projects={projects} captions={captions} onSave={saveCaption} />
            </div>
          )}

          {!lockedCode && (
            <div className="ml-1">
              <TrashDialog
                deletedProjects={deletedProjects}
                onRestore={restoreProject}
                onPermanentDelete={permanentDeleteProject}
                onEmptyTrash={emptyTrash}
              />
            </div>
          )}
        </div>
      </div>

      {/* URLコードフィルター中のバナー */}
      {urlCode && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-primary">
          <UsersIcon className="size-4 shrink-0" />
          <span><span className="font-medium">{urlCode}</span> のプロジェクトのみ表示中</span>
        </div>
      )}

      {/* コードフィルター */}
      {!urlCode && (
        <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
          <span className="text-xs text-muted-foreground shrink-0">コード:</span>
          <button onClick={() => setCodeFilter('')}
            className={cn('text-xs px-2.5 py-1 rounded-full border transition-all',
              !codeFilter ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-muted-foreground'
            )}>すべて</button>
          {uniqueCodes.map((code) => (
            <button key={code} onClick={() => setCodeFilter(codeFilter === code ? '' : code)}
              className={cn('text-xs px-2.5 py-1 rounded-full border transition-all',
                codeFilter === code ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-muted-foreground'
              )}>{code}</button>
          ))}
          {codeFilter && (
            <button onClick={copyFilterLink}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors ml-1">
              <LinkIcon className="size-3" />
              {copiedLink ? 'コピーしました！' : 'リンクをコピー'}
            </button>
          )}
        </div>
      )}

      {/* スケジュールビュー */}
      {view === 'schedule' && (
        <ScheduleView projects={filtered} allSteps={steps} warningDays={deadlineConfig.warningDays}
          progressByProject={Object.fromEntries(filtered.map((p) => {
            const ps = steps[p.id] ?? []
            return [p.id, { done: ps.filter((s) => doneLabels.includes(s.status)).length, total: ps.length }]
          }))}
          onJumpToProject={jumpToProject} />
      )}

      {/* 制作管理ビュー */}
      {view !== 'schedule' && (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-sm">
              {statusTab === 'done' ? '完了したプロジェクトはありません' : statusTab === 'all' ? 'プロジェクトがありません' : '進行中のプロジェクトはありません'}
            </p>
            {statusTab === 'active' && lockedCode && (
              <Button size="sm" className="mt-3 gap-1.5" onClick={() => setCreateOpen(true)}>＋ 新規プロジェクトを作成</Button>
            )}
            {statusTab === 'active' && !lockedCode && (
              <p className="text-xs mt-1">右上の「新規プロジェクト」から作成してください</p>
            )}
          </div>
        ) : groupedByCode ? (
          // コード順：グループ表示
          <div className="space-y-6">
            {Object.entries(groupedByCode).map(([code, list]) => (
              <div key={code}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-muted-foreground">{code}</span>
                  <span className="text-xs text-muted-foreground">({list.length}件)</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className={cn('grid gap-4 items-stretch', GRID_COLS[cols])}>
                  {list.map((project) => (
                    <div key={project.id} id={`project-${project.id}`} className="h-full">
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
                        isDone={isProjectDone(project.id)}
                        onSetDone={(v) => setProjectDoneOverride(project.id, v)}
                        warningDays={deadlineConfig.warningDays}
                        hiddenRoles={hiddenRoles}
                        providerLabels={providerLabels}
                        providerRoles={effectiveRoles}
                        statusDefs={statusDefs}
                        customProjectTypes={customProjectTypes}
                        clientMode={!!lockedCode}
                        caption={captions[project.id]}
                        actorName={lockedCode ?? '社内'}
                        onSaveCaption={saveCaption}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn('grid gap-4 items-stretch', GRID_COLS[cols])}>
            {filtered.map((project) => (
              <div key={project.id} id={`project-${project.id}`}
                className={cn('rounded-lg transition-all h-full', highlightId === project.id && 'ring-2 ring-primary ring-offset-2')}>
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
                  isDone={isProjectDone(project.id)}
                  onSetDone={(v) => setProjectDoneOverride(project.id, v)}
                  warningDays={deadlineConfig.warningDays}
                  hiddenRoles={hiddenRoles}
                  providerLabels={providerLabels}
                  providerRoles={effectiveRoles}
                  statusDefs={statusDefs}
                  customProjectTypes={customProjectTypes}
                  clientMode={!!lockedCode}
                  caption={captions[project.id]}
                  actorName={lockedCode ?? '社内'}
                  onSaveCaption={saveCaption}
                />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
