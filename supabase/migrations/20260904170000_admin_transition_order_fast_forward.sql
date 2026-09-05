-- The admin dashboard's order status control is a simplified 5-bucket
-- picker (Pending/Processing/Out for Delivery/Delivered/Cancelled), but
-- transition_order() enforces the real, more granular workflow one hop at a
-- time (pending -> verification -> payment_approved -> preparing -> ready
-- -> driver_assigned -> driver_accepted -> out_for_delivery -> delivered).
-- Reproduced live: editing any "Pending" order to "Processing" (-> the
-- picker's `preparing`) 400'd every single time with invalid_order_transition,
-- because pending can only step to verification or cancelled — there is no
-- direct pending -> preparing edge, by design (that design is correct and
-- unchanged here).
--
-- Admins have the standing authority to skip past those intermediate
-- stages in one action (unlike a pharmacist, who has to actually do the
-- verification/payment work to legitimately get there) — this was always
-- the intent of exposing only 5 buckets in the admin UI. What was missing
-- is a way to exercise that authority without walking the chain by hand.
-- _order_status_path() computes the hop sequence for the one broadly
-- linear path this workflow actually has; admin_transition_order() now
-- walks it via repeated transition_order() calls inside its own single
-- transaction, so a failure partway rolls the whole jump back instead of
-- leaving the order stranded mid-chain.
create or replace function public._order_status_path(p_from text, p_to text)
returns text[]
language plpgsql
immutable
as $function$
declare
  v_chain text[] := array['pending','verification','payment_approved','preparing','ready','driver_assigned','driver_accepted','out_for_delivery','delivered'];
  v_from_idx int;
  v_to_idx int;
begin
  v_from_idx := array_position(v_chain, p_from);
  v_to_idx := array_position(v_chain, p_to);
  if v_from_idx is null or v_to_idx is null or v_to_idx <= v_from_idx then
    return null;
  end if;
  return v_chain[v_from_idx + 1 : v_to_idx];
end;
$function$;

create or replace function public.admin_transition_order(p_order_id uuid, p_next_status text)
returns orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders;
  v_current text;
  v_path text[];
  v_step text;
begin
  if auth.uid() is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if p_next_status = 'cancelled' then
    perform public.execute_order_cancellation(
      p_order_id,
      'OTHER',
      'Cancelled by staff via admin dashboard status control',
      'admin-status-' || p_order_id::text || '-' || extract(epoch from clock_timestamp())::text
    );
    select * into v_order from public.orders where id = p_order_id;
    return v_order;
  end if;

  select status::text into v_current from public.orders where id = p_order_id;
  if v_current is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  -- Already at the target (a no-op double-click) or a single valid hop:
  -- try the direct transition first so this stays a plain passthrough for
  -- the common case, matching prior behavior exactly.
  if v_current = p_next_status then
    select * into v_order from public.orders where id = p_order_id;
    return v_order;
  end if;

  begin
    perform public.transition_order(p_order_id, p_next_status);
    select * into v_order from public.orders where id = p_order_id;
    return v_order;
  exception when sqlstate '22023' then
    -- Not a valid single hop from here — fall through to the multi-hop path below.
    null;
  end;

  v_path := public._order_status_path(v_current, p_next_status);
  if v_path is null then
    raise exception 'invalid_order_transition' using errcode = '22023';
  end if;

  foreach v_step in array v_path loop
    perform public.transition_order(p_order_id, v_step);
  end loop;

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$function$;
