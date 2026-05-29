-- ============================================================================
-- COMPASS CRM — migration 005
-- Unified Contacts (Client / Technician / Subcontractor with multi-type)
-- AND multi-select Vine Techs + Subcontractors on jobs.
--
-- Run in Supabase → SQL Editor → New query → Run.
-- Non-destructive: existing data is migrated, not deleted. Safe to re-run.
-- ============================================================================

-- 1) NEW CONTACTS TABLE
-- One row per contact (by name). Types stored as booleans so the same
-- person can be both a Tech and a Subcontractor without duplication.
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_client boolean not null default false,
  is_technician boolean not null default false,
  is_subcontractor boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name)
);

create index if not exists contacts_name_idx on public.contacts (name);

alter table public.contacts enable row level security;

drop policy if exists contacts_all on public.contacts;
create policy contacts_all on public.contacts
  for all to authenticated using (true) with check (true);

-- 2) MIGRATE existing saved_list_items into contacts
-- Each name becomes one contact. If a name exists as both kinds, the
-- conflict resolution OR-merges the type flags so we don't duplicate.
insert into public.contacts (name, is_client, is_technician, is_subcontractor)
select
  name,
  bool_or(kind = 'management_company') as is_client,
  bool_or(kind = 'tech')               as is_technician,
  false                                 as is_subcontractor
from public.saved_list_items
group by name
on conflict (name) do update
  set is_client      = public.contacts.is_client      or excluded.is_client,
      is_technician  = public.contacts.is_technician  or excluded.is_technician;

-- 3) ALSO migrate any subcontractor names that already appear on jobs.
-- These were free-text before; pull distinct names so they show up in the
-- new Contacts list and tag them as Subcontractor.
insert into public.contacts (name, is_subcontractor)
select distinct trim(both ' ' from sub_name) as name, true
from (
  select unnest(string_to_array(subcontractors, ',')) as sub_name
  from public.jobs
  where subcontractors is not null
    and length(trim(subcontractors)) > 0
    and deleted_at is null
) s
where length(trim(both ' ' from sub_name)) > 0
on conflict (name) do update
  set is_subcontractor = true;

-- 4) JOBS: convert main_tech (single text) and subcontractors (single text)
-- into TEXT[] arrays so they can hold multiple values. We keep the original
-- columns intact and add new array columns alongside, then backfill — that
-- way nothing existing breaks if a build hasn't deployed yet.
alter table public.jobs
  add column if not exists main_techs text[],
  add column if not exists subcontractor_names text[];

-- Backfill main_techs from the existing single main_tech value
update public.jobs
set main_techs = array[main_tech]
where main_techs is null and main_tech is not null and length(trim(main_tech)) > 0;

-- Backfill subcontractor_names by splitting the comma-separated text
update public.jobs
set subcontractor_names = (
  select array_agg(trim(both ' ' from x))
  from unnest(string_to_array(subcontractors, ',')) as x
  where length(trim(both ' ' from x)) > 0
)
where subcontractor_names is null
  and subcontractors is not null
  and length(trim(subcontractors)) > 0;

-- Empty arrays where nothing was set, so the app never sees null when reading.
update public.jobs set main_techs = '{}' where main_techs is null;
update public.jobs set subcontractor_names = '{}' where subcontractor_names is null;
