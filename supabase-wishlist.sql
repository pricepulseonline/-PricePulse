-- PricePulse V19: account wishlist sync
create table if not exists public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.wishlist_items enable row level security;

drop policy if exists "Users can view own wishlist" on public.wishlist_items;
create policy "Users can view own wishlist"
on public.wishlist_items for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can add own wishlist" on public.wishlist_items;
create policy "Users can add own wishlist"
on public.wishlist_items for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own wishlist" on public.wishlist_items;
create policy "Users can delete own wishlist"
on public.wishlist_items for delete to authenticated
using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, delete on table public.wishlist_items to authenticated;
