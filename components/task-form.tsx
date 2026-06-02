'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileUpload } from '@/components/file-upload'
import { useFileUpload } from '@/hooks/use-file-upload'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = ['デザイン', '動画', 'その他'] as const

export function TaskForm() {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [clientSlug, setClientSlug] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [availableChannels, setAvailableChannels] = useState<string[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const files = useFileUpload()

  useEffect(() => {
    fetch('/api/discord/notify')
      .then((r) => r.json())
      .then((data) => {
        if (data.channels && data.channels.length > 0) {
          setAvailableChannels(data.channels)
          setSelectedChannels(data.channels)
        }
      })
      .catch(() => {})
  }, [])

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim() || !category) {
      setError('タイトルとカテゴリは必須です')
      return
    }

    setIsSubmitting(true)

    const { error: insertError } = await supabase.from('tasks').insert({
      title: title.trim(),
      assignee: category,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      file_urls: files.uploadedFiles.map((f) => f.url),
      discord_channels: selectedChannels,
      client_slug: clientSlug.trim() || null,
    })

    if (insertError) {
      setError('タスクの作成に失敗しました')
      setIsSubmitting(false)
      return
    }

    try {
      await fetch('/api/discord/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'created',
          title: title.trim(),
          assignee: category,
          dueDate: dueDate ? format(dueDate, 'yyyy/MM/dd') : null,
          channels: selectedChannels,
        }),
      })
    } catch {}

    router.push('/')
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>新規タスク作成</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>カテゴリ *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="カテゴリを選択" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">タイトル *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タスクのタイトルを入力"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSlug">
              クライアントコード
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                （設定すると /submit/[コード] でクライアントに専用URLを発行）
              </span>
            </Label>
            <Input
              id="clientSlug"
              value={clientSlug}
              onChange={(e) => setClientSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="例: yamada-sangyo（英数字・ハイフン）"
            />
            {clientSlug.trim() && (
              <p className="text-xs text-muted-foreground">
                クライアントURL: <span className="font-mono text-primary">/submit/{clientSlug.trim()}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>期限日</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dueDate ? format(dueDate, 'yyyy/MM/dd', { locale: ja }) : '期限日を選択'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ja} />
              </PopoverContent>
            </Popover>
          </div>

          <FileUpload
            uploadedFiles={files.uploadedFiles}
            isUploading={files.isUploading}
            uploadError={files.uploadError}
            onUpload={files.uploadFiles}
            onRemove={files.removeFile}
          />

          {availableChannels.length > 0 && (
            <div className="space-y-2">
              <Label>通知チャンネル</Label>
              <div className="space-y-2 rounded-md border p-3">
                {availableChannels.map((channel) => (
                  <div key={channel} className="flex items-center gap-2">
                    <Checkbox
                      id={`channel-${channel}`}
                      checked={selectedChannels.includes(channel)}
                      onCheckedChange={() => toggleChannel(channel)}
                    />
                    <label htmlFor={`channel-${channel}`} className="text-sm cursor-pointer">
                      # {channel}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => router.push('/')} className="flex-1">
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting || files.isUploading} className="flex-1">
              {isSubmitting ? '作成中...' : 'タスクを作成'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
