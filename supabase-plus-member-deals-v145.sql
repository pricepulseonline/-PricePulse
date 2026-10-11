-- PricePulse V78.8.145 — Plus Member Deals backend patch
-- Run AFTER V78.8.141 final backend + V78.8.143 own-membership RPC patch.

create extension if not exists pgcrypto;

create table if not exists public.pp_plus_member_deals (
  id uuid primary key default gen_random_uuid(),
  offer_type text not null check (offer_type in ('exclusive_offer','plus_reward','coupon_bank','early_access')),
  title text not null,
  benefit_text text not null,
  value_label text,
  retailer text,
  coupon_code text,
  campaign_key text,
  terms text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  featured boolean not null default false,
  active boolean not null default false,
  sort_order integer not null default 0,
  action_kind text not null default 'none' check (action_kind in ('none','internal_path','tracked_campaign')),
  action_label text,
  action_target text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at)
);

alter table public.pp_plus_member_deals enable row level security;

-- No direct browser table policy. Customers and admins use protected RPCs only.

create or replace function public.pp_plus_effective_active_for_user(target_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  m public.pp_plus_memberships;
  master_mode text := 'individual';
  master_expires timestamptz;
begin
  if target_user is null then return false; end if;

  select c.mode,c.expires_at into master_mode,master_expires
  from public.pp_plus_master_control c where c.id=true;

  if master_mode='active' and master_expires is not null and master_expires>now() then
    return true;
  elsif master_mode='inactive' then
    return false;
  end if;

  select * into m from public.pp_plus_memberships where user_id=target_user;
  return coalesce(m.status='active' and (m.expires_at is null or m.expires_at>now()),false);
end;
$$;
revoke all on function public.pp_plus_effective_active_for_user(uuid) from public,anon,authenticated;

create or replace function public.pp_get_my_plus_member_deals()
returns table(
  id uuid,
  offer_type text,
  title text,
  benefit_text text,
  value_label text,
  retailer text,
  coupon_code text,
  campaign_key text,
  terms text,
  starts_at timestamptz,
  expires_at timestamptz,
  featured boolean,
  sort_order integer,
  action_kind text,
  action_label text,
  action_target text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not public.pp_plus_effective_active_for_user(auth.uid()) then
    raise exception 'Active PricePulse Plus membership required';
  end if;

  return query
  select d.id,d.offer_type,d.title,d.benefit_text,d.value_label,d.retailer,d.coupon_code,
         d.campaign_key,d.terms,d.starts_at,d.expires_at,d.featured,d.sort_order,
         d.action_kind,d.action_label,d.action_target
  from public.pp_plus_member_deals d
  where d.active=true
    and d.starts_at<=now()
    and (d.expires_at is null or d.expires_at>now())
  order by d.featured desc,d.sort_order asc,d.created_at desc;
end;
$$;
revoke all on function public.pp_get_my_plus_member_deals() from public,anon;
grant execute on function public.pp_get_my_plus_member_deals() to authenticated;

create or replace function public.pp_admin_list_plus_member_deals()
returns setof public.pp_plus_member_deals
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  return query select * from public.pp_plus_member_deals order by active desc,featured desc,sort_order asc,updated_at desc;
end;
$$;
revoke all on function public.pp_admin_list_plus_member_deals() from public,anon;
grant execute on function public.pp_admin_list_plus_member_deals() to authenticated;

create or replace function public.pp_admin_upsert_plus_member_deal(
  deal_id uuid,
  deal_type text,
  deal_title text,
  deal_benefit_text text,
  deal_value_label text,
  deal_retailer text,
  deal_coupon_code text,
  deal_campaign_key text,
  deal_terms text,
  deal_starts_at timestamptz,
  deal_expires_at timestamptz,
  deal_featured boolean,
  deal_active boolean,
  deal_sort_order integer,
  deal_action_kind text,
  deal_action_label text,
  deal_action_target text
)
returns public.pp_plus_member_deals
language plpgsql
security definer
set search_path = public
as $$
declare r public.pp_plus_member_deals;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  if deal_type not in ('exclusive_offer','plus_reward','coupon_bank','early_access') then raise exception 'Invalid deal type'; end if;
  if nullif(btrim(deal_title),'') is null then raise exception 'Title required'; end if;
  if nullif(btrim(deal_benefit_text),'') is null then raise exception 'Benefit text required'; end if;
  if deal_action_kind not in ('none','internal_path','tracked_campaign') then raise exception 'Invalid action kind'; end if;
  if deal_expires_at is not null and deal_expires_at<=coalesce(deal_starts_at,now()) then raise exception 'Expiry must be after start'; end if;

  if deal_id is null then
    insert into public.pp_plus_member_deals(
      offer_type,title,benefit_text,value_label,retailer,coupon_code,campaign_key,terms,
      starts_at,expires_at,featured,active,sort_order,action_kind,action_label,action_target,
      created_by,updated_by
    ) values(
      deal_type,btrim(deal_title),btrim(deal_benefit_text),nullif(btrim(coalesce(deal_value_label,'')),''),
      nullif(btrim(coalesce(deal_retailer,'')),''),nullif(btrim(coalesce(deal_coupon_code,'')),''),
      nullif(btrim(coalesce(deal_campaign_key,'')),''),nullif(btrim(coalesce(deal_terms,'')),''),
      coalesce(deal_starts_at,now()),deal_expires_at,coalesce(deal_featured,false),coalesce(deal_active,false),
      coalesce(deal_sort_order,0),deal_action_kind,nullif(btrim(coalesce(deal_action_label,'')),''),
      nullif(btrim(coalesce(deal_action_target,'')),''),auth.uid(),auth.uid()
    ) returning * into r;
  else
    update public.pp_plus_member_deals set
      offer_type=deal_type,title=btrim(deal_title),benefit_text=btrim(deal_benefit_text),
      value_label=nullif(btrim(coalesce(deal_value_label,'')),''),retailer=nullif(btrim(coalesce(deal_retailer,'')),''),
      coupon_code=nullif(btrim(coalesce(deal_coupon_code,'')),''),campaign_key=nullif(btrim(coalesce(deal_campaign_key,'')),''),
      terms=nullif(btrim(coalesce(deal_terms,'')),''),starts_at=coalesce(deal_starts_at,starts_at),expires_at=deal_expires_at,
      featured=coalesce(deal_featured,false),active=coalesce(deal_active,false),sort_order=coalesce(deal_sort_order,0),
      action_kind=deal_action_kind,action_label=nullif(btrim(coalesce(deal_action_label,'')),''),
      action_target=nullif(btrim(coalesce(deal_action_target,'')),''),updated_by=auth.uid(),updated_at=now()
    where id=deal_id returning * into r;
    if r.id is null then raise exception 'Deal not found'; end if;
  end if;
  return r;
end;
$$;
revoke all on function public.pp_admin_upsert_plus_member_deal(uuid,text,text,text,text,text,text,text,text,timestamptz,timestamptz,boolean,boolean,integer,text,text,text) from public,anon;
grant execute on function public.pp_admin_upsert_plus_member_deal(uuid,text,text,text,text,text,text,text,text,timestamptz,timestamptz,boolean,boolean,integer,text,text,text) to authenticated;

create or replace function public.pp_admin_delete_plus_member_deal(deal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then raise exception 'PricePulse admin access required'; end if;
  delete from public.pp_plus_member_deals where id=deal_id;
  return found;
end;
$$;
revoke all on function public.pp_admin_delete_plus_member_deal(uuid) from public,anon;
grant execute on function public.pp_admin_delete_plus_member_deal(uuid) to authenticated;

-- End V78.8.145 Plus Member Deals backend patch.
