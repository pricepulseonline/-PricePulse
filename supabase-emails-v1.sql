-- PricePulse EMAILS V1 (13 Nov 2026): one mail queue for all PricePulse emails (design locked, claude/EMAIL-PLAN.md).
-- Run ONCE in Supabase > SQL Editor. Safe to run again.
-- Sender: Edge Function "send-deal-alerts" (already runs every 10 min) now sends price alerts AND this queue.
-- Every new mail type starts OFF. Test one by one with:   select public.pp_email_test('welcome', 'you@gmail.com');
-- After a test is "done", switch that type on:          update public.pp_email_types set enabled = true where type = 'welcome';

-- 0) extension / app links for the footer (empty = "Coming soon")
alter table public.pp_alert_delivery_settings add column if not exists extension_url text;
alter table public.pp_alert_delivery_settings add column if not exists app_url text;

-- 1) which mail types are switched on
create table if not exists public.pp_email_types (
  type text primary key,
  enabled boolean not null default false,
  note text
);
insert into public.pp_email_types (type, enabled, note) values
  ('welcome',           false, '3  first sign in'),
  ('weekly',            false, '4  Sunday, opt-in only (hello@)'),
  ('upgrade',           false, '5  Free alerts full, once (hello@) - switch on after payment is live'),
  ('support_autoreply', false, '6  someone writes to support@'),
  ('receipt',           false, '7  after payment - switch on with payment'),
  ('renew',             false, '8  30 and 7 days before Plus ends - switch on with payment'),
  ('expired',           false, '9  Plus / Pro ended - switch on with payment'),
  ('support_reply',     true,  '10 your own reply: select pp_email_support_reply(...)')
on conflict (type) do nothing;
alter table public.pp_email_types enable row level security;
revoke all on public.pp_email_types from public, anon, authenticated;

-- 2) the queue (private: browsers can not read or write it)
create table if not exists public.pp_email_queue (
  id bigint generated always as identity primary key,
  type text not null references public.pp_email_types(type),
  user_id uuid references auth.users(id) on delete cascade,
  email_to text not null,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text,
  error_message text
);
create index if not exists pp_email_queue_pending on public.pp_email_queue (created_at) where status = 'pending';
alter table public.pp_email_queue enable row level security;
revoke all on public.pp_email_queue from public, anon, authenticated;

-- 3) marketing unsubscribe (weekly + upgrade). One token per person.
create table if not exists public.pp_email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  marketing_off boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.pp_email_prefs enable row level security;
revoke all on public.pp_email_prefs from public, anon, authenticated;

create or replace function public.pp_email_unsubscribe(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  update public.pp_email_prefs set marketing_off = true, updated_at = now() where token = p_token returning user_id into v_uid;
  if v_uid is null then return false; end if;
  update public.pp_digest_optin set enabled = false, updated_at = now() where user_id = v_uid;
  return true;
end $$;
revoke all on function public.pp_email_unsubscribe(uuid) from public, anon, authenticated;

-- 4) add a mail to the queue (only if its type is on, unless p_force). Same dedupe_key = sent once.
create or replace function public.pp_email_enqueue(p_type text, p_uid uuid, p_email text, p_data jsonb, p_key text, p_force boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return null; end if;
  if not p_force and not coalesce((select enabled from public.pp_email_types where type = p_type), false) then return null; end if;
  insert into public.pp_email_queue (type, user_id, email_to, data, dedupe_key)
  values (p_type, p_uid, lower(trim(p_email)), coalesce(p_data, '{}'::jsonb), p_key)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.pp_email_enqueue(text, uuid, text, jsonb, text, boolean) from public, anon, authenticated;

-- 5) WELCOME (3): first successful sign in. Never blocks a login.
create or replace function public.pp_email_on_first_login()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if old.last_sign_in_at is null and new.last_sign_in_at is not null and new.email is not null then
      perform public.pp_email_enqueue('welcome', new.id, new.email, '{}'::jsonb, 'welcome:' || new.id);
    end if;
  exception when others then null;
  end;
  return new;
