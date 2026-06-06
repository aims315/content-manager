import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getChannelForSlug(clientSlug: string): Promise<string | null> {
  try {
    const supabase = getSupabase()
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

// 環境変数 DISCORD_WEBHOOKS に JSON を設定する
function getEnvWebhookMap(): Record<string, string> {
  const raw = process.env.DISCORD_WEBHOOKS
  if (!raw) {
    const single = process.env.DISCORD_WEBHOOK_URL
    if (single) return { '通知': single }
    return {}
  }
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function getWebhookMap(): Promise<Record<string, string>> {
  const base = getEnvWebhookMap()
  try {
    const supabase = getSupabase()
    const { data } = await supabase.from('discord_webhooks').select('name, webhook_url')
    if (data) {
      for (const row of data) {
        if (row.name && row.webhook_url) base[row.name] = row.webhook_url
      }
    }
  } catch { /* テーブル未作成でも動作継続 */ }
  return base
}

export async function GET() {
  const map = await getWebhookMap()
  const channels = Object.keys(map)
  return NextResponse.json({ channels })
}

export async function POST(request: NextRequest) {
  const webhookMap = await getWebhookMap()

  if (Object.keys(webhookMap).length === 0) {
    return NextResponse.json(
      { error: 'Discord webhook URLs not configured' },
      { status: 500 }
    )
  }

  try {
    const { type, title, assignee, dueDate, channels, note, modifiedBy, responseUrl, responseNote, clientSlug, daysEarly, description, fileUrls, previousStatus, newStatus } = await request.json()

    let message = ''
    if (type === 'created') {
      message = `🆕 **新しいタスクが作成されました！**\n\n**タイトル:** ${title}\n**担当者:** ${assignee}${dueDate ? `\n**期限:** ${dueDate}` : ''}${description ? `\n**備考:** ${description}` : ''}${fileUrls && fileUrls.length > 0 ? `\n**添付ファイル:**\n${fileUrls.map((u: string) => u).join('\n')}` : ''}`
    } else if (type === 'completed') {
      message = `✅ **タスクが完了しました！**\n\n**タイトル:** ${title}\n**担当者:** ${assignee}${dueDate ? `\n**期限:** ${dueDate}` : ''}`
    } else if (type === 'early_completion') {
      message = `🎉 **期日より${daysEarly}日早く完了しました！**\n\n**タイトル:** ${title}\n**担当者:** ${assignee}${dueDate ? `\n**期限:** ${dueDate}` : ''}`
    } else if (type === 'revision') {
      message = `🔧 **修正依頼が届きました！**\n\n**タイトル:** ${title}\n**担当者:** ${assignee}${modifiedBy ? `\n**依頼者:** ${modifiedBy}` : ''}${note ? `\n**修正内容:** ${note}` : ''}${dueDate ? `\n**期限:** ${dueDate}` : ''}`
    } else if (type === 'response') {
      message = `📤 **修正対応が完了しました！**\n\n**タイトル:** ${title}\n**担当者:** ${assignee}${responseNote ? `\n**備考:** ${responseNote}` : ''}${responseUrl ? `\n**データリンク:** ${responseUrl}` : ''}`
    } else if (type === 'draft') {
      message = `📎 **初校が提出されました！**\n\n**タイトル:** ${title}\n**担当者:** ${assignee}${responseNote ? `\n**備考:** ${responseNote}` : ''}${responseUrl ? `\n**データリンク:** ${responseUrl}` : ''}`
    } else if (type === 'status_changed') {
      message = `🔄 **ステータスが変更されました**\n\n**タイトル:** ${title}\n**担当者:** ${assignee}\n**変更:** ${previousStatus} → ${newStatus}${dueDate ? `\n**期限:** ${dueDate}` : ''}`
    } else if (type === 'updated') {
      message = `✏️ **タスクが更新されました**\n\n**タイトル:** ${title}\n**担当者:** ${assignee}${dueDate ? `\n**期限:** ${dueDate}` : ''}`
    } else {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 })
    }

    // チャンネル選択：channels指定 > DBのclient_slug設定。未指定なら送信しない。
    let webhookUrls: string[] = []
    if (channels && channels.length > 0) {
      webhookUrls = channels.filter((ch: string) => webhookMap[ch]).map((ch: string) => webhookMap[ch])
    } else if (clientSlug) {
      const ch = await getChannelForSlug(clientSlug)
      if (ch && webhookMap[ch]) {
        webhookUrls = [webhookMap[ch]]
      }
    }
    // チャンネルが特定できない場合は送信しない
    if (webhookUrls.length === 0) {
      return NextResponse.json({ success: true, skipped: true, reason: 'no channel resolved' })
    }

    await Promise.allSettled(
      webhookUrls.map((url) =>
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message }),
          })
        )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Discord notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
