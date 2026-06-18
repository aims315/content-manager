'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// コードごとに、クライアントページ(/c/コード)で隠す担当ロールID
export type ClientDisplayConfig = Record<string, { hiddenRoles: string[] }>

const SETTINGS_KEY = 'client_display_config'

export function useClientDisplayConfig() {
  const supabase = createClient()
  const [config, setConfig] = useState<ClientDisplayConfig>({})
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value)
        if (parsed && typeof parsed === 'object') setConfig(parsed)
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [supabase])

  const saveConfig = async (next: ClientDisplayConfig) => {
    setConfig(next)
    await supabase.from('app_settings').upsert({
      key: SETTINGS_KEY,
      value: JSON.stringify(next),
      updated_at: new Date().toISOString(),
    })
  }

  const setHiddenRoles = async (code: string, hiddenRoles: string[]) => {
    await saveConfig({ ...config, [code]: { hiddenRoles } })
  }

  useEffect(() => { fetchConfig() }, [fetchConfig])

  return { config, loading, saveConfig, setHiddenRoles }
}
