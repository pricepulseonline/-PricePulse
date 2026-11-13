// PricePulse AI link compare (Plan A, AI-1) - Supabase Edge Function "ai-link-compare".
// Site (Price Check page) sends {url, cat}. Answer = same shape the extension gives the site:
//   {ok, product:{title,brand,variant,image,store,storeName,price,mrp,category[]}, rows:[{store,url,price,mrp,inStock,seenAt,match,src:'web'}], offers:[]}
// Secrets (Supabase > Edge Functions > Secrets): ANTHROPIC_API_KEY and/or GEMINI_API_KEY (at least one). Never put keys in the site or in chat.
// Modes: compare (Price Check page, everyone), fill (Admin AI fill, admin only: {url, mode:'fill'}), expand (short share link -> real link, free), offer (admin: offer text -> fields), caption (admin: Instagram caption from our facts), reel (admin: reel hooks + script from our deal facts), photo (everyone: product name from a photo; budget + per-visitor limit apply).
// Settings: table pp_ai_settings (SQL supabase-ai-link-v1.sql) - on/off, model, budget cap, per-IP limit, cache hours, rates.
// Test: POST {"url":"<store link>","dry":true} returns the engine answer without saving the cache (usage is still logged).
import { createClient } from "npm:@supabase/supabase-js@2";

/* ================= ENGINE (no Supabase code; tested with mocks) ================= */
// Rules (claude/AI-PLAN.md): AI only FINDS links. Every price comes from the store page read by this server.
// Only links that appeared in the real web-search results are kept. Amazon pages are never fetched.

export type Store = { name: string; slug: string; domain: string; cats: string[]; noFetch?: boolean; quick?: boolean };

const E = "elec", F = "fashion", B = "beauty", H = "home";
// TOP STORES list (AI-PLAN, locked 31 Oct). domain may carry a path (samsung.com/in) - used for search + matching.
export const STORES: Store[] = [
  { name: "Amazon", slug: "amazon", domain: "amazon.in", cats: [E, F, B, H], noFetch: true },
  { name: "Flipkart", slug: "flipkart", domain: "flipkart.com", cats: [E, F, B, H] },
  { name: "Croma", slug: "croma", domain: "croma.com", cats: [E, H] },
  { name: "Reliance Digital", slug: "reliance-digital", domain: "reliancedigital.in", cats: [E, H] },
  { name: "Vijay Sales", slug: "vijay-sales", domain: "vijaysales.com", cats: [E, H] },
  { name: "Tata CLiQ", slug: "tata-cliq", domain: "tatacliq.com", cats: [E, F, H] },
  { name: "JioMart", slug: "jiomart", domain: "jiomart.com", cats: [E, B, H] },
  { name: "Poorvika", slug: "poorvika", domain: "poorvika.com", cats: [E] },
  { name: "Sangeetha Mobiles", slug: "sangeetha", domain: "sangeethamobiles.com", cats: [E] },
  { name: "Samsung Shop", slug: "samsung", domain: "samsung.com/in", cats: [E] },
  { name: "OnePlus", slug: "oneplus", domain: "oneplus.in", cats: [E] },
  { name: "Xiaomi", slug: "xiaomi", domain: "mi.com", cats: [E] },
  { name: "Lenovo", slug: "lenovo", domain: "lenovo.com/in", cats: [E] },
  { name: "HP", slug: "hp", domain: "hp.com/in-en", cats: [E] },
  { name: "Dell", slug: "dell", domain: "dell.com/en-in", cats: [E] },
  { name: "Myntra", slug: "myntra", domain: "myntra.com", cats: [F, B] },
  { name: "AJIO", slug: "ajio", domain: "ajio.com", cats: [F] },
  { name: "Nykaa Fashion", slug: "nykaa-fashion", domain: "nykaafashion.com", cats: [F] },
  { name: "Meesho", slug: "meesho", domain: "meesho.com", cats: [F, B, H] },
  { name: "Shopsy", slug: "shopsy", domain: "shopsy.in", cats: [F, B, H] },
  { name: "Adidas", slug: "adidas", domain: "adidas.co.in", cats: [F] },
  { name: "Nike", slug: "nike", domain: "nike.com/in", cats: [F] },
  { name: "Puma", slug: "puma", domain: "in.puma.com", cats: [F] },
  { name: "Bewakoof", slug: "bewakoof", domain: "bewakoof.com", cats: [F] },
  { name: "Snapdeal", slug: "snapdeal", domain: "snapdeal.com", cats: [F, H] },
  { name: "Nykaa", slug: "nykaa", domain: "nykaa.com", cats: [B] },
  { name: "Purplle", slug: "purplle", domain: "purplle.com", cats: [B] },
  { name: "Tira", slug: "tira", domain: "tirabeauty.com", cats: [B] },
  { name: "BigBasket", slug: "bigbasket", domain: "bigbasket.com", cats: [B] },
  { name: "PharmEasy", slug: "pharmeasy", domain: "pharmeasy.in", cats: [B] },
  { name: "Apollo Pharmacy", slug: "apollo-pharmacy", domain: "apollopharmacy.in", cats: [B] },
  { name: "Pepperfry", slug: "pepperfry", domain: "pepperfry.com", cats: [H] },
  { name: "IKEA", slug: "ikea", domain: "ikea.com/in", cats: [H] },
  { name: "Decathlon", slug: "decathlon", domain: "decathlon.in", cats: [F, H] },
  { name: "boAt", slug: "boat", domain: "boat-lifestyle.com", cats: [E] },
  { name: "Lenskart", slug: "lenskart", domain: "lenskart.com", cats: [F] },
  { name: "FirstCry", slug: "firstcry", domain: "firstcry.com", cats: [F, H, B] },
  // quick commerce: price depends on the area -> never fetched, only a "Check price" link
  { name: "Blinkit", slug: "blinkit", domain: "blinkit.com", cats: [B], quick: true, noFetch: true },
  { name: "Zepto", slug: "zepto", domain: "zeptonow.com", cats: [B], quick: true, noFetch: true },
  { name: "Swiggy Instamart", slug: "instamart", domain: "swiggy.com/instamart", cats: [B], quick: true, noFetch: true },
];

// site category id -> store group
const CAT_GROUP: Record<string, string> = { mobiles: E, laptops: E, electronics: E, appliances: E, fashion: F, beauty: B, home: H };
export function storesFor(cat: string): Store[] {
  const g = CAT_GROUP[String(cat || "").toLowerCase()];
  return g ? STORES.filter((s) => s.cats.includes(g)) : STORES;
}

function hostOf(u: string) { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } }
function pathOf(u: string) { try { return new URL(u).pathname.toLowerCase(); } catch { return ""; } }
export function storeOfUrl(u: string): Store | null {
  const h = hostOf(u), p = pathOf(u);
  // longest domain first (nykaafashion.com before nykaa.com is not needed - host compare is exact - but samsung.com/in vs others is)
  for (const s of [...STORES].sort((a, b) => b.domain.length - a.domain.length)) {
    const [d, ...rest] = s.domain.split("/");
    const dp = rest.length ? "/" + rest.join("/") : "";
    if ((h === d || h.endsWith("." + d)) && (!dp || p.startsWith(dp))) return s;
  }
  return null;
}

