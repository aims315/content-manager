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

interface ClientSetting {
  slug: string
  discord_channel: string
  posted_ok_enabled?: boolean
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

  const handlePostedOkToggle = async (slug: string, enabled: boolean) => {
    await supabase.from('client_settings').update({ posted_ok_enabled: enabled }).eq('slug', slug)
    await fetchSettings()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            クライアントコードごとに通知先のDiscordチャンネルを設定します。<br />
            設定がない場合はDiscord通知を送りません。
          </p>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {saved && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircleIcon className="size-4" /> 保存しました
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
                    {channels.length > 0 ? (
                      <Select
                        value={s.discord_channel || NO_CHANNEL_VALUE}
                        onValueChange={(val) => handleChannelChange(s.slug, val)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_CHANNEL_VALUE}>通知しない</SelectItem>
                          {channels.map((ch) => (
                            <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">{s.discord_channel || '通知しない'}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handlePostedOkToggle(s.slug, !s.posted_ok_enabled)}
                    className={`text-xs px-2 py-1 rounded border shrink-0 transition-colors ${s.posted_ok_enabled ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : 'border-muted-foreground/30 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600'}`}
                    title="投稿OKボタンをクライアントポータルに表示"
                  >
                    投稿OK
                  </button>
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
                  placeholder="例: alsok"
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">Discordチャンネル</p>
                {channels.length > 0 ? (
                  <Select
                    value={newChannel || NO_CHANNEL_VALUE}
                    onValueChange={(val) => setNewChannel(val === NO_CHANNEL_VALUE ? '' : val)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="通知しない" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CHANNEL_VALUE}>通知しない</SelectItem>
                      {channels.map((ch) => (
                        <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    placeholder="チャンネル名"
                    className="h-8 text-sm"
                  />
                )}
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
