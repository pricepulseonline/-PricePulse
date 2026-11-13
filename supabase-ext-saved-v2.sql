-- PricePulse extension 2.1: alerts + wishlist for products that are NOT on PricePulse
-- Run once in Supabase > SQL Editor. Safe to run again.
--
-- Alerts: the extension saves them in pp_deal_alerts (product_id "ext-<store>-<key>"), so the plan limit
--         (Free 3 / Plus 12 / Pro unlimited), the email queue and My Alerts on the site keep working.
--         ext_url = the product page; the email links to it.
-- Wishlist: a small table of its own (link, title, picture, price).

alter table public.pp_deal_alerts add column if not exists ext_url text;

create table if not exists public.pp_ext_wishlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  store text not null,
  item_key text not null,
  url text not null check (url ~ '^https://'),
  title text not null default 'Product',
  image text not null default '',
  store_name text,
  price numeric(12,2),
  created_at timestamptz not null default now(),
  primary key (user_id, store, item_key)
);
create index if not exists pp_ext_wishlist_user_idx on public.pp_ext_wishlist (user_id, created_at desc);

alter table public.pp_ext_wishlist enable row level security;
revoke all on public.pp_ext_wishlist from public, anon, authenticated;
grant select, insert, delete on public.pp_ext_wishlist to authenticated;

drop policy if exists "Users can view own ext wishlist" on public.pp_ext_wishlist;
create policy "Users can view own ext wishlist" on public.pp_ext_wishlist for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users can add own ext wishlist" on public.pp_ext_wishlist;
create policy "Users can add own ext wishlist" on public.pp_ext_wishlist for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users can delete own ext wishlist" on public.pp_ext_wishlist;
create policy "Users can delete own ext wishlist" on public.pp_ext_wishlist for delete to authenticated using (user_id = (select auth.uid()));

-- check: select count(*) from public.pp_ext_wishlist;
