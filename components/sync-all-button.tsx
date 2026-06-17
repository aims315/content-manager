'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCwIcon } from 'lucide-react'

export function SyncAllButton() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch('/api/sync-all', { method: 'POST' })
      const data = await res.json()
      const total = (data.upserted ?? 0) + (data.created ?? 0)
      setResult(`${data.created ?? 0}件作成・${data.upserted ?? 0}件更新`)
      setTimeout(() => setResult(null), 3000)
    } catch {
      setResult('エラー')
      setTimeout(() => setResult(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5 text-muted-foreground">
      <RefreshCwIcon className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
      {result ?? 'タスク同期'}
    </Button>
  )
}
