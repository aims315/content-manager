'use client'

import { useState } from 'react'
import type { TaskRevision } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDownIcon, ChevronUpIcon, ClockIcon } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

interface TaskRevisionSectionProps {
  revisions: TaskRevision[]
  onSubmit: (note: string, createdBy: string) => Promise<boolean>
}

export function TaskRevisionSection({ revisions, onSubmit }: TaskRevisionSectionProps) {
  const [note, setNote] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const latest = revisions[0]
  const older = revisions.slice(1)

  const handleSubmit = async () => {
    if (!note.trim() || !createdBy.trim()) return
    setIsSubmitting(true)
    const success = await onSubmit(note.trim(), createdBy.trim())
    setIsSubmitting(false)
    if (success) {
      setNote('')
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {/* 最新の修正指示 */}
      {latest && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm dark:bg-amber-950 dark:border-amber-800">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-amber-800 dark:text-amber-200">最新の修正指示</span>
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <ClockIcon className="size-3" />
              {format(parseISO(latest.created_at), 'MM/dd HH:mm', { locale: ja })}
            </span>
          </div>
          <p className="text-amber-900 dark:text-amber-100">{latest.note}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">by {latest.created_by}</p>
        </div>
      )}

      {/* 履歴（折り畳み） */}
      {older.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground px-2">
              {historyOpen ? <ChevronUpIcon className="size-3 mr-1" /> : <ChevronDownIcon className="size-3 mr-1" />}
              過去の修正履歴 ({older.length}件)
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {older.map((rev) => (
              <div key={rev.id} className="rounded-md bg-muted p-2 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{rev.created_by}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ClockIcon className="size-3" />
                    {format(parseISO(rev.created_at), 'MM/dd HH:mm', { locale: ja })}
                  </span>
                </div>
                <p className="text-foreground">{rev.note}</p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 新規修正指示入力 */}
      <div className="space-y-2">
        <Input
          value={createdBy}
          onChange={(e) => setCreatedBy(e.target.value)}
          placeholder="あなたの名前"
          className="h-8 text-sm"
        />
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="修正指示を入力..."
          rows={2}
          className="text-sm resize-none"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || !note.trim() || !createdBy.trim()}
          className="w-full h-8"
        >
          {isSubmitting ? '送信中...' : '修正指示を送信'}
        </Button>
      </div>
    </div>
  )
}
