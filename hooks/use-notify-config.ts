'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type NotifyProvider = 'none' | 'chatwork' | 'discord'

export interface NotifyConfig {
  provider: NotifyProvider
  chatworkToken: string
  chatworkRoomId: string
  discordWebhook: string
}

export const DEFAULT_NOTIFY_CONFIG: NotifyConfig = {
  provider: 'none',
  chatworkToken: '',
  chatworkRoomId: '',
  discordWebhook: '',
}

const SETTINGS_KEY = 'notification_config'

export function useNotifyConfig() {
  const supabase = createClient()
  const [config, setConfig] = useState<NotifyConfig>(DEFAULT_NOTIFY_CONFIG)
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as Partial<NotifyConfig>
        setConfig({ ...DEFAULT_NOTIFY_CONFIG, ...parsed })
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [supabase])

  const saveConfig = async (next: NotifyConfig) => {
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
