-- ============================================================================
-- COMPASS CRM — migration 013
-- 1. Sequential, human-friendly job numbers starting at 100101
-- 2. closed_at timestamp populated when Close Job is used
--
-- Run in Supabase → SQL Editor. Non-destructive.
-- Safe to re-run: the sequence won't be reset and existing numbers stay.
-- ============================================================================

-- 1. Sequence and column
create sequence if not exists public.job_number_seq
  start with 100101
  increment by 1
  no maxvalue
  no cycle;

alter table public.jobs
  add column if not exists job_number integer,
  add column if not exists closed_at timestamptz;

-- 2. Backfill existing jobs in creation order (oldest = lowest number).
-- This block only runs if some rows still lack a job_number.
do $$
declare
  r record;
begin
  for r in
    select id from public.jobs
    where job_number is null
    order by created_at asc, id asc
  loop
    update public.jobs
    set job_number = nextval('public.job_number_seq')
    where id = r.id;
  end loop;
end$$;

-- 3. Enforce uniqueness and require a number going forward
create unique index if not exists jobs_job_number_unique_idx
  on public.jobs (job_number);

alter table public.jobs
  alter column job_number set default nextval('public.job_number_seq');

alter table public.jobs
  alter column job_number set not null;

-- 4. Make the sequence "owned" by the column so dropping the column would
-- drop the sequence too (clean lifecycle).
alter sequence public.job_number_seq owned by public.jobs.job_number;
