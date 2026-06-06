'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
const TASK_AIMS_CLIENT_CODE = 'task_aims'

function normalizeClientSlug(value: string) {
  return value.toLowerCase().replace(/\s+/g, '-')
}

function parseAmount(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : NaN
}

export function TaskForm() {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [clientSlug, setClientSlug] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [draftDueDate, setDraftDueDate] = useState<Date | undefined>()
  const [existingClientSlugs, setExistingClientSlugs] = useState<string[]>([])
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

  useEffect(() => {
    async function fetchClientSlugs() {
      const [{ data: taskRows }, { data: settingRows }] = await Promise.all([
        supabase.from('tasks').select('client_slug').not('client_slug', 'is', null),
        supabase.from('client_settings').select('slug'),
      ])

      const slugs = new Set<string>()
      taskRows?.forEach((row) => {
        if (row.client_slug) slugs.add(row.client_slug)
      })
      settingRows?.forEach((row) => {
        if (row.slug) slugs.add(row.slug)
      })
      setExistingClientSlugs([...slugs].sort())
    }

    fetchClientSlugs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const normalizedClientSlug = clientSlug.trim()
    const amountValue = normalizedClientSlug === TASK_AIMS_CLIENT_CODE ? parseAmount(amount) : null
    if (Number.isNaN(amountValue)) {
      setError('金額は数値で入力してください')
      return
    }

    setIsSubmitting(true)

    const { error: insertError } = await supabase.from('tasks').insert({
      title: title.trim(),
      assignee: category,
      description: description.trim() || null,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      draft_due_date: draftDueDate ? format(draftDueDate, 'yyyy-MM-dd') : null,
      file_urls: files.uploadedFiles.map((f) => f.url),
      discord_channels: selectedChannels,
      client_slug: normalizedClientSlug || null,
      ...(normalizedClientSlug === TASK_AIMS_CLIENT_CODE ? { amount: amountValue } : {}),
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
          description: description.trim() || undefined,
          fileUrls: files.uploadedFiles.map((f) => f.url),
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
            {existingClientSlugs.length > 0 && (
              <Select
                value={existingClientSlugs.includes(clientSlug.trim()) ? clientSlug.trim() : ''}
                onValueChange={setClientSlug}
              >
                <SelectTrigger>
                  <SelectValue placeholder="以前のコードから選択" />
                </SelectTrigger>
                <SelectContent>
                  {existingClientSlugs.map((slug) => (
                    <SelectItem key={slug} value={slug}>{slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              id="clientSlug"
              value={clientSlug}
              onChange={(e) => setClientSlug(normalizeClientSlug(e.target.value))}
              placeholder="新しく入力: yamada-sangyo（英数字・ハイフン）"
            />
            {clientSlug.trim() && (
              <p className="text-xs text-muted-foreground">
                クライアントURL: <span className="font-mono text-primary">/submit/{clientSlug.trim()}</span>
              </p>
            )}
          </div>

          {clientSlug.trim() === TASK_AIMS_CLIENT_CODE && (
            <div className="space-y-2">
              <Label htmlFor="amount">金額</Label>
              <Input
                id="amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="例: 50000"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">内容・備考</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細を入力（任意）"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>初校締切日</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !draftDueDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {draftDueDate ? format(draftDueDate, 'yyyy/MM/dd', { locale: ja }) : '初校締切日を選択'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={draftDueDate} onSelect={setDraftDueDate} locale={ja} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>最終締切日</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dueDate ? format(dueDate, 'yyyy/MM/dd', { locale: ja }) : '最終締切日を選択'}
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
