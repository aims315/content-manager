import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function formatDate(str: string | null) {
  if (!str) return ''
  try { return format(parseISO(str), 'yyyy/MM/dd', { locale: ja }) } catch { return str }
}

function formatAmount(amount: number | null) {
  if (amount == null) return ''
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
}

function csvCell(value: string) {
  // 改行・タブをスペースに置換してからCSVエスケープ
  const cleaned = String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\t/g, ' ')
    .trim()
  return `"${cleaned.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  // 簡易認証
  const token = request.nextUrl.searchParams.get('token')
  if (process.env.ADMIN_PATH_SECRET && token !== process.env.ADMIN_PATH_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = getSupabase()
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .in('status', ['初校提出', '修正対応完了', '投稿OK', '完了'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return new NextResponse('Error', { status: 500 })

  const cols = [
    '登録日', 'タイトル', 'クライアント', 'カテゴリ', 'ステータス', '内容',
    '初校URL', '初校備考', '初校ファイル',
    '納品URL', '納品備考', '納品ファイル',
    '完了日', '担当者', '期限', '金額',
  ]

  const rows = (tasks || []).map(task => {
    const draftFiles = (task.draft_file_urls ?? []).join(' | ')
    const responseFiles = (task.response_file_urls ?? []).join(' | ')

    return [
      formatDate(task.created_at),
      task.title,
      task.client_slug ?? '',
      task.assignee,
      task.status,
      task.description ?? '',
      task.draft_url ?? '',
      task.draft_note ?? '',
      draftFiles,
      task.response_url ?? '',
      task.response_note ?? '',
      responseFiles,
      formatDate(task.completed_at),
      task.staff ?? '',
      formatDate(task.due_date),
      formatAmount(task.amount),
    ].map(csvCell).join(',')
  })

  const csv = [cols.map(csvCell).join(','), ...rows].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
