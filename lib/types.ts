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

export interface CustomDate {
  id: string
  label: string
  date: string   // YYYY-MM-DD
}

// ── キャプション承認（post_captions テーブル）──
export type CaptionStatus = '未確認' | '選択済' | '修正依頼' | '確定' | '差し戻し'

export interface CaptionCandidate {
  id: string
  text: string
  memo?: string
  orig?: string   // 登録時の元テキスト（クライアント修正の差分表示用）
}

// キャプションのやりとり（クライアント↔制作チーム）
export interface CaptionComment {
  id: string
  author: 'client' | 'team'
  name?: string
  text: string
  at: string
}

export interface PostCaption {
  id: string
  project_id: string
  candidates: CaptionCandidate[]
  selected_candidate_id: string | null
  draft_text: string | null
  client_comment: string | null
  status: CaptionStatus
  decided_by: string | null
  decided_at: string | null
  team_reply: string | null      // 制作チームから差し戻しへの返信（旧・単一返信）
  team_reply_at: string | null
  comments: CaptionComment[]     // 双方向のコメントスレッド
  created_at: string
  updated_at: string
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
  reminder_days: number | null
  custom_dates: CustomDate[] | null
  bar_color: string | null
  draft_url: string | null      // 初校（初稿）の納品データURL（タスク同期で取得）
  response_url: string | null   // 修正対応後（修正完了）の納品データURL（タスク同期で取得）
  created_at: string
  deleted_at: string | null
  steps?: ProjectStep[]
}
