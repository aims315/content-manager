'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BellIcon, CheckCircleIcon, MailIcon } from 'lucide-react'

interface Props {
  clientSlug: string
}

export function EmailNotificationSettings({ clientSlug }: Props) {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase
      .from('client_settings')
      .select('notification_email')
      .eq('slug', clientSlug)
      .single()
      .then(({ data }) => {
        if (data?.notification_email) {
          setEmail(data.notification_email)
        }
      })
  }, [clientSlug, supabase])

  const handleSave = async () => {
    setSaving(true)
    await supabase
      .from('client_settings')
      .upsert({ slug: clientSlug, notification_email: email.trim() || null }, { onConflict: 'slug' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setOpen(v => !v)}
      >
        <BellIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">進捗メール通知</span>
        {email && <span className="ml-auto text-xs text-emerald-600 flex items-center gap-1"><CheckCircleIcon className="size-3" />設定済み</span>}
        {!email && <span className="ml-auto text-xs text-muted-foreground">未設定</span>}
      </button>

      {open && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground">
            メールアドレスを登録すると、タスクの進捗が更新されたときにメールでお知らせします。
          </p>
          {saved && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircleIcon className="size-3" /> 保存しました
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MailIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-8 text-sm pl-8"
              />
            </div>
            <Button size="sm" className="h-8 text-xs shrink-0" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
          {email && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => { setEmail(''); handleSave() }}
            >
              通知を解除する
            </button>
          )}
        </div>
      )}
    </div>
  )
}
