'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ArchiveConfig {
  trashAfterDays: number   // 完了から何日でゴミ箱へ
  deleteAfterDays: number  // ゴミ箱から何日で完全削除
}

export const DEFAULT_ARCHIVE_CONFIG: ArchiveConfig = {
  trashAfterDays: 14,
  deleteAfterDays: 30,
}

const SETTINGS_KEY = 'archive_config'

export function useArchiveConfig() {
  const supabase = createClient()
  const [config, setConfig] = useState<ArchiveConfig>(DEFAULT_ARCHIVE_CONFIG)
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as Partial<ArchiveConfig>
        setConfig({ ...DEFAULT_ARCHIVE_CONFIG, ...parsed })
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [supabase])

  const saveConfig = async (next: ArchiveConfig) => {
    setConfig(next)
    await supabase.from('app_settings').upsert({
      key: SETTINGS_KEY,
      value: JSON.stringify(next),
      updated_at: new Date().toISOString(),
    })
  }

  useEffect(() => { fetchConfig() }, [fetchConfig])

  return { config, loading, saveConfig }
}