// Cache key: host + path (+ product id params that some stores keep in the query)
const KEEP_Q = ["pid", "productid", "skuid", "sku", "variant", "size", "colour", "color"];
export function linkKey(raw: string): string {
  const u = new URL(raw);
  const asin = amazonAsin(raw);
  if (asin) return "amazon:" + asin;
  const q = KEEP_Q.map((k) => [k, u.searchParams.get(k)]).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("&");
  return (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "") + (q ? "?" + q : "")).toLowerCase();
}
export function amazonAsin(raw: string): string {
  if (!/amazon\.in|amzn\./i.test(hostOf(raw))) return "";
  const m = raw.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?#]|$)/i);
  return m ? m[1].toUpperCase() : "";
}
// words from the link address (good product hint, costs nothing)
export function slugWords(raw: string): string {
  try {
    const u = new URL(raw);
    const parts = u.pathname.split("/").filter((p) => p && p.length > 3 && /[a-z]/i.test(p) && !/^(dp|gp|p|pd|product|products|buy|in|en|en-in|in-en|shop)$/i.test(p));
    const best = parts.sort((a, b) => b.split(/[-_]/).length - a.split(/[-_]/).length)[0] || "";
    return best.replace(/\.(html?|aspx?)$/i, "").replace(/[-_+]+/g, " ").replace(/\b[a-z0-9]{14,}\b/gi, "").replace(/\s+/g, " ").trim().slice(0, 140);
  } catch { return ""; }
}

/* ---------------- page reading (JSON-LD / meta) ---------------- */
export type PageInfo = { ok: boolean; status?: number; title?: string; brand?: string; sku?: string; image?: string; price?: number | null; mrp?: number | null; inStock?: boolean | null; error?: string; text?: string; specs?: Record<string, string>; description?: string; images?: string[] };

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();

