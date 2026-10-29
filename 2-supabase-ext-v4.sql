-- PricePulse Extension V4 database (28 Oct 2026). Run AFTER 2-supabase-ext-v3.sql. Safe to re-run.
--   1) pp_ext_details_public(product_id): the product details the extension collected from the stores that
--      sell this product (specs, brand, model, colour, category...). Used by the site's Find page and product page.
--      Rules: only values a store page stated; if two stores state a DIFFERENT value for the same field the field
--      is left out (no wrong data); a value you set/approved in Admin always wins. No shopper data, no URLs of
--      shoppers, no "changes"/"conflicts" - only the clean result.
--   2) pp_ext_details_act(...): Admin buttons - accept a new value, keep the old one, remove a wrong field,
--      delete a whole saved listing. Admin only.

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
  end loop;
  -- disagreeing fields: dropped (an Admin-approved value was already protected above)
  for k in select unnest(v_bad) loop
    if not (k = any(v_admin)) then v_fields := v_fields - k; end if;
  end loop;
  if v_n = 0 then return jsonb_build_object('ok', true, 'fields', '{}'::jsonb, 'specs', '{}'::jsonb, 'category', '[]'::jsonb, 'stores', '[]'::jsonb); end if;
  return jsonb_build_object('ok', true, 'fields', v_fields, 'specs', v_specs, 'category', v_cat, 'stores', to_jsonb(v_stores));
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
