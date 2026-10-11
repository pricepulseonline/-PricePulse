-- PricePulse V70 FINAL: verified price-history migration.
-- Run ONCE after the existing V66 price pilot SQL.
-- Safe to re-run: table/index/policies/trigger are created idempotently.
-- Existing current prices are preserved and seeded once into history.

create table if not exists public.pp_retailer_price_history (
  id bigint generated always as identity primary key,
  product_id text not null,
  retailer text not null,
  price numeric(12,2) not null check (price > 0),
  availability text not null check (availability in ('in_stock','out_of_stock')),
  checked_at timestamptz not null,
  source text not null,
  display_permitted boolean not null default false,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (product_id ~ '^[a-z0-9-]+$'),
  check (retailer in ('Amazon','Flipkart','Croma','Myntra','AJIO','Meesho'))
);

create unique index if not exists pp_retailer_price_history_unique_check
  on public.pp_retailer_price_history(product_id, retailer, checked_at);
create index if not exists pp_retailer_price_history_product_checked_idx
  on public.pp_retailer_price_history(product_id, checked_at desc);

alter table public.pp_retailer_price_history enable row level security;
revoke all on public.pp_retailer_price_history from public, anon, authenticated;
grant select on public.pp_retailer_price_history to anon, authenticated;

-- Public visitors can read only history explicitly permitted for display.
drop policy if exists "pp_price_history_public_read" on public.pp_retailer_price_history;
create policy "pp_price_history_public_read" on public.pp_retailer_price_history
  for select to anon, authenticated using (display_permitted);

-- Price admins can inspect the complete history in authenticated tooling.
drop policy if exists "pp_price_history_admin_read_all" on public.pp_retailer_price_history;
create policy "pp_price_history_admin_read_all" on public.pp_retailer_price_history
  for select to authenticated
  using (exists (select 1 from public.pp_price_admins a where a.user_id = (select auth.uid())));

-- Seed the latest verified rows that already exist. This does NOT change current prices.
insert into public.pp_retailer_price_history
  (product_id, retailer, price, availability, checked_at, source, display_permitted, verified_by)
select product_id, retailer, price, availability, checked_at, source, display_permitted, updated_by
from public.pp_retailer_prices
where published and display_permitted
on conflict (product_id, retailer, checked_at) do nothing;

-- Every future verified current-price publish automatically appends one immutable
-- history record. The same trigger will also log future authorized API/feed writes,
-- so the public UI does not need to change when official data sources become available.
create or replace function public.pp_log_retailer_price_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.published and new.display_permitted then
    if tg_op = 'INSERT' then
      insert into public.pp_retailer_price_history
        (product_id, retailer, price, availability, checked_at, source, display_permitted, verified_by)
      values
        (new.product_id, new.retailer, new.price, new.availability, new.checked_at,
         new.source, new.display_permitted, new.updated_by)
      on conflict (product_id, retailer, checked_at) do nothing;
    elsif new.checked_at is distinct from old.checked_at or
          new.price is distinct from old.price or
          new.availability is distinct from old.availability or
          new.source is distinct from old.source then
      insert into public.pp_retailer_price_history
        (product_id, retailer, price, availability, checked_at, source, display_permitted, verified_by)
      values
        (new.product_id, new.retailer, new.price, new.availability, new.checked_at,
         new.source, new.display_permitted, new.updated_by)
      on conflict (product_id, retailer, checked_at) do nothing;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.pp_log_retailer_price_history() from public, anon, authenticated;

drop trigger if exists pp_retailer_prices_history_log on public.pp_retailer_prices;
create trigger pp_retailer_prices_history_log
after insert or update on public.pp_retailer_prices
for each row execute function public.pp_log_retailer_price_history();
