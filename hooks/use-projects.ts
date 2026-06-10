'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project, ProjectStep, StepStatus, ProviderType } from '@/lib/types'
import { sendChatworkNotification } from './use-notify'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([])
  const [steps, setSteps] = useState<Record<string, ProjectStep[]>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) { console.error('Error fetching projects:', error); return }
    setProjects(data || [])
    setLoading(false)
  }, [supabase])

  const fetchDeletedProjects = useCallback(async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setDeletedProjects(data || [])
  }, [supabase])

  const fetchAllSteps = useCallback(async () => {
    const { data, error } = await supabase
      .from('project_steps')
      .select('*')
      .order('step_order', { ascending: true })
    if (error) { console.error('Error fetching steps:', error); return }
    const grouped: Record<string, ProjectStep[]> = {}
    for (const step of (data || [])) {
      if (!grouped[step.project_id]) grouped[step.project_id] = []
      grouped[step.project_id].push(step)
    }
    setSteps(grouped)
  }, [supabase])

  const fetchStepsForProject = useCallback(async (projectId: string) => {
    const { data, error } = await supabase
      .from('project_steps')
      .select('*')
      .eq('project_id', projectId)
      .order('step_order', { ascending: true })
    if (error) { console.error('Error fetching steps:', error); return }
    setSteps((prev) => ({ ...prev, [projectId]: data || [] }))
  }, [supabase])

  const updateStepStatus = async (stepId: string, status: StepStatus, context?: { projectTitle?: string; stepLabel?: string }, projectId?: string) => {
    // 楽観的更新：UIをすぐに反映
    if (projectId) {
      setSteps((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map((s) => s.id === stepId ? { ...s, status } : s),
      }))
    }

    const { error } = await supabase
      .from('project_steps')
      .update({ status })
      .eq('id', stepId)
    if (error) {
      console.error('Error updating step:', error)
      // エラー時はロールバック
      if (projectId) await fetchStepsForProject(projectId)
      return false
    }

    // DB反映後に再取得
    if (projectId) await fetchStepsForProject(projectId)

    // Chatwork通知
    if (context?.projectTitle && context?.stepLabel) {
      const msg = `[コンテンツ制作管理]\n📋 ステータス更新\nプロジェクト: ${context.projectTitle}\nステップ: ${context.stepLabel}\n新ステータス: ${status}`
      sendChatworkNotification(msg)
    }
    return true
  }

  const submitStep = async (
    stepId: string,
    projectId: string,
    data: { url?: string; note?: string; fileUrls?: string[]; fileNames?: string[]; submittedBy?: string }
  ) => {
    const { error } = await supabase
      .from('project_steps')
      .update({
        url: data.url || null,
        note: data.note || null,
        file_urls: data.fileUrls || [],
        file_names: data.fileNames || [],
        submitted_by: data.submittedBy || null,
        submitted_at: new Date().toISOString(),
        status: '素材受領',
      })
      .eq('id', stepId)
    if (error) { throw new Error(error.message) }
    await fetchStepsForProject(projectId)
    return true
  }

  const updateStep = async (
    stepId: string,
    projectId: string,
    data: { url?: string; note?: string; fileUrls?: string[]; fileNames?: string[]; status?: StepStatus }
  ) => {
    const { error } = await supabase
      .from('project_steps')
      .update({
        url: data.url ?? null,
        note: data.note ?? null,
        file_urls: data.fileUrls ?? [],
        file_names: data.fileNames ?? [],
        ...(data.status ? { status: data.status } : {}),
      })
      .eq('id', stepId)
    if (error) { console.error('Error updating step:', error); return false }
    await fetchStepsForProject(projectId)
    return true
  }

  const updateStepProvider = async (
    stepId: string,
    projectId: string,
    providerType: ProviderType,
    providerName: string | null
  ) => {
    const { error } = await supabase
      .from('project_steps')
      .update({
        provider_type: providerType,
        provider_name: providerName,
        is_client_step: providerType !== 'self',
      })
      .eq('id', stepId)
    if (error) { console.error('Error updating provider:', error); return false }
    await fetchStepsForProject(projectId)
    return true
  }

  const updateStepDueDate = async (stepId: string, projectId: string, dueDate: string | null) => {
    const { error } = await supabase
      .from('project_steps')
      .update({ step_due_date: dueDate })
      .eq('id', stepId)
    if (error) { console.error('Error updating step due date:', error); return false }
    await fetchStepsForProject(projectId)
    return true
  }

  const deleteProject = async (projectId: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', projectId)
    if (error) { console.error('Error deleting project:', error); return false }
    return true
  }

  const restoreProject = async (projectId: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: null })
      .eq('id', projectId)
    if (error) { console.error('Error restoring project:', error); return false }
    return true
  }

  const permanentDeleteProject = async (projectId: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    if (error) { console.error('Error permanently deleting project:', error); return false }
    return true
  }

  useEffect(() => {
    fetchProjects()
    fetchDeletedProjects()
    fetchAllSteps()

    const handleProjectChange = () => { fetchProjects(); fetchDeletedProjects() }
    const handleStepChange = () => fetchAllSteps()

    const projectChannel = supabase
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, handleProjectChange)
      .subscribe()

    const stepChannel = supabase
      .channel('steps-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_steps' }, handleStepChange)
      .subscribe()

    return () => {
      supabase.removeChannel(projectChannel)
      supabase.removeChannel(stepChannel)
    }
  }, [fetchProjects, fetchDeletedProjects, fetchAllSteps, supabase])

  return {
    projects, deletedProjects, steps, loading,
    updateStepStatus, submitStep, updateStep,
    deleteProject, restoreProject, permanentDeleteProject,
    fetchStepsForProject, refetch: fetchProjects,
    updateStepProvider, updateStepDueDate,
  }
}
