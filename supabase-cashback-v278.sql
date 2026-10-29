-- PricePulse V278 - Cashback rates by store + category + BRAND (+ model rows) + cap per sale, synced from Cuelinks.
-- Run ONCE in Supabase > SQL Editor (after supabase-cashback-v277.sql, which you already ran). Safe to run again.
-- What it does:
--   1) pp_cashback_rates gets brand / product-name rules, a cap per sale (max commission in Rs) and a flat amount.
--      The old store-wide rates (category '*', e.g. Vijay Sales 2.5%) are DELETED: they made the site show far too much.
--      A store-wide rate can never be added again. No matching rule = no cashback.
--   2) pp_cashback_campaigns + pp_cashback_rate_lines = what the daily Cuelinks sync saw (Admin > Growth > Cashback).
--   3) Setting "cashback" = the shopper's share of OUR commission (40%) - change it in Admin, not in the code.
--   4) Admin functions (save / delete own rules, status, products with no cashback), public list for the site + extension.
--   5) pp_click_refs: an anonymous id per store click (sent to Cuelinks as subid) - needed later for the wallet.
--   6) Daily job "cuelinks-rates-daily" (06:20 India time) that calls the Edge Function cuelinks-rates.
-- Amazon can never have cashback (Associates rules) - blocked by the table.

-- ---------------------------------------------------------------------------------------------------------------
-- 1) rates table
-- ---------------------------------------------------------------------------------------------------------------
alter table public.pp_cashback_rates add column if not exists brand_rx text not null default '';
alter table public.pp_cashback_rates add column if not exists name_rx text not null default '';
alter table public.pp_cashback_rates add column if not exists brands text not null default '';      -- admin rules: what was typed
alter table public.pp_cashback_rates add column if not exists words text not null default '';       -- admin rules: what was typed
alter table public.pp_cashback_rates add column if not exists flat_amount numeric(10,2);            -- flat commission Rs per sale (instead of %)
alter table public.pp_cashback_rates add column if not exists cap_amount numeric(10,2);             -- max commission Rs per sale ("User Max Earn")
alter table public.pp_cashback_rates add column if not exists priority int not null default 10;
alter table public.pp_cashback_rates add column if not exists source text not null default 'admin';
alter table public.pp_cashback_rates add column if not exists campaign_id int;
alter table public.pp_cashback_rates add column if not exists raw_name text;

-- the old store-wide seed rows (V277) are wrong: remove them
delete from public.pp_cashback_rates where category = '*' and brand_rx = '' and name_rx = '';

do $$ begin
  -- one store + category used to be unique; now many rules per category (brand / model rows)
  if exists (select 1 from pg_constraint where conname = 'pp_cashback_rates_store_category_key') then
    alter table public.pp_cashback_rates drop constraint pp_cashback_rates_store_category_key;
  end if;
  -- 0% rows are allowed now ("not applicable on ..." = an exclusion)
  if exists (select 1 from pg_constraint where conname = 'pp_cashback_rates_commission_pct_check') then
    alter table public.pp_cashback_rates drop constraint pp_cashback_rates_commission_pct_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pp_cashback_rates_pct_v278') then
    alter table public.pp_cashback_rates add constraint pp_cashback_rates_pct_v278 check (commission_pct >= 0 and commission_pct <= 50);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pp_cashback_rates_no_storewide') then
    alter table public.pp_cashback_rates add constraint pp_cashback_rates_no_storewide check (not (category = '*' and brand_rx = '' and name_rx = ''));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pp_cashback_rates_source_v278') then
    alter table public.pp_cashback_rates add constraint pp_cashback_rates_source_v278 check (source in ('admin', 'cuelinks'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pp_cashback_rates_money_v278') then
    alter table public.pp_cashback_rates add constraint pp_cashback_rates_money_v278 check ((flat_amount is null or flat_amount >= 0) and (cap_amount is null or cap_amount > 0));
  end if;
end $$;
create unique index if not exists pp_cashback_rates_rule_v278 on public.pp_cashback_rates (store, category, brand_rx, name_rx, source);
create index if not exists pp_cashback_rates_store_v278 on public.pp_cashback_rates (store) where active;

-- ---------------------------------------------------------------------------------------------------------------
-- 2) what the daily sync saw
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.pp_cashback_campaigns (
  store text primary key,
  campaign_id int,
  campaign_name text,
  status text not null default 'error',          -- ok | cashback_not_allowed | no_campaign | error
  cashback_allowed boolean not null default false,
  coupons_allowed boolean,
  deals_allowed boolean,
  media_allowed text[] not null default '{}',
  media_disallowed text[] not null default '{}',
  validation_time text,
  payment_time text,
  error text,
  synced_at timestamptz not null default now()
);
create table if not exists public.pp_cashback_rate_lines (
  id bigint generated always as identity primary key,
  store text not null,
  campaign_id int,
  line_no int not null,
  raw_name text not null,
  payout_type text,
  payout numeric,
  is_header boolean not null default false,
  result text not null,                          -- rate | exclusion | cap | header | skipped | unmatched
  detail text,
  synced_at timestamptz not null default now()
);
create index if not exists pp_cashback_rate_lines_store on public.pp_cashback_rate_lines (store, line_no);
alter table public.pp_cashback_campaigns enable row level security;
alter table public.pp_cashback_rate_lines enable row level security;
-- no policies: only the functions below (and the Edge Function, which uses the database URL) read or write them

-- ---------------------------------------------------------------------------------------------------------------
-- 3) settings: shopper share of our commission (0.40 = 40%), smallest amount shown (Rs 5)
-- ---------------------------------------------------------------------------------------------------------------
insert into public.pp_site_settings (key, value, is_public)
values ('cashback', '{"share":0.4,"min":5}'::jsonb, true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- 4) functions
-- ---------------------------------------------------------------------------------------------------------------
-- same normalising as the site: lower case, only a-z 0-9, single spaces
create or replace function public.pp_cb_norm(t text) returns text
language sql immutable as $$ select trim(regexp_replace(regexp_replace(lower(coalesce(t,'')), '&', ' and ', 'g'), '[^a-z0-9]+', ' ', 'g')) $$;
-- "Apple, Realme" -> (^|[^a-z0-9])(apple|realme)([^a-z0-9]|$)   (works the same in JavaScript and Postgres)
create or replace function public.pp_cb_words_rx(list text) returns text
language sql immutable as $$
  select coalesce('(^|[^a-z0-9])(' || string_agg(replace(w, ' ', ' ?'), '|' order by w) || ')([^a-z0-9]|$)', '')
  from (select distinct public.pp_cb_norm(x) w from unnest(string_to_array(coalesce(list,''), ',')) x) s where length(w) >= 2
