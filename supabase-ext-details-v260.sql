-- PricePulse Extension V4 database (28 Oct 2026). Run AFTER 2-supabase-ext-v3.sql. Safe to re-run.
--   1) pp_ext_details_public(product_id): the product details the extension collected from the stores that
--      sell this product (specs, brand, model, colour, category...). Used by the site's Find page and product page.
--      Rules: only values a store page stated; if two stores state a DIFFERENT value for the same field the field
--      is left out (no wrong data); a value you set/approved in Admin always wins. No shopper data, no URLs of
--      shoppers, no "changes"/"conflicts" - only the clean result.
--   2) pp_ext_details_act(...): Admin buttons - accept a new value, keep the old one, remove a wrong field,
--      delete a whole saved listing. Admin only.

-- 0) Product photos (added 28 Oct): picture links the store page itself shows (never Amazon). We do not copy
--    the pictures; the site shows them straight from the store's server.
alter table public.pp_ext_product_details add column if not exists images jsonb not null default '[]'::jsonb;

create or replace function public.pp_ext_images_save(p_store text, p_key text, p_url text, p_images jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_clean jsonb; v_row public.pp_ext_product_details;
begin
  if p_store is null or p_store !~ '^[a-z0-9-]{2,40}$' or p_key is null or p_key !~ '^[A-Za-z0-9_-]{3,120}$' then return; end if;
  if p_store = 'amazon' then return; end if;
  if not public.pp_ext_store_url_ok(p_store, p_url) then return; end if;
  if p_images is null or jsonb_typeof(p_images) <> 'array' or length(p_images::text) > 4000 then return; end if;
  select coalesce(jsonb_agg(u order by ord), '[]'::jsonb) into v_clean from (
    select u, ord from (
      select u, min(ord) as ord from (
        select e.value #>> '{}' as u, e.ordinality as ord from jsonb_array_elements(p_images) with ordinality e
      ) x
      where u ~ '^https://[A-Za-z0-9.-]+/[^\s<>"'']+$' and length(u) <= 400
        and u !~* '(media-amazon|ssl-images-amazon|images-amazon)\.'
      group by u
    ) z order by ord limit 6
  ) y;
  select * into v_row from public.pp_ext_product_details where store = p_store and product_key = p_key for update;
  if not found then return; end if;
  if jsonb_array_length(v_clean) = 0 or v_row.images = v_clean then return; end if;
  update public.pp_ext_product_details set images = v_clean where store = p_store and product_key = p_key;
end;
$$;
revoke all on function public.pp_ext_images_save(text,text,text,jsonb) from public;
grant execute on function public.pp_ext_images_save(text,text,text,jsonb) to anon, authenticated;

create or replace function public.pp_ext_details_public(p_product_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record; k text; v jsonb; src text;
  v_fields jsonb := '{}'::jsonb;       -- field -> {"v": value, "s": [stores]}
  v_bad text[] := '{}';                -- fields where stores disagree
  v_specs jsonb := '{}'::jsonb;
  v_badspec text[] := '{}';
  v_cat jsonb := '[]'::jsonb;
  v_stores text[] := '{}';
  v_admin text[] := '{}';
  v_n integer := 0;
  v_img jsonb := '[]'::jsonb;
begin
  if p_product_id is null or length(p_product_id) > 120 then return jsonb_build_object('ok', false); end if;
  for r in
    select distinct d.*
      from public.pp_product_store_listings l
      join public.pp_ext_product_details d on d.store = l.store_slug
       and (public.pp_ext_url_has(l.direct_url, d.product_key) or public.pp_ext_url_has(l.affiliate_url, d.product_key))
     where l.product_id = p_product_id and l.active and l.match_status = 'match'
     order by d.store, d.product_key
  loop
    v_n := v_n + 1;
    if not (r.store = any(v_stores)) then v_stores := v_stores || r.store; end if;
    for k, v in select * from jsonb_each(r.fields) loop
      src := r.sources ->> k;
      if src = 'admin' then
        v_fields := v_fields || jsonb_build_object(k, jsonb_build_object('v', v, 's', jsonb_build_array('PricePulse')));
        v_admin := v_admin || k;
      elsif k = any(v_admin) then null;
      elsif v_fields ? k then
        if (v_fields -> k -> 'v') <> v then v_bad := v_bad || k;
        elsif not ((v_fields -> k -> 's') ? r.store) then
          v_fields := jsonb_set(v_fields, array[k,'s'], (v_fields -> k -> 's') || to_jsonb(r.store));
        end if;
      else
        v_fields := v_fields || jsonb_build_object(k, jsonb_build_object('v', v, 's', jsonb_build_array(r.store)));
      end if;
    end loop;
    for k, v in select * from jsonb_each(r.specs) loop
      if k = any(v_badspec) then null;
      elsif v_specs ? k then
        if (v_specs -> k -> 'v') <> v then v_badspec := v_badspec || k; v_specs := v_specs - k;
        elsif not ((v_specs -> k -> 's') ? r.store) then
          v_specs := jsonb_set(v_specs, array[k,'s'], (v_specs -> k -> 's') || to_jsonb(r.store));
        end if;
      elsif (select count(*) from jsonb_object_keys(v_specs)) < 120 then
        v_specs := v_specs || jsonb_build_object(k, jsonb_build_object('v', v, 's', jsonb_build_array(r.store)));
      end if;
    end loop;
    if jsonb_array_length(v_cat) = 0 and jsonb_array_length(r.category) > 0 then v_cat := r.category; end if;
    if jsonb_array_length(v_img) = 0 and jsonb_array_length(coalesce(r.images,'[]'::jsonb)) > 0 then v_img := r.images; end if;
  end loop;
  -- disagreeing fields: dropped (an Admin-approved value was already protected above)
  for k in select unnest(v_bad) loop
    if not (k = any(v_admin)) then v_fields := v_fields - k; end if;
  end loop;
  if v_n = 0 then return jsonb_build_object('ok', true, 'fields', '{}'::jsonb, 'specs', '{}'::jsonb, 'category', '[]'::jsonb, 'stores', '[]'::jsonb); end if;
  return jsonb_build_object('ok', true, 'fields', v_fields, 'specs', v_specs, 'category', v_cat, 'stores', to_jsonb(v_stores), 'images', v_img);
end;
$$;

-- Admin actions on one saved listing -----------------------------------------------------------------------
create or replace function public.pp_ext_details_act(p_store text, p_key text, p_action text, p_field text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  d public.pp_ext_product_details; ch jsonb; nv jsonb; kind text; nm text;
begin
  if not exists (select 1 from public.pp_price_admins a where a.user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'not admin');
  end if;
  select * into d from public.pp_ext_product_details where store = p_store and product_key = p_key for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not found'); end if;

  if p_action = 'delete_row' then
    delete from public.pp_ext_product_details where store = p_store and product_key = p_key;
    return jsonb_build_object('ok', true);
  end if;
  if p_field is null or length(p_field) > 80 then return jsonb_build_object('ok', false, 'error', 'field'); end if;

  if p_action = 'accept_change' then                     -- the new value seen later becomes the saved one
    ch := d.changes -> p_field;
    if ch is null then return jsonb_build_object('ok', false, 'error', 'no change'); end if;
    nv := ch -> 'new';
    if p_field like 'spec:%' then
      nm := substr(p_field, 6);
      update public.pp_ext_product_details set specs = specs || jsonb_build_object(nm, nv), changes = changes - p_field, updated_at = now() where store = p_store and product_key = p_key;
    elsif p_field = 'category' then
      update public.pp_ext_product_details set category = nv, changes = changes - p_field, updated_at = now() where store = p_store and product_key = p_key;
    else
      update public.pp_ext_product_details set fields = fields || jsonb_build_object(p_field, nv),
        sources = sources || jsonb_build_object(p_field, 'admin'), changes = changes - p_field, updated_at = now() where store = p_store and product_key = p_key;
    end if;
  elsif p_action = 'keep_old' then                       -- ignore the newer value
    update public.pp_ext_product_details set changes = changes - p_field, updated_at = now() where store = p_store and product_key = p_key;
  elsif p_action = 'approve_field' then                  -- you checked this saved value: it always wins on the site
    if not (d.fields ? p_field) then return jsonb_build_object('ok', false, 'error', 'no field'); end if;
    update public.pp_ext_product_details set sources = sources || jsonb_build_object(p_field, 'admin'), updated_at = now() where store = p_store and product_key = p_key;
  elsif p_action = 'remove_field' then                   -- wrong value: remove it (spec rows too)
    if p_field like 'spec:%' then
      update public.pp_ext_product_details set specs = specs - substr(p_field, 6), changes = changes - p_field, updated_at = now() where store = p_store and product_key = p_key;
    else
      update public.pp_ext_product_details set fields = fields - p_field, sources = sources - p_field, changes = changes - p_field, updated_at = now() where store = p_store and product_key = p_key;
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'action');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.pp_ext_details_public(text) from public;
revoke all on function public.pp_ext_details_act(text,text,text,text) from public;
grant execute on function public.pp_ext_details_public(text) to anon, authenticated;
grant execute on function public.pp_ext_details_act(text,text,text,text) to authenticated;

-- 3) Spec filters for the Deals page (added 28 Oct): clean details of many products at once.
--    Returns {"product_id": {"ram": "8 GB", "processor": "Apple M4", ...}} - only fields the stores agree on.
create or replace function public.pp_ext_details_facets(p_ids text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb := '{}'::jsonb; v_id text; v_d jsonb; v_f jsonb; k text; v jsonb;
begin
  if p_ids is null then return v_out; end if;
  for v_id in select distinct x from unnest(p_ids[1:600]) x where x is not null and length(x) <= 120 loop
    if not exists (select 1 from public.pp_product_store_listings l join public.pp_ext_product_details d on d.store = l.store_slug
                    where l.product_id = v_id and l.active and l.match_status = 'match') then continue; end if;
    v_d := public.pp_ext_details_public(v_id);
    v_f := '{}'::jsonb;
    for k, v in select * from jsonb_each(coalesce(v_d -> 'fields', '{}'::jsonb)) loop
      if k in ('ram','storage','processor','screen','os','battery','size','gender','material','qty','color') then
        v_f := v_f || jsonb_build_object(k, v -> 'v');
      end if;
    end loop;
    if v_f <> '{}'::jsonb then v_out := v_out || jsonb_build_object(v_id, v_f); end if;
  end loop;
  return v_out;
end;
$$;
revoke all on function public.pp_ext_details_facets(text[]) from public;
grant execute on function public.pp_ext_details_facets(text[]) to anon, authenticated;

-- 4) Admin "Fill from store link" (added 28 Oct): the saved details of one store page, found by its address.
--    Admin only. The product code saved by the extension must appear in the pasted address.
create or replace function public.pp_ext_details_for_url(p_url text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from public.pp_price_admins a where a.user_id = auth.uid()) then jsonb_build_object('ok', false, 'error', 'not admin')
    when p_url is null or p_url !~ '^https://' or length(p_url) > 2000 then jsonb_build_object('ok', false, 'error', 'url')
    else coalesce((
      select jsonb_build_object('ok', true, 'store', d.store, 'product_key', d.product_key, 'title', d.title, 'url', d.url,
               'fields', d.fields, 'sources', d.sources, 'specs', d.specs, 'category', d.category, 'images', coalesce(d.images,'[]'::jsonb), 'updated_at', d.updated_at)
        from public.pp_ext_product_details d
       where public.pp_ext_store_url_ok(d.store, p_url) and public.pp_ext_url_has(p_url, d.product_key)
       order by length(d.product_key) desc, d.updated_at desc
       limit 1), jsonb_build_object('ok', false, 'error', 'not saved'))
  end;
$$;
revoke all on function public.pp_ext_details_for_url(text) from public;
grant execute on function public.pp_ext_details_for_url(text) to authenticated;
