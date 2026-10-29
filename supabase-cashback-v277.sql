-- PricePulse V277 - Cashback rates (DISPLAY ONLY - the real wallet / payouts come in Step 4)
-- Run ONCE in Supabase > SQL Editor. Safe to run again.
-- What it does:
--   pp_cashback_rates = PricePulse's affiliate commission % per store (optionally per category).
--   The site shows "+ Rs X cashback (est.)" = price x commission % x 40% (the user's share; set in the site code).
--   No row (or inactive) = no cashback line for that store. Amazon can never be added (Associates rules).
-- Only admins (pp_price_admins) can add / change rates; anyone can read the active list.

create table if not exists public.pp_cashback_rates (
  id uuid primary key default gen_random_uuid(),
  store text not null check (char_length(trim(store)) between 2 and 60),
  category text not null default '*' check (category ~ '^(\*|[a-z0-9-]{2,40})$'),
  commission_pct numeric(5,2) not null check (commission_pct > 0 and commission_pct <= 50),
  active boolean not null default true,
  note text check (note is null or char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  unique (store, category)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pp_cashback_rates_no_amazon') then
    alter table public.pp_cashback_rates add constraint pp_cashback_rates_no_amazon
      check (lower(regexp_replace(store,'[^a-zA-Z]','','g')) not like 'amazon%');
  end if;
end $$;
alter table public.pp_cashback_rates enable row level security;
-- no policies: nobody reads or writes the table directly; the functions below do.

-- public list (site + extension)
create or replace function public.pp_cashback_rates_public()
returns table(store text, category text, commission_pct numeric)
language sql security definer set search_path = public stable as $$
  select r.store, r.category, r.commission_pct from public.pp_cashback_rates r where r.active order by r.store, r.category;
$$;
revoke all on function public.pp_cashback_rates_public() from public;
grant execute on function public.pp_cashback_rates_public() to anon, authenticated;

-- admin: list all (incl. inactive)
create or replace function public.pp_admin_list_cashback_rates()
returns setof public.pp_cashback_rates
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  return query select * from public.pp_cashback_rates order by store, category;
end; $$;
revoke all on function public.pp_admin_list_cashback_rates() from public, anon;
grant execute on function public.pp_admin_list_cashback_rates() to authenticated;

-- admin: add or change (same store + category = update)
create or replace function public.pp_admin_upsert_cashback_rate(p_store text, p_category text, p_pct numeric, p_active boolean, p_note text)
returns public.pp_cashback_rates
language plpgsql security definer set search_path = public as $$
declare r public.pp_cashback_rates;
  c text := coalesce(nullif(lower(trim(coalesce(p_category,''))),''),'*');
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  insert into public.pp_cashback_rates(store,category,commission_pct,active,note)
  values (trim(p_store), c, p_pct, coalesce(p_active,true), nullif(trim(coalesce(p_note,'')),''))
  on conflict (store,category) do update set commission_pct=excluded.commission_pct, active=excluded.active, note=excluded.note, updated_at=now()
  returning * into r;
  return r;
end; $$;
revoke all on function public.pp_admin_upsert_cashback_rate(text,text,numeric,boolean,text) from public, anon;
grant execute on function public.pp_admin_upsert_cashback_rate(text,text,numeric,boolean,text) to authenticated;

-- admin: remove
create or replace function public.pp_admin_delete_cashback_rate(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  delete from public.pp_cashback_rates where id=p_id;
end; $$;
revoke all on function public.pp_admin_delete_cashback_rate(uuid) from public, anon;
grant execute on function public.pp_admin_delete_cashback_rate(uuid) to authenticated;

-- Check after running:
--   select * from public.pp_cashback_rates_public();
