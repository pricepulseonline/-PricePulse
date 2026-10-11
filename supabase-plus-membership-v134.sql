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