end $$;
revoke all on function public.pp_email_on_first_login() from public, anon, authenticated;
drop trigger if exists pp_email_first_login on auth.users;
create trigger pp_email_first_login after update of last_sign_in_at on auth.users
for each row execute function public.pp_email_on_first_login();

-- 6) UPGRADE (5): the moment a Free user fills all Free alerts. Once per person. Never blocks saving an alert.
create or replace function public.pp_email_on_alert_full()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit integer; v_count integer; v_email text;
begin
  begin
    if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
      v_limit := public.pp_plan_alert_limit(new.user_id);
      if v_limit is not null and not public.pp_plan_plus_active(new.user_id) then
        select count(*) into v_count from public.pp_deal_alerts where user_id = new.user_id and status = 'active';
        if v_count >= v_limit then
          select email into v_email from auth.users where id = new.user_id;
          perform public.pp_email_enqueue('upgrade', new.user_id, v_email, jsonb_build_object('limit', v_limit), 'upgrade:' || new.user_id);
        end if;
      end if;
    end if;
  exception when others then null;
  end;
  return new;
end $$;
revoke all on function public.pp_email_on_alert_full() from public, anon, authenticated;
drop trigger if exists pp_email_alert_full on public.pp_deal_alerts;
create trigger pp_email_alert_full after insert or update of status on public.pp_deal_alerts
for each row execute function public.pp_email_on_alert_full();

-- 7) RENEW (8) + EXPIRED (9): once a day. Only real membership rows (not the Master Plus switch).
create or replace function public.pp_email_daily()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select m.user_id, u.email, m.expires_at, m.pro_until from public.pp_plus_memberships m join auth.users u on u.id = m.user_id
    where m.status = 'active' and m.expires_at is not null
  loop
    -- renew: 30 days and 7 days before Plus ends (only one mail if already inside 7 days)
    if r.expires_at > now() + interval '7 days' and r.expires_at <= now() + interval '30 days' then
      if public.pp_email_enqueue('renew', r.user_id, r.email,
           jsonb_build_object('expires_at', r.expires_at, 'days_left', ceil(extract(epoch from r.expires_at - now()) / 86400)),
           'renew30:' || r.user_id || ':' || r.expires_at::date) is not null then n := n + 1; end if;
    end if;
    if r.expires_at > now() and r.expires_at <= now() + interval '7 days' then
      if public.pp_email_enqueue('renew', r.user_id, r.email,
           jsonb_build_object('expires_at', r.expires_at, 'days_left', ceil(extract(epoch from r.expires_at - now()) / 86400)),
           'renew7:' || r.user_id || ':' || r.expires_at::date) is not null then n := n + 1; end if;
    end if;
    -- expired: Plus ended in the last 3 days
    if r.expires_at <= now() and r.expires_at > now() - interval '3 days' then
      if public.pp_email_enqueue('expired', r.user_id, r.email, jsonb_build_object('plan', 'Plus', 'ended_at', r.expires_at),
           'expired-plus:' || r.user_id || ':' || r.expires_at::date) is not null then n := n + 1; end if;
    -- Pro ended in the last 3 days while Plus is still on
    elsif r.pro_until is not null and r.pro_until <= now() and r.pro_until > now() - interval '3 days' then
      if public.pp_email_enqueue('expired', r.user_id, r.email, jsonb_build_object('plan', 'Pro', 'ended_at', r.pro_until),
           'expired-pro:' || r.user_id || ':' || r.pro_until::date) is not null then n := n + 1; end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.pp_email_daily() from public, anon, authenticated;

-- 8) RECEIPT (7): the payment webhook (Section 14) will call this. Nothing calls it yet.
--    select public.pp_email_receipt('<user uuid>', 'Plus', 99, 'pay_123', now() + interval '1 year', null);
create or replace function public.pp_email_receipt(p_uid uuid, p_plan text, p_amount numeric, p_ref text, p_valid_until timestamptz, p_pro_until timestamptz default null)
returns bigint language sql security definer set search_path = public as $$
  select public.pp_email_enqueue('receipt', p_uid, (select email from auth.users where id = p_uid),
    jsonb_build_object('plan', p_plan, 'amount', p_amount, 'ref', p_ref, 'paid_at', now(), 'valid_until', p_valid_until, 'pro_until', p_pro_until),
    'receipt:' || coalesce(p_ref, gen_random_uuid()::text));
