-- PricePulse extension 2.0.0: "Best deals on PricePulse" row in the History tab
-- Run once in Supabase > SQL Editor. Safe to run again.
--
-- Returns up to p_limit products whose lowest published price is at least 3% below their own
-- 30-day average (same store, verified history only). Products in the same category as
-- p_product_id come first, then the biggest drop. p_product_id itself is left out.
-- Only rows that are already public on the site are used (published + display_permitted,
-- in stock, not expired). Nothing private is returned.

create or replace function public.pp_ext_deals(p_product_id text default null, p_limit integer default 4)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with cur as (
    select distinct on (r.product_id) r.product_id, r.retailer, r.price
    from public.pp_retailer_prices r
    where r.published and r.display_permitted
      and r.availability = 'in_stock'
      and r.expires_at > now()
    order by r.product_id, r.price asc
  ),
  avg30 as (
    select c.product_id, avg(h.price) as avg_price, count(*) as n
    from cur c
    join public.pp_retailer_price_history h
      on h.product_id = c.product_id and h.retailer = c.retailer
     and h.display_permitted and h.availability = 'in_stock'
     and h.checked_at >= now() - interval '30 days'
    group by c.product_id
  ),
  me as (
    select category from public.pp_catalog_products where product_id = p_product_id
  ),
  d as (
    select c.product_id, p.name, p.image_url, c.retailer, c.price,
           round(a.avg_price)::int as avg30,
           round(a.avg_price - c.price)::int as drop_rs,
           round(((a.avg_price - c.price) / a.avg_price * 100)::numeric, 1) as drop_pct,
           (p.category = (select category from me)) as same_cat
    from cur c
    join avg30 a on a.product_id = c.product_id
    join public.pp_catalog_products p on p.product_id = c.product_id and p.status = 'active'
    where a.n >= 2
      and c.price <= a.avg_price * 0.97
      and (p_product_id is null or c.product_id <> p_product_id)
  )
  select coalesce(jsonb_agg(to_jsonb(x) - 'same_cat'), '[]'::jsonb)
  from (
    select * from d
    order by coalesce(same_cat, false) desc, drop_pct desc
    limit least(greatest(coalesce(p_limit, 4), 1), 12)
  ) x;
$$;

revoke all on function public.pp_ext_deals(text, integer) from public;
grant execute on function public.pp_ext_deals(text, integer) to anon, authenticated;

-- quick check (should return a JSON list, maybe empty while history is still short):
-- select public.pp_ext_deals(null, 4);
