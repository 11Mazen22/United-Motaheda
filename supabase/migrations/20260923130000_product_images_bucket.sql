-- product-images bucket.
--
-- No storage bucket for product photos existed anywhere (confirmed live:
-- every products.image_url is currently NULL/empty across the whole
-- catalog, and neither ProductFormDialog.tsx nor FastProductEntry.tsx had
-- any upload path -- FastProductEntry captured a snapshot and sent it to a
-- disconnected Google Apps Script instead of the real product catalog, see
-- this session's admin-panel audit). Product photos are meant to be
-- publicly visible to customers browsing the catalog -- unlike
-- prescriptions/receipts/driver-documents, there is no privacy concern
-- here, so this bucket is public by design, matching the existing
-- `avatars` bucket's pattern.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Staff (admin/manager/pharmacist -- same role set adjust_inventory() and
-- products_write_staff already trust for catalog writes) can upload/replace/
-- remove product photos. Anyone can read (bucket is public, but RLS on
-- storage.objects is still enforced for the private surface: SELECT here
-- is a belt-and-suspenders explicit allow, matching the public bucket's
-- own public-read behavior).
drop policy if exists "product-images: staff write" on storage.objects;
create policy "product-images: staff write"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'manager', 'pharmacist')
  );

drop policy if exists "product-images: staff update" on storage.objects;
create policy "product-images: staff update"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'manager', 'pharmacist')
  );

drop policy if exists "product-images: staff delete" on storage.objects;
create policy "product-images: staff delete"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'manager', 'pharmacist')
  );

drop policy if exists "product-images: public read" on storage.objects;
create policy "product-images: public read"
  on storage.objects for select
  using (bucket_id = 'product-images');
