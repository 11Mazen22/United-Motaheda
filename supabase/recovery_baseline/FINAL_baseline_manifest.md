# Final Baseline Manifest — for approval before any SQL is drafted

## FINAL REPLAY VERIFICATION (2026-09-23) — see also STAGE1_TEST_LOG.md and 87_table_provenance_matrix.md
Full disposable-project replay completed: Stage 1 → all 121 tracked migrations (120 at replay-start, +1 that landed on `main` mid-replay, `20260920085058_native_push_delivery_repair.sql`) → Stage 3, against temp Supabase project `aimqudywbzajaabkghwr`. Production (`gntpxffonjvnvadjclpl`) was read-only throughout except for the pause/restore performed during the unrelated 2026-09-19/20 production outage (see git log `cb5b9035`), which never touched schema.

Object-by-object comparison against production, final result: **exact match** — 94 tables (incl. 1 view double-counted by `information_schema.tables`), 381 functions, 180 policies, 20 triggers, 7 views (incl. `loyalty_user_history`, deliberately excluded from the reconstructed copy per §I below — the only intentional divergence).

**CRITICAL bug found and fixed by the smoke tests**: `build_baseline_v2.cjs`'s `extractTable()` captured each table's `CREATE TABLE` body and its `CREATE POLICY` statements, but silently dropped the table-level `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` line pg_dump emits separately. Result: ~51 tables (everything sourced from the live dump rather than a tracked migration) had fully correct policies defined but RLS never actually enabled — every policy was silently unevaluated, meaning `anon`/`authenticated`'s blanket table grants (Supabase's default) gave full read/write access to every row. **Verified this is NOT a live production issue** — `pg_class.relrowsecurity` confirmed `true` on every single `public` table in production; the gap was entirely in the reconstruction. Fixed by adding the missing `ENABLE ROW LEVEL SECURITY` statements to both `02_stage1_pre_history.sql` and `03_stage3_post_history.sql` (51 tables total), re-verified against the temp project: 0 tables with RLS disabled, matching production exactly. This is exactly the kind of gap the smoke-test phase exists to catch — a syntactically successful replay that would have been a real security hole if ever used for actual recovery.

