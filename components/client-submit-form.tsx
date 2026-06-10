'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileUpload } from '@/components/file-upload'
import { useFileUpload } from '@/hooks/use-file-upload'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  CheckCircleIcon,
  SendIcon,
  FileIcon,
  DownloadIcon,
  ExternalLinkIcon,
  InstagramIcon,
  TwitterIcon,
  CalendarDaysIcon,
  LockIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project, ProjectStep, StepStatus } from '@/lib/types'

function downloadFile(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function getFilename(url: string, names?: string[], index?: number) {
  if (names && index !== undefined && names[index]) return names[index]
  const raw = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '')
  return raw || 'ファイル'
}

function TextWithLinks({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return (
    <span>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="underline break-all hover:opacity-80">{part}</a>
        ) : part
      )}
    </span>
  )
}

const projectTypeConfig = {
  instagram: { label: 'Instagram投稿', icon: <InstagramIcon className="size-4" /> },
  twitter: { label: 'X（Twitter）投稿', icon: <TwitterIcon className="size-4" /> },
  event: { label: 'イベント制作', icon: <CalendarDaysIcon className="size-4" /> },
}

const stepStatusColors: Record<StepStatus, string> = {
  '未着手': 'bg-muted text-muted-foreground',
  'ロック中': 'bg-slate-100 text-slate-400',
  '素材待ち': 'bg-amber-100 text-amber-800',
  '素材受領': 'bg-yellow-100 text-yellow-800',
  '進行中': 'bg-blue-100 text-blue-800',
  '確認待ち': 'bg-violet-100 text-violet-800',
  '完了': 'bg-emerald-100 text-emerald-800',
}

interface StepSubmitProps {
  step: ProjectStep
  project: Project
  onSubmitted: () => void
}

