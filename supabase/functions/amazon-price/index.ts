// PricePulse: Amazon prices through Amazon's OWN official API (Creators API) - the legal way. Amazon pages are never scraped.
// This is a separate job: nothing else depends on it. It stays OFF until you switch it on (see below).
//
// WHEN YOU CAN SWITCH IT ON: Amazon gives Creators API access only to an approved Associates account with at least
// 10 qualifying sales in the last 30 days (access pauses after 30 days without sales). Until then it answers {ok:false, disabled:true}.
//
// SECRETS (Supabase > Edge Functions > Secrets) - never put them in chat or in code:
//   CREATORS_CLIENT_ID, CREATORS_CLIENT_SECRET   (Associates Central > Tools > Creators API > Create Application > Add credential; India = EU region)
//   AMAZON_API_ENABLED = 1                       (the switch; anything else = off)
//   AMAZON_PARTNER_TAG                           (optional, default pricepulsein-21)
// DEPLOY: "Verify JWT" ON (the site / extension call it with the public key). Run supabase-amazon-creators-v1.sql once first.
//
// CALL:   POST .../functions/v1/amazon-price   body {"asins":["B0XXXXXXXX", ...]}   (up to 10)
// ANSWER: {"ok":true,"items":[{"asin","price","title","image","url","checked_at","cached"}],"missing":["ASIN",...]}
//
// RULES kept here: price is shown with its time (checked_at); a stored price older than 24 hours is never returned
// (Associates rule); the Amazon link keeps the Associates tag.
import postgres from "npm:postgres@3.4.4";

const MARKETPLACE = "www.amazon.in";
const TOKEN_URL = "https://api.amazon.co.uk/auth/o2/token"; // credential version 3.2 = Europe / Middle East / India
const API_URL = "https://creatorsapi.amazon/catalog/v1/getItems";
const FRESH_MS = 2 * 60 * 60 * 1000;   // reuse a stored price for 2 hours
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // never return a price older than 24 hours

// ---- helpers (pure) ----------------------------------------------------------------------------------------------
// HELPERS-BEGIN
const cleanAsins = (v: unknown): string[] => {
  const out: string[] = [];
  for (const a of Array.isArray(v) ? v : []) {
    const s = String(a || "").toUpperCase().trim();
    if (/^[A-Z0-9]{10}$/.test(s) && !out.includes(s)) out.push(s);
  }
  return out.slice(0, 10);
};
// the price field of an OffersV2 listing; the exact shape is read defensively (money.amount first)
const pickPrice = (item: any): number | null => {
  const l = item?.offersV2?.listings;
  const first = Array.isArray(l) ? l[0] : null;
  const cands = [first?.price?.money?.amount, first?.price?.amount, first?.price?.displayAmount, first?.price?.money?.displayAmount];
  for (const c of cands) {
    const n = typeof c === "number" ? c : parseFloat(String(c ?? "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
};
const shapeItem = (item: any, tag: string) => {
  const asin = String(item?.asin || "").toUpperCase();
  const url = /^https:\/\/www\.amazon\.in\//.test(item?.detailPageURL || "") ? String(item.detailPageURL) : `https://www.amazon.in/dp/${asin}?tag=${tag}`;
  return {
    asin,
    price: pickPrice(item),
    title: String(item?.itemInfo?.title?.displayValue || "").slice(0, 300),
    image: /^https:\/\//.test(item?.images?.primary?.small?.url || "") ? String(item.images.primary.small.url) : "",
    url,
  };
};
// HELPERS-END

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  if (Deno.env.get("AMAZON_API_ENABLED") !== "1") return json({ ok: false, disabled: true });
  const id = Deno.env.get("CREATORS_CLIENT_ID"), secret = Deno.env.get("CREATORS_CLIENT_SECRET");
  const tag = Deno.env.get("AMAZON_PARTNER_TAG") || "pricepulsein-21";
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!id || !secret || !dbUrl) return json({ ok: false, error: "not configured" }, 500);

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* empty body */ }
  const asins = cleanAsins(body?.asins);
  if (!asins.length) return json({ ok: false, error: "asins required" }, 400);

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const now = Date.now();
    const rows = await sql`select asin, price, title, image_url, detail_url, checked_at from public.pp_amazon_prices where asin = any(${asins})`;
    const have = new Map<string, any>();
    for (const r of rows) if (now - new Date(r.checked_at).getTime() < MAX_AGE_MS) have.set(r.asin, r);
    const stale = asins.filter((a) => !have.has(a) || now - new Date(have.get(a).checked_at).getTime() > FRESH_MS);

    const fresh = new Map<string, any>();
    if (stale.length) {
      try {
        const t = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret, scope: "creatorsapi::default" }) });
        const tj = await t.json().catch(() => ({}));
        if (t.ok && tj.access_token) {
          const r = await fetch(API_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${tj.access_token}`, "Content-Type": "application/json", "x-marketplace": MARKETPLACE },
            body: JSON.stringify({ itemIds: stale, itemIdType: "ASIN", partnerTag: tag, marketplace: MARKETPLACE, resources: ["offersV2.listings.price", "itemInfo.title", "images.primary.small"] }),
          });
          const rj = await r.json().catch(() => ({}));
          for (const it of rj?.itemResults?.items || []) {
            const s = shapeItem(it, tag);
            if (s.asin && s.price) {
              await sql`insert into public.pp_amazon_prices (asin, price, title, image_url, detail_url, checked_at)
                        values (${s.asin}, ${s.price}, ${s.title}, ${s.image}, ${s.url}, now())
                        on conflict (asin) do update set price = excluded.price, title = excluded.title, image_url = excluded.image_url, detail_url = excluded.detail_url, checked_at = now()`;
              fresh.set(s.asin, { ...s, checked_at: new Date().toISOString(), cached: false });
            }
          }
        }
      } catch (_) { /* API down or access paused: fall back to what is stored (max 24h old) */ }
    }

    const items: any[] = [], missing: string[] = [];
    for (const a of asins) {
      if (fresh.has(a)) items.push(fresh.get(a));
      else if (have.has(a)) { const r = have.get(a); items.push({ asin: a, price: Math.round(Number(r.price)), title: r.title, image: r.image_url, url: r.detail_url, checked_at: new Date(r.checked_at).toISOString(), cached: true }); }
      else missing.push(a);
    }
    return json({ ok: true, items, missing });
  } finally {
    await sql.end({ timeout: 2 });
  }
});
