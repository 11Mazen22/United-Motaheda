-- Two more evidence-based performance fixes from the advisor, both purely
-- additive/subtractive with no behavior change:
--
-- 1. orders had 3 exact-duplicate index pairs (confirmed via pg_indexes --
--    identical column lists/predicates under different names), so every
--    order insert/update was maintaining 3 redundant indexes for zero
--    query benefit. orders is the highest-churn table in the app (every
--    checkout, status transition, cancellation, driver action writes to
--    it), so this write-path overhead was real. Dropping the redundant
--    half of each pair; confirmed neither duplicate backs a formal
--    pg_constraint (both are plain indexes), so nothing else references
--    them by name.
CREATE INDEX IF NOT EXISTS orders_status_created_at_idx ON public.orders (status, created_at DESC);
DROP INDEX IF EXISTS public.orders_status_created_idx;
DROP INDEX IF EXISTS public.orders_user_idx;
DROP INDEX IF EXISTS public.orders_user_idempotency_key_idx;

-- 2. 5 foreign keys had no covering index, forcing a sequential scan of
--    the referencing table on every cascade/lookup through that FK --
--    notification_delivery_attempts and notification_outbox are read on
--    every notification-worker poll cycle; orders.cancelled_by and
--    orders.claimed_by_pharmacist_id are read on every admin/pharmacist
--    order-detail view and cancellation-history query.
CREATE INDEX IF NOT EXISTS notification_delivery_attempts_outbox_id_idx ON public.notification_delivery_attempts (outbox_id);
CREATE INDEX IF NOT EXISTS notification_delivery_attempts_token_id_idx ON public.notification_delivery_attempts (token_id);
CREATE INDEX IF NOT EXISTS notification_outbox_recipient_id_idx ON public.notification_outbox (recipient_id);
CREATE INDEX IF NOT EXISTS orders_cancelled_by_idx ON public.orders (cancelled_by);
CREATE INDEX IF NOT EXISTS orders_claimed_by_pharmacist_id_idx ON public.orders (claimed_by_pharmacist_id);
