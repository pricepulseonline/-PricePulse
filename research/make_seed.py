import json,re,urllib.parse as up
d=json.load(open('/home/claude/pp/research/top50-v1.json'))
CAT={'Mobiles':'mobiles','Laptops':'laptops','Electronics':'electronics','Watches':'watches','Home & Kitchen':'home','Appliances':'appliances','Beauty':'beauty','Fashion':'fashion'}
SKIP={'Philips Air Fryer 4.2L','Puma Smashic Comfort Sneakers'}
STORES=[('reliance-digital','Reliance Digital','reliancedigital.in','logos/reliance-digital-logo.png'),('vijay-sales','Vijay Sales','vijaysales.com',None),('tata-cliq','Tata CLiQ','tatacliq.com','logos/tatacliq-logo.png'),('nykaa','Nykaa','nykaa.com',None),('purplle','Purplle','purplle.com',None),('jiomart','JioMart','jiomart.com','logos/jiomart-logo.png')]
SEARCH={'Amazon':'https://www.amazon.in/s?k={q}','Flipkart':'https://www.flipkart.com/search?q={q}','Croma':'https://www.croma.com/searchB?q={q}','Reliance Digital':'https://www.reliancedigital.in/search?q={q}','Vijay Sales':'https://www.vijaysales.com/search-listing?q={q}','Tata CLiQ':'https://www.tatacliq.com/search/?searchCategory=all&text={q}','Myntra':'https://www.myntra.com/{qd}','AJIO':'https://www.ajio.com/search/?text={q}','Nykaa':'https://www.nykaa.com/search/result/?q={q}','Purplle':'https://www.purplle.com/search?q={q}','JioMart':'https://www.jiomart.com/search/{q}','Meesho':'https://www.meesho.com/search?q={q}'}
def sq(s):return "'"+str(s).replace("'","''")+"'"
def slug(s):return re.sub(r'-+','-',re.sub(r'[^a-z0-9]+','-',s.lower())).strip('-')[:60]
brands=sorted({r['brand'] for r in d if r['name'] not in SKIP})
out=["-- PricePulse V221 — launch catalog: 48 products (from the Top 50 research list), their brands, stores and store links.",
"-- Run ONCE in Supabase SQL Editor. Safe to run again (existing rows are kept, nothing is overwritten or deleted).",
"-- Products appear on the website automatically (Home, Deals, product pages, filters). Add photos, logos and verified prices in Admin.",
"-- Links marked needs_review are store SEARCH links: replace them in Admin with the exact product page (or your affiliate link).","begin;","",
"-- 1) Stores (skipped if a store with the same slug or name already exists)"]
for s,n,dom,logo in STORES:
    out.append(f"insert into public.pp_catalog_stores(slug,name,domain,logo_url,active) select {sq(s)},{sq(n)},{sq(dom)},{sq(logo) if logo else 'null'},true where not exists (select 1 from public.pp_catalog_stores where slug={sq(s)} or lower(name)=lower({sq(n)}));")
out+=["","-- 2) Brands (skipped if the brand already exists, matched by name)"]
for b in brands:
    out.append(f"insert into public.pp_catalog_brands(slug,name,active) select {sq(slug(b))},{sq(b)},true where not exists (select 1 from public.pp_catalog_brands where slug={sq(slug(b))} or lower(name)=lower({sq(b)}));")
out+=["","-- 3) Products"]
pids={}
for r in d:
    if r['name'] in SKIP:continue
    pid=slug(r['brand']+' '+r['name'])[:60] if not r['name'].lower().startswith(r['brand'].lower().split()[0]) else slug(r['name'])
    pid=pid[:60].strip('-');pid='ao-smith-15l-storage-geyser' if 'AO Smith' in r['name'] else pid;pids[r['id']]=pid
    meta=json.dumps({"source":"launch-research-2026-10","approx_price":r['price'],"why":r['why']},ensure_ascii=False)
    variant=r['variant']
    out.append(f"insert into public.pp_catalog_products(product_id,name,brand_slug,category,identity_key,model_code,variant,image_url,status,metadata) select {sq(pid)},{sq(r['name'])},b.slug,{sq(CAT[r['category']])},{sq(r['name']+' '+variant)},null,{sq(variant)},null,'active',{sq(meta)}::jsonb from public.pp_catalog_brands b where lower(b.name)=lower({sq(r['brand'])}) on conflict (product_id) do nothing;")
out+=["","-- 4) Store links (one row per product + store)"]
n_l=0
for r in d:
    if r['name'] in SKIP:continue
    pid=pids[r['id']]
    q=r['name']+' '+r['variant'].split('·')[0].strip()
    for s in r['stores']:
        url=s['url']; status='unverified'
        if not url:
            tpl=SEARCH[s['store']];url=tpl.format(q=up.quote_plus(q),qd=up.quote(slug(q)));status='needs_review'
        out.append(f"insert into public.pp_product_store_listings(product_id,store_slug,direct_url,listing_status,match_status,active) select {sq(pid)},st.slug,{sq(url)},'active',{sq(status)},true from public.pp_catalog_stores st where lower(st.name)=lower({sq(s['store'])}) and exists(select 1 from public.pp_catalog_products where product_id={sq(pid)}) on conflict (product_id,store_slug) do nothing;")
        n_l+=1
out+=["","commit;","",f"-- Check: select count(*) from public.pp_catalog_products where metadata->>'source'='launch-research-2026-10';  -- expect 48",f"-- Check: select match_status,count(*) from public.pp_product_store_listings group by 1;"]
open('/home/claude/pp/supabase-launch-catalog-v221.sql','w').write("\n".join(out)+"\n")
print(len(pids),n_l,len(brands)); print(sorted(pids.values())[:60])
