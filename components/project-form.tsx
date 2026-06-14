'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STEPS_CONFIG } from '@/lib/steps-config'
import { useProviderLabels, COLOR_STYLES } from '@/hooks/use-provider-labels'
import { useProjectTypes, TYPE_COLOR_OPTIONS, EMOJI_PRESETS } from '@/hooks/use-project-types'
import { useStepPresets } from '@/hooks/use-step-presets'
import { sendChatworkNotification } from '@/hooks/use-notify'
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
import { CalendarIcon, InstagramIcon, TwitterIcon, CalendarDaysIcon, LockIcon, UserIcon, BuildingIcon, WrenchIcon, PlusIcon, Trash2Icon } from 'lucide-react'
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
  const { labels: providerLabels, roles: providerRoles } = useProviderLabels()
  const { customTypes, addType, deleteType } = useProjectTypes()
  const { presets } = useStepPresets()
  const [presetId, setPresetId] = useState<string>('')

  const [projectType, setProjectType] = useState<string>('')
  // 種別追加フォーム
  const [showAddType, setShowAddType] = useState(false)
  const [newTypeLabel, setNewTypeLabel] = useState('')
  const [newTypeEmoji, setNewTypeEmoji] = useState('📝')
  const [newTypeColorIdx, setNewTypeColorIdx] = useState(0)
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

  const isBuiltinType = (t: string) => t === 'instagram' || t === 'twitter' || t === 'event'

  useEffect(() => {
    if (!projectType || !isBuiltinType(projectType)) {
      setStepProviders({})
      return
    }
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

    // プリセットが選ばれていればそれを初期ステップにする。なければ種別の標準ステップ。
    const selectedPreset = presets.find((p) => p.id === presetId)
    let stepsToInsert: Record<string, unknown>[]
    if (selectedPreset) {
      stepsToInsert = selectedPreset.steps.map((item, index) => {
        const isExternal = item.provider === 'client' || item.provider === 'freelancer'
        return {
          project_id: projectData.id,
          step_key: 'text',
          step_order: index,
          label: item.label,
          provider_type: item.provider,
          provider_name: null,
          status: '未着手',
          is_client_step: isExternal,
          file_urls: [],
          file_names: [],
          step_due_date: null,
        }
      })
    } else {
      const stepDefs = isBuiltinType(projectType) ? STEPS_CONFIG[projectType as ProjectType] : []
      stepsToInsert = stepDefs.map((def, index) => {
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
    }

    const { error: stepsError } = stepsToInsert.length
      ? await supabase.from('project_steps').insert(stepsToInsert)
      : { error: null }
    if (stepsError) {
      setError('ステップの作成に失敗しました: ' + stepsError.message)
      setIsSubmitting(false)
      return
    }

    // Chatwork通知
    const builtinLabel: Record<string, string> = { instagram: 'Instagram投稿', twitter: 'X（Twitter）投稿', event: 'イベント制作' }
    const customType = customTypes.find((t) => t.id === projectType)
    const typeLabel = builtinLabel[projectType] ?? (customType ? `${customType.emoji} ${customType.label}` : projectType)
    sendChatworkNotification(`[コンテンツ制作管理]\n🆕 新規プロジェクト作成\nタイトル: ${title.trim()}\n種別: ${typeLabel}\nコード: ${assignee.trim()}${dueDate ? `\n納期: ${format(dueDate, 'M/d')}` : ''}`)

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
                <button key={type.value} type="button" onClick={() => setProjectType(type.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-xs font-medium transition-all',
                    projectType === type.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground'
                  )}>
                  {type.icon}
                  <span className="text-center leading-tight">{type.label}</span>
                </button>
              ))}
              {customTypes.map((type) => (
                <div key={type.id} className="relative group">
                  <button type="button" onClick={() => setProjectType(type.id)}
                    className={cn(
                      'w-full flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-xs font-medium transition-all',
                      projectType === type.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-muted-foreground'
                    )}>
                    <span className="text-2xl leading-none">{type.emoji}</span>
                    <span className="text-center leading-tight">{type.label}</span>
                  </button>
                  {/* 削除ボタン（ホバーで表示） */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteType(type.id) }}
                    className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="削除"
                  >
                    <Trash2Icon className="size-3" />
                  </button>
                </div>
              ))}
              {/* 種別を追加ボタン */}
              <button
                type="button"
                onClick={() => setShowAddType((v) => !v)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed p-3 text-xs font-medium transition-all',
                  showAddType ? 'border-primary text-primary bg-primary/5' : 'border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                )}>
                <PlusIcon className="size-4" />
                <span className="text-center leading-tight">種別を追加</span>
              </button>
            </div>

            {/* インライン追加フォーム */}
            {showAddType && (
              <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-2.5 mt-1">
                <p className="text-xs font-medium text-muted-foreground">新しい種別を追加</p>
                <div className="flex gap-2">
                  <Input
                    value={newTypeEmoji}
                    onChange={(e) => setNewTypeEmoji(e.target.value)}
                    className="h-8 w-12 text-center text-base p-1 shrink-0"
                    maxLength={2}
                  />
                  <Input
                    value={newTypeLabel}
                    onChange={(e) => setNewTypeLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTypeLabel.trim()) {
                        addType(newTypeLabel.trim(), newTypeEmoji, newTypeColorIdx).then((id) => {
                          setProjectType(id)
                          setNewTypeLabel('')
                          setShowAddType(false)
                        })
                      }
                    }}
                    placeholder="種別名（例：コラム、動画）"
                    className="h-8 text-sm flex-1"
                    autoFocus
                  />
                </div>
                {/* 絵文字プリセット */}
                <div className="flex flex-wrap gap-1">
                  {EMOJI_PRESETS.map((em) => (
                    <button key={em} type="button"
                      onClick={() => setNewTypeEmoji(em)}
                      className={cn('size-7 text-base rounded hover:bg-muted transition-colors flex items-center justify-center',
                        newTypeEmoji === em && 'bg-muted ring-1 ring-primary'
                      )}>
                      {em}
                    </button>
                  ))}
                </div>
                {/* 色選択 */}
                <div className="flex gap-1">
                  {TYPE_COLOR_OPTIONS.map((c, i) => (
                    <button key={i} type="button"
                      onClick={() => setNewTypeColorIdx(i)}
                      className={cn('size-5 rounded-full border-2 transition-transform hover:scale-110',
                        c.bgColor,
                        newTypeColorIdx === i ? 'border-foreground' : 'border-transparent'
                      )}
                      title={c.label}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {newTypeLabel && (
                    <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                      TYPE_COLOR_OPTIONS[newTypeColorIdx]?.bgColor,
                      TYPE_COLOR_OPTIONS[newTypeColorIdx]?.color
                    )}>
                      {newTypeEmoji} {newTypeLabel}
                    </span>
                  )}
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 ml-auto"
                    disabled={!newTypeLabel.trim()}
                    onClick={() => {
                      if (!newTypeLabel.trim()) return
                      addType(newTypeLabel.trim(), newTypeEmoji, newTypeColorIdx).then((id) => {
                        setProjectType(id)
                        setNewTypeLabel('')
                        setShowAddType(false)
                      })
                    }}>
                    <PlusIcon className="size-3" />追加して選択
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 初期ステップのプリセット選択 */}
          {projectType && presets.length > 0 && (
            <div className="space-y-2">
              <Label>初期ステップ（プリセット）</Label>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setPresetId('')}
                  className={cn('text-xs px-2.5 py-1 rounded-full border transition-all',
                    !presetId ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-muted-foreground'
                  )}>
                  {isBuiltinType(projectType) ? '種別の標準' : 'なし'}
                </button>
                {presets.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPresetId(p.id)}
                    className={cn('text-xs px-2.5 py-1 rounded-full border transition-all',
                      presetId === p.id ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-muted-foreground'
                    )}>
                    {p.name}<span className="text-[9px] opacity-60 ml-0.5">({p.steps.length})</span>
                  </button>
                ))}
              </div>
              {presetId && (
                <p className="text-[10px] text-muted-foreground">
                  プリセット「{presets.find((p) => p.id === presetId)?.name}」の工程で作成します。作成後に「ステップ管理」で調整できます。
                </p>
              )}
            </div>
          )}

          {/* カスタムジャンルはステップなし案内 */}
          {projectType && !isBuiltinType(projectType) && !presetId && (
            <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              作成後に「ステップ管理」からステップを追加できます。プリセットを選ぶと初期ステップを配置できます。
            </div>
          )}

          {/* ステップごとの担当者設定（組み込みタイプのみ・プリセット未選択時） */}
          {projectType && isBuiltinType(projectType) && !presetId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>各ステップの担当者{projectType === 'event' ? '・締め切り' : ''}</Label>
                <div className="flex gap-2 text-[10px] flex-wrap">
                  {providerRoles.map((r) => (
                    <span key={r.id} className={cn('px-1.5 py-0.5 rounded border', COLOR_STYLES[r.color].button)}>
                      {r.label}
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
                        {providerRoles.map((role) => (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => updateStepProvider(def.key, 'providerType', role.id)}
                            className={cn(
                              'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                              cfg?.providerType === role.id
                                ? COLOR_STYLES[role.color].button + ' border-current'
                                : 'border-border text-muted-foreground hover:border-muted-foreground'
                            )}
                          >
                            {role.label}
                          </button>
                        ))}
                        <Input
                          value={cfg?.providerName ?? ''}
                          onChange={(e) => updateStepProvider(def.key, 'providerName', e.target.value)}
                          placeholder="custom name (optional)"
                          className="h-7 text-xs w-44"
                        />
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
