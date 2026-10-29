-- PricePulse V270: card rewards (Saving stack / Add Cards) + Cuelinks coupon sync support.
-- Run once in the Supabase SQL editor, AFTER supabase-offers-v268.sql. Safe to run again.

-- 1) Store offers: where the row came from + Cuelinks id (so a synced coupon is updated, never duplicated).
alter table public.pp_store_offers add column if not exists source text not null default 'admin';
alter table public.pp_store_offers add column if not exists ext_id text;
alter table public.pp_store_offers add column if not exists url text;
create unique index if not exists pp_store_offers_ext_uq on public.pp_store_offers(source, ext_id) where ext_id is not null;

-- 2) Card rewards: what a credit card gives back on a store (cashback / points), shown in "Saving stack".
create table if not exists public.pp_card_rewards (
  id bigint generated always as identity primary key,
  card text not null,                 -- "Flipkart Axis Bank Credit Card"
  bank text not null,                 -- "Axis"
  network text,                       -- Visa / Mastercard / RuPay
  store text not null default '*',    -- store slug, or '*' = any online shopping
  reward text not null default 'cashback' check (reward in ('cashback','points')),
  pct numeric not null check (pct > 0 and pct <= 20),   -- value back in % (points converted to ₹ value)
  cap numeric check (cap is null or cap > 0),           -- max ₹ back per period
  cap_period text check (cap_period in ('month','quarter','statement','year','order')),
  note text,                          -- shopper text: "5% cashback on Flipkart"
  source_url text,                    -- official bank page used
  valid_till date,
  sort int not null default 100,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.pp_card_rewards enable row level security;
revoke all on public.pp_card_rewards from anon, authenticated;
create unique index if not exists pp_card_rewards_uq on public.pp_card_rewards(card, store);

-- public lists
create or replace function public.pp_store_offers_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'store', store, 'kind', kind, 'title', title, 'bank', bank, 'pct', pct, 'flat', flat, 'cap', cap,
    'min_order', min_order, 'code', code, 'category', category, 'valid_till', valid_till, 'source', source, 'url', url
  ) order by store, kind, id), '[]'::jsonb)
  from public.pp_store_offers
  where active and (valid_till is null or valid_till >= (now() at time zone 'Asia/Kolkata')::date);
$$;

create or replace function public.pp_card_rewards_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'card', card, 'bank', bank, 'network', network, 'store', store, 'reward', reward, 'pct', pct,
    'cap', cap, 'cap_period', cap_period, 'note', note, 'valid_till', valid_till
  ) order by sort, pct desc, card), '[]'::jsonb)
  from public.pp_card_rewards
  where active and (valid_till is null or valid_till >= (now() at time zone 'Asia/Kolkata')::date);
$$;

-- admin
create or replace function public.pp_card_rewards_admin()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort, c.card, c.store) from public.pp_card_rewards c), '[]'::jsonb));
end $$;

