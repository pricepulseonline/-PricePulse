// PricePulse V270: Cuelinks coupon sync -> pp_store_offers (source = 'cuelinks').
// Secrets (Supabase > Edge Functions > Secrets): CUELINKS_API_KEY (required),
//   CUELINKS_OFFERS_URL (optional, default below), CUELINKS_AUTH ('token' default, or 'bearer').
// Cron note: Supabase Cron times out after 5 s, but the sync still finishes (checked 29 Oct 2026).
// Test first:  .../functions/v1/cuelinks-sync?dry=1   (shows what it would save, saves nothing)
// Only coupons WITH a code, only stores in STORES below (Cuelinks-approved). A coupon you Hide in Admin stays hidden.
import postgres from "npm:postgres@3.4.4";

const STORES: [RegExp, string][] = [
  [/nykaa\s*fashion/i, "nykaa-fashion"],
  [/nykaa/i, "nykaa"],
  [/tata\s*cliq/i, "tata-cliq"],
  [/vijay\s*sales/i, "vijay-sales"],
];
const URL_DEFAULT = "https://www.cuelinks.com/api/v2/offers.json";

const pick = (o: any, ...keys: string[]) => { for (const k of keys) { const v = k.split(".").reduce((a: any, p) => a?.[p], o); if (v != null && v !== "") return v; } return null; };
const day = (v: any) => { const d = v ? new Date(v) : null; return d && !isNaN(+d) ? d.toISOString().slice(0, 10) : null; };
const BANKS = /\b(HDFC|ICICI|SBI|Axis|Kotak|IndusInd|Deutsche|AU|IDFC(?: First)?|YES|RBL|HSBC|Federal|OneCard|BOB|Citi|AmEx|American Express|Standard Chartered|Tata Neu|UPI|Paytm|PhonePe)\b/i;
const RS = "(?:₹|rs\\.?|inr)\\s*([\\d,]{2,7})";
const toNum = (m: RegExpMatchArray | null) => (m ? Number(m[1].replace(/,/g, "")) : null);
/* Only the part the CODE gives. Sale headlines ("Up to 75% off") are not the code, so they are ignored. */
function money(title: string, desc: string) {
  const all = title + " " + desc;
  let pct: number | null = null;
  const cands = [...title.matchAll(/(\d{1,2}(?:\.\d+)?)\s*%/g)].map((m) => ({ v: Number(m[1]), before: title.slice(Math.max(0, (m.index ?? 0) - 16), m.index ?? 0) }))
    .filter((c) => c.v > 0 && c.v <= 40 && !/up\s*to\s*$/i.test(c.before));
  const pref = cands.find((c) => /(extra|additional|bonus|flat|save|get|enjoy)\s*$/i.test(c.before));
  pct = (pref ?? cands[0])?.v ?? null;
  let flat: number | null = null;
  if (!pct) {
    for (const m of title.matchAll(new RegExp(RS, "ig"))) {
      const before = title.slice(Math.max(0, (m.index ?? 0) - 16), m.index ?? 0);
      if (!/(up\s*to|upto|max(?:imum)?|above|over|min(?:imum)?(?:\s*order)?(?:\s*of)?|worth|on)\s*$/i.test(before)) { flat = Number(m[1].replace(/,/g, "")); break; }
    }
  }
  const cap = pct ? toNum(all.match(new RegExp("(?:up\\s*to|upto|max(?:imum)?(?:\\s*discount)?(?:\\s*of)?)\\s*" + RS, "i"))) : null;
  const min = toNum(all.match(new RegExp("min(?:imum)?\\.?\\s*(?:order|purchase|cart|booking)?(?:\\s*value)?(?:\\s*of)?\\s*" + RS, "i"))) ?? toNum(all.match(new RegExp("(?:above|over|orders?\\s*of)\\s*" + RS, "i")))
    ?? toNum(all.match(new RegExp("(?:your|on\\s*(?:a|your)?|of)\\s*" + RS + "\\s*(?:purchase|order|cart|shopping|or\\s*more|\\+|and\\s*above)", "i")));
  return { pct, flat, cap, min };
}
/* category of the coupon, from Cuelinks' categories + title + code. Only one clear match is saved, else null (= every product). */
const CATS: [string, RegExp][] = [
  ["fashion", /\b(cloth\w*|apparel|fashion|ethnic|kurta\w*|saree\w*|dress\w*|shirts?|t-shirts?|jeans|footwear|shoes?|sneakers?|wardrobe|lingerie|men'?s|women'?s|wrogn|jewell?ery|handbags?|sarees?|westernwear|innerwear)\b/i],
  ["beauty", /\b(beauty|make-?up|skin\s*care|skincare|hair\s*care|haircare|fragrances?|perfumes?|lipsticks?|cosmetics?|grooming|serums?)\b/i],
  ["electronics", /\b(electronics?|mobiles?|smartphones?|phones?|laptops?|tvs?|televisions?|appliances?|gadgets?|headphones?|earbuds?|cameras?|smart\s*watch\w*)\b/i],
  ["home", /\b(home\s*decor|furniture|kitchen\w*|bedding|home\s*furnishing\w*)\b/i],
];
function catOf(o: any, title: string, code: string, slug: string): string | null {
  const c = o?.categories; const cn = Array.isArray(c) ? c.map((x: any) => (typeof x === "string" ? x : x?.name ?? "")).join(" ") : String(c ?? "");
  const text = `${cn} ${title} ${code.replace(/\d+/g, " ")}`;
  const hit = CATS.filter(([, re]) => re.test(text)).map(([k]) => k);
  if (hit.length === 1) return hit[0];
  return slug === "nykaa-fashion" ? "fashion" : null;
}
/* coupon, or a bank / card / UPI offer when the title is tied to a payment method */
function kindOf(title: string): { kind: string; bank: string | null } {
  const b = title.match(BANKS)?.[1] ?? null;
  const pay = /(card|bank|upi|debit|credit|emi|wallet)/i.test(title);
  if (/\bemi\b/i.test(title)) return { kind: "emi", bank: b };
  if (b && pay) return { kind: "bank", bank: b.replace(/^upi$/i, "UPI") };
  return { kind: "coupon", bank: null };
}
function mapOffer(o: any) {
  const store = String(pick(o, "campaign", "campaign_name", "campaign.name", "merchant", "store", "advertiser_name") ?? "");
  const slug = STORES.find(([re]) => re.test(store))?.[1];
  const code = String(pick(o, "coupon_code", "code", "voucher_code") ?? "").trim();
  if (!slug || !code || code.length > 30 || /no\s*code|not\s*required|n\/?a/i.test(code)) return null;
  const title = String(pick(o, "title", "name", "offer_title") ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const desc = String(pick(o, "description", "terms_and_condition", "terms") ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&amp;/g, " ");
  const till = day(pick(o, "end_date", "expiry_date", "valid_till", "end_at"));
  if (!title || (till && till < new Date().toISOString().slice(0, 10))) return null;
  const link = decodeURIComponent(String(pick(o, "url", "affiliate_url") ?? ""));
  if (slug === "tata-cliq" && (/luxury\.tatacliq/i.test(link) || /\bluxury\b/i.test(title))) return null; // Tata CLiQ Luxury codes do not work on tatacliq.com
  const m = money(title, desc);
  if (!m.pct && !m.flat) return null; // the code's own value is not clear: skip, never guess
  const k = kindOf(title);
  return { store: slug, kind: k.kind, bank: k.bank, title, code, pct: m.pct, flat: m.flat, cap: m.cap, min_order: m.min, valid_till: till, category: k.kind === "coupon" ? catOf(o, title, code, slug) : null,
    source: "cuelinks", ext_id: String(pick(o, "id", "offer_id") ?? `${slug}:${code}`), url: pick(o, "affiliate_url", "url") };
}

Deno.serve(async (req) => {
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const key = Deno.env.get("CUELINKS_API_KEY");
  if (!key) return Response.json({ ok: false, error: "Set CUELINKS_API_KEY in Edge Function secrets" }, { status: 500 });
  const base = Deno.env.get("CUELINKS_OFFERS_URL") || URL_DEFAULT;
  const auth = (Deno.env.get("CUELINKS_AUTH") || "token") === "bearer" ? `Bearer ${key}` : `Token token="${key}"`;
  const all: any[] = []; let raw0: any = null;
  for (let page = 1; page <= 60; page++) {
    const u = new URL(base); u.searchParams.set("page", String(page)); u.searchParams.set("per_page", "100");
    const r = await fetch(u, { headers: { Authorization: auth, Accept: "application/json" } });
    if (!r.ok) return Response.json({ ok: false, error: `Cuelinks ${r.status}`, body: (await r.text()).slice(0, 400) }, { status: 502 });
    const j = await r.json(); raw0 ??= j;
    const list = Array.isArray(j) ? j : (j.offers ?? j.data ?? j.coupons ?? j.results ?? []);
    if (!Array.isArray(list) || !list.length) break;
    all.push(...list);
    if (list.length < 100) break;
  }
  const rows = all.map(mapOffer).filter(Boolean) as any[];
  const ours = all.filter((o) => STORES.some(([re]) => re.test(String(pick(o, "campaign", "campaign_name") ?? ""))));
  if (dry) return Response.json({ ok: true, dry: true, fetched: all.length, our_stores: ours.length, with_code: ours.filter((o) => String(o.coupon_code ?? "").trim()).length, usable: rows.length, our_sample: ours.slice(0, 3).map((o) => ({ campaign: o.campaign, title: o.title, code: o.coupon_code, end: o.end_date })), sample_raw: (Array.isArray(raw0) ? raw0 : (raw0?.offers ?? raw0?.data ?? raw0))?.slice?.(0, 3) ?? raw0, rows: rows.slice(0, 20) });
  // write straight to the database (no API keys needed). Same coupon id = update; "active" is never changed, so Hidden stays hidden.
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return Response.json({ ok: false, error: "SUPABASE_DB_URL is missing" }, { status: 500 });
  const uniq = [...new Map(rows.map((r) => [r.ext_id, r])).values()];
  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    if (uniq.length) {
      await sql`insert into public.pp_store_offers ${sql(uniq, "store", "kind", "bank", "title", "code", "pct", "flat", "cap", "min_order", "valid_till", "category", "source", "ext_id", "url")}
        on conflict (source, ext_id) where ext_id is not null do update set store = excluded.store, kind = excluded.kind, bank = excluded.bank,
        title = excluded.title, code = excluded.code, pct = excluded.pct, flat = excluded.flat, cap = excluded.cap, min_order = excluded.min_order,
        valid_till = excluded.valid_till, category = excluded.category, url = excluded.url, updated_at = now()`;
    }
    // a coupon Cuelinks no longer sends is ended (only when the feed looks complete, so a bad API day never wipes everything)
    let ended = 0;
    if (all.length >= 100 && uniq.length) {
      const r = await sql`update public.pp_store_offers set valid_till = (now() at time zone 'Asia/Kolkata')::date - 1, updated_at = now()
        where source = 'cuelinks' and ext_id is not null and not (ext_id = any(${sql.array(uniq.map((x) => x.ext_id))}))
        and (valid_till is null or valid_till >= (now() at time zone 'Asia/Kolkata')::date)`;
      ended = r.count;
    }
    return Response.json({ ok: true, fetched: all.length, usable: rows.length, saved: uniq.length, ended });
  } catch (e) {
    return Response.json({ ok: false, fetched: all.length, usable: rows.length, saved: 0, error: String((e as Error)?.message ?? e) }, { status: 500 });
  } finally {
    await sql.end({ timeout: 2 });
  }
});

