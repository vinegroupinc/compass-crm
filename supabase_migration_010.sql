-- ============================================================================
-- COMPASS CRM — migration 010
-- Adds:
--   1. activity_log table for the admin audit trail
--   2. jobs.attention_note (text) for the Needs Attention note
--   3. jobs.closed_note (text) for the note saved when closing a job
-- Run in Supabase → SQL Editor. Non-destructive.
-- ============================================================================

-- Admin activity log. Each row is one event. payload holds anything
-- extra we want to record without needing a new column every time.
create table if not exists public.activity_log (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,            -- e.g. 'job_created', 'task_completed', 'attention_set'
  actor_id      uuid,
  actor_name    text,
  target_kind   text,                     -- 'job', 'task', 'contact', etc.
  target_id     text,                     -- uuid as text (so we can reference deleted rows too)
  target_label  text,                     -- a human-readable label (address, contact name, etc.)
  note          text,
  payload       jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);
create index if not exists activity_log_kind_idx       on public.activity_log (kind);
create index if not exists activity_log_actor_idx      on public.activity_log (actor_id);

alter table public.activity_log enable row level security;

drop policy if exists activity_log_all on public.activity_log;
create policy activity_log_all on public.activity_log
  for all to authenticated using (true) with check (true);

-- jobs: add note columns
alter table public.jobs
  add column if not exists attention_note text,
  add column if not exists closed_note    text;
