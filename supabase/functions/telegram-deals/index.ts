// PricePulse AI-PLAN F: Telegram deal channel auto-post. Cron every 2 hours (supabase-telegram-v1.sql).
// Posts verified prices that are clearly below their 30-day average: photo, price, "Lowest in 30 days", affiliate link + disclosure.
// Secrets (Supabase > Edge Functions > Secrets): TELEGRAM_BOT_TOKEN (from @BotFather; never in chat or code).
// Settings: table pp_tg_settings (starts OFF; set chat_id + enabled). The bot must be an ADMIN of the channel.
// Deploy with "Verify JWT" switched OFF (cron calls it). Safe to call often: a product is posted once per repost_days.
// Test without posting:  .../functions/v1/telegram-deals?dry=1   (shows the posts it would make)
import postgres from "npm:postgres@3.4.4";

export const inr = (n: unknown) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
export function withTag(u: string) {
  // Amazon direct link without our Associates tag -> add it (skip_amazon is on by default, so rarely used)
  try { const x = new URL(u); if (/(^|\.)amazon\.in$/i.test(x.hostname) && !x.searchParams.get("tag")) x.searchParams.set("tag", "pricepulsein-21"); return x.toString(); } catch { return u; }
}
export function caption(c: any, site: string) {
  const avg = Number(c.avg30), price = Number(c.price), low = Number(c.low30);
  const below = Math.round((avg - price) / avg * 100);
  const time = new Date(c.checked_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return [
    `🔥 <b>${esc(c.name)}</b>`,
    ``,
    `<b>${inr(price)}</b> at ${esc(c.retailer)}`,
    price <= low ? `📉 Lowest price in 30 days (30-day average ${inr(avg)})` : `📉 ${below}% below its 30-day average of ${inr(avg)}`,
    ``,
    `🛒 <a href="${esc(withTag(c.url))}">Buy on ${esc(c.retailer)}</a>`,
    `📊 <a href="${esc(site)}/p/${encodeURIComponent(c.product_id)}/">Price history on PricePulse</a>`,
    ``,
    `<i>Price checked ${esc(time)} IST and may change. Affiliate link: we may earn a commission at no cost to you.</i>`,
  ].join("\n");
}
export function photoUrl(img: string, site: string) {
  if (!img) return "";
  if (/^https:\/\//i.test(img)) return img;
  if (/^(data:|http:)/i.test(img)) return "";
  return site + "/" + img.replace(/^\/+/, "");
}
export function quiet(now: Date, start: number, end: number) {
  const h = Number(now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false })) % 24;
  return start > end ? (h >= start || h < end) : (h >= start && h < end);
}

async function tg(token: string, method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  return j && j.ok ? { ok: true, id: Number(j.result?.message_id || 0) } : { ok: false, error: String(j?.description || r.status).slice(0, 200) };
}

if (typeof Deno !== "undefined") Deno.serve(async (req) => {
  const u = new URL(req.url);
  const dry = u.searchParams.get("dry") === "1";
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 1), { status: s, headers: { "content-type": "application/json" } });
  if (!dbUrl) return json({ error: "SUPABASE_DB_URL missing" }, 500);
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  const out: any = { dry, posted: 0, failed: 0, items: [] };
  try {
    const [s] = await sql`select * from public.pp_tg_settings where id = 1`;
    if (!s) return json({ error: "run supabase-telegram-v1.sql first" }, 500);
    const site = String(s.site_url || "https://price-pulse.in").replace(/\/+$/, "");
    if (!dry) {
      if (!s.enabled) return json({ ...out, note: "off (pp_tg_settings.enabled = false)" });
      if (!s.chat_id) return json({ ...out, note: "no chat_id" });
      if (!token) return json({ error: "Set TELEGRAM_BOT_TOKEN in Edge Function secrets" }, 500);
      if (quiet(new Date(), Number(s.quiet_start), Number(s.quiet_end))) return json({ ...out, note: "quiet hours" });
    }
    const rows = await sql`select * from public.pp_tg_candidates(${s.min_drop_pct}, ${s.min_days}, ${s.repost_days}, ${s.skip_amazon}, ${dry ? 10 : s.max_per_run})`;
    for (const c of rows) {
      const text = caption(c, site), photo = photoUrl(c.image_url, site);
      if (dry) { out.items.push({ product_id: c.product_id, photo, text }); continue; }
      let r = photo ? await tg(token, "sendPhoto", { chat_id: s.chat_id, photo, caption: text, parse_mode: "HTML" }) : { ok: false, error: "no photo" };
      if (!r.ok) r = await tg(token, "sendMessage", { chat_id: s.chat_id, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
      await sql`insert into public.pp_tg_posts (product_id, retailer, price, avg30, chat_id, message_id, ok, error)
                values (${c.product_id}, ${c.retailer}, ${c.price}, ${c.avg30}, ${s.chat_id}, ${r.ok ? (r as any).id : null}, ${r.ok}, ${r.ok ? null : (r as any).error})`;
      if (r.ok) out.posted++; else out.failed++;
      out.items.push({ product_id: c.product_id, ok: r.ok, error: r.ok ? undefined : (r as any).error });
    }
    return json(out);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e).slice(0, 300) }, 500);
  } finally { await sql.end({ timeout: 2 }); }
});
