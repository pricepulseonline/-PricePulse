-- PricePulse V77: Admin Catalog + richer manual verification migration.
-- Run ONCE in the SAME Supabase project that already contains pp_price_admins / pp_retailer_prices.
-- Safe to re-run. Existing auth, wishlist, deal alerts and verified prices are preserved.
-- This migration prepares the same fields for future authorized API/feed sync.

-- 1) Catalog masters ----------------------------------------------------------
create table if not exists public.pp_catalog_brands (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null unique,
  logo_url text,
  website_url text,
  aliases text[] not null default '{}',
  active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pp_catalog_stores (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null unique,
  domain text not null,
  logo_url text,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pp_catalog_products (
  product_id text primary key check (product_id ~ '^[a-z0-9-]+$'),
  name text not null,
  brand_slug text not null references public.pp_catalog_brands(slug),
  category text not null,
  identity_key text not null,
  model_code text,
  variant text,
  image_url text,
  status text not null default 'active' check (status in ('active','tracking','draft')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pp_product_store_listings (
  product_id text not null references public.pp_catalog_products(product_id) on delete cascade,
  store_slug text not null references public.pp_catalog_stores(slug),
  affiliate_url text,
  direct_url text,
  listing_status text not null default 'active'
    check (listing_status in ('active','out_of_stock','not_listed','track_only')),
  captured_title text,
  captured_model text,
  captured_variant text,
  captured_image_url text,
  match_status text not null default 'unverified'
    check (match_status in ('match','needs_review','mismatch','unverified')),
  match_score integer check (match_score is null or (match_score >= 0 and match_score <= 100)),
  override_reason text,
  last_capture jsonb not null default '{}'::jsonb,
  last_captured_at timestamptz,
  active boolean not null default true,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, store_slug),
  check (
    listing_status in ('not_listed','track_only')
    or coalesce(nullif(affiliate_url,''), nullif(direct_url,'')) is not null
  )
);

create index if not exists pp_catalog_products_brand_idx on public.pp_catalog_products(brand_slug);
create index if not exists pp_catalog_products_status_idx on public.pp_catalog_products(status);
create index if not exists pp_product_store_listings_status_idx on public.pp_product_store_listings(product_id, listing_status);

-- 2) Rich verification fields on existing current-price table ----------------
alter table public.pp_retailer_prices add column if not exists mrp numeric(12,2);
alter table public.pp_retailer_prices add column if not exists rating numeric(3,2);
alter table public.pp_retailer_prices add column if not exists review_count bigint;
alter table public.pp_retailer_prices add column if not exists delivery_text text;
alter table public.pp_retailer_prices add column if not exists offer_text text;
alter table public.pp_retailer_prices add column if not exists captured_title text;
alter table public.pp_retailer_prices add column if not exists captured_model text;
alter table public.pp_retailer_prices add column if not exists captured_variant text;
alter table public.pp_retailer_prices add column if not exists image_url text;
alter table public.pp_retailer_prices add column if not exists match_status text;
alter table public.pp_retailer_prices add column if not exists match_score integer;
alter table public.pp_retailer_prices add column if not exists verification_notes text;
alter table public.pp_retailer_prices add column if not exists capture_source text;
alter table public.pp_retailer_prices add column if not exists details_reviewed boolean not null default false;
alter table public.pp_retailer_prices add column if not exists listing_url text;

-- Existing fixed retailer enum prevented future stores. Keep retailer name text,
-- but validate that it is non-empty. This keeps old public code backward-compatible.
alter table public.pp_retailer_prices drop constraint if exists pp_retailer_prices_retailer_check;
alter table public.pp_retailer_prices drop constraint if exists pp_retailer_prices_retailer_nonempty;
alter table public.pp_retailer_prices add constraint pp_retailer_prices_retailer_nonempty check (length(trim(retailer)) >= 2);

alter table public.pp_retailer_prices drop constraint if exists pp_retailer_prices_mrp_check;
alter table public.pp_retailer_prices add constraint pp_retailer_prices_mrp_check check (mrp is null or mrp > 0);
alter table public.pp_retailer_prices drop constraint if exists pp_retailer_prices_rating_check;
alter table public.pp_retailer_prices add constraint pp_retailer_prices_rating_check check (rating is null or (rating >= 0 and rating <= 5));
alter table public.pp_retailer_prices drop constraint if exists pp_retailer_prices_review_count_check;
alter table public.pp_retailer_prices add constraint pp_retailer_prices_review_count_check check (review_count is null or review_count >= 0);
alter table public.pp_retailer_prices drop constraint if exists pp_retailer_prices_match_status_check;
alter table public.pp_retailer_prices add constraint pp_retailer_prices_match_status_check check (match_status is null or match_status in ('match','needs_review','mismatch','unverified'));
alter table public.pp_retailer_prices drop constraint if exists pp_retailer_prices_match_score_check;
alter table public.pp_retailer_prices add constraint pp_retailer_prices_match_score_check check (match_score is null or (match_score >= 0 and match_score <= 100));

-- If V70 history is installed, make it future-store compatible too.
alter table if exists public.pp_retailer_price_history drop constraint if exists pp_retailer_price_history_retailer_check;
alter table if exists public.pp_retailer_price_history drop constraint if exists pp_retailer_price_history_retailer_nonempty;
alter table if exists public.pp_retailer_price_history add constraint pp_retailer_price_history_retailer_nonempty check (length(trim(retailer)) >= 2);

-- 3) Row-level security -------------------------------------------------------
alter table public.pp_catalog_brands enable row level security;
alter table public.pp_catalog_stores enable row level security;
alter table public.pp_catalog_products enable row level security;
alter table public.pp_product_store_listings enable row level security;

revoke all on public.pp_catalog_brands from public, anon, authenticated;
revoke all on public.pp_catalog_stores from public, anon, authenticated;
revoke all on public.pp_catalog_products from public, anon, authenticated;
revoke all on public.pp_product_store_listings from public, anon, authenticated;

grant select on public.pp_catalog_brands to anon, authenticated;
grant select on public.pp_catalog_stores to anon, authenticated;
grant select on public.pp_catalog_products to anon, authenticated;
grant select on public.pp_product_store_listings to anon, authenticated;
grant insert, update, delete on public.pp_catalog_brands to authenticated;
grant insert, update, delete on public.pp_catalog_stores to authenticated;
grant insert, update, delete on public.pp_catalog_products to authenticated;
grant insert, update on public.pp_product_store_listings to authenticated;

-- Public reads only active/catalog-visible records. The admin gets complete reads.
drop policy if exists "pp_catalog_brands_public_read" on public.pp_catalog_brands;
create policy "pp_catalog_brands_public_read" on public.pp_catalog_brands for select to anon, authenticated using (active);
drop policy if exists "pp_catalog_stores_public_read" on public.pp_catalog_stores;
create policy "pp_catalog_stores_public_read" on public.pp_catalog_stores for select to anon, authenticated using (active);
drop policy if exists "pp_catalog_products_public_read" on public.pp_catalog_products;
create policy "pp_catalog_products_public_read" on public.pp_catalog_products for select to anon, authenticated using (status in ('active','tracking'));
drop policy if exists "pp_product_store_listings_public_read" on public.pp_product_store_listings;
create policy "pp_product_store_listings_public_read" on public.pp_product_store_listings for select to anon, authenticated using (active);

-- Admin write policies use the existing secure pp_price_admins allowlist.
drop policy if exists "pp_catalog_brands_admin_insert" on public.pp_catalog_brands;
create policy "pp_catalog_brands_admin_insert" on public.pp_catalog_brands for insert to authenticated
  with check (updated_by=(select auth.uid()) and exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));
