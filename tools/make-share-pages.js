/* PricePulse V277 (P27) - share pages for WhatsApp / Facebook / X link previews.
   Link-preview apps do not run JavaScript and ignore "#/product/...", so every shared link showed the site's own
   logo and text. This script writes one tiny page per product:  p/<product-id>/index.html  +  p/<product-id>/og.png
   - index.html carries the product's name + picture in its <meta property="og:..."> tags and sends a visitor
     straight on to  /#/product/<product-id>  (the real product page).
   - og.png is a 1200 x 630 card (product photo + name + "Compare prices") drawn with Playwright/Chromium.
   Runs inside the GitHub Action (.github/workflows/pages.yml) on every push and once a day, so new products get a
   share page by themselves. Prices are NOT put in the preview (they change every day; an old price would mislead).
   Amazon-hosted photos are never used (Associates rules).
   Local test:  node tools/make-share-pages.js --data products.json   (no network needed) */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://price-pulse.in';
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const okId = id => /^[a-z0-9][a-z0-9-]{1,80}$/.test(String(id || ''));
const isAmazonImg = u => /(^|\.)(amazon\.[a-z.]+|media-amazon\.com|ssl-images-amazon\.com|amzn\.to)(\/|$)/i.test(String(u || '').replace(/^https?:\/\//, ''));

function supabaseConfig() {
  const js = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8').slice(0, 4000);
  const url = (js.match(/SUPABASE_URL\s*=\s*"([^"]+)"/) || [])[1];
  const key = (js.match(/SUPABASE_KEY\s*=\s*"([^"]+)"/) || [])[1];
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_KEY not found in script.js');
  return { url, key };
}
async function rest(cfg, q) {
  const r = await fetch(`${cfg.url}/rest/v1/${q}`, { headers: { apikey: cfg.key, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${q.split('?')[0]}: HTTP ${r.status}`);
  return r.json();
}
async function loadData() {
  const file = arg('--data');
  if (file) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const cfg = supabaseConfig();
  const [products, listings, stores] = await Promise.all([
    rest(cfg, 'pp_catalog_products?select=product_id,name,brand_slug,category,image_url,live_image_url,status&status=in.(active,tracking)'),
    rest(cfg, 'pp_product_store_listings?select=product_id,store_slug,active&active=eq.true').catch(() => []),
    rest(cfg, 'pp_catalog_stores?select=slug,name,active&active=eq.true').catch(() => [])
  ]);
  return { products, listings, stores };
}

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
/* the card page is set with setContent (about:blank), which cannot load file:// pictures -> inline our own files */
function dataUri(f) { const m = MIME[path.extname(f).toLowerCase()]; return m ? `data:${m};base64,${fs.readFileSync(f).toString('base64')}` : ''; }
/* picture for the card: our own file in the repo, or a non-Amazon https picture */
function photoSrc(p) {
  for (const u of [p.image_url, p.live_image_url]) {
    const s = String(u || '').trim();
    if (!s || isAmazonImg(s)) continue;
    if (/^https:\/\//i.test(s)) return s;
    const local = path.join(ROOT, s.replace(/^\.?\//, '').split(/[?#]/)[0]);
    if (local.startsWith(ROOT) && fs.existsSync(local)) return dataUri(local);
  }
  return '';
}
const CAT = { mobiles: 'Mobiles', laptops: 'Laptops', electronics: 'Electronics', home: 'Home & Kitchen', appliances: 'Appliances', fashion: 'Fashion', beauty: 'Beauty', watches: 'Watches' };

function cardHTML(p, storeNames, photo) {
  const logo = dataUri(path.join(ROOT, 'logo-icon.png'));
  const stores = storeNames.slice(0, 4).join(', ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}body{width:1200px;height:630px;overflow:hidden;font-family:Manrope,"Segoe UI","DejaVu Sans",Arial,sans-serif;
  background:radial-gradient(circle at 88% 8%,rgba(232,185,84,.22),transparent 42%),radial-gradient(circle at 10% 100%,rgba(61,220,151,.14),transparent 45%),#0F1F1A;color:#fff;display:flex;gap:48px;padding:56px}
  .ph{flex:none;width:518px;height:518px;border-radius:36px;background:#fff;display:grid;place-items:center;overflow:hidden;box-shadow:0 30px 60px -30px rgba(0,0,0,.7)}
  .ph img{width:86%;height:86%;object-fit:contain}.ph.none{background:#152A23;border:2px solid rgba(232,185,84,.3)}.ph.none .lg{width:42%;height:42%;opacity:.9}
  .c{flex:1;display:flex;flex-direction:column;min-width:0}
  .br{display:flex;align-items:center;gap:14px;font-weight:800;font-size:34px}.br img{width:56px;height:56px}.br b{color:#3DDC97}
  .cat{margin-top:34px;font-weight:800;font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:#E8B954}
  h1{margin-top:12px;font-size:50px;line-height:1.12;font-weight:800;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
  .st{margin-top:18px;font-size:24px;line-height:1.35;color:#B7CBC4}
  .go{margin-top:auto;align-self:flex-start;padding:18px 30px;border-radius:999px;background:#E8B954;color:#2B2000;font-weight:800;font-size:28px}
  .u{margin-top:16px;font-size:20px;color:#8FA89F;font-weight:700}</style></head><body>
  <div class="ph${photo ? '' : ' none'}">${photo ? `<img src="${esc(photo)}" alt="">` : `<img class="lg" src="${esc(logo)}" alt="">`}</div>
  <div class="c"><div class="br"><img src="${esc(logo)}" alt=""><span>Price<b>Pulse</b></span></div>
    ${CAT[p.category] ? `<div class="cat">${esc(CAT[p.category])}</div>` : ''}
    <h1>${esc(p.name)}</h1>
    <div class="st">${stores ? `Compare verified prices on ${esc(stores)}` : 'Compare verified prices across stores'}, with price history and deal alerts.</div>
    <div class="go">Check the lowest price →</div><div class="u">price-pulse.in</div></div></body></html>`;
}
function pageHTML(p, storeNames) {
  const id = p.product_id, href = `/#/product/${encodeURIComponent(id)}`;
  const title = `${p.name} - compare prices | PricePulse`;
  const desc = `${storeNames.length ? `Compare verified prices on ${storeNames.slice(0, 4).join(', ')}` : 'Compare verified prices across stores'}. Price history, Deal Score and price drop alerts on PricePulse.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="noindex,follow">
<meta property="og:type" content="product"><meta property="og:site_name" content="PricePulse"><meta property="og:title" content="${esc(p.name)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}/p/${esc(id)}/">
<meta property="og:image" content="${SITE}/p/${esc(id)}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(p.name)} on PricePulse"><meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(p.name)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${SITE}/p/${esc(id)}/og.png">
<meta name="theme-color" content="#0F1F1A"><meta http-equiv="refresh" content="0;url=${esc(href)}">
<script>location.replace(${JSON.stringify(href)}+(location.search||''));</script>
<style>body{margin:0;font:600 16px Manrope,Arial,sans-serif;background:#0F1F1A;color:#fff;display:grid;place-items:center;height:100vh}a{color:#3DDC97}</style></head>
<body><a href="${esc(href)}">Open ${esc(p.name)} on PricePulse</a></body></html>
`;
}

(async () => {
  const { products = [], listings = [], stores = [] } = await loadData();
  const storeName = new Map(stores.map(s => [s.slug, s.name]));
  const byProduct = new Map();
  listings.forEach(l => { if (!l.product_id || l.active === false) return; const n = storeName.get(l.store_slug) || l.store_slug; if (!n) return; if (!byProduct.has(l.product_id)) byProduct.set(l.product_id, []); const a = byProduct.get(l.product_id); if (!a.includes(n)) a.push(n); });
  const list = products.filter(p => okId(p.product_id) && String(p.name || '').trim());
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  let ok = 0;
  for (const p of list) {
    const dir = path.join(ROOT, 'p', p.product_id);
    fs.mkdirSync(dir, { recursive: true });
    const names = (byProduct.get(p.product_id) || []).sort((a, b) => (b === 'Amazon') - (a === 'Amazon') || a.localeCompare(b));
    fs.writeFileSync(path.join(dir, 'index.html'), pageHTML(p, names));
    let photo = photoSrc(p);
    try {
      await page.setContent(cardHTML(p, names, photo), { waitUntil: 'load', timeout: 20000 });
      if (photo) { const good = await page.evaluate(() => { const i = document.querySelector('.ph img'); return !!(i && i.complete && i.naturalWidth > 0); }); if (!good) await page.setContent(cardHTML(p, names, ''), { waitUntil: 'load' }); }
      await page.screenshot({ path: path.join(dir, 'og.png') });
      ok++;
    } catch (e) { console.warn('card failed for', p.product_id, e.message); }
  }
  await browser.close();
  console.log(`share pages: ${list.length} products, ${ok} cards`);
})().catch(e => { console.error(e); process.exit(1); });