$$;

-- public list (site + extension). Synced rows count only when the campaign allows cashback sites.
drop function if exists public.pp_cashback_rates_public();
create function public.pp_cashback_rates_public()
returns table(store text, category text, brand_rx text, name_rx text, commission_pct numeric, flat_amount numeric, cap_amount numeric, priority int, source text)
language sql security definer set search_path = public stable as $$
  select r.store, r.category, r.brand_rx, r.name_rx, r.commission_pct, r.flat_amount, r.cap_amount, r.priority, r.source
  from public.pp_cashback_rates r
  where r.active
    and (r.source = 'admin' or exists (select 1 from public.pp_cashback_campaigns c where c.store = r.store and c.status = 'ok' and c.cashback_allowed))
  order by r.store, r.priority desc;
$$;
revoke all on function public.pp_cashback_rates_public() from public;
grant execute on function public.pp_cashback_rates_public() to anon, authenticated;

create or replace function public.pp_cb_is_admin() returns boolean
language sql security definer set search_path = public stable as $$ select exists(select 1 from public.pp_price_admins where user_id = auth.uid()) $$;
revoke all on function public.pp_cb_is_admin() from public, anon;
grant execute on function public.pp_cb_is_admin() to authenticated;

-- admin: all rules (synced + own)
create or replace function public.pp_admin_list_cashback_rates()
returns setof public.pp_cashback_rates
language plpgsql security definer set search_path = public as $$
begin
  if not public.pp_cb_is_admin() then raise exception 'PricePulse admin access required'; end if;
  return query select * from public.pp_cashback_rates order by store, priority desc, category;
end; $$;
revoke all on function public.pp_admin_list_cashback_rates() from public, anon;
grant execute on function public.pp_admin_list_cashback_rates() to authenticated;

-- admin: add / change an OWN rule (it wins over the synced rules: priority 100). 0% = "no cashback for this".
drop function if exists public.pp_admin_upsert_cashback_rate(text, text, numeric, boolean, text);
create or replace function public.pp_admin_save_cashback_rate(p_id uuid, p_store text, p_category text, p_brands text, p_words text,
  p_pct numeric, p_flat numeric, p_cap numeric, p_active boolean, p_note text)
returns public.pp_cashback_rates
language plpgsql security definer set search_path = public as $$
declare r public.pp_cashback_rates;
  c text := coalesce(nullif(lower(trim(coalesce(p_category,''))),''),'*');
  b text := public.pp_cb_words_rx(p_brands);
  w text := public.pp_cb_words_rx(p_words);
