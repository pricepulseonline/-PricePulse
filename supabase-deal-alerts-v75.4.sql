-- PricePulse V75.4: Wishlist-connected Deal Alerts + future email-ready queue.
-- Run ONCE in the existing Supabase SQL Editor when you are ready to enable account sync.
-- Until then, V75.4 uses a browser-local preview fallback and auto-migrates it after this SQL exists.
-- Safe to re-run. Existing Wishlist/Auth/price-history tables are not changed.

create table if not exists public.pp_deal_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  product_image text not null default '',
  target_price numeric(12,2) not null check (target_price > 0),
  retailer_scope text not null default 'any'
    check (retailer_scope in ('any','Amazon','Flipkart','Croma','Myntra','AJIO','Meesho')),
  status text not null default 'active'
    check (status in ('active','triggered','paused')),
  last_seen_price numeric(12,2),
  last_seen_retailer text,
  last_checked_at timestamptz,
  triggered_price numeric(12,2),
  triggered_retailer text,
  triggered_at timestamptz,
  notify_email boolean not null default true,
  email_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id),
  check (product_id ~ '^[a-z0-9-]+$')
);

create index if not exists pp_deal_alerts_user_status_idx
  on public.pp_deal_alerts(user_id,status,created_at desc);
create index if not exists pp_deal_alerts_product_active_idx
  on public.pp_deal_alerts(product_id,status)
  where status='active';

alter table public.pp_deal_alerts enable row level security;
revoke all on public.pp_deal_alerts from public, anon, authenticated;
grant select, insert, update, delete on public.pp_deal_alerts to authenticated;

drop policy if exists "Users can view own deal alerts" on public.pp_deal_alerts;
create policy "Users can view own deal alerts"
on public.pp_deal_alerts for select to authenticated
using (user_id=(select auth.uid()));

drop policy if exists "Users can create own deal alerts" on public.pp_deal_alerts;
create policy "Users can create own deal alerts"
on public.pp_deal_alerts for insert to authenticated
with check (user_id=(select auth.uid()));

drop policy if exists "Users can update own deal alerts" on public.pp_deal_alerts;
create policy "Users can update own deal alerts"
on public.pp_deal_alerts for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists "Users can delete own deal alerts" on public.pp_deal_alerts;
create policy "Users can delete own deal alerts"
on public.pp_deal_alerts for delete to authenticated
using (user_id=(select auth.uid()));

-- Global delivery switch. Keep false until the email provider/worker is connected.
create table if not exists public.pp_alert_delivery_settings (
  id boolean primary key default true check (id),
  email_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.pp_alert_delivery_settings(id,email_enabled)
values(true,false)
on conflict (id) do nothing;
alter table public.pp_alert_delivery_settings enable row level security;
revoke all on public.pp_alert_delivery_settings from public, anon, authenticated;

-- Private outbox. Browser clients cannot read/write it; a future server/Edge Function can.
create table if not exists public.pp_deal_alert_notifications (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.pp_deal_alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_to text not null,
  product_id text not null,
  product_name text not null,
  target_price numeric(12,2) not null,
  trigger_price numeric(12,2) not null,
  retailer text,
  event_type text not null default 'target_reached'
    check (event_type in ('target_reached')),
  status text not null default 'pending'
    check (status in ('pending','sent','failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  unique(alert_id,event_type)
);
create index if not exists pp_deal_alert_notifications_pending_idx
  on public.pp_deal_alert_notifications(status,created_at)
  where status='pending';
alter table public.pp_deal_alert_notifications enable row level security;
revoke all on public.pp_deal_alert_notifications from public, anon, authenticated;

-- When a verified retailer price is published, keep matching active alerts current
-- and automatically mark them triggered when the target is reached.
create or replace function public.pp_process_deal_alerts_after_price_publish()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if not (
    new.published
    and new.display_permitted
    and new.availability='in_stock'
    and new.checked_at<=now()
    and new.expires_at>now()
  ) then
    return new;
  end if;

  update public.pp_deal_alerts a
  set last_seen_price=new.price,
      last_seen_retailer=new.retailer,
      last_checked_at=new.checked_at,
      updated_at=now()
  where a.product_id=new.product_id
    and a.status='active'
    and (a.retailer_scope='any' or a.retailer_scope=new.retailer);

  update public.pp_deal_alerts a
  set status='triggered',
      triggered_price=new.price,
      triggered_retailer=new.retailer,
      triggered_at=now(),
      last_seen_price=new.price,
      last_seen_retailer=new.retailer,
      last_checked_at=new.checked_at,
      updated_at=now()
  where a.product_id=new.product_id
    and a.status='active'
    and a.target_price>=new.price
    and (a.retailer_scope='any' or a.retailer_scope=new.retailer);

  return new;
end;
$$;
revoke all on function public.pp_process_deal_alerts_after_price_publish() from public, anon, authenticated;

drop trigger if exists pp_retailer_prices_deal_alerts on public.pp_retailer_prices;
create trigger pp_retailer_prices_deal_alerts
after insert or update on public.pp_retailer_prices
for each row execute function public.pp_process_deal_alerts_after_price_publish();

-- Email-ready queue hook. It is dormant while email_enabled=false.
-- Later, connect a server/Edge Function to pending rows and flip the one global switch.
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
        on conflict (alert_id,event_type) do nothing;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.pp_queue_deal_alert_notification() from public, anon, authenticated;

drop trigger if exists pp_deal_alerts_notification_queue on public.pp_deal_alerts;
create trigger pp_deal_alerts_notification_queue
after insert or update of status on public.pp_deal_alerts
for each row execute function public.pp_queue_deal_alert_notification();

-- Future activation (ONLY after your email sender/Edge Function is connected):
-- update public.pp_alert_delivery_settings
-- set email_enabled=true,updated_at=now()
-- where id=true;
