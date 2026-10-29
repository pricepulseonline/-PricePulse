-- PricePulse V1.4.5 - self-healing saved details. Run ONCE in Supabase > SQL Editor (safe to run again).
-- If the saved record names a different product than the page now being saved (old wrong data left by a
-- single-page store), the record is replaced by the page's data. Same product = old rules (nothing overwritten).

create or replace function public.pp_ext_same_product(a text, b text)
returns boolean
language sql
immutable
as $f$
  with x as (select distinct w from regexp_split_to_table(lower(regexp_replace(coalesce(a,''), '\([^)]*\)', ' ', 'g')), '[^a-z0-9]+') w
              where length(w) > 1 and w !~ '^(gb|tb|ram|rom|the|and|with|for|online|buy|best|price|new|latest|in|at|of|5g|4g|lte)$'),
       y as (select distinct w from regexp_split_to_table(lower(regexp_replace(coalesce(b,''), '\([^)]*\)', ' ', 'g')), '[^a-z0-9]+') w
              where length(w) > 1 and w !~ '^(gb|tb|ram|rom|the|and|with|for|online|buy|best|price|new|latest|in|at|of|5g|4g|lte)$')
  select case when (select count(*) from x) = 0 or (select count(*) from y) = 0 then true
              else (select count(*) from x join y using (w))::numeric / least((select count(*) from x), (select count(*) from y)) >= 0.5 end;
$f$;

create or replace function public.pp_ext_details_save(
  p_store text, p_key text, p_url text, p_title text,
  p_fields jsonb, p_sources jsonb, p_specs jsonb, p_category jsonb, p_conflicts jsonb, p_version text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_old public.pp_ext_product_details;
  v_fields jsonb; v_specs jsonb; v_changes jsonb; v_cat jsonb; k text; v jsonb;
begin
  if p_store is null or p_store !~ '^[a-z0-9-]{2,40}$' or p_key is null or p_key !~ '^[A-Za-z0-9_-]{3,120}$' then return; end if;
  if not public.pp_ext_store_url_ok(p_store, p_url) then return; end if;
  if jsonb_typeof(p_fields) <> 'object' or jsonb_typeof(coalesce(p_specs,'{}')) <> 'object' or jsonb_typeof(coalesce(p_category,'[]')) <> 'array' then return; end if;
  if length(p_fields::text) > 6000 or length(coalesce(p_specs,'{}')::text) > 30000 or length(coalesce(p_category,'[]')::text) > 1000
     or length(coalesce(p_conflicts,'[]')::text) > 6000 or length(coalesce(p_sources,'{}')::text) > 3000 then return; end if;

  select * into v_old from public.pp_ext_product_details where store = p_store and product_key = p_key for update;
  if not found then
    insert into public.pp_ext_product_details(store, product_key, url, title, fields, sources, specs, category, conflicts, ext_version)
    values (p_store, p_key, left(p_url,600), left(p_title,300), p_fields, coalesce(p_sources,'{}'), coalesce(p_specs,'{}'),
            coalesce(p_category,'[]'), coalesce(p_conflicts,'[]'), left(p_version,20));
    return;
  end if;
  -- V1.4.5: the saved record names a different product than this page (old wrong data): replace it with the page's data
  if not public.pp_ext_same_product(v_old.title, p_title) then
    delete from public.pp_ext_product_details where store = p_store and product_key = p_key;
    insert into public.pp_ext_product_details(store, product_key, url, title, fields, sources, specs, category, conflicts, ext_version)
    values (p_store, p_key, left(p_url,600), left(p_title,300), p_fields, coalesce(p_sources,'{}'), coalesce(p_specs,'{}'),
            coalesce(p_category,'[]'), coalesce(p_conflicts,'[]'), left(p_version,20));
    return;
  end if;
  if v_old.updated_at > now() - interval '10 minutes' then return; end if; -- one save per product every 10 minutes

  -- fill empty fields; a different value is kept aside in "changes" (Admin decides), never overwritten
  v_fields := v_old.fields; v_changes := v_old.changes;
  for k, v in select * from jsonb_each(p_fields) loop
    if not (v_fields ? k) then v_fields := v_fields || jsonb_build_object(k, v);
    elsif v_fields -> k <> v then v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('old', v_fields -> k, 'new', v, 'seen_at', now()));
    end if;
  end loop;
  v_specs := v_old.specs;
  for k, v in select * from jsonb_each(coalesce(p_specs,'{}')) loop
    if not (v_specs ? k) then
      if (select count(*) from jsonb_object_keys(v_specs)) < 200 then v_specs := v_specs || jsonb_build_object(k, v); end if;
    elsif v_specs -> k <> v then v_changes := v_changes || jsonb_build_object('spec:' || left(k,60), jsonb_build_object('old', v_specs -> k, 'new', v, 'seen_at', now()));
    end if;
  end loop;
  v_cat := v_old.category;
  if jsonb_array_length(v_cat) = 0 then v_cat := coalesce(p_category,'[]');
  elsif jsonb_array_length(coalesce(p_category,'[]')) > 0 and v_cat <> p_category then
    v_changes := v_changes || jsonb_build_object('category', jsonb_build_object('old', v_cat, 'new', p_category, 'seen_at', now()));
  end if;
  if length(v_changes::text) > 20000 then v_changes := v_old.changes; end if;

  update public.pp_ext_product_details set
    fields = v_fields, sources = v_old.sources || (coalesce(p_sources,'{}') - array(select jsonb_object_keys(v_old.sources))),
    specs = v_specs, category = v_cat, changes = v_changes,
    conflicts = case when jsonb_array_length(coalesce(p_conflicts,'[]')) > 0 then p_conflicts else v_old.conflicts end,
    title = coalesce(v_old.title, left(p_title,300)), seen_count = v_old.seen_count + 1,
    ext_version = left(p_version,20), updated_at = now()
   where store = p_store and product_key = p_key;
end;
$$;

grant execute on function public.pp_ext_details_save(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) to anon, authenticated;
