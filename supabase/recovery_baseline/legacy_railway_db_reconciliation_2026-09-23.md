# Legacy self-hosted Railway DB — reconciliation & archival record

**Date:** 2026-09-23
**Source:** self-hosted Supabase stack, Railway project `efficient-communication`, service `Postgres` (public proxy `altaria.proxy.rlwy.net:40973`), Postgres 17.6, instance running since 2026-08-29.
**Method:** read-only comparison (`SET default_transaction_read_only = on`, SELECT-only) of every row in `orders`, `auth.users`, and `profiles` on the self-hosted instance against Supabase Cloud (project `gntpxffonjvnvadjclpl`), matched first by UUID, then by email/user_id/amount/timestamp for anything unmatched. Nothing was written, merged, or deleted on either database as part of this investigation.
**Companion data file:** [legacy_railway_db_archive_2026-09-23.json](./legacy_railway_db_archive_2026-09-23.json) — full raw rows for every order/user/profile pulled from the self-hosted instance, with each row's match status against Cloud.

## Summary

- **17 orders** on self-hosted. **14/17 already exist on Supabase Cloud** with matching UUID, status, total, and timestamps. **3/17 exist only on self-hosted** (see below).
- **25 `auth.users`** on self-hosted. **All 25 emails exist on Cloud.** 23/25 share the identical `auth.users.id` between systems (true preserved identity). **2/25 have a different UUID on Cloud than on self-hosted** — an orphaned self-hosted identity (see below).
- **22 `profiles`** on self-hosted, consistent with the 25 users above (3 users have no profile row on self-hosted).

## Orders that exist ONLY on self-hosted

| Order ID | Customer email | Amount (EGP) | Status | Created | Assessment |
|---|---|---|---|---|---|
| `71a3634e-6f3b-430b-9bfc-4cf83cb79be9` | shazlymazen802@gmail.com | 510.00 | driver_accepted | 2026-09-04T11:51:03Z | No Cloud order for this user at this time/amount. Real-looking. |
| `e0d7c2de-5e90-4884-8345-580f3d6e1a2a` | shazlymazen802@gmail.com | 76.00 | out_for_delivery | 2026-09-04T19:18:43Z | `customer_name: "Test Customer"`, generic sequential phone `01012345678` — almost certainly synthetic/test data. |
| `cc121a50-ff7a-4cfb-b0bb-966c7a3b7aab` | m.youssuf.1995@gmail.com | 295.00 | pending | 2026-09-14T11:19:21Z | **Last order ever written to self-hosted.** Real account (created 9 days earlier). Zero orders for this user_id on Cloud. Flagged as the one item worth a manual look before retiring the stack — a real customer may be waiting on this order. |

## Identities that exist ONLY as a separate account on self-hosted

| Email | Self-hosted `auth.users.id` | Self-hosted role | Cloud `auth.users.id` (different) | Cloud role | Orders tied to self-hosted ID |
|---|---|---|---|---|---|
| mazenshazly011@gmail.com | `17affa00-ee20-4f2e-bde9-5fa3ac76ecec` | driver | `5042aa1c-390b-40e3-a56b-edac1a5e76f6` | pharmacist | none |
| mazenshazly890@gmail.com | `117cd269-1658-4de6-8b9a-aca137567da6` | pharmacist | `ac0aa357-9568-4fd1-b00d-479e9f900e72` | customer | none |

These two people signed up independently on each system (same email, unrelated `auth.users.id`), so their self-hosted staff-role assignment has no equivalent on their current Cloud account. No orders are attached to either self-hosted identity, so this is a dangling role/identity record only, not an order-data gap.

## Conclusion

The self-hosted stack contains a small, bounded set of legitimate data absent from Cloud — 3 orphaned orders (2 plausibly real, 1 synthetic) and 2 orphaned staff-role identities with no order impact. This is tail-end drift from the migration cutover window, not a systemic divergence. **Supabase Cloud can be treated as the sole authoritative production database going forward.** These specific records were deliberately **not imported into Cloud automatically** — that is a product decision (e.g., whether to manually re-create `cc121a50-…`'s pending order for that customer) that belongs to the project owner, not an automated migration.

## Retirement prerequisite (as of 2026-09-23, unresolved at archival time)

The self-hosted stack's public gateway domain `auth.unitedpharmacy.io` (CNAME → Railway edge, confirmed still resolving via DNS at archival time) was still live and routable. No code in this repository's history has ever referenced that domain, and the current build config points exclusively at Supabase Cloud — but the domain itself remained reachable from the public internet until removed. See the corresponding session report for the exact manual Railway dashboard steps to remove the domain and pause the project.
