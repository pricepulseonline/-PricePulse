-- ============================================================================
-- PricePulse V78.8.146 — Plus Savings Membership backend patch
-- Run AFTER the already installed V141 + V143 + V145 backend migrations.
-- Safe to re-run.
-- ============================================================================

-- Effective Plus helper used only by protected backend logic.
create or replace function public.pp_is_plus_effectively_active(target_user uuid)
returns boolean
language plpgsql
security definer
set search_path=public
stable
as $$
declare
  master_mode text := 'individual';
  master_expiry timestamptz;
  member_status text;
  member_expiry timestamptz;
begin
  if target_user is null then return false; end if;
  select mode,expires_at into master_mode,master_expiry
  from public.pp_plus_master_control where id=true;
  master_mode := coalesce(master_mode,'individual');
  if master_mode='inactive' then return false; end if;
  if master_mode='active' then
    return master_expiry is null or master_expiry>now();
  end if;
  select status,expires_at into member_status,member_expiry
  from public.pp_plus_memberships where user_id=target_user;
  return coalesce(member_status,'')='active' and (member_expiry is null or member_expiry>now());
end;
$$;
revoke all on function public.pp_is_plus_effectively_active(uuid) from public,anon,authenticated;

-- One-time ₹100 Plus Welcome Reward. This is intentionally separate from the
-- existing referral friend Welcome Reward.
create or replace function public.pp_award_plus_welcome_reward(target_user uuid,purchase_ref text default null)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if target_user is null then return false; end if;
  -- Require the user's own individual membership to be active. Master ON is a
  -- testing/system override and must not create a paid-member welcome reward.
  if not exists(
    select 1 from public.pp_plus_memberships
    where user_id=target_user and status='active'
      and (expires_at is null or expires_at>now())
  ) then return false; end if;

  insert into public.pp_wallet_accounts(user_id)
  values(target_user) on conflict (user_id) do nothing;

  insert into public.pp_wallet_transactions(
    user_id,entry_type,title,amount,status,target_amount,unlocked_amount,source_ref,note
  )
  values(
    target_user,'plus_welcome_reward','PricePulse Plus Welcome Reward',100,'available',100,100,
    'plus-welcome:'||target_user::text,
    '₹100 Plus Welcome Reward • first eligible confirmed purchase.'
  )
  on conflict do nothing;

  perform public.pp_wallet_refresh_account(target_user);
  return exists(
    select 1 from public.pp_wallet_transactions
    where user_id=target_user and source_ref='plus-welcome:'||target_user::text
  );
end;
$$;
revoke all on function public.pp_award_plus_welcome_reward(uuid,text) from public,anon,authenticated;
grant execute on function public.pp_award_plus_welcome_reward(uuid,text) to service_role;

-- Upgrade the existing Wallet -> Plus purchase-confirmation bridge so the same
-- newly-confirmed eligible shopping event can activate a pending membership and
-- then award the one-time Plus Welcome Reward.
create or replace function public.pp_plus_wallet_confirm_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.status='available'
     and coalesce(new.entry_type,'')='shopping_reward'
     and coalesce(new.amount,0)>0
     and (tg_op='INSERT' or old.status is distinct from 'available') then
    perform public.pp_activate_plus_after_eligible_purchase(new.user_id,coalesce(new.source_ref,new.id::text));
    perform public.pp_award_plus_welcome_reward(new.user_id,coalesce(new.source_ref,new.id::text));
  end if;
  return new;
end;
$$;
revoke all on function public.pp_plus_wallet_confirm_trigger() from public,anon,authenticated;

drop trigger if exists pp_plus_activate_on_confirmed_purchase on public.pp_wallet_transactions;
create trigger pp_plus_activate_on_confirmed_purchase
after insert or update of status on public.pp_wallet_transactions
for each row execute function public.pp_plus_wallet_confirm_trigger();

