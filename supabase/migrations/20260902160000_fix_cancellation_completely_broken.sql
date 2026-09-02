-- Order cancellation was completely broken in production: confirmed live
-- (called get_order_actions() against a real order and got a genuine
-- Postgres error, not a theory) that its cancel-status IN-list contains
-- 'pharmacy_review', which is not a value of the order_status enum at
-- all. Postgres must resolve every literal in an IN-list against the
-- column's type before it can short-circuit on any of them, so this
-- broke the check for every order regardless of its actual status --
-- execute_order_cancellation calls this function unconditionally before
-- any writes, so every cancellation attempt failed and rolled back.
--
-- Also added: 'verification' was missing from the same list even though
-- transition_order's own canonical state machine (apps/api's
-- CANONICAL_ORDER_TRANSITIONS, the actual authority on what's legal)
-- allows verification -> cancelled -- get_order_actions should report
-- what that machine actually allows, not maintain its own drifted copy.
-- out_for_delivery is deliberately left non-cancellable, unchanged --
-- that looks like an intentional rule (a driver already has the physical
-- order) rather than an oversight, and isn't part of the confirmed bug.
CREATE OR REPLACE FUNCTION public.get_order_actions(p_order_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_order RECORD;
    v_role TEXT := 'customer';
    v_user_id UUID := auth.uid();
    v_is_owner BOOLEAN := false;
    v_is_assigned_driver BOOLEAN := false;
    v_can_cancel BOOLEAN := false;
    v_cancel_reason TEXT := NULL;
    v_can_return BOOLEAN := false;
    v_return_reason TEXT := NULL;
    v_cancel_reasons TEXT[] := '{}';
BEGIN
    -- Determine Role
    SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
    IF v_role IS NULL THEN
        v_role := 'customer';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN json_build_object(
            'cancel', json_build_object('allowed', false, 'reason', 'Order not found', 'reasons', '[]'::json),
            'return', json_build_object('allowed', false, 'reason', 'Order not found')
        );
    END IF;

    v_is_owner := (v_order.user_id = v_user_id);
    v_is_assigned_driver := (v_order.assigned_driver_id = v_user_id);

    -- Base Authorization Check
    IF v_role = 'customer' AND NOT v_is_owner THEN
        RETURN json_build_object(
            'cancel', json_build_object('allowed', false, 'reason', 'Unauthorized', 'reasons', '[]'::json),
            'return', json_build_object('allowed', false, 'reason', 'Unauthorized')
        );
    END IF;

    -- Cancellation Logic
    IF v_order.status IN ('pending', 'confirmed', 'verification', 'payment_pending', 'payment_approved', 'preparing', 'ready') THEN
        v_can_cancel := true;
    ELSIF v_order.status IN ('driver_assigned', 'driver_accepted') THEN
        v_can_cancel := true;
    ELSIF v_order.status = 'cancelled' THEN
        v_can_cancel := false;
        v_cancel_reason := 'Order is already cancelled.';
    ELSE
        -- picked_up, out_for_delivery, delivered
        v_can_cancel := false;
        v_cancel_reason := 'Order is already out for delivery or delivered. Cancellation is no longer possible.';
    END IF;

    -- Populate Reasons Based on Role
    IF v_role = 'customer' THEN
        v_cancel_reasons := ARRAY['CHANGED_MIND', 'ORDERED_BY_MISTAKE', 'WRONG_ADDRESS', 'DUPLICATE_ORDER', 'PAYMENT_PROBLEM', 'DELIVERY_DELAY', 'FOUND_ELSEWHERE', 'OTHER'];
    ELSIF v_role = 'pharmacist' OR v_role = 'admin' OR v_role = 'manager' THEN
        v_cancel_reasons := ARRAY['PRODUCT_UNAVAILABLE', 'STOCK_MISMATCH', 'PRESCRIPTION_REJECTED', 'PRESCRIPTION_UNCLEAR', 'PHARMACY_CANNOT_FULFILL', 'PHARMACY_CLOSED', 'OTHER'];
    ELSIF v_role = 'driver' THEN
        IF NOT v_is_assigned_driver THEN
            v_can_cancel := false;
            v_cancel_reason := 'Only the assigned driver can cancel this order.';
        END IF;
        v_cancel_reasons := ARRAY['CUSTOMER_UNREACHABLE', 'ADDRESS_UNREACHABLE', 'VEHICLE_ISSUE', 'SAFETY_ISSUE', 'DELIVERY_PROBLEM', 'OTHER'];
    END IF;

    -- Return Logic
    IF v_order.status = 'delivered' THEN
        v_can_return := true;
    ELSE
        v_can_return := false;
        v_return_reason := 'ORDER_NOT_DELIVERED';
    END IF;

    RETURN json_build_object(
        'cancel', json_build_object('allowed', v_can_cancel, 'reason', v_cancel_reason, 'reasons', array_to_json(v_cancel_reasons)),
        'return', json_build_object('allowed', v_can_return, 'reason', v_return_reason)
    );
END;
$function$;

-- The second break in the same path, also confirmed live: even once
-- get_order_actions stops erroring, execute_order_cancellation's cleanup
-- loop selects reservations in state IN ('reserved', 'committed') and
-- calls release_inventory on each -- but release_inventory only ever
-- accepted 'reserved', raising state_committed_not_releasable for any
-- committed one. Every order's inventory is committed at creation time
-- (see commit_inventory, called from create-order), so this is not an
-- edge case -- it's the normal state of every real order's reservations
-- by the time anyone tries to cancel. Nothing anywhere reversed a
-- committed reservation; this adds that path, mirroring
-- commit_inventory's own bookkeeping exactly in reverse (moves quantity
-- out of inventory_state.committed instead of .reserved -- .reserved is
-- correctly left untouched since committing already zeroed it out of
-- that bucket).
CREATE OR REPLACE FUNCTION public.release_inventory(p_reservation_id uuid, p_reason text, p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_user_id   uuid := auth.uid();
  v_res       public.inventory_reservations%rowtype;
  v_state     public.inventory_state%rowtype;
  v_was_committed boolean;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 16 then
    raise exception using errcode = '22023', message = 'idempotency_key_required';
  end if;

  select * into v_res from public.inventory_reservations
    where id = p_reservation_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'reservation_not_found';
  end if;

  if v_res.user_id <> v_user_id and not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  -- Idempotent: already-released returns the same shape.
  if v_res.state = 'released' then
    return jsonb_build_object(
      'reservation_id', v_res.id,
      'state',          'released',
      'replay',         true
    );
  end if;
  if v_res.state not in ('reserved', 'committed') then
    raise exception using errcode = '22023', message = 'state_' || v_res.state || '_not_releasable';
  end if;

  v_was_committed := (v_res.state = 'committed');

  perform public._inventory_lock(v_res.product_id);
  v_state := public._inventory_ensure_state(v_res.product_id);

  update public.inventory_reservations
     set state       = 'released',
         released_at = now(),
         metadata    = metadata || jsonb_build_object('release_reason', p_reason)
   where id = v_res.id;

  if v_was_committed then
    update public.inventory_state
       set committed = greatest(committed - v_res.quantity, 0)
     where product_id = v_res.product_id;
  else
    update public.inventory_state
       set reserved = greatest(reserved - v_res.quantity, 0)
     where product_id = v_res.product_id;
  end if;

  insert into public.stock_movements (
    product_id, delta_reserved, delta_committed, total_after, reserved_after, committed_after,
    kind, reservation_id, actor_id, idempotency_key, metadata
  ) values (
    v_res.product_id,
    case when v_was_committed then 0 else -v_res.quantity end,
    case when v_was_committed then -v_res.quantity else 0 end,
    v_state.total,
    case when v_was_committed then v_state.reserved else greatest(v_state.reserved - v_res.quantity, 0) end,
    case when v_was_committed then greatest(v_state.committed - v_res.quantity, 0) else v_state.committed end,
    'release', v_res.id, v_user_id, p_idempotency_key,
    jsonb_build_object('reason', p_reason, 'released_from', v_res.state)
  );

  return jsonb_build_object(
    'reservation_id', v_res.id,
    'state',          'released',
    'product_id',     v_res.product_id,
    'released',       v_res.quantity,
    'replay',         false
  );
end;
$function$;
