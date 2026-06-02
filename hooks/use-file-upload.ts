'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface UploadedFile {
  name: string
  url: string
}

export function useFileUpload() {
  const supabase = createClient()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const uploadFiles = async (files: FileList) => {
    setIsUploading(true)
    setUploadError(null)
    const results: UploadedFile[] = []

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage
        .from('task-files')
        .upload(path, file)

      if (error) {
        console.error('Upload error:', error)
        setUploadError(`アップロード失敗: ${error.message}`)
      } else {
        const { data } = supabase.storage.from('task-files').getPublicUrl(path)
        results.push({ name: file.name, url: data.publicUrl })
      }
    }

    setUploadedFiles((prev) => [...prev, ...results])
    setIsUploading(false)
    return results
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const reset = () => {
    setUploadedFiles([])
    setUploadError(null)
  }

  return { uploadedFiles, isUploading, uploadError, uploadFiles, removeFile, reset }
}
