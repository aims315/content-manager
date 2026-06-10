'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProviderType } from '@/lib/types'

export interface ProviderLabels {
  client: string
  freelancer: string
  self: string
}

const DEFAULT_LABELS: ProviderLabels = {
  client: 'クライアント',
  freelancer: '外注',
  self: '自分',
}

export function useProviderLabels() {
  const supabase = createClient()
  const [labels, setLabels] = useState<ProviderLabels>(DEFAULT_LABELS)
  const [loading, setLoading] = useState(true)

  const fetchLabels = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['provider_label_client', 'provider_label_freelancer', 'provider_label_self'])
    if (data) {
      const map: Partial<ProviderLabels> = {}
      for (const row of data) {
        if (row.key === 'provider_label_client') map.client = row.value
        if (row.key === 'provider_label_freelancer') map.freelancer = row.value
        if (row.key === 'provider_label_self') map.self = row.value
      }
      setLabels({ ...DEFAULT_LABELS, ...map })
    }
    setLoading(false)
  }, [supabase])

  const updateLabel = async (type: ProviderType, value: string) => {
    const key = `provider_label_${type}`
    await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
    setLabels((prev) => ({ ...prev, [type]: value }))
  }

  useEffect(() => {
    fetchLabels()
  }, [fetchLabels])

  return { labels, loading, updateLabel }
}
