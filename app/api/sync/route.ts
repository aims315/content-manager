import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface StepPresetItem { label: string; provider: string }
interface StepPreset { id: string; name: string; steps: StepPresetItem[] }

// app_settings から「インスタ設定カルーセル」プリセットを取得
async function fetchPreset(supabase: ReturnType<typeof getSupabase>, name: string): Promise<StepPreset | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'step_presets')
    .single()
  if (!data?.value) return null
  try {
    const presets = JSON.parse(data.value) as StepPreset[]
    return presets.find((p) => p.name === name) ?? null
  } catch { return null }
}

// Supabase pg_net トリガーから呼ばれる
// supabase-green-xylophone の tasks テーブルの UPDATE イベント
// 紐づけ: tasks.client_slug ↔ projects.assignee
export async function POST(request: NextRequest) {
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
      // 既存プロジェクトはそのまま（ステップを触らない）
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

    // 「インスタ設定カルーセル」プリセットを探す
    const preset = await fetchPreset(supabase, 'インスタ設定カルーセル')

    if (preset && preset.steps.length > 0) {
      // プリセットのステップを挿入。最初のステップだけ「完了」、残りは「未着手」
      const stepsToInsert = preset.steps.map((item, idx) => ({
        project_id: newProject.id,
        step_key: 'text',
        step_order: idx,
        label: item.label,
        status: idx === 0 ? '完了' : '未着手',
        provider_type: item.provider === 'client' ? 'client'
          : item.provider === 'freelancer' ? 'freelancer'
          : 'self',
      }))
      await supabase.from('project_steps').insert(stepsToInsert)
    }
    // プリセットが見つからなければステップなしで作成（空カード）

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