begin
  if not public.pp_cb_is_admin() then raise exception 'PricePulse admin access required'; end if;
  if c = '*' and b = '' and w = '' then raise exception 'Pick a category, a brand or product words. A store-wide cashback rate is not allowed.'; end if;
  if p_id is not null then
    update public.pp_cashback_rates set store = trim(p_store), category = c, brands = coalesce(trim(p_brands),''), words = coalesce(trim(p_words),''),
      brand_rx = b, name_rx = w, commission_pct = coalesce(p_pct,0), flat_amount = nullif(p_flat,0), cap_amount = nullif(p_cap,0),
      active = coalesce(p_active,true), note = nullif(trim(coalesce(p_note,'')),''), updated_at = now()
    where id = p_id and source = 'admin' returning * into r;
    if r.id is null then raise exception 'Only your own rules can be changed. Synced Cuelinks rules come back every day - add your own rule to override one.'; end if;
    return r;
  end if;
  insert into public.pp_cashback_rates (store, category, brands, words, brand_rx, name_rx, commission_pct, flat_amount, cap_amount, priority, source, active, note)
  values (trim(p_store), c, coalesce(trim(p_brands),''), coalesce(trim(p_words),''), b, w, coalesce(p_pct,0), nullif(p_flat,0), nullif(p_cap,0), 100, 'admin',
    coalesce(p_active,true), nullif(trim(coalesce(p_note,'')),''))
  on conflict (store, category, brand_rx, name_rx, source) do update set commission_pct = excluded.commission_pct, flat_amount = excluded.flat_amount,
    cap_amount = excluded.cap_amount, active = excluded.active, note = excluded.note, brands = excluded.brands, words = excluded.words, updated_at = now()
  returning * into r;
  return r;
end; $$;
revoke all on function public.pp_admin_save_cashback_rate(uuid, text, text, text, text, numeric, numeric, numeric, boolean, text) from public, anon;
grant execute on function public.pp_admin_save_cashback_rate(uuid, text, text, text, text, numeric, numeric, numeric, boolean, text) to authenticated;

-- admin: remove an own rule
create or replace function public.pp_admin_delete_cashback_rate(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.pp_cb_is_admin() then raise exception 'PricePulse admin access required'; end if;
  delete from public.pp_cashback_rates where id = p_id and source = 'admin';
end; $$;
revoke all on function public.pp_admin_delete_cashback_rate(uuid) from public, anon;
grant execute on function public.pp_admin_delete_cashback_rate(uuid) to authenticated;

-- admin: shopper share + smallest amount + pinned Cuelinks campaign ids {"Vijay Sales":4164}
create or replace function public.pp_admin_save_cashback_settings(p_share numeric, p_min int, p_campaigns jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.pp_cb_is_admin() then raise exception 'PricePulse admin access required'; end if;
  if p_share is null or p_share <= 0 or p_share > 0.9 then raise exception 'Share must be between 1%% and 90%%'; end if;
  insert into public.pp_site_settings (key, value, is_public, updated_at) values ('cashback', '{}'::jsonb, true, now()) on conflict (key) do nothing;
  update public.pp_site_settings set value = value || jsonb_build_object('share', round(p_share, 4), 'min', greatest(1, coalesce(p_min, 5)),
      'campaigns', coalesce(p_campaigns, value->'campaigns', '{}'::jsonb)), is_public = true, updated_at = now()
  where key = 'cashback' returning value into v;
  return v;
end; $$;
revoke all on function public.pp_admin_save_cashback_settings(numeric, int, jsonb) from public, anon;
grant execute on function public.pp_admin_save_cashback_settings(numeric, int, jsonb) to authenticated;

-- admin: what the sync saw (stores, rules count, lines it did not understand)
create or replace function public.pp_admin_cashback_status()
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.pp_cb_is_admin() then raise exception 'PricePulse admin access required'; end if;
  return jsonb_build_object(
    'settings', (select value from public.pp_site_settings where key = 'cashback'),
    'campaigns', coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object(
        'rules', (select count(*) from public.pp_cashback_rates r where r.store = c.store and r.source = 'cuelinks'),
        'unmatched', (select count(*) from public.pp_cashback_rate_lines l where l.store = c.store and l.result = 'unmatched')) order by c.store)
      from public.pp_cashback_campaigns c), '[]'::jsonb),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('store', l.store, 'line_no', l.line_no, 'raw_name', l.raw_name, 'payout_type', l.payout_type,
        'payout', l.payout, 'result', l.result, 'detail', l.detail) order by l.store, l.line_no)
      from public.pp_cashback_rate_lines l), '[]'::jsonb));
end; $$;
revoke all on function public.pp_admin_cashback_status() from public, anon;
grant execute on function public.pp_admin_cashback_status() to authenticated;

