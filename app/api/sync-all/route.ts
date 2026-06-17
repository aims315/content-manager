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
  let upserted = 0
  let created = 0
  let deleted = 0

  for (const task of tasks as Record<string, unknown>[]) {
    const clientSlug = task.client_slug as string
    if (!clientSlug) continue

    // 同じ assignee のプロジェクトを全件取得（重複対応）
    const { data: matches } = await supabase
      .from('projects')
      .select('id, created_at')
      .eq('assignee', clientSlug)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (matches && matches.length > 0) {
      const [keep, ...duplicates] = matches

      // 重複分を削除
      if (duplicates.length > 0) {
        await supabase
          .from('projects')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', duplicates.map((p) => p.id))
        deleted += duplicates.length
      }

      // 最新1件を上書き更新
      await supabase
        .from('projects')
        .update({
          title: task.title ?? undefined,
          due_date: task.due_date ?? null,
          amount: task.amount ?? null,
          staff: task.staff ?? null,
          description: task.description ?? null,
        })
        .eq('id', keep.id)
      upserted++
    } else {
      // 新規作成
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

  return NextResponse.json({ upserted, created, deleted })
}
