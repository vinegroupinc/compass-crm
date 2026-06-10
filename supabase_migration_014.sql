-- ============================================================================
-- COMPASS CRM — migration 014
-- Job Costing: invoice amount + line items + change orders per job
-- Run in Supabase → SQL Editor. Non-destructive.
-- ============================================================================

create table if not exists public.job_costing (
  job_id        uuid primary key references public.jobs(id) on delete cascade,
  invoice       numeric(12, 2),
  -- Line items live as JSON arrays. Each item: { id, description, amount }
  -- Buckets are normalized to: materials | subs | labor
  materials     jsonb not null default '[]'::jsonb,
  subs          jsonb not null default '[]'::jsonb,
  labor         jsonb not null default '[]'::jsonb,
  -- Change orders: { id, description, amount, bucket, created_at }
  change_orders jsonb not null default '[]'::jsonb,
  last_updated_at timestamptz not null default now(),
  last_updated_by uuid,
  last_updated_by_name text
);

alter table public.job_costing enable row level security;

drop policy if exists job_costing_all on public.job_costing;
create policy job_costing_all on public.job_costing
  for all to authenticated using (true) with check (true);
