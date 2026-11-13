-- v8 (5 Nov): Admin pending list also returns url + mrp of the other-store rows (needed by Review > Other stores found). Only this one function changes; nothing is deleted.
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
                    'mrp', c.mrp, 'url', c.url, 'title', c.title, 'variant', c.variant, 'seen_at', c.seen_at) order by c.price), '[]'::jsonb)
                 from public.pp_ext_live_cache c where c.store = p.store and c.product_key = p.product_key
                  and c.seen_at > now() - interval '3 days'),
      'aff_template', (select r.aff_template from public.pp_ext_store_rules r where r.store_slug = p.store)
    ) order by p.updated_at desc)
    from public.pp_ext_pending p left join public.pp_catalog_stores st on st.slug = p.store
   where p.status = 'pending'), '[]'::jsonb)) end;
$$;
