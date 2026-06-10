'use client'

import { useState } from 'react'
import { useProviderLabels, COLOR_STYLES } from '@/hooks/use-provider-labels'
import type { ProviderRole } from '@/hooks/use-provider-labels'
import { useStepStatuses, STATUS_COLOR_STYLES, STATUS_COLOR_OPTIONS, STATUS_COLOR_LABELS } from '@/hooks/use-step-statuses'
import type { StepStatusDef, StatusColorKey } from '@/hooks/use-step-statuses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Settings2Icon, PlusIcon, Trash2Icon, CheckIcon, GripVerticalIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROLE_COLOR_OPTIONS: ProviderRole['color'][] = ['amber', 'violet', 'sky', 'emerald', 'rose', 'orange']
const ROLE_COLOR_LABELS: Record<ProviderRole['color'], string> = {
  amber: 'イエロー', violet: 'パープル', sky: 'ブルー',
  emerald: 'グリーン', rose: 'ピンク', orange: 'オレンジ',
}

type Tab = 'roles' | 'statuses'

export function ProviderSettingsModal() {
  const { roles, addRole, updateRole, deleteRole } = useProviderLabels()
  const { statuses, addStatus, updateStatus, renameStatus, deleteStatus, reorder } = useStepStatuses()

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('roles')
  const [saved, setSaved] = useState(false)
  const [roleColorEditId, setRoleColorEditId] = useState<string | null>(null)
  const [statusColorEditId, setStatusColorEditId] = useState<string | null>(null)
  // ラベル編集中の一時値（確定はblurかEnterで）
  const [pendingLabels, setPendingLabels] = useState<Record<string, string>>({})

  const handleRoleColorChange = async (id: string, color: ProviderRole['color']) => {
    await updateRole(id, { color })
    setRoleColorEditId(null)
  }

  const handleStatusColorChange = async (id: string, color: StatusColorKey) => {
    await updateStatus(id, { color })
    setStatusColorEditId(null)
  }

  const handleStatusLabelBlur = async (id: string) => {
    const val = pendingLabels[id]
    if (val !== undefined) {
      await renameStatus(id, val.trim())
      setPendingLabels((p) => { const n = { ...p }; delete n[id]; return n })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="size-9" title="設定">
          <Settings2Icon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>

        {/* タブ */}
        <div className="flex rounded-md border overflow-hidden">
          {(['roles', 'statuses'] as Tab[]).map((t, i) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('flex-1 py-1.5 text-xs font-medium transition-colors',
                i > 0 && 'border-l',
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}>
              {t === 'roles' ? '役割' : 'ステータス'}
            </button>
          ))}
        </div>

        {/* ── 役割タブ ── */}
        {tab === 'roles' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              担当者の役割名・色を変更したり、追加・削除できます。
            </p>
            <div className="space-y-2">
              {roles.map((role, i) => (
                <div key={role.id} className="flex items-center gap-2">
                  <GripVerticalIcon className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground w-10 shrink-0">役割{i + 1}</span>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setRoleColorEditId(roleColorEditId === role.id ? null : role.id)}
                      className={cn('size-6 rounded-full border-2 border-white ring-1 ring-border shrink-0',
                        COLOR_STYLES[role.color].badge.split(' ')[0])}
                      title="色を変更"
                    />
                    {roleColorEditId === role.id && (
                      <div className="absolute left-0 top-8 z-50 flex gap-1 bg-popover border rounded-lg p-1.5 shadow-md">
                        {ROLE_COLOR_OPTIONS.map((c) => (
                          <button key={c} type="button"
                            onClick={() => handleRoleColorChange(role.id, c)}
                            className={cn('size-5 rounded-full border-2 transition-transform hover:scale-110',
                              COLOR_STYLES[c].badge.split(' ')[0],
                              role.color === c ? 'border-foreground' : 'border-transparent')}
                            title={ROLE_COLOR_LABELS[c]}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <Input
                    value={role.label}
                    onChange={(e) => updateRole(role.id, { label: e.target.value })}
                    placeholder={`役割${i + 1}の名前`}
                    className="h-8 text-sm flex-1"
                  />

                  <Button type="button" variant="ghost" size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => roles.length > 1 && deleteRole(role.id)}
                    disabled={roles.length <= 1} title="削除">
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addRole}>
              <PlusIcon className="size-3.5" />役割を追加
            </Button>
          </div>
        )}

        {/* ── ステータスタブ ── */}
        {tab === 'statuses' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              ステータスの名前・色を変更したり、追加・削除できます。名前を変えると既存のステップも更新されます。
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {statuses.map((st, i) => (
                <div key={st.id} className="flex items-center gap-2">
                  {/* 上下 */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button type="button" onClick={() => reorder(i, i - 1)} disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                      <ChevronUpIcon className="size-3" />
                    </button>
                    <button type="button" onClick={() => reorder(i, i + 1)} disabled={i === statuses.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                      <ChevronDownIcon className="size-3" />
                    </button>
                  </div>

                  {/* カラー選択 */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setStatusColorEditId(statusColorEditId === st.id ? null : st.id)}
                      className={cn('size-6 rounded-full border-2 border-white ring-1 ring-border',
                        STATUS_COLOR_STYLES[st.color].dot)}
                      title="色を変更"
                    />
                    {statusColorEditId === st.id && (
                      <div className="absolute left-0 top-8 z-50 flex flex-wrap gap-1 bg-popover border rounded-lg p-1.5 shadow-md w-28">
                        {STATUS_COLOR_OPTIONS.map((c) => (
                          <button key={c} type="button"
                            onClick={() => handleStatusColorChange(st.id, c)}
                            className={cn('size-5 rounded-full border-2 transition-transform hover:scale-110',
                              STATUS_COLOR_STYLES[c].dot,
                              st.color === c ? 'border-foreground' : 'border-transparent')}
                            title={STATUS_COLOR_LABELS[c]}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 名前入力 */}
                  <Input
                    value={pendingLabels[st.id] !== undefined ? pendingLabels[st.id] : st.label}
                    onChange={(e) => setPendingLabels((p) => ({ ...p, [st.id]: e.target.value }))}
                    onBlur={() => handleStatusLabelBlur(st.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStatusLabelBlur(st.id)}
                    placeholder="ステータス名"
                    className="h-8 text-sm flex-1"
                  />

                  {/* 完了扱いトグル（依存関係に使用） */}
                  <button
                    type="button"
                    onClick={() => updateStatus(st.id, { isDone: !st.isDone })}
                    title={st.isDone ? '依存完了扱いON（クリックでOFF）' : '依存完了扱いOFF（クリックでON）'}
                    className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0 transition-colors',
                      st.isDone ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'text-muted-foreground border-border hover:border-muted-foreground'
                    )}
                  >
                    完了
                  </button>

                  {/* グレーアウトトグル */}
                  <button
                    type="button"
                    onClick={() => updateStatus(st.id, { dim: !st.dim })}
                    title={st.dim ? '薄表示ON（クリックでOFF）' : '薄表示OFF（クリックでON）'}
                    className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0 transition-colors',
                      st.dim ? 'bg-slate-100 text-slate-500 border-slate-300' : 'text-muted-foreground border-border hover:border-muted-foreground'
                    )}
                  >
                    薄
                  </button>

                  {/* 削除 */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button type="button"
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        disabled={statuses.length <= 1}>
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>「{st.label}」を削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          このステータスを削除します。既存のステップに設定されている場合はそのまま残ります。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteStatus(st.id)}>削除</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addStatus}>
              <PlusIcon className="size-3.5" />ステータスを追加
            </Button>
          </div>
        )}


        <Button className="w-full" onClick={() => {
          setSaved(true)
          setTimeout(() => { setSaved(false); setOpen(false) }, 800)
        }}>
          {saved ? <><CheckIcon className="size-4 mr-2" />保存しました！</> : '完了'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
