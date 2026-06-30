import { createClient } from '@supabase/supabase-js'

export const DEMO_CLIENT_SLUG = 'demo'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function seedDemoProjectsIfNeeded() {
  if (process.env.ENABLE_DEMO_MODE !== 'true') return

  const supabase = getServiceSupabase()

  const { count } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('assignee', DEMO_CLIENT_SLUG)
    .is('deleted_at', null)

  if (count && count > 0) return

  const today = new Date()
  const inDays = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  const projects = [
    {
      title: 'デモ：新商品Instagram投稿',
      project_type: 'instagram',
      assignee: DEMO_CLIENT_SLUG,
      client_slug: DEMO_CLIENT_SLUG,
      due_date: inDays(7),
      discord_channels: [],
      steps: [
        { label: '構成案', provider: 'self', status: '完了' },
        { label: 'デザイン制作', provider: 'self', status: '進行中' },
        { label: 'クライアント確認', provider: 'client', status: '未着手' },
        { label: '投稿', provider: 'self', status: '未着手' },
      ],
    },
    {
      title: 'デモ：セミナー告知イベント',
      project_type: 'event',
      assignee: DEMO_CLIENT_SLUG,
      client_slug: DEMO_CLIENT_SLUG,
      due_date: inDays(14),
      discord_channels: [],
      steps: [
        { label: '構成案', provider: 'self', status: '完了' },
        { label: 'バナー制作', provider: 'freelancer', status: '完了' },
        { label: '最終チェック', provider: 'client', status: '未着手' },
      ],
    },
  ]

  for (const proj of projects) {
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        title: proj.title,
        project_type: proj.project_type,
        assignee: proj.assignee,
        client_slug: proj.client_slug,
        due_date: proj.due_date,
        discord_channels: proj.discord_channels,
      })
      .select('id')
      .single()

    if (error || !newProject) continue

    await supabase.from('project_steps').insert(
      proj.steps.map((s, i) => ({
        project_id: newProject.id,
        step_key: 'text',
        step_order: i,
        label: s.label,
        status: s.status,
        provider_type: s.provider,
        is_client_step: s.provider !== 'self',
        file_urls: [],
        file_names: [],
      }))
    )
  }
}
