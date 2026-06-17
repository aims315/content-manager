import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TASK_FB_URL = 'https://flickboxtask.vercel.app/api/tasks-export'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(_request: NextRequest) {
  const res = await fetch(TASK_FB_URL)
  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })

  const { tasks } = await res.json()
  if (!tasks?.length) return NextResponse.json({ synced: 0 })

  const supabase = getSupabase()
  const activeClientSlugs: string[] = tasks.map((t: Record<string, string>) => t.client_slug).filter(Boolean)

  // 各タスクを上書きUPSERT
  let upserted = 0
  let created = 0

  for (const task of tasks as Record<string, unknown>[]) {
    const clientSlug = task.client_slug as string
    if (!clientSlug) continue

    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('assignee', clientSlug)
      .is('deleted_at', null)
      .single()

    if (existing) {
      await supabase
        .from('projects')
        .update({
          title: task.title ?? undefined,
          due_date: task.due_date ?? null,
          amount: task.amount ?? null,
          staff: task.staff ?? null,
          description: task.description ?? null,
        })
        .eq('id', existing.id)
      upserted++
    } else {
      // 新規作成 — ステップはプリセットから（sync/route の INSERT と同じロジック）
      await fetch('https://task-unyou-sns.vercel.app/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-secret': process.env.SYNC_SECRET ?? '',
        },
        body: JSON.stringify({ type: 'INSERT', record: task }),
      })
      created++
    }
  }

  return NextResponse.json({
    synced: upserted,
    created,
    deleted: toDelete.length,
  })
}
