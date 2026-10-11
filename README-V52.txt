PRICEPULSE V52 — COMPARISON MODAL ONLY
30 Sep 2026

What changed
------------
- Replaced only the comparison popup's HTML/CSS rendering, matching the approved
  white premium two-column reference: real product photo and available alternate
  photo thumbnails on the left; large retailer marks and stable offer rows on the
  right; clear retailer-specific View Deal buttons; a full-width factual footer.
- Enlarged and normalized existing retailer logos inside the comparison popup.
- Added optional factual product/model details only where already evident in
  this V51 source; no unverified ratings, specifications, shipping or guarantees.
- Added mobile-responsive comparison popup with internally scrollable content.
- Added optional price-data.js to plug authorized verified prices into this same
  UI later; no price data or API credentials have been fabricated or included.
- Verified price data causes automatic numerical sorting (available before out
  of stock), LOWEST PRICE badge among 2+ comparable priced offers, and ₹X MORE
  labels. With 0 or 1 valid prices, there is deliberately no misleading lowest
  badge. Each retailer's existing affiliate URL remains intact.

What did NOT change
-------------------
- Home/Category card layout, Wishlist view, login, filters, typo-tolerant search,
  all 10 products, images/assets, existing retailer mappings or affiliate URLs.
- Dell Flipkart affiliate link remains https://fktr.in/8hJBEP1.

Important about prices
----------------------
- V51 did not contain verified currently publishable prices. V52 therefore
  continues showing Check latest price and retailer links UNTIL approved data is
  provided; its price-ready look can be tested without deploying fabricated data.
- Amazon prices require actual authorized Amazon API/feed data in accordance
  with applicable Associates terms; manually copied Amazon prices are NOT
  accepted by the V52 renderer.
- A third-party manually checked price is NOT automatically permitted just
  because it is visible elsewhere; check display permissions before setting
  source=approved-manual-check and displayPermitted=true.
- The app does not verify permissions/source authenticity on its own. Whoever
  connects feeds must use lawful sources and exact product variants.
- Approved manual-check prices expire from display after 24 hours; API/feed
  prices after 48 hours so stale prices do not look like current offers.

How to connect a feed later (without any UI changes)
----------------------------------------------------
- Configure your secured backend or a compliant static feed pipeline to
  populate window.PRICEPULSE_APPROVED_PRICES before script.js is loaded.
  price-data.js is currently an intentionally empty global registry.
- Registry shape:
    window.PRICEPULSE_APPROVED_PRICES = {
      "oneplus-nord6": {
        "Flipkart": {
          price: <NUMBER_FROM_AUTHORIZED_SOURCE>,
          source: "authorized-affiliate-feed",
          checkedAt: "<REAL_ISO_TIMESTAMP>",
          availability: "in_stock", // OPTIONAL: only if verified
          delivery: "free",          // OPTIONAL: only if verified
          deliveryVerified: true     // only if official/approved data confirms
        }
      }
    };
  Use valid JavaScript values in real price-data.js: placeholder text above is
  explanatory, NOT runnable JS. Other allowed source values include
  authorized-retailer-api; amazon-creators-api / amazon-pa-api /
  amazon-approved-feed for Amazon; approved-manual-check plus
  displayPermitted=true for retailers where price display is allowed.
  Product ids are each original product card's heart data-id in index.html.
  Store names must match actual mapped retailer names in that product's listing.
- Keep credentials SECRET on your backend, never in price-data.js/browser JS.
- API response/adapters must populate registry before script.js executes.

Testing and limitations
-----------------------
- Syntax-checked script.js; browser QA used an offline in-memory inline-assets
  harness because this runtime's Chromium policy blocked normal navigation.
- Browser QA confirmed all 10 product modal mappings and original affiliate
  hrefs, modal open/close, alternate photo switching, Wishlist→comparison,
  responsive 390px modal with no horizontal internal overflow, and 3-price,
  1-price and unauthorized-manual-Amazon scenarios.
- Purchases, current retailer prices, retailer sites and live API connectivity
  were not checked from the internet. Do a final live mobile/Safari check.
