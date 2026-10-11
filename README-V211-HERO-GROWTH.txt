PricePulse V211 — Section 1 (Hero) growth features

ONE-TIME SETUP (Supabase)
1. Supabase Dashboard -> SQL Editor -> New query
2. Paste the full file supabase-hero-growth-v211.sql -> Run
3. Done. Admin -> "Requests & Sales" tab now works.
   (Without this SQL the website still works: link requests are saved on the
    visitor's device and sent automatically once the SQL is installed.)

NEW ON THE WEBSITE
1. Paste a store link (hero search or header search)
   - Amazon / Flipkart / Croma / Myntra / AJIO / Meesho links
   - Exact match -> opens that product page
   - Close match -> "Is this the product?" card
   - Not tracked -> "Track this product" request (goes to Admin)
2. Deal Score (0-100) + "Real drop / Inflated MRP / Usual price"
   - Hero card and product page
   - Needs at least 3 verified price checks for that product, otherwise hidden
3. Hero card slider: top 3 deals rotate every 6.5 s (pauses on hover), dots below
4. LIVE stats line: products tracked · stores · price checks this month · alerts watching
   (real numbers only; a number that is 0 is hidden)
5. Plus line: "Pays for itself: ₹99/year, get ₹100 back on your first purchase"
6. Sale countdown strip above the hero (set from Admin)

NEW IN ADMIN -> "Requests & Sales"
- Track requests: New / Added / Rejected. Add the product in Catalog first,
  then type its product ID and press "Mark added". After that, anyone who
  pastes the same link goes straight to that product page.
- Sale countdown: name, store, start, end, note, Active. Shows from 21 days
  before start until it ends. Enter only official dates.

API LATER
All data goes through window.PPData (premium-v200.js). When a price API is
available, only PPData / the same Supabase tables need a new source. The
design does not change.

V211.1 fixes: invisible 'See my deal alerts' button in the link panel now shows; Admin track requests show a short link + Copy link button.
