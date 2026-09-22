-- Close the transition_order() -> 'cancelled' bypass.
--
-- transition_order() previously accepted 'cancelled' as a valid
-- p_next_status from most pre-dispatch states and did a bare status UPDATE
-- with none of execute_order_cancellation()'s cleanup: no delivery_assignments
-- supersession, no inventory release, no refund row, no customer
-- notification/outbox insert, no cancellations audit row.
--
-- This was only safe in practice because every current caller already
-- special-cases 'cancelled' in application code before reaching this RPC:
--   - apps/shopper-native pharmacist orders.ts routes 'cancelled' through the
--     cancel-order Edge Function (-> execute_order_cancellation) instead.
--   - apps/shopper-native driver api.ts's transition_order calls only ever
--     pass 'out_for_delivery'/'delivered', never 'cancelled'.
--   - apps/shopper-web's admin dropdown goes through admin_transition_order,
--     which already delegates 'cancelled' to execute_order_cancellation.
-- Nothing enforced that at the RPC layer itself -- a future/overlooked call
-- site passing 'cancelled' straight to transition_order would silently skip
-- all cancellation cleanup. This migration makes the RPC refuse that
-- transition outright, so the only way to cancel an order is through
-- execute_order_cancellation (directly, via admin_transition_order, or via
-- the cancel-order Edge Function), regardless of what any future caller does.
create or replace function public.transition_order(p_order_id uuid, p_next_status text)
returns orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select role::text into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'manager', 'pharmacist', 'driver') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if p_next_status = 'cancelled' then
    raise exception 'use_execute_order_cancellation' using errcode = '22023',
      hint = 'Cancellation must go through execute_order_cancellation() (directly, via admin_transition_order, or the cancel-order Edge Function) so assignment/inventory/refund/notification cleanup always runs.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if not (
    (v_order.status::text = 'pending' and p_next_status = 'verification') or
    (v_order.status::text = 'verification' and p_next_status in ('payment_pending', 'payment_approved')) or
    (v_order.status::text = 'payment_pending' and p_next_status = 'payment_approved') or
    (v_order.status::text = 'payment_approved' and p_next_status = 'preparing') or
    (v_order.status::text = 'preparing' and p_next_status = 'ready') or
    (v_order.status::text = 'ready' and p_next_status = 'driver_assigned') or
    (v_order.status::text = 'driver_assigned' and p_next_status = 'driver_accepted') or
    (v_order.status::text = 'driver_accepted' and p_next_status = 'out_for_delivery') or
    (v_order.status::text = 'out_for_delivery' and p_next_status = 'delivered') or
    (v_order.status::text in ('delivered', 'cancelled') and p_next_status = 'archived')
  ) then
    raise exception 'invalid_order_transition' using errcode = '22023';
  end if;

  if v_role = 'driver' then
    if p_next_status not in ('driver_accepted', 'out_for_delivery', 'delivered')
       or v_order.assigned_driver_id is distinct from auth.uid()
       or not exists (
         select 1
         from public.delivery_assignments as assignment
         where assignment.order_id = p_order_id
           and assignment.driver_id = auth.uid()
           and (
             (p_next_status = 'driver_accepted' and assignment.response_status = 'offered')
             or (p_next_status in ('out_for_delivery', 'delivered') and assignment.response_status = 'accepted')
           )
       ) then
      raise exception 'insufficient_privilege' using errcode = '42501';
    end if;
  end if;

  if v_role = 'pharmacist' then
    if p_next_status not in ('verification', 'payment_pending', 'payment_approved', 'preparing', 'ready') then
      raise exception 'insufficient_privilege' using errcode = '42501';
    end if;
  end if;

  update public.orders
  set status = p_next_status::public.order_status,
      last_status_at = now(),
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$function$;
