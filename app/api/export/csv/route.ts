import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function getSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const TYPE_LABEL: Record<string, string> = {
  instagram: 'Instagram', twitter: 'X / Twitter', event: 'イベント',
}

function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function fmt(d: string | null): string {
  if (!d) return ''
  return d.slice(0, 10).replace(/-/g, '/')
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const secret = process.env.ADMIN_PATH_SECRET
  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (projects ?? []).map((p: any) => p.id)
  const { data: steps } = ids.length
    ? await supabase.from('project_steps').select('*').in('project_id', ids).order('step_order', { ascending: true })
    : { data: [] }

  const stepsByProject: Record<string, any[]> = {}
  for (const s of (steps ?? [])) {
    (stepsByProject[s.project_id] ??= []).push(s)
  }

  const headers = [
    '登録日', 'プロジェクト', '種別', 'コード', '納期', '完了状態',
    'ステップ', '担当', 'ステータス', 'ステップ期限', '提出URL', 'ファイル', '備考',
  ]

  const rows: string[] = [headers.map(cell).join(',')]

  for (const p of (projects ?? [])) {
    const created = fmt(p.created_at)
    const due = fmt(p.due_date)
    const typeLabel = TYPE_LABEL[p.project_type] ?? p.project_type
    const doneState = p.done_override === true ? '完了' : p.done_override === false ? '進行中' : ''
    const ps = stepsByProject[p.id] ?? []

    if (ps.length === 0) {
      rows.push([created, p.title, typeLabel, p.assignee, due, doneState, '', '', '', '', '', '', ''].map(cell).join(','))
      continue
    }
    for (const s of ps) {
      const sDue = fmt(s.step_due_date)
      const files = (s.file_names?.length ? s.file_names : (s.file_urls ?? [])).join(' | ')
      rows.push([
        created, p.title, typeLabel, p.assignee, due, doneState,
        s.label, s.provider_name ?? s.provider_type, s.status, sDue, s.url ?? '', files, s.note ?? '',
      ].map(cell).join(','))
    }
  }

  const bom = '﻿'
  return new NextResponse(bom + rows.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="projects_export.csv"`,
    },
  })
}
