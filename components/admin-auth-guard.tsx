'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LockIcon } from 'lucide-react'

const AUTH_KEY = 'admin_auth_token'

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem(AUTH_KEY)
    setAuthenticated(token === 'true')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: input }),
    })
    setLoading(false)
    if (res.ok) {
      localStorage.setItem(AUTH_KEY, 'true')
      setAuthenticated(true)
    } else {
      setError(true)
    }
  }

  if (authenticated === null) return null

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm p-8 rounded-xl border shadow-sm">
          <div className="flex flex-col items-center gap-2 mb-6">
            <LockIcon className="size-8 text-primary" />
            <h1 className="text-xl font-bold">管理画面</h1>
            <p className="text-sm text-muted-foreground">パスワードを入力してください</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="パスワード"
              autoFocus
            />
            {error && <p className="text-sm text-destructive">パスワードが違います</p>}
            <Button type="submit" className="w-full" disabled={loading || !input}>
              {loading ? '確認中...' : 'ログイン'}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
