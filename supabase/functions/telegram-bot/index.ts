// PricePulse AI-PLAN Q1: Telegram bot - a shopper sends any product link, the bot answers with the same result as the
// Price Check page (AI link compare engine: only real links, prices read by our server, cached for everyone).
// Secrets: TELEGRAM_BOT_TOKEN (same bot as telegram-deals is fine), TELEGRAM_WEBHOOK_SECRET (any long random text).
// M (price alerts on Telegram): "/start <code>" from the site's "Get alerts on Telegram" button links this chat to the account; "/stop" unlinks.
// Deploy with "Verify JWT" OFF. Then set the webhook ONCE (open in a browser, put your token + secret):
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://akdrydxbvdtadmcphhxj.supabase.co/functions/v1/telegram-bot&secret_token=<SECRET>
import postgres from "npm:postgres@3.4.4";
const SITE = "https://price-pulse.in";
export const inr = (n: unknown) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
export const firstLink = (t: string) => { const m = String(t || "").match(/https?:\/\/[^\s<>"']+/i); return m ? m[0].replace(/[).,!?]+$/, "") : ""; };
export function reply(d: any, link: string) {
  const find = `${SITE}/#/find/${encodeURIComponent(link)}`;
  if (!d || !d.ok) {
    const why = d?.error === "limit" ? "You have checked many links today. Try again tomorrow, or open the site:" : d?.error === "budget" || d?.error === "off" ? "Our live check is resting right now. Open the site:" : "We could not check this link right now. Open it on PricePulse:";
    return `${why}\n${find}`;
  }
  const p = d.product || {};
  const rows = (d.rows || []).filter((r: any) => r && r.price > 0 && r.inStock !== false).sort((a: any, b: any) => a.price - b.price).slice(0, 5);
  const lines = [`<b>${esc(p.title || "Your product")}</b>`];
  if (p.price > 0) lines.push(`Your link (${esc(p.storeName || p.store)}): ${inr(p.price)}`);
  if (rows.length) {
    lines.push("", "Other stores (same product, prices read from the store pages):");
    rows.forEach((r: any, i: number) => lines.push(`${i === 0 ? "🟢" : "•"} ${esc(r.store)}: <b>${inr(r.price)}</b> - <a href="${esc(r.url)}">open</a>`));
    const best = rows[0];
    if (p.price > 0 && best.price < p.price) lines.push("", `You save ${inr(p.price - best.price)} at ${esc(best.store)}.`);
    else if (p.price > 0) lines.push("", "Your link already has the lowest price we found.");
  } else lines.push("", "We did not find this exact product with a price on other stores yet.");
  lines.push("", `All stores, offers and price history: ${find}`, "<i>Prices change often. Store links may earn us a commission.</i>");
  return lines.join("\n");
}
async function send(token: string, chat: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } }) }).catch(() => {});
}
if (typeof Deno !== "undefined") Deno.serve(async (req) => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") || "", secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
  if (!token || !secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("no", { status: 401 });
  const u: any = await req.json().catch(() => ({}));
  const msg = u.message || u.edited_message; const chat = msg?.chat?.id; const text = String(msg?.text || msg?.caption || "");
  if (!chat || msg?.chat?.type !== "private") return new Response("ok");
  const cmd = text.trim().match(/^\/(start|stop)(?:\s+([a-f0-9]{12}))?/i);
  if (cmd) {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (dbUrl) {
      const sql = postgres(dbUrl, { max: 1, prepare: false });
      try {
        if (cmd[1].toLowerCase() === "stop") { await sql`update public.pp_tg_links set chat_id = null, linked_at = null where chat_id = ${chat}`; await send(token, chat, "Telegram alerts are off. Send /start from the site to switch them on again."); return new Response("ok"); }
        if (cmd[2]) {
          const r = await sql`update public.pp_tg_links set chat_id = ${chat}, linked_at = now(), code = null where code = ${cmd[2]} and code_until > now() returning user_id`;
          await send(token, chat, r.length ? "✅ Linked! Your PricePulse price alerts and back-in-stock alerts will come here. Send /stop to switch them off." : "This link has expired. Open My Alerts on price-pulse.in and press \"Get alerts on Telegram\" again.");
          return new Response("ok");
        }
      } catch { /* fall through to the welcome text */ } finally { await sql.end({ timeout: 2 }); }
    }
  }
  const link = firstLink(text);
  if (!link) { await send(token, chat, "Send me a product link from Amazon, Flipkart, Myntra, Croma or any store, and I will find the best price on other stores. 🔍"); return new Response("ok"); }
  await send(token, chat, "Checking other stores… (up to 40 seconds)");
  let d: any = { ok: false };
  try {
    const key = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-link-compare`, { method: "POST", headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}`, "x-pp-client": "tg-" + chat, "x-pp-key": secret }, body: JSON.stringify({ url: link }) });
    d = await r.json();
  } catch { d = { ok: false }; }
  await send(token, chat, reply(d, link));
  return new Response("ok");
});
