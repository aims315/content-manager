import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function formatICalDate(dateStr: string): string {
  // YYYY-MM-DD → 終日イベント形式 YYYYMMDD
  return dateStr.replace(/-/g, '')
}

function formatICalDateTime(isoStr: string): string {
  // ISO文字列 → iCal UTC形式 YYYYMMDDTHHmmssZ
  return new Date(isoStr).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export async function GET(request: NextRequest) {
  // 簡易認証：?token=ADMIN_PATH_SECRET
  const token = request.nextUrl.searchParams.get('token')
  if (process.env.ADMIN_PATH_SECRET && token !== process.env.ADMIN_PATH_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = getSupabase()
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, description, due_date, draft_due_date, status, assignee, client_slug, completed_at')
    .is('deleted_at', null)
    .order('due_date', { ascending: true })

  if (error) {
    return new NextResponse('Error fetching tasks', { status: 500 })
  }

  const now = formatICalDateTime(new Date().toISOString())
  const appName = 'タスク管理'

  const makeEvent = (uid: string, dateStr: string, summary: string, description: string, completed: boolean) => {
    const dtstart = formatICalDate(dateStr)
    const nextDay = new Date(dateStr)
    nextDay.setDate(nextDay.getDate() + 1)
    const dtend = formatICalDate(nextDay.toISOString().split('T')[0])
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:${escapeICalText(summary)}`,
      `DESCRIPTION:${escapeICalText(description)}`,
      completed ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED',
      'END:VEVENT',
    ].join('\r\n')
  }

  const eventList: string[] = []

  for (const task of (tasks || [])) {
    const slug = task.client_slug ? ` [${task.client_slug}]` : ''
    const statusEmoji = task.status === '完了' ? '✅ ' : task.status === '修正' ? '🔧 ' : task.status === '進行中' ? '🔄 ' : ''
    const desc = [
      `担当: ${task.assignee}`,
      `ステータス: ${task.status}`,
      task.description ? `内容: ${task.description}` : '',
    ].filter(Boolean).join('\\n')
    const completed = task.status === '完了'

    // 最終期限イベント
    if (task.due_date) {
      eventList.push(makeEvent(
        `task-${task.id}@task-fb`,
        task.due_date,
        `${statusEmoji}${task.title}${slug}`,
        desc,
        completed
      ))
    }

    // 初校期限イベント（入っている場合のみ）
    if (task.draft_due_date) {
      eventList.push(makeEvent(
        `task-draft-${task.id}@task-fb`,
        task.draft_due_date,
        `📝 初校期限｜${task.title}${slug}`,
        desc,
        completed
      ))
    }
  }

  const events = eventList.join('\r\n')

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${appName}//JA`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${appName}`,
    'X-WR-TIMEZONE:Asia/Tokyo',
    events,
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tasks.ics"',
      'Cache-Control': 'no-cache',
    },
  })
}
