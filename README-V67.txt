PRICEPULSE V67 — ONEPLUS PRICE PILOT ACTIVATED

Base: V66 private price pilot after Supabase SQL setup, admin authorization and manual verification of Amazon, Flipkart and Croma for OnePlus Nord 6.

ONLY activation change:
- window.PP_PRICE_PILOT_ENABLED=true in index.html
- script cache version bumped to v=67.0 so browsers do not keep the old disabled script state

Behavior:
- OnePlus Nord 6 comparison clears old static OnePlus example prices before reading
- Reads only fresh, published, display-permitted rows from Supabase pp_retailer_prices
- Manual checks older than 24 hours are rejected by the existing client logic
- Other products remain unchanged

No design, retailer logo, affiliate-link, button, product, or comparison layout changes were made.