create or replace function public.pp_card_reward_save(
  p_id bigint, p_card text, p_bank text, p_store text, p_reward text, p_pct numeric, p_cap numeric,
  p_cap_period text, p_note text, p_source text, p_valid date, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  if coalesce(trim(p_card),'') = '' or coalesce(trim(p_bank),'') = '' or p_pct is null then
    return jsonb_build_object('ok', false, 'error', 'Card, bank and percent are needed'); end if;
  if p_id is null then
    insert into public.pp_card_rewards(card,bank,store,reward,pct,cap,cap_period,note,source_url,valid_till,active)
    values (trim(p_card), trim(p_bank), coalesce(nullif(lower(trim(p_store)),''),'*'), coalesce(p_reward,'cashback'), p_pct, p_cap,
            nullif(p_cap_period,''), nullif(trim(p_note),''), nullif(trim(p_source),''), p_valid, coalesce(p_active,true))
    returning id into v_id;
  else
    update public.pp_card_rewards set card=trim(p_card), bank=trim(p_bank), store=coalesce(nullif(lower(trim(p_store)),''),'*'),
      reward=coalesce(p_reward,'cashback'), pct=p_pct, cap=p_cap, cap_period=nullif(p_cap_period,''), note=nullif(trim(p_note),''),
      source_url=nullif(trim(p_source),''), valid_till=p_valid, active=coalesce(p_active,true), updated_at=now()
    where id = p_id returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.pp_card_reward_delete(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  delete from public.pp_card_rewards where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.pp_card_rewards_public() from public;
revoke all on function public.pp_card_rewards_admin() from public;
revoke all on function public.pp_card_reward_save(bigint,text,text,text,text,numeric,numeric,text,text,text,date,boolean) from public;
revoke all on function public.pp_card_reward_delete(bigint) from public;
grant execute on function public.pp_store_offers_public() to anon, authenticated;
grant execute on function public.pp_card_rewards_public() to anon, authenticated;
grant execute on function public.pp_card_rewards_admin() to authenticated;
grant execute on function public.pp_card_reward_save(bigint,text,text,text,text,numeric,numeric,text,text,text,date,boolean) to authenticated;
grant execute on function public.pp_card_reward_delete(bigint) to authenticated;

-- 3) Starter card list, taken from each bank's published card benefits (source_url). Rates change: check the source and edit in Admin.
--    Points cards use a conservative ₹ value per point. Edit or hide any row in Admin > Growth > "Card rewards".
insert into public.pp_card_rewards(card,bank,network,store,reward,pct,cap,cap_period,note,source_url,valid_till,sort) values
 ('Flipkart Axis Bank Credit Card','Axis','Visa/Mastercard','flipkart','cashback',5,4000,'quarter','5% cashback on Flipkart, up to ₹4,000 per quarter','https://www.axisbank.com/retail/cards/credit-card/flipkart-axisbank-credit-card','2026-12-31',10),
 ('Flipkart Axis Bank Credit Card','Axis','Visa/Mastercard','*','cashback',1,null,null,'1% cashback on other online spends','https://www.axisbank.com/retail/cards/credit-card/flipkart-axisbank-credit-card','2026-12-31',90),
 ('Flipkart SBI Card','SBI','Visa','flipkart','cashback',5,4000,'quarter','5% cashback on Flipkart, up to ₹4,000 per quarter','https://www.sbicard.com/en/personal/credit-cards/shopping/flipkart-sbi-credit-card.page','2026-12-31',10),
 ('Flipkart SBI Card','SBI','Visa','*','cashback',1,null,null,'1% cashback on other spends','https://www.sbicard.com/en/personal/credit-cards/shopping/flipkart-sbi-credit-card.page','2026-12-31',90),
 ('Amazon Pay ICICI Credit Card','ICICI','Visa','amazon','cashback',3,null,null,'3% back on Amazon (5% for Prime members)','https://www.icicibank.com/personal-banking/cards/credit-card/amazon-pay-credit-card','2026-12-31',10),
 ('Amazon Pay ICICI Credit Card','ICICI','Visa','*','cashback',1,null,null,'1% back on other spends','https://www.icicibank.com/personal-banking/cards/credit-card/amazon-pay-credit-card','2026-12-31',90),
 ('Cashback SBI Card','SBI','Visa','*','cashback',5,5000,'statement','5% cashback on online shopping, up to ₹5,000 per statement','https://www.sbicard.com/en/personal/credit-cards/rewards/cashback-sbi-card.page','2026-12-31',20),
 ('HDFC Millennia Credit Card','HDFC','Visa/Mastercard','amazon','cashback',5,1000,'month','5% cashback on Amazon, Flipkart, Myntra and more, up to ₹1,000 a month','https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card','2026-12-31',30),
 ('HDFC Millennia Credit Card','HDFC','Visa/Mastercard','flipkart','cashback',5,1000,'month','5% cashback on Amazon, Flipkart, Myntra and more, up to ₹1,000 a month','https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card','2026-12-31',30),
 ('HDFC Millennia Credit Card','HDFC','Visa/Mastercard','myntra','cashback',5,1000,'month','5% cashback on Amazon, Flipkart, Myntra and more, up to ₹1,000 a month','https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card','2026-12-31',30),
 ('HDFC Millennia Credit Card','HDFC','Visa/Mastercard','tata-cliq','cashback',5,1000,'month','5% cashback on Tata CLiQ and more, up to ₹1,000 a month','https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card','2026-12-31',30),
 ('HDFC Millennia Credit Card','HDFC','Visa/Mastercard','*','cashback',1,null,null,'1% cashback on other spends','https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card','2026-12-31',90),
 ('Axis Bank ACE Credit Card','Axis','Visa','*','cashback',1.5,null,null,'1.5% cashback on all spends','https://www.axisbank.com/retail/cards/credit-card/axis-bank-ace-credit-card','2026-12-31',60),
 ('Swiggy HDFC Bank Credit Card','HDFC','Mastercard','*','cashback',5,1500,'statement','5% cashback on online shopping categories, up to ₹1,500 per statement','https://www.hdfcbank.com/personal/pay/cards/credit-cards/swiggy-hdfc-bank-credit-card','2026-12-31',40),
 ('HDFC Infinia Credit Card','HDFC','Visa/Mastercard','*','points',3.3,null,null,'5 reward points per ₹150 (about 3.3% value)','https://www.hdfcbank.com/personal/pay/cards/credit-cards/infinia-credit-card-metal-edition','2026-12-31',50),
 ('HDFC Diners Club Black Credit Card','HDFC','Diners','*','points',3.3,null,null,'5 reward points per ₹150 (about 3.3% value)','https://www.hdfcbank.com/personal/pay/cards/credit-cards/diners-club-black-metal-edition','2026-12-31',50),
 ('HDFC Regalia Gold Credit Card','HDFC','Visa/Mastercard','*','points',1.3,null,null,'4 reward points per ₹150 (about 1.3% value)','https://www.hdfcbank.com/personal/pay/cards/credit-cards/regalia-gold-credit-card','2026-12-31',70),
 ('IndusInd CRED RuPay Credit Card','IndusInd','RuPay','*','points',1,null,null,'CRED coins on spends (about 1% value)','https://www.indusind.com/in/en/personal/cards/credit-card.html','2026-12-31',80),
 ('YES Bank POP-CLUB Credit Card','YES','RuPay','*','points',1,null,null,'POP coins on spends (about 1% value)','https://www.yesbank.in/personal-banking/yes-individual/cards/credit-cards','2026-12-31',80),
 ('Tata Neu Infinity HDFC Bank Credit Card','HDFC','RuPay/Visa','tata-cliq','points',5,null,null,'5% NeuCoins on Tata CLiQ and Tata Neu brands','https://www.hdfcbank.com/personal/pay/cards/credit-cards/tata-neu-infinity-hdfc-bank-credit-card','2026-12-31',30),
 ('Tata Neu Infinity HDFC Bank Credit Card','HDFC','RuPay/Visa','croma','points',5,null,null,'5% NeuCoins on Croma and Tata Neu brands','https://www.hdfcbank.com/personal/pay/cards/credit-cards/tata-neu-infinity-hdfc-bank-credit-card','2026-12-31',30),
 ('Tata Neu Infinity HDFC Bank Credit Card','HDFC','RuPay/Visa','*','points',1.5,null,null,'1.5% NeuCoins on other spends','https://www.hdfcbank.com/personal/pay/cards/credit-cards/tata-neu-infinity-hdfc-bank-credit-card','2026-12-31',90),
 ('Myntra Kotak Credit Card','Kotak','Mastercard','myntra','cashback',7.5,750,'order','7.5% off on Myntra, up to ₹750 per order','https://www.kotak.com/en/personal-banking/cards/credit-cards/myntra-kotak-credit-card.html','2026-12-31',20),
 ('Airtel Axis Bank Credit Card','Axis','Mastercard','*','cashback',1,null,null,'1% cashback on other spends','https://www.axisbank.com/retail/cards/credit-card/airtel-axis-bank-credit-card','2026-12-31',95)
on conflict (card, store) do nothing;
