-- PricePulse SQL v6 (Step 0.5 "Save to PricePulse") - run ONCE in Supabase > SQL Editor, after v1 ... v5.
-- Safe to run again.
--
-- What it adds:
--   1) pp_ext_pending: store pages an admin saved with the extension button "Save to PricePulse" (or with
--      Admin > Add Product > Fill). They are NOT on the site. They wait in Admin > Growth > "Extension: new products".
--   2) pp_ext_pending_save / pp_ext_pending_status: used by the extension, only with a valid Admin key.
--   3) pp_ext_pending_from_url: Admin "Fill from a store link" adds the same page to the pending list.
--   4) pp_ext_pending_list / pp_ext_pending_confirm / pp_ext_pending_reject: Admin only.
--      Confirm = the store link becomes a checked listing of the product (match) and the price the admin's
--      extension read (if less than 24 h old and in stock) is saved as verified. Only then the site shows it.
-- Safety: nothing here publishes anything without the Confirm click of a signed-in PricePulse admin.

create table if not exists public.pp_ext_pending (
  id bigint generated always as identity primary key,
  store text not null check (store ~ '^[a-z0-9-]{2,40}$'),
  product_key text not null check (product_key ~ '^[A-Za-z0-9_-]{3,120}$'),
  url text not null check (url ~ '^https://' and length(url) <= 600),
  title text check (title is null or length(title) <= 300),
  price numeric(12,2) check (price is null or (price > 0 and price < 10000000)),
  mrp numeric(12,2) check (mrp is null or (mrp > 0 and mrp < 10000000)),
  in_stock boolean not null default true,
  image_url text check (image_url is null or length(image_url) <= 600),
  price_seen_at timestamptz,
  source text not null default 'extension' check (source in ('extension','admin')),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  product_id text,
  created_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists pp_ext_pending_one_open on public.pp_ext_pending(store, product_key) where status = 'pending';
create index if not exists pp_ext_pending_status_idx on public.pp_ext_pending(status, updated_at desc);
alter table public.pp_ext_pending enable row level security;
revoke all on public.pp_ext_pending from public, anon, authenticated;

-- Is this exact store page already a checked listing? (returns the product, else null)
create or replace function public.pp_ext_linked_product(p_store text, p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select l.product_id from public.pp_product_store_listings l
   where l.store_slug = p_store and l.active and l.match_status = 'match'
     and (public.pp_ext_url_has(l.direct_url, p_code) or public.pp_ext_url_has(l.affiliate_url, p_code))
   limit 1;
$$;

-- Add / refresh one pending page (shared by the extension and Admin Fill)
create or replace function public.pp_ext_pending_put(
  p_uid uuid, p_source text, p_store text, p_code text, p_url text, p_title text,
  p_price numeric, p_mrp numeric, p_in_stock boolean, p_image text, p_seen_at timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_id bigint; v_pid text; v_again boolean := false;
begin
  if p_store is null or p_store !~ '^[a-z0-9-]{2,40}$' or p_code is null or p_code !~ '^[A-Za-z0-9_-]{3,120}$' then
    return jsonb_build_object('status','bad','error','code');
  end if;
  if p_url is null or length(p_url) > 600 or not public.pp_ext_store_url_ok(p_store, p_url) then
    return jsonb_build_object('status','bad','error','store');
  end if;
  if not public.pp_ext_url_has(p_url, p_code) then return jsonb_build_object('status','bad','error','url'); end if;
  if p_price is not null and (p_price <= 0 or p_price >= 10000000) then p_price := null; end if;
  if p_mrp is not null and (p_mrp <= 0 or p_mrp >= 10000000) then p_mrp := null; end if;

  v_pid := public.pp_ext_linked_product(p_store, p_code);
  if v_pid is not null then
    return jsonb_build_object('status','exists','product_id',v_pid,
      'product_name',(select name from public.pp_catalog_products where product_id = v_pid));
  end if;

  update public.pp_ext_pending set
     url = left(p_url,600), title = coalesce(left(p_title,300), title),
     price = coalesce(round(p_price,2), price), mrp = case when p_price is not null then round(p_mrp,2) else mrp end,
     in_stock = case when p_price is not null then coalesce(p_in_stock,true) else in_stock end,
     image_url = coalesce(case when p_image ~ '^https://' then left(p_image,600) end, image_url),
     price_seen_at = case when p_price is not null then coalesce(p_seen_at, now()) else price_seen_at end,
     updated_at = now()
   where store = p_store and product_key = p_code and status = 'pending'
   returning id into v_id;
  if v_id is not null then v_again := true;
  else
    insert into public.pp_ext_pending(store, product_key, url, title, price, mrp, in_stock, image_url, price_seen_at, source, created_by)
    values (p_store, p_code, left(p_url,600), left(p_title,300), round(p_price,2), round(p_mrp,2), coalesce(p_in_stock,true),
            case when p_image ~ '^https://' then left(p_image,600) end,
            case when p_price is not null then coalesce(p_seen_at, now()) end,
            case when p_source = 'admin' then 'admin' else 'extension' end, p_uid)
    returning id into v_id;
  end if;
  return jsonb_build_object('status','pending','id',v_id,'again',v_again);
end;
$$;

-- Extension button "Save to PricePulse" (Admin key needed)
create or replace function public.pp_ext_pending_save(
  p_key text, p_store text, p_code text, p_url text, p_title text,
  p_price numeric, p_mrp numeric, p_in_stock boolean, p_image text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_uid uuid; v_r jsonb;
begin
  v_uid := public.pp_ext_admin_user(p_key);
  if v_uid is null then return jsonb_build_object('status','denied'); end if;
  if p_price is null or p_price <= 0 then return jsonb_build_object('status','bad','error','price'); end if;
  v_r := public.pp_ext_pending_put(v_uid, 'extension', p_store, p_code, p_url, p_title, p_price, p_mrp, p_in_stock, p_image, now());
  update public.pp_ext_admin_keys set last_used_at = now() where key_hash = encode(sha256(convert_to(p_key,'UTF8')),'hex');
  return v_r;
end;
$$;

-- Extension card: is this page already waiting for Confirm? (Admin key needed)
create or replace function public.pp_ext_pending_status(p_key text, p_store text, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare r record;
begin
  if public.pp_ext_admin_user(p_key) is null then return jsonb_build_object('status','denied'); end if;
  select id, updated_at, price into r from public.pp_ext_pending
   where store = p_store and product_key = p_code and status = 'pending';
  if found then return jsonb_build_object('status','pending','id',r.id,'updated_at',r.updated_at,'price',r.price); end if;
  return jsonb_build_object('status','none');
end;
$$;

-- Admin > Add Product > "Fill from a store link": the same page goes to the pending list too
create or replace function public.pp_ext_pending_from_url(p_url text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare d record; s record;
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('status','denied'); end if;
  if p_url is null or p_url !~ '^https://' or length(p_url) > 2000 then return jsonb_build_object('status','bad','error','url'); end if;
  select store, product_key, url, title into d from public.pp_ext_product_details
   where public.pp_ext_store_url_ok(store, p_url) and public.pp_ext_url_has(p_url, product_key)
   order by length(product_key) desc, updated_at desc limit 1;
  if not found then return jsonb_build_object('status','bad','error','not saved'); end if;
  -- the newest price any extension saw on this page (it is NOT verified; Confirm uses it only if < 24 h old)
  select price, mrp, in_stock, image_url, seen_at into s from public.pp_ext_price_seen
   where store = d.store and product_key = d.product_key order by seen_at desc limit 1;
  return public.pp_ext_pending_put(auth.uid(), 'admin', d.store, d.product_key,
    d.url, d.title, s.price, s.mrp, s.in_stock, s.image_url, s.seen_at);
end;
$$;

-- Admin list: everything the Check button needs, in one call
create or replace function public.pp_ext_pending_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.pp_ext_is_admin() then jsonb_build_object('ok', false) else jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'store', p.store, 'store_name', st.name, 'product_key', p.product_key, 'url', p.url, 'title', p.title,
      'price', p.price, 'mrp', p.mrp, 'in_stock', p.in_stock, 'image_url', p.image_url, 'price_seen_at', p.price_seen_at,
      'source', p.source, 'created_at', p.created_at, 'updated_at', p.updated_at,
      'linked_product', public.pp_ext_linked_product(p.store, p.product_key),
      'details', (select jsonb_build_object('title', d.title, 'fields', d.fields, 'category', d.category,
                    'spec_count', (select count(*) from jsonb_object_keys(d.specs)), 'images', coalesce(d.images,'[]'::jsonb),
                    'updated_at', d.updated_at, 'has_changes', d.changes <> '{}'::jsonb)
                    from public.pp_ext_product_details d where d.store = p.store and d.product_key = p.product_key),
      'live', (select coalesce(jsonb_agg(jsonb_build_object('store', c.target_store, 'match', c.match, 'price', c.price,
                    'title', c.title, 'variant', c.variant, 'seen_at', c.seen_at) order by c.price), '[]'::jsonb)
                 from public.pp_ext_live_cache c where c.store = p.store and c.product_key = p.product_key
                  and c.seen_at > now() - interval '3 days'),
      'aff_template', (select r.aff_template from public.pp_ext_store_rules r where r.store_slug = p.store)
    ) order by p.updated_at desc)
    from public.pp_ext_pending p left join public.pp_catalog_stores st on st.slug = p.store
   where p.status = 'pending'), '[]'::jsonb)) end;
$$;

-- Admin Confirm: link the store page to the product as a checked listing (+ verified price if fresh)
create or replace function public.pp_ext_pending_confirm(p_id bigint, p_product_id text, p_affiliate_url text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); r record; v_retailer text; v_old record; v_other text; v_aff text;
  v_checked timestamptz; v_price_saved boolean := false; v_replaced text; v_n integer;
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  select * into r from public.pp_ext_pending where id = p_id for update;
  if not found or r.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'not pending'); end if;
  if not exists (select 1 from public.pp_catalog_products where product_id = p_product_id) then
    return jsonb_build_object('ok', false, 'error', 'product not found');
  end if;
  if not public.pp_ext_store_url_ok(r.store, r.url) or not public.pp_ext_url_has(r.url, r.product_key) then
    return jsonb_build_object('ok', false, 'error', 'store link not valid');
  end if;
  v_other := public.pp_ext_linked_product(r.store, r.product_key);
  if v_other is not null and v_other <> p_product_id then
    return jsonb_build_object('ok', false, 'error', 'this store page is already linked to ' || v_other);
  end if;
  p_affiliate_url := nullif(trim(coalesce(p_affiliate_url,'')), '');
  if p_affiliate_url is not null and (p_affiliate_url !~ '^https://' or length(p_affiliate_url) > 600) then
    return jsonb_build_object('ok', false, 'error', 'affiliate link must start with https://');
  end if;
  select name into v_retailer from public.pp_catalog_stores where slug = r.store;

  select direct_url, affiliate_url into v_old from public.pp_product_store_listings
   where product_id = p_product_id and store_slug = r.store;
  if found then
    -- keep the old affiliate link only if it points to this same page
    v_aff := coalesce(p_affiliate_url, case when public.pp_ext_url_has(v_old.affiliate_url, r.product_key) then v_old.affiliate_url end);
    if coalesce(v_old.direct_url,'') <> '' and not public.pp_ext_url_has(v_old.direct_url, r.product_key) then v_replaced := v_old.direct_url; end if;
  else
    v_aff := p_affiliate_url;
  end if;

  insert into public.pp_product_store_listings as l
    (product_id, store_slug, affiliate_url, direct_url, listing_status, captured_title, match_status, match_score,
     override_reason, last_captured_at, active, updated_by, updated_at)
  values (p_product_id, r.store, v_aff, r.url, case when r.in_stock then 'active' else 'out_of_stock' end, r.title, 'match', 100,
          'Confirmed in Admin from extension (Save to PricePulse)', now(), true, v_uid, now())
  on conflict (product_id, store_slug) do update set
     affiliate_url = excluded.affiliate_url, direct_url = excluded.direct_url, listing_status = excluded.listing_status,
     captured_title = excluded.captured_title, match_status = 'match', match_score = 100,
     override_reason = excluded.override_reason, last_captured_at = now(), active = true,
     updated_by = v_uid, updated_at = now();

  -- the price the admin's own extension read on this page = same trust as Admin mode, only if fresh and in stock
  if r.price is not null and r.in_stock and r.price_seen_at > now() - interval '23 hours' and v_retailer is not null then
    v_checked := least(r.price_seen_at, now() - interval '30 seconds');
    insert into public.pp_retailer_prices as rp
      (product_id, retailer, price, mrp, checked_at, expires_at, source, availability, display_permitted, published,
       updated_at, updated_by, captured_title, match_status, capture_source, listing_url)
    values (p_product_id, v_retailer, r.price, case when r.mrp >= r.price then r.mrp end, v_checked, v_checked + interval '24 hours',
            'user-manual-check', 'in_stock', true, true, now(), v_uid, r.title, 'match', 'extension-admin', r.url)
    on conflict (product_id, retailer) do update set
       price = excluded.price, mrp = coalesce(excluded.mrp, rp.mrp), checked_at = excluded.checked_at,
       expires_at = excluded.expires_at, source = excluded.source, availability = excluded.availability,
       display_permitted = true, published = true, updated_at = now(), updated_by = v_uid,
       captured_title = excluded.captured_title, match_status = 'match', capture_source = 'extension-admin',
       listing_url = excluded.listing_url
     where rp.checked_at < excluded.checked_at;
    get diagnostics v_n = row_count;
    v_price_saved := v_n > 0;
  end if;

  update public.pp_ext_pending set status = 'confirmed', product_id = p_product_id, decided_by = v_uid, decided_at = now(), updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true, 'product_id', p_product_id, 'store', r.store, 'price_saved', v_price_saved,
                            'price', case when v_price_saved then r.price end, 'replaced_url', v_replaced);
