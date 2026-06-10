'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STEPS_CONFIG } from '@/lib/steps-config'
import type { ProjectType, ProviderType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarIcon, InstagramIcon, TwitterIcon, CalendarDaysIcon, LockIcon, UserIcon, BuildingIcon, WrenchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const PROJECT_TYPES: { value: ProjectType; label: string; icon: React.ReactNode }[] = [
  { value: 'instagram', label: 'Instagram投稿', icon: <InstagramIcon className="size-4" /> },
  { value: 'twitter', label: 'X（Twitter）投稿', icon: <TwitterIcon className="size-4" /> },
  { value: 'event', label: 'イベント制作', icon: <CalendarDaysIcon className="size-4" /> },
]

const PROVIDER_OPTIONS: { value: ProviderType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'client', label: 'クライアント', icon: <BuildingIcon className="size-3" />, color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'freelancer', label: '外注', icon: <UserIcon className="size-3" />, color: 'bg-violet-100 text-violet-800 border-violet-300' },
  { value: 'self', label: '自分', icon: <WrenchIcon className="size-3" />, color: 'bg-sky-100 text-sky-800 border-sky-300' },
]

interface StepProviderConfig {
  providerType: ProviderType
  providerName: string
  stepDueDate?: Date | undefined
}

export function ProjectForm() {
  const router = useRouter()
  const supabase = createClient()

  const [projectType, setProjectType] = useState<ProjectType | ''>('')
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [existingAssignees, setExistingAssignees] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stepProviders, setStepProviders] = useState<Record<string, StepProviderConfig>>({})

  // 既存のプロジェクトコード一覧を取得
  useEffect(() => {
    async function fetchAssignees() {
      const { data } = await supabase
        .from('projects')
        .select('assignee')
        .is('deleted_at', null)
        .order('assignee')
      if (data) {
        const unique = [...new Set(data.map((d) => d.assignee).filter(Boolean))]
        setExistingAssignees(unique)
      }
    }
    fetchAssignees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!projectType) return
    const defs = STEPS_CONFIG[projectType as ProjectType]
    const initial: Record<string, StepProviderConfig> = {}
    defs.forEach((def) => {
      initial[def.key] = { providerType: def.defaultProvider, providerName: '', stepDueDate: undefined }
    })
    setStepProviders(initial)
  }, [projectType])

  const updateStepProvider = (key: string, field: keyof StepProviderConfig, value: unknown) => {
    setStepProviders((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim() || !projectType || !assignee.trim()) {
      setError('タイトル・種別・プロジェクトコードは必須です')
      return
    }

    setIsSubmitting(true)

    const { data: projectData, error: insertError } = await supabase
      .from('projects')
      .insert({
        title: title.trim(),
        project_type: projectType,
        assignee: assignee.trim(),
        client_slug: null,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        amount: null,
        description: description.trim() || null,
        discord_channels: [],
      })
      .select()
      .single()

    if (insertError || !projectData) {
      setError('プロジェクトの作成に失敗しました: ' + insertError?.message)
      setIsSubmitting(false)
      return
    }

    const stepDefs = STEPS_CONFIG[projectType as ProjectType]
    const stepsToInsert = stepDefs.map((def, index) => {
      const cfg = stepProviders[def.key]
      const providerType: ProviderType = cfg?.providerType ?? def.defaultProvider
      const providerName = cfg?.providerName?.trim() || null
      const isExternal = providerType === 'client' || providerType === 'freelancer'
      const hasRequires = def.requires.length > 0
      const stepDueDate = cfg?.stepDueDate ? format(cfg.stepDueDate, 'yyyy-MM-dd') : null

      return {
        project_id: projectData.id,
        step_key: def.key,
        step_order: index,
        label: def.label,
        provider_type: providerType,
        provider_name: providerName,
        status: hasRequires ? 'ロック中' : (isExternal ? '素材待ち' : '未着手'),
        is_client_step: isExternal,
        file_urls: [],
        file_names: [],
        step_due_date: stepDueDate,
      }
    })

    const { error: stepsError } = await supabase.from('project_steps').insert(stepsToInsert)
    if (stepsError) {
      setError('ステップの作成に失敗しました: ' + stepsError.message)
      setIsSubmitting(false)
      return
    }

    router.push('/')
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>新規プロジェクト作成</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
          )}

          {/* 制作種別 */}
          <div className="space-y-2">
            <Label>制作種別 *</Label>
            <div className="grid grid-cols-3 gap-2">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setProjectType(type.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-xs font-medium transition-all',
                    projectType === type.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-muted-foreground'
                  )}
                >
                  {type.icon}
                  <span className="text-center leading-tight">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ステップごとの担当者設定 */}
          {projectType && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>各ステップの担当者{projectType === 'event' ? '・締め切り' : ''}</Label>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  {PROVIDER_OPTIONS.map((p) => (
                    <span key={p.value} className={cn('px-1.5 py-0.5 rounded border flex items-center gap-1', p.color)}>
                      {p.icon}{p.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border divide-y">
                {STEPS_CONFIG[projectType as ProjectType].map((def) => {
                  const cfg = stepProviders[def.key]
                  const isLocked = def.requires.length > 0
                  return (
                    <div key={def.key} className="px-3 py-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        {isLocked
                          ? <LockIcon className="size-3 text-muted-foreground shrink-0" />
                          : <div className="size-3 rounded-full border-2 border-muted-foreground shrink-0" />
                        }
                        <span className="text-sm font-medium flex-1">{def.label}</span>
                        {isLocked && (
                          <span className="text-[10px] text-muted-foreground">
                            {def.requires.join('+')}完了で解放
                          </span>
                        )}
                      </div>
                      <div className="pl-5 flex gap-2 items-center flex-wrap">
                        {PROVIDER_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateStepProvider(def.key, 'providerType', opt.value)}
                            className={cn(
                              'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                              cfg?.providerType === opt.value
                                ? opt.color + ' border-current'
                                : 'border-border text-muted-foreground hover:border-muted-foreground'
                            )}
                          >
                            {opt.icon}
                            {opt.label}
                          </button>
                        ))}
                        {cfg?.providerType === 'freelancer' && (
                          <Input
                            value={cfg.providerName}
                            onChange={(e) => updateStepProvider(def.key, 'providerName', e.target.value)}
                            placeholder="外注先の名前"
                            className="h-7 text-xs w-32"
                          />
                        )}
                      </div>
                      {/* イベント制作はステップごとの締め切り */}
                      {projectType === 'event' && (
                        <div className="pl-5">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn('h-7 text-xs gap-1.5', !cfg?.stepDueDate && 'text-muted-foreground')}
                              >
                                <CalendarIcon className="size-3" />
                                {cfg?.stepDueDate
                                  ? format(cfg.stepDueDate, 'M/d', { locale: ja })
                                  : '締め切り（任意）'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={cfg?.stepDueDate}
                                onSelect={(date) => updateStepProvider(def.key, 'stepDueDate', date)}
                                locale={ja}
                              />
                              {cfg?.stepDueDate && (
                                <div className="p-2 border-t">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-full h-7 text-xs text-muted-foreground"
                                    onClick={() => updateStepProvider(def.key, 'stepDueDate', undefined)}
                                  >
                                    クリア
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* タイトル */}
          <div className="space-y-2">
            <Label htmlFor="title">タイトル *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 〇〇社 6月Instagram投稿"
            />
          </div>

          {/* プロジェクトコード */}
          <div className="space-y-2">
            <Label htmlFor="assignee">プロジェクトコード *</Label>
            <Input
              id="assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="例: client-a / 株式会社〇〇"
              list="assignee-list"
            />
            {existingAssignees.length > 0 && (
              <datalist id="assignee-list">
                {existingAssignees.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            )}
            {existingAssignees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {existingAssignees.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAssignee(a)}
                    className={cn(
                      'text-[11px] px-2 py-0.5 rounded-full border transition-all',
                      assignee === a
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 備考 */}
          <div className="space-y-2">
            <Label htmlFor="description">内容・備考</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細を入力（任意）"
              rows={3}
            />
          </div>

          {/* 納期 */}
          <div className="space-y-2">
            <Label>全体の納期</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dueDate ? format(dueDate, 'yyyy/MM/dd', { locale: ja }) : '納期を選択'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ja} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => router.push('/')} className="flex-1">
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting || !projectType} className="flex-1">
              {isSubmitting ? '作成中...' : 'プロジェクト作成'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
