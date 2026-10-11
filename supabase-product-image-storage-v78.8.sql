-- PricePulse V78.8 · Product Image Storage
-- Run once in Supabase SQL Editor only if you want Admin local-file uploads.
-- URL-based primary/secondary images work without this bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pp-product-images',
  'pp-product-images',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pp_product_images_public_read" on storage.objects;
create policy "pp_product_images_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'pp-product-images');

drop policy if exists "pp_product_images_admin_insert" on storage.objects;
create policy "pp_product_images_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pp-product-images'
  and exists (
    select 1 from public.pp_price_admins a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "pp_product_images_admin_update" on storage.objects;
create policy "pp_product_images_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'pp-product-images'
  and exists (
    select 1 from public.pp_price_admins a
    where a.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'pp-product-images'
  and exists (
    select 1 from public.pp_price_admins a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "pp_product_images_admin_delete" on storage.objects;
create policy "pp_product_images_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pp-product-images'
  and exists (
    select 1 from public.pp_price_admins a
    where a.user_id = (select auth.uid())
  )
);
