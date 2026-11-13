-- PricePulse V1.5.13 - "Save to PricePulse" (Admin key) REPLACES the saved details of that store code.
-- Run ONCE in Supabase > SQL Editor (safe to run again).
-- Why: the normal save never overwrites a saved value (same product: only empty fields are filled, 10 min throttle).
-- When an admin presses "Save to PricePulse" on a page he is looking at, that page is the truth: the old record
-- (old name, old variant, banner photos from an earlier visit) is replaced by what the page shows now.
-- Safety: needs a valid Admin key; an empty read (no fields and no specs) never wipes a good record.

create or replace function public.pp_ext_details_save_admin(
  p_key text, p_store text, p_code text, p_url text, p_title text,
  p_fields jsonb, p_sources jsonb, p_specs jsonb, p_category jsonb, p_conflicts jsonb, p_version text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_old public.pp_ext_product_details;
begin
  v_uid := public.pp_ext_admin_user(p_key);
  if v_uid is null then return jsonb_build_object('status','denied'); end if;
  if p_store is null or p_store !~ '^[a-z0-9-]{2,40}$' or p_code is null or p_code !~ '^[A-Za-z0-9_-]{3,120}$' then
    return jsonb_build_object('status','bad','error','code');
  end if;
  if not public.pp_ext_store_url_ok(p_store, p_url) then return jsonb_build_object('status','bad','error','store'); end if;
  if not public.pp_ext_url_has(p_url, p_code) then return jsonb_build_object('status','bad','error','url'); end if;
  if jsonb_typeof(p_fields) <> 'object' or jsonb_typeof(coalesce(p_specs,'{}')) <> 'object' or jsonb_typeof(coalesce(p_category,'[]')) <> 'array' then
    return jsonb_build_object('status','bad','error','shape');
  end if;
  if length(p_fields::text) > 6000 or length(coalesce(p_specs,'{}')::text) > 30000 or length(coalesce(p_category,'[]')::text) > 1000
     or length(coalesce(p_conflicts,'[]')::text) > 6000 or length(coalesce(p_sources,'{}')::text) > 3000 then
    return jsonb_build_object('status','bad','error','size');
  end if;
  -- nothing read from the page: keep what is saved
  if p_fields = '{}'::jsonb and coalesce(p_specs,'{}'::jsonb) = '{}'::jsonb then
    return jsonb_build_object('status','empty');
  end if;

  select * into v_old from public.pp_ext_product_details where store = p_store and product_key = p_code for update;
  if not found then
    insert into public.pp_ext_product_details(store, product_key, url, title, fields, sources, specs, category, conflicts, ext_version)
    values (p_store, p_code, left(p_url,600), left(p_title,300), p_fields, coalesce(p_sources,'{}'), coalesce(p_specs,'{}'),
            coalesce(p_category,'[]'), coalesce(p_conflicts,'[]'), left(p_version,20));
    return jsonb_build_object('status','new');
  end if;

  -- replace everything the page shows; keep first_seen and the visit counter; old "changes" are void now
  update public.pp_ext_product_details set
     url = left(p_url,600),
     title = coalesce(left(p_title,300), v_old.title),
     fields = p_fields,
     sources = coalesce(p_sources,'{}'),
     specs = coalesce(p_specs,'{}'),
     category = case when jsonb_array_length(coalesce(p_category,'[]')) > 0 then p_category else v_old.category end,
     conflicts = coalesce(p_conflicts,'[]'),
     changes = '{}'::jsonb,
     images = '[]'::jsonb,            -- the extension saves the page's photos right after this call
     seen_count = v_old.seen_count + 1,
     ext_version = left(p_version,20),
     updated_at = now()
   where store = p_store and product_key = p_code;
  return jsonb_build_object('status','replaced');
end;
$$;

revoke all on function public.pp_ext_details_save_admin(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) from public;
grant execute on function public.pp_ext_details_save_admin(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) to anon, authenticated;
