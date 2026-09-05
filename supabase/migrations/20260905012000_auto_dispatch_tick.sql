-- auto_dispatch_tick(): the automatic driver-dispatch waterfall. Runs every
-- 7 seconds via pg_cron (scheduled below), impersonating a real admin (same
-- pattern as expire-stale-reservations) so it can call rank_available_drivers
-- and transition_order, both of which require an authenticated admin/manager
-- role.
--
-- Two-phase per tick:
--   1. Expire any offer past its deadline -- one row at a time, each under
--      its own order lock (see the locking convention on
--      orders.dispatch_status), not one blanket UPDATE -- so this can never
--      race a concurrent manual_assign_driver/accept/decline for the same
--      order.
--   2. For every order genuinely idle with no driver (the ONLY reachable
--      state here -- 'searching' always has a driver by the invariant),
--      rank candidates, exclude anyone already declined/expired/superseded
--      for this specific order, and offer to the best remaining one. No
--      candidates left -> escalate, notifying every admin/manager, gated on
--      the actual idle->escalated transition so a later legitimate
--      re-escalation (after a manual fix) still notifies.
create or replace function public.auto_dispatch_tick()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_expired record;
  v_order record;
  v_candidate uuid;
  v_assignment_id uuid;
  v_transitioned uuid;
  v_admin record;
begin
  if not pg_try_advisory_xact_lock(hashtext('auto_dispatch_tick')) then
    return;  -- a previous tick is still running; skip this cycle, the next one catches up
  end if;

  -- Phase 1: expire stale offers, one at a time, order-locked.
  for v_expired in
    select id, order_id, driver_id
    from delivery_assignments
    where response_status = 'offered' and expires_at is not null and expires_at < now()
  loop
    perform id from orders where id = v_expired.order_id for update;  -- lock first

    if exists (
      select 1 from delivery_assignments
      where id = v_expired.id and response_status = 'offered' and expires_at < now()
    ) then  -- re-verify under the lock: still expired, nothing else changed it meanwhile
      update delivery_assignments set response_status = 'expired', responded_at = now()
      where id = v_expired.id;

      update orders set assigned_driver_id = null, dispatch_status = 'idle'
      where id = v_expired.order_id and assigned_driver_id = v_expired.driver_id
        and dispatch_status = 'searching';
    end if;
  end loop;

  -- Phase 2: offer to the next candidate, or escalate.
  for v_order in
    select id, branch_id from orders
    where status = 'ready' and dispatch_status = 'idle' and assigned_driver_id is null
    for update skip locked  -- this cursor IS the lock-first step for this phase;
                             -- a row a manual assignment is touching right now is
                             -- simply left for the next tick, never blocked on
  loop
    select r.driver_user_id into v_candidate
    from rank_available_drivers(v_order.id) r
    where not exists (
      select 1 from delivery_assignments da
      where da.order_id = v_order.id and da.driver_id = r.driver_user_id
        and da.response_status in ('declined', 'expired', 'superseded')
    )
    order by r.score desc
    limit 1;

    if v_candidate is not null then
      insert into delivery_assignments (order_id, driver_id, assignment_kind, response_status, expires_at)
      values (v_order.id, v_candidate, 'assigned', 'offered', now() + interval '25 seconds')
      returning id into v_assignment_id;

      update orders set assigned_driver_id = v_candidate, dispatch_status = 'searching'
      where id = v_order.id;

      -- First offer on this order also advances the lifecycle status,
      -- exactly matching manual_assign_driver's first-time-assignment case.
      if (select status from orders where id = v_order.id) = 'ready' then
        perform transition_order(v_order.id, 'driver_assigned');
      end if;

      perform enqueue_notification(
        v_candidate, 'order', 'order_updates',
        'تم تعيين طلب جديد لك', 'تم تعيينك لتوصيل طلب جديد. راجع قائمة المهام الخاصة بك.',
        jsonb_build_object('kind', 'driver_assignment', 'orderId', v_order.id, 'assignmentId', v_assignment_id),
        '/(driver)/offer/' || v_assignment_id,
        'order:' || v_order.id || ':driver:' || v_candidate || ':offer:' || v_assignment_id
      );
    else
      update orders set dispatch_status = 'escalated'
      where id = v_order.id and dispatch_status = 'idle' and assigned_driver_id is null  -- the
      returning id into v_transitioned;                                                    -- ONLY
                                                                                              -- reachable
      if v_transitioned is not null then                          -- state here, per the invariant
        for v_admin in select id from profiles where role in ('admin', 'manager') loop
          perform enqueue_notification(
            v_admin.id, 'order', 'order_updates',
            'تعذر إيجاد سائق للطلب', 'لم يتم العثور على سائق متاح لهذا الطلب. يرجى المراجعة والتعيين يدوياً.',
            jsonb_build_object('kind', 'dispatch_escalated', 'orderId', v_order.id),
            '/admin/orders?order=' || v_order.id,
            'order:' || v_order.id || ':escalated:' || v_admin.id || ':' || now()::text
          );
          -- Per-recipient key: without v_admin.id here, all 4 admins in this
          -- loop shared the exact same key (same order, same transaction
          -- now()) -- enqueue_notification's own idempotency dedup then
          -- collapsed calls 2-4 into no-ops, so only the first admin in the
          -- loop actually got notified. Confirmed live via the verification
          -- suite before this fix (1 notification instead of 4).
        end loop;
      end if;
    end if;
  end loop;
end;
$function$;

revoke all on function public.auto_dispatch_tick() from public;

-- Impersonates the same real admin already used by expire-stale-reservations,
-- so rank_available_drivers/transition_order's internal role checks pass.
select cron.schedule(
  'auto-dispatch-tick',
  '7 seconds',
  $$SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = '{"sub":"df4c117e-38af-44a3-a227-77c883b74c10","role":"authenticated"}'; SELECT auto_dispatch_tick();$$
);
