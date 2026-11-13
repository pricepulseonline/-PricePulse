-- v9 (5 Nov): Admin > "Extension: new products" > Review > "Other stores found".
-- After the main store link is confirmed, the ticked other-store links are added to the same product (no price is saved for them).
-- Existing links are never overwritten. Nothing is deleted. Run v8 first.
create or replace function public.pp_ext_pending_confirm_others(p_id bigint, p_product_id text, p_rows jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); r record; e jsonb; v_store text; v_url text; v_title text; v_name text;
  v_added text[] := '{}'; v_skip jsonb := '[]'::jsonb;
begin
  if not public.pp_ext_is_admin() then return jsonb_build_object('ok', false, 'error', 'not admin'); end if;
  select * into r from public.pp_ext_pending where id = p_id;
  if not found or r.status <> 'confirmed' or r.product_id is distinct from p_product_id then
    return jsonb_build_object('ok', false, 'error', 'confirm the main store link first');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then return jsonb_build_object('ok', false, 'error', 'rows'); end if;
  for e in select value from jsonb_array_elements(p_rows) limit 10 loop
    v_store := lower(trim(coalesce(e->>'store','')));
    v_url := trim(coalesce(e->>'url',''));
    v_title := nullif(left(trim(coalesce(e->>'title','')), 300), '');
    select name into v_name from public.pp_catalog_stores where slug = v_store;
    if v_name is null then
      v_skip := v_skip || jsonb_build_array(jsonb_build_object('store', v_store, 'reason', 'store not found'));
    elsif v_store = r.store then
      v_skip := v_skip || jsonb_build_array(jsonb_build_object('store', v_name, 'reason', 'same as the main store'));
    elsif v_url !~ '^https://' or length(v_url) > 2000 or not public.pp_ext_store_url_ok(v_store, v_url) then
      v_skip := v_skip || jsonb_build_array(jsonb_build_object('store', v_name, 'reason', 'link not valid for this store'));
    elsif exists (select 1 from public.pp_product_store_listings where store_slug = v_store and product_id <> p_product_id and direct_url = v_url) then
      v_skip := v_skip || jsonb_build_array(jsonb_build_object('store', v_name, 'reason', 'link already used by another product'));
    elsif exists (select 1 from public.pp_product_store_listings where product_id = p_product_id and store_slug = v_store and coalesce(direct_url,'') <> '') then
      v_skip := v_skip || jsonb_build_array(jsonb_build_object('store', v_name, 'reason', 'this product already has a link here'));
    else
      insert into public.pp_product_store_listings as l
        (product_id, store_slug, direct_url, listing_status, captured_title, match_status, match_score,
         override_reason, last_captured_at, active, updated_by, updated_at)
      values (p_product_id, v_store, v_url, 'active', v_title, 'match', 90,
              'Added in Admin from extension compare (other stores, price not verified)', now(), true, v_uid, now())
      on conflict (product_id, store_slug) do update set
         direct_url = excluded.direct_url, listing_status = 'active', captured_title = coalesce(excluded.captured_title, l.captured_title),
         last_captured_at = now(), active = true, updated_by = v_uid, updated_at = now();
      v_added := v_added || v_name;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'added', to_jsonb(v_added), 'skipped', v_skip);
end;
$$;
revoke all on function public.pp_ext_pending_confirm_others(bigint,text,jsonb) from public;
grant execute on function public.pp_ext_pending_confirm_others(bigint,text,jsonb) to authenticated;
