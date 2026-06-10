'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ListTodoIcon, PlusIcon, Trash2Icon, ChevronUpIcon, ChevronDownIcon, GripVerticalIcon, CheckIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectStep, ProviderType } from '@/lib/types'
import type { ProviderRole } from '@/hooks/use-provider-labels'
import { COLOR_STYLES } from '@/hooks/use-provider-labels'

interface StepManagerDialogProps {
  projectId: string
  steps: ProjectStep[]
  providerRoles: ProviderRole[]
  onUpdated: () => void
}

export function StepManagerDialog({ projectId, steps, providerRoles, onUpdated }: StepManagerDialogProps) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [localSteps, setLocalSteps] = useState<ProjectStep[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [newProvider, setNewProvider] = useState<string>(providerRoles[0]?.id ?? 'self')
  const [saving, setSaving] = useState(false)

  const openDialog = () => {
    setLocalSteps([...steps].sort((a, b) => a.step_order - b.step_order))
    setNewLabel('')
    setNewProvider(providerRoles[0]?.id ?? 'self')
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

  const removeStep = (stepId: string) => {
    setLocalSteps((prev) => prev.filter((s) => s.id !== stepId))
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
      for (let i = 0; i < localSteps.length; i++) {
        const step = localSteps[i]
        if (step.id.startsWith('new_')) {
          // 新規追加
          await supabase.from('project_steps').insert({
            project_id: projectId,
            step_key: 'text',
            step_order: i,
            label: step.label,
            status: '未着手',
            provider_type: step.provider_type,
            provider_name: null,
            file_urls: [],
            file_names: [],
            is_client_step: step.provider_type !== 'self',
          })
        } else {
          // 順序更新
          await supabase.from('project_steps')
            .update({ step_order: i })
            .eq('id', step.id)
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
            {localSteps.map((step, i) => {
              const role = providerRoles.find((r) => r.id === step.provider_type)
              const badgeCls = role ? COLOR_STYLES[role.color].badge : 'bg-muted text-muted-foreground'
              const isNew = step.id.startsWith('new_')
              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2 py-1.5 bg-card',
                    isNew && 'border-primary/40 bg-primary/5'
                  )}
                >
                  <GripVerticalIcon className="size-3.5 text-muted-foreground shrink-0" />

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

                  <span className="text-xs font-medium flex-1 min-w-0 truncate">
                    {step.label}
                    {isNew && <span className="ml-1 text-[10px] text-primary font-normal">新規</span>}
                  </span>

                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded shrink-0', badgeCls)}>
                    {role?.label ?? step.provider_type}
                  </span>

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
