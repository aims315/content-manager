export type ProjectType = 'instagram' | 'twitter' | 'event'

export type StepStatus = '未着手' | 'ロック中' | '素材待ち' | '素材受領' | '進行中' | '確認待ち' | '完了'

export type ProviderType = 'client' | 'freelancer' | 'self'

export type StepKey =
  | 'photo'
  | 'text'
  | 'design'
  | 'post_ready'
  | 'event_outline'
  | 'announce_image'
  | 'event_script'
  | 'event_page'
  | 'invite_email'
  | 'thanks_email'
  | 'thanks_line'

export interface ProjectStep {
  id: string
  project_id: string
  step_key: StepKey
  step_order: number
  label: string
  status: StepStatus
  provider_type: ProviderType
  provider_name: string | null
  file_urls: string[]
  file_names: string[]
  url: string | null
  note: string | null
  submitted_by: string | null
  submitted_at: string | null
  is_client_step: boolean
  step_due_date: string | null
  depends_on: string[]
  created_at: string
}

export interface Project {
  id: string
  title: string
  project_type: ProjectType
  assignee: string
  client_slug: string | null
  due_date: string | null
  amount: number | null
  project_code: string | null
  staff: string | null
  description: string | null
  discord_channels: string[]
  done_override: boolean | null
  completed_at: string | null
  created_at: string
  deleted_at: string | null
  steps?: ProjectStep[]
}
