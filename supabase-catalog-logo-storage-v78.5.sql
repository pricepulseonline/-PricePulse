-- PricePulse V78.5 · Central Brand/Store Logo Storage
-- Run once in the Supabase SQL Editor.
-- Creates a public-read logo bucket, while uploads/updates/deletes remain restricted
-- to authenticated users already present in public.pp_price_admins.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pp-catalog-logos',
  'pp-catalog-logos',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public website/logo previews may read files from this dedicated public bucket.
drop policy if exists "pp_catalog_logos_public_read" on storage.objects;
create policy "pp_catalog_logos_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'pp-catalog-logos');

-- Only PricePulse price admins can create logo objects.
drop policy if exists "pp_catalog_logos_admin_insert" on storage.objects;
create policy "pp_catalog_logos_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pp-catalog-logos'
  and exists (
    select 1 from public.pp_price_admins a
    where a.user_id = (select auth.uid())
  )
);

-- Reserved for safe future logo replacement/cleanup workflows.
drop policy if exists "pp_catalog_logos_admin_update" on storage.objects;
create policy "pp_catalog_logos_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'pp-catalog-logos'
  and exists (
    select 1 from public.pp_price_admins a
    where a.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'pp-catalog-logos'
  and exists (
    select 1 from public.pp_price_admins a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "pp_catalog_logos_admin_delete" on storage.objects;
create policy "pp_catalog_logos_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pp-catalog-logos'
  and exists (
    select 1 from public.pp_price_admins a
    where a.user_id = (select auth.uid())
  )
);
