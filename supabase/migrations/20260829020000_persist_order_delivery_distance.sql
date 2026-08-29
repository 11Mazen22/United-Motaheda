-- resolve_delivery_zone() already computes distance_km (used transiently
-- for the checkout preview), but create-order never wrote it onto the
-- order row -- the branch/zone/fee snapshot was persisted, but the
-- distance that helped decide it wasn't. Add the column so completed
-- orders keep a full fulfillment snapshot, not a partial one.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_distance_km numeric;

COMMENT ON COLUMN public.orders.delivery_distance_km IS
  'Straight-line (haversine) distance in km from the customer''s delivery coordinates to the fulfilling branch, as resolved by resolve_delivery_zone() at order-creation time. Part of the order''s immutable fulfillment snapshot -- never recalculated after creation.';
