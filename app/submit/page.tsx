'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const STORAGE_KEY = 'client_slug'

export default function SubmitLandingPage() {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      router.replace(`/submit/${saved}`)
    }
  }, [router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = slug.trim().toLowerCase()
    if (!trimmed) {
      setError('クライアントコードを入力してください')
      return
    }
    localStorage.setItem(STORAGE_KEY, trimmed)
    router.push(`/submit/${trimmed}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">タスク管理ポータル</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="slug">クライアントコード</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setError('') }}
                placeholder="例: alsok"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              ポータルへ進む
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
