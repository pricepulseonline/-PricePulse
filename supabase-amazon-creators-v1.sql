-- PricePulse: store for Amazon prices that come from Amazon's official Creators API (Edge Function "amazon-price").
-- Run once in Supabase > SQL Editor. Safe to run again. Nothing reads or writes it except that Edge Function.
-- The function never returns a price older than 24 hours (Amazon Associates rule).

create table if not exists public.pp_amazon_prices (
  asin text primary key check (asin ~ '^[A-Z0-9]{10}$'),
  price numeric(12,2) not null check (price > 0),
  title text not null default '',
  image_url text not null default '',
  detail_url text not null default '',
  checked_at timestamptz not null default now()
);
alter table public.pp_amazon_prices enable row level security;
revoke all on public.pp_amazon_prices from public, anon, authenticated;
-- no policies on purpose: browsers cannot read or write this table; the Edge Function uses the database connection

-- check: select count(*) from public.pp_amazon_prices;
