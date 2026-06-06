export type TaskStatus = '未着手' | '制作要項待ち' | '制作要項受領' | '進行中' | '初校提出' | '修正' | '修正対応完了' | '投稿OK' | '完了'

export interface TaskRevision {
  id: string
  task_id: string
  note: string
  created_by: string
  file_urls: string[]
  file_names: string[]
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  assignee: string
  due_date: string | null
  status: TaskStatus
  file_urls: string[]
  file_names: string[]
  created_at: string
  completed_at: string | null
  modification_note: string | null
  modification_files: string[]
  modified_by: string | null
  modified_at: string | null
  discord_channels: string[]
  response_url: string | null
  response_note: string | null
  responded_at: string | null
  draft_url: string | null
  draft_note: string | null
  draft_submitted_at: string | null
  draft_due_date: string | null
  draft_file_urls: string[]
  draft_file_names: string[]
  response_file_urls: string[]
  response_file_names: string[]
  client_slug: string | null
  amount: number | null
  staff: string | null
  deleted_at: string | null
  posted_ok_at: string | null
}
