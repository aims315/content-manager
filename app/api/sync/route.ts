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

async function fetchPresetForClient(
  supabase: ReturnType<typeof getSupabase>,
  clientSlug: string
): Promise<StepPreset | null> {
  const { data: rows } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['step_presets', 'client_preset_map'])

  if (!rows) return null

  const presetsRow = rows.find((r) => r.key === 'step_presets')
  const mapRow = rows.find((r) => r.key === 'client_preset_map')

  let presets: StepPreset[] = []
  try { presets = JSON.parse(presetsRow?.value ?? '[]') } catch { return null }

  let presetName: string | null = null
  try {
    const map: Record<string, string> = JSON.parse(mapRow?.value ?? '{}')
    presetName = map[clientSlug] ?? map['default'] ?? null
  } catch { /* ignore */ }

  if (!presetName) return presets[0] ?? null
  return presets.find((p) => p.name === presetName) ?? presets[0] ?? null
}

// supabase-green-xylophone の tasks テーブルから呼ばれる
// INSERT → プロマネ用カード自動作成（ステップ全て未着手）
// UPDATE status=投稿OK → 最初のステップを完了＋URL・初稿日セット
// UPDATE status=完了   → 全ステップを完了
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-sync-secret')
  if (process.env.SYNC_SECRET && secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const eventType: string = body.type // 'INSERT' | 'UPDATE'
  const record = body.record as {
    id: string
    title: string | null
    client_slug: string | null
    status: string
    due_date: string | null
    amount: number | null
    staff: string | null
    description: string | null
    draft_url: string | null
    response_url: string | null
    draft_due_date: string | null
  }
  const oldRecord = body.old_record as { status?: string } | undefined

  if (!record?.client_slug) {
    return NextResponse.json({ skipped: 'no client_slug' })
  }

  const supabase = getSupabase()

  // ── INSERT: カード新規作成 ──
  if (eventType === 'INSERT') {
    // 既に同じクライアントのプロジェクトがあれば作らない
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('assignee', record.client_slug)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json({ skipped: 'project already exists' })
    }

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

    const preset = await fetchPresetForClient(supabase, record.client_slug)
    if (preset && preset.steps.length > 0) {
      await supabase.from('project_steps').insert(
        preset.steps.map((item, idx) => ({
          project_id: newProject.id,
          step_key: 'text',
          step_order: idx,
          label: item.label,
          status: '未着手',
          provider_type: item.provider === 'client' ? 'client'
            : item.provider === 'freelancer' ? 'freelancer'
            : 'self',
        }))
      )
    }

    return NextResponse.json({ created: newProject.id })
  }

  // UPDATE のみここから
  if (eventType !== 'UPDATE') {
    return NextResponse.json({ skipped: 'not INSERT or UPDATE' })
  }

  if (oldRecord?.status === record.status) {
    return NextResponse.json({ skipped: 'status unchanged' })
  }

  // ── 投稿OK: 最初のステップを完了＋URL・初稿日セット ──
  if (record.status === '投稿OK') {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('assignee', record.client_slug)
      .is('deleted_at', null)
      .single()

    if (!project) {
      return NextResponse.json({ skipped: 'no project found for client' })
    }

    const { data: firstStep } = await supabase
      .from('project_steps')
      .select('id')
      .eq('project_id', project.id)
      .order('step_order', { ascending: true })
      .limit(1)
      .single()

    if (firstStep) {
      const latestUrl = record.response_url ?? record.draft_url ?? null
      await supabase
        .from('project_steps')
        .update({
          status: '完了',
          url: latestUrl,
          step_due_date: record.draft_due_date ?? null,
        })
        .eq('id', firstStep.id)
    }

    return NextResponse.json({ updated_first_step: project.id })
  }

  // ── 完了: 全ステップを完了 ──
  if (record.status === '完了') {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('assignee', record.client_slug)
      .is('deleted_at', null)
      .single()

    if (!project) {
      return NextResponse.json({ skipped: 'no project found for client' })
    }

    const { data: remainingSteps } = await supabase
      .from('project_steps')
      .select('id')
      .eq('project_id', project.id)
      .neq('status', '完了')

    if (remainingSteps && remainingSteps.length > 0) {
      await supabase
        .from('project_steps')
        .update({ status: '完了' })
        .in('id', remainingSteps.map((s) => s.id))
    }

    return NextResponse.json({ completed: project.id })
  }

  return NextResponse.json({ skipped: 'status not matched' })
}
