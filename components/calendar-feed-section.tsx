'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckIcon, CopyIcon, CalendarIcon, ExternalLinkIcon } from 'lucide-react'

interface Props {
  calendarUrl: string
}

export function CalendarFeedSection({ calendarUrl }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(calendarUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-2">
          <CalendarIcon className="size-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            このURLをGoogleカレンダーに登録すると、期日が設定されたタスクがカレンダーに自動表示されます。
          </p>
        </div>

        {/* URL表示・コピー */}
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs font-mono text-muted-foreground truncate">
            {calendarUrl}
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleCopy}>
            {copied ? <CheckIcon className="size-3.5 text-emerald-600" /> : <CopyIcon className="size-3.5" />}
            {copied ? 'コピー済み' : 'コピー'}
          </Button>
        </div>

        {/* 登録手順 */}
        <div className="rounded-md bg-muted/50 p-3 space-y-2">
          <p className="text-xs font-medium">Googleカレンダーへの登録手順</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>上のURLをコピー</li>
            <li>Googleカレンダーを開く → 左側「他のカレンダー」の <strong>+</strong> をクリック</li>
            <li><strong>「URLで追加」</strong> を選択</li>
            <li>URLを貼り付けて <strong>「カレンダーを追加」</strong></li>
          </ol>
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            <ExternalLinkIcon className="size-3" />
            Googleカレンダーを開く
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          ※ Googleカレンダーは数時間ごとに自動更新されます。即時反映したい場合はカレンダー設定から手動更新できます。
        </p>
      </CardContent>
    </Card>
  )
}
