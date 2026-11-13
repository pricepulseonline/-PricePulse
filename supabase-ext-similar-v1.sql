-- PricePulse extension 2.1: "Similar products" row in the History tab
-- Run once in Supabase > SQL Editor. Safe to run again.
--
-- Returns up to p_limit in-stock products that look like the one the person is viewing:
--   * same category as p_product_id (when the product is on PricePulse), or
--   * at least 2 words of p_query (the page title) found in the product name (when it is not).
-- Best word match first, then cheapest. p_product_id itself is left out.
-- Only rows that are already public on the site are used (published + display_permitted,
-- in stock, not expired). Nothing private is returned.

create or replace function public.pp_ext_similar(p_product_id text default null, p_query text default null, p_limit integer default 4)
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
  me as (
    select category from public.pp_catalog_products where product_id = p_product_id
  ),
  words as (
    select distinct w
    from unnest(regexp_split_to_array(lower(coalesce(p_query, '')), '[^a-z0-9]+')) as w
    where length(w) >= 4
  ),
  d as (
    select c.product_id, p.name, p.image_url, c.retailer, c.price,
           (p.category is not null and p.category = (select category from me)) as same_cat,
           (select count(*) from words wd where lower(p.name) like '%' || wd.w || '%') as hits
    from cur c
    join public.pp_catalog_products p on p.product_id = c.product_id and p.status = 'active'
    where p_product_id is null or c.product_id <> p_product_id
  )
  select coalesce(jsonb_agg(to_jsonb(x) - 'same_cat' - 'hits'), '[]'::jsonb)
  from (
    select * from d
    where same_cat or hits >= 2
    order by same_cat desc, hits desc, price asc
    limit least(greatest(coalesce(p_limit, 4), 1), 12)
  ) x;
$$;

revoke all on function public.pp_ext_similar(text, text, integer) from public;
grant execute on function public.pp_ext_similar(text, text, integer) to anon, authenticated;

-- quick check (should return a JSON list, maybe empty):
-- select public.pp_ext_similar(null, 'prestige gas stove 3 burner', 4);
