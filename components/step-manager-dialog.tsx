'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ListTodoIcon, PlusIcon, Trash2Icon, ChevronUpIcon, ChevronDownIcon, GripVerticalIcon, CheckIcon, BookmarkIcon, SaveIcon, CalendarIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectStep, ProviderType } from '@/lib/types'
import type { ProviderRole } from '@/hooks/use-provider-labels'
import { COLOR_STYLES } from '@/hooks/use-provider-labels'
import { useStepPresets } from '@/hooks/use-step-presets'

interface StepManagerDialogProps {
  projectId: string
  steps: ProjectStep[]
  providerRoles: ProviderRole[]
  onUpdated: () => void
}

export function StepManagerDialog({ projectId, steps, providerRoles, onUpdated }: StepManagerDialogProps) {
  const supabase = createClient()
  const { presets, addPreset, deletePreset } = useStepPresets()
  const [open, setOpen] = useState(false)
  const [localSteps, setLocalSteps] = useState<ProjectStep[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [newProvider, setNewProvider] = useState<string>(providerRoles[0]?.id ?? 'self')
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [roleEditId, setRoleEditId] = useState<string | null>(null)
  const [savePresetMode, setSavePresetMode] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetSequentialLock, setPresetSequentialLock] = useState(false)

  const openDialog = () => {
    setLocalSteps([...steps].sort((a, b) => a.step_order - b.step_order))
    setNewLabel('')
    setNewProvider(providerRoles[0]?.id ?? 'self')
    setSavePresetMode(false)
    setPresetName('')
    setOpen(true)
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const arr = [...localSteps]
    ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
    setLocalSteps(arr)
  }

  const moveDown = (index: number) => {
    if (index === localSteps.length - 1) return
    const arr = [...localSteps]
    ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
    setLocalSteps(arr)
  }

  // ドラッグ並び替え
  const handleDrop = (target: number) => {
    if (dragIndex === null || dragIndex === target) { setDragIndex(null); setOverIndex(null); return }
    const arr = [...localSteps]
    const [moved] = arr.splice(dragIndex, 1)
    arr.splice(target, 0, moved)
    setLocalSteps(arr)
    setDragIndex(null)
    setOverIndex(null)
  }

  const removeStep = (stepId: string) => {
    setLocalSteps((prev) => prev.filter((s) => s.id !== stepId))
  }

  // 既存・新規ステップの名前/役割を編集
  const renameStep = (stepId: string, label: string) => {
    setLocalSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, label } : s))
  }
  const changeStepProvider = (stepId: string, provider: string) => {
    setLocalSteps((prev) => prev.map((s) =>
      s.id === stepId ? { ...s, provider_type: provider as ProviderType, is_client_step: provider !== 'self' } : s
    ))
    setRoleEditId(null)
  }
  const setStepDue = (stepId: string, due: string | null) => {
    setLocalSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, step_due_date: due } : s))
  }

  // プリセットのステップをまとめて追加（鍵=前提ステップも再現）
  const applyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return
    const base = localSteps.length
    const stamp = Date.now()
    // プリセット内インデックス → 追加した一時ID
    const tempIds = preset.steps.map((_, idx) => `new_${stamp}_${idx}`)
    const added: ProjectStep[] = preset.steps.map((item, idx) => {
      const deps = (item.deps ?? []).map((di) => tempIds[di]).filter(Boolean)
      return {
        id: tempIds[idx],
        project_id: projectId,
        step_key: 'text' as any,
        step_order: base + idx,
        label: item.label,
        status: deps.length > 0 ? 'ロック中' : '未着手',
        provider_type: item.provider as ProviderType,
        provider_name: null,
        file_urls: [], file_names: [], url: null, note: null,
        submitted_by: null, submitted_at: null,
        is_client_step: item.provider !== 'self',
        step_due_date: null,
        depends_on: deps,
        created_at: new Date().toISOString(),
      }
    })
    setLocalSteps((prev) => [...prev, ...added])
  }

  // 現在のステップ構成をプリセットとして保存（鍵=前提ステップもインデックスで保存）
  const saveAsPreset = async () => {
    if (!presetName.trim() || localSteps.length === 0) return
    const indexById: Record<string, number> = {}
    localSteps.forEach((s, i) => { indexById[s.id] = i })
    await addPreset(
      presetName.trim(),
      localSteps.map((s, i) => ({
        label: s.label,
        provider: s.provider_type,
        // チェック時は「前の工程に順番ロック」、それ以外は今の鍵構造を保存
        deps: presetSequentialLock
          ? (i > 0 ? [i - 1] : [])
          : (s.depends_on ?? []).map((id) => indexById[id]).filter((i) => i !== undefined),
      }))
    )
    setSavePresetMode(false)
    setPresetName('')
    setPresetSequentialLock(false)
  }

  const addStep = () => {
    if (!newLabel.trim()) return
    const tempId = `new_${Date.now()}`
    const newStep: ProjectStep = {
      id: tempId,
      project_id: projectId,
      step_key: 'text' as any,
      step_order: localSteps.length,
      label: newLabel.trim(),
      status: '未着手',
      provider_type: newProvider as ProviderType,
      provider_name: null,
      file_urls: [],
      file_names: [],
      url: null,
      note: null,
      submitted_by: null,
      submitted_at: null,
      is_client_step: newProvider !== 'self',
      step_due_date: null,
      created_at: new Date().toISOString(),
    }
    setLocalSteps((prev) => [...prev, newStep])
    setNewLabel('')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 削除されたステップをDBから削除
      const removedIds = steps
        .filter((s) => !localSteps.find((ls) => ls.id === s.id))
        .map((s) => s.id)

      for (const id of removedIds) {
        await supabase.from('project_steps').delete().eq('id', id)
      }

      // 新規ステップをinsert、既存ステップのstep_orderをupdate
      const tempToReal: Record<string, string> = {}  // 一時ID → 実ID（鍵の再マップ用）
      const newStepsWithDeps: { realId: string; tempDeps: string[] }[] = []
      for (let i = 0; i < localSteps.length; i++) {
        const step = localSteps[i]
        if (step.id.startsWith('new_')) {
          // 新規追加（鍵がある場合はロック中で作成）
          const hasDeps = (step.depends_on ?? []).length > 0
          const { data: inserted } = await supabase.from('project_steps').insert({
            project_id: projectId,
            step_key: 'text',
            step_order: i,
            label: step.label,
            status: hasDeps ? 'ロック中' : (step.status ?? '未着手'),
            provider_type: step.provider_type,
            provider_name: null,
            file_urls: [],
            file_names: [],
            is_client_step: step.provider_type !== 'self',
            step_due_date: step.step_due_date ?? null,
          }).select('id').single()
          if (inserted) {
            tempToReal[step.id] = inserted.id
            if (hasDeps) newStepsWithDeps.push({ realId: inserted.id, tempDeps: step.depends_on ?? [] })
          }
        } else {
          // 既存：順序・名前・役割・締切を更新
          await supabase.from('project_steps')
            .update({
              step_order: i,
              label: step.label,
              provider_type: step.provider_type,
              is_client_step: step.provider_type !== 'self',
              step_due_date: step.step_due_date ?? null,
            })
            .eq('id', step.id)
        }
      }

      // 新規ステップの鍵（depends_on）を実IDに付け替えて保存
      for (const { realId, tempDeps } of newStepsWithDeps) {
        const realDeps = tempDeps.map((t) => tempToReal[t] ?? t).filter(Boolean)
        if (realDeps.length > 0) {
          await supabase.from('project_steps').update({ depends_on: realDeps }).eq('id', realId)
        }
      }

      setOpen(false)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={openDialog}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-dashed rounded px-1.5 py-0.5 transition-colors"
          title="ステップを管理"
        >
          <ListTodoIcon className="size-3" />
          ステップ管理
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodoIcon className="size-4" />
            ステップ管理
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* ステップ一覧 */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {localSteps.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">ステップがありません</p>
            )}
            {localSteps.length > 0 && (
              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button type="button" className="text-[11px] text-destructive hover:underline flex items-center gap-0.5">
                      <Trash2Icon className="size-3" />全ステップ削除
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>全ステップを削除しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        このプロジェクトの{localSteps.length}件のステップをすべて削除します。「保存」を押すと確定します。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction onClick={() => setLocalSteps([])}>すべて削除</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
            {localSteps.map((step, i) => {
              const role = providerRoles.find((r) => r.id === step.provider_type)
              const badgeCls = role ? COLOR_STYLES[role.color].badge : 'bg-muted text-muted-foreground'
              const isNew = step.id.startsWith('new_')
              return (
                <div
                  key={step.id}
                  onDragOver={(e) => { e.preventDefault(); setOverIndex(i) }}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
                  onDrop={() => handleDrop(i)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2 py-1.5 bg-card transition-colors',
                    isNew && 'border-primary/40 bg-primary/5',
                    dragIndex === i && 'opacity-40',
                    overIndex === i && dragIndex !== i && 'border-primary border-2'
                  )}
                >
                  <span
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground"
                    title="ドラッグで並び替え"
                  >
                    <GripVerticalIcon className="size-3.5" />
                  </span>

                  {/* 上下ボタン */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ChevronUpIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(i)}
                      disabled={i === localSteps.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ChevronDownIcon className="size-3" />
                    </button>
                  </div>

                  {/* 名前（編集可能） */}
                  <Input
                    value={step.label}
                    onChange={(e) => renameStep(step.id, e.target.value)}
                    className="h-7 text-xs flex-1 min-w-0 border-transparent hover:border-input focus:border-input bg-transparent px-1.5"
                  />

                  {/* 役割（クリックで変更）。表示対象外ロールは出さない */}
                  {role && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setRoleEditId(roleEditId === step.id ? null : step.id)}
                      className={cn('text-[10px] px-1.5 py-0.5 rounded transition-opacity hover:opacity-80', badgeCls)}
                      title="役割を変更"
                    >
                      {role.label}
                    </button>
                    {roleEditId === step.id && (
                      <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-md shadow-md p-1 flex flex-col gap-0.5 min-w-[120px]">
                        {providerRoles.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => changeStepProvider(step.id, r.id)}
                            className={cn(
                              'text-[11px] px-2 py-1 rounded text-left transition-colors',
                              r.id === step.provider_type ? COLOR_STYLES[r.color].badge + ' font-medium' : 'hover:bg-muted'
                            )}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* 締切 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" title="締切を設定"
                        className={cn('flex items-center gap-1 text-[10px] px-1.5 py-1 rounded border shrink-0',
                          step.step_due_date ? 'border-border text-foreground' : 'border-dashed text-muted-foreground')}>
                        <CalendarIcon className="size-3" />
                        {step.step_due_date ? format(new Date(step.step_due_date), 'M/d', { locale: ja }) : '締切'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar mode="single" locale={ja}
                        selected={step.step_due_date ? new Date(step.step_due_date) : undefined}
                        onSelect={(date) => setStepDue(step.id, date ? format(date, 'yyyy-MM-dd') : null)} />
                      {step.step_due_date && (
                        <div className="p-2 border-t">
                          <Button type="button" variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
                            onClick={() => setStepDue(step.id, null)}>クリア</Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  {isNew && <span className="text-[10px] text-primary font-normal shrink-0">新</span>}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>ステップを削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          「{step.label}」を削除します。提出済みデータも失われます。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeStep(step.id)}>削除</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )
            })}
          </div>

          {/* プリセット */}
          <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <BookmarkIcon className="size-3" />プリセット（工程のまとまり）
              </p>
              {localSteps.length > 0 && !savePresetMode && (
                <button type="button" onClick={() => setSavePresetMode(true)}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  <SaveIcon className="size-3" />今の構成を保存
                </button>
              )}
            </div>

            {/* 保存フォーム */}
            {savePresetMode && (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <Input value={presetName} onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveAsPreset()}
                    placeholder="プリセット名（例: Instagram通常投稿）" className="h-7 text-xs" />
                  <Button type="button" size="sm" className="h-7 text-xs px-2" onClick={saveAsPreset} disabled={!presetName.trim()}>保存</Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => { setSavePresetMode(false); setPresetName('') }}>×</Button>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={presetSequentialLock} onChange={(e) => setPresetSequentialLock(e.target.checked)} className="size-3" />
                  順番にロック（各工程は前の工程が完了したら開始）
                </label>
              </div>
            )}

            {/* 既存プリセット一覧 */}
            {presets.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">まだプリセットがありません。ステップを組んで「今の構成を保存」で作れます。</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center rounded-full border bg-card overflow-hidden">
                    <button type="button" onClick={() => applyPreset(p.id)}
                      title={`${p.steps.length}工程を追加`}
                      className="text-xs pl-2.5 pr-1.5 py-1 hover:bg-primary hover:text-primary-foreground transition-colors">
                      ＋{p.name}<span className="text-[9px] opacity-60 ml-0.5">({p.steps.length})</span>
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button type="button" className="px-1.5 py-1 text-muted-foreground hover:text-destructive border-l">
                          <Trash2Icon className="size-3" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>プリセットを削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>「{p.name}」を削除します。既存のプロジェクトには影響しません。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePreset(p.id)}>削除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 新規追加フォーム */}
          <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">ステップを追加</p>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStep()}
              placeholder="ステップ名（例: 原稿確認、デザイン修正）"
              className="h-8 text-xs"
            />
            <div className="flex gap-1.5 flex-wrap">
              {providerRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setNewProvider(role.id)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-all',
                    newProvider === role.id
                      ? COLOR_STYLES[role.color].button + ' border-current font-medium'
                      : 'border-border text-muted-foreground hover:border-muted-foreground'
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={addStep}
              disabled={!newLabel.trim()}
            >
              <PlusIcon className="size-3" />
              追加
            </Button>
          </div>

          {/* 保存・キャンセル */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : <><CheckIcon className="size-4 mr-1" />保存</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
