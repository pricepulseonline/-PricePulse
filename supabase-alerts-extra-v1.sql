-- PricePulse AI-PLAN Q10 (back-in-stock alert) + M (price alerts on Telegram) + P8 (weekly price email, opt-in).
-- Run ONCE in Supabase > SQL Editor (after supabase-telegram-v1.sql). Old deal-alert tables/functions are NOT changed.
-- Sending: Edge Function "alerts-extra" (cron every hour, below). Uses BREVO_API_KEY + ALERT_FROM (same as send-deal-alerts)
-- and TELEGRAM_BOT_TOKEN.

-- ---------- Q10: back in stock ----------
create table if not exists public.pp_stock_alerts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id ~ '^[a-z0-9-]+$'),
  product_name text not null default '' check (length(product_name) <= 200),
  email_to text,
  status text not null default 'waiting' check (status in ('waiting','sent')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_price numeric, sent_retailer text,
  unique (user_id, product_id)
);
alter table public.pp_stock_alerts enable row level security;

create or replace function public.pp_stock_alert_toggle(p_product text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_on boolean;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'sign in'); end if;
  if exists (select 1 from public.pp_stock_alerts where user_id = v_uid and product_id = p_product and status = 'waiting') then
    delete from public.pp_stock_alerts where user_id = v_uid and product_id = p_product; v_on := false;
  else
    if (select count(*) from public.pp_stock_alerts where user_id = v_uid and status = 'waiting') >= 20 then return jsonb_build_object('ok', false, 'error', 'max 20'); end if;
    insert into public.pp_stock_alerts (user_id, product_id, product_name, email_to)
    values (v_uid, p_product, left(coalesce(p_name, ''), 200), (select email from auth.users where id = v_uid))
    on conflict (user_id, product_id) do update set status = 'waiting', created_at = now(), sent_at = null, product_name = excluded.product_name, email_to = excluded.email_to;
    v_on := true;
  end if;
  return jsonb_build_object('ok', true, 'on', v_on);
end $$;
create or replace function public.pp_stock_alert_status(p_product text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', auth.uid() is not null, 'on', exists (select 1 from public.pp_stock_alerts where user_id = auth.uid() and product_id = p_product and status = 'waiting'));
$$;
grant execute on function public.pp_stock_alert_toggle(text, text) to authenticated;
grant execute on function public.pp_stock_alert_status(text) to anon, authenticated;

-- ---------- M: link a Telegram chat to the account ----------
alter table if exists public.pp_tg_settings add column if not exists bot_username text not null default '';   -- e.g. PricePulseBot (without @)
create table if not exists public.pp_tg_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint unique,
  code text unique,
  code_until timestamptz,
  linked_at timestamptz
);
alter table public.pp_tg_links enable row level security;
create table if not exists public.pp_tg_alert_sent (
  alert_id uuid not null,
  triggered_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (alert_id, triggered_at)
);
alter table public.pp_tg_alert_sent enable row level security;

create or replace function public.pp_tg_link_code()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_code text := substr(md5(random()::text || clock_timestamp()::text), 1, 12); v_bot text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'sign in'); end if;
  select bot_username into v_bot from public.pp_tg_settings where id = 1;
  if coalesce(v_bot, '') = '' then return jsonb_build_object('ok', false, 'error', 'bot not set'); end if;
  insert into public.pp_tg_links (user_id, code, code_until) values (v_uid, v_code, now() + interval '30 minutes')
  on conflict (user_id) do update set code = excluded.code, code_until = excluded.code_until;
  return jsonb_build_object('ok', true, 'url', 'https://t.me/' || v_bot || '?start=' || v_code);
end $$;
create or replace function public.pp_tg_link_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', auth.uid() is not null, 'linked', exists (select 1 from public.pp_tg_links where user_id = auth.uid() and chat_id is not null));
$$;
create or replace function public.pp_tg_unlink()
returns jsonb language sql security definer set search_path = public as $$
  update public.pp_tg_links set chat_id = null, linked_at = null where user_id = auth.uid() returning jsonb_build_object('ok', true);
$$;
grant execute on function public.pp_tg_link_code() to authenticated;
grant execute on function public.pp_tg_link_status() to authenticated;
grant execute on function public.pp_tg_unlink() to authenticated;

-- ---------- P8: weekly price email (only for people who switch it on) ----------
create table if not exists public.pp_digest_optin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  enabled boolean not null default true,
  last_sent timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.pp_digest_optin enable row level security;
create or replace function public.pp_digest_set(p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'sign in'); end if;
  insert into public.pp_digest_optin (user_id, email, enabled) values (auth.uid(), (select email from auth.users where id = auth.uid()), p_on)
  on conflict (user_id) do update set enabled = p_on, email = excluded.email, updated_at = now();
  return jsonb_build_object('ok', true, 'on', p_on);
end $$;
create or replace function public.pp_digest_get()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', auth.uid() is not null, 'on', coalesce((select enabled from public.pp_digest_optin where user_id = auth.uid()), false));
$$;
grant execute on function public.pp_digest_set(boolean) to authenticated;
grant execute on function public.pp_digest_get() to authenticated;

-- current best verified price per product (published, in stock, not expired) - used by the sender
create or replace function public.pp_best_now(p_ids text[])
returns table (product_id text, price numeric, retailer text)
language sql stable security definer set search_path = public as $$
  select distinct on (r.product_id) r.product_id, r.price, r.retailer from public.pp_retailer_prices r
  where r.product_id = any(p_ids) and r.published and r.availability = 'in_stock' and r.expires_at > now()
  order by r.product_id, r.price asc;
$$;
revoke all on function public.pp_best_now(text[]) from public, anon, authenticated;

-- cron: every hour at :40
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    if exists (select 1 from cron.job where jobname = 'alerts-extra') then perform cron.unschedule('alerts-extra'); end if;
    perform cron.schedule('alerts-extra', '40 * * * *',
      $job$ select net.http_post(url := 'https://akdrydxbvdtadmcphhxj.supabase.co/functions/v1/alerts-extra',
        headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 5000) $job$);
  else
    raise notice 'pg_cron / pg_net not enabled: add the job in Supabase > Integrations > Cron instead (every hour, POST alerts-extra).';
  end if;
end $$;
-- After deploy: update pp_tg_settings set bot_username = 'YourBotName';   (without @)
