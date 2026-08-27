-- =============================================================================
-- Driver reconstruction, backend fix 4 of 4: earnings are currently
-- structurally dead for shopper-native's own delivery flow. Confirmed live:
-- DriverProfile.totalDeliveries/completionRate/totalEarnings never change
-- from their defaults, and DriverEarning has zero rows ever written by
-- transition_order/mark_delivery_arrival — the Prisma migration that added
-- DriverEarning's RLS says so explicitly: "No INSERT/UPDATE policy —
-- earning rows are only ever written by trusted backend logic (a future
-- RPC/trigger tied to delivery completion...)". This is that trigger.
--
-- Verified safe to write DriverEarning from here: its `deliveryId` column
-- (apps/api/prisma/schema.prisma) has NO @relation/foreign key — it's a
-- plain uuid, so this can reference the snake_case delivery_assignments.id
-- (the row that actually exists for a native-app delivery) without needing
-- a matching row in Prisma's separate DeliveryAssignment table, which
-- nothing in this app's flow ever creates. `driverId` DOES have a real FK to
-- DriverProfile.id, resolved below via userId = orders.assigned_driver_id —
-- guaranteed to exist for any driver who could reach 'delivered' at all,
-- since (driver)/_layout.tsx already gates the whole app section on a live
-- DriverProfile with status APPROVED/ACTIVE.
--
-- Fee formula: uses orders.zone_base_fee when present (the real delivery
-- fee already resolved by resolve_delivery_zone at checkout), falling back
-- to a flat placeholder for older orders that predate that column. This is
-- deliberately simple — a real per-driver pay structure (distance/tip/
-- bonus/surge splits) is a business-policy decision outside this
-- reconstruction's scope, not a technical limitation; distance_fee/
-- tip_amount/bonus_amount are written as 0 rather than invented.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.post_driver_earning_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_profile_id uuid;
  v_assignment_id      uuid;
  v_base_fee           numeric;
  v_accepted           integer;
  v_declined           integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'delivered'
     OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.assigned_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_driver_profile_id
  FROM public."DriverProfile"
  WHERE "userId" = NEW.assigned_driver_id;

  -- Defensive only — should be unreachable given the app's own access gate.
  -- An order must still complete even if this can't be resolved.
  IF v_driver_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_assignment_id
  FROM public.delivery_assignments
  WHERE order_id = NEW.id AND driver_id = NEW.assigned_driver_id
  ORDER BY offered_at DESC
  LIMIT 1;

  v_base_fee := COALESCE(NEW.zone_base_fee, 20);

  INSERT INTO public."DriverEarning" (
    "driverId", "deliveryId", "baseFee", "distanceFee", "tipAmount", "bonusAmount", "totalAmount", "earnedAt"
  ) VALUES (
    v_driver_profile_id, COALESCE(v_assignment_id, NEW.id), v_base_fee, 0, 0, 0, v_base_fee, now()
  );

  SELECT
    count(*) FILTER (WHERE response_status = 'accepted'),
    count(*) FILTER (WHERE response_status = 'declined')
  INTO v_accepted, v_declined
  FROM public.delivery_assignments
  WHERE driver_id = NEW.assigned_driver_id;

  UPDATE public."DriverProfile"
  SET "totalDeliveries" = "totalDeliveries" + 1,
      "totalEarnings" = "totalEarnings" + v_base_fee,
      "completionRate" = CASE
        WHEN (v_accepted + v_declined) > 0 THEN round((v_accepted::numeric / (v_accepted + v_declined)) * 100, 1)
        ELSE "completionRate"
      END,
      "updatedAt" = now()
  WHERE id = v_driver_profile_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_driver_earning_on_delivery ON public.orders;
CREATE TRIGGER trg_post_driver_earning_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.post_driver_earning_on_delivery();

COMMENT ON FUNCTION public.post_driver_earning_on_delivery IS
  'Posts a real DriverEarning row and updates DriverProfile aggregates the moment an order reaches delivered with an assigned driver. Fee formula is a documented placeholder (zone_base_fee or a flat default) — a real driver pay-rate policy is a business decision, not implemented here.';
