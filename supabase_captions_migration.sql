-- ============================================================
-- キャプション承認機能（post_captions）追加マイグレーション
--
-- 【安全性】このSQLは新しいテーブルを1つ「追加するだけ」です。
--   既存の projects / project_steps / app_settings には一切触れません。
--   取り消したい場合は最終行のコメントのDROPを実行すれば完全に元通りです。
--
-- 使い方：
--   1. 対象のSupabaseプロジェクトの「SQL Editor」を開く
--   2. このファイルの内容を貼り付けて「Run」
-- ============================================================

-- ── キャプション承認テーブル（プロジェクトに1対1で紐づく）──
create table if not exists post_captions (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references projects(id) on delete cascade,
  candidates jsonb not null default '[]'::jsonb,  -- [{ id, text, memo }] 候補一覧
  selected_candidate_id text,                     -- クライアントが選んだ候補ID
  draft_text text,                                -- 修正後の本文（編集中・承認時の本文）
  client_comment text,                            -- クライアントからの修正依頼コメント
  team_reply text,                                -- 制作チームからの返信（旧・単一返信）
  team_reply_at timestamptz,
  comments jsonb not null default '[]'::jsonb,    -- 双方向コメントスレッド
  status text not null default '未確認',          -- 未確認/選択済/修正依頼/確定/差し戻し
  decided_by text,                                -- 承認・差し戻しをした人の名前
  decided_at timestamptz,                         -- 承認・差し戻しの日時
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 1プロジェクトにつき1キャプションレコード
create unique index if not exists post_captions_project_uidx on post_captions(project_id);

-- ── Row Level Security（既存テーブルと同じ全許可ポリシー）──
alter table post_captions enable row level security;
create policy "Allow all" on post_captions for all using (true) with check (true);

-- ── Realtime（即時反映）を有効化 ──
alter publication supabase_realtime add table post_captions;

-- ============================================================
-- 完了！
--
-- 【元に戻す場合】以下を実行すると、この機能の痕跡を完全に削除できます
--   （既存データには影響しません）：
--   alter publication supabase_realtime drop table post_captions;
--   drop table if exists post_captions;
-- ============================================================
