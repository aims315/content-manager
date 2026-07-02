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

// task_fb タスクIDでプロジェクトを検索（project_code に保存）
async function findProjectByTaskId(supabase: ReturnType<typeof getSupabase>, taskId: string) {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('project_code', taskId)
    .is('deleted_at', null)
    .limit(1)
    .single()
  return data
}

export async function POST(request: NextRequest) {
  if (process.env.ENABLE_TASK_SYNC !== 'true') {
    return NextResponse.json({ error: 'Task sync is disabled for this deployment' }, { status: 403 })
  }
  const secret = request.headers.get('x-sync-secret')
  if (process.env.SYNC_SECRET && secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const eventType: string = body.type
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
    custom_deadlines: unknown[] | null
  }
  const oldRecord = body.old_record as { status?: string } | undefined

  if (!record?.client_slug) {
    return NextResponse.json({ skipped: 'no client_slug' })
  }

  const supabase = getSupabase()

  // ── INSERT: カード新規作成 ──
  if (eventType === 'INSERT') {
    const existing = await findProjectByTaskId(supabase, record.id)
    if (existing) return NextResponse.json({ skipped: 'project already exists' })

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        title: record.title ?? '（タスクアプリから自動作成）',
        project_type: 'instagram',
        assignee: record.client_slug,
        client_slug: record.client_slug,
        project_code: record.id, // task_fb タスクID
        due_date: record.due_date,
        amount: record.amount,
        staff: record.staff,
        description: record.description,
        custom_dates: record.custom_deadlines ?? [],
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

  // ── UPSERT: 手動同期（カード作成 or 情報更新） ──
  if (eventType === 'UPSERT') {
    const existing = await findProjectByTaskId(supabase, record.id)

    if (existing) {
      await supabase
        .from('projects')
        .update({
          title: record.title ?? undefined,
          due_date: record.due_date ?? null,
          amount: record.amount ?? null,
          staff: record.staff ?? null,
          description: record.description ?? null,
          custom_dates: record.custom_deadlines ?? [],
        })
        .eq('id', existing.id)
      return NextResponse.json({ updated: existing.id })
    }

    // 新規作成
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        title: record.title ?? '（タスクアプリから自動作成）',
        project_type: 'instagram',
        assignee: record.client_slug,
        client_slug: record.client_slug,
        project_code: record.id,
        due_date: record.due_date,
        amount: record.amount,
        staff: record.staff,
        description: record.description,
        custom_dates: record.custom_deadlines ?? [],
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
    const project = await findProjectByTaskId(supabase, record.id)
    if (!project) return NextResponse.json({ skipped: 'no project found' })

    const { data: firstStep } = await supabase
      .from('project_steps')
      .select('id')
      .eq('project_id', project.id)
      .order('step_order', { ascending: true })
      .limit(1)
      .single()

    if (firstStep) {
      await supabase
        .from('project_steps')
        .update({
          status: '完了',
          url: record.response_url ?? record.draft_url ?? null,
          step_due_date: record.draft_due_date ?? null,
        })
        .eq('id', firstStep.id)
    }

    return NextResponse.json({ updated_first_step: project.id })
  }

  // ── 完了: 「クリエイティブ完了」ステップを追加して完了表示にする（既存ステップは変更しない） ──
  if (record.status === '完了') {
    const project = await findProjectByTaskId(supabase, record.id)
    if (!project) return NextResponse.json({ skipped: 'no project found' })

    const { data: steps } = await supabase
      .from('project_steps')
      .select('id, label, step_order')
      .eq('project_id', project.id)

    // 既に「クリエイティブ完了」があれば重複追加しない（完了にだけ更新）
    const existing = (steps ?? []).find((s) => s.label === 'クリエイティブ完了')
    if (existing) {
      await supabase.from('project_steps').update({ status: '完了' }).eq('id', existing.id)
      return NextResponse.json({ completed: project.id, step: 'existing' })
    }

    const maxOrder = (steps ?? []).reduce((m, s) => Math.max(m, s.step_order ?? 0), 0)
    await supabase.from('project_steps').insert({
      project_id: project.id,
      step_key: 'text',
      step_order: maxOrder + 1,
      label: 'クリエイティブ完了',
      status: '完了',
      provider_type: 'self',
      provider_name: null,
      file_urls: [],
      file_names: [],
      is_client_step: false,
    })

    return NextResponse.json({ completed: project.id, step: 'added' })
  }

  return NextResponse.json({ skipped: 'status not matched' })
}
