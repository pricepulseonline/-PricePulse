-- ============================================================================
-- PricePulse V78.8.141 — FINAL Plus + Wallet + Referral + Rewards + Vouchers
-- One-file production backend migration.
-- Base UI: V78.8.140 (approved/locked).
--
-- IMPORTANT
-- 1) Run THIS file only for the Plus/Wallet stack. Do not separately run the
--    older supabase-plus-membership-v*.sql or supabase-wallet-rewards-v*.sql
--    drafts after this migration.
-- 2) Existing PricePulse Auth + public.pp_price_admins must already exist.
-- 3) Browser code must never contain a service_role key.
-- 4) Retailer reward campaigns remain disabled unless you explicitly enable
--    them after verifying affiliate/provider terms.
-- 5) The migration is written to be safely re-runnable for schema upgrades.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.pp_price_admins') IS NULL THEN
    RAISE EXCEPTION 'PricePulse prerequisite missing: public.pp_price_admins. Run the approved Admin/Catalog backend first.';
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- PART A — Wallet / referral / reward / redemption / voucher schema
-- --------------------------------------------------------------------------
-- PricePulse V78.8.137 — Wallet + Referral Reward + Redeem & Shop Engine
-- FINAL SQL DRAFT. Do not run until the complete Wallet UI/testing flow is approved.
-- Reward rule locked in this build:
--   Referrer target = ₹100
--   Friend welcome target = ₹100
--   Up to 50% of confirmed affiliate commission funds the combined ₹200 pair target.
--   Unlock stages: 10% -> 25% -> 50% -> 75% -> 100%.
--   No unlock until purchase confirmed + return/cancellation window clear + commission confirmed.
--   Self-referral and multiple referrers for the same friend are blocked.
-- Browser code never receives a service_role key.

create extension if not exists pgcrypto;

create table if not exists public.pp_wallet_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available_balance numeric(12,2) not null default 0 check (available_balance >= 0),
  pending_balance numeric(12,2) not null default 0 check (pending_balance >= 0),
  redemption_pending numeric(12,2) not null default 0 check (redemption_pending >= 0),
  lifetime_earned numeric(12,2) not null default 0 check (lifetime_earned >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.pp_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null default 'shopping_reward',
  title text not null default 'PricePulse Reward',
  retailer text,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','available','used','reversed','cancelled')),
  target_amount numeric(12,2),
  unlocked_amount numeric(12,2),
  source_ref text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pp_wallet_transactions_user_created_idx on public.pp_wallet_transactions(user_id,created_at desc);
create unique index if not exists pp_wallet_transactions_user_source_uidx on public.pp_wallet_transactions(user_id,source_ref) where source_ref is not null;

create table if not exists public.pp_referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pp_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  status text not null default 'joined',
  referrer_target numeric(12,2) not null default 100,
  referrer_unlocked numeric(12,2) not null default 0,
  friend_target numeric(12,2) not null default 100,
  friend_unlocked numeric(12,2) not null default 0,
  shopping_started boolean not null default false,
  first_eligible_purchase_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pp_referrals add column if not exists first_eligible_purchase_at timestamptz;
create index if not exists pp_referrals_referrer_idx on public.pp_referrals(referrer_user_id,created_at desc);
create unique index if not exists pp_referrals_one_referrer_per_friend_uidx on public.pp_referrals(referred_user_id) where referred_user_id is not null;

create table if not exists public.pp_referral_purchase_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.pp_referrals(id) on delete cascade,
  order_ref text not null,
  retailer text,
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  purchase_confirmed boolean not null default false,
  return_window_clear boolean not null default false,
  commission_confirmed boolean not null default false,
  reversed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(referral_id,order_ref)
);
create index if not exists pp_referral_purchase_events_referral_idx on public.pp_referral_purchase_events(referral_id,created_at desc);

create table if not exists public.pp_reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  retailer text not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'requested' check (status in ('requested','locked','issued','failed','cancelled')),
  tracking_ref text,
  voucher_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pp_campaign_reward_rules (
  id bigint generated by default as identity primary key,
  affiliate_provider text not null,
  retailer text not null,
  campaign_key text,
  rewards_allowed boolean not null default false,
  referrals_allowed boolean not null default false,
  gift_card_payment_commission_eligible boolean not null default false,
  subid_supported boolean not null default false,
  reward_share_percent numeric(5,2) not null default 0 check (reward_share_percent between 0 and 100),
  max_reward numeric(12,2),
  hold_days integer not null default 0 check (hold_days >= 0),
  active boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(affiliate_provider,retailer,campaign_key)
);

alter table public.pp_wallet_accounts enable row level security;
alter table public.pp_wallet_transactions enable row level security;
alter table public.pp_referral_codes enable row level security;
alter table public.pp_referrals enable row level security;
alter table public.pp_referral_purchase_events enable row level security;
alter table public.pp_reward_redemptions enable row level security;
alter table public.pp_campaign_reward_rules enable row level security;

-- Customer reads only. Credits/debits and purchase confirmations are trusted backend/admin writes.
drop policy if exists "wallet account own read" on public.pp_wallet_accounts;
create policy "wallet account own read" on public.pp_wallet_accounts for select using (auth.uid() = user_id);
drop policy if exists "wallet transactions own read" on public.pp_wallet_transactions;
create policy "wallet transactions own read" on public.pp_wallet_transactions for select using (auth.uid() = user_id);
drop policy if exists "referral code own read" on public.pp_referral_codes;
create policy "referral code own read" on public.pp_referral_codes for select using (auth.uid() = user_id);
drop policy if exists "referrals own read" on public.pp_referrals;
create policy "referrals own read" on public.pp_referrals for select using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);
drop policy if exists "referral purchase event own read" on public.pp_referral_purchase_events;
create policy "referral purchase event own read" on public.pp_referral_purchase_events for select using (
  exists(select 1 from public.pp_referrals r where r.id=referral_id and (r.referrer_user_id=auth.uid() or r.referred_user_id=auth.uid()))
);
drop policy if exists "redemptions own read" on public.pp_reward_redemptions;
create policy "redemptions own read" on public.pp_reward_redemptions for select using (auth.uid() = user_id);
drop policy if exists "campaign rules public active read" on public.pp_campaign_reward_rules;
create policy "campaign rules public active read" on public.pp_campaign_reward_rules for select using (active = true);

