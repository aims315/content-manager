'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Task } from '@/lib/types'
import { PlusIcon, XIcon, FileIcon } from 'lucide-react'

interface ModificationDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (taskId: string, note: string, files: string[], modifiedBy: string) => Promise<boolean>
}

export function ModificationDialog({
  task,
  open,
  onOpenChange,
  onSubmit,
}: ModificationDialogProps) {
  const [note, setNote] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [modifiedBy, setModifiedBy] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddFile = () => {
    if (fileUrl.trim()) {
      setFiles([...files, fileUrl.trim()])
      setFileUrl('')
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!task || !modifiedBy.trim()) return

    setIsSubmitting(true)
    const success = await onSubmit(task.id, note, files, modifiedBy)
    setIsSubmitting(false)

    if (success) {
      setNote('')
      setFiles([])
      setModifiedBy('')
      onOpenChange(false)
    }
  }

  const handleClose = () => {
    setNote('')
    setFiles([])
    setFileUrl('')
    setModifiedBy('')
    onOpenChange(false)
  }

  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修正情報を追加</DialogTitle>
          <DialogDescription>
            「{task.title}」の修正内容を入力してください
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modifiedBy">修正者名 *</Label>
            <Input
              id="modifiedBy"
              value={modifiedBy}
              onChange={(e) => setModifiedBy(e.target.value)}
              placeholder="あなたの名前"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">修正内容</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="修正した内容を入力..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>添付ファイルURL</Label>
            <div className="flex gap-2">
              <Input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddFile()
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={handleAddFile}>
                <PlusIcon className="size-4" />
              </Button>
            </div>

            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((file, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 rounded bg-muted px-2 py-1 text-sm"
                  >
                    <FileIcon className="size-3 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{file}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-5"
                      onClick={() => handleRemoveFile(index)}
                    >
                      <XIcon className="size-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !modifiedBy.trim()}>
            {isSubmitting ? '送信中...' : '修正を送信'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
