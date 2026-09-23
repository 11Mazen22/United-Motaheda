-- Close the accidental drift between payment verification and payment
-- approval, confirmed by evidence (not guessed): admin_review_payment()
-- was added purely as an RLS workaround (20260904134500_admin_payment_review_rpc.sql
-- -- the web admin's "Verify Payment" button silently no-op'd for
-- pharmacists because orders' UPDATE policy is admin/manager-only) and only
-- ever wrote payment_status. Nothing in that migration, in transition_order's
-- state graph, in any notification, or in any test/doc ever links it to
-- orders.status. Meanwhile the pharmacist app has its own, completely
-- independent "Approve Payment" action (transition_order -> payment_approved)
-- that never reads payment_status. Two disconnected "I checked the payment"
-- signals that were clearly meant to be one, not a deliberate two-actor
-- design -- confirmed via a dedicated evidence audit this session (git
-- history, RLS/state-machine cross-referencing, UI copy, notifications).
--
-- Fix, symmetric in both directions:
--   1. admin_review_payment('verified') now also advances orders.status to
--      payment_approved when the order is still sitting at verification/
--      payment_pending -- the exact manual step a pharmacist would
--      otherwise have to separately remember to do after someone else
--      already verified the payment. Wrapped so a downstream transition
--      failure (order already moved on) never undoes the payment
--      verification write itself.
--   2. transition_order() now marks payment_status = 'verified' whenever
--      ANY actor advances an order to payment_approved -- a pharmacist
--      approving payment directly, without going through admin_review_payment,
--      is exactly the assertion payment_status='verified' is meant to record.
-- payment_status = 'failed' behavior is intentionally untouched -- that path
-- already forces cancellation from the client (OrdersManager.tsx) and
-- inventing new automatic status transitions there is a separate, riskier
-- change than what the evidence here actually supports fixing.

create or replace function public.admin_review_payment(
  p_order_id uuid,
  p_decision text,
  p_failure_reason text default null::text
)
returns orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if not (
    public.is_manager()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'pharmacist')
  ) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if p_decision not in ('verified', 'failed') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;

  update public.orders
  set payment_status = p_decision,
      failure_reason = case when p_decision = 'failed'
        then coalesce(nullif(trim(p_failure_reason), ''), 'تم رفض الإيصال من قِبَل الإدارة')
        else failure_reason
      end,
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  if v_order.id is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if p_decision = 'verified' and v_order.status::text in ('verification', 'payment_pending') then
    begin
      v_order := public.transition_order(p_order_id, 'payment_approved');
    exception when others then
      -- The order moved on (or the calling role lost the transition) between
      -- our UPDATE above and here -- the payment verification just recorded
      -- must still stand; only the redundant auto-advance is skipped.
      null;
    end;
  end if;

  return v_order;
end;
$function$;

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
      updated_at = now(),
      payment_status = case
        when p_next_status = 'payment_approved' and payment_status is distinct from 'verified' then 'verified'
        else payment_status
      end
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$function$;
