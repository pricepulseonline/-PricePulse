-- PricePulse V276 - Sales page + Gift Cards "notify me" (run ONCE in Supabase > SQL Editor)
-- Safe to run again. Needs supabase-hero-growth-v211.sql (table pp_sale_events) already installed.
-- 1) pp_sale_events gets: link (store sale page), theme_color + theme_dark (store colours), banner_url
-- 2) public list for the Sales page: live, upcoming (next 60 days) and ended in the last 30 days
-- 3) Admin save with the new fields (the old save function keeps working)
-- 4) pp_notify_signups: emails that asked for one mail when gift cards go live (only admins can read it)

-- ---------------------------------------------------------------------------
-- 1) new columns
-- ---------------------------------------------------------------------------
alter table public.pp_sale_events add column if not exists link text;
alter table public.pp_sale_events add column if not exists theme_color text;
alter table public.pp_sale_events add column if not exists theme_dark text;
alter table public.pp_sale_events add column if not exists banner_url text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='pp_sale_events_theme_color_hex') then
    alter table public.pp_sale_events add constraint pp_sale_events_theme_color_hex check (theme_color is null or theme_color ~* '^#[0-9a-f]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname='pp_sale_events_theme_dark_hex') then
    alter table public.pp_sale_events add constraint pp_sale_events_theme_dark_hex check (theme_dark is null or theme_dark ~* '^#[0-9a-f]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname='pp_sale_events_link_https') then
    alter table public.pp_sale_events add constraint pp_sale_events_link_https check (link is null or link ~* '^https://');
  end if;
  if not exists (select 1 from pg_constraint where conname='pp_sale_events_banner_https') then
    alter table public.pp_sale_events add constraint pp_sale_events_banner_https check (banner_url is null or banner_url ~* '^https://');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) public list for the Sales page
-- ---------------------------------------------------------------------------
create or replace function public.pp_public_sales_v276()
returns table(id uuid, title text, store text, starts_at timestamptz, ends_at timestamptz, note text,
              link text, theme_color text, theme_dark text, banner_url text)
language sql
security definer
set search_path = public
stable
as $$
  select e.id,e.title,e.store,e.starts_at,e.ends_at,e.note,e.link,e.theme_color,e.theme_dark,e.banner_url
  from public.pp_sale_events e
  where e.active
    and e.starts_at < now() + interval '60 days'
    and e.ends_at > now() - interval '30 days'
  order by (e.ends_at < now()), e.starts_at asc
  limit 40;
$$;
revoke all on function public.pp_public_sales_v276() from public;
grant execute on function public.pp_public_sales_v276() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Admin save with the new fields
-- ---------------------------------------------------------------------------
create or replace function public.pp_admin_upsert_sale_event_v276(
  ev_id uuid, ev_title text, ev_store text, ev_starts_at timestamptz, ev_ends_at timestamptz, ev_note text, ev_active boolean,
  ev_link text, ev_theme_color text, ev_theme_dark text, ev_banner_url text)
returns public.pp_sale_events
language plpgsql security definer set search_path = public as $$
declare r public.pp_sale_events;
  l text := nullif(trim(coalesce(ev_link,'')),'');
  c1 text := nullif(lower(trim(coalesce(ev_theme_color,''))),'');
  c2 text := nullif(lower(trim(coalesce(ev_theme_dark,''))),'');
  bn text := nullif(trim(coalesce(ev_banner_url,'')),'');
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  if ev_id is null then
    insert into public.pp_sale_events(title,store,starts_at,ends_at,note,active,link,theme_color,theme_dark,banner_url)
    values (trim(ev_title),nullif(trim(coalesce(ev_store,'')),''),ev_starts_at,ev_ends_at,nullif(trim(coalesce(ev_note,'')),''),coalesce(ev_active,false),l,c1,c2,bn)
    returning * into r;
  else
    update public.pp_sale_events set title=trim(ev_title),store=nullif(trim(coalesce(ev_store,'')),''),
      starts_at=ev_starts_at,ends_at=ev_ends_at,note=nullif(trim(coalesce(ev_note,'')),''),
      active=coalesce(ev_active,false),link=l,theme_color=c1,theme_dark=c2,banner_url=bn,updated_at=now()
    where id=ev_id returning * into r;
  end if;
  return r;
end; $$;
revoke all on function public.pp_admin_upsert_sale_event_v276(uuid,text,text,timestamptz,timestamptz,text,boolean,text,text,text,text) from public, anon;
grant execute on function public.pp_admin_upsert_sale_event_v276(uuid,text,text,timestamptz,timestamptz,text,boolean,text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Gift Cards "notify me"
-- ---------------------------------------------------------------------------
create table if not exists public.pp_notify_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 6 and 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  topic text not null check (topic in ('giftcards')),
  user_id uuid,
  created_at timestamptz not null default now(),
  unique (topic, email)
);
alter table public.pp_notify_signups enable row level security;
-- no public policies: nobody reads or writes the table directly; the function below adds a row,
-- and only admins can list it.

create or replace function public.pp_notify_signup_v276(p_email text, p_topic text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email,'')));
begin
  if p_topic is distinct from 'giftcards' then raise exception 'unknown topic'; end if;
  if char_length(e) < 6 or char_length(e) > 254 or e !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'invalid email';
  end if;
  -- simple flood guard: at most 30 new sign-ups per minute in total
  if (select count(*) from public.pp_notify_signups where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too many requests, try again in a minute';
  end if;
  insert into public.pp_notify_signups(email,topic,user_id) values (e,p_topic,auth.uid())
  on conflict (topic,email) do nothing;
  return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.pp_notify_signup_v276(text,text) from public;
grant execute on function public.pp_notify_signup_v276(text,text) to anon, authenticated;

create or replace function public.pp_admin_list_notify_signups(p_topic text default 'giftcards')
returns table(email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.pp_price_admins where user_id=auth.uid()) then
    raise exception 'PricePulse admin access required';
  end if;
  return query select s.email,s.created_at from public.pp_notify_signups s where s.topic=p_topic order by s.created_at desc;
end; $$;
revoke all on function public.pp_admin_list_notify_signups(text) from public, anon;
grant execute on function public.pp_admin_list_notify_signups(text) to authenticated;

-- Check after running:
--   select * from public.pp_public_sales_v276();
--   select public.pp_notify_signup_v276('test@example.com','giftcards');
--   delete from public.pp_notify_signups where email='test@example.com';