-- the rule the site would use for one product on one store (same order as the site: priority, then the smaller rate)
create or replace function public.pp_cb_rule_for(p_store text, p_category text, p_brand text, p_name text)
returns public.pp_cashback_rates
language sql security definer set search_path = public stable as $$
  select r.* from public.pp_cashback_rates r
  where r.active and lower(regexp_replace(r.store,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(coalesce(p_store,''),'[^a-zA-Z0-9]','','g'))
    and (r.source = 'admin' or exists (select 1 from public.pp_cashback_campaigns c where c.store = r.store and c.status = 'ok' and c.cashback_allowed))
    and (r.category = '*' or r.category = lower(coalesce(p_category,'')))
    and (r.brand_rx = '' or (' ' || public.pp_cb_norm(p_brand) || ' ' || public.pp_cb_norm(p_name) || ' ') ~ r.brand_rx)
    and (r.name_rx = '' or (' ' || public.pp_cb_norm(p_brand) || ' ' || public.pp_cb_norm(p_name) || ' ') ~ r.name_rx)
  order by r.priority desc, coalesce(r.flat_amount, 0) asc, r.commission_pct asc
  limit 1
$$;
revoke all on function public.pp_cb_rule_for(text, text, text, text) from public, anon;
grant execute on function public.pp_cb_rule_for(text, text, text, text) to authenticated;

-- admin: products sold on a cashback store (Cuelinks links ON for it) that get NO cashback (no rule, or a 0% rule)
create or replace function public.pp_admin_cashback_no_match()
returns table(product_id text, name text, brand text, category text, store text, why text)
language plpgsql security definer set search_path = public as $$
declare cue jsonb := coalesce((select value from public.pp_site_settings where key = 'affiliate'), '{}'::jsonb);
begin
  if not public.pp_cb_is_admin() then raise exception 'PricePulse admin access required'; end if;
  return query
  with ls as (
    select distinct p.product_id, p.name, coalesce(replace(p.brand_slug,'-',' '),'') brand, coalesce(p.category,'') category, s.name store
    from public.pp_catalog_products p
    join public.pp_product_store_listings l on l.product_id = p.product_id and l.active
    join public.pp_catalog_stores s on s.slug = l.store_slug and s.active
    where p.status in ('active','tracking')
      and lower(regexp_replace(s.name,'[^a-zA-Z]','','g')) not like 'amazon%'
      and (exists (select 1 from public.pp_cashback_rates r where r.store = s.name and r.active)
        or ((cue->>'cuelinks_enabled')::boolean is true and (cue->'cuelinks_stores') ? s.name))
  )
  select ls.product_id, ls.name, ls.brand, ls.category, ls.store,
    case when r.id is null then 'no rule matches' else 'rule says no commission (' || coalesce(r.raw_name, r.words, r.brands, r.category) || ')' end
  from ls left join lateral (select * from public.pp_cb_rule_for(ls.store, ls.category, ls.brand, ls.name)) r on true
  where r.id is null or (coalesce(r.commission_pct,0) = 0 and coalesce(r.flat_amount,0) = 0)
  order by ls.store, ls.name;
end; $$;
revoke all on function public.pp_admin_cashback_no_match() from public, anon;
grant execute on function public.pp_admin_cashback_no_match() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5) anonymous click ids (Cuelinks "subid"). Never the user id itself in the link.
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.pp_click_refs (
  ref text primary key check (ref ~ '^[a-z0-9]{12,24}$'),
  product_id text,
  store text,
  source text,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists pp_click_refs_user on public.pp_click_refs (user_id, created_at desc);
alter table public.pp_click_refs enable row level security;
create or replace function public.pp_log_click_ref(p_ref text, p_product text, p_store text, p_source text)
returns void
language sql security definer set search_path = public as $$
  insert into public.pp_click_refs (ref, product_id, store, source, user_id)
  values (lower(p_ref), left(p_product, 80), left(p_store, 60), left(p_source, 40), auth.uid())
  on conflict (ref) do nothing
$$;
revoke all on function public.pp_log_click_ref(text, text, text, text) from public;
grant execute on function public.pp_log_click_ref(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 6) daily sync job (needs the Edge Function "cuelinks-rates" deployed with "Verify JWT" switched OFF)
-- ---------------------------------------------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    if exists (select 1 from cron.job where jobname = 'cuelinks-rates-daily') then perform cron.unschedule('cuelinks-rates-daily'); end if;
    perform cron.schedule('cuelinks-rates-daily', '50 0 * * *',
      $job$ select net.http_post(url := 'https://akdrydxbvdtadmcphhxj.supabase.co/functions/v1/cuelinks-rates',
        headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 5000) $job$);
  else
    raise notice 'pg_cron / pg_net not enabled: add the daily job in Supabase > Integrations > Cron instead.';
  end if;
end $$;

-- Check after running:
--   select * from public.pp_cashback_rates_public();          -- empty until the first sync (old store-wide rows are gone)
--   select * from public.pp_cashback_campaigns;                -- after the first sync
--   select jobname, schedule from cron.job where jobname = 'cuelinks-rates-daily';
