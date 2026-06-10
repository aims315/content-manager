-- ============================================================
-- task_content アプリ用 Supabase マイグレーション
-- Supabase Dashboard の SQL Editor で実行してください
-- ============================================================

-- プロジェクト一覧テーブル
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  project_type text not null check (project_type in ('instagram', 'twitter', 'event')),
  assignee text not null,
  client_slug text,
  due_date date,
  amount numeric,
  staff text,
  description text,
  discord_channels text[] default '{}',
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- プロジェクトステップテーブル
create table if not exists project_steps (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references projects(id) on delete cascade,
  step_key text not null,
  step_order int not null default 0,
  label text not null,
  status text not null default '未着手'
    check (status in ('未着手', 'ロック中', '素材待ち', '素材受領', '進行中', '確認待ち', '完了')),
  file_urls text[] default '{}',
  file_names text[] default '{}',
  url text,
  note text,
  provider_type text not null default 'self'
    check (provider_type in ('client', 'freelancer', 'self')),
  provider_name text,
  submitted_by text,
  submitted_at timestamptz,
  is_client_step boolean not null default false,
  created_at timestamptz default now()
);

-- インデックス
create index if not exists projects_client_slug_idx on projects(client_slug);
create index if not exists projects_deleted_at_idx on projects(deleted_at);
create index if not exists project_steps_project_id_idx on project_steps(project_id);

-- Row Level Security（既存の tasks テーブルと同じ設定）
alter table projects enable row level security;
alter table project_steps enable row level security;

-- 全員が読み書きできるポリシー（anon も含む）
create policy "Allow all for anon" on projects for all using (true) with check (true);
create policy "Allow all for anon" on project_steps for all using (true) with check (true);

-- ストレージバケット（task-files がすでにあれば不要）
-- insert into storage.buckets (id, name, public) values ('task-files', 'task-files', true)
-- on conflict do nothing;

-- Realtime 有効化
-- Dashboard の Database > Replication で projects と project_steps を有効にしてください

-- ============================================================
-- 既存の client_settings テーブルはそのまま流用できます
-- ============================================================
