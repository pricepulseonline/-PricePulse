PricePulse V201 — Premium Batch 2 (builds on V200)

Changed files: premium-v200.css, premium-v200.js, index.html (cache version 201.1)

New pages (popups turned into pages)
- #/wishlist        My Wishlist page (same wishlist cards, filters, deal-alert buttons)
- #/alerts          Deal Alerts page (same tabs, edit/remove, refresh)
- #/plus/checkout   New premium checkout page: personal member pass, bill (₹99 / +₹100 / pays for itself),
                    UPI/Card/Netbanking selector. Pay button stays disabled until payment is connected.
                    To switch it on later: set window.PP_PLUS_PAYMENT_READY = true and connect the gateway.
- Header Wishlist/Deal buttons, account menu, bottom nav and old code paths all open these pages.
- Sign-in is still required for Wishlist and Alerts (same as before).

New features
- Plus page hero card now shows the member's own name + card number style; value line reads "Pays for itself"
- Product page: "You may also like" (same category/brand) + sticky Buy bar on phones
- Home: "Recently viewed" row (stored only in the visitor's browser) + premium Plus band above the CTA
  (hidden for active Plus members)
- Phone header: logo + icons in one row, search below (much shorter)
