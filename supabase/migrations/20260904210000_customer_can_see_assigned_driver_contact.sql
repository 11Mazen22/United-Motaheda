-- Customers could never see their assigned driver's name/phone: profiles'
-- only SELECT policy is `(uid() = id) OR is_manager())`, so a customer
-- querying the driver's profile row for their own order got RLS-filtered
-- to nothing -- confirmed live via a full order-lifecycle test (pharmacist
-- -> ready -> admin assigns driver -> driver accepts -> customer-facing
-- join on profiles came back with driver_name/driver_phone both NULL,
-- despite orders.assigned_driver_id being correctly set the whole time).
--
-- FIRST ATTEMPT at this (same migration timestamp, since it never actually
-- shipped) used a raw EXISTS subquery against orders directly inside the
-- policy. That created infinite RLS recursion: orders_select_pharmacist
-- (and _driver) already query profiles to check the caller's role, so
-- profiles' new policy querying orders closed the loop -- confirmed live,
-- it took down every authenticated query touching orders in production
-- for the few minutes before the policy was dropped. A SECURITY DEFINER
-- function breaks the cycle: it runs with the function owner's privileges,
-- which bypasses RLS on the tables it reads internally, so checking
-- "is this driver assigned to one of my orders" from inside profiles'
-- policy never re-enters orders' own RLS evaluation.
--
-- Narrow by construction, not just narrow by intent: only returns true for
-- role='driver' rows, and only once a real order ties that specific driver
-- to the specific calling customer at a stage where they'd legitimately
-- need contact info -- not a general profiles read grant.
create or replace function public.is_customers_assigned_driver(p_driver_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.orders o
    where o.assigned_driver_id = p_driver_id
      and o.user_id = auth.uid()
      and o.status in ('driver_assigned', 'driver_accepted', 'out_for_delivery', 'delivered')
  );
$$;

revoke all on function public.is_customers_assigned_driver(uuid) from public;
grant execute on function public.is_customers_assigned_driver(uuid) to authenticated;

create policy "profiles_select_assigned_driver_for_customer"
on public.profiles
for select
using (
  role = 'driver'
  and public.is_customers_assigned_driver(profiles.id)
);
