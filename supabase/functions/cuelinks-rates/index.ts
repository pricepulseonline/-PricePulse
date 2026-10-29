// PricePulse V278: Cuelinks cashback RATES sync -> pp_cashback_rates (source = 'cuelinks').
// Reads the Cuelinks Monetization API v3 (read:campaigns) once a day for every active store in pp_catalog_stores
// (Amazon is always skipped) and turns each campaign's "payout_categories" into rate rows:
//   model rows (e.g. "All variants of iphone 15, iphone 16 and iphone 17")  > brand rows ("APPLE, REALME, REDMI")
//   > sub-category rows (LED TV, AUDIO, AC ...) > category rows (LAPTOP, Watches)  + "User Max Earn on X" caps.
// A store-wide default is NEVER made. No match = no cashback. Lines it does not understand are saved for Admin
// (Admin > Growth > Cashback) and are not used.
// Cashback is only kept when the campaign allows cashback sites (cashback_publishers_allowed + media "Cashback").
// Secrets (Supabase > Edge Functions > Secrets): CUELINKS_V3_KEY (the v3 API key; never put it in chat or code).
//   SUPABASE_DB_URL is there by default.
// Test first:  .../functions/v1/cuelinks-rates?dry=1   (shows what it would save, saves nothing)
//              .../functions/v1/cuelinks-rates?dry=1&store=Vijay%20Sales   (one store)
const API = "https://developers.cuelinks.com/pub_api/v3";

