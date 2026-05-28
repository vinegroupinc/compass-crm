-- ============================================================================
-- COMPASS CRM — Supabase schema
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query → Run.
-- It is safe to re-run (uses "if not exists" / "drop policy if exists").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES (one row per auth user). Holds the future "role" column.
--    Everyone is 'admin' (full access) at launch. Add roles later WITHOUT
--    a rebuild by changing this column + tightening policies.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'admin',  -- future: 'admin' | 'tech' | 'viewer' ...
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is added in Supabase.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. SAVED LISTS (management companies + techs)
-- ----------------------------------------------------------------------------
create table if not exists public.saved_list_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('management_company','tech')),
  name text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. JOBS
-- ----------------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  street_address text not null,         -- property history matches on THIS (unit ignored)
  unit text,                            -- optional, kept separate
  management_company text,
  unit_manager text,
  job_type text not null default 'Turn',
  start_date date,
  end_date date,
  main_tech text,
  subcontractors text,
  crew_access text,
  status text not null default 'New Lead',
  status_changed_at timestamptz not null default now(),  -- drives 7-day followup
  needs_attention boolean not null default false,
  high_priority boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists jobs_street_idx on public.jobs (street_address);
create index if not exists jobs_status_idx on public.jobs (status);

-- ----------------------------------------------------------------------------
-- 4. TASKS (work-coordination, assigned to a user)
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  text text not null,
  assigned_user_id uuid references auth.users(id),
  assigned_name text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tasks_job_idx on public.tasks (job_id);
create index if not exists tasks_assignee_idx on public.tasks (assigned_user_id);

-- ----------------------------------------------------------------------------
-- 5. NOTES (append-only; author may edit own; NEVER overwritten by others)
-- ----------------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  body text not null,
  author_id uuid not null references auth.users(id) default auth.uid(),
  author_name text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists notes_job_idx on public.notes (job_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Launch model: any AUTHENTICATED user has full read/write on jobs, tasks,
-- lists, and profiles. The ONLY hard restriction is on notes (append-only,
-- author-edit-only) to satisfy the "cannot be overwritten by another user"
-- requirement. Per-user roles can be layered on later by editing these
-- policies to check public.profiles.role — no schema rebuild required.
-- ============================================================================

alter table public.profiles        enable row level security;
alter table public.saved_list_items enable row level security;
alter table public.jobs             enable row level security;
alter table public.tasks            enable row level security;
alter table public.notes            enable row level security;

-- ---- PROFILES ----
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid());

-- ---- SAVED LISTS (full access for any authenticated user) ----
drop policy if exists lists_all on public.saved_list_items;
create policy lists_all on public.saved_list_items
  for all to authenticated using (true) with check (true);

-- ---- JOBS (full access for any authenticated user) ----
drop policy if exists jobs_all on public.jobs;
create policy jobs_all on public.jobs
  for all to authenticated using (true) with check (true);

-- ---- TASKS (full access for any authenticated user) ----
drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks
  for all to authenticated using (true) with check (true);

-- ---- NOTES — the important one ----
-- Anyone authenticated can READ all notes.
drop policy if exists notes_read on public.notes;
create policy notes_read on public.notes
  for select to authenticated using (true);

-- Anyone authenticated can INSERT a note, but only AS THEMSELVES
-- (author_id is forced to their own uid).
drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes
  for insert to authenticated with check (author_id = auth.uid());

-- Only the ORIGINAL AUTHOR may UPDATE their own note. No one can edit
-- someone else's note. (Append-not-replace is preserved: edits are limited
-- to the author, and the app stamps edited_at.)
drop policy if exists notes_update_own on public.notes;
create policy notes_update_own on public.notes
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- DELETE is intentionally NOT granted to anyone → notes can never be removed.
-- (No delete policy = no delete allowed under RLS.)

-- ============================================================================
-- OPTIONAL SEED DATA — uncomment to pre-fill the dropdowns.
-- ============================================================================
-- insert into public.saved_list_items (kind, name) values
--   ('management_company','Pacific Property Group'),
--   ('management_company','Westside Management'),
--   ('tech','Carlos R.'),
--   ('tech','Dmitri V.');