function ClientStepSubmit({ step, project, onSubmitted }: StepSubmitProps) {
  const supabase = createClient()
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const files = useFileUpload()

  const hasContent = step.url || step.note || (step.file_urls?.length > 0)

  const handleSubmit = async () => {
    if (!url.trim() && !note.trim() && files.uploadedFiles.length === 0) {
      setError('URLかファイルか備考のいずれかを入力してください')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const { error: err } = await supabase
        .from('project_steps')
        .update({
          url: url.trim() || null,
          note: note.trim() || null,
          file_urls: files.uploadedFiles.map((f) => f.url),
          file_names: files.uploadedFiles.map((f) => f.name),
          submitted_at: new Date().toISOString(),
          status: '素材受領',
        })
        .eq('id', step.id)
      if (err) throw new Error(err.message)
      setSuccess(true)
      setUrl('')
      setNote('')
      files.reset()
      onSubmitted()
      setTimeout(() => setSuccess(false), 5000)
    } catch (e) {
      setError(`エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* 提出済み表示 */}
      {hasContent && (
        <div className="rounded-md border bg-emerald-50 border-emerald-200 p-3 space-y-1.5">
          <p className="text-xs font-medium text-emerald-700 flex items-center gap-1">
            <CheckCircleIcon className="size-3" /> 提出済み
            {step.submitted_at && (
              <span className="font-normal text-muted-foreground ml-1">
                （{format(new Date(step.submitted_at), 'M/d HH:mm', { locale: ja })}）
              </span>
            )}
          </p>
          {step.url && (
            <a href={step.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline">
              <ExternalLinkIcon className="size-3" /> 提出データを見る
            </a>
          )}
          {step.note && <p className="text-xs text-emerald-700"><TextWithLinks text={step.note} /></p>}
          {step.file_urls?.map((u, i) => (
            <div key={i} className="flex items-center gap-2 rounded bg-emerald-100 px-2 py-1">
              <FileIcon className="size-3 shrink-0 text-emerald-500" />
              <span className="flex-1 truncate text-xs text-emerald-700">{getFilename(u, step.file_names, i)}</span>
              <Button type="button" variant="ghost" size="icon" className="size-5" onClick={() => downloadFile(u)}>
                <DownloadIcon className="size-3 text-emerald-600" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 提出フォーム */}
      <div className="space-y-3 rounded-md border p-3">
        <p className="text-xs font-medium">{hasContent ? '素材を差し替える' : '素材を提出する'}</p>
        {success && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-2 rounded">
            <CheckCircleIcon className="size-3" /> 提出しました！ありがとうございます。
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div>
          <Label className="text-xs">データのURL（Googleドライブ・Dropboxなど）</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/..." className="h-8 text-xs mt-1" />
        </div>
        <div>
          <Label className="text-xs">備考・説明</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="補足があれば入力（任意）" rows={2} className="text-xs resize-none mt-1" />
        </div>
        <FileUpload
          uploadedFiles={files.uploadedFiles}
          isUploading={files.isUploading}
          uploadError={files.uploadError}
          onUpload={files.uploadFiles}
          onRemove={files.removeFile}
        />
        <Button size="sm" className="w-full h-9"
          onClick={handleSubmit}
          disabled={submitting || files.isUploading}>
          <SendIcon className="size-3.5 mr-1.5" />
          {submitting ? '送信中...' : '提出する'}
        </Button>
      </div>
    </div>
  )
}

interface ClientSubmitFormProps {
  clientSlug: string
}

export function ClientSubmitForm({ clientSlug }: ClientSubmitFormProps) {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [steps, setSteps] = useState<Record<string, ProjectStep[]>>({})
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const { data: projectData } = await supabase
      .from('projects')
      .select('*')
      .eq('client_slug', clientSlug)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (!projectData || projectData.length === 0) {
      setProjects([])
      setLoading(false)
      return
    }

    setProjects(projectData)

    const projectIds = projectData.map((p: Project) => p.id)
    const { data: stepData } = await supabase
      .from('project_steps')
      .select('*')
      .in('project_id', projectIds)
      .order('step_order', { ascending: true })

    const grouped: Record<string, ProjectStep[]> = {}
    for (const step of (stepData || [])) {
      if (!grouped[step.project_id]) grouped[step.project_id] = []
      grouped[step.project_id].push(step)
    }
    setSteps(grouped)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSlug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">プロジェクトが見つかりません</p>
          <p className="text-sm text-muted-foreground">URLをご確認ください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">素材提出</h1>
          <p className="text-sm text-muted-foreground mt-1">
            制作に必要な素材をご提出ください
          </p>
        </div>

        <div className="space-y-6">
          {projects.map((project) => {
            const projectSteps = steps[project.id] || []
            const clientSteps = projectSteps.filter((s) => s.is_client_step)
            const typeConfig = projectTypeConfig[project.project_type]

            if (clientSteps.length === 0) return null

            return (
              <Card key={project.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    {typeConfig.icon}
                    <span className="text-sm">{typeConfig.label}</span>
                  </div>
                  <CardTitle className="text-base">{project.title}</CardTitle>
                  {project.due_date && (
                    <p className="text-xs text-muted-foreground">
                      納期: {format(new Date(project.due_date), 'yyyy/MM/dd', { locale: ja })}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.description && (
                    <p className="text-sm text-muted-foreground">
                      <TextWithLinks text={project.description} />
                    </p>
                  )}
                  {clientSteps.map((step) => {
                    const isLocked = step.status === 'ロック中'
                    return (
                      <div key={step.id} className={cn('rounded-md border p-3 space-y-2', isLocked && 'opacity-60')}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isLocked
                              ? <LockIcon className="size-3.5 text-muted-foreground" />
                              : step.status === '完了' || step.status === '素材受領'
                              ? <CheckCircleIcon className="size-3.5 text-emerald-500" />
                              : <div className="size-3.5 rounded-full border-2 border-amber-400" />
                            }
                            <p className="text-sm font-medium">{step.label}</p>
                          </div>
                          <Badge className={cn(stepStatusColors[step.status], 'text-xs')} variant="secondary">
                            {step.status}
                          </Badge>
                        </div>
                        {isLocked ? (
                          <p className="text-xs text-muted-foreground pl-5">
                            前のステップが完了するとご提出いただけます
                          </p>
                        ) : step.status === '完了' ? (
                          <p className="text-xs text-emerald-600 pl-5 flex items-center gap-1">
                            <CheckCircleIcon className="size-3" /> このステップは完了しました
                          </p>
                        ) : (
                          <div className="pl-0">
                            <ClientStepSubmit step={step} project={project} onSubmitted={fetchData} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
