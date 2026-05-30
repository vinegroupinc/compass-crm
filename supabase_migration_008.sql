-- ============================================================================
-- COMPASS CRM — migration 008
-- One-off calendar events tied to jobs (e.g. "Reglaze at 2pm on June 10").
-- Separate from a job's start_date/end_date range. A job can have many.
--
-- Run in Supabase → SQL Editor. Non-destructive (CREATE IF NOT EXISTS).
-- ============================================================================

create table if not exists public.scheduled_events (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  title       text not null,
  event_date  date not null,
  event_time  time,                       -- nullable: all-day if null (we collect one but allow null)
  created_at  timestamptz not null default now(),
  created_by  uuid,
  created_by_name text
);

create index if not exists scheduled_events_date_idx on public.scheduled_events (event_date);
create index if not exists scheduled_events_job_idx  on public.scheduled_events (job_id);

alter table public.scheduled_events enable row level security;

drop policy if exists scheduled_events_all on public.scheduled_events;
create policy scheduled_events_all on public.scheduled_events
  for all to authenticated using (true) with check (true);
