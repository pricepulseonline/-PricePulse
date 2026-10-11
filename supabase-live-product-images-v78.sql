-- Compatibility alias inside the V78.1 package. This file now contains the same hardened
-- migration as supabase-live-product-images-v78.1.sql so either filename is safe to run.
-- PricePulse V78.1: verified best-store live product image hardening.
-- Run ONCE in the same Supabase project. Safe whether V78.0 was already run or not.
-- This supersedes the V78.0 live-image migration and keeps all existing catalog/price data.
--
-- Safety contract:
--   * Price winner is still the actual lowest fresh + published + permitted + in-stock offer.
--   * That winner may replace the public product image ONLY when image_verified = true,
--     match_status = 'match', and image_url is present.
--   * Manual image entry, Needs Review, mismatch override, or missing/unverified image can
--     never replace the last known-good live image.
--   * Price expiry alone never clears the last known-good image.
--   * Future API/feed ingestion uses the same path: after its own exact-product validation,
--     write image_verified=true (+ image_verified_at/source) on pp_retailer_prices.

alter table public.pp_catalog_products add column if not exists live_image_url text;
alter table public.pp_catalog_products add column if not exists live_image_store text;
alter table public.pp_catalog_products add column if not exists live_image_verified_at timestamptz;
alter table public.pp_catalog_products add column if not exists live_image_source text;
alter table public.pp_catalog_products add column if not exists live_image_price numeric(12,2);

alter table public.pp_retailer_prices add column if not exists image_verified boolean not null default false;
alter table public.pp_retailer_prices add column if not exists image_verified_at timestamptz;
alter table public.pp_retailer_prices add column if not exists image_verification_source text;

-- Conservative backfill for historical rows whose image provenance is already trustworthy.
-- Browser-helper rows were captured from the retailer page and still require exact Match.
-- API/feed rows are included only when their stored match_status is already Match.
update public.pp_retailer_prices r
   set image_verified = true,
       image_verified_at = coalesce(r.image_verified_at, r.checked_at),
       image_verification_source = coalesce(
         nullif(r.image_verification_source,''),
         case
           when r.capture_source in ('browser-helper','api','feed') then r.capture_source
           else r.source
         end
       )
 where coalesce(r.image_verified,false) = false
   and r.match_status = 'match'
   and nullif(trim(coalesce(r.image_url,'')),'') is not null
   and (
     -- Historical browser-helper rows are trusted only when the saved listing proves
     -- that the exact same image came from last_capture (not from later manual editing).
     (r.capture_source = 'browser-helper' and exists (
       select 1
         from public.pp_catalog_stores s
         join public.pp_product_store_listings l on l.store_slug = s.slug
        where l.product_id = r.product_id
          and lower(s.name) = lower(r.retailer)
          and l.match_status = 'match'
          and nullif(trim(coalesce(l.captured_image_url,'')),'') = r.image_url
          and nullif(trim(coalesce(l.last_capture->>'image','')),'') = r.image_url
     ))
     or r.capture_source in ('api','feed')
     or r.source in (
       'authorized-retailer-api','authorized-affiliate-feed',
       'amazon-creators-api','amazon-pa-api','amazon-approved-feed'
     )
   );

-- V78.0 could have persisted a live image before explicit image provenance existed.
-- Keep it only when a verified exact-match retailer row can prove the same image/store.
update public.pp_catalog_products p
   set live_image_url = null,
       live_image_store = null,
       live_image_verified_at = null,
       live_image_source = null,
       live_image_price = null,
       updated_at = now()
 where p.live_image_url is not null
   and not exists (
     select 1
       from public.pp_retailer_prices r
      where r.product_id = p.product_id
        and r.match_status = 'match'
        and r.image_verified = true
        and nullif(trim(coalesce(r.image_url,'')),'') is not null
        and r.image_url = p.live_image_url
        and (p.live_image_store is null or r.retailer = p.live_image_store)
   );

create or replace function public.pp_refresh_live_product_image(p_product_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_best record;
begin
  -- Always choose the real current price winner first. Do NOT skip a cheaper retailer
  -- merely because its image is missing/unverified; in that case retain the previous image.
  select r.retailer,
         r.price,
         r.image_url,
         r.match_status,
         r.image_verified,
         r.image_verified_at,
         r.image_verification_source,
         r.checked_at,
         r.source
    into v_best
    from public.pp_retailer_prices r
   where r.product_id = p_product_id
     and r.published = true
     and r.display_permitted = true
     and r.availability = 'in_stock'
     and r.checked_at <= now()
     and r.expires_at > now()
   order by r.price asc, r.checked_at desc, r.retailer asc
   limit 1;

  if not found then
    -- 24-hour expiry alone must never blank or roll back a last verified live image.
    return;
  end if;

  if coalesce(v_best.match_status,'') = 'match'
     and coalesce(v_best.image_verified,false) = true
     and nullif(trim(coalesce(v_best.image_url,'')),'') is not null then
    update public.pp_catalog_products p
       set live_image_url = v_best.image_url,
           live_image_store = v_best.retailer,
           live_image_verified_at = coalesce(v_best.image_verified_at, v_best.checked_at),
           live_image_source = coalesce(nullif(v_best.image_verification_source,''), v_best.source),
           live_image_price = v_best.price,
           updated_at = now()
     where p.product_id = p_product_id;
  end if;
end;
$$;

revoke all on function public.pp_refresh_live_product_image(text) from public;
grant execute on function public.pp_refresh_live_product_image(text) to authenticated;

create or replace function public.pp_retailer_price_live_image_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pp_refresh_live_product_image(new.product_id);
  return new;
end;
$$;

drop trigger if exists pp_retailer_prices_refresh_live_image on public.pp_retailer_prices;
create trigger pp_retailer_prices_refresh_live_image
after insert or update of price, checked_at, expires_at, source, availability,
  display_permitted, published, image_url, match_status, image_verified,
  image_verified_at, image_verification_source
on public.pp_retailer_prices
for each row execute function public.pp_retailer_price_live_image_trigger();

-- Re-evaluate from current fresh prices. If the current winner has no safe image,
-- pp_refresh_live_product_image intentionally leaves the previous proven image unchanged.
do $$
declare r record;
begin
  for r in select product_id from public.pp_catalog_products loop
    perform public.pp_refresh_live_product_image(r.product_id);
  end loop;
end $$;

notify pgrst, 'reload schema';
