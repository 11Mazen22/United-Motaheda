-- Migration: lock profiles.role / profiles.status from self-escalation - 2026-07-07
--
-- Found during a production-readiness security audit: public.profiles has
-- row-level RLS policies (profiles_select/profiles_insert/profiles_update,
-- from 20260705_fix_has_permission_rbac_crash.sql) that allow a user to
-- read/insert/update their OWN row (`auth.uid() = id`), with no column-level
-- restriction. Postgres RLS `USING`/`WITH CHECK` clauses only see whole rows,
-- not individual column diffs, so nothing today stops an authenticated
-- customer from running, e.g. via browser devtools:
--
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', myOwnId)
--
-- ...which the existing policy permits outright, since `auth.uid() = id` is
-- true for their own row. `role` gates the entire admin panel (hasPermission
-- / AdminRole checks throughout apps/shopper-web), and `status` gates
-- staff active/inactive state — both must never be self-editable.
--
-- Fix: a BEFORE INSERT OR UPDATE trigger, which (unlike RLS) can compare
-- OLD vs NEW column values. Managers/admins keep full write access (needed
-- for UsersManager/StaffManager role & status changes); everyone else's
-- writes to `role`/`status` are silently pinned back to the existing value
-- (or the safe default on insert) rather than erroring the whole request,
-- so unrelated self-service profile edits (name/phone/address) are
-- unaffected.

create or replace function public.profiles_guard_role_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_manager() then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.role   := 'customer';
    new.status := 'Active';
    return new;
  end if;

  -- TG_OP = 'UPDATE': pin role/status back to their pre-update values for
  -- non-managers, rather than rejecting the whole update outright.
  new.role   := old.role;
  new.status := old.status;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role_status_trg on public.profiles;
create trigger profiles_guard_role_status_trg
  before insert or update on public.profiles
  for each row
  execute function public.profiles_guard_role_status();

-- ─── Done ─────────────────────────────────────────────────────────────────────
