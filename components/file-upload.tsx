'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { UploadIcon, XIcon, FileIcon, AlertCircleIcon, Loader2Icon, DownloadIcon } from 'lucide-react'
import type { UploadedFile } from '@/hooks/use-file-upload'

interface FileUploadProps {
  uploadedFiles: UploadedFile[]
  isUploading: boolean
  uploadError?: string | null
  onUpload: (files: FileList) => void
  onRemove: (index: number) => void
}

function downloadFile(url: string, _filename: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function FileUpload({ uploadedFiles, isUploading, uploadError, onUpload, onRemove }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <Label>添付ファイル</Label>

      <div
        className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
          isUploading ? 'opacity-60 pointer-events-none' : 'hover:bg-muted/50'
        }`}
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (!isUploading && e.dataTransfer.files.length > 0) onUpload(e.dataTransfer.files)
        }}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-1">
            <Loader2Icon className="size-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">アップロード中...</p>
          </div>
        ) : (
          <>
            <UploadIcon className="size-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">クリックまたはドラッグ＆ドロップ</p>
            <p className="text-xs text-muted-foreground mt-0.5">画像・PDF・動画など</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) { onUpload(e.target.files); e.target.value = '' } }}
        />
      </div>

      {uploadError && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-1">
          {uploadedFiles.map((file, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-foreground">{file.name}</span>
              <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0"
                title="ダウンロード"
                onClick={() => downloadFile(file.url, file.name)}>
                <DownloadIcon className="size-3" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0"
                onClick={() => onRemove(i)}>
                <XIcon className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
