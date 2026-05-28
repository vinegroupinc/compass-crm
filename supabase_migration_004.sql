-- ============================================================================
-- COMPASS CRM — migration 004
-- Run in Supabase → SQL Editor → New query → Run.
-- Only ADDS columns. Non-destructive: your existing jobs, tasks, and notes
-- are untouched. Safe to re-run (uses "if not exists").
-- ============================================================================

-- 1) Soft-delete flag for jobs: NULL = active, timestamp = deleted at that time.
alter table public.jobs
  add column if not exists deleted_at timestamptz;

-- 2) Dedicated access-info field on jobs.
alter table public.jobs
  add column if not exists access_info text;

-- 3) Optional due date on tasks. NULL = show immediately (no scheduled date).
alter table public.tasks
  add column if not exists due_date date;

-- Helpful index so the dashboard can quickly skip deleted jobs.
create index if not exists jobs_active_idx on public.jobs (deleted_at) where deleted_at is null;
