'use client'

import { useState } from 'react'
import { useProviderLabels } from '@/hooks/use-provider-labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Settings2Icon, BuildingIcon, UserIcon, WrenchIcon, CheckIcon } from 'lucide-react'
import type { ProviderType } from '@/lib/types'

const PROVIDER_META: { type: ProviderType; icon: React.ReactNode; defaultPlaceholder: string }[] = [
  { type: 'client', icon: <BuildingIcon className="size-4 text-amber-600" />, defaultPlaceholder: 'クライアント' },
  { type: 'freelancer', icon: <UserIcon className="size-4 text-violet-600" />, defaultPlaceholder: '外注' },
  { type: 'self', icon: <WrenchIcon className="size-4 text-sky-600" />, defaultPlaceholder: '自分' },
]

export function ProviderSettingsModal() {
  const { labels, updateLabel } = useProviderLabels()
  const [values, setValues] = useState<Record<ProviderType, string>>({
    client: '',
    freelancer: '',
    self: '',
  })
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setValues({ client: labels.client, freelancer: labels.freelancer, self: labels.self })
    }
    setOpen(isOpen)
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await Promise.all([
      updateLabel('client', values.client || 'クライアント'),
      updateLabel('freelancer', values.freelancer || '外注'),
      updateLabel('self', values.self || '自分'),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); setOpen(false) }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="size-9" title="担当者ラベルを設定">
          <Settings2Icon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>担当者ラベルの設定</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            3つの役割の表示名を変更できます。空欄の場合はデフォルト名が使われます。
          </p>
          {PROVIDER_META.map(({ type, icon, defaultPlaceholder }) => (
            <div key={type} className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm">
                {icon}
                {defaultPlaceholder}
              </Label>
              <Input
                value={values[type]}
                onChange={(e) => setValues((prev) => ({ ...prev, [type]: e.target.value }))}
                placeholder={defaultPlaceholder}
                className="h-9"
              />
            </div>
          ))}
          <Button className="w-full" onClick={handleSave} disabled={saving || saved}>
            {saved
              ? <><CheckIcon className="size-4 mr-2 text-emerald-500" />保存しました！</>
              : saving ? '保存中...' : '保存する'
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
