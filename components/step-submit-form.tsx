'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
} from 'lucide-react'
import type { Project, ProjectStep } from '@/lib/types'

function TextWithLinks({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/)
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="underline break-all hover:opacity-80">{part}</a>
        ) : part
      )}
    </span>
  )
}

function downloadFile(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function getFilename(url: string, names?: string[], index?: number) {
  if (names && index !== undefined && names[index]) return names[index]
  const raw = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '')
  return raw || 'ファイル'
}

const projectTypeLabel: Record<string, { label: string; icon: React.ReactNode }> = {
  instagram: { label: 'Instagram投稿', icon: <InstagramIcon className="size-4" /> },
  twitter: { label: 'X（Twitter）投稿', icon: <TwitterIcon className="size-4" /> },
  event: { label: 'イベント制作', icon: <CalendarDaysIcon className="size-4" /> },
}

interface Props {
  stepId: string
}

export function StepSubmitForm({ stepId }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState<ProjectStep | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const files = useFileUpload()

  useEffect(() => {
    async function load() {
      const { data: stepData, error: stepErr } = await supabase
        .from('project_steps')
        .select('*')
        .eq('id', stepId)
        .single()

      if (stepErr || !stepData) { setNotFound(true); setLoading(false); return }
      setStep(stepData as ProjectStep)

      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', stepData.project_id)
        .is('deleted_at', null)
        .single()

      if (!projectData) { setNotFound(true); setLoading(false); return }
      setProject(projectData as Project)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId])

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
          submitted_by: submitterName.trim() || null,
          submitted_at: new Date().toISOString(),
          status: '素材受領',
        })
        .eq('id', stepId)
      if (err) throw new Error(err.message)
      setSuccess(true)
      setStep((prev) => prev ? {
        ...prev,
        url: url.trim() || null,
        note: note.trim() || null,
        file_urls: files.uploadedFiles.map((f) => f.url),
        file_names: files.uploadedFiles.map((f) => f.name),
        submitted_by: submitterName.trim() || null,
        submitted_at: new Date().toISOString(),
        status: '素材受領',
      } : prev)
    } catch (e) {
      setError(`エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (notFound || !step || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">ページが見つかりません</p>
          <p className="text-sm text-muted-foreground">URLをご確認ください</p>
        </div>
      </div>
    )
  }

  const typeInfo = projectTypeLabel[project.project_type] ?? { label: project.project_type, icon: null }
  const hasContent = step.url || step.note || (step.file_urls?.length > 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-10">
        {/* ヘッダー */}
        <div className="mb-6 space-y-1">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {typeInfo.icon}
            <span>{typeInfo.label}</span>
          </div>
          <h1 className="text-xl font-bold">{project.title}</h1>
          {project.due_date && (
            <p className="text-xs text-muted-foreground">
              納期: {format(new Date(project.due_date), 'yyyy/MM/dd', { locale: ja })}
            </p>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{step.label}</CardTitle>
            {project.description && (
              <p className="text-sm text-muted-foreground">
                <TextWithLinks text={project.description} />
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 提出済み表示 */}
            {hasContent && (
              <div className="rounded-md border bg-emerald-50 border-emerald-200 p-3 space-y-1.5">
                <p className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                  <CheckCircleIcon className="size-4" /> 提出済み
                  {step.submitted_at && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {format(new Date(step.submitted_at), 'M/d HH:mm', { locale: ja })}
                    </span>
                  )}
                </p>
                {step.url && (
                  <a href={step.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline">
                    <ExternalLinkIcon className="size-3.5" /> 提出データを見る
                  </a>
                )}
                {step.note && <p className="text-sm text-emerald-700"><TextWithLinks text={step.note} /></p>}
                {step.file_urls?.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 rounded bg-emerald-100 px-2 py-1.5">
                    <FileIcon className="size-3 shrink-0 text-emerald-500" />
                    <span className="flex-1 truncate text-sm text-emerald-700">{getFilename(u, step.file_names, i)}</span>
                    <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => downloadFile(u)}>
                      <DownloadIcon className="size-3.5 text-emerald-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* 提出フォーム */}
            {success ? (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-center space-y-1">
                <CheckCircleIcon className="size-8 text-emerald-500 mx-auto" />
                <p className="font-medium text-emerald-700">提出が完了しました！</p>
                <p className="text-sm text-muted-foreground">ありがとうございます。確認次第、制作を進めます。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {hasContent && (
                  <p className="text-xs text-muted-foreground font-medium">
                    素材を差し替える場合は下記から再提出できます
                  </p>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}

                <div>
                  <Label>お名前（任意）</Label>
                  <Input value={submitterName} onChange={(e) => setSubmitterName(e.target.value)}
                    placeholder="例: 田中" className="mt-1" />
                </div>
                <div>
                  <Label>データURL（Googleドライブ・Dropboxなど）</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://drive.google.com/..." className="mt-1" />
                </div>
                <div>
                  <Label>備考・説明</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="補足があれば入力（任意）" rows={3} className="resize-none mt-1" />
                </div>
                <FileUpload
                  uploadedFiles={files.uploadedFiles}
                  isUploading={files.isUploading}
                  uploadError={files.uploadError}
                  onUpload={files.uploadFiles}
                  onRemove={files.removeFile}
                />
                <Button className="w-full" onClick={handleSubmit}
                  disabled={submitting || files.isUploading}>
                  <SendIcon className="size-4 mr-2" />
                  {submitting ? '送信中...' : hasContent ? '差し替えて再提出' : '提出する'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