-- Server-side Deal Alert plan limit: Free = 1 active alert, Plus = 3 active.
create or replace function public.pp_enforce_deal_alert_plan_limit()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  current_active integer := 0;
  allowed_active integer := 1;
begin
  if new.status<>'active' then return new; end if;
  if tg_op='UPDATE' and old.status='active' then return new; end if;
  allowed_active := case when public.pp_is_plus_effectively_active(new.user_id) then 3 else 1 end;
  select count(*) into current_active
  from public.pp_deal_alerts
  where user_id=new.user_id and status='active'
    and (tg_op<>'UPDATE' or id<>new.id);
  if current_active>=allowed_active then
    if allowed_active=1 then
      raise exception 'Free includes 1 active Deal Alert. PricePulse Plus unlocks Deal Alerts+.';
    else
      raise exception 'PricePulse Plus currently supports up to 3 active Deal Alerts.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.pp_enforce_deal_alert_plan_limit() from public,anon,authenticated;

drop trigger if exists pp_deal_alert_plan_limit on public.pp_deal_alerts;
create trigger pp_deal_alert_plan_limit
before insert or update of status on public.pp_deal_alerts
for each row execute function public.pp_enforce_deal_alert_plan_limit();

-- Wallet redemption rule: Free minimum ₹100; Plus minimum ₹25.
create or replace function public.pp_wallet_start_redemption(target_retailer text,target_amount numeric)
returns public.pp_reward_redemptions
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  acct public.pp_wallet_accounts;
  outrow public.pp_reward_redemptions;
  tracking text;
  minimum_amount numeric := 100;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if target_retailer is null or btrim(target_retailer)='' then raise exception 'Retailer required'; end if;
  if coalesce(target_amount,0)<=0 then raise exception 'Reward amount must be greater than zero'; end if;
  minimum_amount := case when public.pp_is_plus_effectively_active(uid) then 25 else 100 end;
  if target_amount<minimum_amount then
    if minimum_amount=25 then raise exception 'PricePulse Plus redemption starts at ₹25.';
    else raise exception 'Free Wallet redemption starts at ₹100. PricePulse Plus starts at ₹25.';
    end if;
  end if;

  if not exists(select 1 from public.pp_campaign_reward_rules where lower(retailer)=lower(target_retailer) and active=true and rewards_allowed=true and subid_supported=true) then
    raise exception 'Reward redemption is not enabled for this retailer campaign';
  end if;

  perform public.pp_wallet_refresh_account(uid);
  select * into acct from public.pp_wallet_accounts where user_id=uid for update;
  if acct.available_balance < target_amount then raise exception 'Insufficient available reward balance'; end if;

  tracking := 'PP-' || upper(regexp_replace(target_retailer,'[^a-zA-Z0-9]','','g')) || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  insert into public.pp_reward_redemptions(user_id,retailer,amount,status,tracking_ref,created_at,updated_at,expires_at)
  values(uid,btrim(target_retailer),round(target_amount,2),'locked',tracking,now(),now(),now()+interval '30 minutes')
  returning * into outrow;

  insert into public.pp_wallet_transactions(user_id,entry_type,title,retailer,amount,status,target_amount,unlocked_amount,source_ref,note)
  values(uid,'redemption',btrim(target_retailer)||' Reward Redemption',btrim(target_retailer),-round(target_amount,2),'pending',round(target_amount,2),round(target_amount,2),'redeem:'||outrow.id::text,'Reward locked • fresh tracking '||tracking);

  perform public.pp_wallet_refresh_account(uid);
  return outrow;
end;
$$;
revoke all on function public.pp_wallet_start_redemption(text,numeric) from public,anon;
grant execute on function public.pp_wallet_start_redemption(text,numeric) to authenticated;

insert into public.pp_backend_meta(key,value,updated_at)
values('plus_savings_schema_version','78.8.146',now())
on conflict (key) do update set value=excluded.value,updated_at=excluded.updated_at;

-- End V78.8.146 Plus Savings Membership patch.
