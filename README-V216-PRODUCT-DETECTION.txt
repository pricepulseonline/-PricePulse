PricePulse V216 — Product dictionary detection (link paste + name search)

No new SQL. Upload files only.

- One product dictionary: ~85 product types with category and the sizes that matter
  (TV inch incl. from model code like L43 / 139 cm, AC ton + star, fridge L, washing machine kg,
  phone RAM+storage, ml / g / L, W, mAh, shoe UK size, apparel size, pack of N)
- Handles cut-off store slugs ("Washing" without "Machine", "Fryer" without "Air",
  TV links without "TV", Myntra category folder, hyphenated brands like Fire-Boltt / Ray-Ban)
- Brand = earliest known brand in the name; accessory makers (Spigen ... Samsung cover) use first word
- Model keeps series + codes (Galaxy, IdeaPad, Rockerz 450, WH-1000XM5, L43MB), drops marketing words
- Tested on 134 sample links / searches: 133 right (the other one is acceptable)
  tests/detection-cases-v216.json holds the cases for future checks
Customers can still fix any field in Step 1 before comparing.

V216.1 — Search results bar
- After any search: "N results for 'x'" (or "No results for 'x'") with
  "← Back to all deals" (clears search, shows every product) and "Home" (back to top)
- Bar disappears when a category / brand / store filter is chosen

SETUP ORDER (only what you have not run yet): v211 -> v212 -> v213 -> v215 SQL. V216 needs no SQL.