$$;
revoke all on function public.pp_email_receipt(uuid, text, numeric, text, timestamptz, timestamptz) from public, anon, authenticated;

-- 9) SUPPORT REPLY (10): your own answer in the PricePulse design, from support@ (run in SQL Editor).
--    select public.pp_email_support_reply('shopper@gmail.com', 'Your alert question', 'Hi! Your alert is active. ...');
create or replace function public.pp_email_support_reply(p_email text, p_subject text, p_message text)
returns bigint language sql security definer set search_path = public as $$
  select public.pp_email_enqueue('support_reply', (select id from auth.users where lower(email) = lower(trim(p_email)) limit 1), p_email,
    jsonb_build_object('subject', left(coalesce(p_subject, ''), 150), 'message', left(coalesce(p_message, ''), 5000)),
    'support:' || gen_random_uuid(), true);
$$;
revoke all on function public.pp_email_support_reply(text, text, text) from public, anon, authenticated;

-- 10) TEST any mail type to your own inbox, even while that type is OFF (SQL Editor only).
--     types: welcome, weekly, upgrade, support_autoreply, receipt, renew, expired, support_reply
create or replace function public.pp_email_test(p_type text, p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_data jsonb; v_items jsonb;
begin
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if p_type = 'weekly' then
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
      select distinct on (r.product_id) r.product_id, coalesce(c.name, r.product_id) as name, r.price as now, r.retailer, null::numeric as week, null::text as image
      from public.pp_retailer_prices r left join public.pp_catalog_products c on c.product_id = r.product_id
      where r.published and r.availability = 'in_stock' order by r.product_id, r.price limit 3) x;
    v_data := jsonb_build_object('items', v_items);
  elsif p_type = 'upgrade' then v_data := jsonb_build_object('limit', 3);
  elsif p_type = 'support_autoreply' then v_data := jsonb_build_object('subject', 'Question about my price alert');
  elsif p_type = 'receipt' then v_data := jsonb_build_object('plan', 'Plus + Pro (3 months)', 'amount', 199, 'ref', 'TEST-0001', 'paid_at', now(), 'valid_until', now() + interval '1 year', 'pro_until', now() + interval '3 months');
  elsif p_type = 'renew' then v_data := jsonb_build_object('expires_at', now() + interval '7 days', 'days_left', 7);
  elsif p_type = 'expired' then v_data := jsonb_build_object('plan', 'Plus', 'ended_at', now());
  elsif p_type = 'support_reply' then v_data := jsonb_build_object('subject', 'Your alert question', 'message', 'Hi! Thanks for writing to us.' || chr(10) || chr(10) || 'Your price alert is active. We will email you as soon as the price reaches your target.' || chr(10) || chr(10) || 'Team PricePulse');
  elsif p_type = 'welcome' then v_data := '{}'::jsonb;
  else return 'unknown type: ' || p_type;
  end if;
  perform public.pp_email_enqueue(p_type, v_uid, p_email, v_data || jsonb_build_object('test', true), 'test:' || p_type || ':' || gen_random_uuid(), true);
  return 'queued ' || p_type || ' -> ' || p_email || ' (arrives within 10 min)';
end $$;
revoke all on function public.pp_email_test(text, text) from public, anon, authenticated;

-- 11) daily job 10:00 IST for renew / expired
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'pp-email-daily') then perform cron.unschedule('pp-email-daily'); end if;
    perform cron.schedule('pp-email-daily', '30 4 * * *', 'select public.pp_email_daily()');
  else
    raise notice 'pg_cron not enabled: add a daily job in Supabase > Integrations > Cron: select public.pp_email_daily()';
  end if;
end $$;
