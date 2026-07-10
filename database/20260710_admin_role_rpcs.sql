-- Migration: admin last-sign-in + status-count RPCs - 2026-07-10
--
-- Part of the Employee/User Management redesign. Two SECURITY DEFINER
-- functions, both internally gated by is_manager() so a non-manager caller
-- gets an empty/zero result rather than an error — matching this codebase's
-- existing silent-safe-default convention (see profiles_guard_role_status()).
--
-- admin_get_last_sign_in: last_sign_in_at/email_confirmed_at live in
-- auth.users, not public.profiles, and auth.users is not exposed to the
-- client directly (it also holds encrypted_password, tokens, etc.) — this
-- exposes only the two safe fields, batched by an array of ids so a page
-- of N accounts costs one query, not N. Covers both "activity" sorting and
-- "verification status" from the redesign spec in a single call.
--
-- admin_profile_status_counts: replaces UsersManager.tsx's loadCounts(),
-- which pulls the entire profiles.status column unfiltered just to compute
-- four numbers client-side, re-run after every mutation.

create or replace function public.admin_get_last_sign_in(user_ids uuid[])
returns table(id uuid, last_sign_in_at timestamptz, email_confirmed_at timestamptz)
language sql
stable security definer
set search_path to 'public'
as $$
  select u.id, u.last_sign_in_at, u.email_confirmed_at
  from auth.users u
  where u.id = any(user_ids) and public.is_manager();
$$;

grant execute on function public.admin_get_last_sign_in(uuid[]) to authenticated;

create or replace function public.admin_profile_status_counts()
returns json
language sql
stable security definer
set search_path to 'public'
as $$
  select case when public.is_manager() then
    json_build_object(
      'total',     count(*),
      'active',    count(*) filter (where status = 'Active'),
      'suspended', count(*) filter (where status = 'Suspended'),
      'inactive',  count(*) filter (where status = 'Inactive')
    )
  else
    json_build_object('total', 0, 'active', 0, 'suspended', 0, 'inactive', 0)
  end
  from public.profiles;
$$;

grant execute on function public.admin_profile_status_counts() to authenticated;

-- ─── Done ─────────────────────────────────────────────────────────────────────
