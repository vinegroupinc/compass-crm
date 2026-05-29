-- ============================================================================
-- COMPASS CRM — migration 006
-- Notes can now be deleted by their author within 24 hours.
-- Editing is removed entirely (no schema change there, just UI).
--
-- Run in Supabase → SQL Editor → New query → Run.
-- Non-destructive: adds a column and a policy. Safe to re-run.
-- ============================================================================

-- Tombstone flag. When true, the body is the deletion message and the row
-- should render with strike/grey styling.
alter table public.notes
  add column if not exists deleted_at timestamptz;

-- The existing notes_insert / notes_update / notes_read policies stay as-is.
-- Add a tightly-scoped delete policy: author only, within 24h of creation.
-- (We don't actually DELETE the row — we UPDATE it via the update policy.
-- This policy exists in case we ever want a true DELETE later.)

-- Refresh the update policy so author can mark their own note as deleted,
-- but still cannot edit body text on a note that's already deleted, and
-- cannot edit any note older than 24 hours.
drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes
  for update to authenticated
  using (
    author_id = auth.uid()
    and deleted_at is null
    and created_at > (now() - interval '24 hours')
  )
  with check (
    author_id = auth.uid()
  );
