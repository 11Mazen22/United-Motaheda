# Object Classification & Security/Dependency Findings

All checks read-only against production (`gntpxffonjvnvadjclpl`). No writes. Verified 2026-09-19.

## 1. Security scan of the raw pg_dump snapshot

File: `public_schema_live_dump.sql` (621,145 bytes)
**SHA-256: `56934c26cd0b8a90033588ad2982673611bb929411d66aca5e99e8c37567497a`**

Scanned for: http(s) URLs, JWT-shaped tokens (`eyJ...`), password/secret/api_key/bearer mentions, email addresses.

Result: **clean**. Zero URLs, zero tokens, zero emails. All ~40 "service_role" hits are legitimate schema content (`GRANT ... TO service_role`, `auth.jwt()->>'role' = 'service_role'` in RLS policies) — the Postgres role name, not a credential value.

Separately (not in this dump, found via live query): `cron.job` commands for jobs 6/7 embed a hardcoded real user UUID (`df4c117e-38af-44a3-a227-77c883b74c10`) as an impersonated JWT `sub` claim for scheduled-job RLS context. This is **tracked in git** (confirmed present in `20260904160000_schedule_expire_stale_reservations.sql` and `20260905012000_auto_dispatch_tick.sql`, matching production exactly) — not a drift, but flagged since it's a real account identifier baked into scheduled SQL, worth the team's awareness.

Dump kept immutable at its current path; any recovery SQL derived from it will be written to a **separate file**, never edited in place.

## 2. Grants — fully Supabase-managed, zero gap

`pg_default_acl` confirmed: `postgres` and `supabase_admin` have `ALTER DEFAULT PRIVILEGES` set on the `public` schema granting full table/function/sequence access to `anon`, `authenticated`, `service_role` automatically for anything they create. Every one of the 87 tables shows this identical grant pattern — this is Supabase's own platform bootstrap, not something migrations need to (or do) declare. **Classification: supabase-managed. No baseline action.**

## 3. Roles — fully Supabase-managed, zero gap

All 16 live roles (`anon`, `authenticated`, `authenticator`, `dashboard_user`, `postgres`, `service_role`, `supabase_admin`, `supabase_auth_admin`, `supabase_etl_admin`, `supabase_functions_admin`, `supabase_privileged_role`, `supabase_read_only_user`, `supabase_realtime_admin`, `supabase_replication_admin`, `supabase_storage_admin`, plus `cli_login_postgres`) are stock Supabase-provisioned roles. Zero custom roles found. **Classification: supabase-managed. No baseline action.**

## 4. Views (7 live)

| View | Migration coverage | Code usage found | Classification |
|---|---|---|---|
| product_effective_prices | 2 migrations | — | tracked, no action |
| search_analytics_daily_summary | 1 migration | — | tracked, no action |
| search_analytics_top_queries | 1 migration | — | tracked, no action |
| search_analytics_zero_result_queries | 1 migration | — | tracked, no action |
| available_inventory | **0 migrations** | `apps/shopper-native/src/features/inventory/api/inventoryApi.ts`, `.../types/index.ts` | **required** — must be in baseline |
| product_review_stats | **0 migrations** | `apps/shopper-web/src/lib/reviewsApi.ts` | **required** — must be in baseline |
| loyalty_user_history | **0 migrations** | none found in `apps/*/src` (only self-referenced inside the orphaned legacy `apps/shopper-native/supabase/migrations/20260523_loyalty_schema.sql`, which is itself dead — see §8) | **suspicious/likely orphaned** — no proof of current use, needs a human decision before inclusion |

## 5. Extensions (12 installed)

| Extension | Migration coverage | Classification |
|---|---|---|
| unaccent, pg_trgm, vector, moddatetime, pg_net, pg_cron | tracked | no action |
| pgcrypto, uuid-ossp, btree_gin | 0 migrations | **required** — in active use (pgcrypto backs `gen_random_uuid()` used throughout; uuid-ossp/btree_gin used by indexes/defaults in the live schema) — must be declared `CREATE EXTENSION IF NOT EXISTS` in baseline |
| plpgsql, pg_stat_statements, supabase_vault | 0 migrations | **supabase-managed** — installed by default on every Supabase project, not an app dependency to declare |

## 6. Storage buckets (5 live)

