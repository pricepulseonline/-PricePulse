PricePulse V217 — Compare popup fixes
=====================================
Changed files: premium-v200.js (?v=217), premium-v200.css (?v=217), index.html (version bump only)
No new SQL.

1. "Price you saw" field removed from Step 2. Only "Alert me when it's below ₹___" stays (signed-in users).
2. Dropdown arrow (Category) now has proper space from the box edge (popup + search assist).
3. Enter / Compare prices: page scrolls so the whole popup is visible below the header (desktop).
4. Other stores now show when brand + model, or brand + product type / category (Mobiles, Laptops).
   Brand alone -> "Add the model or product type…" message. Category shows "· pick one" hint when only brand is filled.
5. List / collection / search links (e.g. reliancedigital.in/collection/everyday-laptops, croma /c/20,
   flipkart /pr, amazon /s?k=) -> "This is a product list page" message, category set from the link, no fake brand.
6. Popup stays under the header and closes by itself when you scroll it out of view.
   Details typed in Step 1 are remembered — paste/Enter the same link again and they come back.
7. Reliance Digital new links (/product/<name>-<code>) are now read correctly (name, brand, size, colour).
   JioMart /p/<category>/<name>/<id> links read correctly too.

V217.1 — Detection audit (60 real-style links, 11 stores)
 - boAt Airdopes now Earbuds (was Headphones); kurta-with-trousers now Ethnic Wear
 - Exact item shown: Lipstick / Foundation / Kajal / Sneakers / Running Shoes / Jeans (instead of Makeup / Shoes / Bottomwear)
 - Cameras (Canon EOS, Cyber-shot, Instax) detected; Fire-Boltt / hyphen brands no longer repeated in model
 - Meesho words like "Trendy / Stylish" no longer used as brand or model
 - 60+ more brands (Good Vibes, Aashirvaad, Reconnect, Biba, American Tourister, Casio, Lifelong, Syska, Pureit…)
 - Fan size (1200mm) goes to Variant; "3 0" -> "3.0"; Galaxy Tab / Buds keep "Tab"/"Buds" in model
 - Flipkart short links (dl.flipkart.com/s/…) treated as short links, not list pages

V217.2 — Hero trust strip (Compare Prices / Trusted Deals / Save Time)
 - New icons: two-way arrows, shield + tick, stopwatch (were tiny and stuck to the top of the box)
 - Each item in a soft white card, bigger and darker text
 - Desktop: one row; tablet & mobile: 3 equal cards, icon above text

V218 — Premium All Categories menu
 - New design: 8 main categories with new illustrations, better text and live deal counts
 - "Popular right now": Smart TVs, Earbuds, Smartwatches, ACs, Air Fryers, Tablets, Trimmers, Gaming, Bags & Luggage, Sports & Fitness
   (click = search; if no product yet, the "Compare across stores" box opens)
 - Search inside the menu (Enter searches the whole site), Esc / outside click closes
 - Open/close animation, staggered cards, hover lift; blurred background
 - Mobile: bottom sheet with 2-column grid and swipeable popular row

V218.1 — Category bar + Popular Deals tabs
 - Top bar: small icon before each category, green underline on the active one, hover underline animation, Deals pill shine
 - Popular Deals tabs: icon + product count on each tab, dark active tab with gold count, hover lift, title above and tabs in one row
 - Mobile: rows swipe with soft edge fade; the active category slides to the centre by itself

