-- PricePulse V211 — Hero growth features (track requests, sale countdown, public stats)
-- Run ONCE in Supabase SQL Editor (after the existing price-pilot / deal-alerts SQL).
-- Safe to run again: everything uses "if not exists" / "create or replace".
-- Data source note: today these tables are filled manually from the Admin panel.
-- When a price API is connected later, it can write to the same tables / RPCs,
-- so the website does not need a redesign.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Track requests: visitors paste a store link we don't track yet
-- ---------------------------------------------------------------------------
create table if not exists public.pp_track_requests (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  url_key text not null unique,
  store text,
  request_count integer not null default 1,
  last_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'new' check (status in ('new','added','rejected')),
  product_id text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(url) between 10 and 1000)
);
alter table public.pp_track_requests enable row level security;
-- No direct table policies: browser uses the RPCs below only.

create or replace function public.pp_request_track(req_url text, req_key text, req_store text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_url text := left(trim(coalesce(req_url,'')),1000);
  clean_key text := left(lower(trim(coalesce(req_key,''))),400);
  r public.pp_track_requests;
begin
  if clean_url !~* '^https?://' or char_length(clean_key) < 6 then
    raise exception 'Invalid product link';
  end if;
  insert into public.pp_track_requests(url,url_key,store,last_user_id)
  values (clean_url,clean_key,nullif(left(trim(coalesce(req_store,'')),40),''),auth.uid())
  on conflict (url_key) do update
    set request_count = public.pp_track_requests.request_count + 1,
        last_user_id = coalesce(auth.uid(),public.pp_track_requests.last_user_id),
        updated_at = now()
  returning * into r;
  return jsonb_build_object('status',r.status,'count',r.request_count,'product_id',r.product_id);
end;
$$;
revoke all on function public.pp_request_track(text,text,text) from public;
grant execute on function public.pp_request_track(text,text,text) to anon, authenticated;

create or replace function public.pp_admin_list_track_requests()
returns setof public.pp_track_requests
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  return query select * from public.pp_track_requests
    order by (status='new') desc, request_count desc, updated_at desc limit 500;
end;
$$;
revoke all on function public.pp_admin_list_track_requests() from public, anon;
grant execute on function public.pp_admin_list_track_requests() to authenticated;

create or replace function public.pp_admin_update_track_request(req_id uuid, req_status text, req_product_id text, req_note text)
returns public.pp_track_requests
language plpgsql
security definer
set search_path = public
as $$
declare r public.pp_track_requests;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  if req_status not in ('new','added','rejected') then raise exception 'Invalid status'; end if;
  update public.pp_track_requests
     set status=req_status, product_id=nullif(trim(coalesce(req_product_id,'')),''),
         admin_note=nullif(trim(coalesce(req_note,'')),''), updated_at=now()
   where id=req_id returning * into r;
  return r;
end;
$$;
revoke all on function public.pp_admin_update_track_request(uuid,text,text,text) from public, anon;
grant execute on function public.pp_admin_update_track_request(uuid,text,text,text) to authenticated;

create or replace function public.pp_admin_delete_track_request(req_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  delete from public.pp_track_requests where id=req_id;
end; $$;
revoke all on function public.pp_admin_delete_track_request(uuid) from public, anon;
grant execute on function public.pp_admin_delete_track_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Sale events: countdown strip above the hero
-- ---------------------------------------------------------------------------
create table if not exists public.pp_sale_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  store text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.pp_sale_events enable row level security;

create or replace function public.pp_public_sale_events()
returns table(id uuid, title text, store text, starts_at timestamptz, ends_at timestamptz, note text)
language sql
security definer
set search_path = public
stable
as $$
  select e.id,e.title,e.store,e.starts_at,e.ends_at,e.note
  from public.pp_sale_events e
  where e.active and e.ends_at > now() and e.starts_at < now() + interval '21 days'
  order by e.starts_at asc
  limit 3;
$$;
revoke all on function public.pp_public_sale_events() from public;
grant execute on function public.pp_public_sale_events() to anon, authenticated;

create or replace function public.pp_admin_list_sale_events()
returns setof public.pp_sale_events
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  return query select * from public.pp_sale_events order by active desc, starts_at desc;
end; $$;
revoke all on function public.pp_admin_list_sale_events() from public, anon;
grant execute on function public.pp_admin_list_sale_events() to authenticated;

create or replace function public.pp_admin_upsert_sale_event(ev_id uuid, ev_title text, ev_store text, ev_starts_at timestamptz, ev_ends_at timestamptz, ev_note text, ev_active boolean)
returns public.pp_sale_events
language plpgsql security definer set search_path = public as $$
declare r public.pp_sale_events;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  if ev_id is null then
    insert into public.pp_sale_events(title,store,starts_at,ends_at,note,active)
    values (trim(ev_title),nullif(trim(coalesce(ev_store,'')),''),ev_starts_at,ev_ends_at,nullif(trim(coalesce(ev_note,'')),''),coalesce(ev_active,false))
    returning * into r;
  else
    update public.pp_sale_events set title=trim(ev_title),store=nullif(trim(coalesce(ev_store,'')),''),
      starts_at=ev_starts_at,ends_at=ev_ends_at,note=nullif(trim(coalesce(ev_note,'')),''),
      active=coalesce(ev_active,false),updated_at=now()
    where id=ev_id returning * into r;
  end if;
  return r;
end; $$;
revoke all on function public.pp_admin_upsert_sale_event(uuid,text,text,timestamptz,timestamptz,text,boolean) from public, anon;
grant execute on function public.pp_admin_upsert_sale_event(uuid,text,text,timestamptz,timestamptz,text,boolean) to authenticated;

create or replace function public.pp_admin_delete_sale_event(ev_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  delete from public.pp_sale_events where id=ev_id;
end; $$;
revoke all on function public.pp_admin_delete_sale_event(uuid) from public, anon;
grant execute on function public.pp_admin_delete_sale_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Public site stats (real numbers only, no personal data)
-- ---------------------------------------------------------------------------
create or replace function public.pp_public_site_stats()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'price_checks_30d', (select count(*) from public.pp_retailer_price_history h
                          where h.display_permitted and h.checked_at > now() - interval '30 days'),
    'active_alerts',    (select count(*) from public.pp_deal_alerts a where a.status='active'),
    'track_requests',   (select coalesce(sum(request_count),0) from public.pp_track_requests)
  );
$$;
revoke all on function public.pp_public_site_stats() from public;
grant execute on function public.pp_public_site_stats() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Resolve a pasted link that admin has already mapped to a product
-- ---------------------------------------------------------------------------
create or replace function public.pp_resolve_track_link(req_key text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select r.product_id from public.pp_track_requests r
  where r.url_key = left(lower(trim(coalesce(req_key,''))),400)
    and r.status = 'added' and r.product_id is not null
  limit 1;
$$;
revoke all on function public.pp_resolve_track_link(text) from public;
grant execute on function public.pp_resolve_track_link(text) to anon, authenticated;
