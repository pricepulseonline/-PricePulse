-- PricePulse extension 2.0.0: usage events (Buy click, alert set, login)
-- Run once in Supabase > SQL Editor. Safe to run again.

create table if not exists public.pp_ext_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null check (event in ('buy_click','alert_set','login')),
  store text,
  product_id text,
  ext_version text
);
create index if not exists pp_ext_events_created_idx on public.pp_ext_events (created_at desc);
alter table public.pp_ext_events enable row level security;
-- no policies: nobody reads or writes the table directly, only the two functions below

-- the extension calls this with the public key (insert only, whitelisted events)
create or replace function public.pp_ext_track(p_event text, p_store text default null, p_product_id text default null, p_ext text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.pp_ext_events (event, store, product_id, ext_version)
  select p_event, left(p_store, 40), left(p_product_id, 120), left(p_ext, 20)
  where p_event in ('buy_click','alert_set','login');
$$;
revoke all on function public.pp_ext_track(text, text, text, text) from public;
grant execute on function public.pp_ext_track(text, text, text, text) to anon, authenticated;

-- counts for Admin (same admin check as the other Admin > Extension functions)
create or replace function public.pp_ext_events_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.pp_ext_is_admin() then jsonb_build_object('ok', false) else jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('event', event, 'today', today, 'last7', last7, 'last30', last30, 'total', total) order by event)
    from (
      select event,
             count(*) filter (where created_at >= date_trunc('day', now())) as today,
             count(*) filter (where created_at >= now() - interval '7 days') as last7,
             count(*) filter (where created_at >= now() - interval '30 days') as last30,
             count(*) as total
      from public.pp_ext_events group by event
    ) t
  ), '[]'::jsonb)) end;
$$;
revoke all on function public.pp_ext_events_summary() from public;
grant execute on function public.pp_ext_events_summary() to anon, authenticated;

-- quick check (run after you click Buy / set an alert once):
-- select event, count(*) from public.pp_ext_events group by 1;
