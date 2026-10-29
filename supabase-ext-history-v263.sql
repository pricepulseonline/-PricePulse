-- PricePulse V263: public read of "price seen by shoppers" history for ONE store + product code.
-- Run once in the Supabase SQL editor. Safe to re-run. Returns only the daily lowest price + date (no urls, no user data).
create or replace function public.pp_ext_seen_history(p_store text, p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if p_store is null or p_store !~ '^[a-z0-9-]{2,40}$' then return '[]'::jsonb; end if;
  if p_key is null or p_key !~ '^[A-Za-z0-9_-]{3,120}$' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('d', d, 'p', p) order by d), '[]'::jsonb) into v
    from (
      select (seen_at at time zone 'Asia/Kolkata')::date as d, min(price) as p
        from public.pp_ext_price_seen
       where store = p_store and product_key = p_key
         and in_stock and seen_at > now() - interval '180 days'
       group by 1
    ) t;
  return v;
end;
$$;
revoke all on function public.pp_ext_seen_history(text, text) from public;
grant execute on function public.pp_ext_seen_history(text, text) to anon, authenticated;
