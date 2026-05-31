-- ============================================================================
-- COMPASS CRM — migration 012
-- Optional note on contacts (e.g. "Reglazing" for a sub's trade).
-- Run in Supabase → SQL Editor. Non-destructive.
-- ============================================================================

alter table public.contacts
  add column if not exists note text;
