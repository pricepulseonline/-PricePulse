-- PricePulse V66: ONE-PRODUCT price pilot. Run once in your existing Supabase SQL Editor.
-- No price data is inserted by this script. Your existing wishlist/auth tables are untouched.
-- After signing in on admin-prices.html, copy YOUR displayed auth user UUID.
-- Then run the separate admin grant statement shown in README-V66-PRICE-PILOT.txt.

create table if not exists public.pp_price_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.pp_price_admins enable row level security;
revoke all on public.pp_price_admins from public, anon, authenticated;
grant select on public.pp_price_admins to authenticated;
drop policy if exists "pp_price_admins_self_read" on public.pp_price_admins;
create policy "pp_price_admins_self_read" on public.pp_price_admins
  for select to authenticated using (user_id = (select auth.uid()));
-- No browser role can add itself as admin. Only a privileged SQL Editor user can grant access.

create table if not exists public.pp_retailer_prices (
  product_id text not null,
  retailer text not null,
  price numeric(12,2) not null check (price > 0),
  checked_at timestamptz not null,
  expires_at timestamptz not null,
  source text not null default 'user-manual-check'
    check (source in ('user-manual-check', 'approved-manual-check',
                     'authorized-retailer-api', 'authorized-affiliate-feed',
                     'amazon-creators-api', 'amazon-pa-api', 'amazon-approved-feed')),
  availability text not null default 'in_stock'
    check (availability in ('in_stock', 'out_of_stock')),
  display_permitted boolean not null default false,
  published boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (product_id, retailer),
  check (product_id ~ '^[a-z0-9-]+$'),
  check (retailer in ('Amazon', 'Flipkart', 'Croma', 'Myntra', 'AJIO', 'Meesho')),
  check (expires_at > checked_at and expires_at <= checked_at + interval '24 hours'),
  check (not published or display_permitted)
);
create index if not exists pp_retailer_prices_visible_idx
  on public.pp_retailer_prices(product_id, expires_at) where published;
alter table public.pp_retailer_prices enable row level security;
revoke all on public.pp_retailer_prices from public, anon, authenticated;
grant select on public.pp_retailer_prices to anon, authenticated;
grant insert, update, delete on public.pp_retailer_prices to authenticated;

drop policy if exists "pp_price_public_read_fresh" on public.pp_retailer_prices;
create policy "pp_price_public_read_fresh" on public.pp_retailer_prices
  for select to anon, authenticated
  using (published and display_permitted and expires_at > now() and checked_at <= now());

drop policy if exists "pp_price_admin_read_all" on public.pp_retailer_prices;
create policy "pp_price_admin_read_all" on public.pp_retailer_prices
  for select to authenticated
  using (exists (select 1 from public.pp_price_admins a where a.user_id = (select auth.uid())));

drop policy if exists "pp_price_admin_insert" on public.pp_retailer_prices;
create policy "pp_price_admin_insert" on public.pp_retailer_prices
  for insert to authenticated
  with check (updated_by = (select auth.uid()) and
    exists (select 1 from public.pp_price_admins a where a.user_id = (select auth.uid())));

drop policy if exists "pp_price_admin_update" on public.pp_retailer_prices;
create policy "pp_price_admin_update" on public.pp_retailer_prices
  for update to authenticated
  using (exists (select 1 from public.pp_price_admins a where a.user_id = (select auth.uid())))
  with check (updated_by = (select auth.uid()) and
    exists (select 1 from public.pp_price_admins a where a.user_id = (select auth.uid())));

-- No delete policy: accidental client-side deletions are disallowed.
-- Reverification always updates an existing row through secure upsert.