-- Internal deterministic code provisioner for any user.
create or replace function public.pp_wallet_referral_code_for_user(target_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
  candidate text;
  clean_id text := replace(target_user::text,'-','');
  n integer;
begin
  if target_user is null then raise exception 'User required'; end if;
  select code into existing_code from public.pp_referral_codes where user_id=target_user;
  if existing_code is not null then return existing_code; end if;

  foreach n in array array[8,12,16,20,32] loop
    candidate := 'PULSE' || upper(substr(clean_id,1,n));
    if not exists(select 1 from public.pp_referral_codes where code=candidate and user_id<>target_user) then
      insert into public.pp_referral_codes(user_id,code,updated_at)
      values(target_user,candidate,now())
      on conflict (user_id) do update set updated_at=excluded.updated_at
      returning code into existing_code;
      return existing_code;
    end if;
  end loop;
  raise exception 'Could not create referral code';
end;
$$;
revoke all on function public.pp_wallet_referral_code_for_user(uuid) from public, anon, authenticated;

-- Customer-facing safe code getter.
create or replace function public.pp_get_or_create_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  return public.pp_wallet_referral_code_for_user(auth.uid());
end;
$$;
revoke all on function public.pp_get_or_create_referral_code() from public, anon;
grant execute on function public.pp_get_or_create_referral_code() to authenticated;

-- 50% of commission funds a combined ₹200 pair target; snap to approved unlock stages.
create or replace function public.pp_wallet_reward_fraction(total_confirmed_commission numeric)
returns numeric
language sql
immutable
as $$
  select case
    when greatest(coalesce(total_confirmed_commission,0),0) * 0.5 / 200 >= 1 then 1
    when greatest(coalesce(total_confirmed_commission,0),0) * 0.5 / 200 >= 0.75 then 0.75
    when greatest(coalesce(total_confirmed_commission,0),0) * 0.5 / 200 >= 0.50 then 0.50
    when greatest(coalesce(total_confirmed_commission,0),0) * 0.5 / 200 >= 0.25 then 0.25
    when greatest(coalesce(total_confirmed_commission,0),0) * 0.5 / 200 >= 0.10 then 0.10
    else 0
  end;
$$;
revoke all on function public.pp_wallet_reward_fraction(numeric) from public, anon, authenticated;

create or replace function public.pp_wallet_ensure_reward_rows(target_referral uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.pp_referrals;
begin
  select * into r from public.pp_referrals where id=target_referral;
  if r.id is null then raise exception 'Referral not found'; end if;

  insert into public.pp_wallet_accounts(user_id) values(r.referrer_user_id) on conflict (user_id) do nothing;
  if r.referred_user_id is not null then insert into public.pp_wallet_accounts(user_id) values(r.referred_user_id) on conflict (user_id) do nothing; end if;

  insert into public.pp_wallet_transactions(user_id,entry_type,title,amount,status,target_amount,unlocked_amount,source_ref,note)
  select r.referrer_user_id,'referral_reward','Referral Reward',0,'pending',100,0,'ref:'||r.id::text||':referrer','₹100 target · waiting for eligible confirmed shopping.'
  where not exists(select 1 from public.pp_wallet_transactions where user_id=r.referrer_user_id and source_ref='ref:'||r.id::text||':referrer');

  if r.referred_user_id is not null then
    insert into public.pp_wallet_transactions(user_id,entry_type,title,amount,status,target_amount,unlocked_amount,source_ref,note)
    select r.referred_user_id,'welcome_referral_reward','Welcome Reward',0,'pending',100,0,'ref:'||r.id::text||':friend','₹100 welcome target · waiting for eligible confirmed shopping.'
    where not exists(select 1 from public.pp_wallet_transactions where user_id=r.referred_user_id and source_ref='ref:'||r.id::text||':friend');
  end if;
end;
$$;
revoke all on function public.pp_wallet_ensure_reward_rows(uuid) from public, anon, authenticated;

create or replace function public.pp_wallet_refresh_account(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  earned numeric := 0;
  pending numeric := 0;
  locked numeric := 0;
  spent numeric := 0;
begin
  select
    coalesce(sum(case when status not in ('reversed','cancelled') and entry_type<>'redemption' then greatest(coalesce(unlocked_amount,amount,0),0) else 0 end),0),
    coalesce(sum(case when status not in ('reversed','cancelled') and entry_type<>'redemption' then greatest(coalesce(target_amount,0)-greatest(coalesce(unlocked_amount,amount,0),0),0) else 0 end),0)
  into earned,pending
  from public.pp_wallet_transactions where user_id=target_user;

  select coalesce(sum(case when status in ('requested','locked') then amount else 0 end),0),
         coalesce(sum(case when status='issued' then amount else 0 end),0)
  into locked,spent
  from public.pp_reward_redemptions where user_id=target_user;

  insert into public.pp_wallet_accounts(user_id,available_balance,pending_balance,redemption_pending,lifetime_earned,updated_at)
  values(target_user,greatest(earned-locked-spent,0),greatest(pending,0),greatest(locked,0),greatest(earned,0),now())
  on conflict (user_id) do update set
    available_balance=excluded.available_balance,
    pending_balance=excluded.pending_balance,
    redemption_pending=excluded.redemption_pending,
    lifetime_earned=excluded.lifetime_earned,
    updated_at=excluded.updated_at;
end;
$$;
revoke all on function public.pp_wallet_refresh_account(uuid) from public, anon, authenticated;

create or replace function public.pp_wallet_recalculate_referral(target_referral uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.pp_referrals;
  total_commission numeric := 0;
  fraction numeric := 0;
  each_unlock numeric := 0;
  started boolean := false;
  eligible_order text;
begin
  select * into r from public.pp_referrals where id=target_referral;
  if r.id is null then raise exception 'Referral not found'; end if;
  perform public.pp_wallet_ensure_reward_rows(target_referral);

  select coalesce(sum(commission_amount),0)
  into total_commission
  from public.pp_referral_purchase_events
  where referral_id=target_referral
    and purchase_confirmed=true
    and return_window_clear=true
    and commission_confirmed=true
    and reversed=false;

  select exists(select 1 from public.pp_referral_purchase_events where referral_id=target_referral and purchase_confirmed=true and reversed=false) into started;
  select order_ref into eligible_order from public.pp_referral_purchase_events
   where referral_id=target_referral and purchase_confirmed=true and return_window_clear=true and commission_confirmed=true and reversed=false
   order by created_at asc limit 1;

  fraction := public.pp_wallet_reward_fraction(total_commission);
  each_unlock := round(100 * fraction,2);

  update public.pp_referrals
     set shopping_started=started,
         referrer_unlocked=each_unlock,
         friend_unlocked=each_unlock,
         status=case when each_unlock>=100 then 'reward_unlocked' when started then 'shopping_started' else 'joined' end,
         first_eligible_purchase_at=case when eligible_order is not null then coalesce(first_eligible_purchase_at,now()) else first_eligible_purchase_at end,
         updated_at=now()
   where id=target_referral;

  update public.pp_wallet_transactions
     set amount=each_unlock,
         unlocked_amount=each_unlock,
         target_amount=100,
         status=case when each_unlock>0 then 'available' else 'pending' end,
         note=case
           when each_unlock>=100 then '₹100 reward fully unlocked.'
           when each_unlock>0 then '₹'||trim(to_char(each_unlock,'FM999999990.00'))||' unlocked · ₹'||trim(to_char(100-each_unlock,'FM999999990.00'))||' still pending.'
           else 'Waiting for purchase + return-clear + confirmed commission.'
         end,
         updated_at=now()
   where (user_id=r.referrer_user_id and source_ref='ref:'||r.id::text||':referrer')
      or (user_id=r.referred_user_id and source_ref='ref:'||r.id::text||':friend');

  perform public.pp_wallet_refresh_account(r.referrer_user_id);
  if r.referred_user_id is not null then perform public.pp_wallet_refresh_account(r.referred_user_id); end if;

  -- If the Plus backend is installed, the first fully eligible confirmed purchase also activates
  -- an already-claimed Plus membership for exactly 1 year. Master Plus state is unaffected.
  if eligible_order is not null and r.referred_user_id is not null
     and to_regprocedure('public.pp_activate_plus_after_eligible_purchase(uuid,text)') is not null then
    execute 'select public.pp_activate_plus_after_eligible_purchase($1,$2)' using r.referred_user_id,eligible_order;
  end if;
end;
$$;
revoke all on function public.pp_wallet_recalculate_referral(uuid) from public, anon, authenticated;

-- Customer claims the referral after authentication/profile completion.
create or replace function public.pp_claim_referral(input_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  clean_code text := upper(trim(coalesce(input_code,'')));
  owner_id uuid;
  existing public.pp_referrals;
  new_ref public.pp_referrals;
begin
  if me is null then raise exception 'Sign in required'; end if;
  if clean_code !~ '^PULSE[A-Z0-9-]{6,32}$' then return jsonb_build_object('status','invalid_code'); end if;
  select user_id into owner_id from public.pp_referral_codes where code=clean_code;
  if owner_id is null then return jsonb_build_object('status','invalid_code'); end if;
  if owner_id=me then return jsonb_build_object('status','self_referral_blocked'); end if;

  select * into existing from public.pp_referrals where referred_user_id=me limit 1;
  if existing.id is not null then
    return jsonb_build_object('status','already_referred','same_referrer',existing.referrer_user_id=owner_id);
  end if;

  insert into public.pp_referrals(referrer_user_id,referred_user_id,referral_code,status,referrer_target,friend_target)
  values(owner_id,me,clean_code,'joined',100,100)
  returning * into new_ref;
  perform public.pp_wallet_ensure_reward_rows(new_ref.id);
  perform public.pp_wallet_refresh_account(owner_id);
  perform public.pp_wallet_refresh_account(me);
  return jsonb_build_object('status','joined','referral_id',new_ref.id,'referrer_target',100,'friend_target',100);
end;
$$;
revoke all on function public.pp_claim_referral(text) from public, anon;
grant execute on function public.pp_claim_referral(text) to authenticated;

-- Trusted production/event-ingestion function. Call from a server/service integration, never from public browser code.
create or replace function public.pp_record_referral_purchase_event(
  referred_user uuid,
  order_reference text,
  commission_value numeric,
  purchase_is_confirmed boolean,
  return_is_clear boolean,
  commission_is_confirmed boolean,
  is_reversed boolean default false,
  retailer_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.pp_referrals; ev public.pp_referral_purchase_events;
begin
  select * into r from public.pp_referrals where referred_user_id=referred_user limit 1;
  if r.id is null then return jsonb_build_object('status','no_referral'); end if;
  if trim(coalesce(order_reference,''))='' then raise exception 'Order reference required'; end if;

  insert into public.pp_referral_purchase_events(referral_id,order_ref,retailer,commission_amount,purchase_confirmed,return_window_clear,commission_confirmed,reversed,updated_at)
  values(r.id,trim(order_reference),nullif(trim(coalesce(retailer_name,'')),''),greatest(coalesce(commission_value,0),0),coalesce(purchase_is_confirmed,false),coalesce(return_is_clear,false),coalesce(commission_is_confirmed,false),coalesce(is_reversed,false),now())
  on conflict (referral_id,order_ref) do update set
    retailer=coalesce(excluded.retailer,public.pp_referral_purchase_events.retailer),
    commission_amount=excluded.commission_amount,
    purchase_confirmed=excluded.purchase_confirmed,
    return_window_clear=excluded.return_window_clear,
    commission_confirmed=excluded.commission_confirmed,
    reversed=excluded.reversed,
    updated_at=now()
  returning * into ev;

  perform public.pp_wallet_recalculate_referral(r.id);
  return jsonb_build_object('status','processed','referral_id',r.id,'event_id',ev.id);
end;
$$;
revoke all on function public.pp_record_referral_purchase_event(uuid,text,numeric,boolean,boolean,boolean,boolean,text) from public, anon, authenticated;
grant execute on function public.pp_record_referral_purchase_event(uuid,text,numeric,boolean,boolean,boolean,boolean,text) to service_role;

-- ------------------------- Admin test helpers -------------------------
create or replace function public.pp_admin_wallet_get_test_state(referrer_user uuid,referred_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.pp_referrals;
  events jsonb := '[]'::jsonb;
  total_commission numeric := 0;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then raise exception 'PricePulse admin access required'; end if;
  select * into r from public.pp_referrals where referrer_user_id=referrer_user and referred_user_id=referred_user limit 1;
  if r.id is null then return jsonb_build_object('referral',null,'events','[]'::jsonb,'total_commission',0,'pool',0); end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at),'[]'::jsonb),
         coalesce(sum(case when e.purchase_confirmed and e.return_window_clear and e.commission_confirmed and not e.reversed then e.commission_amount else 0 end),0)
    into events,total_commission
    from public.pp_referral_purchase_events e where e.referral_id=r.id;
  return jsonb_build_object('referral',to_jsonb(r),'events',events,'total_commission',total_commission,'pool',total_commission*.5);
end;
$$;
revoke all on function public.pp_admin_wallet_get_test_state(uuid,uuid) from public, anon;
grant execute on function public.pp_admin_wallet_get_test_state(uuid,uuid) to authenticated;

create or replace function public.pp_admin_wallet_create_test_referral(referrer_user uuid,referred_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  code_value text;
  r public.pp_referrals;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then raise exception 'PricePulse admin access required'; end if;
  if referrer_user is null or referred_user is null then raise exception 'Both users are required'; end if;
  if referrer_user=referred_user then raise exception 'Self-referral is not allowed'; end if;
  if exists(select 1 from public.pp_referrals where referred_user_id=referred_user and referrer_user_id<>referrer_user) then raise exception 'This friend is already linked to another referrer'; end if;

  code_value := public.pp_wallet_referral_code_for_user(referrer_user);
  select * into r from public.pp_referrals where referrer_user_id=referrer_user and referred_user_id=referred_user limit 1;
  if r.id is null then
    insert into public.pp_referrals(referrer_user_id,referred_user_id,referral_code,status,referrer_target,friend_target)
    values(referrer_user,referred_user,code_value,'joined',100,100) returning * into r;
  end if;
  perform public.pp_wallet_ensure_reward_rows(r.id);
  perform public.pp_wallet_recalculate_referral(r.id);
  return public.pp_admin_wallet_get_test_state(referrer_user,referred_user);
end;
$$;
revoke all on function public.pp_admin_wallet_create_test_referral(uuid,uuid) from public, anon;
grant execute on function public.pp_admin_wallet_create_test_referral(uuid,uuid) to authenticated;

create or replace function public.pp_admin_wallet_update_test_purchase(
  referrer_user uuid,
  referred_user uuid,
  order_reference text,
  stage_name text,
  commission_value numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.pp_referrals;
  ev public.pp_referral_purchase_events;
  stage text := lower(trim(coalesce(stage_name,'')));
  order_key text := trim(coalesce(order_reference,''));
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then raise exception 'PricePulse admin access required'; end if;
  if order_key='' then raise exception 'Order reference required'; end if;
  if stage not in ('purchase','return_clear','commission','reverse') then raise exception 'Invalid test stage'; end if;
  select * into r from public.pp_referrals where referrer_user_id=referrer_user and referred_user_id=referred_user limit 1;
  if r.id is null then raise exception 'Create the referral first'; end if;

  insert into public.pp_referral_purchase_events(referral_id,order_ref,updated_at)
  values(r.id,order_key,now())
  on conflict (referral_id,order_ref) do update set updated_at=now()
  returning * into ev;

  if stage='purchase' then
    update public.pp_referral_purchase_events set purchase_confirmed=true,reversed=false,updated_at=now() where id=ev.id;
  elsif stage='return_clear' then
    update public.pp_referral_purchase_events set return_window_clear=true,reversed=false,updated_at=now() where id=ev.id;
  elsif stage='commission' then
    update public.pp_referral_purchase_events set commission_amount=greatest(coalesce(commission_value,0),0),commission_confirmed=true,reversed=false,updated_at=now() where id=ev.id;
  elsif stage='reverse' then
    update public.pp_referral_purchase_events set reversed=true,updated_at=now() where id=ev.id;
  end if;

  perform public.pp_wallet_recalculate_referral(r.id);
  return public.pp_admin_wallet_get_test_state(referrer_user,referred_user);
end;
$$;
revoke all on function public.pp_admin_wallet_update_test_purchase(uuid,uuid,text,text,numeric) from public, anon;
grant execute on function public.pp_admin_wallet_update_test_purchase(uuid,uuid,text,text,numeric) to authenticated;

-- Final refresh for any existing rows if this upgrade is run over the old foundation.
do $$
declare r record;
begin
  for r in select id from public.pp_referrals loop
    perform public.pp_wallet_ensure_reward_rows(r.id);
    perform public.pp_wallet_recalculate_referral(r.id);
  end loop;
end $$;


-- V78.8.137 — customer reward redemption flow.
alter table public.pp_reward_redemptions add column if not exists expires_at timestamptz;
create unique index if not exists pp_reward_redemptions_tracking_ref_uidx on public.pp_reward_redemptions(tracking_ref) where tracking_ref is not null;

create or replace function public.pp_wallet_start_redemption(target_retailer text,target_amount numeric)
returns public.pp_reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acct public.pp_wallet_accounts;
  outrow public.pp_reward_redemptions;
  tracking text;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if target_retailer is null or btrim(target_retailer)='' then raise exception 'Retailer required'; end if;
  if coalesce(target_amount,0)<=0 then raise exception 'Reward amount must be greater than zero'; end if;

  if not exists(select 1 from public.pp_campaign_reward_rules where lower(retailer)=lower(target_retailer) and active=true and rewards_allowed=true and subid_supported=true) then
    raise exception 'Reward redemption is not enabled for this retailer campaign';
  end if;

  perform public.pp_wallet_refresh_account(uid);
  select * into acct from public.pp_wallet_accounts where user_id=uid for update;
  if acct.available_balance < target_amount then raise exception 'Insufficient available reward balance'; end if;

  tracking := 'PP-' || upper(regexp_replace(target_retailer,'[^a-zA-Z0-9]','','g')) || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  insert into public.pp_reward_redemptions(user_id,retailer,amount,status,tracking_ref,created_at,updated_at,expires_at)
  values(uid,btrim(target_retailer),round(target_amount,2),'locked',tracking,now(),now(),now()+interval '30 minutes')
  returning * into outrow;

  insert into public.pp_wallet_transactions(user_id,entry_type,title,retailer,amount,status,target_amount,unlocked_amount,source_ref,note)
  values(uid,'redemption',btrim(target_retailer)||' Reward Redemption',btrim(target_retailer),-round(target_amount,2),'pending',round(target_amount,2),round(target_amount,2),'redeem:'||outrow.id::text,'Reward locked • fresh tracking '||tracking);

  perform public.pp_wallet_refresh_account(uid);
  return outrow;
end;
$$;
revoke all on function public.pp_wallet_start_redemption(text,numeric) from public,anon;
grant execute on function public.pp_wallet_start_redemption(text,numeric) to authenticated;

create or replace function public.pp_wallet_cancel_redemption(redemption_id uuid)
returns public.pp_reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  outrow public.pp_reward_redemptions;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into outrow from public.pp_reward_redemptions where id=redemption_id and user_id=uid for update;
  if outrow.id is null then raise exception 'Redemption not found'; end if;
  if outrow.status not in ('requested','locked') then raise exception 'This redemption can no longer be released'; end if;
  update public.pp_reward_redemptions set status='cancelled',updated_at=now() where id=outrow.id returning * into outrow;
  update public.pp_wallet_transactions set status='cancelled',note=coalesce(note,'')||' • reward released',updated_at=now() where user_id=uid and source_ref='redeem:'||outrow.id::text;
  perform public.pp_wallet_refresh_account(uid);
  return outrow;
end;
$$;
revoke all on function public.pp_wallet_cancel_redemption(uuid) from public,anon;
grant execute on function public.pp_wallet_cancel_redemption(uuid) to authenticated;

-- Authorized admin/provider callback after a real voucher is issued.
create or replace function public.pp_admin_wallet_issue_redemption(redemption_id uuid,voucher_reference text)
returns public.pp_reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare outrow public.pp_reward_redemptions;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then raise exception 'PricePulse admin access required'; end if;
  if coalesce(btrim(voucher_reference),'')='' then raise exception 'Voucher reference required'; end if;
  select * into outrow from public.pp_reward_redemptions where id=redemption_id for update;
  if outrow.id is null then raise exception 'Redemption not found'; end if;
  if outrow.status not in ('requested','locked') then raise exception 'Redemption is not waiting for issuance'; end if;
  update public.pp_reward_redemptions set status='issued',voucher_ref=btrim(voucher_reference),updated_at=now() where id=outrow.id returning * into outrow;
  update public.pp_wallet_transactions set status='used',note=outrow.retailer||' voucher issued • '||btrim(voucher_reference),updated_at=now() where user_id=outrow.user_id and source_ref='redeem:'||outrow.id::text;
  perform public.pp_wallet_refresh_account(outrow.user_id);
  return outrow;
end;
$$;
revoke all on function public.pp_admin_wallet_issue_redemption(uuid,text) from public,anon;
grant execute on function public.pp_admin_wallet_issue_redemption(uuid,text) to authenticated;


-- V78.8.138 — My Vouchers + manual/provider voucher lifecycle.
alter table public.pp_reward_redemptions add column if not exists voucher_source text;
alter table public.pp_reward_redemptions add column if not exists voucher_issued_at timestamptz;
alter table public.pp_reward_redemptions add column if not exists voucher_expires_at timestamptz;
alter table public.pp_reward_redemptions add column if not exists voucher_used_at timestamptz;

create or replace function public.pp_admin_wallet_issue_voucher_v138(
  redemption_id uuid,
  voucher_reference text,
  voucher_expiry timestamptz default null,
  voucher_source_value text default 'manual'
)
returns public.pp_reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare outrow public.pp_reward_redemptions;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then raise exception 'PricePulse admin access required'; end if;
  if coalesce(btrim(voucher_reference),'')='' then raise exception 'Voucher reference required'; end if;
  select * into outrow from public.pp_reward_redemptions where id=redemption_id for update;
  if outrow.id is null then raise exception 'Redemption not found'; end if;
  if outrow.status not in ('requested','locked','issued') then raise exception 'Redemption is not eligible for issuance'; end if;
  update public.pp_reward_redemptions
     set status='issued',voucher_ref=btrim(voucher_reference),voucher_source=coalesce(nullif(btrim(voucher_source_value),''),'manual'),
         voucher_issued_at=coalesce(voucher_issued_at,now()),voucher_expires_at=voucher_expiry,voucher_used_at=null,updated_at=now()
   where id=outrow.id returning * into outrow;
  update public.pp_wallet_transactions
     set status='used',note=outrow.retailer||' voucher issued • '||btrim(voucher_reference),updated_at=now()
   where user_id=outrow.user_id and source_ref='redeem:'||outrow.id::text;
  perform public.pp_wallet_refresh_account(outrow.user_id);
  return outrow;
end;
$$;
revoke all on function public.pp_admin_wallet_issue_voucher_v138(uuid,text,timestamptz,text) from public,anon;
grant execute on function public.pp_admin_wallet_issue_voucher_v138(uuid,text,timestamptz,text) to authenticated;

create or replace function public.pp_admin_wallet_mark_voucher_used_v138(redemption_id uuid)
returns public.pp_reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare outrow public.pp_reward_redemptions;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then raise exception 'PricePulse admin access required'; end if;
  select * into outrow from public.pp_reward_redemptions where id=redemption_id for update;
  if outrow.id is null then raise exception 'Redemption not found'; end if;
  if outrow.status <> 'issued' or outrow.voucher_ref is null then raise exception 'Voucher is not issued'; end if;
  update public.pp_reward_redemptions set voucher_used_at=now(),updated_at=now() where id=outrow.id returning * into outrow;
  return outrow;
end;
$$;
revoke all on function public.pp_admin_wallet_mark_voucher_used_v138(uuid) from public,anon;
grant execute on function public.pp_admin_wallet_mark_voucher_used_v138(uuid) to authenticated;


-- --------------------------------------------------------------------------
-- PART B — PricePulse Plus membership + Master override
-- --------------------------------------------------------------------------
-- PricePulse V78.8.131 — FINAL Plus membership backend foundation
-- Run later when the Plus UI/workflow is approved. Do NOT expose a service_role key in browser code.
-- Recommended order when enabling backend data:
--   1) existing auth/profiles + admin allowlist
--   2) supabase-wallet-rewards-v0.1.sql (if Wallet confirmed-shopping events are used)
--   3) this file

create table if not exists public.pp_plus_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'available' check (status in ('available','pending','active','expired')),
  claimed_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz,
  activation_source text,
  activation_ref text,
  activated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.pp_plus_memberships add column if not exists activation_source text;
alter table public.pp_plus_memberships add column if not exists activation_ref text;
alter table public.pp_plus_memberships add column if not exists activated_by uuid references auth.users(id) on delete set null;

alter table public.pp_plus_memberships enable row level security;

drop policy if exists "Users can read own Plus membership" on public.pp_plus_memberships;
create policy "Users can read own Plus membership"
on public.pp_plus_memberships for select
using (auth.uid() = user_id);

drop policy if exists "Users can claim own Plus membership" on public.pp_plus_memberships;
create policy "Users can claim own Plus membership"
on public.pp_plus_memberships for insert
with check (
  auth.uid() = user_id
  and status = 'pending'
  and activated_at is null
  and expires_at is null
);

drop policy if exists "Users can move own Plus claim to pending" on public.pp_plus_memberships;
create policy "Users can move own Plus claim to pending"
on public.pp_plus_memberships for update
using (auth.uid() = user_id and status = 'available')
with check (
  auth.uid() = user_id
  and status = 'pending'
  and activated_at is null
  and expires_at is null
);

-- Internal trusted activation primitive. It activates ONLY a pending claim and always gives exactly 1 year.
create or replace function public.pp_activate_plus_after_eligible_purchase(target_user uuid, purchase_ref text default null)
returns public.pp_plus_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.pp_plus_memberships;
  now_ts timestamptz := now();
begin
  insert into public.pp_plus_memberships(user_id,status,claimed_at,activated_at,expires_at,activation_source,activation_ref,updated_at)
  values(target_user,'available',null,null,null,null,null,now_ts)
  on conflict (user_id) do nothing;

  update public.pp_plus_memberships
     set status='active',
         activated_at=now_ts,
         expires_at=now_ts + interval '1 year',
         activation_source='eligible_purchase',
         activation_ref=nullif(purchase_ref,''),
         activated_by=null,
         updated_at=now_ts
   where user_id=target_user
     and status='pending'
  returning * into result;

  if result.user_id is null then
    select * into result from public.pp_plus_memberships where user_id=target_user;
  end if;
  return result;
end;
$$;

-- Customers must never be able to call the trusted activation primitive themselves.
revoke all on function public.pp_activate_plus_after_eligible_purchase(uuid,text) from public, anon, authenticated;
grant execute on function public.pp_activate_plus_after_eligible_purchase(uuid,text) to service_role;

-- Optional automatic bridge: a confirmed eligible shopping reward = eligible purchase confirmed.
-- This trigger is installed only if the Wallet transaction table already exists.
create or replace function public.pp_plus_wallet_confirm_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status='available'
     and coalesce(new.entry_type,'')='shopping_reward'
     and coalesce(new.amount,0)>0 then
    if tg_op='INSERT' then
      perform public.pp_activate_plus_after_eligible_purchase(new.user_id,coalesce(new.source_ref,new.id::text));
    elsif old.status is distinct from 'available' then
      perform public.pp_activate_plus_after_eligible_purchase(new.user_id,coalesce(new.source_ref,new.id::text));
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.pp_plus_wallet_confirm_trigger() from public, anon, authenticated;

DO $$
begin
  if to_regclass('public.pp_wallet_transactions') is not null then
    execute 'drop trigger if exists pp_plus_activate_on_confirmed_purchase on public.pp_wallet_transactions';
    execute 'create trigger pp_plus_activate_on_confirmed_purchase after insert or update of status on public.pp_wallet_transactions for each row execute function public.pp_plus_wallet_confirm_trigger()';
  end if;
end $$;

-- Protected admin read helper used by Admin Dashboard.
create or replace function public.pp_admin_get_plus_membership(target_user uuid)
returns setof public.pp_plus_memberships
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  return query
  select * from public.pp_plus_memberships where user_id=target_user;
end;
$$;
revoke all on function public.pp_admin_get_plus_membership(uuid) from public, anon;
grant execute on function public.pp_admin_get_plus_membership(uuid) to authenticated;

-- Protected manual Activate / Deactivate control for testing/support.
-- Deactivate intentionally returns an existing claim to PENDING, so the normal account UI returns while the claim is preserved.
create or replace function public.pp_admin_set_plus_membership(target_user uuid, make_active boolean)
returns public.pp_plus_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.pp_plus_memberships;
  now_ts timestamptz := now();
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;

  insert into public.pp_plus_memberships(user_id,status,claimed_at,updated_at)
  values(target_user,'pending',now_ts,now_ts)
  on conflict (user_id) do nothing;

  if make_active then
    update public.pp_plus_memberships
       set status='active',
           claimed_at=coalesce(claimed_at,now_ts),
           activated_at=now_ts,
           expires_at=now_ts + interval '1 year',
           activation_source='admin_manual',
           activation_ref=null,
           activated_by=auth.uid(),
           updated_at=now_ts
     where user_id=target_user
     returning * into result;
  else
    update public.pp_plus_memberships
       set status='pending',
           claimed_at=coalesce(claimed_at,now_ts),
           activated_at=null,
           expires_at=null,
           activation_source='admin_manual_deactivated',
           activation_ref=null,
           activated_by=auth.uid(),
           updated_at=now_ts
     where user_id=target_user
     returning * into result;
  end if;

  return result;
end;
$$;
revoke all on function public.pp_admin_set_plus_membership(uuid,boolean) from public, anon;
grant execute on function public.pp_admin_set_plus_membership(uuid,boolean) to authenticated;

-- Keep stored active memberships self-consistent if time has passed.
update public.pp_plus_memberships
set status='expired',updated_at=now()
where status='active' and expires_at is not null and expires_at<=now();

-- =============================================================
-- V78.8.134 additions — selected-user identity + Master Plus control with explicit Individual Mode
-- Keep this file for the FINAL backend install. Do not run until the UI/workflow is approved.
-- =============================================================

create table if not exists public.pp_plus_master_control (
  id boolean primary key default true check (id = true),
  mode text not null default 'individual' check (mode in ('individual','active','inactive')),
  activated_at timestamptz,
  expires_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.pp_plus_master_control(id,mode)
values(true,'individual')
on conflict (id) do nothing;

alter table public.pp_plus_master_control enable row level security;

-- Authenticated users read the safe global mode only through this function.
create or replace function public.pp_get_plus_master_control()
returns table(mode text, activated_at timestamptz, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select
    case
      when c.mode='active' and c.expires_at is not null and c.expires_at<=now() then 'individual'
      else c.mode
    end as mode,
    c.activated_at,
    c.expires_at
  from public.pp_plus_master_control c
  where c.id=true;
$$;
revoke all on function public.pp_get_plus_master_control() from public, anon;
grant execute on function public.pp_get_plus_master_control() to authenticated;

-- Admin-only global read helper.
create or replace function public.pp_admin_get_plus_master_control()
returns table(mode text, activated_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  return query select
    case when c.mode='active' and c.expires_at is not null and c.expires_at<=now() then 'individual' else c.mode end,
    case when c.mode='active' and c.expires_at is not null and c.expires_at<=now() then null else c.activated_at end,
    case when c.mode='active' and c.expires_at is not null and c.expires_at<=now() then null else c.expires_at end
  from public.pp_plus_master_control c where c.id=true;
end;
$$;
revoke all on function public.pp_admin_get_plus_master_control() from public, anon;
grant execute on function public.pp_admin_get_plus_master_control() to authenticated;

-- Admin-only global master switch with explicit Individual Mode.
-- active = force Plus ON for all signed-in users for exactly 1 year.
-- inactive = temporarily force Plus OFF system-wide WITHOUT mutating any user's own membership.
-- individual = remove the global override and restore each user's own Active/Pending/Available state.
create or replace function public.pp_admin_set_plus_master_mode(target_mode text)
returns table(mode text, activated_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  clean_mode text := lower(coalesce(target_mode,'individual'));
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  if clean_mode not in ('active','inactive','individual') then
    raise exception 'Invalid Plus master mode';
  end if;

  insert into public.pp_plus_master_control(id,mode,activated_at,expires_at,updated_by,updated_at)
  values(
    true,
    clean_mode,
    case when clean_mode='active' then now_ts else null end,
    case when clean_mode='active' then now_ts + interval '1 year' else null end,
    auth.uid(),
    now_ts
  )
  on conflict (id) do update set
    mode=excluded.mode,
    activated_at=excluded.activated_at,
    expires_at=excluded.expires_at,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;

  return query select c.mode,c.activated_at,c.expires_at from public.pp_plus_master_control c where c.id=true;
end;
$$;
revoke all on function public.pp_admin_set_plus_master_mode(text) from public, anon;
grant execute on function public.pp_admin_set_plus_master_mode(text) to authenticated;

-- Backward-compatible two-state helper retained for older admin builds.
create or replace function public.pp_admin_set_plus_master_control(make_active boolean)
returns table(mode text, activated_at timestamptz, expires_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select * from public.pp_admin_set_plus_master_mode(case when make_active then 'active' else 'inactive' end);
$$;
revoke all on function public.pp_admin_set_plus_master_control(boolean) from public, anon;
grant execute on function public.pp_admin_set_plus_master_control(boolean) to authenticated;

-- Admin-only identity helper so the dashboard clearly shows which customer is targeted.
create or replace function public.pp_admin_get_plus_user_identity(target_user uuid)
returns table(user_id uuid, full_name text, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;

  return query
  select u.id,
         coalesce(p.full_name, nullif(u.raw_user_meta_data->>'full_name',''), nullif(u.raw_user_meta_data->>'name',''), 'PricePulse user')::text,
         coalesce(p.email,u.email)::text
  from auth.users u
  left join public.profiles p on p.id=u.id
  where u.id=target_user;
end;
$$;
revoke all on function public.pp_admin_get_plus_user_identity(uuid) from public, anon;
grant execute on function public.pp_admin_get_plus_user_identity(uuid) to authenticated;


-- --------------------------------------------------------------------------
-- PART C — V78.8.141 production integration / hardening
-- --------------------------------------------------------------------------

-- Safe backend version marker used for support/debugging.
create table if not exists public.pp_backend_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into public.pp_backend_meta(key,value,updated_at)
values('plus_wallet_schema_version','78.8.141',now())
on conflict (key) do update set value=excluded.value,updated_at=excluded.updated_at;
alter table public.pp_backend_meta enable row level security;

create or replace function public.pp_get_plus_wallet_backend_version()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select value from public.pp_backend_meta where key='plus_wallet_schema_version'),'unknown');
$$;
revoke all on function public.pp_get_plus_wallet_backend_version() from public,anon;
grant execute on function public.pp_get_plus_wallet_backend_version() to authenticated;

-- Trusted generic purchase-confirmation bridge. This is the canonical hook for
-- future affiliate/feed ingestion when an eligible purchase is successfully
-- confirmed. It activates an already-claimed Plus membership for exactly 1 year.
create or replace function public.pp_confirm_eligible_purchase(target_user uuid,purchase_ref text default null)
returns public.pp_plus_memberships
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user is null then raise exception 'User required'; end if;
  return public.pp_activate_plus_after_eligible_purchase(target_user,purchase_ref);
end;
$$;
revoke all on function public.pp_confirm_eligible_purchase(uuid,text) from public,anon,authenticated;
grant execute on function public.pp_confirm_eligible_purchase(uuid,text) to service_role;

-- Reinstall the Wallet -> Plus bridge now that both sides definitely exist.
drop trigger if exists pp_plus_activate_on_confirmed_purchase on public.pp_wallet_transactions;
create trigger pp_plus_activate_on_confirmed_purchase
after insert or update of status on public.pp_wallet_transactions
for each row execute function public.pp_plus_wallet_confirm_trigger();

-- Production-safe manual voucher helper. Admin supplies a real authorized
-- retailer/provider code. If redemption_id is omitted, exactly one latest
-- eligible redemption matching user + retailer + amount is selected. No new
-- Wallet debit is created: the existing redeem:<id> transaction is fulfilled.
create or replace function public.pp_admin_wallet_issue_voucher_v141(
  target_user uuid,
  target_retailer text,
  target_amount numeric,
  voucher_reference text,
  voucher_expiry timestamptz default null,
  voucher_source_value text default 'manual',
  redemption_id uuid default null
)
returns public.pp_reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid := redemption_id;
  outrow public.pp_reward_redemptions;
  match_count integer := 0;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  if target_user is null then raise exception 'User UUID required'; end if;
  if coalesce(btrim(target_retailer),'')='' then raise exception 'Retailer required'; end if;
  if coalesce(target_amount,0)<=0 then raise exception 'Valid amount required'; end if;
  if coalesce(btrim(voucher_reference),'')='' then raise exception 'Voucher reference required'; end if;

  if rid is null then
    select count(*) into match_count
    from public.pp_reward_redemptions r
    where r.user_id=target_user
      and lower(r.retailer)=lower(btrim(target_retailer))
      and abs(r.amount-round(target_amount,2))<0.001
      and r.status in ('requested','locked','issued')
      and r.voucher_used_at is null;

    if match_count=0 then
      raise exception 'No matching locked redemption found. Start Redeem & Shop first or provide Redemption ID.';
    end if;
    if match_count>1 then
      raise exception 'Multiple matching redemptions found. Provide the exact Redemption ID.';
    end if;

    select r.id into rid
    from public.pp_reward_redemptions r
    where r.user_id=target_user
      and lower(r.retailer)=lower(btrim(target_retailer))
      and abs(r.amount-round(target_amount,2))<0.001
      and r.status in ('requested','locked','issued')
      and r.voucher_used_at is null
    order by r.created_at desc
    limit 1;
  end if;

  select * into outrow from public.pp_reward_redemptions where id=rid for update;
  if outrow.id is null then raise exception 'Redemption not found'; end if;
  if outrow.user_id<>target_user then raise exception 'Redemption belongs to a different user'; end if;
  if lower(outrow.retailer)<>lower(btrim(target_retailer)) then raise exception 'Retailer does not match the redemption'; end if;
  if abs(outrow.amount-round(target_amount,2))>=0.001 then raise exception 'Amount does not match the redemption'; end if;
  if outrow.status not in ('requested','locked','issued') then raise exception 'Redemption is not eligible for voucher issuance'; end if;

  update public.pp_reward_redemptions
     set status='issued',
         voucher_ref=btrim(voucher_reference),
         voucher_source=coalesce(nullif(btrim(voucher_source_value),''),'manual'),
         voucher_issued_at=coalesce(voucher_issued_at,now()),
         voucher_expires_at=voucher_expiry,
         voucher_used_at=null,
         updated_at=now()
   where id=outrow.id
   returning * into outrow;

  update public.pp_wallet_transactions
     set status='used',
         note=outrow.retailer||' voucher fulfilled • '||btrim(voucher_reference),
         updated_at=now()
   where user_id=outrow.user_id
     and source_ref='redeem:'||outrow.id::text;

  perform public.pp_wallet_refresh_account(outrow.user_id);
  return outrow;
end;
$$;
revoke all on function public.pp_admin_wallet_issue_voucher_v141(uuid,text,numeric,text,timestamptz,text,uuid) from public,anon;
grant execute on function public.pp_admin_wallet_issue_voucher_v141(uuid,text,numeric,text,timestamptz,text,uuid) to authenticated;

create or replace function public.pp_admin_wallet_mark_voucher_used_v141(
  target_user uuid,
  redemption_id uuid default null
)
returns public.pp_reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid := redemption_id;
  outrow public.pp_reward_redemptions;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  if target_user is null then raise exception 'User UUID required'; end if;

  if rid is null then
    select r.id into rid
    from public.pp_reward_redemptions r
    where r.user_id=target_user
      and r.status='issued'
      and r.voucher_ref is not null
      and r.voucher_used_at is null
    order by coalesce(r.voucher_issued_at,r.updated_at,r.created_at) desc
    limit 1;
  end if;

  if rid is null then raise exception 'No active issued voucher found for this user'; end if;
  select * into outrow from public.pp_reward_redemptions where id=rid for update;
  if outrow.id is null then raise exception 'Voucher redemption not found'; end if;
  if outrow.user_id<>target_user then raise exception 'Voucher belongs to a different user'; end if;
  if outrow.status<>'issued' or outrow.voucher_ref is null then raise exception 'Voucher is not issued'; end if;

  update public.pp_reward_redemptions
     set voucher_used_at=coalesce(voucher_used_at,now()),updated_at=now()
   where id=outrow.id
   returning * into outrow;
  return outrow;
end;
$$;
revoke all on function public.pp_admin_wallet_mark_voucher_used_v141(uuid,uuid) from public,anon;
grant execute on function public.pp_admin_wallet_mark_voucher_used_v141(uuid,uuid) to authenticated;

-- Safe starter rows. These are deliberately INACTIVE. Enable a retailer only
-- after affiliate/provider terms confirm rewards + SubID tracking are allowed.
insert into public.pp_campaign_reward_rules(affiliate_provider,retailer,campaign_key,rewards_allowed,referrals_allowed,gift_card_payment_commission_eligible,subid_supported,reward_share_percent,max_reward,hold_days,active,updated_at)
values
  ('UNCONFIGURED','Croma','default',false,false,false,false,0,null,0,false,now()),
  ('UNCONFIGURED','Myntra','default',false,false,false,false,0,null,0,false,now()),
  ('UNCONFIGURED','AJIO','default',false,false,false,false,0,null,0,false,now())
on conflict (affiliate_provider,retailer,campaign_key) do nothing;

-- Normalize stale Plus rows without ever using Master OFF to expire an
-- individual membership. Only the actual individual expires_at date expires it.
update public.pp_plus_memberships
set status='expired',updated_at=now()
where status='active' and expires_at is not null and expires_at<=now();

-- End V78.8.141 final backend migration.

-- V78.8.143 authenticated own-membership read helper (safe frontend RPC)
create or replace function public.pp_get_my_plus_membership()
returns table(status text, claimed_at timestamptz, activated_at timestamptz, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(m.status,'available')::text, m.claimed_at, m.activated_at, m.expires_at
  from (select auth.uid() as user_id) me
  left join public.pp_plus_memberships m on m.user_id = me.user_id
  where me.user_id is not null;
$$;
revoke all on function public.pp_get_my_plus_membership() from public, anon;
grant execute on function public.pp_get_my_plus_membership() to authenticated;
