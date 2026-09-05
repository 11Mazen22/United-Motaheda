-- manual_assign_driver: replaces assignDriver()/reassignDriver()'s direct
-- client-side multi-step .update()/.insert() calls with one atomic
-- transaction. Unifies both of their existing behaviors exactly (first-time
-- assignment advances orders.status via transition_order(); reassignment
-- leaves status untouched, matching reassignDriver()'s current behavior)
-- while adding: superseding the old offer atomically with the new one (the
-- core "an old offer can never mutate an order after something else has
-- taken its place" invariant), dispatch_status bookkeeping, and treating
-- the RPC itself -- not the caller -- as the authorization boundary.
create or replace function public.manual_assign_driver(p_order_id uuid, p_driver_id uuid)
returns public.orders
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

  if (select role::text from public.profiles where id = auth.uid()) not in ('admin', 'manager') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  -- The RPC is the authorization boundary -- verify p_driver_id is a real,
  -- non-suspended driver rather than trusting the caller. Deliberately
  -- lighter than rank_available_drivers' full eligibility check (doesn't
  -- require isOnline -- an admin may reasonably hand-assign a driver who's
  -- reachable by phone but momentarily shows offline).
  if not exists (
    select 1 from public."DriverProfile" where "userId" = p_driver_id and status in ('APPROVED', 'ACTIVE')
  ) then
    raise exception 'invalid_driver' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;  -- lock first
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  -- Supersede any currently-open assignment -- mirrors reassignDriver()'s
  -- existing behavior, now atomic with everything else in this function.
  update public.delivery_assignments
  set response_status = 'superseded', superseded_at = now()
  where order_id = p_order_id and response_status in ('offered', 'accepted');

  insert into public.delivery_assignments (order_id, driver_id, assigned_by, assignment_kind, response_status)
  values (
    p_order_id, p_driver_id, auth.uid(),
    case when v_order.assigned_driver_id is null then 'assigned' else 'reassigned' end,
    'offered'
  );

  update public.orders
  set assigned_driver_id = p_driver_id, dispatch_status = 'assigned', updated_at = now()
  where id = p_order_id
  returning * into v_order;

  -- First-time assignment from 'ready' also advances the lifecycle status,
  -- exactly matching assignDriver()'s existing behavior (reuses the
  -- already-validated transition_order() rather than duplicating its
  -- logic). Reassignment (status already past 'ready') deliberately leaves
  -- status untouched, matching reassignDriver()'s existing behavior --
  -- the resulting status/acceptance drift on reassign-after-accept is a
  -- pre-existing characteristic of this system, not something this change
  -- introduces or is scoped to fix.
  if v_order.status = 'ready' then
    v_order := public.transition_order(p_order_id, 'driver_assigned');
  end if;

  return v_order;
end;
$function$;

revoke all on function public.manual_assign_driver(uuid, uuid) from public;
grant execute on function public.manual_assign_driver(uuid, uuid) to authenticated;


-- driver_accept_assignment: now handles BOTH an automatic-waterfall offer
-- (dispatch_status='searching') and a manual assignment still awaiting
-- response (dispatch_status='assigned', assignment_kind IN
-- ('assigned','reassigned')) through the same function, since that's the
-- only way to guarantee the core invariant holds for both without
-- duplicating the logic that enforces it. Previously only recognised the
-- 'searching' case, which meant a manually-assigned driver's Accept always
-- failed.
create or replace function public.driver_accept_assignment(p_assignment_id uuid)
returns public.delivery_assignments
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order_id uuid;
  v_row public.delivery_assignments;
