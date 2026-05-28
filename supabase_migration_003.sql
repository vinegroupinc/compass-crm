-- ============================================================================
-- COMPASS CRM — migration 003: ensure profile names are populated
-- Run in Supabase → SQL Editor → New query → Run.
-- This copies each user's full_name from their auth record into the profiles
-- table, so the "assign to" dropdown shows real names. Non-destructive:
-- it only fills in names; it doesn't delete or change anything else.
-- ============================================================================

-- Make sure every auth user has a profile row (in case any predate the trigger)
insert into public.profiles (id, full_name)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1))
from auth.users u
on conflict (id) do nothing;

-- Update profile names from the auth metadata (or email prefix as fallback)
update public.profiles p
set full_name = coalesce(
      (select u.raw_user_meta_data->>'full_name' from auth.users u where u.id = p.id),
      (select split_part(u.email,'@',1) from auth.users u where u.id = p.id),
      p.full_name
    )
where p.full_name is null
   or p.full_name = ''
   or p.full_name <> coalesce(
        (select u.raw_user_meta_data->>'full_name' from auth.users u where u.id = p.id),
        p.full_name
      );
