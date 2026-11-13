-- PricePulse AI-PLAN P5 + P6 (+ Q7 data): "Report wrong price" from shoppers + price sanity checks for Admin.
-- Run ONCE in Supabase > SQL Editor. Uses the existing pp_ext_is_admin().

create table if not exists public.pp_price_reports (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  product_id text not null check (length(product_id) between 1 and 120),
  store text check (length(store) <= 60),
  seen_price numeric check (seen_price is null or (seen_price > 0 and seen_price < 10000000)),
  note text check (length(note) <= 300),
  page_url text check (length(page_url) <= 600),
  user_id uuid,
  status text not null default 'new' check (status in ('new','fixed','ok','spam'))
);
create index if not exists pp_price_reports_new on public.pp_price_reports (status, created_at desc);
alter table public.pp_price_reports enable row level security;   -- only through the functions below

-- shopper: send a report (max 30 per product per day, so a script cannot flood it)
create or replace function public.pp_price_report_add(p_product text, p_store text, p_price numeric, p_note text, p_url text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_product is null or length(trim(p_product)) = 0 then return jsonb_build_object('ok', false, 'error', 'product'); end if;
  if (select count(*) from public.pp_price_reports where product_id = p_product and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('ok', true, 'note', 'already reported'); end if;
  insert into public.pp_price_reports (product_id, store, seen_price, note, page_url, user_id)
  values (left(trim(p_product), 120), left(nullif(trim(p_store), ''), 60), case when p_price > 0 and p_price < 10000000 then p_price end,
          left(nullif(trim(p_note), ''), 300), left(nullif(trim(p_url), ''), 600), auth.uid());
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.pp_price_report_add(text, text, numeric, text, text) to anon, authenticated;

-- admin: reports + status
create or replace function public.pp_price_reports_admin()
returns jsonb language sql security definer set search_path = public as $$
  select case when not public.pp_ext_is_admin() then jsonb_build_object('ok', false) else jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(x) from (select r.*, p.name from public.pp_price_reports r left join public.pp_catalog_products p on p.product_id = r.product_id
      where r.status = 'new' order by r.created_at desc limit 60) x), '[]'::jsonb)) end;
$$;
create or replace function public.pp_price_report_set(p_id bigint, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false); end if;
  update public.pp_price_reports set status = p_status where id = p_id and p_status in ('new','fixed','ok','spam');
  return jsonb_build_object('ok', true);
end $$;

-- P6: published verified prices that look wrong next to that product's own 30-day history (median of daily lows),
-- or that sit far from the other stores' prices for the same product. Admin checks them; nothing is changed automatically.
create or replace function public.pp_price_sanity_admin()
returns jsonb language sql security definer set search_path = public as $$
  with cur as (
    select r.product_id, r.retailer, r.price, r.checked_at from public.pp_retailer_prices r
    where r.published and r.availability = 'in_stock' and r.expires_at > now()),
  daily as (
    select h.product_id, (h.checked_at at time zone 'Asia/Kolkata')::date d, min(h.price) p from public.pp_retailer_price_history h
    where h.availability = 'in_stock' and h.checked_at >= now() - interval '30 days' and h.checked_at < now() - interval '20 hours' group by 1, 2),
  med as (select product_id, percentile_cont(0.5) within group (order by p) m, count(*) n from daily group by 1),
  others as (select c.product_id, c.retailer, (select percentile_cont(0.5) within group (order by o.price) from cur o where o.product_id = c.product_id and o.retailer <> c.retailer) om,
             (select count(*) from cur o where o.product_id = c.product_id and o.retailer <> c.retailer) on_ from cur c)
  select case when not public.pp_ext_is_admin() then jsonb_build_object('ok', false) else jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(x order by x.gap desc) from (
      select c.product_id, p.name, c.retailer, c.price, c.checked_at, round(m.m::numeric, 0) median30, round(o.om::numeric, 0) others_median,
        case when m.n >= 3 and c.price < m.m * 0.55 then 'Much lower than its 30-day usual price - wrong variant or MRP mix-up?'
             when m.n >= 3 and c.price > m.m * 1.8 then 'Much higher than its 30-day usual price'
             when o.on_ >= 2 and c.price < o.om * 0.5 then 'Half the price of the other stores - check variant'
             when o.on_ >= 2 and c.price > o.om * 2 then 'Double the price of the other stores' end why,
        greatest(abs(c.price - coalesce(m.m, c.price)) / c.price, abs(c.price - coalesce(o.om, c.price)) / c.price) gap
      from cur c join others o on o.product_id = c.product_id and o.retailer = c.retailer
      left join med m on m.product_id = c.product_id
      left join public.pp_catalog_products p on p.product_id = c.product_id
      where (m.n >= 3 and (c.price < m.m * 0.55 or c.price > m.m * 1.8)) or (o.on_ >= 2 and (c.price < o.om * 0.5 or c.price > o.om * 2))
      limit 60) x), '[]'::jsonb)) end;
$$;
revoke all on function public.pp_price_reports_admin() from public, anon;
revoke all on function public.pp_price_report_set(bigint, text) from public, anon;
revoke all on function public.pp_price_sanity_admin() from public, anon;
grant execute on function public.pp_price_reports_admin() to authenticated;
grant execute on function public.pp_price_report_set(bigint, text) to authenticated;
grant execute on function public.pp_price_sanity_admin() to authenticated;
