-- Migration: fix driver/notification indexing gaps - 2026-07-07
--
-- Found during a production-readiness performance audit.
--
-- 1. database/performance_indexes.sql defines an index on a column named
--    `driver_id`, but no table in this app has ever had a column by that
--    name — every real query (apps/shopper-web/src/services/logisticsApi.ts:
--    assignDriver, listDriverManifest) filters on `assigned_driver_id`. That
--    index has therefore never applied to a real query. Rather than edit the
--    ambiguous legacy index files (three overlapping versions exist and it's
--    unclear from the repo alone which, if any, was actually applied to the
--    live DB), this adds the correct index directly, idempotently.
--
-- 2. public.notifications has no CREATE TABLE in this repo (created ad-hoc
--    via the Supabase dashboard, like orders/prescriptions originally were),
--    so its indexes can't be audited from source. Every notifications read
--    (native app inbox, web Profile page, admin live feed) filters by
--    user_id and/or is_read — add a defensive covering index; safe no-op if
--    an equivalent index already exists.

create index if not exists orders_assigned_driver_status_idx
  on public.orders (assigned_driver_id, status);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

-- ─── Done ─────────────────────────────────────────────────────────────────────
