// PricePulse AI-PLAN Q10 + M + P8 sender (cron every hour, supabase-alerts-extra-v1.sql). Verify JWT OFF.
//  Q10: "back in stock" - a waiting stock alert whose product now has a published, in-stock, fresh verified price -> email (+ Telegram if linked), once.
//  M:   deal alerts that are triggered (existing pp_deal_alerts) -> Telegram message to users who linked Telegram, once per trigger.
//  P8:  weekly price email -> moved to send-deal-alerts (13 Nov 2026).
// Secrets: BREVO_API_KEY, ALERT_FROM (same as send-deal-alerts), TELEGRAM_BOT_TOKEN (optional), SITE_URL (optional).
// Test without sending: .../functions/v1/alerts-extra?dry=1
import postgres from "npm:postgres@3.4.4";

export const inr = (n: unknown) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const parseFrom = (v: string) => { const m = v.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/); return m ? { name: (m[1] || "PricePulse").trim() || "PricePulse", email: m[2].trim() } : { name: "PricePulse", email: v.trim() }; };
export function mailHtml(title: string, body: string, site: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#10211B"><div style="background:#10211B;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-size:18px;font-weight:700">Price<span style="color:#3DDC97">Pulse</span></div><div style="border:1px solid #D2DAD5;border-top:0;padding:20px;border-radius:0 0 12px 12px"><p style="margin:0 0 12px;font-size:16px;font-weight:700">${esc(title)}</p>${body}<p style="margin:16px 0 0;font-size:12px;color:#7E8C84">Prices can change at any time. Store links may earn us a commission. Manage your alerts on <a href="${site}/#/alerts">price-pulse.in</a>.</p></div></div>`;
}
export function digestRows(items: any[], site: string) {
  return items.map((x) => {
    const diff = x.week != null && x.now != null ? x.now - x.week : null;
    const change = diff == null ? "" : diff < 0 ? ` <span style="color:#16774d">▼ ${inr(-diff)} this week</span>` : diff > 0 ? ` <span style="color:#b45309">▲ ${inr(diff)} this week</span>` : " (same as last week)";
    return `<p style="margin:0 0 10px;font-size:14px"><a href="${site}/#/product/${encodeURIComponent(x.product_id)}" style="color:#10211B;font-weight:700">${esc(x.name)}</a><br>${x.now != null ? `${inr(x.now)} at ${esc(x.retailer)}${change}` : "No verified price right now"}</p>`;
  }).join("");
}
export function isDigestTime(d: Date) {
  const ist = new Date(d.getTime() + 5.5 * 3600e3);
  return ist.getUTCDay() === 0 && ist.getUTCHours() >= 10;
}

if (typeof Deno !== "undefined") Deno.serve(async (req) => {
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const key = Deno.env.get("BREVO_API_KEY") || "", from = Deno.env.get("ALERT_FROM") || "", tg = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  const site = (Deno.env.get("SITE_URL") || "https://price-pulse.in").replace(/\/+$/, "");
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 1), { status: s, headers: { "content-type": "application/json" } });
  if (!dbUrl) return json({ error: "SUPABASE_DB_URL missing" }, 500);
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  const out: any = { dry, stock: 0, telegram: 0, digest: 0, errors: [] as string[] };
  const mail = async (to: string, subject: string, html: string, text: string) => {
    if (dry || !key || !from || !to) return false;
    const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify({ sender: parseFrom(from), to: [{ email: to }], subject, htmlContent: html, textContent: text }) });
    if (!r.ok) out.errors.push("mail " + r.status);
    return r.ok;
  };
  const tgSend = async (chat: number, text: string) => {
    if (dry || !tg || !chat) return false;
    const r = await fetch(`https://api.telegram.org/bot${tg}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } }) });
    const j: any = await r.json().catch(() => ({}));
    if (!j.ok) out.errors.push("tg " + String(j.description || r.status).slice(0, 80));
    return !!j.ok;
  };
  try {
    // Q10 back in stock
    const due = await sql`select s.id, s.user_id, s.product_id, s.product_name, s.email_to, b.price, b.retailer, l.chat_id
      from public.pp_stock_alerts s join lateral public.pp_best_now(array[s.product_id]) b on true
      left join public.pp_tg_links l on l.user_id = s.user_id
      where s.status = 'waiting' order by s.created_at limit 40`;
    for (const r of due) {
      const link = `${site}/#/product/${encodeURIComponent(r.product_id)}`;
      if (dry) { out.stock++; continue; }
      const ok = await mail(r.email_to, `Back in stock: ${r.product_name}`, mailHtml("It's back in stock", `<p style="margin:0 0 6px;font-size:15px">${esc(r.product_name)}</p><p style="margin:0 0 16px;font-size:15px">Now <b>${inr(r.price)}</b> at ${esc(r.retailer)}</p><p><a href="${link}" style="background:#E8B954;color:#10211B;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:10px;display:inline-block">See it on PricePulse</a></p>`, site), `Back in stock: ${r.product_name}\nNow ${inr(r.price)} at ${r.retailer}\n${link}`);
      const okT = r.chat_id ? await tgSend(Number(r.chat_id), `✅ <b>Back in stock</b>\n${esc(r.product_name)}\n${inr(r.price)} at ${esc(r.retailer)}\n${link}`) : false;
      if (ok || okT) { await sql`update public.pp_stock_alerts set status = 'sent', sent_at = now(), sent_price = ${r.price}, sent_retailer = ${r.retailer} where id = ${r.id}`; out.stock++; }
    }
    // M: triggered deal alerts -> Telegram (once per trigger, last 3 days only)
    const trig = await sql`select a.id, a.product_id, a.product_name, a.target_price, a.triggered_price, a.triggered_retailer, a.triggered_at, l.chat_id
      from public.pp_deal_alerts a join public.pp_tg_links l on l.user_id = a.user_id and l.chat_id is not null
      where a.status = 'triggered' and a.triggered_at > now() - interval '3 days'
        and not exists (select 1 from public.pp_tg_alert_sent s where s.alert_id = a.id and s.triggered_at = a.triggered_at) limit 60`;
    for (const r of trig) {
      if (dry) { out.telegram++; continue; }
      const ok = await tgSend(Number(r.chat_id), `🔔 <b>Price alert</b>\n${esc(r.product_name)} is now <b>${inr(r.triggered_price)}</b>${r.triggered_retailer ? " at " + esc(r.triggered_retailer) : ""} (your target ${inr(r.target_price)})\n${site}/#/product/${encodeURIComponent(r.product_id)}\n<i>Prices change often.</i>`);
      if (ok) { await sql`insert into public.pp_tg_alert_sent (alert_id, triggered_at) values (${r.id}, ${r.triggered_at}) on conflict do nothing`; out.telegram++; }
    }
    // P8 weekly email: moved to send-deal-alerts (new design + unsubscribe), 13 Nov 2026
    return json(out);
  } catch (e) {
    return json({ ...out, error: String((e as Error)?.message || e).slice(0, 300) }, 500);
  } finally { await sql.end({ timeout: 2 }); }
});
