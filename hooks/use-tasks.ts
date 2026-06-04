'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskRevision, TaskStatus } from '@/lib/types'

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([])
  const [revisions, setRevisions] = useState<Record<string, TaskRevision[]>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) { console.error('Error fetching tasks:', error); return }
    setTasks(data || [])
    setLoading(false)
  }, [supabase])

  const fetchDeletedTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setDeletedTasks(data || [])
  }, [supabase])

  // 全タスクの修正指示を一括取得
  const fetchAllRevisions = useCallback(async () => {
    const { data, error } = await supabase
      .from('task_revisions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { console.error('Error fetching revisions:', error); return }
    const grouped: Record<string, TaskRevision[]> = {}
    for (const rev of (data || [])) {
      if (!grouped[rev.task_id]) grouped[rev.task_id] = []
      grouped[rev.task_id].push(rev)
    }
    setRevisions(grouped)
  }, [supabase])

  const fetchRevisions = useCallback(async (taskId: string) => {
    const { data, error } = await supabase
      .from('task_revisions')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
    if (error) { console.error('Error fetching revisions:', error); return }
    setRevisions((prev) => ({ ...prev, [taskId]: data || [] }))
  }, [supabase])

  const addRevision = async (taskId: string, note: string, createdBy: string) => {
    const task = tasks.find((t) => t.id === taskId)
    const { error } = await supabase.from('task_revisions').insert({
      task_id: taskId, note, created_by: createdBy,
    })
    if (error) { console.error('Error adding revision:', error); return false }
    await fetchRevisions(taskId)
    if (task) {
      await sendDiscordNotification('revision', task.title, task.assignee, task.due_date, task.discord_channels, { note, modifiedBy: createdBy })
    }
    return true
  }

  const submitDraft = async (taskId: string, draftUrl: string, draftNote: string, fileUrls: string[] = [], fileNames: string[] = []) => {
    const task = tasks.find((t) => t.id === taskId)
    const { error } = await supabase
      .from('tasks')
      .update({
        status: '初校提出',
        draft_url: draftUrl || null,
        draft_note: draftNote || null,
        draft_submitted_at: new Date().toISOString(),
        draft_file_urls: fileUrls,
        draft_file_names: fileNames,
      })
      .eq('id', taskId)
    if (error) { throw new Error(error.message) }
    if (task) {
      await sendDiscordNotification('draft', task.title, task.assignee, task.due_date, task.discord_channels, { responseUrl: draftUrl, responseNote: draftNote })
    }
    return true
  }

  const submitResponse = async (taskId: string, responseUrl: string, responseNote: string, fileUrls: string[] = [], fileNames: string[] = []) => {
    const task = tasks.find((t) => t.id === taskId)
    const { error } = await supabase
      .from('tasks')
      .update({
        status: '修正対応完了',
        response_url: responseUrl || null,
        response_note: responseNote || null,
        responded_at: new Date().toISOString(),
        response_file_urls: fileUrls,
        response_file_names: fileNames,
      })
      .eq('id', taskId)
    if (error) { console.error('Error submitting response:', error); throw new Error(error.message) }
    if (task) {
      await sendDiscordNotification('response', task.title, task.assignee, task.due_date, task.discord_channels, { responseUrl, responseNote })
    }
    return true
  }

  useEffect(() => {
    fetchTasks()
    fetchDeletedTasks()
    fetchAllRevisions()

    const handleTaskChange = () => { fetchTasks(); fetchDeletedTasks() }

    // タスクのリアルタイム購読
    const taskChannel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, handleTaskChange)
      .subscribe()

    // 修正指示のリアルタイム購読
    const revisionChannel = supabase
      .channel('revisions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_revisions' }, fetchAllRevisions)
      .subscribe()

    return () => {
      supabase.removeChannel(taskChannel)
      supabase.removeChannel(revisionChannel)
    }
  }, [fetchTasks, fetchAllRevisions, supabase])

  const sendDiscordNotification = async (
    type: 'created' | 'completed' | 'early_completion' | 'revision' | 'response' | 'draft',
    title: string,
    assignee: string,
    dueDate?: string | null,
    channels?: string[],
    extra?: { note?: string; modifiedBy?: string; responseUrl?: string; responseNote?: string; daysEarly?: number }
  ) => {
    try {
      await fetch('/api/discord/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, title, assignee, dueDate, channels,
          note: extra?.note, modifiedBy: extra?.modifiedBy,
          responseUrl: extra?.responseUrl, responseNote: extra?.responseNote,
          daysEarly: extra?.daysEarly,
        }),
      })
    } catch (err) {
      console.error('Discord notification failed:', err)
    }
  }

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId)
    const previousStatus = task?.status
    const now = new Date()
    const completedAt = status === '完了' ? now.toISOString() : null
    const { error } = await supabase
      .from('tasks')
      .update({ status, completed_at: completedAt })
      .eq('id', taskId)
    if (error) { console.error('Error updating task:', error); return false }
    if (task && status !== previousStatus) {
      if (status === '完了') {
        await sendDiscordNotification('completed', task.title, task.assignee, task.due_date, task.discord_channels)
        if (task.due_date) {
          const due = new Date(task.due_date)
          due.setHours(23, 59, 59, 999)
          const daysEarly = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          let threshold = 3
          try { threshold = parseInt(localStorage.getItem('early_completion_days') ?? '3', 10) || 3 } catch { /* noop */ }
          if (daysEarly >= threshold) {
            await sendDiscordNotification('early_completion', task.title, task.assignee, task.due_date, task.discord_channels, { daysEarly })
          }
        }
      } else {
        await sendDiscordNotification('status_changed', task.title, task.assignee, task.due_date, task.discord_channels, { previousStatus, newStatus: status })
      }
    }
    return true
  }

  // ソフトデリート（ゴミ箱へ移動）
  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) { console.error('Error deleting task:', error); return false }
    return true
  }

  // ゴミ箱から元に戻す
  const restoreTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: null })
      .eq('id', taskId)
    if (error) { console.error('Error restoring task:', error); return false }
    return true
  }

  // 完全削除
  const permanentDeleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) { console.error('Error permanently deleting task:', error); return false }
    return true
  }

  // 複数件まとめて完全削除
  const permanentDeleteTasks = async (taskIds: string[]) => {
    const { error } = await supabase.from('tasks').delete().in('id', taskIds)
    if (error) { console.error('Error permanently deleting tasks:', error); return false }
    return true
  }

  const submitModification = async (taskId: string, note: string, files: string[], modifiedBy: string) => {
    const task = tasks.find((t) => t.id === taskId)
    const { error } = await supabase
      .from('tasks')
      .update({ modification_note: note, modification_files: files, modified_by: modifiedBy, modified_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) { console.error('Error submitting modification:', error); return false }
    if (task) {
      await sendDiscordNotification('revision', task.title, task.assignee, task.due_date, task.discord_channels, { note, modifiedBy })
    }
    return true
  }

  const updateTask = async (
    taskId: string,
    updates: { title: string; assignee: string; due_date: string | null; draft_due_date: string | null; description?: string; client_slug?: string | null }
  ) => {
    const task = tasks.find((t) => t.id === taskId)
    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId)
    if (error) { console.error('Error updating task:', error); return false }
    if (task) {
      await sendDiscordNotification('updated', updates.title, updates.assignee, updates.due_date, task.discord_channels)
    }
    return true
  }

  return {
    tasks, deletedTasks, revisions, loading,
    updateTaskStatus, updateTask, deleteTask, restoreTask, permanentDeleteTask, permanentDeleteTasks,
    submitModification, addRevision, submitResponse, submitDraft,
    fetchRevisions, refetch: fetchTasks,
  }
}
