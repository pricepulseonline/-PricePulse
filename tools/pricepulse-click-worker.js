/* PricePulse - pricepulse.click prefix link (AI-PLAN, locked 3 Nov). Cloudflare Worker (free plan is enough).
   pricepulse.click/<any product link>  ->  https://price-pulse.in/#/find/<that link>  (Price Check page; AI engine runs there)
   pricepulse.click (nothing after it)   ->  https://price-pulse.in/
   SETUP (one time, ~10 min):
   1. Cloudflare dashboard > Add a domain > pricepulse.click > change the 2 nameservers at the place you bought the domain.
   2. Workers & Pages > Create > Worker > name "pricepulse-click" > Edit code > paste this whole file > Deploy.
   3. That Worker > Settings > Domains & Routes > Add > Custom domain > pricepulse.click (and www.pricepulse.click).
   4. Test: open  pricepulse.click/https://www.flipkart.com/...  and  pricepulse.click/flipkart.com/...
   Before any marketing: share a pricepulse.click link once on WhatsApp, Instagram and Telegram to see it is not blocked. */
const SITE = "https://price-pulse.in";

export default {
  async fetch(request) {
    const u = new URL(request.url);
    // everything after the first "/", with its ?query and #hash (browsers/apps may turn "https://" into "https:/")
    let rest = decodeURIComponent((u.pathname + u.search).replace(/^\/+/, ""));
    rest = rest.replace(/^(https?):\/+/i, "$1://");
    if (!rest || rest === "favicon.ico" || rest === "robots.txt") {
      if (rest === "robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
      return Response.redirect(SITE + "/", 301);
    }
    if (!/^https?:\/\//i.test(rest)) rest = "https://" + rest;
    let ok = false;
    try { const t = new URL(rest); ok = /\.[a-z]{2,}$/i.test(t.hostname) && !/(^|\.)price-pulse\.in$|(^|\.)pricepulse\.click$/i.test(t.hostname); } catch { ok = false; }
    if (!ok) return Response.redirect(SITE + "/#/find", 302);
    return Response.redirect(SITE + "/#/find/" + encodeURIComponent(rest), 302);
  },
};
