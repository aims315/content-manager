'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ProviderRole {
  id: string
  label: string
  color: 'amber' | 'violet' | 'sky' | 'emerald' | 'rose' | 'orange'
}

export const DEFAULT_ROLES: ProviderRole[] = [
  { id: 'client', label: 'フォレスト出版', color: 'amber' },
  { id: 'freelancer', label: 'チアプロ', color: 'violet' },
  { id: 'self', label: '山中チーム', color: 'sky' },
]

export const COLOR_STYLES: Record<ProviderRole['color'], { badge: string; button: string }> = {
  amber:   { badge: 'bg-amber-100 text-amber-800',   button: 'bg-amber-100 text-amber-800 border-amber-300' },
  violet:  { badge: 'bg-violet-100 text-violet-800', button: 'bg-violet-100 text-violet-800 border-violet-300' },
  sky:     { badge: 'bg-sky-100 text-sky-800',       button: 'bg-sky-100 text-sky-800 border-sky-300' },
  emerald: { badge: 'bg-emerald-100 text-emerald-800', button: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  rose:    { badge: 'bg-rose-100 text-rose-800',     button: 'bg-rose-100 text-rose-800 border-rose-300' },
  orange:  { badge: 'bg-orange-100 text-orange-800', button: 'bg-orange-100 text-orange-800 border-orange-300' },
}

// 後方互換: provider_type文字列からlabelを取得
export type ProviderLabels = Record<string, string>

export function useProviderLabels() {
  const supabase = createClient()
  const [roles, setRoles] = useState<ProviderRole[]>(DEFAULT_ROLES)
  const [loading, setLoading] = useState(true)

  const fetchRoles = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'provider_roles')
      .single()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as ProviderRole[]
        if (Array.isArray(parsed) && parsed.length > 0) setRoles(parsed)
      } catch { /* ignore */ }
    } else {
      // 旧形式からマイグレーション
      const { data: old } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['provider_label_client', 'provider_label_freelancer', 'provider_label_self'])
      if (old && old.length > 0) {
        const map: Record<string, string> = {}
        old.forEach((r) => { map[r.key] = r.value })
        const migrated: ProviderRole[] = [
          { id: 'client', label: map['provider_label_client'] || 'Role A', color: 'amber' },
          { id: 'freelancer', label: map['provider_label_freelancer'] || 'Role B', color: 'violet' },
          { id: 'self', label: map['provider_label_self'] || 'Role C', color: 'sky' },
        ]
        setRoles(migrated)
        await saveRoles(migrated)
      }
    }
    setLoading(false)
  }, [supabase])

  const saveRoles = async (newRoles: ProviderRole[]) => {
    await supabase.from('app_settings').upsert({
      key: 'provider_roles',
      value: JSON.stringify(newRoles),
      updated_at: new Date().toISOString(),
    })
    setRoles(newRoles)
  }

  const addRole = async () => {
    const colors: ProviderRole['color'][] = ['emerald', 'rose', 'orange', 'amber', 'violet', 'sky']
    const usedColors = roles.map((r) => r.color)
    const nextColor = colors.find((c) => !usedColors.includes(c)) ?? 'emerald'
    const newRole: ProviderRole = {
      id: `role_${Date.now()}`,
      label: '',
      color: nextColor,
    }
    await saveRoles([...roles, newRole])
  }

  const updateRole = async (id: string, updates: Partial<ProviderRole>) => {
    const updated = roles.map((r) => r.id === id ? { ...r, ...updates } : r)
    await saveRoles(updated)
  }

  const deleteRole = async (id: string) => {
    await saveRoles(roles.filter((r) => r.id !== id))
  }

  // 後方互換用: provider_type → label のマップ
  const labels: ProviderLabels = {}
  roles.forEach((r) => { labels[r.id] = r.label })

  useEffect(() => { fetchRoles() }, [fetchRoles])

  return { roles, labels, loading, addRole, updateRole, deleteRole, saveRoles }
}
