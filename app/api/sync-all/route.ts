import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TASK_FB_URL = 'https://flickboxtask.vercel.app/api/tasks-export'
const TASK_CONTENT_SYNC = 'https://task-unyou-sns.vercel.app/api/sync'

export async function POST(_request: NextRequest) {
  // task_fb から全タスク取得
  const res = await fetch(TASK_FB_URL, {
    headers: { 'x-sync-secret': process.env.SYNC_SECRET ?? '' },
  })
  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })

  const { tasks } = await res.json()
  if (!tasks?.length) return NextResponse.json({ synced: 0 })

  // 各タスクを UPSERT
  const results = await Promise.all(
    tasks.map((task: Record<string, unknown>) =>
      fetch(TASK_CONTENT_SYNC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-secret': process.env.SYNC_SECRET ?? '',
        },
        body: JSON.stringify({ type: 'UPSERT', record: task }),
      }).then((r) => r.json())
    )
  )

  return NextResponse.json({ synced: tasks.length, results })
}
