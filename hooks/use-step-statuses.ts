'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type StatusColorKey = 'slate' | 'amber' | 'yellow' | 'sky' | 'blue' | 'violet' | 'emerald' | 'rose' | 'orange'

export interface StepStatusDef {
  id: string          // 安定したキー（変更不可）
  label: string       // 表示名 = DBに保存される値
  color: StatusColorKey
  dim?: boolean       // trueのとき該当ステップをグレーアウト
}

export const STATUS_COLOR_STYLES: Record<StatusColorKey, { badge: string; select: string; dot: string }> = {
  slate:   { badge: 'bg-slate-100 text-slate-500',     select: 'bg-slate-50 border-slate-200 text-slate-500',    dot: 'bg-slate-400' },
  amber:   { badge: 'bg-amber-100 text-amber-700',     select: 'bg-amber-50 border-amber-300 text-amber-800',    dot: 'bg-amber-400' },
  yellow:  { badge: 'bg-yellow-100 text-yellow-700',   select: 'bg-yellow-50 border-yellow-300 text-yellow-800', dot: 'bg-yellow-400' },
  sky:     { badge: 'bg-sky-100 text-sky-700',         select: 'bg-sky-50 border-sky-300 text-sky-800',          dot: 'bg-sky-400' },
  blue:    { badge: 'bg-blue-100 text-blue-700',       select: 'bg-blue-50 border-blue-300 text-blue-800',       dot: 'bg-blue-400' },
  violet:  { badge: 'bg-violet-100 text-violet-700',   select: 'bg-violet-50 border-violet-300 text-violet-800', dot: 'bg-violet-400' },
  emerald: { badge: 'bg-emerald-100 text-emerald-700', select: 'bg-emerald-50 border-emerald-200 text-emerald-600', dot: 'bg-emerald-400' },
  rose:    { badge: 'bg-rose-100 text-rose-700',       select: 'bg-rose-50 border-rose-300 text-rose-800',       dot: 'bg-rose-400' },
  orange:  { badge: 'bg-orange-100 text-orange-700',   select: 'bg-orange-50 border-orange-300 text-orange-800', dot: 'bg-orange-400' },
}

export const STATUS_COLOR_OPTIONS: StatusColorKey[] = [
  'slate', 'amber', 'yellow', 'sky', 'blue', 'violet', 'emerald', 'rose', 'orange',
]

export const STATUS_COLOR_LABELS: Record<StatusColorKey, string> = {
  slate:   'グレー',
  amber:   '琥珀',
  yellow:  'イエロー',
  sky:     'スカイ',
  blue:    'ブルー',
  violet:  'パープル',
  emerald: 'グリーン',
  rose:    'ピンク',
  orange:  'オレンジ',
}

export const DEFAULT_STATUSES: StepStatusDef[] = [
  { id: 'status_pending',     label: '未着手',   color: 'slate',   dim: false },
  { id: 'status_locked',      label: 'ロック中', color: 'slate',   dim: true  },
  { id: 'status_waiting',     label: '素材待ち', color: 'amber',   dim: false },
  { id: 'status_received',    label: '素材受領', color: 'yellow',  dim: false },
  { id: 'status_inprogress',  label: '進行中',   color: 'blue',    dim: false },
  { id: 'status_review',      label: '確認待ち', color: 'violet',  dim: false },
  { id: 'status_done',        label: '完了',     color: 'emerald', dim: true  },
]

export function useStepStatuses() {
  const supabase = createClient()
  const [statuses, setStatuses] = useState<StepStatusDef[]>(DEFAULT_STATUSES)
  const [loading, setLoading] = useState(true)

  const fetchStatuses = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'step_statuses')
      .single()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as StepStatusDef[]
        if (Array.isArray(parsed) && parsed.length > 0) setStatuses(parsed)
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [supabase])

  const saveStatuses = useCallback(async (next: StepStatusDef[]) => {
    await supabase.from('app_settings').upsert({
      key: 'step_statuses',
      value: JSON.stringify(next),
      updated_at: new Date().toISOString(),
    })
    setStatuses(next)
  }, [supabase])

  const addStatus = async () => {
    const used = statuses.map((s) => s.color)
    const colors = STATUS_COLOR_OPTIONS
    const next = colors.find((c) => !used.includes(c)) ?? 'rose'
    const newStatus: StepStatusDef = {
      id: `status_${Date.now()}`,
      label: '',
      color: next,
      dim: false,
    }
    await saveStatuses([...statuses, newStatus])
  }

  const updateStatus = async (id: string, updates: Partial<StepStatusDef>) => {
    await saveStatuses(statuses.map((s) => s.id === id ? { ...s, ...updates } : s))
  }

  /** ラベル変更 + DBのstatus値を一括更新 */
  const renameStatus = async (id: string, newLabel: string) => {
    const old = statuses.find((s) => s.id === id)
    if (!old || old.label === newLabel) return
    // DB上の既存ステップのstatus値を更新
    if (old.label && newLabel) {
      await supabase
        .from('project_steps')
        .update({ status: newLabel })
        .eq('status', old.label)
    }
    await saveStatuses(statuses.map((s) => s.id === id ? { ...s, label: newLabel } : s))
  }

  const deleteStatus = async (id: string) => {
    if (statuses.length <= 1) return
    await saveStatuses(statuses.filter((s) => s.id !== id))
  }

  const reorder = async (from: number, to: number) => {
    const arr = [...statuses]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    await saveStatuses(arr)
  }

  useEffect(() => { fetchStatuses() }, [fetchStatuses])

  return { statuses, loading, addStatus, updateStatus, renameStatus, deleteStatus, reorder, saveStatuses }
}
