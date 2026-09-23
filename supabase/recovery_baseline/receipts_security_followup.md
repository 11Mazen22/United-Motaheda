# Receipts Bucket — Planned Security Change (SEPARATE from the recovery baseline)

**Not part of the disaster-recovery baseline.** The baseline reproduces today's actual production behavior (`public=true`, public-read policy) because that is what the current code depends on — changing it inside a historical recovery artifact would make the "recovery" not actually match what it's meant to recover. This document is the follow-up plan for fixing the underlying design once the baseline itself is proven safe.

## Current state (compatibility, not endorsement)
`receiptUpload.ts` (native) and `webPaymentApi.ts` (web) call `.getPublicUrl(path)` and use that raw URL directly for both storing and displaying payment-proof screenshots. This requires the bucket to be public, and it is — with zero access control on read once a URL is known (path pattern `{userId}/{timestamp}.{ext}`, not cryptographically random).

## Why this matters
Receipts are Vodafone Cash / InstaPay transfer-proof screenshots — they can contain a phone number, transaction ID, and amount. A leaked URL (log line, screenshot, browser history, referrer header) exposes that with no authentication check at all.

## The fix already exists in this codebase, just not applied here
`driver-documents` and `prescriptions` buckets already use the correct pattern:
1. Bucket stays private (`public=false`).
2. Upload stores a path (or a decorative `getPublicUrl()`-shaped string that 403s if fetched directly — see `apps/shopper-native/src/features/driver/api.ts` and `apps/api/src/modules/admin/admin-operations.service.ts` for the existing documented convention).
3. Anyone actually viewing the file (owner, or an authorized admin/pharmacist) gets a real, time-limited `createSignedUrl()` generated at view-time — see `apps/shopper-native/src/features/pharmacist/api/prescriptions.ts:201` and `apps/api/src/modules/driver/file-upload.service.ts:117` for working, in-production examples.

## Planned change
1. Flip `receipts` bucket to `public=false`.
2. Replace `getPublicUrl()` calls in `receiptUpload.ts` and `webPaymentApi.ts` with `createSignedUrl(path, <short expiry>)`, generated at the point of actual display — not stored long-term.
3. Access control for signed-URL generation: owner (customer who uploaded it) or admin/manager (payment verification) — matching what `staff read all receipts` already encodes; drop the now-fully-redundant `receipts public read` policy once no code path needs it.
4. Remove the two already-identified duplicate policies (`receipts authenticated insert`, `receipts authenticated read own`) regardless of the above — they're dead weight now.
5. **Verification before touching production**: confirm the OLD (public-URL) receipts already stored remain viewable — either by generating signed URLs for existing paths (they need no bucket-config change, since path structure doesn't change) or by a one-time backfill; confirm the NEW upload+view flow works end-to-end on a real device/browser for both customer self-view and admin/manager review, before flipping the bucket's public flag in production.

Not scheduled to start until the disaster-recovery baseline itself is drafted, tested against a disposable database, and approved.
