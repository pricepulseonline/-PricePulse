PricePulse V270 - Gift card row, card rewards, "Save ₹X more", Saving stack, Add cards, Cuelinks coupon sync

FILES (replace in Work/pricepulse-v250):
  compare-v251.js, compare-v251.css, index.html (?v=270)
  admin-prices.html, admin-offers-v268.js (Cuelinks tag), admin-cards-v270.js (NEW: Admin > Growth > "Card rewards")
  supabase-offers-v270.sql (NEW) - run once in Supabase SQL editor (after v268)
  supabase/functions/cuelinks-sync/index.ts (NEW) - Edge Function

CUELINKS (one time):
 1. Supabase > Edge Functions > Deploy new function > name: cuelinks-sync > paste index.ts > Deploy.
    In the function settings turn OFF "Verify JWT" (so the daily job can call it).
 2. Supabase > Edge Functions > Secrets > add CUELINKS_API_KEY = your v3 key. (Never paste the key in chat.)
    If the v3 offers address is different: add CUELINKS_OFFERS_URL. If v3 uses "Bearer": add CUELINKS_AUTH = bearer.
 3. Test: open https://akdrydxbvdtadmcphhxj.supabase.co/functions/v1/cuelinks-sync?dry=1 -> screenshot to Claude (saves nothing).
 4. Run for real: same link without ?dry=1. Coupons show in Admin > Store offers with a "Cuelinks" tag. Hide = stays hidden.
 5. Daily: Supabase > Integrations > Cron > new job, every day 06:00, HTTP request (POST) to the function link.
Only coupons WITH a code and a % / ₹ number, only Nykaa, Nykaa Fashion, Tata CLiQ, Vijay Sales.

CARD REWARDS: 24 starter rows from the banks' card pages (link saved per row, valid till 31 Dec 2026).
Rates change: check the bank page links in Admin > Card rewards and edit/hide.