drop policy if exists "pp_catalog_brands_admin_update" on public.pp_catalog_brands;
create policy "pp_catalog_brands_admin_update" on public.pp_catalog_brands for update to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())))
  with check (updated_by=(select auth.uid()) and exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

drop policy if exists "pp_catalog_stores_admin_insert" on public.pp_catalog_stores;
create policy "pp_catalog_stores_admin_insert" on public.pp_catalog_stores for insert to authenticated
  with check (updated_by=(select auth.uid()) and exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));
drop policy if exists "pp_catalog_stores_admin_update" on public.pp_catalog_stores;
create policy "pp_catalog_stores_admin_update" on public.pp_catalog_stores for update to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())))
  with check (updated_by=(select auth.uid()) and exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

drop policy if exists "pp_catalog_products_admin_insert" on public.pp_catalog_products;
create policy "pp_catalog_products_admin_insert" on public.pp_catalog_products for insert to authenticated
  with check (updated_by=(select auth.uid()) and exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));
drop policy if exists "pp_catalog_products_admin_update" on public.pp_catalog_products;
create policy "pp_catalog_products_admin_update" on public.pp_catalog_products for update to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())))
  with check (updated_by=(select auth.uid()) and exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

drop policy if exists "pp_catalog_brands_admin_delete" on public.pp_catalog_brands;
create policy "pp_catalog_brands_admin_delete" on public.pp_catalog_brands for delete to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

drop policy if exists "pp_catalog_stores_admin_delete" on public.pp_catalog_stores;
create policy "pp_catalog_stores_admin_delete" on public.pp_catalog_stores for delete to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

drop policy if exists "pp_catalog_products_admin_delete" on public.pp_catalog_products;
create policy "pp_catalog_products_admin_delete" on public.pp_catalog_products for delete to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

drop policy if exists "pp_product_store_listings_admin_insert" on public.pp_product_store_listings;
create policy "pp_product_store_listings_admin_insert" on public.pp_product_store_listings for insert to authenticated
  with check (updated_by=(select auth.uid()) and exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));
