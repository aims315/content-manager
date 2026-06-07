'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckIcon, CopyIcon, TableIcon, ExternalLinkIcon, DownloadIcon } from 'lucide-react'

interface Props {
  exportUrl: string
}

export function DeliveryExportSection({ exportUrl }: Props) {
  const [copied, setCopied] = useState(false)
  const formula = `=IMPORTDATA("${exportUrl}","\\t")`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formula)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-2">
          <TableIcon className="size-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            「投稿OK」「完了」のタスクの納品リンク・ファイルをGoogleスプレッドシートに自動取り込みできます。
          </p>
        </div>

        {/* Googleスプレッドシート手順 */}
        <div className="rounded-md bg-muted/50 p-3 space-y-2">
          <p className="text-xs font-medium">Googleスプレッドシートへの設定手順</p>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Googleスプレッドシートを新規作成して開く</li>
            <li>A1セルをクリックして以下の数式をコピーして貼り付ける</li>
            <li>Enterキーを押すと自動でデータが読み込まれる</li>
          </ol>
        </div>

        {/* 数式表示・コピー */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">A1セルに貼り付ける数式：</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs font-mono text-muted-foreground truncate">
              {formula}
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleCopy}>
              {copied ? <CheckIcon className="size-3.5 text-emerald-600" /> : <CopyIcon className="size-3.5" />}
              {copied ? 'コピー済み' : 'コピー'}
            </Button>
          </div>
        </div>

        {/* 含まれる列 */}
        <div className="rounded-md border p-3 space-y-1.5">
          <p className="text-xs font-medium">含まれるデータ</p>
          <p className="text-xs text-muted-foreground">
            タイトル・クライアント・ステータス・担当者・期限・金額・内容・
            <strong>初校URL・初校備考・初校ファイル</strong>・
            <strong>納品URL・納品備考・納品ファイル</strong>・完了日
          </p>
        </div>

        <div className="flex gap-2">
          <a
            href="https://sheets.new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLinkIcon className="size-3" />
            Googleスプレッドシートを新規作成
          </a>
          <span className="text-xs text-muted-foreground">·</span>
          <a
            href={exportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <DownloadIcon className="size-3" />
            CSVを直接ダウンロード
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          ※ スプレッドシートは1時間ごとに自動更新されます。手動更新は数式セルを選択して再入力してください。
        </p>
      </CardContent>
    </Card>
  )
}
