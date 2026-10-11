-- PricePulse V213 — Shopper-confirmed product details + "price I saw" on track requests
-- Run ONCE in Supabase SQL Editor (after v211 and v212). Safe to run again.

alter table public.pp_track_requests add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.pp_track_requests add column if not exists reported_price numeric(12,2);
alter table public.pp_track_requests add column if not exists reported_store text;
alter table public.pp_track_requests add column if not exists reported_at timestamptz;

create or replace function public.pp_request_track_details(req_url text, req_key text, req_store text, req_details jsonb, req_price numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_url text := left(trim(coalesce(req_url,'')),1000);
  clean_key text := left(lower(trim(coalesce(req_key,''))),400);
  d jsonb := '{}'::jsonb;
  p numeric := case when req_price is not null and req_price > 0 and req_price < 10000000 then round(req_price,2) else null end;
  r public.pp_track_requests;
begin
  if clean_url !~* '^https?://' or char_length(clean_key) < 6 then
    raise exception 'Invalid product link';
  end if;
  -- keep only short text fields the website sends
  select coalesce(jsonb_object_agg(k, left(v,120)),'{}'::jsonb) into d
  from (select key k, value #>> '{}' v from jsonb_each(coalesce(req_details,'{}'::jsonb))
        where key in ('brand','model','variant','color','category','query','confirmed')) x
  where v is not null and v <> '';
  insert into public.pp_track_requests(url,url_key,store,last_user_id,details,reported_price,reported_store,reported_at)
  values (clean_url,clean_key,nullif(left(trim(coalesce(req_store,'')),40),''),auth.uid(),d,p,
          case when p is null then null else nullif(left(trim(coalesce(req_store,'')),40),'') end,
          case when p is null then null else now() end)
  on conflict (url_key) do update
    set request_count = public.pp_track_requests.request_count + 1,
        last_user_id = coalesce(auth.uid(),public.pp_track_requests.last_user_id),
        details = case when d = '{}'::jsonb then public.pp_track_requests.details else d end,
        reported_price = coalesce(excluded.reported_price, public.pp_track_requests.reported_price),
        reported_store = coalesce(excluded.reported_store, public.pp_track_requests.reported_store),
        reported_at = coalesce(excluded.reported_at, public.pp_track_requests.reported_at),
        updated_at = now()
  returning * into r;
  return jsonb_build_object('status',r.status,'count',r.request_count,'product_id',r.product_id);
end;
$$;
revoke all on function public.pp_request_track_details(text,text,text,jsonb,numeric) from public;
grant execute on function public.pp_request_track_details(text,text,text,jsonb,numeric) to anon, authenticated;