end;
$$;

create or replace function public.pp_ext_pending_reject(p_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  update public.pp_ext_pending set status = 'rejected', decided_by = auth.uid(), decided_at = now(), updated_at = now()
   where id = p_id and status = 'pending';
  return jsonb_build_object('ok', found);
end;
$$;

revoke all on function public.pp_ext_linked_product(text,text) from public;
revoke all on function public.pp_ext_pending_put(uuid,text,text,text,text,text,numeric,numeric,boolean,text,timestamptz) from public;
revoke all on function public.pp_ext_pending_save(text,text,text,text,text,numeric,numeric,boolean,text) from public;
revoke all on function public.pp_ext_pending_status(text,text,text) from public;
revoke all on function public.pp_ext_pending_from_url(text) from public;
revoke all on function public.pp_ext_pending_list() from public;
revoke all on function public.pp_ext_pending_confirm(bigint,text,text) from public;
revoke all on function public.pp_ext_pending_reject(bigint) from public;
-- the extension has no login: it may call these two, they work only with a valid Admin key
grant execute on function public.pp_ext_pending_save(text,text,text,text,text,numeric,numeric,boolean,text) to anon, authenticated;
grant execute on function public.pp_ext_pending_status(text,text,text) to anon, authenticated;
-- Admin page (signed in), each checks pp_price_admins itself
grant execute on function public.pp_ext_pending_from_url(text) to authenticated;
grant execute on function public.pp_ext_pending_list() to authenticated;
grant execute on function public.pp_ext_pending_confirm(bigint,text,text) to authenticated;
grant execute on function public.pp_ext_pending_reject(bigint) to authenticated;
