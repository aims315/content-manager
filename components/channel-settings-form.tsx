'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PlusIcon, Trash2Icon, CheckCircleIcon } from 'lucide-react'

const NO_CHANNEL_VALUE = '__none__'
const NEW_CHANNEL_VALUE = '__new__'

interface ClientSetting {
  slug: string
  discord_channel: string
}

export function ChannelSettingsForm() {
  const supabase = createClient()
  const [settings, setSettings] = useState<ClientSetting[]>([])
  const [channels, setChannels] = useState<string[]>([])
  const [newSlug, setNewSlug] = useState('')
  const [newChannel, setNewChannel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 新規Discordチャンネル追加
  const [showNewWebhook, setShowNewWebhook] = useState(false)
  const [newWebhookName, setNewWebhookName] = useState('')
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [webhookSaving, setWebhookSaving] = useState(false)
  const [webhookSaved, setWebhookSaved] = useState(false)
  const [webhookError, setWebhookError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('client_settings').select('*').order('slug')
    setSettings((data as ClientSetting[]) || [])
  }, [supabase])

  useEffect(() => {
    fetchSettings()
    // 利用可能なDiscordチャンネル一覧を取得
    fetch('/api/discord/notify')
      .then((r) => r.json())
      .then((d) => setChannels(d.channels || []))
      .catch(() => {})
  }, [fetchSettings])

  const handleAdd = async () => {
    setError(null)
    const slug = newSlug.trim().toLowerCase()
    if (!slug) {
      setError('クライアントコードを入力してください')
      return
    }
    setSaving(true)
    const { error: err } = await supabase
      .from('client_settings')
      .upsert({ slug, discord_channel: newChannel || '' }, { onConflict: 'slug' })
    setSaving(false)
    if (err) { setError('保存に失敗しました'); return }
    setNewSlug('')
    setNewChannel('')
    await fetchSettings()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDelete = async (slug: string) => {
    await supabase.from('client_settings').delete().eq('slug', slug)
    await fetchSettings()
  }

  const handleChannelChange = async (slug: string, channel: string) => {
    await supabase.from('client_settings').update({ discord_channel: channel === NO_CHANNEL_VALUE ? '' : channel }).eq('slug', slug)
    await fetchSettings()
  }

  const handleAddWebhook = async () => {
    setWebhookError(null)
    const name = newWebhookName.trim()
    const url = newWebhookUrl.trim()
    if (!name) { setWebhookError('チャンネル名を入力してください'); return }
    if (!url.startsWith('https://discord.com/api/webhooks/')) { setWebhookError('正しいDiscord Webhook URLを入力してください'); return }
    setWebhookSaving(true)
    const { error: err } = await supabase.from('discord_webhooks').upsert({ name, webhook_url: url }, { onConflict: 'name' })
    setWebhookSaving(false)
    if (err) { setWebhookError('保存に失敗しました: ' + err.message); return }
    setNewWebhookName('')
    setNewWebhookUrl('')
    setShowNewWebhook(false)
    setWebhookSaved(true)
    // チャンネル一覧を再取得
    fetch('/api/discord/notify').then(r => r.json()).then(d => setChannels(d.channels || [])).catch(() => {})
    setTimeout(() => setWebhookSaved(false), 2000)
  }

  const ChannelSelect = ({ value, onValueChange }: { value: string, onValueChange: (v: string) => void }) => (
    <Select value={value} onValueChange={(v) => {
      if (v === NEW_CHANNEL_VALUE) { setShowNewWebhook(true); return }
      onValueChange(v)
    }}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="通知しない" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_CHANNEL_VALUE}>通知しない</SelectItem>
        {channels.map((ch) => (
          <SelectItem key={ch} value={ch}>{ch}</SelectItem>
        ))}
        <SelectItem value={NEW_CHANNEL_VALUE}>＋ 新規チャンネルを追加...</SelectItem>
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            クライアントコードごとに通知先のDiscordチャンネルを設定します。<br />
            設定がない場合はDiscord通知を送りません。
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircleIcon className="size-4" /> 保存しました
            </div>
          )}
          {webhookSaved && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircleIcon className="size-4" /> Discordチャンネルを追加しました
            </div>
          )}

          {/* 新規Discordチャンネル追加フォーム */}
          {showNewWebhook && (
            <div className="border rounded-md p-3 space-y-3 bg-muted/40">
              <p className="text-sm font-medium">新しいDiscordチャンネルを追加</p>
              {webhookError && <p className="text-xs text-destructive">{webhookError}</p>}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">チャンネル名（ラベル）</p>
                <Input
                  value={newWebhookName}
                  onChange={(e) => setNewWebhookName(e.target.value)}
                  placeholder="例: 山田商事"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Webhook URL</p>
                <Input
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={handleAddWebhook} disabled={webhookSaving}>
                  {webhookSaving ? '保存中...' : '追加する'}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowNewWebhook(false); setWebhookError(null) }}>
                  キャンセル
                </Button>
              </div>
            </div>
          )}

          {/* 既存設定一覧 */}
          {settings.length > 0 && (
            <div className="space-y-2">
              <Label>現在の設定</Label>
              {settings.map((s) => (
                <div key={s.slug} className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1.5 rounded text-sm font-mono w-32 shrink-0 truncate">
                    {s.slug}
                  </code>
                  <span className="text-muted-foreground text-sm">→</span>
                  <div className="flex-1">
                    <ChannelSelect
                      value={s.discord_channel || NO_CHANNEL_VALUE}
                      onValueChange={(val) => handleChannelChange(s.slug, val)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => handleDelete(s.slug)}
                  >
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 新規追加 */}
          <div className="border-t pt-4 space-y-3">
            <Label>新しい紐付けを追加</Label>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">クライアントコード</p>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="例: sample"
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">Discordチャンネル</p>
                <ChannelSelect
                  value={newChannel || NO_CHANNEL_VALUE}
                  onValueChange={(val) => setNewChannel(val === NO_CHANNEL_VALUE ? '' : val)}
                />
              </div>
              <Button
                size="sm"
                className="h-8 shrink-0"
                onClick={handleAdd}
                disabled={saving}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
