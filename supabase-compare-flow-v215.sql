-- PricePulse V215 — Two-step compare flow: "price you saw" + "alert me" watchers
-- Run ONCE in Supabase SQL Editor (after v211, v212, v213). Safe to run again.

alter table public.pp_track_requests add column if not exists watchers_count integer not null default 0;
alter table public.pp_track_requests add column if not exists lowest_target numeric(12,2);

-- Shoppers who want an alert when this (not yet tracked) product gets verified prices
create table if not exists public.pp_track_watchers (
  url_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_price numeric(12,2) check (target_price is null or target_price > 0),
  converted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (url_key, user_id)
);
alter table public.pp_track_watchers enable row level security;
-- No browser policies: only the RPCs below touch this table.

-- Step 2 of the compare flow: optional price seen + optional alert target.
-- Does NOT increase the "shoppers asked" count.
create or replace function public.pp_track_followup(req_key text, req_price numeric, req_target numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := left(lower(trim(coalesce(req_key,''))),400);
  p numeric := case when req_price > 0 and req_price < 10000000 then round(req_price,2) else null end;
  t numeric := case when req_target > 0 and req_target < 10000000 then round(req_target,2) else null end;
  watching boolean := false;
begin
  if not exists(select 1 from public.pp_track_requests where url_key=k) then
    raise exception 'Request not found';
  end if;
  if p is not null then
    update public.pp_track_requests
       set reported_price=p, reported_store=coalesce(reported_store,store), reported_at=now(), updated_at=now()
     where url_key=k;
  end if;
  if auth.uid() is not null and (t is not null or req_target = 0) then
    insert into public.pp_track_watchers(url_key,user_id,target_price)
    values (k,auth.uid(),t)
    on conflict (url_key,user_id) do update set target_price=excluded.target_price, converted=false;
    watching := true;
    update public.pp_track_requests r
       set watchers_count=(select count(*) from public.pp_track_watchers w where w.url_key=k),
           lowest_target=(select min(target_price) from public.pp_track_watchers w where w.url_key=k),
           updated_at=now()
     where r.url_key=k;
  end if;
  return jsonb_build_object('price_saved',p is not null,'watching',watching);
end;
$$;
revoke all on function public.pp_track_followup(text,numeric,numeric) from public;
grant execute on function public.pp_track_followup(text,numeric,numeric) to anon, authenticated;

-- Admin "Mark added" now also turns watchers into real Deal Alerts for that product.
-- Each alert is created separately, so normal alert limits (1 free / 3 Plus) still apply;
-- a watcher who is already at the limit is simply skipped.
create or replace function public.pp_admin_update_track_request(req_id uuid, req_status text, req_product_id text, req_note text)
returns public.pp_track_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.pp_track_requests;
  w record;
  pname text;
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  if req_status not in ('new','added','rejected') then raise exception 'Invalid status'; end if;
  update public.pp_track_requests
     set status=req_status, product_id=nullif(trim(coalesce(req_product_id,'')),''),
         admin_note=nullif(trim(coalesce(req_note,'')),''), updated_at=now()
   where id=req_id returning * into r;
  if r.status='added' and r.product_id is not null and r.product_id ~ '^[a-z0-9-]+$' then
    begin
      execute 'select name from public.pp_catalog_products where product_id=$1' into pname using r.product_id;
    exception when others then pname := null;
    end;
    pname := coalesce(pname, nullif(trim(concat_ws(' ', r.details->>'brand', r.details->>'model')),''), r.product_id);
    for w in select * from public.pp_track_watchers where url_key=r.url_key and not converted and target_price is not null loop
      begin
        insert into public.pp_deal_alerts(user_id,product_id,product_name,target_price)
        values (w.user_id, r.product_id, pname, w.target_price)
        on conflict (user_id,product_id) do nothing;
        update public.pp_track_watchers set converted=true where url_key=w.url_key and user_id=w.user_id;
      exception when others then
        null; -- e.g. alert limit reached: skip this watcher
      end;
    end loop;
  end if;
  return r;
end;
$$;
revoke all on function public.pp_admin_update_track_request(uuid,text,text,text) from public, anon;
grant execute on function public.pp_admin_update_track_request(uuid,text,text,text) to authenticated;
