PricePulse V215 — Two-step compare flow

ONE-TIME SETUP: Supabase -> SQL Editor -> paste supabase-compare-flow-v215.sql -> Run
(needs v211, v212, v213 SQL already installed)

1. Better detection (link + name search): unknown brand = first word (marked "guessed"),
   150+ brands, phone models (galaxy, iphone, redmi note, nord, pixel...) -> Mobiles/Smartphone,
   beauty/kitchen words, sizes (ml, g, L, W, mAh, GB), model keeps numbers (Nord 6, Note 14)
2. Name search card: clear headline "'xyz' isn't on PricePulse yet"
3/4. Step 1 = verify only (no store buttons). Shows "We'll compare on" store logos that
   change with the category. Step 2 = all category stores together:
   pasted store "Your link · exact product" (affiliate tag kept) + others "Best match search"
5. Steps shown: 1 Verify product -> 2 Compare stores
6. "Price you saw" moved to step 2 (only for pasted links)
7. Step 2 "Alert me when it's below ₹X" (signed-in). When admin marks the request Added
   with a product ID, these become real Deal Alerts automatically (normal 1/3 alert limits apply)
8. New stores for search buttons: Nykaa, Purplle (beauty), Reliance Digital, Vijay Sales
   (electronics/mobiles/appliances), Tata CLiQ (electronics, fashion, beauty), JioMart (home, other). Vijay Sales removed. Please click-test these search links once.
Admin: track requests show "🔔 N want an alert · lowest target ₹X"

V215.2 / V215.3
- "Compare it across stores" box starts right under the "All" filter (desktop)
- 761–1180px screens (small laptops/tablets): header icons compact (Wishlist/Deal/Sign In labels hidden,
  icons stay), category bar fits, Plus line short version, deal-card store logos and footer icons wrap.
  No more sideways page scroll at 1024px.

SETUP ORDER (if not done yet): v211 -> v212 -> v213 -> v215 SQL, then upload files.
