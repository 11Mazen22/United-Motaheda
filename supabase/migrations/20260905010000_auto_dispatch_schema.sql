-- Automated driver dispatch: schema + backfill.
-- See the approved design plan (session 2026-09-05) for the full state
-- machine and the reasoning behind every choice here. Summary:
--   dispatch_status tracks the WATERFALL (idle/searching/assigned/escalated),
--   separate from and layered on top of the pre-existing orders.status
--   delivery lifecycle (ready -> driver_assigned -> driver_accepted -> ...),
--   which transition_order() continues to own unchanged.

-- Step 1: plain columns first, no cross-column reference yet -- every
-- existing row trivially satisfies a same-column-only CHECK via the DEFAULT.
alter table public.orders
  add column dispatch_status text not null default 'idle'
    check (dispatch_status in ('idle','searching','assigned','escalated')),
  add column claimed_by_pharmacist_id uuid references public.profiles(id),
  add column claimed_at timestamptz;

alter table public.delivery_assignments add column expires_at timestamptz;

alter table public.delivery_assignments drop constraint delivery_assignments_response_status_check;
alter table public.delivery_assignments add constraint delivery_assignments_response_status_check
  check (response_status = any (array['offered','accepted','declined','superseded','completed','expired']));

-- Step 2: backfill, now that the plain columns exist on every row.
update public.orders set dispatch_status = 'assigned' where assigned_driver_id is not null;
update public.orders set dispatch_status = 'idle'     where assigned_driver_id is null and status = 'ready';

-- Step 3: ONLY NOW add the cross-column invariant -- every row already
-- satisfies it by construction, so this validates cleanly.
alter table public.orders add constraint orders_dispatch_status_driver_invariant check (
  (dispatch_status in ('searching','assigned') and assigned_driver_id is not null) or
  (dispatch_status in ('idle','escalated')     and assigned_driver_id is null)
);

comment on column public.orders.dispatch_status is
  'Automatic-dispatch state machine, layered on top of (not replacing) the
   orders.status delivery lifecycle. assigned_driver_id is the current offer
   OR acceptance target (manual or automatic) -- this column disambiguates
   which. searching->escalated is IMPOSSIBLE (invariant above requires
   assigned_driver_id set while searching); the real no-candidates
   transition is idle->escalated. Every writer of this column must lock the
   order row (SELECT ... FOR UPDATE) before touching delivery_assignments
   for it -- see manual_assign_driver / driver_accept_assignment /
   driver_decline_assignment / auto_dispatch_tick.';

comment on column public.delivery_assignments.expires_at is
  'Only set on auto-dispatch-created offers (25s waterfall window). Null for
   manually-assigned rows, which have no automatic timeout.';
