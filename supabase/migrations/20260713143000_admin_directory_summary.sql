-- Enterprise admin directory summary - 2026-07-13
--
-- Provides one SECURITY DEFINER summary RPC for the redesigned Users and
-- Employees modules. It aggregates status mix, role mix, verified-email
-- counts, and recent activity without exposing auth.users directly to the
-- browser.

create or replace function public.admin_directory_summary(p_scope text default 'all')
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  with scoped_profiles as (
    select p.id, p.role, p.status
    from public.profiles p
    where case lower(coalesce(p_scope, 'all'))
      when 'staff' then p.role <> 'customer'
      when 'customers' then p.role = 'customer'
      else true
    end
  ),
  auth_meta as (
    select u.id, u.last_sign_in_at, u.email_confirmed_at
    from auth.users u
    join scoped_profiles sp on sp.id = u.id
  )
  select
    case
      when public.is_manager() then json_build_object(
        'total', count(*),
        'active', count(*) filter (where sp.status = 'Active'),
        'suspended', count(*) filter (where sp.status = 'Suspended'),
        'inactive', count(*) filter (where sp.status = 'Inactive'),
        'staff', count(*) filter (where sp.role <> 'customer'),
        'customers', count(*) filter (where sp.role = 'customer'),
        'admins', count(*) filter (where sp.role = 'admin'),
        'managers', count(*) filter (where sp.role = 'manager'),
        'pharmacists', count(*) filter (where sp.role = 'pharmacist'),
        'drivers', count(*) filter (where sp.role = 'driver'),
        'verified', count(*) filter (where am.email_confirmed_at is not null),
        'recentlyActive7d', count(*) filter (where am.last_sign_in_at >= now() - interval '7 days')
      )
      else json_build_object(
        'total', 0,
        'active', 0,
        'suspended', 0,
        'inactive', 0,
        'staff', 0,
        'customers', 0,
        'admins', 0,
        'managers', 0,
        'pharmacists', 0,
        'drivers', 0,
        'verified', 0,
        'recentlyActive7d', 0
      )
    end
  from scoped_profiles sp
  left join auth_meta am on am.id = sp.id;
$$;

grant execute on function public.admin_directory_summary(text) to authenticated;