drop policy if exists "pp_product_store_listings_admin_update" on public.pp_product_store_listings;
create policy "pp_product_store_listings_admin_update" on public.pp_product_store_listings for update to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())))
  with check (updated_by=(select auth.uid()) and exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

-- Admins also need complete reads of draft/inactive records.
drop policy if exists "pp_catalog_brands_admin_read_all" on public.pp_catalog_brands;
create policy "pp_catalog_brands_admin_read_all" on public.pp_catalog_brands for select to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));
drop policy if exists "pp_catalog_stores_admin_read_all" on public.pp_catalog_stores;
create policy "pp_catalog_stores_admin_read_all" on public.pp_catalog_stores for select to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));
drop policy if exists "pp_catalog_products_admin_read_all" on public.pp_catalog_products;
create policy "pp_catalog_products_admin_read_all" on public.pp_catalog_products for select to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));
drop policy if exists "pp_product_store_listings_admin_read_all" on public.pp_product_store_listings;
create policy "pp_product_store_listings_admin_read_all" on public.pp_product_store_listings for select to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

-- 4) Seed the current locked PricePulse catalog -------------------------------
insert into public.pp_catalog_brands (slug,name,logo_url,active) values
 ('boat','boAt','logos/official/boat.svg',true),
 ('philips','Philips','logos/official/philips.svg',true),
 ('oneplus','OnePlus','logos/official/oneplus.png',true),
 ('samsung','Samsung','logos/samsung-wordmark.png',true),
 ('dell','Dell','logos/official/dell.svg',true),
 ('puma','PUMA','logos/official/puma-original.png',true),
 ('nutripro','NutriPro','logos/official/nutripro.jpg',true),
 ('dotkey','Dot & Key','logos/official/dotkey.svg',true)
on conflict (slug) do nothing;

insert into public.pp_catalog_stores (slug,name,domain,logo_url,active) values
 ('amazon','Amazon','amazon.in','logos/amazon-wordmark.svg',true),
 ('flipkart','Flipkart','flipkart.com','logos/flipkart-wordmark.svg',true),
 ('croma','Croma','croma.com','logos/croma-wordmark.svg',true),
 ('myntra','Myntra','myntra.com','logos/myntra.svg',true),
 ('ajio','AJIO','ajio.com','logos/ajio-wordmark.svg',true),
 ('meesho','Meesho','meesho.com','logos/meesho-wordmark.png',true)
on conflict (slug) do nothing;

insert into public.pp_catalog_products
(product_id,name,brand_slug,category,identity_key,model_code,variant,image_url,status) values
 ('headphones','boAt Rockerz Plus 450 ANC','boat','electronics','Rockerz Plus 450 ANC PA0056','PA0056',null,'images/products/boat-rockerz-plus-450-anc.svg','active'),
 ('airfryer','PHILIPS Air Fryer NA120/00 4.2L','philips','appliances','NA120/00 4.2L','NA120/00','4.2L','images/products/philips-na120-00.svg','active'),
 ('oneplus-nord6','OnePlus Nord 6','oneplus','mobiles','OnePlus Nord 6','Nord 6',null,'images/products/oneplus-nord-6-v49.webp','active'),
 ('samsung-buds-core','Samsung Galaxy Buds Core (White)','samsung','electronics','Galaxy Buds Core White','Galaxy Buds Core','White','images/products/samsung-buds-core-white-v49.webp','active'),
 ('dell15','Dell 15 Laptop','dell','laptops','Dell DC15250','DC15250',null,'images/products/dell-dc15250.svg','active'),
 ('puma-smashic','PUMA Smashic Comfort Sneakers','puma','fashion','PUMA Smashic Comfort','Smashic Comfort',null,'images/products/puma-smashic-white.svg','active'),
 ('nutripro-500w','NutriPro 500W Juicer Mixer','nutripro','appliances','NutriPro 500W Juicer Mixer','500W',null,'images/products/nutripro-500w.svg','active'),
 ('dotkey-sunscreen','Dot & Key Vitamin C+E Sunscreen','dotkey','beauty','Vitamin C+E Sunscreen 50g',null,'50g','images/products/dotkey-vitamin-ce-50g.svg','active'),
 ('dotkey-barrier-50g','Dot & Key Barrier Repair Moisturizer 50g','dotkey','beauty','Ceramides Hyaluronic Barrier Repair Moisturizer 50g',null,'50g','images/products/dotkey-barrier-repair-50g.svg','active'),
 ('boat-storm-call3','boAt Storm Call 3','boat','watches','boAt Storm Call 3','Storm Call 3',null,'images/products/boat-storm-call-3-v49.webp','active')
