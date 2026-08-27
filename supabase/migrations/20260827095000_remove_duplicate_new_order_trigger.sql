-- Removes the trg_notify_staff_new_order trigger added in
-- 20260827090000_pharmacist_backend_fixes.sql.
--
-- That trigger was added on the mistaken premise (from a migrations-only
-- audit) that nothing notified staff of new orders. In fact
-- supabase/functions/create-order/index.ts's enqueueStaffOrderNotification()
-- already does this reliably as part of order creation itself (not a
-- separate fire-and-forget call — it runs inline in the same request that
-- inserts the order, with its own notifications + notification_outbox
-- writes). The audit's migrations-only search simply never saw the edge
-- function source. Leaving both meant every new order fired two staff
-- notifications with different wording and different idempotency keys.

DROP TRIGGER IF EXISTS trg_notify_staff_new_order ON public.orders;
DROP FUNCTION IF EXISTS public.notify_staff_new_order();
