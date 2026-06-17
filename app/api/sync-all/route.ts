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
  const res = await fetch(TASK_FB_URL)
  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })

  const { tasks } = await res.json()
  if (!tasks?.length) return NextResponse.json({ synced: 0 })

  const supabase = getSupabase()
  let upserted = 0
  let created = 0

  for (const task of tasks as Record<string, unknown>[]) {
    const taskId = task.id as string
    const clientSlug = task.client_slug as string
    if (!taskId || !clientSlug) continue

    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('project_code', taskId)
      .is('deleted_at', null)
      .limit(1)
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
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          title: (task.title as string) ?? '（タスクアプリから自動作成）',
          project_type: 'instagram',
          assignee: clientSlug,
          client_slug: clientSlug,
          project_code: taskId,
          due_date: task.due_date ?? null,
          amount: task.amount ?? null,
          staff: task.staff ?? null,
          description: task.description ?? null,
        })
        .select('id')
        .single()

      if (!error && newProject) {
        const preset = await fetchPresetForClient(supabase, clientSlug)
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
        created++
      }
    }
  }

  return NextResponse.json({ upserted, created })
}
