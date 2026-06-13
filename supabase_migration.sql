-- ============================================================
-- task_content（コンテンツ制作管理）アプリ
-- Supabase 新規プロジェクト用 セットアップSQL
--
-- 使い方：
--   1. Supabaseで新しいプロジェクトを作成
--   2. 左メニュー「SQL Editor」を開く
--   3. このファイルの内容を全部コピーして貼り付け
--   4. 「Run」を押す
-- ============================================================

-- ── プロジェクト一覧テーブル ──
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  project_type text not null,          -- instagram / twitter / event / カスタム種別ID
  assignee text not null,              -- プロジェクトコード（担当者コード）
  client_slug text,
  project_code text,
  due_date date,
  amount numeric,
  staff text,
  description text,
  discord_channels text[] default '{}',
  done_override boolean,                -- null=自動判定 / true=完了 / false=進行中
  completed_at timestamptz,             -- 完了にした日時（自動アーカイブ用）
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- 既存DB向け：列が無ければ追加
alter table projects add column if not exists done_override boolean;
alter table projects add column if not exists completed_at timestamptz;

-- ── プロジェクトステップテーブル ──
create table if not exists project_steps (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references projects(id) on delete cascade,
  step_key text not null default 'text',
  step_order int not null default 0,
  label text not null,
  status text not null default '未着手',
  file_urls text[] default '{}',
  file_names text[] default '{}',
  url text,
  note text,
  provider_type text not null default 'self',
  provider_name text,
  submitted_by text,
  submitted_at timestamptz,
  is_client_step boolean not null default false,
  step_due_date date,
  depends_on text[] default '{}',
  created_at timestamptz default now()
);

-- ── 設定テーブル（役割・ステータス・カスタム種別などをJSONで保存）──
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- ── インデックス ──
create index if not exists projects_client_slug_idx on projects(client_slug);
create index if not exists projects_deleted_at_idx on projects(deleted_at);
create index if not exists project_steps_project_id_idx on project_steps(project_id);

-- ── Row Level Security ──
alter table projects enable row level security;
alter table project_steps enable row level security;
alter table app_settings enable row level security;

-- 全員が読み書きできるポリシー（公開アプリ用）
create policy "Allow all" on projects        for all using (true) with check (true);
create policy "Allow all" on project_steps   for all using (true) with check (true);
create policy "Allow all" on app_settings    for all using (true) with check (true);

-- ── Realtime（即時反映）を有効化 ──
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table project_steps;
alter publication supabase_realtime add table app_settings;

-- ── ファイル保存用ストレージバケット ──
insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', true)
on conflict (id) do nothing;

create policy "Public read"   on storage.objects for select using (bucket_id = 'task-files');
create policy "Public insert" on storage.objects for insert with check (bucket_id = 'task-files');
create policy "Public update" on storage.objects for update using (bucket_id = 'task-files');
create policy "Public delete" on storage.objects for delete using (bucket_id = 'task-files');

-- ============================================================
-- 完了！このあとVercelで環境変数を設定してデプロイしてください。
-- ============================================================
