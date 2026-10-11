"""V223: exact store links for the 48 launch products.
Reads research/top50-v1.json (what V221 seeded) + research/links-v223.json (exact links found)
and writes supabase-launch-links-v223.sql.
Only touches a listing while it still has the exact URL V221 seeded, so links you already
changed in Admin are never overwritten."""
import json, re, urllib.parse as up
R = '/home/claude/pp/research/'
d = json.load(open(R + 'top50-v1.json'))
found = json.load(open(R + 'links-v223.json'))
# stores that were not in the V221 list but carry the exact product (added as new links)
ADD = {'22': {'Croma': 'https://www.croma.com/noise-colorfit-pulse-4-smartwatch-with-bluetooth-calling-46-9mm-amoled-display-ip68-water-resistant-space-blue-strap-/p/306740'}}
SKIP = {'Philips Air Fryer 4.2L', 'Puma Smashic Comfort Sneakers'}
SEARCH = {'Amazon':'https://www.amazon.in/s?k={q}','Flipkart':'https://www.flipkart.com/search?q={q}','Croma':'https://www.croma.com/searchB?q={q}','Reliance Digital':'https://www.reliancedigital.in/search?q={q}','Vijay Sales':'https://www.vijaysales.com/search-listing?q={q}','Tata CLiQ':'https://www.tatacliq.com/search/?searchCategory=all&text={q}','Myntra':'https://www.myntra.com/{qd}','AJIO':'https://www.ajio.com/search/?text={q}','Nykaa':'https://www.nykaa.com/search/result/?q={q}','Purplle':'https://www.purplle.com/search?q={q}','JioMart':'https://www.jiomart.com/search/{q}','Meesho':'https://www.meesho.com/search?q={q}'}
# seeded links that were not an exact product page (collection / series / listing pages, wrong host, discontinued)
NOT_EXACT = re.compile(r'/collection/|/sections/|croma\.com/l/|nykaaman\.com|/p/321826$|dl\.flipkart\.com')
def sq(s): return "'" + str(s).replace("'", "''") + "'"
def slug(s): return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')[:60]

out = ["-- PricePulse V223 — exact store links for the 48 launch products (run AFTER supabase-launch-catalog-v221.sql).",
"-- Run ONCE in Supabase SQL Editor. Safe to run again.",
"-- * Store SEARCH links from V221 are replaced with the exact product page (right model, RAM/storage, size).",
"-- * Where no exact page was found, that store is switched OFF for the product (active=false, needs_review).",
"--   It stays in Admin → Growth & Links → 'Links to fix', so you can paste the right link later.",
"-- * A listing you already changed in Admin is NOT touched (we only update rows that still have the V221 link).",
"begin;", ""]
stats = {'exact': 0, 'kept': 0, 'off': 0}
report = []
for r in d:
    if r['name'] in SKIP: continue
    pid = slug(r['brand'] + ' ' + r['name'])[:60] if not r['name'].lower().startswith(r['brand'].lower().split()[0]) else slug(r['name'])
    pid = pid[:60].strip('-'); pid = 'ao-smith-15l-storage-geyser' if 'AO Smith' in r['name'] else pid
    q = r['name'] + ' ' + r['variant'].split('·')[0].strip()
    fx = found.get(str(r['id']), {})
    out.append(f"-- {r['name']} ({r['variant']})")
    for s in r['stores']:
        st = s['store']; orig = s['url']
        seeded = orig or SEARCH[st].format(q=up.quote_plus(q), qd=up.quote(slug(q)))
        where = f"where l.product_id={sq(pid)} and l.store_slug=(select slug from public.pp_catalog_stores where lower(name)=lower({sq(st)}) limit 1) and l.direct_url={sq(seeded)} and coalesce(l.affiliate_url,'')=''"
        new = fx.get(st)
        if new:
            if new == seeded:
                stats['kept'] += 1; report.append((r['name'], st, 'kept', new)); continue
            out.append(f"update public.pp_product_store_listings l set direct_url={sq(new)}, match_status='unverified', listing_status='active', active=true, updated_at=now() {where};")
            stats['exact'] += 1; report.append((r['name'], st, 'exact', new))
        elif orig and not NOT_EXACT.search(orig):
            stats['kept'] += 1; report.append((r['name'], st, 'kept', orig))
        else:
            out.append(f"update public.pp_product_store_listings l set active=false, match_status='needs_review', updated_at=now() {where};")
            stats['off'] += 1; report.append((r['name'], st, 'off', ''))
    for st, new in (ADD.get(str(r['id'])) or {}).items():
        out.append(f"insert into public.pp_product_store_listings(product_id,store_slug,direct_url,listing_status,match_status,active) select {sq(pid)},st.slug,{sq(new)},'active','unverified',true from public.pp_catalog_stores st where lower(st.name)=lower({sq(st)}) and exists (select 1 from public.pp_catalog_products where product_id={sq(pid)}) on conflict (product_id,store_slug) do nothing;")
        stats['added'] = stats.get('added', 0) + 1; report.append((r['name'], st, 'added', new))
    out.append("")
out += ["commit;", "",
"-- Check: select match_status, active, count(*) from public.pp_product_store_listings group by 1,2 order by 1,2;",
f"-- Expected after first run: {stats['exact']} links replaced with exact pages, {stats['off']} store links switched off (to fix in Admin), {stats['kept']} already exact, {stats.get('added',0)} new store link added."]
open('/home/claude/pp/supabase-launch-links-v223.sql', 'w').write("\n".join(out) + "\n")
json.dump(report, open(R + 'links-v223-report.json', 'w'), indent=1)
print(stats)