on conflict (product_id) do nothing;

insert into public.pp_product_store_listings (product_id,store_slug,affiliate_url,listing_status) values
 ('headphones','amazon','https://link.amazon/B09rE8I28','active'),
 ('headphones','flipkart','https://fktr.in/sqmj28f','active'),
 ('headphones','croma','https://www.croma.com/boat-rockerz-plus-450-pa0056-bluetooth-headphone-with-mic-hybrid-active-noise-cancellation-over-ear-black-sabre-/p/323337','active'),
 ('airfryer','amazon','https://link.amazon/B02kj7cPY','active'),('airfryer','flipkart','https://fktr.in/Ea7E8ah','active'),('airfryer','croma','https://www.croma.com/philips-1000-4-2l-1500-watt-air-fryer-with-rapid-air-technology-black-/p/311802','active'),
 ('oneplus-nord6','amazon','https://link.amazon/B0dnbxghN','active'),('oneplus-nord6','flipkart','https://fktr.in/DByRHI6','active'),('oneplus-nord6','croma','https://www.croma.com/oneplus-nord-6-5g-8gb-ram-256gb-fresh-mint-/p/322986','active'),
 ('samsung-buds-core','amazon','https://link.amazon/B07c5Wf8K','active'),('samsung-buds-core','flipkart','https://fktr.in/sk5tIKQ','active'),
 ('dell15','amazon','https://link.amazon/B09t594Ee','active'),('dell15','flipkart','https://fktr.in/8hJBEP1','active'),('dell15','croma','https://www.croma.com/dell-dc-15250-intel-core-3-thin-light-laptop-16gb-512gb-ssd-windows-11-15-6-inch-full-hd-display-ms-office-home-2024-carbon-black-1-66-kg-/p/317370','active'),
 ('puma-smashic','amazon','https://link.amazon/B00WHXXe7','active'),('puma-smashic','flipkart','https://fktr.in/2a4k3yQ','active'),('puma-smashic','myntra','https://myntr.it/I7bGbBg','active'),('puma-smashic','ajio','https://ajiio.in/mz3X1gO','active'),
 ('nutripro-500w','amazon','https://link.amazon/B0i7Hj34t','active'),('nutripro-500w','flipkart','https://fktr.in/WUocyOo','active'),('nutripro-500w','myntra','https://myntr.it/aykyjoe','active'),
 ('dotkey-sunscreen','amazon','https://link.amazon/B010WA6gz','active'),('dotkey-sunscreen','flipkart','https://fktr.in/o3QMuoP','active'),('dotkey-sunscreen','myntra','https://myntr.it/Sjls3oF','active'),
 ('dotkey-barrier-50g','amazon','https://link.amazon/B00n4SgCn','active'),('dotkey-barrier-50g','flipkart','https://fktr.in/vmPHyy1','active'),('dotkey-barrier-50g','meesho','https://www.meesho.com/af_invite/523430960:youtube_long_form:12035248?p_id=682268393&ext_id=ba7dnt&utm_source=youtube_long_form','active'),
 ('boat-storm-call3','amazon','https://link.amazon/B0iRaCp4h','active'),('boat-storm-call3','flipkart','https://fktr.in/NXIHS6t','active'),('boat-storm-call3','myntra','https://myntr.it/g0DjG3O','active')
on conflict (product_id,store_slug) do nothing;

notify pgrst, 'reload schema';
