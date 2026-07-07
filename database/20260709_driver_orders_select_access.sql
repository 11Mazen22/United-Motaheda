-- Migration: driver read access to assigned orders - 2026-07-09
--
-- Found while building the delivery workflow's native driver screens: the
-- public.orders / public.order_items RLS policies only ever granted SELECT
-- to the order's own customer (user_id = auth.uid()) or admin/manager
-- (orders_select_admin / order_items_select_admin). There was NO policy
-- letting a driver read an order assigned to them at all — meaning the
-- existing web driver tool (apps/shopper-web/src/app/driver/DriverApp.tsx,
-- via listDriverManifest in logisticsApi.ts) has been running under a
-- driver's own authenticated session this whole time with no RLS grant to
-- actually see the orders it queries. This adds the missing grant so both
-- the existing web tool and the new native driver screens can function.

drop policy if exists "orders_select_driver" on public.orders;
create policy "orders_select_driver"
  on public.orders for select
  using (assigned_driver_id = auth.uid());

drop policy if exists "order_items_select_driver" on public.order_items;
create policy "order_items_select_driver"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.assigned_driver_id = auth.uid()
    )
  );

-- ─── Done ─────────────────────────────────────────────────────────────────────
