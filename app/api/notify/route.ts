import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface NotifyConfig {
  provider: 'none' | 'chatwork' | 'discord'
  chatworkToken: string
  chatworkRoomId: string
  discordWebhook: string
}

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  // 設定をDBから取得（なければ環境変数にフォールバック）
  let config: NotifyConfig | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'notification_config')
      .single()
    if (data?.value) config = JSON.parse(data.value)
  } catch { /* fall back to env */ }

  const provider = config?.provider ?? (process.env.CHATWORK_API_TOKEN ? 'chatwork' : 'none')

  // ── Discord ──
  if (provider === 'discord') {
    const webhook = config?.discordWebhook
    if (!webhook) return NextResponse.json({ error: 'Discord not configured' }, { status: 500 })
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }
    return NextResponse.json({ ok: true })
  }

  // ── Chatwork ──
  if (provider === 'chatwork') {
    const token = config?.chatworkToken || process.env.CHATWORK_API_TOKEN
    const roomId = config?.chatworkRoomId || process.env.CHATWORK_ROOM_ID
    if (!token || !roomId) {
      return NextResponse.json({ error: 'Chatwork not configured' }, { status: 500 })
    }
    const res = await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `body=${encodeURIComponent(message)}`,
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }
    return NextResponse.json({ ok: true })
  }

  // provider === 'none'：通知しない（成功扱い）
  return NextResponse.json({ ok: true, skipped: true })
}
