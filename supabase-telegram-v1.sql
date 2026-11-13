-- PricePulse AI-PLAN F: Telegram deal channel auto-post - run ONCE in Supabase > SQL Editor.
-- A verified price (Admin-checked, published, in stock, not expired) that is clearly below its 30-day average is posted
-- to the Telegram channel with photo + affiliate link. Same product again only after repost_days, unless the price fell 3% more.
-- Starts OFF. Turn on after the bot works:  update pp_tg_settings set enabled = true, chat_id = '@your_channel';

create table if not exists public.pp_tg_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  chat_id text not null default '',            -- '@pricepulse_in' (public channel) or the numeric id; the bot must be an admin of the channel
  max_per_run int not null default 2,          -- posts per run (cron runs every 2 hours)
  min_drop_pct numeric not null default 5,     -- at least this % below the 30-day average
  min_days int not null default 5,             -- needs this many days of price history in the last 30 days
  repost_days int not null default 7,
  quiet_start int not null default 22,         -- no posts from 22:00 ...
  quiet_end int not null default 9,            -- ... to 09:00 India time
  skip_amazon boolean not null default true,   -- Amazon Associates: prices of Amazon only from their API -> not posted
  site_url text not null default 'https://price-pulse.in',
  updated_at timestamptz not null default now()
);
insert into public.pp_tg_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.pp_tg_posts (
  id bigserial primary key,
  posted_at timestamptz not null default now(),
  product_id text not null,
  retailer text,
  price numeric,
  avg30 numeric,
  chat_id text,
  message_id bigint,
  ok boolean not null default false,
  error text
);
create index if not exists pp_tg_posts_product on public.pp_tg_posts (product_id, posted_at desc);
alter table public.pp_tg_settings enable row level security;
alter table public.pp_tg_posts enable row level security;

create or replace function public.pp_tg_candidates(p_min_drop numeric, p_min_days int, p_repost_days int, p_skip_amazon boolean, p_limit int)
returns table (product_id text, name text, image_url text, category text, retailer text, price numeric, checked_at timestamptz,
               avg30 numeric, low30 numeric, days30 int, url text)
language sql stable security definer set search_path = public as $$
  with cur as (
    select distinct on (r.product_id) r.product_id, r.retailer, r.price, r.checked_at
    from public.pp_retailer_prices r
    where r.published and r.availability = 'in_stock' and r.expires_at > now()
      and not (p_skip_amazon and lower(r.retailer) = 'amazon')
    order by r.product_id, r.price asc, r.checked_at desc
  ),
  daily as (   -- lowest verified in-stock price per product per day (India date), last 30 days
    select h.product_id, (h.checked_at at time zone 'Asia/Kolkata')::date d, min(h.price) p
    from public.pp_retailer_price_history h
    where h.availability = 'in_stock' and h.checked_at >= now() - interval '30 days'
    group by 1, 2
  ),
  stats as (select d.product_id, avg(d.p) avg30, min(d.p) low30, count(*)::int days30 from daily d group by 1)
  select c.product_id, p.name, p.image_url, p.category, c.retailer, c.price, c.checked_at,
         round(s.avg30, 2), s.low30, s.days30,
         coalesce(nullif(l.affiliate_url, ''), nullif(l.direct_url, ''))
  from cur c
  join public.pp_catalog_products p on p.product_id = c.product_id and p.status = 'active'
  join stats s on s.product_id = c.product_id
  left join public.pp_catalog_stores st on lower(st.name) = lower(c.retailer) or st.slug = lower(regexp_replace(c.retailer, '[^A-Za-z0-9]+', '-', 'g'))
  left join public.pp_product_store_listings l on l.product_id = c.product_id and l.store_slug = st.slug and l.active
  where s.days30 >= p_min_days
    and c.price <= s.avg30 * (1 - p_min_drop / 100.0)
    and coalesce(nullif(l.affiliate_url, ''), nullif(l.direct_url, '')) is not null
    and not exists (select 1 from public.pp_tg_posts t where t.product_id = c.product_id and t.ok
                    and t.posted_at > now() - make_interval(days => p_repost_days) and c.price > t.price * 0.97)
  order by (s.avg30 - c.price) / s.avg30 desc
  limit greatest(1, least(p_limit, 10));
$$;
revoke all on function public.pp_tg_candidates(numeric, int, int, boolean, int) from public, anon, authenticated;

-- cron: every 2 hours (the function itself keeps quiet hours)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    if exists (select 1 from cron.job where jobname = 'telegram-deals') then perform cron.unschedule('telegram-deals'); end if;
    perform cron.schedule('telegram-deals', '15 */2 * * *',
      $job$ select net.http_post(url := 'https://akdrydxbvdtadmcphhxj.supabase.co/functions/v1/telegram-deals',
        headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 5000) $job$);
  else
    raise notice 'pg_cron / pg_net not enabled: add the job in Supabase > Integrations > Cron instead (every 2 hours, POST telegram-deals).';
  end if;
end $$;

-- Checks:
--   select * from pp_tg_candidates(5, 5, 7, true, 10);       -- what would be posted now
--   select * from pp_tg_posts order by id desc limit 20;
--   update pp_tg_settings set enabled = true, chat_id = '@your_channel';
