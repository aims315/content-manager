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

// app_settings からプリセット一覧とクライアント↔プリセットマップを取得
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

  // クライアント専用のプリセット名を探す
  let presetName: string | null = null
  try {
    const map: Record<string, string> = JSON.parse(mapRow?.value ?? '{}')
    presetName = map[clientSlug] ?? map['default'] ?? null
  } catch { /* ignore */ }

  if (!presetName) {
    // マップ未設定の場合は最初のプリセットをデフォルトとして使用
    return presets[0] ?? null
  }

  return presets.find((p) => p.name === presetName) ?? presets[0] ?? null
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
    draft_url: string | null
    response_url: string | null
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
    const preset = await fetchPresetForClient(supabase, record.client_slug!)

    if (preset && preset.steps.length > 0) {
      const latestUrl = record.response_url ?? record.draft_url ?? null
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
        // 最新の提出URLを最初のステップにセット
        url: idx === 0 ? latestUrl : null,
      }))
      await supabase.from('project_steps').insert(stepsToInsert)
    }
    // プリセットが見つからなければステップなしで作成（空カード）

    return NextResponse.json({ created: newProject.id })
  }

  // ── 完了 ──
  if (record.status === '完了') {
    const { data: existingProject } = await supabase
      .from('projects')
      .select('id')
      .eq('assignee', record.client_slug)
      .is('deleted_at', null)
      .single()

    if (!existingProject) {
      // プロジェクトがなければ作成してそのまま完了に
      const { data: newProject } = await supabase
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
          done_override: true,
          completed_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (newProject) {
        const preset = await fetchPresetForClient(supabase, record.client_slug!)
        if (preset && preset.steps.length > 0) {
          const latestUrl = record.response_url ?? record.draft_url ?? null
          await supabase.from('project_steps').insert(
            preset.steps.map((item, idx) => ({
              project_id: newProject.id,
              step_key: 'text',
              step_order: idx,
              label: item.label,
              status: '完了',
              provider_type: item.provider === 'client' ? 'client'
                : item.provider === 'freelancer' ? 'freelancer'
                : 'self',
              url: idx === 0 ? latestUrl : null,
            }))
          )
        }
      }
      return NextResponse.json({ created_and_completed: record.client_slug })
    }

    await supabase
      .from('projects')
      .update({ done_override: true, completed_at: new Date().toISOString() })
      .eq('id', existingProject.id)

    return NextResponse.json({ completed: record.client_slug })
  }

  return NextResponse.json({ skipped: 'status not matched' })
}
