import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TASK_FB_URL = 'https://flickboxtask.vercel.app/api/tasks-export'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface StepPresetItem { label: string; provider: string }
interface StepPreset { id: string; name: string; steps: StepPresetItem[] }

async function fetchPresetForClient(supabase: ReturnType<typeof getSupabase>, clientSlug: string): Promise<StepPreset | null> {
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

export async function POST(_request: NextRequest) {
  if (process.env.ENABLE_TASK_SYNC !== 'true') {
    return NextResponse.json({ error: 'Task sync is disabled for this deployment' }, { status: 403 })
  }
  const res = await fetch(TASK_FB_URL)
  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })

  const { tasks } = await res.json()
  if (!tasks?.length) return NextResponse.json({ synced: 0 })

  const supabase = getSupabase()

  // プリセット情報を一度だけ取得（全タスク共通）
  const { data: settingsRows } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['step_presets', 'client_preset_map'])

  const presetsRow = settingsRows?.find((r) => r.key === 'step_presets')
  const mapRow = settingsRows?.find((r) => r.key === 'client_preset_map')
  let allPresets: StepPreset[] = []
  let presetMap: Record<string, string> = {}
  try { allPresets = JSON.parse(presetsRow?.value ?? '[]') } catch { /* ignore */ }
  try { presetMap = JSON.parse(mapRow?.value ?? '{}') } catch { /* ignore */ }

  const getPreset = (clientSlug: string): StepPreset | null => {
    const name = presetMap[clientSlug] ?? presetMap['default'] ?? null
    if (!name) return allPresets[0] ?? null
    return allPresets.find((p) => p.name === name) ?? allPresets[0] ?? null
  }

  // 初校締切（draft_due_date）を「初校」ラベルのカスタム締切として合成
  const buildCustomDates = (task: Record<string, unknown>) => {
    const base = (task.custom_deadlines as { label: string; date: string }[] | null) ?? []
    const withoutDraft = base.filter((cd) => cd.label !== '初校')
    const draftDueDate = task.draft_due_date as string | null
    return draftDueDate
      ? [{ label: '初校', date: draftDueDate }, ...withoutDraft]
      : withoutDraft
  }

  // 既存プロジェクトを一括取得
  const { data: existingProjects } = await supabase
    .from('projects')
    .select('id, project_code')
    .is('deleted_at', null)
    .not('project_code', 'is', null)

  const existingMap = new Map((existingProjects ?? []).map((p) => [p.project_code, p.id]))

  const validTasks = (tasks as Record<string, unknown>[]).filter(
    (t) => t.id && t.client_slug
  )

  // 更新対象と新規作成対象に分類
  const toUpdate = validTasks.filter((t) => existingMap.has(t.id as string))
  const toCreate = validTasks.filter((t) => !existingMap.has(t.id as string))

  // 更新対象プロジェクトの「最初のステップ」を一括取得（初稿締切の反映先）
  const updateProjectIds = toUpdate.map((t) => existingMap.get(t.id as string)!)
  const { data: firstSteps } = updateProjectIds.length
    ? await supabase
        .from('project_steps')
        .select('id, project_id, step_order, label')
        .in('project_id', updateProjectIds)
        .order('step_order', { ascending: true })
    : { data: [] as { id: string; project_id: string; step_order: number; label: string }[] }

  const firstStepMap = new Map<string, string>()
  // プロジェクトごとの最大 step_order と「クリエイティブ完了」ステップの有無
  const maxOrderMap = new Map<string, number>()
  const creativeDoneMap = new Map<string, string>()
  for (const step of firstSteps ?? []) {
    if (!firstStepMap.has(step.project_id)) firstStepMap.set(step.project_id, step.id)
    maxOrderMap.set(step.project_id, Math.max(maxOrderMap.get(step.project_id) ?? 0, step.step_order ?? 0))
    if (step.label === 'クリエイティブ完了') creativeDoneMap.set(step.project_id, step.id)
  }

  // 並列で更新
  await Promise.all(
    toUpdate.map(async (task) => {
      const projectId = existingMap.get(task.id as string)!
      await supabase
        .from('projects')
        .update({
          title: task.title ?? undefined,
          due_date: task.due_date ?? null,
          amount: task.amount ?? null,
          staff: task.staff ?? null,
          description: task.description ?? null,
          custom_dates: buildCustomDates(task),
          draft_url: (task.draft_url as string | null) ?? null,
          response_url: (task.response_url as string | null) ?? null,
        })
        .eq('id', projectId)

      // 初稿締切（draft_due_date）を先頭ステップの期日に反映
      const firstStepId = firstStepMap.get(projectId)
      if (firstStepId) {
        await supabase
          .from('project_steps')
          .update({ step_due_date: (task.draft_due_date as string | null) ?? null })
          .eq('id', firstStepId)
      }

      // タスクが完了なら「クリエイティブ完了」ステップを追加（既存ステップは変更しない）
      if (task.status === '完了') {
        const existingId = creativeDoneMap.get(projectId)
        if (existingId) {
          await supabase.from('project_steps').update({ status: '完了' }).eq('id', existingId)
        } else {
          await supabase.from('project_steps').insert({
            project_id: projectId,
            step_key: 'text',
            step_order: (maxOrderMap.get(projectId) ?? 0) + 1,
            label: 'クリエイティブ完了',
            status: '完了',
            provider_type: 'self',
            provider_name: null,
            file_urls: [],
            file_names: [],
            is_client_step: false,
          })
        }
      }
    })
  )

  // 並列で新規作成
  const createResults = await Promise.all(
    toCreate.map(async (task) => {
      const clientSlug = task.client_slug as string
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          title: (task.title as string) ?? '（タスクアプリから自動作成）',
          project_type: 'instagram',
          assignee: clientSlug,
          client_slug: clientSlug,
          project_code: task.id as string,
          due_date: task.due_date ?? null,
          amount: task.amount ?? null,
          staff: task.staff ?? null,
          description: task.description ?? null,
          custom_dates: buildCustomDates(task),
          draft_url: (task.draft_url as string | null) ?? null,
          response_url: (task.response_url as string | null) ?? null,
        })
        .select('id')
        .single()

      if (error) return { ok: false, error: error.message }

      if (newProject) {
        const preset = getPreset(clientSlug)
        if (preset && preset.steps.length > 0) {
          await supabase.from('project_steps').insert(
            preset.steps.map((item, idx) => ({
              project_id: newProject.id,
              step_key: 'text',
              step_order: idx,
              label: item.label,
              status: '未着手',
              step_due_date: idx === 0 ? ((task.draft_due_date as string | null) ?? null) : null,
              provider_type: item.provider === 'client' ? 'client'
                : item.provider === 'freelancer' ? 'freelancer'
                : 'self',
            }))
          )
        }
      }
      return { ok: true }
    })
  )

  const created = createResults.filter((r) => r.ok).length
  const insertErrors = createResults.filter((r) => !r.ok).map((r) => (r as { ok: false; error: string }).error)

  return NextResponse.json({
    upserted: toUpdate.length,
    created,
    errors: insertErrors.length > 0 ? insertErrors.slice(0, 3) : undefined,
  })
}
