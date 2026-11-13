-- PricePulse V283 (Step 2): plans (Free / Plus / Pro), alert limits, email alert queue.
-- Run ONCE in Supabase > SQL Editor, AFTER the Plus + Deal Alerts SQL files you already ran
-- (supabase-plus-membership-v134.sql, supabase-plus-v143-own-read-rpc.sql, supabase-deal-alerts-v75.4.sql).
-- Safe to re-run. Nothing is deleted.
--
-- PLANS (user, 5 Nov 2026)
--   Free            : 3 active Deal Alerts
--   Plus  Rs 99/yr  : 12 months of Plus, 12 active Deal Alerts
--   Pro             : needs Plus. Unlimited alerts + Pro / AI features (AI comes later)
--   Offers (what the site shows):
--     no Plus (new user / Plus expired)  -> "plus_99"      Plus 12 months                     Rs 99
--                                           "combo_199"    Plus 12 months + Pro 3 months      Rs 199
--     Plus active, not in last 90 days   -> "pro_99_month"  Pro 1 month                        Rs 99
--     Plus active, last 90 days of year  -> "renew_99"      Plus +12 months                    Rs 99
--                                           "renew_199"    Plus +12 months + Pro 3 months     Rs 199
--   New months are added AFTER the current expiry date, so no day is lost. Pro months start on the payment day.

alter table public.pp_plus_memberships add column if not exists pro_until timestamptz;
alter table public.pp_plus_memberships add column if not exists pro_source text;

