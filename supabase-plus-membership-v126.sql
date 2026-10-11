-- PricePulse V78.8.126 — optional Plus membership state
-- Run when you are ready to persist claim/activation across devices.
create table if not exists public.pp_plus_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'available' check (status in ('available','pending','active','expired')),
  claimed_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.pp_plus_memberships enable row level security;
drop policy if exists "Users can read own Plus membership" on public.pp_plus_memberships;
create policy "Users can read own Plus membership" on public.pp_plus_memberships for select using (auth.uid() = user_id);
drop policy if exists "Users can claim own Plus membership" on public.pp_plus_memberships;
create policy "Users can claim own Plus membership" on public.pp_plus_memberships for insert with check (auth.uid() = user_id and status = 'pending');
-- Activation to active/expiry should be performed only by a trusted backend/admin flow after an eligible purchase is confirmed.
