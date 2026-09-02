-- create-order/index.ts explicitly comments that it "relies on the
-- DB-level unique index on (user_id, idempotency_key)" and catches 23505
-- to replay an existing order instead of creating a duplicate. That index
-- was never actually applied live (confirmed: only orders_pkey and
-- orders_external_ref_key are unique on this table) -- the 23505-catch
-- had nothing to catch, so two concurrent identical checkout submissions
-- could each pass the racy pre-check SELECT and insert separate order
-- rows. Confirmed zero existing duplicate (user_id, idempotency_key)
-- pairs before adding this, so safe to add directly.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_idempotency_key
  ON public.orders (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Same gap, same fix: reserve_inventory()'s idempotency check
-- ("select * from inventory_reservations where idempotency_key = ...")
-- is an unlocked SELECT with no unique constraint behind it -- two
-- concurrent calls with the same key can each pass the check and insert
-- two reservation rows. Global (not per-user) to match how the function
-- itself queries it, with no user_id scoping. Confirmed zero existing
-- duplicates before adding.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_reservations_idempotency_key
  ON public.inventory_reservations (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
