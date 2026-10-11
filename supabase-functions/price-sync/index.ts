// PricePulse — price-sync Edge Function (READY FOR API, NOT ACTIVE YET)
// Purpose: one door for automatic prices. When an approved API/feed is available
// (Amazon PA-API / Creators API, Flipkart affiliate feed, Cuelinks feed...),
// the fetcher sends verified offers here and they appear on the website exactly
// like manually verified prices. Manual Admin verification keeps working as today.
//
// Deploy later:  supabase functions deploy price-sync --no-verify-jwt
// Secrets:       supabase secrets set PRICE_SYNC_SECRET=<long random string>
// Call:          POST /functions/v1/price-sync   header  x-price-sync-secret: <secret>
// Body:          { "source": "amazon-pa-api", "offers": [ { "product_id": "oneplus-nord6",
//                  "retailer": "Amazon", "price": 44999, "availability": "in_stock" } ] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SOURCES = new Set(["authorized-retailer-api", "authorized-affiliate-feed", "amazon-creators-api", "amazon-pa-api", "amazon-approved-feed"]);
const RETAILERS = new Set(["Amazon", "Flipkart", "Croma", "Myntra", "AJIO", "Meesho"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const secret = Deno.env.get("PRICE_SYNC_SECRET") || "";
  if (!secret || req.headers.get("x-price-sync-secret") !== secret) return new Response("Unauthorized", { status: 401 });

  let body: { source?: string; offers?: Array<Record<string, unknown>> };
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const source = String(body.source || "");
  if (!SOURCES.has(source)) return new Response("Unknown source", { status: 400 });

  const now = new Date();
  const expires = new Date(now.getTime() + 23.5 * 3600 * 1000); // must stay within 24h rule
  const rows = (body.offers || []).map((o) => ({
    product_id: String(o.product_id || "").toLowerCase(),
    retailer: String(o.retailer || ""),
    price: Number(o.price),
    availability: o.availability === "out_of_stock" ? "out_of_stock" : "in_stock",
  })).filter((o) => /^[a-z0-9-]+$/.test(o.product_id) && RETAILERS.has(o.retailer) && Number.isFinite(o.price) && o.price > 0);
  if (!rows.length) return Response.json({ saved: 0 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const current = rows.map((o) => ({ ...o, checked_at: now.toISOString(), expires_at: expires.toISOString(), source, display_permitted: true, published: true, updated_at: now.toISOString() }));
  const up = await db.from("pp_retailer_prices").upsert(current, { onConflict: "product_id,retailer" });
  if (up.error) return Response.json({ error: up.error.message }, { status: 500 });
  // Price history is written automatically by the existing database trigger (V70).
  return Response.json({ saved: current.length });
});

// TODO when API access is approved: add a small scheduled fetcher (cron) that reads
// product listings from pp_product_store_listings, asks the store API for prices,
// and POSTs them here. Keep the PricePulse rule: same product + same variant only.
