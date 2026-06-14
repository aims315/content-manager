'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project, ProjectStep, StepStatus, ProviderType } from '@/lib/types'
import { sendChatworkNotification } from './use-notify'

export function useProjects(lockedCode?: string) {
  const [projects, setProjects] = useState<Project[]>([])
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([])
  const [steps, setSteps] = useState<Record<string, ProjectStep[]>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // 手動で完了/進行中を切り替えた直後、Realtimeの再取得（レプリカ遅延で古い値が返る）が
  // 楽観的更新を上書きしないようガードする { projectId: { value, expires } }
  const pendingOverridesRef = useRef<Record<string, { value: boolean | null; expires: number }>>({})

  const applyPendingOverrides = (list: Project[]): Project[] => {
    const now = Date.now()
    const pending = pendingOverridesRef.current
    // 期限切れを掃除
    for (const id of Object.keys(pending)) {
      if (pending[id].expires < now) delete pending[id]
    }
    if (Object.keys(pending).length === 0) return list
    return list.map((p) =>
      pending[p.id] ? { ...p, done_override: pending[p.id].value } : p
    )
  }

  const fetchProjects = useCallback(async () => {
    let q = supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (lockedCode) q = q.eq('assignee', lockedCode)  // コード限定モード
    const { data, error } = await q
    if (error) { console.error('Error fetching projects:', error); return }
    setProjects(applyPendingOverrides(data || []))
    setLoading(false)
  }, [supabase, lockedCode])

  const fetchDeletedProjects = useCallback(async () => {
    let q = supabase
      .from('projects')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (lockedCode) q = q.eq('assignee', lockedCode)
    const { data } = await q
    setDeletedProjects(data || [])
  }, [supabase, lockedCode])

  const fetchAllSteps = useCallback(async () => {
    // コード限定時は、そのコードのプロジェクトのステップだけ取得
    let projectIds: string[] | null = null
    if (lockedCode) {
      const { data: ps } = await supabase.from('projects').select('id').eq('assignee', lockedCode)
      projectIds = (ps || []).map((p) => p.id)
      if (projectIds.length === 0) { setSteps({}); return }
    }
    let q = supabase.from('project_steps').select('*').order('step_order', { ascending: true })
    if (projectIds) q = q.in('project_id', projectIds)
    const { data, error } = await q
    if (error) { console.error('Error fetching steps:', error); return }
    const grouped: Record<string, ProjectStep[]> = {}
    for (const step of (data || [])) {
      if (!grouped[step.project_id]) grouped[step.project_id] = []
      grouped[step.project_id].push(step)
    }
    setSteps(grouped)
  }, [supabase, lockedCode])

  const fetchStepsForProject = useCallback(async (projectId: string) => {
    const { data, error } = await supabase
      .from('project_steps')
      .select('*')
      .eq('project_id', projectId)
      .order('step_order', { ascending: true })
    if (error) { console.error('Error fetching steps:', error); return }
    setSteps((prev) => ({ ...prev, [projectId]: data || [] }))
  }, [supabase])

  const updateStepStatus = async (
    stepId: string,
    status: StepStatus,
    context?: { projectTitle?: string; stepLabel?: string },
    projectId?: string,
    doneStatusLabels?: string[]   // 完了扱いのステータスラベル一覧
  ) => {
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
      if (projectId) await fetchStepsForProject(projectId)
      return false
    }

    // DB反映後に再取得してから自動ロック解除チェック
    if (projectId) {
      await fetchStepsForProject(projectId)

      // このステップが完了扱いになった場合、依存している「ロック中」ステップを自動解除
      const doneLabels = doneStatusLabels ?? ['完了']
      if (doneLabels.includes(status)) {
        const { data: allProjectSteps } = await supabase
          .from('project_steps')
          .select('*')
          .eq('project_id', projectId)
          .order('step_order', { ascending: true })

        if (allProjectSteps) {
          const stepsMap: Record<string, typeof allProjectSteps[0]> = {}
          allProjectSteps.forEach((s) => { stepsMap[s.id] = s })

          for (const s of allProjectSteps) {
            if (s.status !== 'ロック中') continue
            const deps: string[] = s.depends_on ?? []
            if (deps.length === 0) continue

            // 全依存が完了扱いか確認
            const allDone = deps.every((depId) => {
              const dep = stepsMap[depId]
              return dep && doneLabels.includes(dep.status)
            })

            if (allDone) {
              await supabase
                .from('project_steps')
                .update({ status: '未着手' })
                .eq('id', s.id)
            }
          }

          // 自動変更後に再取得
          await fetchStepsForProject(projectId)
        }
      }
    }

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

  const updateStepDependencies = async (stepId: string, projectId: string, dependsOn: string[]) => {
    // 楽観的更新
    setSteps((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((s) =>
        s.id === stepId ? { ...s, depends_on: dependsOn } : s
      ),
    }))
    const { error } = await supabase
      .from('project_steps')
      .update({ depends_on: dependsOn })
      .eq('id', stepId)
    if (error) { console.error('Error updating dependencies:', error); return false }
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

  const duplicateProject = async (projectId: string) => {
    // 元プロジェクトを取得
    const { data: origProject } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()
    if (!origProject) return false

    // 元ステップを取得
    const { data: origSteps } = await supabase
      .from('project_steps')
      .select('*')
      .eq('project_id', projectId)
      .order('step_order', { ascending: true })

    // 新プロジェクトを作成
    const { data: newProject, error: projErr } = await supabase
      .from('projects')
      .insert({
        title: `${origProject.title}（コピー）`,
        project_type: origProject.project_type,
        assignee: origProject.assignee,
        client_slug: origProject.client_slug,
        due_date: origProject.due_date,
        description: origProject.description,
        project_code: origProject.project_code,
        discord_channels: origProject.discord_channels ?? [],
      })
      .select()
      .single()
    if (projErr || !newProject) return false

    // ステップをコピー（旧ID→新IDのマップを作りながら）
    const idMap: Record<string, string> = {}
    if (origSteps && origSteps.length > 0) {
      for (const s of origSteps) {
        const { data: newStep } = await supabase
          .from('project_steps')
          .insert({
            project_id: newProject.id,
            step_key: s.step_key,
            step_order: s.step_order,
            label: s.label,
            status: '未着手',           // ステータスはリセット
            provider_type: s.provider_type,
            provider_name: s.provider_name,
            file_urls: [],
            file_names: [],
            is_client_step: s.is_client_step,
            step_due_date: s.step_due_date,
            depends_on: [],             // 依存は後で再マップ
          })
          .select()
          .single()
        if (newStep) idMap[s.id] = newStep.id
      }

      // depends_on を新IDに置き換え
      for (const s of origSteps) {
        const newId = idMap[s.id]
        if (!newId || !s.depends_on?.length) continue
        const newDeps = (s.depends_on as string[])
          .map((oldId: string) => idMap[oldId])
          .filter(Boolean)
        if (newDeps.length > 0) {
          await supabase
            .from('project_steps')
            .update({ depends_on: newDeps })
            .eq('id', newId)
        }
      }
    }

    await fetchProjects()
    await fetchAllSteps()
    return newProject.id
  }

  // 進行中/完了 の手動指定（null=自動 / true=完了 / false=進行中）
  const setProjectDoneOverride = async (projectId: string, value: boolean | null) => {
    // 完了にした日時を記録（自動アーカイブ用）。完了解除時はクリア
    const completedAt = value === true ? new Date().toISOString() : null
    // 楽観的更新 + 数秒間はRealtime再取得に上書きされないようガード登録
    pendingOverridesRef.current[projectId] = { value, expires: Date.now() + 8000 }
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, done_override: value, completed_at: completedAt } : p))
    const { error } = await supabase
      .from('projects')
      .update({ done_override: value, completed_at: completedAt })
      .eq('id', projectId)
    if (error) {
      console.error('Error updating done_override:', error)
      delete pendingOverridesRef.current[projectId]
      await fetchProjects()
      return false
    }
    return true
  }

  // 自動整理：完了から一定日数でゴミ箱へ、ゴミ箱から一定日数で完全削除
  const runAutoArchive = useCallback(async () => {
    // 設定を取得（なければ既定 14日 / 30日）
    let trashAfterDays = 14, deleteAfterDays = 30
    try {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'archive_config').single()
      if (data?.value) {
        const c = JSON.parse(data.value)
        if (typeof c.trashAfterDays === 'number') trashAfterDays = c.trashAfterDays
        if (typeof c.deleteAfterDays === 'number') deleteAfterDays = c.deleteAfterDays
      }
    } catch { /* 既定値を使用 */ }

    const now = Date.now()
    const trashCutoff = new Date(now - trashAfterDays * 86400000).toISOString()
    const deleteCutoff = new Date(now - deleteAfterDays * 86400000).toISOString()

    // 1) 完了から trashAfterDays 経過 → ゴミ箱へ
    const { data: toTrash } = await supabase
      .from('projects')
      .select('id')
      .eq('done_override', true)
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .lt('completed_at', trashCutoff)
    if (toTrash && toTrash.length > 0) {
      const ids = toTrash.map((p) => p.id)
      await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).in('id', ids)
    }

    // 2) ゴミ箱で deleteAfterDays 経過 → 完全削除
    const { data: toDelete } = await supabase
      .from('projects')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', deleteCutoff)
    if (toDelete && toDelete.length > 0) {
      const ids = toDelete.map((p) => p.id)
      await supabase.from('projects').delete().in('id', ids)
    }

    if ((toTrash?.length ?? 0) > 0 || (toDelete?.length ?? 0) > 0) {
      await fetchProjects(); await fetchDeletedProjects()
    }
  }, [supabase, fetchProjects, fetchDeletedProjects])

  const deleteProject = async (projectId: string) => {
    // 楽観的更新：一覧から消してゴミ箱へ移動
    const target = projects.find((p) => p.id === projectId)
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    if (target) setDeletedProjects((prev) => [{ ...target, deleted_at: new Date().toISOString() }, ...prev])
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', projectId)
    if (error) {
      console.error('Error deleting project:', error)
      await fetchProjects(); await fetchDeletedProjects() // 失敗時は再取得して戻す
      return false
    }
    return true
  }

  const restoreProject = async (projectId: string) => {
    // 楽観的更新：ゴミ箱から消して一覧へ戻す
    const target = deletedProjects.find((p) => p.id === projectId)
    setDeletedProjects((prev) => prev.filter((p) => p.id !== projectId))
    if (target) setProjects((prev) => [{ ...target, deleted_at: null }, ...prev])
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: null })
      .eq('id', projectId)
    if (error) {
      console.error('Error restoring project:', error)
      await fetchProjects(); await fetchDeletedProjects()
      return false
    }
    return true
  }

  const permanentDeleteProject = async (projectId: string) => {
    // 楽観的更新：ゴミ箱から完全に消す
    setDeletedProjects((prev) => prev.filter((p) => p.id !== projectId))
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    if (error) {
      console.error('Error permanently deleting project:', error)
      await fetchDeletedProjects()
      return false
    }
    return true
  }

  useEffect(() => {
    fetchProjects()
    fetchDeletedProjects()
    fetchAllSteps()
    if (!lockedCode) runAutoArchive()  // 自動整理は通常モードのみ

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
  }, [fetchProjects, fetchDeletedProjects, fetchAllSteps, runAutoArchive, lockedCode, supabase])

  return {
    projects, deletedProjects, steps, loading,
    updateStepStatus, submitStep, updateStep,
    deleteProject, restoreProject, permanentDeleteProject,
    fetchStepsForProject, refetch: async () => { await fetchProjects(); await fetchAllSteps() },
    updateStepProvider, updateStepDueDate, updateStepDependencies, duplicateProject,
    setProjectDoneOverride,
  }
}
