'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface DeadlineConfig {
  warningDays: number   // 締切まで何日以内でバッジを出すか
  reminderDays: number  // 締切の何日前から通知を送るか（全体の既定）
}

export const DEFAULT_DEADLINE_CONFIG: DeadlineConfig = {
  warningDays: 5,
  reminderDays: 3,
}

const SETTINGS_KEY = 'deadline_config'

export function useDeadlineConfig() {
  const supabase = createClient()
  const [config, setConfig] = useState<DeadlineConfig>(DEFAULT_DEADLINE_CONFIG)
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as Partial<DeadlineConfig>
        setConfig({ ...DEFAULT_DEADLINE_CONFIG, ...parsed })
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [supabase])

  const saveConfig = async (next: DeadlineConfig) => {
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
