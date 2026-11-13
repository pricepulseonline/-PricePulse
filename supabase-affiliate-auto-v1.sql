-- PricePulse V2.1 - Affiliate AUTO: the daily Cuelinks sync also records, per store, whether we may send shoppers
-- through Cuelinks links (campaign found and not paused / rejected / closed). The website and the Chrome extension read it
-- through pp_affiliate_auto(). Run once in Supabase > SQL Editor, then redeploy the Edge Function cuelinks-rates.
-- Needs supabase-cashback-v278.sql (pp_cashback_campaigns) and supabase-admin-catalog-v77.sql (pp_catalog_stores).

alter table public.pp_cashback_campaigns add column if not exists access_status text;
alter table public.pp_cashback_campaigns add column if not exists link_allowed boolean not null default false;

-- public: active catalog stores (not Amazon) + domain + what Cuelinks said at the last sync. No secrets in it.
create or replace function public.pp_affiliate_auto()
returns jsonb
language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'store', s.name, 'slug', s.slug, 'domain', s.domain,
      'link_allowed', coalesce(c.link_allowed, false),
      'status', coalesce(nullif(c.access_status, ''), c.status, 'no_campaign'),
      'synced_at', c.synced_at) order by s.name), '[]'::jsonb)
  from public.pp_catalog_stores s
  left join public.pp_cashback_campaigns c on c.store = s.name
  where s.active and lower(s.slug) not like 'amazon%';
$$;
revoke all on function public.pp_affiliate_auto() from public;
grant execute on function public.pp_affiliate_auto() to anon, authenticated;

-- check:  select public.pp_affiliate_auto();
