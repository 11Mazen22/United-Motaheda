-- Regression from 20260902140000_close_anon_write_and_auth_gaps.sql: that
-- migration closed a real hole (get_orders_dashboard had zero auth check,
-- leaking total order count/revenue/30-day sales to anyone) by gating it on
-- is_manager() -- but that gate only covers 'admin'/'manager', and this RPC
-- is called unconditionally by shopper-web's DashboardOverview.tsx the
-- moment ANY admin-panel session loads, including a pharmacist's -- and
-- AdminLayout.tsx explicitly allows role 'pharmacist' into the admin panel
-- (`["admin", "manager", "pharmacist"].includes(user.role)`). The original
-- fix's own justification only checked shopper-web's admin dashboard as a
-- caller, not that a third role is a legitimate visitor to that same page.
-- Confirmed live: a pharmacist opening the admin panel got a raw
-- "insufficient_privilege" error on the very first screen.
--
-- Broadens the gate to match AdminLayout's own allowed-roles list, instead
-- of touching is_manager() itself (which many OTHER, genuinely
-- admin/manager-only RPCs correctly rely on -- widening it globally would
-- reopen a different set of holes).
CREATE OR REPLACE FUNCTION public.get_orders_dashboard()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_manager()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacist')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN (
    select json_build_object(
      'total_orders', (
        select count(*)::int from public.orders
      ),
      'total_sales', (
        select coalesce(sum(total), 0)::float from public.orders
      ),
      'orders_by_day', (
        select coalesce(json_agg(d order by d.day), '[]'::json)
        from (
          select
            (created_at at time zone 'Africa/Cairo')::date::text as day,
            count(*)::int                                         as orders,
            coalesce(sum(total), 0)::float                        as sales
          from public.orders
          where created_at >= now() - interval '30 days'
          group by (created_at at time zone 'Africa/Cairo')::date
        ) d
      )
    )
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
