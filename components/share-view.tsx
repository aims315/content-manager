'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project, ProjectStep } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  InstagramIcon, TwitterIcon, CalendarDaysIcon, MegaphoneIcon, LightbulbIcon,
  CalendarIcon, LinkIcon, FileIcon, CheckCircle2Icon, ClockIcon, ExternalLinkIcon,
  ChevronUpIcon, ChevronDownIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  instagram: { label: 'Instagram', icon: <InstagramIcon className="size-4" />, color: 'text-pink-600' },
  twitter:   { label: 'X / Twitter', icon: <TwitterIcon className="size-4" />, color: 'text-sky-600' },
  event:     { label: 'イベント', icon: <CalendarDaysIcon className="size-4" />, color: 'text-violet-600' },
}

function typeOf(t: string) {
  return typeConfig[t] ?? { label: t, icon: <LightbulbIcon className="size-4" />, color: 'text-amber-600' }
}

interface ShareViewProps {
  code: string
}

export function ShareView({ code }: ShareViewProps) {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [steps, setSteps] = useState<Record<string, ProjectStep[]>>({})
  const [loading, setLoading] = useState(true)
  const [scheduleOpen, setScheduleOpen] = useState(true)

  useEffect(() => {
    const run = async () => {
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('assignee', code)
        .is('deleted_at', null)
        .order('due_date', { ascending: true })

      if (!projectData || projectData.length === 0) {
        setProjects([]); setLoading(false); return
      }
      setProjects(projectData)

      const ids = projectData.map((p: Project) => p.id)
      const { data: stepData } = await supabase
        .from('project_steps')
        .select('*')
        .in('project_id', ids)
        .order('step_order', { ascending: true })

      const grouped: Record<string, ProjectStep[]> = {}
      for (const s of (stepData || [])) {
        if (!grouped[s.project_id]) grouped[s.project_id] = []
        grouped[s.project_id].push(s)
      }
      setSteps(grouped); setLoading(false)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">プロジェクトが見つかりません</p>
          <p className="text-sm text-muted-foreground">コード「{code}」のプロジェクトはありません</p>
        </div>
      </div>
    )
  }

  // 予定（締切）一覧：プロジェクト納期とステップ期日をまとめて昇順
  const scheduleItems: { date: string; title: string; sub: string }[] = []
  for (const p of projects) {
    if (p.due_date) scheduleItems.push({ date: p.due_date, title: p.title, sub: '納期' })
    for (const s of (steps[p.id] || [])) {
      if (s.step_due_date) scheduleItems.push({ date: s.step_due_date, title: `${p.title}：${s.label}`, sub: 'ステップ期日' })
    }
  }
  scheduleItems.sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{code}</h1>
            <Badge variant="secondary">コード</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            納品物と予定の共有ページ（{projects.length}件のプロジェクト）
          </p>
        </div>

        {/* 予定（スケジュール） */}
        {scheduleItems.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <button type="button" onClick={() => setScheduleOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <CalendarIcon className="size-4" />予定
                  <span className="text-xs font-normal text-muted-foreground">（{scheduleItems.length}件）</span>
                </CardTitle>
                {scheduleOpen ? <ChevronUpIcon className="size-4 text-muted-foreground" /> : <ChevronDownIcon className="size-4 text-muted-foreground" />}
              </button>
            </CardHeader>
            {scheduleOpen && (
            <CardContent className="space-y-1.5">
              {scheduleItems.map((it, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="font-medium tabular-nums w-14 shrink-0 text-muted-foreground">
                    {format(new Date(it.date), 'M/d', { locale: ja })}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{it.title}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{it.sub}</Badge>
                </div>
              ))}
            </CardContent>
            )}
          </Card>
        )}

        {/* 納品物（プロジェクトごと） */}
        <div className="space-y-4">
          {projects.map((project) => {
            const ps = steps[project.id] || []
            const tc = typeOf(project.project_type)
            const deliverables = ps.filter((s) => s.url || (s.file_urls && s.file_urls.length > 0))
            const doneCount = ps.filter((s) => s.status === '完了').length

            return (
              <Card key={project.id}>
                <CardHeader className="pb-3">
                  <div className={cn('flex items-center gap-1.5 mb-1', tc.color)}>
                    {tc.icon}
                    <span className="text-xs font-medium">{tc.label}</span>
                  </div>
                  <CardTitle className="text-base">{project.title}</CardTitle>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    {project.due_date && (
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="size-3" />納期 {format(new Date(project.due_date), 'M/d', { locale: ja })}
                      </span>
                    )}
                    <span>進捗 {doneCount}/{ps.length}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 納品物ボタン（最新のURL） */}
                  {(() => {
                    const deliverableStep = ps.find((s) => s.url)
                    if (!deliverableStep) return null
                    return (
                      <a href={deliverableStep.url!} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors">
                        <ExternalLinkIcon className="size-4" />
                        納品物を確認する
                      </a>
                    )
                  })()}
                  {/* ステップ一覧 */}
                  <div className="space-y-1.5">
                    {ps.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-sm">
                        {s.status === '完了'
                          ? <CheckCircle2Icon className="size-3.5 text-emerald-500 shrink-0" />
                          : <ClockIcon className="size-3.5 text-muted-foreground shrink-0" />}
                        <span className="flex-1 min-w-0 truncate">{s.label}</span>
                        {s.step_due_date && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(s.step_due_date), 'M/d', { locale: ja })}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px] shrink-0">{s.status}</Badge>
                      </div>
                    ))}
                  </div>

                  {/* 納品物（URL・ファイル） */}
                  {deliverables.length > 0 && (
                    <div className="border-t pt-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">納品物</p>
                      {deliverables.map((s) => (
                        <div key={s.id} className="text-sm space-y-1">
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                          {s.url && (
                            <a href={s.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-primary hover:underline text-sm break-all">
                              <LinkIcon className="size-3 shrink-0" />{s.url}
                            </a>
                          )}
                          {(s.file_urls || []).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-primary hover:underline text-sm break-all">
                              <FileIcon className="size-3 shrink-0" />{s.file_names?.[i] || `ファイル${i + 1}`}
                            </a>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          このページは閲覧専用の共有ページです
        </p>
      </div>
    </div>
  )
}
