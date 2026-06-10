'use client'

import { useState } from 'react'
import { useProviderLabels, COLOR_STYLES } from '@/hooks/use-provider-labels'
import type { ProviderRole } from '@/hooks/use-provider-labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Settings2Icon, PlusIcon, Trash2Icon, CheckIcon, GripVerticalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const COLOR_OPTIONS: ProviderRole['color'][] = ['amber', 'violet', 'sky', 'emerald', 'rose', 'orange']

const COLOR_LABELS: Record<ProviderRole['color'], string> = {
  amber: 'イエロー', violet: 'パープル', sky: 'ブルー',
  emerald: 'グリーン', rose: 'ピンク', orange: 'オレンジ',
}

export function ProviderSettingsModal() {
  const { roles, addRole, updateRole, deleteRole } = useProviderLabels()
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleLabelChange = async (id: string, label: string) => {
    await updateRole(id, { label })
  }

  const handleColorChange = async (id: string, color: ProviderRole['color']) => {
    await updateRole(id, { color })
    setEditingId(null)
  }

  const handleAdd = async () => {
    await addRole()
    setSaved(false)
  }

  const handleDelete = async (id: string) => {
    if (roles.length <= 1) return
    await deleteRole(id)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="size-9" title="役割ラベルを設定">
          <Settings2Icon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>役割の設定</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">
            役割の名前・色を変更したり、追加・削除できます。
          </p>

          <div className="space-y-2">
            {roles.map((role, i) => (
              <div key={role.id} className="flex items-center gap-2">
                <GripVerticalIcon className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-10 shrink-0">役割{i + 1}</span>

                {/* カラー選択 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEditingId(editingId === role.id ? null : role.id)}
                    className={cn(
                      'size-6 rounded-full border-2 border-white ring-1 ring-border shrink-0',
                      COLOR_STYLES[role.color].badge.split(' ')[0]
                    )}
                    title="色を変更"
                  />
                  {editingId === role.id && (
                    <div className="absolute left-0 top-8 z-50 flex gap-1 bg-popover border rounded-lg p-1.5 shadow-md">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleColorChange(role.id, c)}
                          className={cn(
                            'size-5 rounded-full border-2 transition-transform hover:scale-110',
                            COLOR_STYLES[c].badge.split(' ')[0],
                            role.color === c ? 'border-foreground' : 'border-transparent'
                          )}
                          title={COLOR_LABELS[c]}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* 名前入力 */}
                <Input
                  value={role.label}
                  onChange={(e) => handleLabelChange(role.id, e.target.value)}
                  placeholder={`役割${i + 1}の名前`}
                  className="h-8 text-sm flex-1"
                />

                {/* 削除 */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(role.id)}
                  disabled={roles.length <= 1}
                  title="削除"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={handleAdd}
          >
            <PlusIcon className="size-3.5" />
            役割を追加
          </Button>

          <Button
            className="w-full"
            onClick={() => { setSaved(true); setTimeout(() => { setSaved(false); setOpen(false) }, 800) }}
          >
            {saved ? <><CheckIcon className="size-4 mr-2" />保存しました！</> : '完了'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
