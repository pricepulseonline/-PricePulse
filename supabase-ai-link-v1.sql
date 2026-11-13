-- PricePulse AI link compare (Plan A, AI-1) - run ONCE in Supabase > SQL Editor.
-- Tables are read/written only by the Edge Function (service role). The site never reads them directly.

create table if not exists public.pp_ai_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  model text not null default 'claude-haiku-5-5',          -- first try (cheap)
  fallback_model text not null default 'claude-sonnet-5-5', -- only when the first model cannot name the product; '' = off
  max_searches int not null default 3,                      -- web searches per new link
  cache_hours int not null default 12,                      -- same link again inside this time = free (from cache)
  monthly_budget_inr numeric not null default 3000,         -- hard cap; over it the site shows normal search links only
  per_ip_daily int not null default 15,                     -- new links per visitor per 24 h
  usd_inr numeric not null default 88,
  rates jsonb not null default '{"haiku":{"in":0.10,"out":0.50},"sonnet":{"in":2,"out":10},"search":10,"gemini":{"in":0.75,"out":3.75},"gsearch":14}'::jsonb, -- USD per 1M tokens, search USD per 1,000
  provider text not null default 'claude',                  -- main finder: 'claude' or 'gemini'
  backup_provider text not null default 'gemini',           -- used when the main one fails: 'gemini', 'claude' or '' (off)
  gemini_model text not null default 'gemini-3.6-flash',
  updated_at timestamptz not null default now()
);
insert into public.pp_ai_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.pp_ai_link_cache (
  key text primary key,
  url text,
  result jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.pp_ai_usage (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  ip_hash text,
  link_key text,
  url text,
  model text,
  input_tokens int default 0,
  output_tokens int default 0,
  searches int default 0,
  cost_inr numeric default 0,
  ok boolean,
  rows int default 0,
  priced int default 0,
  note text
);
create index if not exists pp_ai_usage_ip_time on public.pp_ai_usage (ip_hash, created_at);
create index if not exists pp_ai_usage_time on public.pp_ai_usage (created_at);

alter table public.pp_ai_settings enable row level security;
alter table public.pp_ai_link_cache enable row level security;
alter table public.pp_ai_usage enable row level security;
-- no policies = only the service role (Edge Function) can use them

create or replace function public.pp_ai_spent_since(p_since timestamptz)
returns numeric language sql security definer set search_path = public as $$
  select coalesce(sum(cost_inr), 0) from public.pp_ai_usage where created_at >= p_since;
$$;
revoke all on function public.pp_ai_spent_since(timestamptz) from public, anon, authenticated;
grant execute on function public.pp_ai_spent_since(timestamptz) to service_role;

-- in case the table was made by an older copy of this file
alter table public.pp_ai_settings add column if not exists provider text not null default 'claude';
alter table public.pp_ai_settings add column if not exists backup_provider text not null default 'gemini';
alter table public.pp_ai_settings add column if not exists gemini_model text not null default 'gemini-3.6-flash';
alter table public.pp_ai_usage add column if not exists kind text default 'compare'; -- compare | fill

-- ---------- Admin (Admin > Growth > "AI link compare") - uses the existing pp_ext_is_admin() ----------
create or replace function public.pp_ai_admin_summary()
returns jsonb language plpgsql security definer set search_path = public as $$
declare m timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  return jsonb_build_object('ok', true,
    'settings', (select to_jsonb(s) from public.pp_ai_settings s where id = 1),
    'month', (select jsonb_build_object('links', count(*), 'ok', count(*) filter (where ok), 'searches', coalesce(sum(searches),0), 'rs', round(coalesce(sum(cost_inr),0),2), 'priced_rows', coalesce(sum(priced),0), 'rows', coalesce(sum(rows),0)) from public.pp_ai_usage where created_at >= m),
    'today', (select jsonb_build_object('links', count(*), 'rs', round(coalesce(sum(cost_inr),0),2)) from public.pp_ai_usage where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'),
    'cache', (select count(*) from public.pp_ai_link_cache),
    'last', coalesce((select jsonb_agg(x) from (select id, created_at, kind, model, url, rows, priced, searches, cost_inr, ok, note from public.pp_ai_usage order by id desc limit 25) x), '[]'::jsonb));
end $$;

create or replace function public.pp_ai_settings_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  update public.pp_ai_settings set
    enabled = coalesce((p->>'enabled')::boolean, enabled),
    provider = case when p->>'provider' in ('claude','gemini') then p->>'provider' else provider end,
    backup_provider = case when p->>'backup_provider' in ('claude','gemini','') then p->>'backup_provider' else backup_provider end,
    model = coalesce(nullif(trim(p->>'model'),''), model),
    fallback_model = case when p ? 'fallback_model' then coalesce(trim(p->>'fallback_model'),'') else fallback_model end,
    gemini_model = coalesce(nullif(trim(p->>'gemini_model'),''), gemini_model),
    max_searches = least(8, greatest(1, coalesce((p->>'max_searches')::int, max_searches))),
    cache_hours = least(168, greatest(1, coalesce((p->>'cache_hours')::int, cache_hours))),
    monthly_budget_inr = greatest(0, coalesce((p->>'monthly_budget_inr')::numeric, monthly_budget_inr)),
    per_ip_daily = least(500, greatest(1, coalesce((p->>'per_ip_daily')::int, per_ip_daily))),
    usd_inr = greatest(1, coalesce((p->>'usd_inr')::numeric, usd_inr)),
    rates = case when jsonb_typeof(p->'rates') = 'object' then p->'rates' else rates end,
    updated_at = now()
  where id = 1;
  return jsonb_build_object('ok', true);
end $$;

-- clear the cache: one link (its key) or everything (null)
create or replace function public.pp_ai_cache_clear(p_key text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  if p_key is null then delete from public.pp_ai_link_cache; else delete from public.pp_ai_link_cache where key = p_key; end if;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'deleted', n);
end $$;

revoke all on function public.pp_ai_admin_summary() from public, anon;
revoke all on function public.pp_ai_settings_save(jsonb) from public, anon;
revoke all on function public.pp_ai_cache_clear(text) from public, anon;
grant execute on function public.pp_ai_admin_summary() to authenticated;
grant execute on function public.pp_ai_settings_save(jsonb) to authenticated;
grant execute on function public.pp_ai_cache_clear(text) to authenticated;

-- Handy checks (run any time):
-- select * from pp_ai_settings;
-- select date(created_at) d, count(*) links, sum(searches) searches, round(sum(cost_inr),2) rs from pp_ai_usage group by 1 order by 1 desc;
-- select created_at, model, rows, priced, cost_inr, ok, url, note from pp_ai_usage order by id desc limit 20;
-- update pp_ai_settings set enabled = false;            -- AI off (site falls back to search links)
-- update pp_ai_settings set monthly_budget_inr = 1000;  -- change the cap
