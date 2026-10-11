PricePulse V200 — Premium Batch 1

New files
- premium-v200.css   Premium navy + gold theme layer (loaded last)
- premium-v200.js    Page router + new premium features (loaded after script.js)

Changed files
- index.html   Loads Manrope/Sora fonts, premium-v200.css and premium-v200.js
- script.js    One-line fix: missing ppAutoFitBestStoreLogo no longer throws an error on load

What changed
1. Find Best Price is now a full page, not a popup
   - Link format: index.html#/product/<product-id>   (example: #/product/oneplus-nord6)
   - Works from home cards, Wishlist, Deal Alerts and any old code that opened the comparison popup
   - Browser Back button returns to the same place on the home page
   - Page has: verdict card (Good time to buy / Fair price / Price is high), MRP + savings,
     low-high range bar, one main Buy button, all stores in one consistent style,
     trust strip, price history chart + Lowest/Highest/Checks, price alert card, Plus upsell
   - Verdict needs at least 3 verified history checks; before that it shows "Best verified price"
2. Plus page has a link now: index.html#/plus (same existing Plus page, opens from any page)
3. Header "Get Plus" gold chip (hidden for active Plus members)
4. Account menu: gold Plus tile at the top for non-members; Deal Alerts row shows "Plus gives 3" at the limit
5. Home cards: "Lowest in N days" badge on the product image when verified history supports it
6. Mobile: bottom navigation bar (Home, Categories, Wishlist, Alerts, Account), compact header icons,
   2-column cards no longer overflow the screen
7. Premium theme: ivory background, Manrope/Sora fonts, softer card shadows, gold accents

Not changed
- Supabase tables, SQL, login, wishlist, alerts, wallet logic, admin pages
- Payment is still not connected (planned for the final batch)
