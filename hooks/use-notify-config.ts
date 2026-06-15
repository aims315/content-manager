'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type NotifyProvider = 'none' | 'chatwork' | 'discord'

// コードごとの通知先ルート
export interface NotifyRoute {
  id: string
  code: string                 // プロジェクトコード（assignee）
  provider: NotifyProvider     // このコードの通知先サービス
  chatworkRoomId: string
  discordWebhook: string
}

export interface NotifyConfig {
  provider: NotifyProvider
  chatworkToken: string        // Chatworkトークンは共通（ルームIDだけコード別）
  chatworkRoomId: string
  discordWebhook: string
  routes: NotifyRoute[]        // コード別の通知先
}

export const DEFAULT_NOTIFY_CONFIG: NotifyConfig = {
  provider: 'none',
  chatworkToken: '',
  chatworkRoomId: '',
  discordWebhook: '',
  routes: [],
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
