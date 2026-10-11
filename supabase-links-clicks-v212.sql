-- PricePulse V212 — Affiliate settings, click counts, product demand
-- Run ONCE in Supabase SQL Editor (after supabase-hero-growth-v211.sql).
-- Safe to run again.

-- ---------------------------------------------------------------------------
-- 1) Site settings (affiliate IDs are public by nature: they appear in links)
-- ---------------------------------------------------------------------------
create table if not exists public.pp_site_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.pp_site_settings enable row level security;

insert into public.pp_site_settings(key,value,is_public)
values ('affiliate','{"amazon_tag":"pricepulsein-21","cuelinks_enabled":false,"cuelinks_cid":""}'::jsonb,true)
on conflict (key) do nothing;

create or replace function public.pp_public_settings()
returns jsonb
language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_object_agg(s.key,s.value),'{}'::jsonb)
  from public.pp_site_settings s where s.is_public;
$$;
revoke all on function public.pp_public_settings() from public;
grant execute on function public.pp_public_settings() to anon, authenticated;

create or replace function public.pp_admin_save_setting(set_key text, set_value jsonb, set_public boolean)
returns public.pp_site_settings
language plpgsql security definer set search_path = public as $$
declare r public.pp_site_settings;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  insert into public.pp_site_settings(key,value,is_public,updated_at)
  values (set_key,coalesce(set_value,'{}'::jsonb),coalesce(set_public,false),now())
  on conflict (key) do update set value=excluded.value,is_public=excluded.is_public,updated_at=now()
  returning * into r;
  return r;
end; $$;
revoke all on function public.pp_admin_save_setting(text,jsonb,boolean) from public, anon;
grant execute on function public.pp_admin_save_setting(text,jsonb,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Outbound "Buy" clicks (no personal data stored)
-- ---------------------------------------------------------------------------
create table if not exists public.pp_click_log (
  id bigint generated always as identity primary key,
  product_id text,
  store text not null,
  source text not null default 'site',
  affiliate boolean not null default false,
  created_at timestamptz not null default now(),
  check (product_id is null or product_id ~ '^[a-z0-9-]{1,80}$'),
  check (char_length(store) between 2 and 40),
  check (char_length(source) between 2 and 30)
);
create index if not exists pp_click_log_time_idx on public.pp_click_log(created_at desc);
create index if not exists pp_click_log_product_idx on public.pp_click_log(product_id, created_at desc);
alter table public.pp_click_log enable row level security;

create or replace function public.pp_log_click(click_product text, click_store text, click_source text, click_affiliate boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare pid text := nullif(lower(trim(coalesce(click_product,''))),'');
begin
  if pid is not null and pid !~ '^[a-z0-9-]{1,80}$' then pid := null; end if;
  insert into public.pp_click_log(product_id,store,source,affiliate)
  values (pid, left(coalesce(nullif(trim(click_store),''),'Unknown'),40), left(coalesce(nullif(trim(click_source),''),'site'),30), coalesce(click_affiliate,false));
end; $$;
revoke all on function public.pp_log_click(text,text,text,boolean) from public;
grant execute on function public.pp_log_click(text,text,text,boolean) to anon, authenticated;

create or replace function public.pp_admin_click_stats(stat_days integer)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare d integer := greatest(1,least(coalesce(stat_days,7),365)); since timestamptz := now() - make_interval(days => greatest(1,least(coalesce(stat_days,7),365)));
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  return jsonb_build_object(
    'days', d,
    'total', (select count(*) from public.pp_click_log where created_at>=since),
    'today', (select count(*) from public.pp_click_log where created_at>=date_trunc('day',now())),
    'affiliate', (select count(*) from public.pp_click_log where created_at>=since and affiliate),
    'by_store', coalesce((select jsonb_agg(jsonb_build_object('store',store,'clicks',n) order by n desc) from (select store,count(*) n from public.pp_click_log where created_at>=since group by store) x),'[]'::jsonb),
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('source',source,'clicks',n) order by n desc) from (select source,count(*) n from public.pp_click_log where created_at>=since group by source) x),'[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('day',dy,'clicks',n) order by dy) from (select to_char(date_trunc('day',created_at),'YYYY-MM-DD') dy,count(*) n from public.pp_click_log where created_at>=since group by 1) x),'[]'::jsonb)
  );
end; $$;
revoke all on function public.pp_admin_click_stats(integer) from public, anon;
grant execute on function public.pp_admin_click_stats(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Product demand: what shoppers actually look at (for the verify list)
-- ---------------------------------------------------------------------------
create or replace function public.pp_admin_product_demand()
returns table(product_id text, clicks_7d bigint, wishlists bigint, active_alerts bigint)
language plpgsql security definer set search_path = public stable as $$
#variable_conflict use_column
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  return query
  with ids as (
    select c.product_id from public.pp_click_log c where c.product_id is not null and c.created_at > now()-interval '7 days'
    union select w.product_id from public.wishlist_items w
    union select a.product_id from public.pp_deal_alerts a where a.status='active'
  )
  select i.product_id,
    (select count(*) from public.pp_click_log c where c.product_id=i.product_id and c.created_at > now()-interval '7 days'),
    (select count(*) from public.wishlist_items w where w.product_id=i.product_id),
    (select count(*) from public.pp_deal_alerts a where a.product_id=i.product_id and a.status='active')
  from ids i;
end; $$;
revoke all on function public.pp_admin_product_demand() from public, anon;
grant execute on function public.pp_admin_product_demand() to authenticated;
