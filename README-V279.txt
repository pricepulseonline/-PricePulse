PricePulse V279 - site polish batch 4 + 40 store icons   (1 Nov 2026)

INSTALL (in this order)
1) SITE: copy these over your repo folder (same names, same places):
   index.html, script.js, premium-v200.js, compare-v251.js, polish-v276.css, polish-v278.css,
   polish-v279.css (NEW), polish-v279.js (NEW), logos/store-icons/ (NEW folder, 40 icons), supabase-stores-v279.sql (NEW)
   Test locally, then GitHub Desktop > Commit "V279 update" > Push > wait 2-3 min > Cmd+Shift+R.
2) SQL (one time, safe to run again): Supabase > SQL Editor > run supabase-stores-v279.sql
   - every store gets its round icon as logo
   - the stores that are not there yet are added (Poorvika, Sangeetha, Samsung Shop, OnePlus Store, Xiaomi Store,
     Lenovo Store, HP Store, Dell Store, Nike, Puma, Bewakoof, Snapdeal, Tira, BigBasket, PharmEasy, Apollo Pharmacy,
     Pepperfry, IKEA, Decathlon, boAt, Lenskart, FirstCry, Blinkit, Zepto, Swiggy Instamart) -> 40 stores in total
   - a new store shows on the site only where a product has a listing on it (add links in Admin as usual)
3) EXTENSION 1.5.7: chrome://extensions > Remove 1.5.6 > Load unpacked > 2-extension-1.5.7/1-extension-folder-load-unpacked
   (Web Store: upload-to-chrome-web-store-1.5.7.zip when ready). Changed: logos.js (40 round icons), content.js (store chip =
   icon + name; small chips icon only), manifest.json 1.5.7.
4) Outside the code (you do it): set support@price-pulse.in as the sender / contact in Supabase Auth email settings,
   Cuelinks / EarnKaro / Amazon Associates profiles, Chrome Web Store listing.

WHAT CHANGED
L1  Search box "Compare prices" button is back (V278 gave the dark-bar buttons the same class, white on white).
L2  One hover / press feel for every button (lift 1px + soft shadow, press = small scale).
L3  Tinted sections (Recently viewed, Deal Radar rows, You may also like): inner padding, nothing touches the edge.
L4  Deal Radar "Biggest total saving": white photo box hugs the photo (no empty sides).
L5  Radar "₹75-₹125 cashback EST." is not in the V278 code ("+ up to ₹X cashback"): an old cached file. No change.
L6  Top brands spotlight: photo on top, brand + name + price + save + button below (desktop, tablet, phone).
L7  Small cards: status, "% off MRP" chip and arrow never overlap (chip goes to the next line).
L8  Page heads: dark bar + panel under it joined with no gap on Wishlist, Deal Alerts, Coupons, Sales, Compare, Gift Cards.
L9  Card price charts show right away (history now loads when the site opens, not only on the product page).
    Also fixed: on Live Deals the chart line did not paint when the same product was also on Home.
L10 Card charts: hover / touch shows the date and price of that point.
L11 Coupons page: Card rewards show 4 rows (+ "View all").
L12 Card reward tiles: full card name on 2 lines (no "Myntra Kotak Cre...").
L13 Hero "Works with": cleared by the new round store icons.
L14 Menu: every item has the same hover + green underline when selected (Home is selected on the home page).
L15 Phone hero: slide dots no longer sit on the "Trusted Deals" box.
L19 Phone + tablet: menu shows Live Deals at every width (phone: icon + small label, Home is in the bottom bar,
    Gift Cards hidden on phones only); Popular deals + Live Deals = 2 compact cards per row on phones;
    deal-card cashback tag at normal size; product page store rows icon-only on phones. Checked at 360/390/430/768/1440:
    no page scrolls sideways, no JS errors. Desktop layout unchanged except the points above.
L20 Support email = support@price-pulse.in (footer/contact, Price Check "report a wrong match", site data).
L21 Text case: buttons and small values in sentence case ("Copy", "back"); small eyebrow labels stay in capitals.
Store icons: one round icon per store everywhere a store is shown (store rows, hero card, coupon tickets, store chips,
    Works with, Price Check list, Shop by Store). Store name is written next to the icon where it was not shown.

Price Check: search links for the new stores by category (search links only, never "Verified").
    Addresses of Poorvika, Sangeetha, OnePlus, Xiaomi, Bewakoof, Tira, PharmEasy, Apollo, Lenskart were checked on the live stores.
    mobiles: + Poorvika, Sangeetha, Samsung Shop, OnePlus Store, Xiaomi Store; electronics: same + boAt;
    laptops: + Poorvika, Lenovo, HP, Dell; appliances: + Poorvika, Samsung, Xiaomi; home: + Pepperfry, IKEA, BigBasket;
    fashion: + Adidas, Nike, Puma, Bewakoof, Lenskart, Shopsy, Snapdeal; beauty: + Tira, PharmEasy, Apollo Pharmacy;
    other: + Shopsy, Snapdeal, BigBasket, Blinkit, Zepto, Swiggy Instamart, FirstCry, Decathlon.
    A brand's own store (Samsung, OnePlus, Xiaomi, Lenovo, HP, Dell, boAt, Nike, Puma, Adidas) shows only for that brand;
    Lenskart only for eyewear. Store box on Price Check = icon + full name (desktop + phone).
Search box placeholder: "Search or paste any [icon] Amazon link" (store name after the round icon; phones: "Paste [icon] Amazon link",
    under 375px the button reads "Compare").
Extension 1.5.7 strip: max 3 store chips (round icon + price) and "More deals" on the same line.

NOT CHANGED
- Coupons sync (cuelinks-sync): not touched. The copy of index.ts in this folder has the v2 address as its default,
  but a secret CUELINKS_OFFERS_URL overrides it. Check in Supabase which one runs (see chat).
- Extension: new stores are not in its store list yet (needs each store's product-code pattern, Admin > Extension: stores).
