-- =============================================================================
-- Driver reconstruction, backend fix 1 of 4: close a real data-integrity gap
-- found while auditing the driver system.
--
-- Problem: delivery_assignments has no unique constraint on order_id, and
-- assignDriver() (apps/shopper-web/src/services/logisticsApi.ts) — used for a
-- FIRST assignment — inserts a new 'offered' row with no check for, and no
-- superseding of, any pre-existing open row on that order. Only
-- reassignDriver() (the *re*-assignment path) superseded prior rows. If a
-- first assignment is ever made twice for the same order (retried request,
-- two staff racing), the earlier driver is left with a permanently dangling,
-- un-actionable "offer" in their app — nothing ever marks it superseded,
-- since orders.assigned_driver_id (a single pointer) can only ever agree
-- with one of the two rows.
--
-- Fix, at the table level so it protects EVERY caller (not just one app's
-- code path): a BEFORE INSERT trigger that supersedes any other still-open
-- ('offered' or 'accepted') row for the same order_id whenever a new row is
-- inserted. This makes "at most one open assignment per order" a real
-- invariant instead of an app-level convention, and makes reassignDriver()'s
-- own manual superseding step redundant (harmless — it'll just find nothing
-- left to supersede).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.supersede_prior_delivery_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.delivery_assignments
  SET response_status = 'superseded',
      superseded_at = now()
  WHERE order_id = NEW.order_id
    AND id <> NEW.id
    AND response_status IN ('offered', 'accepted');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supersede_prior_delivery_assignments ON public.delivery_assignments;
CREATE TRIGGER trg_supersede_prior_delivery_assignments
  AFTER INSERT ON public.delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION public.supersede_prior_delivery_assignments();

COMMENT ON FUNCTION public.supersede_prior_delivery_assignments IS
  'Guarantees at most one open (offered/accepted) delivery_assignments row per order_id, regardless of which caller inserted it. Fixes a dangling-offer bug where a first-time assignDriver() call never superseded a pre-existing row the way reassignDriver() did.';

-- =============================================================================
-- Backend fix 2 of 4: driver decline is currently two separate, unprotected
-- writes from the client — declineAssignment() in shopper-native's api.ts
-- updates delivery_assignments (works, RLS-scoped to driver_id = auth.uid()),
-- then best-effort tries to clear orders.assigned_driver_id directly. No
-- tracked migration grants the driver role (or anyone) an UPDATE policy on
-- orders, so that second write is written defensively assuming it might
-- silently fail under RLS — meaning a declined order plausibly keeps
-- pointing at the declining driver in production today.
--
-- Fix: a single SECURITY DEFINER RPC that does both writes atomically,
-- exactly analogous to transition_order's pattern — the driver never needs
-- a direct UPDATE grant on orders at all, matching how every other driver
-- state change already goes through a function rather than raw table
-- writes for anything that touches orders.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.driver_decline_assignment(
  p_assignment_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.delivery_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.delivery_assignments;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  UPDATE public.delivery_assignments
  SET response_status = 'declined',
      responded_at = now(),
      decline_reason = NULLIF(trim(coalesce(p_reason, '')), '')
  WHERE id = p_assignment_id
    AND driver_id = auth.uid()
    AND response_status = 'offered'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found_or_already_resolved' USING ERRCODE = '22023';
  END IF;

  -- Best-effort by design, same as before: if the order was already
  -- reassigned/changed by staff in the meantime, leave it alone — the
  -- decline itself is already durably recorded above regardless.
  UPDATE public.orders
  SET assigned_driver_id = NULL,
      updated_at = now()
  WHERE id = v_row.order_id
    AND assigned_driver_id = auth.uid();

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_decline_assignment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_decline_assignment(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.driver_decline_assignment IS
  'Atomically declines an offered assignment and clears orders.assigned_driver_id, as one SECURITY DEFINER call — replaces two separate client-side writes, the second of which had no confirmed RLS grant to succeed on.';
