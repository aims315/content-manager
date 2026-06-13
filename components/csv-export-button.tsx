'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { DownloadIcon } from 'lucide-react'
import { format } from 'date-fns'

// CSVセル：カンマ・改行・ダブルクォートを安全にエスケープ
function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

const TYPE_LABEL: Record<string, string> = {
  instagram: 'Instagram', twitter: 'X / Twitter', event: 'イベント',
}

export function CsvExportButton() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      const ids = (projects ?? []).map((p) => p.id)
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
        const created = p.created_at ? format(new Date(p.created_at), 'yyyy/MM/dd') : ''
        const due = p.due_date ? format(new Date(p.due_date), 'yyyy/MM/dd') : ''
        const typeLabel = TYPE_LABEL[p.project_type] ?? p.project_type
        const doneState = p.done_override === true ? '完了' : p.done_override === false ? '進行中' : ''
        const ps = stepsByProject[p.id] ?? []

        if (ps.length === 0) {
          rows.push([created, p.title, typeLabel, p.assignee, due, doneState, '', '', '', '', '', '', ''].map(cell).join(','))
          continue
        }
        for (const s of ps) {
          const sDue = s.step_due_date ? format(new Date(s.step_due_date), 'yyyy/MM/dd') : ''
          const files = (s.file_names && s.file_names.length ? s.file_names : (s.file_urls ?? [])).join(' | ')
          rows.push([
            created, p.title, typeLabel, p.assignee, due, doneState,
            s.label, s.provider_name ?? s.provider_type, s.status, sDue, s.url ?? '', files, s.note ?? '',
          ].map(cell).join(','))
        }
      }

      // Excelで文字化けしないようBOM付きUTF-8
      const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `コンテンツ制作管理_${format(new Date(), 'yyyyMMdd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={handleExport} disabled={loading}>
      <DownloadIcon className="size-3.5" />
      {loading ? '出力中...' : 'CSV出力'}
    </Button>
  )
}
