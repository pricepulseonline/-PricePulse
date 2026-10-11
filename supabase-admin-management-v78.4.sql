-- PricePulse V78.4: safe catalog management permissions.
-- Run ONCE in the same Supabase project after supabase-admin-catalog-v77.sql.
-- Safe to re-run. No existing catalog, retailer, price-history, wishlist or auth data is changed.
--
-- Edit/archive already use existing UPDATE permissions. This migration grants hard DELETE
-- only to authenticated PricePulse admins. The V78.4 Admin UI still blocks deletes whenever
-- dependent products, retailer links, current prices, or price-history rows exist.

grant delete on public.pp_catalog_brands to authenticated;
grant delete on public.pp_catalog_stores to authenticated;
grant delete on public.pp_catalog_products to authenticated;

drop policy if exists "pp_catalog_brands_admin_delete" on public.pp_catalog_brands;
create policy "pp_catalog_brands_admin_delete" on public.pp_catalog_brands for delete to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

drop policy if exists "pp_catalog_stores_admin_delete" on public.pp_catalog_stores;
create policy "pp_catalog_stores_admin_delete" on public.pp_catalog_stores for delete to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

drop policy if exists "pp_catalog_products_admin_delete" on public.pp_catalog_products;
create policy "pp_catalog_products_admin_delete" on public.pp_catalog_products for delete to authenticated
  using (exists(select 1 from public.pp_price_admins a where a.user_id=(select auth.uid())));

notify pgrst, 'reload schema';
