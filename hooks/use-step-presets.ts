'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface StepPresetItem {
  label: string
  provider: string   // role id（self / client / freelancer / カスタム）
}

export interface StepPreset {
  id: string
  name: string
  steps: StepPresetItem[]
}

const SETTINGS_KEY = 'step_presets'

export function useStepPresets() {
  const supabase = createClient()
  const [presets, setPresets] = useState<StepPreset[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPresets = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value) as StepPreset[]
        if (Array.isArray(parsed)) setPresets(parsed)
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [supabase])

  const save = async (next: StepPreset[]) => {
    setPresets(next)
    await supabase.from('app_settings').upsert({
      key: SETTINGS_KEY,
      value: JSON.stringify(next),
      updated_at: new Date().toISOString(),
    })
  }

  const addPreset = async (name: string, steps: StepPresetItem[]) => {
    const preset: StepPreset = { id: `preset_${Date.now()}`, name, steps }
    await save([...presets, preset])
    return preset
  }

  const deletePreset = async (id: string) => {
    await save(presets.filter((p) => p.id !== id))
  }

  useEffect(() => { fetchPresets() }, [fetchPresets])

  return { presets, loading, addPreset, deletePreset, refetch: fetchPresets }
}
