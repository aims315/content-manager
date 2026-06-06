'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BellIcon, CheckCircleIcon, MailIcon, XIcon } from 'lucide-react'

interface Props {
  clientSlug: string
}

const maskEmail = (email: string) => {
  const [local, domain] = email.split('@')
  if (!domain) return '******'
  const masked = local.length <= 2 ? local[0] + '***' : local.slice(0, 2) + '****'
  return `${masked}@${domain}`
}

export function EmailNotificationSettings({ clientSlug }: Props) {
  const supabase = createClient()
  const storageKey = `my_emails_${clientSlug}`

  // このブラウザで登録したメール一覧（他人には見えない）
  const [myEmails, setMyEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) setMyEmails(JSON.parse(stored))
    } catch {}
  }, [storageKey])

  const saveToStorage = (emails: string[]) => {
    try { localStorage.setItem(storageKey, JSON.stringify(emails)) } catch {}
  }

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email || myEmails.includes(email)) return
    setSaving(true)

    // Supabaseの配列に追加
    const { data } = await supabase.from('client_settings').select('notification_emails').eq('slug', clientSlug).single()
    const current: string[] = data?.notification_emails || []
    if (!current.includes(email)) {
      await supabase.from('client_settings')
        .upsert({ slug: clientSlug, notification_emails: [...current, email] }, { onConflict: 'slug' })
    }

    const updated = [...myEmails, email]
    setMyEmails(updated)
    saveToStorage(updated)
    setNewEmail('')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRemove = async (email: string) => {
    setSaving(true)
    const { data } = await supabase.from('client_settings').select('notification_emails').eq('slug', clientSlug).single()
    const current: string[] = data?.notification_emails || []
    await supabase.from('client_settings')
      .update({ notification_emails: current.filter((e) => e !== email) })
      .eq('slug', clientSlug)

    const updated = myEmails.filter((e) => e !== email)
    setMyEmails(updated)
    saveToStorage(updated)
    setSaving(false)
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
        {myEmails.length > 0
          ? <span className="ml-auto text-xs text-emerald-600 flex items-center gap-1"><CheckCircleIcon className="size-3" />{myEmails.length}件登録済み</span>
          : <span className="ml-auto text-xs text-muted-foreground">未登録</span>
        }
      </button>

      {open && (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">
            登録したアドレスにタスクの進捗をお知らせします。複数登録できます。
          </p>

          {/* このブラウザで登録したメール一覧 */}
          {myEmails.length > 0 && (
            <div className="space-y-1">
              {myEmails.map((email) => (
                <div key={email} className="flex items-center gap-2 bg-muted rounded px-2 py-1">
                  <MailIcon className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-xs flex-1 truncate">{maskEmail(email)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(email)}
                    disabled={saving}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {saved && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircleIcon className="size-3" />登録しました</p>}

          {/* 追加フォーム */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MailIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="メールアドレスを追加"
                className="h-8 text-sm pl-8"
              />
            </div>
            <Button size="sm" className="h-8 text-xs shrink-0" onClick={handleAdd} disabled={saving || !newEmail.trim()}>
              追加
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
