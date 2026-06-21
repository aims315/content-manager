-- ============================================================
-- キャプションの納品URL用：projects に draft_url / response_url を追加
--
-- 【安全性】既存列・データには影響しない「列の追加だけ」です。
--   元に戻す場合は最終行のコメントのDROPを実行してください。
--
-- 使い方：Supabase(task_unyou_sns) の SQL Editor に貼って Run。
-- 実行後、アプリの「タスク同期」を一度押すと値が入ります。
-- ============================================================

alter table projects add column if not exists draft_url    text;  -- 初校（初稿）の納品データURL
alter table projects add column if not exists response_url text;  -- 修正対応後（修正完了）の納品データURL

-- ============================================================
-- 元に戻す場合：
--   alter table projects drop column if exists draft_url;
--   alter table projects drop column if exists response_url;
-- ============================================================
