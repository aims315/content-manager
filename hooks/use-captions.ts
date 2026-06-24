'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PostCaption } from '@/lib/types'

export type CaptionPatch = Partial<
  Pick<PostCaption, 'candidates' | 'selected_candidate_id' | 'draft_text' | 'client_comment' | 'status' | 'decided_by' | 'decided_at' | 'team_reply' | 'team_reply_at' | 'comments'>
>

/**
 * post_captions テーブルだけを読み書きするフック。
 * projects / project_steps には一切触れない（既存カードは絶対に変化しない）。
 * テーブル未作成（マイグレーション未実行）でもアプリは壊れず、空として扱う。
 */
export function useCaptions() {
  const [captions, setCaptions] = useState<Record<string, PostCaption>>({})
  const captionsRef = useRef(captions)
  captionsRef.current = captions
  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase.from('post_captions').select('*')
    if (error) {
      // テーブル未作成などは握りつぶす（機能未導入として空で動く）
      console.warn('post_captions 読み込みスキップ:', error.message)
      return
    }
    const map: Record<string, PostCaption> = {}
    for (const c of data || []) map[(c as PostCaption).project_id] = c as PostCaption
    setCaptions(map)
  }, [supabase])

  const saveCaption = useCallback(async (projectId: string, patch: CaptionPatch) => {
    const existing = captionsRef.current[projectId]
    const now = new Date().toISOString()
    const merged: Record<string, unknown> = {
      project_id: projectId,
      candidates: existing?.candidates ?? [],
      selected_candidate_id: existing?.selected_candidate_id ?? null,
      draft_text: existing?.draft_text ?? null,
      client_comment: existing?.client_comment ?? null,
      status: existing?.status ?? '未確認',
      decided_by: existing?.decided_by ?? null,
      decided_at: existing?.decided_at ?? null,
      team_reply: existing?.team_reply ?? null,
      team_reply_at: existing?.team_reply_at ?? null,
      comments: existing?.comments ?? [],
      ...patch,
      updated_at: now,
    }
    if (existing?.id) merged.id = existing.id

    // 楽観的更新
    setCaptions((prev) => ({
      ...prev,
      [projectId]: { ...(prev[projectId] ?? {}), ...merged } as PostCaption,
    }))

    const { error } = await supabase
      .from('post_captions')
      .upsert(merged, { onConflict: 'project_id' })
    if (error) {
      console.error('Error saving caption:', error)
      await fetchAll() // 失敗時はサーバー状態に戻す
      return false
    }
    return true
  }, [supabase, fetchAll])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('post-captions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_captions' }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAll, supabase])

  return { captions, saveCaption, refetchCaptions: fetchAll }
}