V219 — Today's Deals page (🔥 Deals button)
 - Deals button now opens its own page (#/deals) instead of scrolling. "N new" badge on the button when new drops arrive since your last visit
 - Sections (each hides itself when empty): Today's top picks (admin), Price dropped, Lowest in 30+ days, Top Deal Score (80+), Biggest savings across stores, Plus Early Access, More deals
 - Live sale countdown in the banner (from Sale events in admin), stats: deals tracked, price drops, at lowest, updated ago
 - Filters: category chips with counts, price range, saving %, sort (Deal Score / biggest drop / lowest price); sticky while scrolling
 - Each card: badge (₹ cheaper / lowest in N days / save vs other stores), Deal Score, price + old price, best store, Buy (affiliate link), Compare, 🔔 alert
 - Plus Early Access: non-Plus shoppers see a blurred card + "Unlock with Plus"; opens for everyone automatically when the time ends
 - Admin → Growth & Links → "Today's Deals page": headline, line under it, ⭐ Top pick (max 4), 👑 Plus early (2–48h), Hide. Saved in pp_site_settings key "deals". NO new SQL.
 - Everything is calculated from verified prices + price history, so when the store API fills prices, the page updates by itself.

V219.1 — Deal card buttons: "Buy on <store>" on its own full line (text was cut), Compare + alert below on laptop; mobile keeps Buy + alert in one line
 - Deals page section icons replaced: star (top picks), trend-down (price dropped), trophy (lowest), gauge (Deal Score), price tag (savings), grid (more deals), bell (alerts box)

V219.2 — fixes from the video
 - Product photos on Home became tiny (18px) after opening a product page and coming back. Fixed: photos are re-fitted when Home shows again (script.js + premium)
 - Product page opened from Today's Deals now shows "Back to Today's Deals" and returns there (not to Home)
 - Hero "Best verified deal" card waited for nothing and flashed old prices first (e.g. 46,032 then 44,999). Now it shows a loading card (max 4s) until verified prices arrive

V220 — "Popular deals, decoded" premium cards (Home Popular Deals + Today's Deals page)
 - Dark navy + gold section; each card = verdict (BUY NOW / WAIT / FAIR / being verified), Deal Score ring, big price + change, 30-day mini trend, top-3 store ladder (cheapest ★), Plus tip (blurred + hidden for non-Plus), smart main button (Buy at cheapest store, or Alert me at the 30-day low when it says WAIT), Details, Add to compare (up to 3)
 - Card shows the decision; the product page (Details) keeps the full chart, all stores and offers, so they do not repeat
 - Admin → Growth & Links → Today's Deals page: new "👑 Plus tip" per product (format "Label: value"). Empty = automatic "Lowest ever". No new SQL
 - Filters, search, wishlist and alerts keep working on the same cards

V221 — Launch catalog + new Home layout
- Products added in Admin/catalog now appear on Home automatically (card, brand tile, store tile). Photo missing = clean category illustration.
- Home shows the top 6 deals (Top pick first, then best Deal Score / price drop) + gold "See all N deals" button to the Deals page.
- Under it: "Price dropped" row and "Best in <category>" rows (only when no search/filter is on).
- Category tab: top 6 of that category + "See all N <Category> deals".
- Card: "Same price" instead of "+₹0"; "N stores · X out of stock" wording.
- supabase-launch-catalog-v221.sql: adds 48 launch products, 29 brands, 6 stores (Reliance Digital, Vijay Sales, Tata CLiQ, Nykaa, Purplle, JioMart) and 160 store links. Safe to run again.
- Fix: brand name/logo on a card is no longer reset to "Brand" when that product is missing from the catalog.

V222 — Cuelinks per store
- Admin → Growth & Links → Affiliate links: new "Stores that use Cuelinks" tick boxes. Default ticked: Tata CLiQ, Nykaa, Nykaa Fashion, Vijay Sales.
- Only ticked stores get the Cuelinks link on click. Untick a store when Cuelinks shows its campaign as Paused (now: Reliance Digital, Purplle). Its links then open normally.
- Vijay Sales and Nykaa Fashion links are now recognised as stores.
- Amazon keeps your tracking ID. EarnKaro / fktr.in links are never changed.
- Setup: Channel ID = your Cuelinks cId, tick "Cuelinks ON", Save. No Cuelinks script needed.
- V222.1: Vijay Sales added to the link-paste panel ("We'll compare on" + Best match search) for Mobiles, Electronics, Laptops, Appliances and Home & Kitchen. With Cuelinks ON and Vijay Sales ticked, that search button opens via Cuelinks.
- V222.2: Buy links turn into the affiliate link (Amazon tag / Cuelinks) already on right-click, long-press, keyboard focus and drag, not only on a normal click. Copying a Buy link or opening it in a new tab now keeps the commission. The click log still shows the real store name.

V223 — Exact store links + honest buttons + "Links to fix"
- supabase-launch-links-v223.sql (run AFTER supabase-launch-catalog-v221.sql): replaces store SEARCH links of the 48 launch products with the exact product page (right model / RAM / storage / size). 104 links replaced, 1 new link added (Noise Pulse 4 on Croma), 40 were already exact. 16 store links had no exact page: they are switched off (hidden on the site) and listed in Admin to fix. Rows you already edited in Admin are never touched.
- Website: if a store link is still a search page, the button says "Search on <Store>" (dashed style) instead of "Buy".
- Admin → Growth & Links → new "Links to fix" card: tabs Missing link / Check once / Done. "Find on store" opens the store search for that exact product; paste the product page and Save (EarnKaro / fktr.in links are saved as affiliate links). "Looks right" marks a link checked; "Wrong product" hides it until fixed. Search pages and wrong-store links are blocked/warned.

V224 — Navigation system, Deal Radar, 4-per-row cards, phone swipe, Admin review
- Back / Forward now return to the same place: same scroll, same search text, same category / brand / store filter, and the card you opened glows for 2 seconds. Works on Home, Deals, Brands, Stores, Wishlist and search results. Refresh keeps the page and position.
- Home (logo, Home in the top bar, bottom-nav Home, footer Home) = always a fresh start at the top: search cleared, filters reset to All.
- Home cards: 4 per row on laptop/desktop (top 8), 2 per row on tablet (top 6), phone = swipe sideways (one card + peek of the next, dots + "1 / 6"), then "See all" right below. Badges shortened on narrow cards ("LOWEST IN 7 DAYS", "SAVE ₹800").
- Rows under the deals are now "Deal Radar": "Biggest price drops" + "Best discounts in <category>". Pick a category in the deals section and Deal Radar shows the rest of that category as small cards ("More Mobiles deals"). On phone the rows swipe with 2 small cards visible.
- Admin: publishing a verified price now marks that store link as checked (Links to fix → Done) automatically.
- Admin → Catalog & Prices → "✓ Review products" (counter X/N): one screen per product to fix name, variant, brand, category and every store link (open, replace, move to another store, remove, add) → "Save & mark reviewed".

V225 — Deals page clarity
- On the Deals page, top-nav categories (Mobiles, Laptops, ...) now filter the Deals page instead of jumping Home. Clicking the same category again clears it.
- Top nav and Deals chips stay in sync. The old Home highlight is cleared, and "🔥 Deals" shows as the current page.
- The breadcrumb is now a clear "‹ Home / Today's Deals" pill.
- Section counts read "8 deals" instead of a lone number.
- Back from a product to Deals returns to the same scroll spot (the click is now remembered before other handlers run).

V226 — Deals page redesign + one Back rule for the whole site
- Back button on every page (Deals, Product, Wishlist, Alerts, Brands, Stores, Account, Help, Checkout) replaces "Home". It returns to the page you came from, at the same scroll spot. If nothing is behind it (opened from a link), it goes Home.
- Deals page top is now one compact green header (Back · Today's best deals · stats) joined to the cream filter bar.
- The category chip row is gone. A "Category ▾" dropdown with counts is built from the catalog, so new categories appear on their own.
- The filter bar sticks flush under the site header (it follows the header shrink, so there is no gap for cards to peek through).
- Changing a category or filter never lands on an empty screen. Results start right under the filter bar.
- Only products with a checked price appear on the Deals page. The Home "See all N deals" count matches.
- An open Deals page refreshes itself when prices or the catalog load later, keeping the reader's spot.
- The first row of deal cards fits the first screen on laptops: section heads are one line, cards are compacted on the Deals page only.
- Short screens show the top 2 stores, then hide the Plus strip.
- Fix: a plain #link click fired popstate and lost the "came from" page. A click always saves the scroll spot.

V227 — Deals cards full size again, chart details on hover, Price Meter
- Deals cards are back to full size (photo, graph, 3 stores). The Plus strip is off the Deals cards.
- Buy buttons line up across a row. More than 3 stores shows "+N more" in the footer.
- Fix: the green end dot on card graphs now sits on the line at any card height (it was pixel-based).
- Deals page top is tighter: the page grid gap of 18px is removed and the head is pulled up. The first row fits an 800px-high laptop screen with full-size cards.
- One gold Plus marketing card sits in the Deals grid, after the first full row (hidden for Plus members).
- Every price chart (product page + deal cards) shows date, price, store and change vs the previous check on hover. On touch, drag with a finger.
- Home hero card: one-line Price Meter in the "Great time to buy" box (High ₹x [today's dot] Low ₹y; hover shows details). The card keeps its old height.
- Home hero card: "Compare all N stores" is now a navy button.
- Home: less empty space above "Popular deals" and below "See all deals" (section padding 56/64 → 28/28).
- The price series now carries the cheapest store for each check.

V228 — Compare bar, Home card Price Meter, animated Plus card
- Compare works within one category. Adding a product from another category shows a short message and the bar shakes.
- The compare bar is white with a gold ring so it stands out over dark cards. It bounces and flashes the count when a product is added.
- "Clear" is replaced by a round × at the end. It closes the bar and removes all products.
- While the bar is open the page keeps space at the bottom (and toasts sit above the bar), so the last buttons are not covered.
- Compare page Buy buttons no longer show an underline.
- Home deal cards: a one-line Price Meter (High ₹x [today's dot] Low ₹y, with hover details) replaces the graph. Cards are about 40px shorter.
- Fix: an old max-height clipped the Home card footer.
- Deals page Plus card is now an animated 4-scene story: lowest price question, lowest-ever reveal, price-drop alert, sale access.
- The Plus card has progress bars, pauses on hover, and stays still when the device asks for reduced motion.
- The Plus card uses real products and prices, the real "products at their lowest price" count, and the real sale event when one is set.
- Plus copy: "3× more price alerts" (the Plus page keeps the exact 3 vs 1).

V229 — Fixes from testing
- All Categories menu: removed the old floating arrow behind the menu. Only the clean top line remains.
- On the Deals page, picking a category from the All Categories menu filters the Deals page instead of jumping Home.
- Compare is available from Deal Radar mini cards (small compare button) and the product page ("Compare" next to Save / Share).
- Only products with a verified price can be compared. "Price soon" products show no compare button.
- Compare bar: multi-colour border (same colours as the Price Meter) so it stands out on cream and dark backgrounds. The colours sweep once when a product is added.
- Compare bar: "+ Add one" is no longer cut off.
- The "N new" tag on the Deals pill now floats on the pill's corner, so the pill is no longer clipped at the end of the bar.
- The category highlight in the top bar clears on Brands, Stores, Wishlist and other non-product pages.

V230 — All Categories tab
- The open All Categories tab keeps its soft green box and now shows the same thin green underline as the other tabs (the thick curved bottom line is gone).

V231 — Hero polish + Nykaa Fashion
- Hero search box: shorter placeholder ("Search or paste a product link") so it is no longer cut off.
- Hero Plus line now says "first eligible purchase", matching the Plus page.
- Hero live line: "stores compared" is now "stores covered" (no clash with "Compare all N stores" on the hero card).
- Nykaa Fashion added to link paste / Compare flow (search link + Cuelinks wrapper) and to the Fashion store list. Its search URL format is not yet verified.

V232 — Hero Plus line fit
- The hero Plus line was wrapping onto two lines on narrower laptop windows. It now reads "Pays for itself: ₹99 → ₹100 back on first eligible purchase" and stays on one line down to 1181px wide.

V233 — Category pick (top bar + All Categories menu) lands just above the LIVE line under the sticky header.

V234 — Logo tagline matches the PricePulse name width (header + footer), brighter and bolder.

V235 — Local logos for 24 brands + Adidas and 5 stores (Vijay Sales, Nykaa, Purplle, Shopsy, Adidas). Used on brand/store tiles, product cards and the product-page brand badge. Files: logos/brands/, logos/stores/.
- Tile logo sizes tuned per logo (premium-v200.css, V235 block). Empty padding trimmed from ASUS, OPPO, Sony, JBL, realme logos; Atomberg recoloured dark so it reads on white.
- Run supabase-add-shopsy-adidas-v235.sql once in Supabase (adds Shopsy store, Adidas store + brand).

V236: Shop by Brand tiles - photo, name, price, discount badge now all come from the same product (the brand cheapest priced one). premium-v200.js (dxBrandList), index.html ?v=236.

V237: Atomberg logo replaced with the new trimmed SVG (logos/brands/atomberg.svg), size rules + slug map updated. premium-v200.js/css ?v=237.