Other real gaps found and fixed by this final pass, beyond everything already resolved below:
- **`coupon_batches` schema drift**: production's real table has 12 columns/constraints/FK/indexes beyond what any tracked migration creates — reconciled verbatim from `public_schema_live_dump.sql` into `03_stage3_post_history.sql` (table confirmed empty throughout replay, so no data-loss risk, but this table's true structure exists nowhere in git history and deserves a real migration at some point).
- **2 superseded function overloads missed by `build_baseline_v2.cjs`'s extraction**: `admin_save_promotion(..., p_product_ids text[])` (9-arg) and `validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[])` — both still live in production, never dropped by any migration, added to `03_stage3_post_history.sql`.
- **8 duplicate triggers + 29 duplicate policies**: were already created by tracked migrations but also re-declared in the original `03_stage3_post_history.sql` draft; removed from that file (kept in the migration, since that's the real owner).
- **4 tables + 1 constraint** already found to need Stage-1 (pre-history) placement during an earlier pass, **plus 5 more found in this final pass**: `search_events`, `delivery_issues`, `NotificationLog`, `NotificationToken`, `_prisma_migrations`, `loyalty_accounts` + its 8 internal helper functions, `reward_idempotency_keys`, `reward_tiers`, `DriverEarning`, `create_checkout_order` — each moved to `02_stage1_pre_history.sql` with an evidence comment citing the exact migration or error that proved the dependency.

## Reconciliation note (function count)
Full accounting of all 139 live functions: **50 byte-identical + 24 cosmetic-drift-only + 6 script-false-positives-confirmed-tracked = 80 substantively identical**, + **57 genuinely missing** + **2 confirmed-unused ghost overloads** = 80+57+2 = **139. Exact.**
The 6th false positive (previously undercounted as 5) is `admin_save_promotion`'s 10-arg (`uuid[]`, `text`) overload — migration writes `timestamptz`, pg_dump renders `timestamp with time zone` for the same parameter; body verified identical directly against the migration source.

## Reconciliation note (replay conflicts)
"4 replay conflicts" = **4 affected tables**, not 4 objects. The actual object count needing exclusion from the baseline's initial `CREATE TABLE` is **8**: `orders` (3 columns + 1 constraint), `delivery_assignments` (1 column), `DriverProfile` (1 constraint), `products` (2 constraints). Full detail in §C below.

Immutable source: `public_schema_live_dump.sql`, SHA-256 `56934c26cd0b8a90033588ad2982673611bb929411d66aca5e99e8c37567497a` (full, unabridged, stored in its own `.sha256` file).
Production: read-only throughout. Nothing written to `supabase/migrations/`.

## A. Functions — 57 to include (confirmed zero migration presence, every normalization artifact ruled out)

_inventory_ensure_state, _inventory_lock, _loyalty_audit, _loyalty_ensure_account, _loyalty_idempotency_begin, _loyalty_idempotency_end, _loyalty_lock, _loyalty_lock_idem, _loyalty_recompute_tier, admin_get_last_sign_in, admin_profile_status_counts, apply_campaign_bonus, apply_coupon_checkout, apply_updated_at, broadcast_notification, commit_inventory, create_checkout_order, create_referral_reward, current_app_role, earn_loyalty_points, expire_stale_reservations, extend_reservation, fn_award_loyalty_points_on_payment_verified, fn_sync_product_stock, fold_search, get_catalog_light, get_category_counts, get_featured_products, get_loyalty_balance, get_related_products, get_trending_products, handle_new_user, has_permission, insert_staff_notification, inventory_state_touch, is_admin, is_driver, is_manager, log_search_event, loyalty_accounts_touch, notification_unread_count, process_cashback_reward, products_search_vector_update, redeem_points_for_coupon, redeem_points_for_gift, release_gift_inventory, reserve_inventory, reverse_reward_transaction, rollback_committed_reservation, search_products, search_products_fuzzy, set_updated_at, sync_profile_phone_from_auth, sync_review_helpful_count, touch_review_updated_at, update_modified_column, validate_inventory

**Final confirmed count: 57 functions.** Five names that transiently showed as "no match" during script iteration — `get_return_eligibility`, `search_products_semantic`, `set_product_embedding`, `admin_detect_promotion_conflicts`, `transition_return_status` — were each individually verified (body-level, against their migration source) to be genuinely tracked. They are excluded from this list; not part of the gap.

## B. Functions — explicitly EXCLUDED (proven unused, not preserved)
- `admin_save_promotion(uuid,text,text,text,numeric,timestamptz,timestamptz,boolean,text[])` — 9-arg, text[]-ending overload. No caller anywhere in the app; the only caller (`promotionsApi.ts`) uses the tracked 10-arg `uuid[]`+`text` version.
- `validate_coupon(text,integer,text[])` — 3-arg overload not present in any migration. (Not yet code-searched for usage — recommend the same proof-of-use standard before any future inclusion; excluded by default per your instruction to not preserve drift without proof.)

## C. Tables — 59 to include (Prisma-only, full DDL from pg_dump, NOT from schema.prisma)
Branch, DeliveryAssignment, DeliveryZone, DriverEarning, DriverLocation, DriverProfile, DriverSession, NotificationLog, NotificationToken, admin_audit_log, allergies, anti_fraud_events, cart_items, conditions, delivery_assignments, delivery_issues, dependents, dose_logs, drug_interactions, favorites, gift_catalog, gift_inventory, gift_redemptions, insurance_cards, integration_events, inventory, inventory_reservations, inventory_state, loyalty_accounts, loyalty_config, loyalty_ledger, loyalty_point_awards, loyalty_wallets, medication_reminders, notification_tokens, notifications, order_items, orders, pharmacies, prescriptions, product_reviews, products, profiles, referral_codes, referral_rewards, refill_requests, review_helpful_votes, reward_audit_logs, reward_campaigns, reward_idempotency_keys, reward_rules, reward_tiers, search_events, special_order_requests, special_orders, stock_movements, user_deletion_log, user_suspensions, wishlist_items

### Required exclusions from initial CREATE TABLE (must stay owned by their real migration)
| Table | Excluded from baseline | Legitimate origin migration |
|---|---|---|
| orders | `dispatch_status`, `claimed_by_pharmacist_id`, `claimed_at` columns; `orders_dispatch_status_driver_invariant` constraint | `20260905010000_auto_dispatch_schema.sql` |
| delivery_assignments | `expires_at` column | `20260905010000_auto_dispatch_schema.sql` |
| products | `products_price_non_negative`, `products_stock_non_negative` CHECK constraints | `20260904140000_products_constraints_and_delete_scope.sql` |

**CORRECTION (found during batch replay verification):** `DriverProfile_userId_key` UNIQUE constraint was moved back INTO the baseline (02_stage1_pre_history.sql), not excluded. `apps/api/prisma/schema.prisma` declares `userId String @unique` on DriverProfile -- part of the table's real original shape -- and the earlier tracked migration `20260828150000_backfill_missing_driver_profile.sql` already requires it via `ON CONFLICT ("userId")`. This table's exclusions table originally attributed the constraint to `20260902150000_ensure_driver_profile_on_role_change.sql` based on a literal "ADD CONSTRAINT" text match, which doesn't catch an ON CONFLICT-implied dependency in an earlier file. Consequence: `20260902150000`'s own `ADD CONSTRAINT` now needs the constraint dropped immediately beforehand as a one-off compensating step when replayed (not a migration-file edit).

(`delivery_assignments_response_status_check` is safe to include as-is — its migration does DROP-then-ADD under the same name, which works regardless of baseline content.)

Full sweep performed across all 87 tables × all 120 migrations for `ADD COLUMN`/`ADD CONSTRAINT`/`DROP COLUMN`/`RENAME`/`CREATE INDEX`/`GRANT`/dynamic SQL/`DO` blocks — these 5 exclusions are the complete set. Zero `DO` blocks exist in the repo at all.

## D. Triggers — 19 to include
driver_profile_sync_role_trg, addresses_updated_at, trg_addresses_updated_at, trg_supersede_prior_delivery_assignments, inventory_state_touch_trg, trg_sync_product_stock, loyalty_accounts_touch_trg, trg_award_loyalty_on_payment_verified, trg_post_driver_earning_on_delivery, trigger_log_order_status_change, prescriptions_updated_at, product_reviews_touch_updated, products_search_vector_trg, trg_products_invalidate_embedding, profiles_ensure_driver_profile_trg, profiles_guard_role_status_trg, review_helpful_votes_sync_count, trg_search_synonyms_updated_at, set_updated_at (on special_orders)

Plus 2 auth-schema triggers (§F).

## E. Policies — 143 to include
Full list saved in `object_classification_and_findings.md` and `live_policies.txt`. Ordering requirement proven via `pg_depend`: `is_manager`/`is_admin`/`has_permission` alone gate dozens of these — functions in §A must be created before any policy in this set.

## F. Auth pipeline — 2 triggers + 2 functions, highest priority
`on_auth_user_created` → `handle_new_user()`; `on_auth_user_phone_updated` → `sync_profile_phone_from_auth()`. Entire signup/profile-bootstrap path. Zero migration presence. Required — not optional.

## G. Extensions — 3 to include
`pgcrypto`, `uuid-ossp`, `btree_gin` as `CREATE EXTENSION IF NOT EXISTS`. (`plpgsql`, `pg_stat_statements`, `supabase_vault` are Supabase-default — no action.)

## H. Storage — resolved

**Bucket config**: baseline reproduces exact verified live values only, no new restrictions — `driver-documents` (file_size_limit=5242880, mime_types=[image/jpeg,image/png,image/jpg]) and `receipts` (file_size_limit=5242880, mime_types=[image/jpeg,image/png,image/webp,image/heic]) get their live config added via `UPDATE storage.buckets`, matching production exactly.

**`receipts` bucket `public=true`**: reproduced in the baseline, labeled explicitly as **COMPATIBILITY STATE, NOT approved security design** (see `receipts_security_followup.md` — a separate, later, non-baseline change).

**Receipts policies — smallest non-duplicated set** (full matrix above): baseline adds exactly **one** new policy, `receipts public read`. `receipts authenticated insert` and `receipts authenticated read own` are byte-identical duplicates of already-tracked policies and are excluded as redundant drift.

## I. Views — resolved
- `available_inventory`, `product_review_stats` — proven used in app code. Include.
- `loyalty_user_history` — **excluded from the executable baseline** (unused, linked only to orphaned legacy material). Its definition remains preserved, untouched, in the immutable `public_schema_live_dump.sql`, and is recorded here in the exclusion record for traceability.

## J. Cron jobs, grants, roles — no baseline action
All 3 cron jobs fully tracked (including the hardcoded impersonation UUID, itself tracked). Grants and roles are 100% Supabase-platform-managed (`pg_default_acl` confirmed) — zero custom entries.

## K. Dual-defined tables (23) — no baseline action, one corroborating finding
Column-diffed all 23 against their Prisma models. 22 clean (diffs were only Prisma's own relation-accessor fields, not real columns). `user_devices` confirmed Prisma-schema is stale (declares `token`/`provider`/`device_model`/`os_version`; live has `push_token`, none of the others) — but the SQL migration is accurate and already covers it, so zero baseline action; this is corroborating evidence, not a new gap.

## L. Legacy orphaned directory — flagged, out of scope
`apps/shopper-native/supabase/migrations/` — dead, unreferenced by any config. Not part of this recovery task; candidate for a separate cleanup.

---

## Decisions needed before SQL drafting
1. `loyalty_user_history` view — include or omit?
2. Which receipts storage policies are authoritative — tracked or untracked set?
3. OK to add the missing `file_size_limit`/`allowed_mime_types` for `driver-documents`/`receipts` buckets as a small follow-up (not blocking baseline)?
4. Confirm: baseline dated earlier than `20260705120000` (the current first migration), placed in a **non-active** directory, not `supabase/migrations/`, per your standing instruction.

Once you weigh in on 1–3, I'll draft the baseline SQL (still in the non-active directory) for your review — no execution against anything, disposable-database verification happens only after that draft exists and only with your go-ahead given it likely requires a paid Supabase branch or the local Postgres binaries already downloaded.