function walk(o: any, out: any[]) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) { o.forEach((x) => walk(x, out)); return; }
  const t = o["@type"];
  const types = Array.isArray(t) ? t : [t];
  if (types.some((x: any) => /^(Product|ProductGroup|IndividualProduct)$/i.test(String(x || "")))) out.push(o);
  if (o["@graph"]) walk(o["@graph"], out);
  if (o.mainEntity) walk(o.mainEntity, out);
}
export function parsePage(html: string): PageInfo {
  const prods: any[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim()), prods); } catch { /* broken JSON-LD: skip */ }
  }
  const meta = (k: string) => {
    const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${k}["']`, "i");
    const m = html.match(re1) || html.match(re2);
    return m ? decode(m[1]) : "";
  };
  const info: PageInfo = { ok: true };
  const p = prods.find((x) => x.offers) || prods[0];
  if (p) {
    info.title = decode(String(p.name || ""));
    info.brand = decode(String(typeof p.brand === "object" ? (p.brand?.name || "") : (p.brand || "")));
    info.sku = String(p.mpn || p.model?.name || p.model || p.sku || "").slice(0, 60);
    const imgs = (Array.isArray(p.image) ? p.image : [p.image]).map((i: any) => typeof i === "object" ? (i?.url || i?.contentUrl || "") : (i || "")).filter((u: string) => /^https:\/\//.test(u));
    info.image = imgs[0] || "";
    info.images = imgs.slice(0, 6);
    info.description = decode(String(p.description || "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1500);
    const specs: Record<string, string> = {};
    for (const a of ([] as any[]).concat(p.additionalProperty || [])) { const k = decode(String(a?.name || "")).slice(0, 60), v = decode(String(a?.value ?? "")).slice(0, 200); if (k && v) specs[k] = v; }
    if (p.color) specs["Colour"] = String(p.color).slice(0, 60);
    if (p.size) specs["Size"] = String(typeof p.size === "object" ? (p.size?.name || "") : p.size).slice(0, 60);
    if (Object.keys(specs).length) info.specs = specs;
    let offers = p.offers;
    if (Array.isArray(offers)) offers = offers.find((o: any) => num(o?.price) || num(o?.lowPrice)) || offers[0];
    if (offers && Array.isArray(offers.offers)) offers = offers.offers.find((o: any) => num(o?.price)) || offers;
    if (offers) {
      const cur = String(offers.priceCurrency || "INR").toUpperCase();
      if (cur === "INR") {
        info.price = num(offers.price) ?? num(offers.lowPrice) ?? num(offers.priceSpecification?.price);
        const specs = ([] as any[]).concat(offers.priceSpecification || []);
        const list = specs.find((s) => /ListPrice|MSRP|StrikethroughPrice/i.test(String(s?.priceType || "")));
        info.mrp = num(list?.price) ?? num(offers.highPrice);
      }
      const av = String(offers.availability || "");
      info.inStock = /InStock|LimitedAvailability|PreOrder|OnlineOnly/i.test(av) ? true : /OutOfStock|SoldOut|Discontinued/i.test(av) ? false : null;
    }
  }
  if (!info.title) info.title = meta("og:title") || decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  if (!info.image) info.image = meta("og:image");
  if (info.price == null) {
    const amt = meta("product:price:amount") || meta("og:price:amount") || meta("price");
    const cur = (meta("product:price:currency") || meta("og:price:currency") || meta("priceCurrency") || "INR").toUpperCase();
    if (cur === "INR") info.price = num(amt);
  }
  // MRP is never used as the price; an "MRP" at or below the price is not an MRP -> dropped
  if (info.mrp != null && info.price != null && info.mrp <= info.price) info.mrp = null;
  if (info.image && !/^https:\/\//.test(info.image)) info.image = "";
  info.title = (info.title || "").slice(0, 220);
  // visible text (for the Admin AI fill): no scripts / styles / menus, short
  info.text = decode(html.replace(/<(script|style|noscript|svg|header|footer|nav)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").slice(0, 14000);
  return info;
}

export const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
export async function readPage(url: string, ms = 7000, fetcher: typeof fetch = fetch): Promise<PageInfo> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetcher(url, { signal: ctl.signal, redirect: "follow", headers: { "user-agent": UA, "accept": "text/html,application/xhtml+xml", "accept-language": "en-IN,en;q=0.9" } });
    if (!r.ok) return { ok: false, status: r.status, error: "http " + r.status };
    const html = (await r.text()).slice(0, 2_500_000);
    if (/captcha|access denied|are you a human|request blocked/i.test(html.slice(0, 4000)) && !/ld\+json/i.test(html)) return { ok: false, error: "blocked" };
    return parsePage(html);
  } catch (e) {
    return { ok: false, error: (e as Error)?.name === "AbortError" ? "timeout" : "fetch failed" };
  } finally { clearTimeout(t); }
}

/* ---------------- same product / same variant check ---------------- */
const UNIT_RE = /(\d+(?:\.\d+)?)\s?(gb|tb|ml|l|ltr|litre|g|gm|gms|kg|mah|w|inch|in|cm|mm|pcs|pc|pack|tablets|caps|capsules)\b/gi;
const UNIT_N: Record<string, string> = { ltr: "l", litre: "l", gm: "g", gms: "g", pc: "pcs", in: "inch", caps: "capsules" };
function units(t: string) {
  const m: Record<string, Set<string>> = {};
  for (const x of String(t || "").toLowerCase().matchAll(UNIT_RE)) {
    let u = UNIT_N[x[2]] || x[2];
    let v = Number(x[1]);
    if (u === "tb") { u = "gb"; v *= 1024; }
    if (u === "kg") { u = "g"; v *= 1000; }
    if (u === "l") { u = "ml"; v *= 1000; }
    (m[u] ||= new Set()).add(String(v));
  }
  return m;
}
const words = (t: string) => String(t || "").toLowerCase().replace(/[^a-z0-9.+]+/g, " ").split(" ").filter(Boolean);
const BAD = /\b(refurbished|renewed|pre-?owned|used|open box|unboxed)\b/i;

export type Ident = { brand?: string; model?: string; variant?: string; title?: string };
// "ok" | "mismatch" | "unknown" (title too short to tell)
export function sameProduct(id: Ident, title: string): "ok" | "mismatch" | "unknown" {
  const t = String(title || "");
  if (!t || t.length < 6) return "unknown";
  if (BAD.test(t)) return "mismatch";
  const tw = new Set(words(t));
  // brand must be there (when the store title has a brand at all we cannot know - so only check when brand is a plain word)
  const b = words(id.brand || "")[0];
  if (b && b.length > 2 && !tw.has(b) && !words(t).some((w) => w.startsWith(b))) return "mismatch";
  // model tokens with digits (s24, 141, ce6, 15) must appear
  const mt = words(id.model || "").filter((w) => /\d/.test(w) && !/^\d+(?:\.\d+)?(gb|tb|ml|l|g|kg|mah|w|mm|cm|inch)$/i.test(w) && w.length < 12);
  const compact = t.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (mt.length && !mt.some((w) => tw.has(w) || compact.includes(w.replace(/[^a-z0-9]/g, "")))) return "mismatch";
  // size / storage: if both name the same unit, at least one value must match
  const a = units((id.variant || "") + " " + (id.model || "") + " " + (id.title || "")), c = units(t);
  for (const u of Object.keys(a)) {
    if (!c[u]) continue;
    // both name a value the other does not have (8GB+128GB vs 8GB+256GB, 100 g vs 50 g) -> another variant
    const onlyA = [...a[u]].some((v) => !c[u].has(v)), onlyC = [...c[u]].some((v) => !a[u].has(v));
    if (onlyA && onlyC) return "mismatch";
  }
  return "ok";
}


/* ---------------- AI providers (Claude web search, Gemini Google Search grounding) ---------------- */
export type Usage = { provider: "claude" | "gemini"; model: string; input: number; output: number; searches: number };
export type AiOut = { ident: any; links: { store: string; url: string }[]; seen: Map<string, string>; usage: Usage; error?: string; raw?: string };
export type AskCfg = { provider: "claude" | "gemini"; apiKey: string; model: string; maxSearches: number; search: boolean; fetcher?: typeof fetch };

const SYS_FIND = "You find the same product on Indian online stores. You never invent URLs or prices. Answer with JSON only.";
export function buildPrompt(link: string, store: string, hint: { words: string; page?: PageInfo }, stores: Store[]) {
  const p = hint.page;
  const known = [
    `Product link: ${link}`,
    `Store of the link: ${store}`,
    hint.words ? `Words in the link: ${hint.words}` : "",
    p?.title ? `Title on that page (read by our server): ${p.title}` : "",
    p?.brand ? `Brand on that page: ${p.brand}` : "",
    p?.sku ? `Model / SKU on that page: ${p.sku}` : "",
  ].filter(Boolean).join("\n");
  return `${known}

Tasks:
1. Identify the exact product: brand, model and variant (storage/RAM, size, pack size, colour if it changes the product).
2. Use web search to find this SAME product (same model, same variant, new - not refurbished, renewed or used) on these Indian stores: ${stores.map((s) => `${s.name} (${s.domain})`).join(", ")}. The store of the link itself is not needed.
3. Only include product-page URLs that you actually saw in the search results. Never build or guess a URL. No search, category or listing pages. At most one URL per store. Leave a store out if you are not sure it is the same variant.

Reply with ONLY this JSON, nothing else:
{"product":{"brand":"","model":"","variant":"","category":"mobiles|laptops|electronics|appliances|fashion|beauty|home|other","title":""},"links":[{"store":"","url":""}]}`;
}

export const canon = (u: string) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase(); } catch { return ""; } };
function parseJson(text: string): any {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
}
function toOut(parsed: any, seen: Map<string, string>, usage: Usage, text: string): AiOut {
  if (!parsed) return { ident: {}, links: [], seen, usage, error: "ai answer not JSON", raw: String(text || "").slice(0, 300) };
  const ident = parsed.product && typeof parsed.product === "object" ? parsed.product : parsed;
  const links = (Array.isArray(parsed.links) ? parsed.links : []).filter((l: any) => l && typeof l.url === "string" && /^https:\/\//.test(l.url));
  return { ident, links, seen, usage };
}

export async function askClaude(prompt: string, sys: string, stores: Store[], cfg: AskCfg): Promise<AiOut> {
  const f = cfg.fetcher || fetch;
  const usage: Usage = { provider: "claude", model: cfg.model, input: 0, output: 0, searches: 0 };
  const body: any = { model: cfg.model, max_tokens: 2000, system: sys, messages: [{ role: "user", content: prompt }] };
  if (cfg.search) body.tools = [{
    type: "web_search_20250305", name: "web_search", max_uses: cfg.maxSearches,
    allowed_domains: stores.map((s) => s.domain),
    user_location: { type: "approximate", country: "IN", timezone: "Asia/Kolkata" },
  }];
  let r: Response;
  try {
    r = await f("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch { return { ident: {}, links: [], seen: new Map(), usage, error: "claude unreachable" }; }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) return { ident: {}, links: [], seen: new Map(), usage, error: "claude " + r.status + " " + String(j?.error?.message || "").slice(0, 160) };
  usage.input = Number(j.usage?.input_tokens || 0) + Number(j.usage?.cache_read_input_tokens || 0) + Number(j.usage?.cache_creation_input_tokens || 0);
  usage.output = Number(j.usage?.output_tokens || 0);
  usage.searches = Number(j.usage?.server_tool_use?.web_search_requests || 0);
  // every URL that really came back from the search (grounding) -> its title
  const seen = new Map<string, string>();
  let text = "";
  for (const b of j.content || []) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const it of b.content) if (it?.url) seen.set(canon(it.url), String(it.title || ""));
    if (b.type === "text") {
      text += b.text || "";
      for (const c of b.citations || []) if (c?.url && !seen.has(canon(c.url))) seen.set(canon(c.url), String(c.title || ""));
    }
  }
  return toOut(parseJson(text), seen, usage, text);
}

// Gemini grounding gives redirect links (vertexaisearch.cloud.google.com/grounding-api-redirect/...). We open each
// redirect once (no page download) to learn the real store URL, so the "only links from real search results" rule holds.
const REDIR = /(^|\.)vertexaisearch\.cloud\.google\.com$/i;
async function realUrl(u: string, f: typeof fetch): Promise<string> {
  try {
    if (!REDIR.test(new URL(u).hostname)) return u;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    const r = await f(u, { method: "GET", redirect: "manual", signal: ctl.signal, headers: { "user-agent": UA } }).finally(() => clearTimeout(t));
    const loc = r.headers.get("location") || "";
    try { await r.body?.cancel(); } catch { /* ignore */ }
    return /^https?:\/\//.test(loc) ? loc : u;
  } catch { return u; }
}
export async function askGemini(prompt: string, sys: string, cfg: AskCfg): Promise<AiOut> {
  const f = cfg.fetcher || fetch;
  const usage: Usage = { provider: "gemini", model: cfg.model, input: 0, output: 0, searches: 0 };
  const body: any = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  };
  if (cfg.search) body.tools = [{ google_search: {} }];
  let r: Response;
  try {
    r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, { method: "POST", headers: { "x-goog-api-key": cfg.apiKey, "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch { return { ident: {}, links: [], seen: new Map(), usage, error: "gemini unreachable" }; }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) return { ident: {}, links: [], seen: new Map(), usage, error: "gemini " + r.status + " " + String(j?.error?.message || "").slice(0, 160) };
  usage.input = Number(j.usageMetadata?.promptTokenCount || 0) + Number(j.usageMetadata?.toolUsePromptTokenCount || 0);
  usage.output = Number(j.usageMetadata?.candidatesTokenCount || 0) + Number(j.usageMetadata?.thoughtsTokenCount || 0);
  const cand = j.candidates?.[0] || {};
  const text = (cand.content?.parts || []).map((p: any) => p.text || "").join("");
  const gm = cand.groundingMetadata || {};
  const chunks = (gm.groundingChunks || []).map((c: any) => c?.web).filter((w: any) => w?.uri).slice(0, 20);
  usage.searches = cfg.search && (chunks.length || (gm.webSearchQueries || []).length) ? 1 : 0; // billed per grounded prompt
  const seen = new Map<string, string>();
  const real = new Map<string, string>(); // redirect -> real
  await Promise.all(chunks.map(async (w: any) => { const u = await realUrl(w.uri, f); real.set(w.uri, u); seen.set(canon(u), String(w.title || "")); }));
  const out = toOut(parseJson(text), seen, usage, text);
  // the answer may name the redirect link itself: swap it for the real one
  out.links = await Promise.all(out.links.map(async (l) => ({ ...l, url: real.get(l.url) || (REDIR.test(new URL(l.url).hostname) ? await realUrl(l.url, f) : l.url) })));
  return out;
}
export function askAi(prompt: string, sys: string, stores: Store[], cfg: AskCfg) {
  return cfg.provider === "gemini" ? askGemini(prompt, sys, cfg) : askClaude(prompt, sys, stores, cfg);
}

export type Rates = { haiku?: any; sonnet?: any; gemini?: any; search?: number; gsearch?: number };
export function costInr(list: Usage[], rates: Rates, usdInr: number) {
  let usd = 0;
  for (const u of list) {
    const r = u.provider === "gemini" ? (rates.gemini || { in: 0.75, out: 3.75 }) : /sonnet|opus/.test(u.model) ? (rates.sonnet || { in: 2, out: 10 }) : (rates.haiku || { in: 0.1, out: 0.5 });
    const s = u.provider === "gemini" ? Number(rates.gsearch ?? 14) : Number(rates.search ?? 10);
    usd += (u.input * Number(r.in) + u.output * Number(r.out)) / 1e6 + u.searches * s / 1000;
  }
  return Math.round(usd * usdInr * 100) / 100;
}

// which AI to try, in order: main -> (Claude: bigger model) -> backup. A provider without a key is skipped.
export type RunCfg = { provider: "claude" | "gemini"; backup: "claude" | "gemini" | ""; claudeKey: string; geminiKey: string; claudeModel: string; claudeBig?: string; geminiModel: string; maxSearches: number; fetcher?: typeof fetch };
export function plan(cfg: RunCfg, search: boolean): AskCfg[] {
  const one = (p: "claude" | "gemini", model: string): AskCfg | null => {
    const key = p === "gemini" ? cfg.geminiKey : cfg.claudeKey;
    return key && model ? { provider: p, apiKey: key, model, maxSearches: cfg.maxSearches, search, fetcher: cfg.fetcher } : null;
  };
  const list: (AskCfg | null)[] = [];
  const add = (p: "claude" | "gemini") => {
    if (p === "claude") { list.push(one("claude", cfg.claudeModel)); if (cfg.claudeBig && cfg.claudeBig !== cfg.claudeModel) list.push(one("claude", cfg.claudeBig)); }
    else list.push(one("gemini", cfg.geminiModel));
  };
  add(cfg.provider);
  if (cfg.backup && cfg.backup !== cfg.provider) add(cfg.backup);
  return list.filter(Boolean) as AskCfg[];
}
async function firstGood(prompt: string, sys: string, stores: Store[], tries: AskCfg[], good: (o: AiOut) => boolean) {
  const usages: Usage[] = [];
  let last: AiOut | null = null, model = "";
  for (const c of tries) {
    const o = await askAi(prompt, sys, stores, c);
    usages.push(o.usage);
    if (!o.error && good(o)) return { ai: o, usages, model: c.model };
    if (!last || (!last.links.length && o.links.length)) { last = o; model = c.model; }
  }
  return { ai: last, usages, model };
}

/* ---------------- whole run: link compare ---------------- */
export type Row = { store: string; slug: string; url: string; price: number | null; mrp: number | null; inStock: boolean; seenAt: string; match: "exact"; src: "web"; title?: string; read: "page" | "not_read"; quick?: boolean };
export type RunOut = { ok: boolean; product: any; rows: Row[]; offers: []; provider: string; usages: Usage[]; error?: string; dropped?: { url: string; why: string }[] };

export async function run(link: string, catHint: string, cfg: RunCfg, reader: (u: string) => Promise<PageInfo> = (u) => readPage(u, 7000, cfg.fetcher)): Promise<RunOut> {
  const own = storeOfUrl(link);
  const ownName = own?.name || hostOf(link);
  const asin = amazonAsin(link);
  const words = slugWords(link);
  const tries = plan(cfg, true);
  if (!tries.length) return { ok: false, product: null, rows: [], offers: [], provider: "", usages: [], error: "no api key" };
  // 1. our own read of the pasted page (never Amazon, never quick commerce)
  const page = own?.noFetch || asin ? undefined : await reader(link);
  const pageOk = page && page.ok ? page : undefined;
  const stores = storesFor(catHint).filter((s) => s !== own);
  // 2. AI: identify + find links. Next AI only when the one before could not even name the product.
  const { ai, usages, model } = await firstGood(buildPrompt(link, ownName, { words, page: pageOk }, stores), SYS_FIND, stores, tries, (o) => !!o.ident?.model);
  if (!ai || (ai.error && !ai.links.length)) return { ok: false, product: null, rows: [], offers: [], provider: model, usages, error: ai?.error || "no answer" };
  const ident: Ident & { category?: string } = { ...ai.ident };
  if (!ident.title) ident.title = [ident.brand, ident.model, ident.variant].filter(Boolean).join(" ");
  // 3. keep only grounded links, one per store, on our list, not the pasted store
  const dropped: { url: string; why: string }[] = [];
  const byStore = new Map<string, { s: Store; url: string; title: string }>();
  for (const l of ai.links) {
    const s = storeOfUrl(l.url);
    if (!s) { dropped.push({ url: l.url, why: "store not on our list" }); continue; }
    if (own && s.slug === own.slug) continue;
    const c = canon(l.url);
    if (!ai.seen.has(c)) { dropped.push({ url: l.url, why: "not in search results (made up)" }); continue; }
    if (byStore.has(s.slug)) continue;
    byStore.set(s.slug, { s, url: l.url, title: ai.seen.get(c) || "" });
  }
  // 4. read each page ourselves (in parallel)
  const now = new Date().toISOString();
  const rows: Row[] = [];
  await Promise.all([...byStore.values()].slice(0, 14).map(async ({ s, url, title }) => {
    const pg = s.noFetch ? null : await reader(url);
    const t = (pg && pg.ok && pg.title) || title;
    const same = sameProduct(ident, t);
    if (same === "mismatch") { dropped.push({ url, why: "different product / variant: " + t.slice(0, 80) }); return; }
    const price = pg && pg.ok && same === "ok" ? (pg.price ?? null) : null;
    rows.push({ store: s.name, slug: s.slug, url, price, mrp: price != null ? (pg?.mrp ?? null) : null, inStock: pg && pg.ok && pg.inStock === false ? false : true, seenAt: now, match: "exact", src: "web", title: t.slice(0, 160), read: price != null ? "page" : "not_read", ...(s.quick ? { quick: true } : {}) });
  }));
  rows.sort((a, b) => (a.price ?? 9e15) - (b.price ?? 9e15));
  const cat = String(ident.category || catHint || "").toLowerCase();
  const product = {
    src: "web",
    read: "page",
    title: (pageOk?.title && sameProduct(ident, pageOk.title) !== "mismatch" ? pageOk.title : ident.title) || words,
    brand: ident.brand || pageOk?.brand || "",
    variant: ident.variant || "",
    model: ident.model || "",
    image: pageOk?.image || "",
    store: own?.slug || hostOf(link),
    storeName: ownName,
    price: pageOk?.price ?? null,
    mrp: pageOk?.mrp ?? null,
    inStock: pageOk?.inStock ?? null,
    seenAt: now,
    category: cat && cat !== "other" ? [cat] : [],
    asin: asin || undefined,
  };
  return { ok: true, product, rows, offers: [], provider: model, usages, dropped };
}

/* ---------------- Admin AI fill (B): link -> name, brand, category, variant, specs. Admin still confirms. ---------------- */
const SYS_FILL = "You fill a product form for an Indian price-comparison site. Use ONLY facts written on the given page text or in search results. If a fact is not stated, leave it empty. Never guess prices. Answer with JSON only.";
export function buildFillPrompt(link: string, store: string, words: string, page?: PageInfo) {
  const known = page ? [
    page.title ? `Title: ${page.title}` : "",
    page.brand ? `Brand: ${page.brand}` : "",
    page.sku ? `Model / SKU: ${page.sku}` : "",
    page.specs ? `Specs from the page data: ${JSON.stringify(page.specs).slice(0, 2500)}` : "",
    page.description ? `Description: ${page.description}` : "",
    page.text ? `Page text (cut): ${page.text.slice(0, 9000)}` : "",
  ].filter(Boolean).join("\n") : `We could not read the page. Words in the link: ${words}. Search the web for this exact product on the brand site or big Indian stores.`;
  return `Product link: ${link}
Store: ${store}
${known}

Fill this JSON for the exact product (same variant as the link). Category must be one of: mobiles, laptops, electronics, appliances, fashion, beauty, home, other.
"name" = clean product name with brand, model and variant (no store words like "Buy online"). "variant" = only the variant part (e.g. "8GB RAM, 128GB, Black" or "100 g").
"specs" = up to 25 key facts as "Label": "Value" (e.g. "Display": "6.7 inch AMOLED, 120Hz"). "highlights" = up to 5 short lines. "mrp" only if the page clearly states the MRP, else null.
Reply with ONLY this JSON:
{"name":"","brand":"","model":"","variant":"","category":"","mrp":null,"specs":{},"highlights":[]}`;
}
export async function runFill(link: string, cfg: RunCfg, reader: (u: string) => Promise<PageInfo> = (u) => readPage(u, 8000, cfg.fetcher)) {
  const own = storeOfUrl(link);
  const asin = amazonAsin(link);
  const words = slugWords(link);
  const page = own?.noFetch || asin ? undefined : await reader(link);
  const pageOk = page && page.ok && (page.text || "").length > 400 ? page : undefined;
  const tries = plan(cfg, !pageOk);
  if (!tries.length) return { ok: false, error: "no api key", usages: [] as Usage[], provider: "" };
  const stores = STORES;
  const { ai, usages, model } = await firstGood(buildFillPrompt(link, own?.name || hostOf(link), words, pageOk), SYS_FILL, stores, tries, (o) => !!(o.ident?.name || o.ident?.model));
  if (!ai || ai.error) return { ok: false, error: ai?.error || "no answer", usages, provider: model };
  const d = ai.ident || {};
  const str = (v: any, n = 200) => String(v ?? "").trim().slice(0, n);
  const specs: Record<string, string> = {};
  if (d.specs && typeof d.specs === "object") for (const [k, v] of Object.entries(d.specs).slice(0, 30)) { if (str(k) && str(v)) specs[str(k, 60)] = str(v, 200); }
  for (const [k, v] of Object.entries(pageOk?.specs || {})) if (!specs[k]) specs[k] = v; // the page's own data wins nothing away, only adds
  const cats = ["mobiles", "laptops", "electronics", "appliances", "fashion", "beauty", "home", "other"];
  const mrp = Number(d.mrp);
  return {
    ok: true, provider: model, usages,
    source: pageOk ? "page" : "web search",
    fill: {
      name: str(d.name, 160) || str(pageOk?.title, 160), brand: str(d.brand, 60) || str(pageOk?.brand, 60), model: str(d.model, 80), variant: str(d.variant, 120),
      category: cats.includes(str(d.category).toLowerCase()) ? str(d.category).toLowerCase() : "other",
      mrp: Number.isFinite(mrp) && mrp > 0 ? Math.round(mrp) : null,
      specs, highlights: (Array.isArray(d.highlights) ? d.highlights : []).map((x: any) => str(x, 160)).filter(Boolean).slice(0, 5),
      image: pageOk?.image || "", images: pageOk?.images || [], store: own?.name || hostOf(link), url: link,
    },
  };
}

/* ---------------- Admin: offer text -> form fields (AI-PLAN B) ---------------- */
const SYS_OFFER = "You turn Indian shopping offer text (bank offers, coupons, cashback, EMI) into data. Use ONLY what the text says. Never guess a number or a date that is not written. Answer with JSON only.";
const OFFER_STORES = ["amazon", "flipkart", "croma", "vijay-sales", "reliance-digital", "tata-cliq", "jiomart", "shopsy", "myntra", "ajio", "nykaa", "nykaa-fashion", "purplle", "meesho", "adidas"];
export function buildOfferPrompt(text: string, today: string) {
  return `Today is ${today}. Offer text pasted by our admin:
"""
${text}
"""
Return every separate offer in it (max 8). For each:
kind: bank | coupon | giftcard | emi | cashback | other
store: one of ${OFFER_STORES.join(", ")} or "" if not named
title: short line a shopper reads (max 100 chars, English)
bank: bank or card name (e.g. HDFC, SBI Credit Card) or ""
code: coupon code or ""
pct: percent off (number) or null; flat: flat rupees off (number) or null - only one of the two
cap: maximum rupees saving or null; min_order: minimum order rupees or null
valid_till: last valid date as YYYY-MM-DD or null (a date without a year = the next such date from today)
category: mobiles | laptops | electronics | home | fashion | appliances | beauty | "" (only if the text limits it)
Reply with ONLY: {"offers":[{"kind":"","store":"","title":"","bank":"","code":"","pct":null,"flat":null,"cap":null,"min_order":null,"valid_till":null,"category":""}]}`;
}
export async function runOffer(text: string, cfg: RunCfg) {
  const tries = plan(cfg, false);
  if (!tries.length) return { ok: false, error: "no api key", usages: [] as Usage[], provider: "" };
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const { ai, usages, model } = await firstGood(buildOfferPrompt(text.slice(0, 4000), today), SYS_OFFER, [], tries, (o) => Array.isArray(o.ident?.offers));
  if (!ai || ai.error) return { ok: false, error: ai?.error || "no answer", usages, provider: model };
  const n = (v: any, max: number) => { const x = Number(String(v ?? "").replace(/[^\d.]/g, "")); return v != null && v !== "" && Number.isFinite(x) && x > 0 && x <= max ? Math.round(x * 100) / 100 : null; };
  const str = (v: any, m: number) => String(v ?? "").trim().slice(0, m);
  const kinds = ["bank", "coupon", "giftcard", "emi", "cashback", "other"], cats = ["mobiles", "laptops", "electronics", "home", "fashion", "appliances", "beauty"];
  const offers = (ai.ident.offers as any[]).slice(0, 8).map((o) => {
    const pct = n(o?.pct, 100), flat = pct ? null : n(o?.flat, 500000);
    const d = str(o?.valid_till, 10);
    // a number the text does not contain is dropped (AI must not invent figures)
    const inText = (x: number | null) => x == null ? null : (text.replace(/,/g, "").includes(String(x)) || text.replace(/,/g, "").includes(String(Math.round(x))) ? x : null);
    return {
      kind: kinds.includes(str(o?.kind, 12)) ? str(o?.kind, 12) : "other",
      store: OFFER_STORES.includes(str(o?.store, 30)) ? str(o?.store, 30) : "",
      title: str(o?.title, 120), bank: str(o?.bank, 40), code: str(o?.code, 30).replace(/\s+/g, ""),
      pct: inText(pct), flat: inText(flat), cap: inText(n(o?.cap, 500000)), min_order: inText(n(o?.min_order, 5000000)),
      valid_till: /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d)) ? d : null,
      category: cats.includes(str(o?.category, 20)) ? str(o?.category, 20) : "",
    };
  }).filter((o) => o.title || o.code || o.pct || o.flat);
  return { ok: true, offers, usages, provider: model };
}

/* ---------------- Admin: Instagram caption from OUR facts only (AI-PLAN G) ---------------- */
const SYS_CAP = "You write short Instagram captions for PricePulse, an Indian price-comparison site. Use ONLY the facts given. Never add a price, discount, date or claim that is not in the facts. No fake urgency. Answer with JSON only.";
export function capFacts(f: any) {
  const n = (v: any) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? Math.round(x) : null; };
  return { name: String(f?.name || "").slice(0, 140), store: String(f?.store || "").slice(0, 40), price: n(f?.price), avg30: n(f?.avg30), low30: n(f?.low30),
    pct_below_avg: Number.isFinite(Number(f?.pct)) ? Math.round(Number(f.pct) * 10) / 10 : null, lowest_in_30_days: !!f?.lowest, checked: String(f?.checked || "").slice(0, 40), category: String(f?.category || "").slice(0, 30) };
}
export function buildCapPrompt(f: any, lang: string) {
  return `Facts (JSON): ${JSON.stringify(f)}
Write one Instagram caption in ${lang === "hinglish" ? "Hinglish (Hindi words in English letters, simple)" : "simple English"} for a deal post:
- 3 to 5 short lines, 1-2 emojis max, first line is a hook about the price fact.
- Mention the price and store exactly as given. If lowest_in_30_days is true you may say "lowest in 30 days"; otherwise only the % below average.
- End with: "Price checked ${f.checked || "today"}, may change. Link in bio. #ad"
Also give 8 to 12 relevant hashtags (no spaces inside a tag).
Reply with ONLY: {"caption":"","hashtags":["#..."]}`;
}
// every rupee amount in the caption must be one of our numbers, else the caption is refused
export function capSafe(caption: string, f: any) {
  const ok = new Set([f.price, f.avg30, f.low30].filter(Boolean).map((x: number) => String(x)));
  const nums = [...String(caption).matchAll(/(?:₹|rs\.?\s?|inr\s?)([\d,]+)/gi)].map((m) => m[1].replace(/,/g, ""));
  return nums.every((x) => ok.has(x));
}
export async function runCaption(facts: any, lang: string, cfg: RunCfg) {
  const f = capFacts(facts);
  if (!f.name || !f.price) return { ok: false, error: "name and price needed", usages: [] as Usage[], provider: "" };
  const tries = plan(cfg, false);
  if (!tries.length) return { ok: false, error: "no api key", usages: [] as Usage[], provider: "" };
  const { ai, usages, model } = await firstGood(buildCapPrompt(f, lang), SYS_CAP, [], tries, (o) => typeof o.ident?.caption === "string" && o.ident.caption.length > 10 && capSafe(o.ident.caption, f));
  if (!ai || ai.error) return { ok: false, error: ai?.error || "no answer", usages, provider: model };
  if (!capSafe(ai.ident.caption, f)) return { ok: false, error: "AI used a price that is not ours - use the plain caption", usages, provider: model };
  const tags = (Array.isArray(ai.ident.hashtags) ? ai.ident.hashtags : []).map((t: any) => "#" + String(t).replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")).filter((t: string) => t.length > 2).slice(0, 12);
  return { ok: true, caption: String(ai.ident.caption).slice(0, 1200), hashtags: tags, usages, provider: model };
}

/* ---------------- Admin: reel hooks + short script from our deal facts (AI-PLAN I) ---------------- */
export async function runReel(list: any[], lang: string, cfg: RunCfg) {
  const facts = (Array.isArray(list) ? list : []).slice(0, 3).map(capFacts).filter((f) => f.name && f.price);
  if (!facts.length) return { ok: false, error: "no deals", usages: [] as Usage[], provider: "" };
  const tries = plan(cfg, false);
  if (!tries.length) return { ok: false, error: "no api key", usages: [] as Usage[], provider: "" };
  const prompt = `Deals (JSON, verified by PricePulse): ${JSON.stringify(facts)}
Write for a short Instagram/YouTube reel in ${lang === "english" ? "simple English" : "Hinglish (Hindi in English letters)"} by a price-comparison channel.
1) 5 scroll-stopping hooks (max 12 words each) about checking the REAL price before buying (real vs fake discount, 30-day average, lowest price).
2) One script for about 30 seconds covering these deals: hook, each deal (price + store + the fact), end line "Price check karo PricePulse par, link bio me" (or English).
Use ONLY the numbers in the deals. No other prices, no "sale ending soon", no claims about quality.
Reply with ONLY: {"hooks":["",""],"script":""}`;
  const allOk = (t: string) => facts.some((f) => capSafe(t, f)) && [...String(t).matchAll(/(?:₹|rs\.?\s?)([\d,]+)/gi)].every((m) => facts.some((f) => [f.price, f.avg30, f.low30].filter(Boolean).map(String).includes(m[1].replace(/,/g, ""))));
  const good = (o: AiOut) => Array.isArray(o.ident?.hooks) && typeof o.ident?.script === "string" && allOk(o.ident.script + " " + o.ident.hooks.join(" "));
  const { ai, usages, model } = await firstGood(prompt, SYS_CAP, [], tries, good);
  if (!ai || ai.error) return { ok: false, error: ai?.error || "no answer", usages, provider: model };
  if (!good(ai)) return { ok: false, error: "AI used a price that is not ours - try again", usages, provider: model };
  return { ok: true, hooks: ai.ident.hooks.map((h: any) => String(h).slice(0, 140)).slice(0, 6), script: String(ai.ident.script).slice(0, 2500), usages, provider: model };
}

/* ---------------- P10: photo search - what product is in this photo? (name only, never a price) ---------------- */
const SYS_PHOTO = "You identify a retail product from a photo for an Indian price-comparison site. Only name what you can read or clearly see (brand, model, size on the pack). If unsure, say so. Answer with JSON only.";
export async function runPhoto(b64: string, media: string, cfg: RunCfg) {
  const usages: Usage[] = [];
  const prompt = `What product is this? Reply with ONLY: {"brand":"","model":"","variant":"","category":"mobiles|laptops|electronics|appliances|fashion|beauty|home|other","query":"short search text to find it in a store","sure":true}`;
  const tries = plan(cfg, false);
  for (const c of tries) {
    const f = c.fetcher || fetch;
    let j: any = null, ok = false;
    const u: Usage = { provider: c.provider, model: c.model, input: 0, output: 0, searches: 0 };
    try {
      if (c.provider === "claude") {
        const r = await f("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": c.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: c.model, max_tokens: 400, system: SYS_PHOTO, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: media, data: b64 } }, { type: "text", text: prompt }] }] }) });
        j = await r.json().catch(() => ({})); ok = r.ok;
        u.input = Number(j?.usage?.input_tokens || 0); u.output = Number(j?.usage?.output_tokens || 0);
        j = ok ? parseJson((j.content || []).map((b: any) => b.text || "").join("")) : null;
      } else {
        const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`, { method: "POST", headers: { "x-goog-api-key": c.apiKey, "content-type": "application/json" },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS_PHOTO }] }, contents: [{ role: "user", parts: [{ inline_data: { mime_type: media, data: b64 } }, { text: prompt }] }] }) });
        j = await r.json().catch(() => ({})); ok = r.ok;
        u.input = Number(j?.usageMetadata?.promptTokenCount || 0); u.output = Number(j?.usageMetadata?.candidatesTokenCount || 0);
        j = ok ? parseJson((j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("")) : null;
      }
    } catch { j = null; }
    usages.push(u);
    if (j && (j.query || j.model)) {
      const str = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
      return { ok: true, usages, provider: c.model, product: { brand: str(j.brand, 60), model: str(j.model, 80), variant: str(j.variant, 80), category: str(j.category, 20), query: str(j.query || [j.brand, j.model, j.variant].filter(Boolean).join(" "), 90), sure: j.sure !== false } };
    }
  }
  return { ok: false, error: "could not tell the product", usages, provider: "" };
}

/* ---------------- short share links (phone apps share these) -> the real product link ---------------- */
// Only the redirect address is read (redirect: manual), never the page itself - also for amzn.in.
export const SHORT = /^(amzn\.in|amzn\.to|amzn\.eu|a\.co|dl\.flipkart\.com|fkrt\.it|fkrt\.cc|fktr\.in|myntr\.it|ajio\.me|ajiio\.in|nyk\.aa|nykaa\.me|bit\.ly|tinyurl\.com|t\.co|cutt\.ly|shorturl\.at|meesho\.com\/s|wsli\.nk|extp\.in|bitli\.in|ekaro\.in|earnkaro\.com)$/i;
export function isShort(u: string) { try { const x = new URL(u); const h = x.hostname.replace(/^www\./, ""); return SHORT.test(h) || (h === "dl.flipkart.com" && /^\/s\//.test(x.pathname)); } catch { return false; } }
export async function expand(u: string, f: typeof fetch = fetch): Promise<string> {
  let cur = u;
  for (let i = 0; i < 4 && isShort(cur); i++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
      const r = await f(cur, { method: "GET", redirect: "manual", signal: ctl.signal, headers: { "user-agent": UA } }).finally(() => clearTimeout(t));
      try { await r.body?.cancel(); } catch { /* ignore */ }
      const loc = r.headers.get("location");
      if (!loc) break;
      cur = new URL(loc, cur).toString();
    } catch { break; }
  }
  return cur;
}

/* ================= HTTP handler ================= */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

if (typeof Deno !== "undefined") Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ ok: false, error: "POST only" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return out({ ok: false, error: "bad json" }, 400); }
  const url = String(body.url || "").trim().slice(0, 2000);
  const cat = String(body.cat || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 20);
  if (body.mode === "expand") { // free: no AI, no log
    if (!/^https?:\/\//i.test(url)) return out({ ok: false, error: "not a link" }, 400);
    return out({ ok: true, url: isShort(url) ? await expand(url) : url });
  }
  const mode = body.mode === "fill" ? "fill" : body.mode === "offer" ? "offer" : body.mode === "caption" ? "caption" : body.mode === "reel" ? "reel" : body.mode === "photo" ? "photo" : "compare";
  const offerText = String(body.text || "").trim().slice(0, 4000);
  let key = "";
  if (mode === "offer") { if (offerText.length < 8) return out({ ok: false, error: "no text" }, 400); key = "offer"; }
  else if (mode === "caption" || mode === "reel") { key = mode; }
  else if (mode === "photo") { const im = String(body.image || ""); if (!/^[A-Za-z0-9+/=]{200,2000000}$/.test(im) || !/^image\/(jpeg|png|webp)$/.test(String(body.media || ""))) return out({ ok: false, error: "bad image" }, 400); key = "photo"; }
  else { try { if (!/^https?:\/\//i.test(url)) throw 0; key = linkKey(url); } catch { return out({ ok: false, error: "not a link" }, 400); } }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: st } = await db.from("pp_ai_settings").select("*").eq("id", 1).maybeSingle();
  const s = st || {};

  // Admin-only calls (fill, test runs): checked with the caller's own sign-in
  let admin = false;
  if ((mode !== "compare" && mode !== "photo") || body.dry) {
    const auth = req.headers.get("authorization") || "";
    try {
      const as = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
      const { data } = await as.rpc("pp_ext_is_admin");
      admin = data === true;
    } catch { admin = false; }
    if (!admin) return out({ ok: false, error: "admin only" }, 403);
  }
  if (s.enabled === false && !admin) return out({ ok: false, error: "off" });

  // 1. cache (same link for everyone)
  const cacheH = Number(s.cache_hours ?? 12);
  if (mode === "compare" && !body.dry) {
    const { data: c } = await db.from("pp_ai_link_cache").select("result,updated_at").eq("key", key).maybeSingle();
    if (c && Date.now() - Date.parse(c.updated_at) < cacheH * 3600e3) return out({ ...c.result, cached: true });
  }

  const cfg: RunCfg = {
    provider: s.provider === "gemini" ? "gemini" : "claude",
    backup: s.backup_provider === "claude" || s.backup_provider === "gemini" ? s.backup_provider : (s.backup_provider === "" ? "" : "gemini"),
    claudeKey: Deno.env.get("ANTHROPIC_API_KEY") || "", geminiKey: Deno.env.get("GEMINI_API_KEY") || "",
    claudeModel: String(s.model || "claude-haiku-5-5"),
    claudeBig: s.fallback_model === "" ? undefined : String(s.fallback_model || "claude-sonnet-5-5"),
    geminiModel: String(s.gemini_model || "gemini-3.6-flash"),
    maxSearches: Number(s.max_searches ?? 3),
  };
  if (!cfg.claudeKey && !cfg.geminiKey) return out({ ok: false, error: "no api key" });

  // 2. limits: monthly budget cap (everyone) + per-IP per day (shoppers)
  // our Telegram bot passes each chat as its own "visitor" (checked with the shared secret), so the daily limit is per chat
  const botKey = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
  const viaBot = !!botKey && req.headers.get("x-pp-key") === botKey && /^tg-\d+$/.test(req.headers.get("x-pp-client") || "");
  const ip = viaBot ? String(req.headers.get("x-pp-client")) : (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "?";
  const ipHash = await sha(ip + "|pp-ai");
  const monthStart = new Date(Date.now() + 5.5 * 3600e3); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { data: spent } = await db.rpc("pp_ai_spent_since", { p_since: new Date(+monthStart - 5.5 * 3600e3).toISOString() });
  if (Number(spent || 0) >= Number(s.monthly_budget_inr ?? 3000)) return out({ ok: false, error: "budget" });
  if (!admin) {
    const dayAgo = new Date(Date.now() - 864e5).toISOString();
    const { count } = await db.from("pp_ai_usage").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", dayAgo);
    if ((count || 0) >= Number(s.per_ip_daily ?? 15)) return out({ ok: false, error: "limit" });
  }

  // 3. run (a short share link is opened to its real address first)
  let res: any;
  try {
    if (mode === "offer") res = await runOffer(offerText, cfg);
    else if (mode === "caption") res = await runCaption(body.facts || {}, body.lang === "hinglish" ? "hinglish" : "english", cfg);
    else if (mode === "reel") res = await runReel(body.facts || [], body.lang === "english" ? "english" : "hinglish", cfg);
    else if (mode === "photo") res = await runPhoto(String(body.image), String(body.media), cfg);
    else {
      const real = isShort(url) ? await expand(url) : url;
      res = mode === "fill" ? await runFill(real, cfg) : await run(real, cat, cfg);
    }
  } catch (e) {
    res = { ok: false, error: "engine: " + String((e as Error)?.message || e).slice(0, 120), usages: [], provider: "" };
  }
  const usages: Usage[] = res.usages || [];
  const cost = costInr(usages, s.rates || {}, Number(s.usd_inr ?? 88));
  const sum = (k: "input" | "output" | "searches") => usages.reduce((a, u) => a + (u[k] || 0), 0);
  await db.from("pp_ai_usage").insert({
    ip_hash: ipHash, link_key: key, url: mode === "offer" ? offerText.slice(0, 200) : mode === "caption" ? String(body.facts?.name || "").slice(0, 200) : mode === "photo" ? "photo search" : mode === "reel" ? "reel: " + (Array.isArray(body.facts) ? body.facts.map((f: any) => f?.name).join(", ") : "").slice(0, 190) : url.slice(0, 600), kind: mode, model: usages.map((u) => u.model).join(" > ") || res.provider || "",
    input_tokens: sum("input"), output_tokens: sum("output"), searches: sum("searches"),
    cost_inr: cost, ok: !!res.ok, rows: res.rows?.length || 0, priced: (res.rows || []).filter((x: any) => x.price != null).length,
    note: res.error ? String(res.error).slice(0, 200) : (res.dropped?.length ? JSON.stringify(res.dropped).slice(0, 900) : null),
  });
  if (!res.ok) return out({ ok: false, error: res.error || "failed" });
  if (mode !== "compare") return out({ ...res, cost_inr: cost });
  const result = { ok: true, product: res.product, rows: res.rows.map(({ title: _t, slug: _s, ...x }: any) => x), offers: [], provider: res.provider, at: new Date().toISOString() };
  if (!body.dry) await db.from("pp_ai_link_cache").upsert({ key, url: url.slice(0, 2000), result, updated_at: new Date().toISOString() });
  return out(body.dry ? { ...result, dropped: res.dropped, usages, cost_inr: cost } : result);
});
