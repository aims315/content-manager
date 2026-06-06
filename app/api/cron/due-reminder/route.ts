import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function getWebhookMap(): Record<string, string> {
  const raw = process.env.DISCORD_WEBHOOKS
  if (!raw) {
    const single = process.env.DISCORD_WEBHOOK_URL
    if (single) return { '通知': single }
    return {}
  }
  try { return JSON.parse(raw) } catch { return {} }
}

async function getChannelForSlug(supabase: ReturnType<typeof getSupabase>, clientSlug: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('client_settings')
      .select('discord_channel')
      .eq('slug', clientSlug)
      .single()
    return data?.discord_channel ?? null
  } catch {
    return null
  }
}

async function sendToDiscord(content: string, channels: string[], clientSlug: string | null, supabase: ReturnType<typeof getSupabase>, webhookMap: Record<string, string>) {
  let urls: string[] = []

  // 1. タスクに紐づくチャンネルが明示されていればそこだけ
  if (channels.length > 0) {
    urls = channels.filter((ch) => webhookMap[ch]).map((ch) => webhookMap[ch])
  }

  // 2. なければ client_slug → client_settings のチャンネルを参照
  if (urls.length === 0 && clientSlug) {
    const ch = await getChannelForSlug(supabase, clientSlug)
    if (ch && webhookMap[ch]) urls = [webhookMap[ch]]
  }

  // チャンネルが特定できない場合は送信しない
  if (urls.length === 0) return

  await Promise.allSettled(
    urls.map((url) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
    )
  )
}

export async function GET(request: NextRequest) {
  // Vercel が自動で付与する CRON_SECRET で認証
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const webhookMap = getWebhookMap()

  // 通知タイミングを app_settings から取得（デフォルト3日前）
  const { data: settingData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'due_reminder_days')
    .single()

  const reminderDays = Math.max(1, parseInt(settingData?.value ?? '3', 10) || 3)

  // 対象日 = 今日 + reminderDays
  const target = new Date()
  target.setDate(target.getDate() + reminderDays)
  const targetDateStr = target.toISOString().split('T')[0] // YYYY-MM-DD

  // 対象タスクを取得：期日が targetDate かつ未完了かつ削除されていない
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, assignee, due_date, status, discord_channels, client_slug')
    .eq('due_date', targetDateStr)
    .neq('status', '完了')
    .is('deleted_at', null)

  if (error) {
    console.error('Cron: failed to fetch tasks', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ sent: 0, reminderDays, targetDate: targetDateStr })
  }

  let sent = 0
  for (const task of tasks) {
    const content =
      `⚠️ **締切まであと${reminderDays}日です！**\n\n` +
      `**タイトル:** ${task.title}\n` +
      `**担当者:** ${task.assignee}\n` +
      `**期限:** ${task.due_date}\n` +
      `**ステータス:** ${task.status}`

    await sendToDiscord(content, task.discord_channels ?? [], task.client_slug ?? null, supabase, webhookMap)
    sent++
  }

  return NextResponse.json({ sent, reminderDays, targetDate: targetDateStr })
}