/* ---------- parser (pure, also used by the local tests) ---------- */
export const norm = (s: any) => String(s ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const B = "(^|[^a-z0-9])", E = "([^a-z0-9]|$)";
/* the text a rule is tested on = " <brand> <product name> " normalised (see the site's cbMatch) */
export const wordsRx = (list: string[]) => {
  const w = [...new Set(list.map((x) => norm(x)).filter((x) => x.length >= 2))];
  return w.length ? `${B}(${w.map((x) => esc(x).replace(/ /g, " ?")).join("|")})${E}` : "";
};
type Def = { cat: string; name?: string[]; brand?: string[]; pri: number; group?: string; skip?: boolean };
/* Cuelinks line names -> our categories (mobiles, laptops, electronics, home, appliances, fashion, beauty, watches).
   '*' = any category, the product NAME must then contain one of the words. */
const AUDIO = ["headphone", "headphones", "earphone", "earphones", "earbuds", "earbud", "buds", "neckband", "tws", "soundbar", "speaker", "speakers", "home theatre", "home theater", "airdopes", "headset"];
const ACCESS = ["charger", "cable", "adapter", "power bank", "powerbank", "case", "cover", "screen guard", "screen protector", "tempered glass"];
const DICT: [RegExp, Def][] = [
  [/^mobiles?( phones?)?$/, { cat: "mobiles", pri: 10, group: "mobile" }],
  [/^apple laptops?$/, { cat: "laptops", brand: ["apple"], pri: 20 }],
  [/^refurbished laptops?$/, { cat: "laptops", name: ["refurbished", "renewed"], pri: 25 }],
  [/^laptops?$/, { cat: "laptops", pri: 10 }],
  [/^desk ?top( computers?)?$|^desktops?$/, { cat: "*", name: ["desktop", "all in one", "aio"], pri: 15 }],
  [/^ipad|^tablets?$/, { cat: "*", name: ["ipad", "tablet", "galaxy tab", "oneplus pad", "redmi pad", "xiaomi pad", "lenovo tab"], pri: 15 }],
  [/^(led )?tvs?$|^led tv|^televisions?$|^led$/, { cat: "*", name: ["tv", "television", "qled", "smart led"], pri: 15 }],
  [/^portable speakers?$/, { cat: "*", name: ["portable speaker", "bluetooth speaker", "party speaker"], pri: 16 }],
  [/^audio$/, { cat: "*", name: AUDIO, pri: 12 }],
  [/^airpods$/, { cat: "*", name: ["airpods"], pri: 30 }],
  [/^apple watch(es)?$/, { cat: "*", name: ["apple watch"], pri: 30 }],
  [/^(smart ?)?watch(es)?$/, { cat: "watches", pri: 10 }],
  [/^air conditioners?$|^acs?$/, { cat: "*", name: ["air conditioner", "split ac", "window ac", "inverter ac", "ac"], pri: 15 }],
  [/^air coolers?$/, { cat: "*", name: ["air cooler", "cooler"], pri: 15 }],
  [/^fridges?$|^refrigerators?$/, { cat: "*", name: ["refrigerator", "fridge"], pri: 15 }],
  [/^washing machines?$/, { cat: "*", name: ["washing machine", "washer"], pri: 15 }],
  [/^microwaves?( ovens?)?$/, { cat: "*", name: ["microwave", "otg", "oven"], pri: 15 }],
  [/^dish ?washers?$/, { cat: "*", name: ["dishwasher", "dish washer"], pri: 15 }],
  [/^water dispensers?$/, { cat: "*", name: ["water dispenser"], pri: 15 }],
  [/^deep freezers?$/, { cat: "*", name: ["deep freezer", "freezer"], pri: 15 }],
  [/^dslr$/, { cat: "*", name: ["dslr", "mirrorless"], pri: 16 }],
  [/^cameras?$/, { cat: "*", name: ["camera", "action cam", "gopro"], pri: 14 }],
  [/^printers?$/, { cat: "*", name: ["printer"], pri: 15 }],
  [/^cartridges?$/, { cat: "*", name: ["cartridge", "toner", "ink"], pri: 16 }],
  [/^monitors?$/, { cat: "*", name: ["monitor"], pri: 15 }],
  [/^stabili[sz]ers?$/, { cat: "*", name: ["stabilizer", "stabiliser"], pri: 15 }],
  [/^massagers?$/, { cat: "*", name: ["massager"], pri: 15 }],
  [/^game accessories$/, { cat: "*", name: ["controller", "gamepad", "joystick", "gaming headset"], pri: 16 }],
  [/^games?$|^gaming$/, { cat: "*", pri: 0, group: "game", skip: true }],
  [/^accessories$/, { cat: "*", name: ACCESS, pri: 14 }],
  [/^small (home|kitchen) appliances?$/, { cat: "*", name: ["mixer", "grinder", "juicer", "blender", "iron", "kettle", "toaster", "air fryer", "airfryer", "induction", "cooktop", "vacuum", "fan", "purifier", "heater", "geyser", "sandwich maker", "chopper", "rice cooker"], pri: 12 }],
  [/^misc|^others?$|^all other/, { cat: "*", pri: 0, skip: true }],
];
const dictOf = (labN: string) => DICT.find(([re]) => re.test(labN))?.[1] ?? null;
const clean = (s: any) => String(s ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
const items = (s: string) => s.split(/\s*(?:,|\n|;|\band\b)\s*/i).map((x) => x.trim()).filter(Boolean);
const codeOf = (it: string) => (norm(it).split(" ").find((t) => t.length >= 5 && /[a-z]/.test(t) && /\d/.test(t)) ?? "");

export type Rate = { category: string; brand_rx: string; name_rx: string; commission_pct: number; flat_amount: number | null; cap_amount: number | null; priority: number; raw_name: string; keys: string[] };
export type Line = { line_no: number; raw_name: string; payout_type: string; payout: number; is_header: boolean; result: string; detail: string };

export function parsePayouts(cats: any[]): { rates: Rate[]; lines: Line[] } {
  const rates: Rate[] = [], lines: Line[] = [], caps: { t: string; v: number; ln: Line }[] = [];
  let ctx: { group?: string; cat?: string; brand?: string } = {};
  (cats || []).forEach((c: any, i: number) => {
    const raw = clean(c?.name), label = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim(), labN = norm(label);
    const payout = Number(c?.payout) || 0, pctType = /%/.test(String(c?.payout_type ?? "")), head = !!c?.is_header;
    const ln: Line = { line_no: i + 1, raw_name: raw.slice(0, 600), payout_type: String(c?.payout_type ?? ""), payout, is_header: head, result: "unmatched", detail: "" };
    lines.push(ln);
    const add = (d: { cat: string; brand?: string[]; name?: string[]; nameRx?: string; pri: number }, keys: string[]) => {
      const r: Rate = { category: d.cat, brand_rx: d.brand?.length ? wordsRx(d.brand) : "", name_rx: d.nameRx ?? (d.name?.length ? wordsRx(d.name) : ""),
        commission_pct: pctType ? payout : 0, flat_amount: !pctType && payout > 0 ? payout : null, cap_amount: null, priority: payout > 0 ? d.pri : d.pri + 5, raw_name: raw.slice(0, 300), keys };
      if (r.category === "*" && !r.brand_rx && !r.name_rx) { ln.result = "unmatched"; ln.detail = "would be store-wide - not used"; return; }
      rates.push(r); ln.result = payout > 0 ? "rate" : "exclusion";
      ln.detail = `${r.category === "*" ? "any category" : r.category}${d.brand?.length ? " · brand " + d.brand.join("/") : ""}${d.name?.length ? " · name has " + d.name.slice(0, 6).join("/") : d.nameRx ? " · series" : ""} · ${payout > 0 ? (pctType ? payout + "%" : "₹" + payout + " flat") : "no commission"}`;
    };
    // 1) caps: "User Max Earn on X", "User max earn commission on X", "User Maximum earn on X"
    const cm = labN.match(/^user (?:can )?max(?:imum)? earn(?: commission)? on (.+)$/);
    if (cm) { caps.push({ t: cm[1].trim(), v: payout, ln }); ln.result = "cap"; return; }
    // 2) headers set the context (MOBILE, then SAMSUNG under it)
    if (head) {
      const d = dictOf(labN);
      if (d) ctx = { group: d.group, cat: d.cat };
      else if (ctx.group === "mobile") ctx.brand = labN.split(" ")[0];
      ln.result = "header"; ln.detail = d ? `section ${label}` : ctx.brand ? `brand ${ctx.brand}` : "section";
      return;
    }
    // 3) "Not applicable on accessories of CMF and Nothing brand"
    const na = labN.match(/^not applicable on (.+?) of (.+?) brands?$/);
    if (na) {
      const d = dictOf(na[1]);
      add({ cat: d?.cat ?? "*", name: d?.name ?? [na[1]], brand: items(na[2]).map(norm), pri: (d?.pri ?? 15) + 2 }, [norm(na[1])]);
      return;
    }
    // 4) a known category line
    const d = dictOf(labN);
    if (d && !/series/.test(labN)) {
      if (d.skip) { ln.result = "skipped"; ln.detail = "too general - not used"; if (d.group) ctx = { group: d.group }; return; }
      if (d.group) { ctx = { group: d.group, cat: d.cat }; }
      else ctx = {};
      add(d, [labN]);
      return;
    }
    // 5) "<Brand> <category>" e.g. "Lloyd Air Conditioners", "GOOGLE Mobile", "Oneplus Mobiles"
    const w = labN.split(" ");
    if (w.length >= 2 && !/[{=\n]/.test(raw)) {
      const d2 = dictOf(w.slice(1).join(" "));
      if (d2 && !d2.skip) { add({ ...d2, brand: [w[0]], pri: d2.pri + (d2.group ? 10 : 5) }, [labN, ...(d2.group ? [d2.group] : [])]); if (!d2.group) ctx = {}; return; }
    }
    // 6) inside MOBILE: series rows (Samsung) or brand lists
    if (ctx.group === "mobile" && !/[{=]/.test(raw)) {
      if (/series/.test(labN) && ctx.brand) {
        const pats = items(label).map((it) => {
          const t = norm(it).replace(/\bseries\b/g, "").trim();
          if (!t) return "";
          return /^[a-z]$/.test(t) ? `(galaxy )?${t} ?[0-9]+` : esc(t).replace(/ /g, " ?");
        }).filter(Boolean);
        add({ cat: "mobiles", brand: [ctx.brand], nameRx: pats.length ? `${B}(${pats.join("|")})${E}` : "", pri: 25 }, [labN, "mobile"]);
        return;
      }
      ctx.brand = undefined;
      const its = items(label).map((x) => norm(x).replace(/\bmobiles?\b|\bphones?\b|\bsmartphones?\b/g, "").trim()).filter(Boolean);
      if (its.length && its.every((x) => !x.includes(" "))) { add({ cat: "mobiles", brand: its, pri: 20 }, [labN, "mobile"]); return; }
      if (its.length) { add({ cat: "*", name: its, pri: 30 }, [labN, "mobile"]); return; }
    }
    // 7) model lists: "All variants of iphone 15, iphone 16 and iphone 17", "SONY {PS4 ...}", "SONY SMART LED KD32W825, ..."
    let body = raw;
    const br = raw.search(/[{=]/);
    if (br > 0) body = raw.slice(br + 1);
    body = body.replace(/[{}]/g, "\n").replace(/^\s*all variants of\s*/i, "");
    const its = items(body).filter((x) => !/^any brand/i.test(x));
    if (its.length) {
      const words = its.map((it) => codeOf(it) || norm(it)).filter((x) => x.length >= 3);
      if (words.length && words.length <= 40) { add({ cat: "*", name: words, pri: 30 }, [labN]); return; }
    }
    ln.result = "unmatched"; ln.detail = "not understood - not used";
  });
  // caps: exact label first, else lines whose label contains the cap target (or the reverse); the smaller cap wins
  for (const c of caps) {
    let hit = rates.filter((r) => r.keys.includes(c.t));
    if (!hit.length) hit = rates.filter((r) => r.keys.some((k) => k.length >= 3 && (k.includes(c.t) || c.t.includes(k))));
    hit.forEach((r) => { if (c.v > 0) r.cap_amount = r.cap_amount == null ? c.v : Math.min(r.cap_amount, c.v); });
    c.ln.detail = hit.length ? `max ₹${c.v} commission on ${hit.length} ${hit.length === 1 ? "rule" : "rules"}` : "cap for nothing we know - not used";
    if (!hit.length) c.ln.result = "unmatched";
  }
  // one row per (category, brand, name): keep the first
  const seen = new Set<string>();
  const uniq = rates.filter((r) => { const k = `${r.category}|${r.brand_rx}|${r.name_rx}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { rates: uniq, lines };
}

/* campaign rules: may we show cashback for this store at all? */
export function rulesOf(c: any) {
  const allowed: string[] = (c?.media?.allowed ?? []).map(String), dis: string[] = (c?.media?.disallowed ?? []).map(String);
  const has = (l: string[], re: RegExp) => l.some((x) => re.test(x));
  const status = String(c?.access_status ?? "");
  const cashback = c?.cashback_publishers_allowed === true && has(allowed, /cashback/i) && !has(dis, /cashback/i) && !/paus|reject|clos|suspend|block/i.test(status);
  return { cashback, coupons: !has(dis, /^coupons?$/i), deals: !has(dis, /^deals?$/i), allowed, dis, status };
}

/* ---------- Cuelinks API ---------- */
const host = (u: any) => { try { return new URL(/^https?:/i.test(String(u)) ? String(u) : "https://" + String(u)).hostname.replace(/^www\.|^m\./, "").toLowerCase(); } catch (_) { return String(u ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]; } };
async function api(path: string, key: string) {
  const r = await fetch(API + path, { headers: { Authorization: `Token ${key}`, Accept: "application/json" } });
  const t = await r.text();
  if (!r.ok) throw new Error(`Cuelinks ${r.status} on ${path.split("?")[0]}: ${t.slice(0, 160)}`);
  return JSON.parse(t);
}
async function findCampaign(store: { name: string; domain: string }, key: string, pinned?: number) {
  if (pinned) return (await api(`/campaigns/${pinned}`, key))?.data ?? null;
  const j = await api(`/campaigns?q=${encodeURIComponent(store.name)}&per_page=50`, key);
  const list: any[] = Array.isArray(j) ? j : (j?.data ?? j?.campaigns ?? []);
  const d = host(store.domain), n = norm(store.name).replace(/ /g, "");
  const hit = list.find((c) => host(c?.domain ?? c?.url) === d) ?? list.find((c) => norm(c?.name).replace(/ /g, "") === n);
  if (!hit?.id) return null;
  return (await api(`/campaigns/${hit.id}`, key))?.data ?? hit;
}

/* ---------- handler ---------- */
if (typeof (globalThis as any).Deno !== "undefined") (globalThis as any).Deno.serve(async (req: Request) => {
  const Deno = (globalThis as any).Deno;
  const q = new URL(req.url).searchParams, dry = q.get("dry") === "1", only = q.get("store");
  const key = Deno.env.get("CUELINKS_V3_KEY") || Deno.env.get("CUELINKS_API_KEY");
  if (!key) return Response.json({ ok: false, error: "Set CUELINKS_V3_KEY in Edge Function secrets" }, { status: 500 });
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return Response.json({ ok: false, error: "SUPABASE_DB_URL is missing" }, { status: 500 });
  const { default: postgres } = await import("npm:postgres@3.4.4");
  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    const set = (await sql`select value from public.pp_site_settings where key = 'cashback'`)[0]?.value ?? {};
    const last = Date.parse(set.last_sync ?? "");
    if (!dry && Number.isFinite(last) && Date.now() - last < 10 * 60e3 && q.get("force") !== "1") return Response.json({ ok: true, skipped: "synced less than 10 minutes ago" });
    const pins: Record<string, number> = set.campaigns ?? {};
    let stores = await sql`select name, domain from public.pp_catalog_stores where active order by name`;
    stores = stores.filter((s: any) => !/^amazon/i.test(norm(s.name).replace(/ /g, "")) && (!only || norm(s.name) === norm(only)));
    const out: any[] = [];
    for (const s of stores) {
      const res: any = { store: s.name, status: "error", rates: 0, unmatched: 0 };
      try {
        const c = await findCampaign(s, key, Number(pins[s.name]) || undefined);
        if (!c) { res.status = "no_campaign"; out.push({ res, s }); continue; }
        const ru = rulesOf(c), p = parsePayouts(c.payout_categories ?? []);
        Object.assign(res, { status: ru.cashback ? "ok" : "cashback_not_allowed", campaign_id: c.id, campaign_name: c.name, rules: ru, rates: p.rates.length, unmatched: p.lines.filter((l) => l.result === "unmatched").length });
        out.push({ res, s, c, ru, p });
      } catch (e) { res.error = String((e as Error)?.message ?? e).slice(0, 300); out.push({ res, s }); }
    }
    if (dry) return Response.json({ ok: true, dry: true, stores: out.map((o) => ({ ...o.res, sample: o.p?.rates.slice(0, 40).map(({ keys, ...r }: any) => r), lines: o.p?.lines })) });
    let saved = 0;
    await sql.begin(async (tx: any) => {
      for (const o of out) {
        const r = o.res;
        await tx`insert into public.pp_cashback_campaigns (store, campaign_id, campaign_name, status, cashback_allowed, coupons_allowed, deals_allowed, media_allowed, media_disallowed, validation_time, payment_time, error, synced_at)
          values (${o.s.name}, ${r.campaign_id ?? null}, ${r.campaign_name ?? null}, ${r.status}, ${o.ru?.cashback ?? false}, ${o.ru?.coupons ?? null}, ${o.ru?.deals ?? null},
            ${o.ru?.allowed ?? []}, ${o.ru?.dis ?? []}, ${o.c?.validation_time ?? null}, ${o.c?.payment_time ?? null}, ${r.error ?? null}, now())
          on conflict (store) do update set campaign_id = excluded.campaign_id, campaign_name = excluded.campaign_name, status = excluded.status, cashback_allowed = excluded.cashback_allowed,
            coupons_allowed = excluded.coupons_allowed, deals_allowed = excluded.deals_allowed, media_allowed = excluded.media_allowed, media_disallowed = excluded.media_disallowed,
            validation_time = excluded.validation_time, payment_time = excluded.payment_time, error = excluded.error, synced_at = now()`;
        if (r.status === "error") continue; // a bad API answer never wipes yesterday's rates
        await tx`delete from public.pp_cashback_rate_lines where store = ${o.s.name}`;
        if (o.p?.lines?.length) await tx`insert into public.pp_cashback_rate_lines ${tx(o.p.lines.map((l: Line) => ({ store: o.s.name, campaign_id: r.campaign_id ?? null, ...l })), "store", "campaign_id", "line_no", "raw_name", "payout_type", "payout", "is_header", "result", "detail")}`;
        if (r.status === "ok" && !o.p.rates.length) continue; // nothing usable today: keep the old rates
        await tx`delete from public.pp_cashback_rates where source = 'cuelinks' and store = ${o.s.name}`;
        if (r.status === "ok") {
          const rows = o.p.rates.map(({ keys, ...x }: any) => ({ ...x, store: o.s.name, source: "cuelinks", campaign_id: r.campaign_id, active: true, note: null }));
          await tx`insert into public.pp_cashback_rates ${tx(rows, "store", "category", "brand_rx", "name_rx", "commission_pct", "flat_amount", "cap_amount", "priority", "raw_name", "source", "campaign_id", "active", "note")}`;
          saved += rows.length;
        }
      }
      await tx`insert into public.pp_site_settings (key, value, is_public, updated_at) values ('cashback', ${tx.json({ share: 0.4, min: 5, ...set, last_sync: new Date().toISOString() })}, true, now())
        on conflict (key) do update set value = public.pp_site_settings.value || jsonb_build_object('last_sync', ${new Date().toISOString()}::text), updated_at = now()`;
    });
    return Response.json({ ok: true, saved, stores: out.map((o) => o.res) });
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  } finally {
    await sql.end({ timeout: 2 });
  }
});
