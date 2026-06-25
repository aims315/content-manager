import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type Provider = 'none' | 'chatwork' | 'discord'
interface NotifyRoute { id: string; code: string; provider: Provider; chatworkRoomId: string; discordWebhook: string }
interface NotifyConfig {
  provider: Provider; chatworkToken: string; chatworkRoomId: string; discordWebhook: string; routes?: NotifyRoute[]
}

async function readSetting(supabase: ReturnType<typeof getSupabase>, key: string) {
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).single()
  return data?.value as string | undefined
}

async function sendNotification(config: NotifyConfig | null, code: string | undefined, message: string) {
  const route = code && config?.routes?.length
    ? config.routes.find((r) => r.code && (r.code === code || code.includes(r.code)))
    : undefined
  const provider: Provider = route?.provider ?? config?.provider ?? 'none'
  const chatworkToken = config?.chatworkToken || process.env.CHATWORK_API_TOKEN || ''
  const chatworkRoomId = route?.chatworkRoomId || config?.chatworkRoomId || ''
  const discordWebhook = route?.discordWebhook || config?.discordWebhook || ''

  if (provider === 'discord' && discordWebhook) {
    await fetch(discordWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: message }) })
  } else if (provider === 'chatwork' && chatworkToken && chatworkRoomId) {
    await fetch(`https://api.chatwork.com/v2/rooms/${chatworkRoomId}/messages`, {
      method: 'POST',
      headers: { 'X-ChatWorkToken': chatworkToken, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `body=${encodeURIComponent(message)}`,
    })
  }
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // 通知設定
  let notifyConfig: NotifyConfig | null = null
  const ncRaw = await readSetting(supabase, 'notification_config')
  if (ncRaw) { try { notifyConfig = JSON.parse(ncRaw) } catch { /* ignore */ } }

  // 全体の通知日数（deadline_config.reminderDays、既定3）
  let globalDays = 3
  const dcRaw = await readSetting(supabase, 'deadline_config')
  if (dcRaw) { try { const c = JSON.parse(dcRaw); if (typeof c.reminderDays === 'number') globalDays = c.reminderDays } catch { /* ignore */ } }

  // 完了扱いラベル（未着手/ロック中は必ず除外）
  let doneLabels = ['完了']
  const ssRaw = await readSetting(supabase, 'step_statuses')
  if (ssRaw) {
    try {
      const defs = JSON.parse(ssRaw) as { id: string; label: string; isDone?: boolean }[]
      doneLabels = defs.filter((s) => s.isDone && s.label !== '未着手' && s.label !== 'ロック中' && s.id !== 'status_pending' && s.id !== 'status_locked').map((s) => s.label)
      if (doneLabels.length === 0) doneLabels = ['完了']
    } catch { /* ignore */ }
  }

  // 進行中プロジェクト取得
  const { data: projects } = await supabase.from('projects').select('*').is('deleted_at', null)
  if (!projects || projects.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const ids = projects.map((p) => p.id)
  const { data: allSteps } = await supabase.from('project_steps').select('*').in('project_id', ids)
  const stepsByProject: Record<string, any[]> = {}
  for (const s of (allSteps || [])) (stepsByProject[s.project_id] ??= []).push(s)

  let sent = 0
  for (const p of projects) {
    // 完了判定：手動完了 or 全ステップ完了（＝進捗バー全部緑）→ スキップ
    if (p.done_override === true) continue
    const ps = stepsByProject[p.id] ?? []
    const allDone = ps.length > 0 && ps.every((s) => doneLabels.includes(s.status))
    if (p.done_override !== false && allDone) continue

    const days = (typeof p.reminder_days === 'number' && p.reminder_days > 0) ? p.reminder_days : globalDays

    // 近づいている締切を集める（プロジェクト納期＋未完了ステップの締切）
    const near: string[] = []
    if (p.due_date) {
      const d = daysUntil(p.due_date)
      if (d >= 0 && d <= days) near.push(`納期 ${p.due_date}（あと${d}日）`)
    }
    for (const s of ps) {
      if (!s.step_due_date) continue
      if (doneLabels.includes(s.status)) continue
      const d = daysUntil(s.step_due_date)
      if (d >= 0 && d <= days) near.push(`${s.label} 〆${s.step_due_date}（あと${d}日）`)
    }
    // 名前付きの追加期日
    const customDates = Array.isArray(p.custom_dates) ? p.custom_dates : []
    for (const cd of customDates) {
      if (!cd?.date || !cd?.label) continue
      const d = daysUntil(cd.date)
      if (d >= 0 && d <= days) near.push(`${cd.label} ${cd.date}（あと${d}日）`)
    }
    if (near.length === 0) continue

    const message = `[コンテンツ制作管理] ⏰ 締切が近づいています\nプロジェクト: ${p.title}\nコード: ${p.assignee}\n${near.map((n) => `・${n}`).join('\n')}`
    await sendNotification(notifyConfig, p.assignee, message)
    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
