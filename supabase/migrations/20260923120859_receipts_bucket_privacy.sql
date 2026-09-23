-- Flip the `receipts` bucket from public to private.
--
-- Payment-proof screenshots (Vodafone Cash / InstaPay manual transfers) can
-- contain a phone number, transaction ID, and amount. The bucket was
-- public=true with a blanket "receipts public read" RLS policy on top
-- (bucket_id = 'receipts', no owner/staff check at all) -- any authenticated
-- user could read any customer's receipt by URL, and public=true additionally
-- allowed fully unauthenticated reads via the CDN-style getPublicUrl() path,
-- bypassing RLS entirely. Continues the plan already drafted in
-- supabase/recovery_baseline/receipts_security_followup.md (committed this
-- session), now that its stated precondition -- the recovery baseline itself
-- landed -- is satisfied.
--
-- Data impact: confirmed live before writing this migration -- only 2 of 17
-- orders have a non-null payment_proof_url, and both are the literal string
-- 'https://example.com/test-receipt-patched.jpg' (test data, not a real
-- receipt, does not reference any real object in this bucket). No real
-- payment-proof data exists in production yet, so there is nothing to
-- migrate/backfill and nothing this change can break for a real customer.
-- Application code (receiptUpload.ts, webPaymentApi.ts) already switched to
-- storing bare object paths and resolving signed URLs at view time in the
-- same commit as this migration.

update storage.buckets set public = false where id = 'receipts';

-- Drop the blanket public-read policy and the duplicate insert/read
-- policies (both pairs identical, one authored under the old plain-English
-- naming convention, one under this project's later "bucket: role verb"
-- convention) -- consolidating to one clearly-named policy per operation.
drop policy if exists "receipts public read" on storage.objects;
drop policy if exists "receipts authenticated insert" on storage.objects;
drop policy if exists "receipts authenticated read own" on storage.objects;
drop policy if exists "customers upload own receipts" on storage.objects;
drop policy if exists "customers read own receipts" on storage.objects;
drop policy if exists "staff read all receipts" on storage.objects;

create policy "receipts: customer upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receipts: customer read own"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- admin_review_payment() (the payment-verification RPC) explicitly
-- authorizes pharmacist alongside admin/manager (is_manager() OR
-- role = 'pharmacist') -- the old "staff read all receipts" policy only
-- covered admin/manager, so a pharmacist verifying payment had no RLS-backed
-- way to view the proof they were verifying (only worked before because the
-- bucket was public, i.e. everyone could see it, not because they were
-- correctly authorized). Fixed here rather than left as a regression from
-- tightening the bucket.
create policy "receipts: staff read all"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (select role from public.profiles where id = auth.uid()) = any (array['admin', 'manager', 'pharmacist']::app_role[])
  );

-- No customer update/delete policy: unlike prescriptions (which support an
-- explicit re-upload/correction flow), a payment receipt is evidence for a
-- specific transaction and is intentionally immutable once uploaded -- a
-- customer who uploaded the wrong screenshot re-submits payment through the
-- normal flow rather than mutating the existing proof object in place.