-- ---------------------------------------------------------------------------------------------------------------
-- 1) who is on which plan (same rules as the site: Master Plus switch first, then the person's own row)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.pp_plan_plus_active(p_uid uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  m record;
  mem record;
begin
  if p_uid is null then return false; end if;
  select mode, expires_at into m from public.pp_plus_master_control where id = true;
  if found then
    if m.mode = 'inactive' then return false; end if;
    if m.mode = 'active' and (m.expires_at is null or m.expires_at > now()) then return true; end if;
  end if;
  select status, expires_at into mem from public.pp_plus_memberships where user_id = p_uid;
  if not found then return false; end if;
  return mem.status = 'active' and (mem.expires_at is null or mem.expires_at > now());
end;
$$;
revoke all on function public.pp_plan_plus_active(uuid) from public, anon, authenticated;

create or replace function public.pp_plan_pro_active(p_uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.pp_plan_plus_active(p_uid)
     and coalesce((select m.pro_until > now() from public.pp_plus_memberships m where m.user_id = p_uid), false);
$$;
revoke all on function public.pp_plan_pro_active(uuid) from public, anon, authenticated;

-- NULL = unlimited
create or replace function public.pp_plan_alert_limit(p_uid uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select case
    when public.pp_plan_pro_active(p_uid) then null
    when public.pp_plan_plus_active(p_uid) then 12
    else 3
  end;
$$;
revoke all on function public.pp_plan_alert_limit(uuid) from public, anon, authenticated;

-- The person's own plan, for the site and the extension.
create or replace function public.pp_get_my_plan()
returns table(
  plan text,
  plus_active boolean,
  plus_expires_at timestamptz,
  pro_active boolean,
  pro_expires_at timestamptz,
  alert_limit integer,
  alerts_used integer,
  renewal_window boolean,
  offer text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mem record;
  v_plus boolean;
  v_pro boolean;
  v_window boolean;
begin
  if uid is null then return; end if;
  select * into mem from public.pp_plus_memberships where user_id = uid;
  v_plus := public.pp_plan_plus_active(uid);
  v_pro := public.pp_plan_pro_active(uid);
  v_window := v_plus and mem.expires_at is not null and mem.expires_at <= now() + interval '90 days';
  return query select
    case when v_pro then 'pro' when v_plus then 'plus' else 'free' end,
    v_plus,
    case when v_plus then mem.expires_at else null end,
    v_pro,
    case when v_pro then mem.pro_until else null end,
    public.pp_plan_alert_limit(uid),
    (select count(*)::integer from public.pp_deal_alerts a where a.user_id = uid and a.status = 'active'),
    v_window,
    case when not v_plus then 'new' when v_window then 'renew' else 'upgrade' end;
end;
$$;
revoke all on function public.pp_get_my_plan() from public, anon;
grant execute on function public.pp_get_my_plan() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2) alert limit enforced in the database (site and extension both go through it)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.pp_enforce_alert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;
  if auth.uid() is null or auth.uid() <> new.user_id then return new; end if; -- server / admin writes are not limited
  v_limit := public.pp_plan_alert_limit(new.user_id);
  if v_limit is null then return new; end if;
  -- the same product is never counted: an upsert of an existing alert (site + extension use ON CONFLICT) is an edit
  select count(*) into v_count from public.pp_deal_alerts
   where user_id = new.user_id and status = 'active' and id is distinct from new.id and product_id <> new.product_id;
  if v_count >= v_limit then
    raise exception 'PP_ALERT_LIMIT:%', v_limit using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.pp_enforce_alert_limit() from public, anon, authenticated;

drop trigger if exists pp_deal_alerts_limit on public.pp_deal_alerts;
create trigger pp_deal_alerts_limit
before insert or update of status on public.pp_deal_alerts
for each row execute function public.pp_enforce_alert_limit();

-- ---------------------------------------------------------------------------------------------------------------
-- 3) apply an offer (used by the Admin button now, and by the payment webhook later - NOT callable by shoppers)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.pp_apply_plan_offer(p_uid uuid, p_offer text, p_ref text default null)
returns public.pp_plus_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  mem public.pp_plus_memberships;
  v_now timestamptz := now();
  v_plus boolean;
  v_window boolean;
  v_plus_base timestamptz;
  v_pro_base timestamptz;
  v_add_plus boolean := false;
  v_pro_months integer := 0;
begin
  if p_uid is null or p_offer is null then raise exception 'user and offer required'; end if;
  insert into public.pp_plus_memberships(user_id, status, claimed_at, updated_at)
  values (p_uid, 'pending', v_now, v_now)
  on conflict (user_id) do nothing;
  select * into mem from public.pp_plus_memberships where user_id = p_uid for update;

  v_plus := mem.status = 'active' and (mem.expires_at is null or mem.expires_at > v_now);
  v_window := v_plus and mem.expires_at is not null and mem.expires_at <= v_now + interval '90 days';
  -- Pro only lives inside an active Plus: leftover Pro days of a lapsed Plus are void (they must not come back to life).
  if not v_plus then mem.pro_until := null; end if;

  if p_offer = 'plus_99' then
    if v_plus then raise exception 'Plus is already active for this user (use renew_99 in the last 90 days)'; end if;
    v_add_plus := true;
  elsif p_offer = 'combo_199' then
    if v_plus then raise exception 'combo_199 is for users without active Plus'; end if;
    v_add_plus := true; v_pro_months := 3;
  elsif p_offer = 'renew_99' then
    if not v_window then raise exception 'renew_99 only in the last 90 days of active Plus'; end if;
    v_add_plus := true;
  elsif p_offer = 'renew_199' then
    if not v_window then raise exception 'renew_199 only in the last 90 days of active Plus'; end if;
    v_add_plus := true; v_pro_months := 3;
  elsif p_offer = 'pro_99_month' then
    if not public.pp_plan_plus_active(p_uid) then raise exception 'Pro needs active Plus'; end if;
    v_pro_months := 1;
  else
    raise exception 'unknown offer %', p_offer;
  end if;

  if v_add_plus then
    v_plus_base := case when v_plus then coalesce(mem.expires_at, v_now) else v_now end;
    mem.status := 'active';
    mem.activated_at := coalesce(mem.activated_at, v_now);
    mem.expires_at := v_plus_base + interval '1 year';
    mem.activation_source := 'plan-offer';
    mem.activation_ref := coalesce(p_ref, p_offer);
  end if;

  if v_pro_months > 0 then
    v_pro_base := case when mem.pro_until is not null and mem.pro_until > v_now then mem.pro_until else v_now end;
    mem.pro_until := v_pro_base + make_interval(months => v_pro_months);
    mem.pro_source := p_offer;
  end if;

  update public.pp_plus_memberships
     set status = mem.status,
         activated_at = mem.activated_at,
         expires_at = mem.expires_at,
         activation_source = mem.activation_source,
         activation_ref = mem.activation_ref,
         pro_until = mem.pro_until,
         pro_source = mem.pro_source,
         updated_at = v_now
   where user_id = p_uid
   returning * into mem;
  return mem;
end;
$$;
revoke all on function public.pp_apply_plan_offer(uuid, text, text) from public, anon, authenticated;

-- Shoppers can insert / move their own Plus claim row (old Plus policies). They must NEVER be able to set Pro
-- themselves: only trusted functions (owner role) may write pro_until / pro_source.
create or replace function public.pp_guard_pro_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.pro_until := null; new.pro_source := null;
    else
      new.pro_until := old.pro_until; new.pro_source := old.pro_source;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.pp_guard_pro_columns() from public, anon, authenticated;
drop trigger if exists pp_plus_memberships_guard_pro on public.pp_plus_memberships;
create trigger pp_plus_memberships_guard_pro
before insert or update on public.pp_plus_memberships
for each row execute function public.pp_guard_pro_columns();

-- Admin button (until payments exist): grant an offer to a user.
create or replace function public.pp_admin_apply_plan_offer(target_user uuid, p_offer text, p_ref text default null)
returns public.pp_plus_memberships
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.pp_price_admins where user_id = auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  return public.pp_apply_plan_offer(target_user, p_offer, coalesce(p_ref, 'admin'));
end;
$$;
revoke all on function public.pp_admin_apply_plan_offer(uuid, text, text) from public, anon;
grant execute on function public.pp_admin_apply_plan_offer(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3b) email queue fix: an alert that is set again and reaches its target again must email again
--     (V75.4 kept one row per alert and skipped the second time). Same function, only the insert changed.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.pp_queue_deal_alert_notification()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_email_enabled boolean:=false;
begin
  if tg_op='UPDATE' and new.status<>'triggered' and old.status='triggered' then
    delete from public.pp_deal_alert_notifications
    where alert_id=new.id and status='pending';
  end if;

  if new.status='triggered'
     and new.notify_email
     and coalesce(new.email_to,'')<>'' then

    if tg_op='INSERT' or (tg_op='UPDATE' and old.status is distinct from new.status) then
      select email_enabled into v_email_enabled
      from public.pp_alert_delivery_settings
      where id=true;

      if coalesce(v_email_enabled,false) then
        insert into public.pp_deal_alert_notifications
          (alert_id,user_id,email_to,product_id,product_name,target_price,trigger_price,retailer)
        values
          (new.id,new.user_id,new.email_to,new.product_id,new.product_name,new.target_price,
           coalesce(new.triggered_price,new.last_seen_price),coalesce(new.triggered_retailer,new.last_seen_retailer))
        on conflict (alert_id,event_type) do update
          set status='pending', email_to=excluded.email_to, product_name=excluded.product_name,
              target_price=excluded.target_price, trigger_price=excluded.trigger_price, retailer=excluded.retailer,
              created_at=now(), sent_at=null, provider_message_id=null, error_message=null;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.pp_queue_deal_alert_notification() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 4) email alerts: switch the queue on and call the Edge Function "send-deal-alerts" every 10 minutes
--    (Edge Function needs the secrets RESEND_API_KEY and ALERT_FROM, and "Verify JWT" switched OFF)
-- ---------------------------------------------------------------------------------------------------------------
-- A failed email can be retried by setting the row back to pending:  update pp_deal_alert_notifications set status='pending' where id=...;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    if exists (select 1 from cron.job where jobname = 'send-deal-alerts') then perform cron.unschedule('send-deal-alerts'); end if;
    perform cron.schedule('send-deal-alerts', '*/10 * * * *',
      $job$ select net.http_post(url := 'https://akdrydxbvdtadmcphhxj.supabase.co/functions/v1/send-deal-alerts',
        headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 5000) $job$);
  else
    raise notice 'pg_cron / pg_net not enabled: add the job in Supabase > Integrations > Cron instead (every 10 min, POST send-deal-alerts).';
  end if;
end $$;

-- Switch email alerts ON only AFTER the Edge Function is deployed and tested:
--   update public.pp_alert_delivery_settings set email_enabled = true, updated_at = now() where id = true;

-- Checks after running:
--   select * from public.pp_get_my_plan();                      -- while signed in (site) - returns your plan
--   select jobname, schedule from cron.job where jobname = 'send-deal-alerts';
--   -- give yourself an offer (as admin, from the SQL editor use pp_apply_plan_offer directly):
--   -- select * from public.pp_apply_plan_offer('<user uuid>', 'combo_199', 'test');
