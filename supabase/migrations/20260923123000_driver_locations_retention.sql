-- driver_locations retention.
--
-- driver_locations is an append-only GPS ping log (one row per broadcast,
-- ~every 20s while a delivery is out_for_delivery, see driver-location Edge
-- Function). Nothing reads pings older than track-order's own 10-minute
-- staleness window, and no cleanup/retention job existed anywhere -- the
-- table would grow unbounded forever. Sweep rows past a generous retention
-- window (7 days -- long enough for any near-term ops/debugging look-back,
-- short enough to keep the table bounded) on a daily schedule, batched like
-- expire_stale_reservations() to avoid one large delete holding locks.

create or replace function public.cleanup_stale_driver_locations(
  p_retention_days integer default 7,
  p_batch_limit integer default 5000
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_deleted integer;
begin
  with victims as (
    select id
    from public.driver_locations
    where captured_at < now() - (p_retention_days || ' days')::interval
    limit p_batch_limit
  )
  delete from public.driver_locations
  where id in (select id from victims);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

comment on function public.cleanup_stale_driver_locations(integer, integer) is
  'Deletes driver_locations rows older than p_retention_days (default 7), '
  'batched at p_batch_limit per call. Scheduled daily via pg_cron '
  '(cleanup-stale-driver-locations). Returns rows deleted.';

-- No JWT-claims trick needed here (unlike expire-stale-reservations) --
-- this function does no application-level role check, it's pure
-- housekeeping DELETE run as the function owner.
select cron.schedule(
  'cleanup-stale-driver-locations',
  '30 3 * * *',
  $$ select public.cleanup_stale_driver_locations(); $$
);
