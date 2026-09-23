
-- Secure, non-destructive native push-device registration.
create or replace function public.register_device_push_token(
  p_device_id text,
  p_push_token text,
  p_platform text,
  p_app_version text default null
)
returns public.user_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_devices;
begin
  if v_user_id is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if nullif(trim(p_device_id), '') is null or nullif(trim(p_push_token), '') is null then
    raise exception 'invalid_push_device' using errcode = '22023';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid_push_platform' using errcode = '22023';
  end if;

  select *
  into v_row
  from public.user_devices
  where device_id = p_device_id or push_token = p_push_token
  order by (device_id = p_device_id) desc, last_seen_at desc
  limit 1
  for update;

  if v_row.id is null then
    insert into public.user_devices (
      user_id, device_id, push_token, platform, app_version,
      is_active, last_seen_at, updated_at
    )
    values (
      v_user_id, p_device_id, p_push_token, p_platform, p_app_version,
      true, now(), now()
    )
    returning * into v_row;
  else
    update public.user_devices
    set user_id = v_user_id,
        device_id = p_device_id,
        push_token = p_push_token,
        platform = p_platform,
        app_version = p_app_version,
        is_active = true,
        last_seen_at = now(),
        updated_at = now()
    where id = v_row.id
    returning * into v_row;

    update public.user_devices
    set is_active = false, updated_at = now()
    where id <> v_row.id
      and (device_id = p_device_id or push_token = p_push_token);
  end if;

  return v_row;
end;
$$;

revoke all on function public.register_device_push_token(text, text, text, text) from public;
grant execute on function public.register_device_push_token(text, text, text, text) to authenticated;

create or replace function public.deactivate_push_device(p_device_id text)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.user_devices
  set is_active = false, updated_at = now()
  where user_id = auth.uid() and device_id = p_device_id;
$$;

revoke all on function public.deactivate_push_device(text) from public;
grant execute on function public.deactivate_push_device(text) to authenticated;
;
