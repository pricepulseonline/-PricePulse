-- PricePulse V76 — Preferences + Help & Support
-- Safe additive setup. Existing Wishlist/Auth/Deal Alerts tables are not modified.

create table if not exists public.pp_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'en-IN',
  notify_deal_alerts boolean not null default true,
  notify_target_reached boolean not null default true,
  notify_wishlist_updates boolean not null default true,
  email_important_deals boolean not null default true,
  preferred_retailer_scope text not null default 'any',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pp_user_preferences enable row level security;
drop policy if exists "Users can read own PricePulse preferences" on public.pp_user_preferences;
create policy "Users can read own PricePulse preferences" on public.pp_user_preferences for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own PricePulse preferences" on public.pp_user_preferences;
create policy "Users can insert own PricePulse preferences" on public.pp_user_preferences for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own PricePulse preferences" on public.pp_user_preferences;
create policy "Users can update own PricePulse preferences" on public.pp_user_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.pp_support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  category text not null default 'Other',
  message text not null,
  page_url text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pp_support_requests_user_created_idx on public.pp_support_requests(user_id, created_at desc);
alter table public.pp_support_requests enable row level security;
drop policy if exists "Users can submit own PricePulse support requests" on public.pp_support_requests;
create policy "Users can submit own PricePulse support requests" on public.pp_support_requests for insert with check (auth.uid() = user_id);
drop policy if exists "Users can read own PricePulse support requests" on public.pp_support_requests;
create policy "Users can read own PricePulse support requests" on public.pp_support_requests for select using (auth.uid() = user_id);
