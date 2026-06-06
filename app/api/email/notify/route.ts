import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  try {
    const { clientSlug, taskTitle, status, draftUrl, responseUrl } = await request.json()

    // client_settings からメールアドレスを取得（複数対応）
    const supabase = getSupabase()
    const { data } = await supabase
      .from('client_settings')
      .select('notification_email, notification_emails')
      .eq('slug', clientSlug)
      .single()

    // 新しい配列 + 旧単体メールをまとめる
    const emails: string[] = [
      ...(data?.notification_emails || []),
      ...(data?.notification_email ? [data.notification_email] : []),
    ].filter((e, i, arr) => e && arr.indexOf(e) === i)

    if (emails.length === 0) return NextResponse.json({ skipped: true })

    const statusLabels: Record<string, string> = {
      '進行中': '進行中',
      '制作要項待ち': '制作要項待ちになりました',
      '初校提出': '初校が提出されました',
      '修正': '修正依頼中',
      '修正対応完了': '修正対応が完了しました',
      '完了': '完了しました',
    }
    const label = statusLabels[status] ?? status

    const linkHtml = (draftUrl || responseUrl)
      ? `<p style="margin-top:12px;"><a href="${draftUrl || responseUrl}" style="color:#6d28d9;font-weight:bold;">→ データを確認する</a></p>`
      : ''

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#333;font-size:18px;margin-bottom:8px;">📋 タスク進捗のお知らせ</h2>
        <p style="color:#555;font-size:14px;margin-bottom:16px;">タスクの進捗が更新されました。</p>
        <div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:12px 16px;border-radius:4px;">
          <p style="margin:0;font-size:15px;font-weight:bold;color:#1a1a1a;">${taskTitle}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#7c3aed;font-weight:bold;">${label}</p>
        </div>
        ${linkHtml}
        <p style="margin-top:24px;font-size:12px;color:#999;">このメールはタスク管理システムから自動送信されています。</p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'タスク管理 <onboarding@resend.dev>',
        to: emails,
        subject: `【進捗更新】${taskTitle} - ${label}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
