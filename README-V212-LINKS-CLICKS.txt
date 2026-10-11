PricePulse V212 — Link Engine, affiliate links, clicks, what to verify next
(includes V211.1 small fixes)

ONE-TIME SETUP (Supabase)
1. Supabase -> SQL Editor -> New query
2. Paste supabase-links-clicks-v212.sql -> Run  ("Success. No rows returned")
   (supabase-hero-growth-v211.sql is already installed - do not need to run again)
3. Upload the new website files.

WEBSITE
- Every Buy / View deal link goes through one Link Engine, only on the shopper's click:
  * Already-affiliate links (EarnKaro, link.amazon, amzn.to, fktr.in, tag=, affid=) -> unchanged
  * Plain amazon.in links -> our tag pricepulsein-21 is added
  * Other stores -> plain link today; Cuelinks wrapper when you switch it ON in Admin
- Every Buy click is counted (product, store, page, affiliate yes/no). No personal data.
- Pasted link we don't track: "Track this product" + "Open on <store>" + search buttons
  for the other stores (labelled "prices not verified yet").

ADMIN -> "Growth & Links"
- Clicks to stores: Today / 7 / 30 days, by store, by page. Use for Cuelinks application.
- What to verify next: products ranked by clicks + wishlists + alerts, with fresh stores.
  "Verify now" opens that product in Catalog.
- Affiliate links: Amazon tracking ID (pricepulsein-21), Cuelinks Channel ID, link
  format, ON/OFF switch.
- Track requests: new "Add as product" button pre-fills the Add Product form.
- Sale countdown (from V211).

API READY (not active yet)
- supabase-functions/price-sync/index.ts : one door for automatic prices
  (sources amazon-pa-api / amazon-creators-api / authorized-affiliate-feed, already
  allowed by the database). Deploy only when an API is approved.
