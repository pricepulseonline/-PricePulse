-- PricePulse V268: store offers (bank / coupon / gift card / EMI / cashback) added by price admins.
-- Run once in the Supabase SQL editor. Needs pp_price_admins (already there from the extension SQL v2).
create table if not exists public.pp_store_offers (
  id bigint generated always as identity primary key,
  store text not null,                       -- store slug: amazon, flipkart, croma, vijay-sales ...
  kind text not null check (kind in ('bank','coupon','giftcard','emi','cashback','other')),
  title text not null,
  bank text,
  pct numeric check (pct is null or (pct > 0 and pct <= 100)),
  flat numeric check (flat is null or flat > 0),
  cap numeric check (cap is null or cap > 0),
  min_order numeric check (min_order is null or min_order > 0),
  code text,
  category text,                             -- null = every category (mobiles, laptops, electronics, home, fashion, appliances, beauty)
  valid_till date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pp_store_offers enable row level security;
revoke all on public.pp_store_offers from anon, authenticated;

create or replace function public.pp_store_offers_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'store', store, 'kind', kind, 'title', title, 'bank', bank, 'pct', pct, 'flat', flat, 'cap', cap,
    'min_order', min_order, 'code', code, 'category', category, 'valid_till', valid_till
  ) order by store, kind, id), '[]'::jsonb)
  from public.pp_store_offers
  where active and (valid_till is null or valid_till >= (now() at time zone 'Asia/Kolkata')::date);
$$;

create or replace function public.pp_store_offers_admin()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(to_jsonb(o) order by o.store, o.kind, o.id) from public.pp_store_offers o), '[]'::jsonb));
end $$;

create or replace function public.pp_store_offer_save(
  p_id bigint, p_store text, p_kind text, p_title text, p_bank text, p_pct numeric, p_flat numeric,
  p_cap numeric, p_min numeric, p_code text, p_category text, p_valid date, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  if coalesce(trim(p_store),'') = '' or coalesce(trim(p_title),'') = '' then return jsonb_build_object('ok', false, 'error', 'Store and title are needed'); end if;
  if p_id is null then
    insert into public.pp_store_offers(store,kind,title,bank,pct,flat,cap,min_order,code,category,valid_till,active)
    values (lower(trim(p_store)), p_kind, trim(p_title), nullif(trim(p_bank),''), p_pct, p_flat, p_cap, p_min, nullif(trim(p_code),''), nullif(trim(p_category),''), p_valid, coalesce(p_active,true))
    returning id into v_id;
  else
    update public.pp_store_offers set store=lower(trim(p_store)), kind=p_kind, title=trim(p_title), bank=nullif(trim(p_bank),''), pct=p_pct, flat=p_flat,
      cap=p_cap, min_order=p_min, code=nullif(trim(p_code),''), category=nullif(trim(p_category),''), valid_till=p_valid, active=coalesce(p_active,true), updated_at=now()
    where id = p_id returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.pp_store_offer_delete(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  delete from public.pp_store_offers where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.pp_store_offers_public() from public;
revoke all on function public.pp_store_offers_admin() from public;
revoke all on function public.pp_store_offer_save(bigint,text,text,text,text,numeric,numeric,numeric,numeric,text,text,date,boolean) from public;
revoke all on function public.pp_store_offer_delete(bigint) from public;
grant execute on function public.pp_store_offers_public() to anon, authenticated;
grant execute on function public.pp_store_offers_admin() to authenticated;
grant execute on function public.pp_store_offer_save(bigint,text,text,text,text,numeric,numeric,numeric,numeric,text,text,date,boolean) to authenticated;
grant execute on function public.pp_store_offer_delete(bigint) to authenticated;
