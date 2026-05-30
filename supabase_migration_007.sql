-- ============================================================================
-- COMPASS CRM — migration 007
-- Tasks become richer: multi-assignee, completion notes, who-created/completed
-- tracking. The old single-assignee columns stay populated for back-compat.
--
-- Run in Supabase → SQL Editor → New query → Run.
-- Non-destructive: only adds columns and backfills. Safe to re-run.
-- ============================================================================

alter table public.tasks
  add column if not exists assigned_user_ids text[],
  add column if not exists assigned_names    text[],
  add column if not exists created_by_name   text,
  add column if not exists completed_at      timestamptz,
  add column if not exists completed_by_name text,
  add column if not exists completion_note   text;

-- Backfill the new array columns from the legacy single-assignee columns
-- so existing tasks render correctly under the new UI.
update public.tasks
set assigned_user_ids = case when assigned_user_id is not null
                             then array[assigned_user_id::text]
                             else '{}'::text[] end
where assigned_user_ids is null;

update public.tasks
set assigned_names = case when assigned_name is not null
                          then array[assigned_name]
                          else '{}'::text[] end
where assigned_names is null;

-- For pre-existing already-completed tasks, mark completed_at if done=true.
-- We don't know who did it or when, so we use the row's created_at as a
-- reasonable placeholder (the timeline will still show them in order).
update public.tasks
set completed_at = created_at
where done = true and completed_at is null;

-- Ensure no nulls remain in arrays going forward.
update public.tasks set assigned_user_ids = '{}' where assigned_user_ids is null;
update public.tasks set assigned_names    = '{}' where assigned_names    is null;
