-- ============================================================================
-- COMPASS CRM — migration 009
-- Allow standalone calendar events (not tied to a job).
-- Just relaxes the NOT NULL constraint on scheduled_events.job_id.
-- Run in Supabase → SQL Editor. Non-destructive.
-- ============================================================================

alter table public.scheduled_events
  alter column job_id drop not null;
