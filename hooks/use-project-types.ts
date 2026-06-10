'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface CustomProjectType {
  id: string      // DBに保存される値（slug形式）
  label: string   // 表示名
  emoji: string   // 絵文字アイコン
  color: string   // テキスト色クラス (Tailwind)
  bgColor: string // 背景色クラス (Tailwind)
}

// 組み込みタイプ（変更不可）
export const BUILTIN_TYPES = ['instagram', 'twitter', 'event'] as const

export const DEFAULT_CUSTOM_TYPES: CustomProjectType[] = []

// カスタムタイプ用の色セット
export const TYPE_COLOR_OPTIONS: { color: string; bgColor: string; label: string }[] = [
  { color: 'text-pink-600',    bgColor: 'bg-pink-100',    label: 'ピンク' },
  { color: 'text-sky-600',     bgColor: 'bg-sky-100',     label: 'スカイ' },
  { color: 'text-violet-600',  bgColor: 'bg-violet-100',  label: 'パープル' },
  { color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'グリーン' },
  { color: 'text-amber-600',   bgColor: 'bg-amber-100',   label: 'アンバー' },
  { color: 'text-rose-600',    bgColor: 'bg-rose-100',    label: 'ローズ' },
  { color: 'text-blue-600',    bgColor: 'bg-blue-100',    label: 'ブルー' },
  { color: 'text-orange-600',  bgColor: 'bg-orange-100',  label: 'オレンジ' },
  { color: 'text-teal-600',    bgColor: 'bg-teal-100',    label: 'ティール' },
]

// よく使う絵文字候補
export const EMOJI_PRESETS = ['📝', '📊', '🎯', '💡', '🎬', '🎵', '📧', '📢', '🎨', '📸', '🎪', '🛍️', '📰', '🎤', '💬', '🌐', '📱', '🏷️']

export function useProjectTypes() {
  const supabase = createClient()
  const [customTypes, setCustomTypes] = useState<CustomProjectType[]>(DEFAULT_CUSTOM_TYPES)
  const [loading, setLoading] = useState(true)

  const fetchTypes = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'custom_project_types')
      .single()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as CustomProjectType[]
        if (Array.isArray(parsed)) setCustomTypes(parsed)
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [supabase])

  const saveTypes = useCallback(async (next: CustomProjectType[]) => {
    await supabase.from('app_settings').upsert({
      key: 'custom_project_types',
      value: JSON.stringify(next),
      updated_at: new Date().toISOString(),
    })
    setCustomTypes(next)
  }, [supabase])

  const addType = async (label: string, emoji: string, colorIdx: number) => {
    const col = TYPE_COLOR_OPTIONS[colorIdx] ?? TYPE_COLOR_OPTIONS[0]
    const id = `custom_${Date.now()}`
    const newType: CustomProjectType = {
      id, label, emoji,
      color: col.color,
      bgColor: col.bgColor,
    }
    await saveTypes([...customTypes, newType])
    return id
  }

  const updateType = async (id: string, updates: Partial<CustomProjectType>) => {
    await saveTypes(customTypes.map((t) => t.id === id ? { ...t, ...updates } : t))
  }

  const deleteType = async (id: string) => {
    await saveTypes(customTypes.filter((t) => t.id !== id))
  }

  useEffect(() => { fetchTypes() }, [fetchTypes])

  return { customTypes, loading, addType, updateType, deleteType, saveTypes }
}
