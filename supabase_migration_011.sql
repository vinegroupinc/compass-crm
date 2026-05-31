-- ============================================================================
-- COMPASS CRM — migration 011
-- Renames the existing "Waiting Scope" status on any jobs to "Waiting Site Visit"
-- so they re-attach to the renamed status group on the dashboard.
-- Run in Supabase → SQL Editor. Non-destructive (just updates a text column).
-- ============================================================================

update public.jobs
set status = 'Waiting Site Visit'
where status = 'Waiting Scope';