| Bucket | Creation tracked? | Config drift | Classification |
|---|---|---|---|
| avatars | yes (`20260902165000`) | public=true matches live | tracked, no action |
| prescriptions | yes (`20260817100000`) | file_size_limit/mime_types set by `20260830150000`, matches live exactly | tracked, no action |
| driver-documents | yes (`20260827183000`) | **file_size_limit (5MB) + allowed_mime_types live-only**, no migration sets them | **suspicious** — bucket tracked, but its size/type restriction was added directly in production |
| delivery-issue-photos | yes (`20260827010000`) | live config (no limit/mime types set) matches migration | tracked, no action |
| receipts | yes (`20260827183000`, created with `public=false`) | **live is `public=true` — confirmed drift**; file_size_limit/mime_types also live-only | **suspicious** — a private→public bucket flip with no migration record is a real thing to get a human answer on, not something to silently re-encode as "always public" |

## 7. Storage policies on `storage.objects` (23 live)

20 of 23 match by exact name to a migration. 3 do not: `receipts authenticated insert`, `receipts authenticated read own`, `receipts public read`.

Code check: `apps/shopper-native/src/features/payment/constants.ts`, `receiptUpload.ts`, `apps/shopper-native/src/stores/checkout.ts`, and `apps/shopper-web/src/services/webPaymentApi.ts` confirm the receipts bucket **is actively used** for payment-proof uploads. The migration-tracked policy `"customers upload own receipts"` (from `20260827183000`) and the untracked `"receipts authenticated insert"` appear to serve the **same purpose** (customer uploads their own receipt).

**Classification: duplicate.** Both likely exist live simultaneously; the untracked set was probably added when the bucket was flipped to public (§6) and the old tracked policies were never cleaned up. Needs a human decision on which is the intended, current one before the baseline encodes either.

## 8. Legacy orphaned migrations directory — new finding, not previously known

`apps/shopper-native/supabase/migrations/` contains 4+ files with an old non-standard timestamp format (`20260523_loyalty_schema.sql`, `20260525_inventory_schema.sql`, `20260529_products_fix.sql`, `20260535_manual_payment_apply.sql`), distinct from the real, active `supabase/migrations/` at repo root (14-digit timestamp convention, confirmed as the one `supabase/config.toml` and the CLI actually use).

Confirmed via search: no `.toml`/CI/build config anywhere in the repo references this nested folder. It is not applied by the Supabase CLI, not part of any deploy step. **Classification: obsolete/orphaned — dead code, not a reconstruction source, not a conflict risk for the baseline** (since nothing replays it). Worth deleting in a later cleanup pass, out of scope for this recovery task.

## 9. `admin_save_promotion` overload drift — resolved

Live has two overloads:
- 10-arg, ending `uuid[], text` — created by `20260716130000_promotions_catalog_workspace.sql`, matches git exactly.
- 9-arg, ending `text[]` — **appears in no migration under any signature** (the only 9-arg version ever tracked ended in `uuid[]` and was explicitly `DROP FUNCTION`'d by `20260716110000`).

Code check: `apps/shopper-web/src/services/promotionsApi.ts` is the only caller in the entire app. It calls with `p_product_ids: [...new Set(input.productIds)]` — a product-ID array, matching the **10-arg, tracked, `uuid[]` overload**.

**Classification: obsolete/orphaned.** No code path calls the 9-arg `text[]` version. Per instruction, it will **not** be preserved in the baseline merely because it exists live — it's dead drift, most likely a leftover from manual Studio experimentation during the promotions feature's development.

## 10. Auth pipeline — confirmed required, fully untracked

`on_auth_user_created` (`AFTER INSERT ON auth.users` → `handle_new_user()`) and `on_auth_user_phone_updated` (`AFTER UPDATE OF phone, phone_confirmed_at ON auth.users` → `sync_profile_phone_from_auth()`). Zero migration coverage for either trigger or either function. This is the entire signup/profile-bootstrap pipeline — self-evidently required (every user signup depends on it structurally; not something that needs a code-search to "prove" usage, its criticality is architectural). **Classification: required — highest-priority baseline inclusion.**

## 11. Cron jobs — fully tracked, no gap

All 3 jobs (`expire-stale-reservations`, `auto-dispatch-tick`, `generate-embeddings-tick`) have their scheduling and current command text traceable through migration history, including the hardcoded impersonation UUID (§1) and this session's own URL fix for job 8. **Classification: tracked, no baseline action.**

## Summary of items requiring your decision before baseline construction
1. `loyalty_user_history` view — include or drop? (no proof of use found)
2. `driver-documents` and `receipts` bucket config drift — was the receipts bucket's public flip intentional?
3. Which receipts storage-policy set is authoritative — the tracked or untracked one?
4. The 23 dual-defined tables (SQL + Prisma) — not yet diffed column-by-column against each other; recommend as the next check before final baseline sign-off.
