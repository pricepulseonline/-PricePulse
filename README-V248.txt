PricePulse V248 (26 Oct 2026) - changed files
1. admin-fullurl-v248.js (NEW)  Admin > Growth: "Full product URL (extension)" list.
   Amazon/Flipkart listings with only a short affiliate link (link.amazon, fktr.in) are "Not linked"
   to the PricePulse extension. Open product > copy address (/dp/B0... or pid=...) > paste > Save.
   Saves only direct_url (clean link). Affiliate link and checked status stay the same.
2. admin-prices.html  Listing form label: "Full product URL (Amazon / Flipkart: needed for the PricePulse extension)"
   + loads admin-fullurl-v248.js.
3. premium-v200.js  End of file: link #/product/<id>?alert=<price> (from the extension's "Alert me at" button)
   opens that product's deal-alert box with the target price filled in (after sign-in if needed).
4. index.html  premium-v200.js?v=248
script.js NOT changed. No SQL needed.
After upload: Cmd+Shift+R on the site and on Admin.
