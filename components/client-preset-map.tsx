'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useStepPresets } from '@/hooks/use-step-presets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2Icon, PlusIcon } from 'lucide-react'

const SETTINGS_KEY = 'client_preset_map'

export function ClientPresetMap() {
  const supabase = createClient()
  const { presets } = useStepPresets()
  const [map, setMap] = useState<Record<string, string>>({})
  const [newSlug, setNewSlug] = useState('')
  const [newPreset, setNewPreset] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', SETTINGS_KEY).single()
      .then(({ data }) => {
        if (data?.value) {
          try { setMap(JSON.parse(data.value)) } catch { /* ignore */ }
        }
      })
  }, [supabase])

  const save = async (next: Record<string, string>) => {
    setSaving(true)
    await supabase.from('app_settings').upsert({
      key: SETTINGS_KEY,
      value: JSON.stringify(next),
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
  }

  const addEntry = async () => {
    if (!newSlug.trim() || !newPreset) return
    const next = { ...map, [newSlug.trim()]: newPreset }
    setMap(next)
    await save(next)
    setNewSlug('')
    setNewPreset('')
  }

  const removeEntry = async (slug: string) => {
    const next = { ...map }
    delete next[slug]
    setMap(next)
    await save(next)
  }

  const updatePreset = async (slug: string, presetName: string) => {
    const next = { ...map, [slug]: presetName }
    setMap(next)
    await save(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">クライアント↔ステッププリセット紐づけ</h2>
        <p className="text-xs text-muted-foreground mb-4">
          タスクアプリで「投稿OK」「完了」になったとき、クライアントコードに応じたプリセットでカードを自動作成します。
          設定がないクライアントは最初のプリセットを使用します。
        </p>

        {/* 既存マッピング一覧 */}
        <div className="space-y-2 mb-4">
          {Object.entries(map).map(([slug, presetName]) => (
            <div key={slug} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{slug}</span>
              </div>
              <Select value={presetName} onValueChange={(v) => updatePreset(slug, v)}>
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost" size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeEntry(slug)}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))}

          {Object.keys(map).length === 0 && (
            <p className="text-xs text-muted-foreground">紐づけがまだありません</p>
          )}
        </div>

        {/* 新規追加 */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="クライアントコード（例: sincol）"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            className="h-8 text-sm flex-1"
          />
          <Select value={newPreset} onValueChange={setNewPreset}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder="プリセットを選択" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((p) => (
                <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon" className="size-8"
            onClick={addEntry}
            disabled={!newSlug.trim() || !newPreset || saving}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
