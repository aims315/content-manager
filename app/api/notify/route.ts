import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Provider = 'none' | 'chatwork' | 'discord'

interface NotifyRoute {
  id: string
  code: string
  provider: Provider
  chatworkRoomId: string
  discordWebhook: string
}

interface NotifyConfig {
  provider: Provider
  chatworkToken: string
  chatworkRoomId: string
  discordWebhook: string
  routes?: NotifyRoute[]
}

async function sendDiscord(webhook: string, message: string) {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  })
  if (!res.ok) return { error: await res.text(), status: res.status }
  return { ok: true }
}

async function sendChatwork(token: string, roomId: string, message: string) {
  const res = await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: {
      'X-ChatWorkToken': token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `body=${encodeURIComponent(message)}`,
  })
  if (!res.ok) return { error: await res.text(), status: res.status }
  return { ok: true }
}

export async function POST(req: NextRequest) {
  const { message, code } = await req.json()
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

  // コード別ルートを優先。部分一致も許容（コードにサフィックスが付くケース対応）
  const route = code && config?.routes?.length
    ? config.routes.find((r) => r.code && (r.code === code || code.includes(r.code)))
    : undefined

  // 送信先を決定。送信先（ルーム/Webhook）はルート→全体設定のみで決める（envルームには
  // フォールバックしない＝未設定コードが既定ルームへ誤送信されるのを防ぐ）。
  // トークンはアカウント共通なのでenvフォールバック可。
  const provider: Provider = route?.provider ?? config?.provider ?? 'none'
  const chatworkToken = config?.chatworkToken || process.env.CHATWORK_API_TOKEN || ''
  const chatworkRoomId = route?.chatworkRoomId || config?.chatworkRoomId || ''
  const discordWebhook = route?.discordWebhook || config?.discordWebhook || ''

  let result: { ok?: boolean; error?: string; status?: number }
  if (provider === 'discord') {
    if (!discordWebhook) return NextResponse.json({ ok: true, skipped: 'no discord webhook' })
    result = await sendDiscord(discordWebhook, message)
  } else if (provider === 'chatwork') {
    // 送信先ルーム or トークンが無いコードは送らない（スキップ）
    if (!chatworkToken || !chatworkRoomId) return NextResponse.json({ ok: true, skipped: 'no chatwork room/token' })
    result = await sendChatwork(chatworkToken, chatworkRoomId, message)
  } else {
    return NextResponse.json({ ok: true, skipped: true })
  }

  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  return NextResponse.json({ ok: true })
}
