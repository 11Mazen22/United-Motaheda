-- Migration: allow a driver to notify their assigned order's customer - 2026-07-10
--
-- Found while wiring pickup/delivery notifications into the native driver
-- app: public.notifications only allowed admin/manager roles to INSERT
-- ("Admins can insert notifications for any user" / "notifications_insert_
-- admin"). A driver confirming pickup or marking a delivery complete from
-- the native (driver) section needs to notify that order's customer
-- directly (bypassing the web admin layer entirely, so the existing
-- admin-only notifyOrderStatusChange call sites never run) — under the
-- existing policies that insert would be silently blocked by RLS.
--
-- Narrowly scoped: a driver may only insert a notification for the
-- customer of an order CURRENTLY assigned to them — not for arbitrary
-- users. This can't be abused to spam other customers.

drop policy if exists "drivers can notify their assigned order's customer" on public.notifications;
create policy "drivers can notify their assigned order's customer"
  on public.notifications for insert
  with check (
    (select role from public.profiles where id = auth.uid()) = 'driver'
    and exists (
      select 1 from public.orders o
      where o.assigned_driver_id = auth.uid()
        and o.user_id = notifications.user_id
    )
  );

-- ─── Done ─────────────────────────────────────────────────────────────────────
