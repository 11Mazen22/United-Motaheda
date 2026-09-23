# Complete 87-Table Provenance Matrix

Live database: `gntpxffonjvnvadjclpl` (public schema). Verified 2026-09-19 via direct `information_schema`/`pg_catalog` queries, cross-referenced against `supabase/migrations/*.sql` (exact-name grep) and `apps/api/prisma/schema.prisma` (exact model-name match).

Total: 87. Sum check: 4 (SQL-only) + 59 (Prisma-only) + 23 (both) + 1 (neither) = 87. ✓

## Category A — SQL-migration only (4)
Table has a `CREATE TABLE` in `supabase/migrations/`, no Prisma model.

| Table | Source migration |
|---|---|
| inbox_notifications | (grep: supabase/migrations, name confirmed) |
| notification_batches | same |
| notification_deliveries | same |
| notification_templates | same |

## Category B — Prisma-schema only (59)
No `CREATE TABLE` anywhere in `supabase/migrations/`. Table shape (columns/types/FKs) is defined only in `apps/api/prisma/schema.prisma`. RLS policies/triggers/functions on these tables are NOT captured by Prisma and were separately audited (see policy/trigger/function manifests).

Branch, DeliveryAssignment, DeliveryZone, DriverEarning, DriverLocation, DriverProfile, DriverSession, NotificationLog, NotificationToken, admin_audit_log, allergies, anti_fraud_events, cart_items, conditions, delivery_assignments, delivery_issues, dependents, dose_logs, drug_interactions, favorites, gift_catalog, gift_inventory, gift_redemptions, insurance_cards, integration_events, inventory, inventory_reservations, inventory_state, loyalty_accounts, loyalty_config, loyalty_ledger, loyalty_point_awards, loyalty_wallets, medication_reminders, notification_tokens, notifications, order_items, orders, pharmacies, prescriptions, product_reviews, products, profiles, referral_codes, referral_rewards, refill_requests, review_helpful_votes, reward_audit_logs, reward_campaigns, reward_idempotency_keys, reward_rules, reward_tiers, search_events, special_order_requests, special_orders, stock_movements, user_deletion_log, user_suspensions, wishlist_items

(59 names)

## Category C — Defined in BOTH systems (23) — dual-definition risk
Has both a `CREATE TABLE` in SQL migrations AND a matching Prisma model name. Not diffed column-by-column between the two definitions in this pass — flagged as a risk to check before relying on either as sole truth.

addresses, cancellations, coupon_batches, coupon_redemptions, coupons, driver_locations, notification_delivery_attempts, notification_outbox, order_notes, order_prescriptions, order_status_history, promotion_products, promotions, refunds, return_items, return_requests, return_timeline, search_sessions, search_synonyms, sms_audit_log, sms_campaign_recipients, sms_campaigns, user_devices

(23 names)

## Category D — Neither (1)
| Table | Note |
|---|---|
| _prisma_migrations | Prisma's own migration-tracking table. Tool-internal, auto-created by Prisma tooling on first `prisma migrate`/`db push` run. Not application schema. No reconstruction action needed — classified **Supabase/tool-managed**. |

## Object-level classification legend (applied throughout the rest of the manifest)
- **required**: proven used by live application code or a scheduled job
- **obsolete/orphaned**: proven NOT referenced by any current application code path
- **duplicate**: functionally redundant with a tracked object serving the same purpose
- **suspicious**: drift from tracked history with no proof of intent either way (needs a human decision)
- **supabase-managed**: platform-provisioned, not application schema, no baseline action needed
