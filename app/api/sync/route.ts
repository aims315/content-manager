import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Supabase Webhook から呼ばれる
// supabase-green-xylophone の tasks テーブルの UPDATE イベント
// 紐づけ: tasks.client_slug ↔ projects.assignee
export async function POST(request: NextRequest) {
  // 簡易認証
  const secret = request.headers.get('x-sync-secret')
  if (process.env.SYNC_SECRET && secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const record = body.record as {
    id: string
    title: string | null
    client_slug: string | null
    status: string
    due_date: string | null
    amount: number | null
    staff: string | null
    description: string | null
  }
  const oldRecord = body.old_record as { status: string }

  if (!record || !record.client_slug) {
    return NextResponse.json({ skipped: 'no client_slug' })
  }

  // ステータスが変わっていなければスキップ
  if (oldRecord?.status === record.status) {
    return NextResponse.json({ skipped: 'status unchanged' })
  }

  const supabase = getSupabase()

  // ── 投稿OK ──
  if (record.status === '投稿OK') {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('assignee', record.client_slug)
      .is('deleted_at', null)
      .single()

    if (project) {
      // 既存プロジェクトの post_ready ステップを「進行中」に（完了はtask完了時）
      await supabase
        .from('project_steps')
        .update({ status: '進行中' })
        .eq('project_id', project.id)
        .eq('step_key', 'post_ready')
        .eq('status', '未着手')

      return NextResponse.json({ updated: project.id })
    }

    // プロジェクトが存在しない → 自動作成
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        title: record.title ?? '（タスクアプリから自動作成）',
        project_type: 'instagram',
        assignee: record.client_slug,
        client_slug: record.client_slug,
        due_date: record.due_date,
        amount: record.amount,
        staff: record.staff,
        description: record.description,
      })
      .select('id')
      .single()

    if (error || !newProject) {
      return NextResponse.json({ error: error?.message }, { status: 500 })
    }

    await supabase.from('project_steps').insert([
      { project_id: newProject.id, step_key: 'photo',      step_order: 0, label: '写真素材',    status: '未着手', provider_type: 'client' },
      { project_id: newProject.id, step_key: 'text',       step_order: 1, label: 'テキスト素材', status: '未着手', provider_type: 'client' },
      { project_id: newProject.id, step_key: 'design',     step_order: 2, label: 'デザイン制作', status: '未着手', provider_type: 'self' },
      { project_id: newProject.id, step_key: 'post_ready', step_order: 3, label: '投稿完成',    status: '進行中', provider_type: 'self' },
    ])

    return NextResponse.json({ created: newProject.id })
  }

  // ── 完了 ──
  if (record.status === '完了') {
    await supabase
      .from('projects')
      .update({ done_override: true, completed_at: new Date().toISOString() })
      .eq('assignee', record.client_slug)
      .is('deleted_at', null)
      .or('done_override.is.null,done_override.eq.false')

    return NextResponse.json({ completed: record.client_slug })
  }

  return NextResponse.json({ skipped: 'status not matched' })
}
