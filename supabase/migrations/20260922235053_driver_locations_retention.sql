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
  'Deletes driver_locations rows older than p_retention_days (default 7), batched at p_batch_limit per call. Scheduled daily via pg_cron (cleanup-stale-driver-locations). Returns rows deleted.';

select cron.schedule(
  'cleanup-stale-driver-locations',
  '30 3 * * *',
  $$ select public.cleanup_stale_driver_locations(); $$
);
;
