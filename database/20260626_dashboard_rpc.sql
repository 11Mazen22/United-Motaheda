-- Dashboard orders aggregate RPC
-- Returns total order count, total revenue, and per-day breakdown for the chart.
-- Called by adminDashboardApi.getSupabaseDashboardStats().

create or replace function get_orders_dashboard()
returns json
language sql
security definer
set search_path = public
as $$
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
$$;

grant execute on function get_orders_dashboard() to authenticated;