begin
  if auth.uid() is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select order_id into v_order_id from public.delivery_assignments where id = p_assignment_id;
  if v_order_id is null then
    raise exception 'assignment_not_found_or_already_resolved' using errcode = '22023';
  end if;

  perform id from public.orders where id = v_order_id for update;  -- lock first, per convention

  -- Re-verify under the lock: this assignment must still be the order's
  -- CURRENT target -- reached via the waterfall (searching) or a manual
  -- assignment not yet responded to (assigned + kind assigned/reassigned).
  -- An old, superseded offer fails this even if its own row still looks
  -- superficially valid -- this is what makes the override invariant hold.
  if not exists (
    select 1 from public.orders o
    where o.id = v_order_id and o.assigned_driver_id = auth.uid()
      and (
        o.dispatch_status = 'searching'
        or (
          o.dispatch_status = 'assigned'
          and exists (
            select 1 from public.delivery_assignments da
            where da.id = p_assignment_id and da.assignment_kind in ('assigned', 'reassigned')
          )
        )
      )
  ) then
    raise exception 'assignment_not_found_or_already_resolved' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.delivery_assignments
    where id = p_assignment_id and driver_id = auth.uid()
      and response_status = 'offered' and (expires_at is null or expires_at > now())
  ) then
    raise exception 'assignment_not_found_or_already_resolved' using errcode = '22023';
  end if;

  -- Reuses the existing, already-validated lifecycle transition. Requires
  -- orders.status = 'driver_assigned' currently -- guaranteed by
  -- manual_assign_driver (first-time case) and auto_dispatch_tick, both of
  -- which set it before ever creating an 'offered' row.
  perform public.transition_order(v_order_id, 'driver_accepted');

  update public.delivery_assignments
  set response_status = 'accepted', responded_at = now()
  where id = p_assignment_id
  returning * into v_row;

  update public.orders set dispatch_status = 'assigned' where id = v_order_id;  -- no-op if already so

  return v_row;
end;
$function$;


-- driver_decline_assignment: a superseded row must be a successful no-op
-- (an old offer overridden by a manual assignment can never mutate the
-- order, but declining it also isn't an error -- there's just nothing left
-- to do), and a manual assignment's decline correctly hands back to the
-- automatic waterfall (dispatch_status='idle') instead of stranding the
-- order.
create or replace function public.driver_decline_assignment(p_assignment_id uuid, p_reason text default null::text)
returns public.delivery_assignments
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order_id uuid;
  v_status text;
  v_driver_id uuid;
  v_row public.delivery_assignments;
begin
  if auth.uid() is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select order_id into v_order_id from public.delivery_assignments where id = p_assignment_id;
  if v_order_id is null then
    raise exception 'assignment_not_found_or_already_resolved' using errcode = '22023';
  end if;

  perform id from public.orders where id = v_order_id for update;  -- lock first

  select response_status, driver_id into v_status, v_driver_id
  from public.delivery_assignments where id = p_assignment_id;  -- current state, under the lock

  if v_status = 'superseded' then
    -- Already overridden by a manual assignment before this decline
    -- arrived. Not an error -- the core invariant means it correctly has
    -- nothing left to do.
    select * into v_row from public.delivery_assignments where id = p_assignment_id;
    return v_row;
  end if;

  if v_status <> 'offered' or v_driver_id <> auth.uid() then
    raise exception 'assignment_not_found_or_already_resolved' using errcode = '22023';
  end if;

  update public.delivery_assignments
  set response_status = 'declined', responded_at = now(),
      decline_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_assignment_id
  returning * into v_row;

  -- Only reset the order if this decline is for its currently-active
  -- assignment. dispatch_status covers both the automatic (searching) and
  -- manual-unaccepted (assigned) cases; the existing status='driver_assigned'
  -- guard is preserved unchanged from before this migration (a driver can
  -- only ever be declining an 'offered' row, which by construction can't
  -- coexist with status already having moved to driver_accepted).
  update public.orders
  set assigned_driver_id = null, dispatch_status = 'idle',
      status = 'ready', last_status_at = now(), updated_at = now()
  where id = v_order_id and assigned_driver_id = auth.uid()
    and dispatch_status in ('searching', 'assigned')
    and status = 'driver_assigned';

  return v_row;
end;
$function$;
