PricePulse V213 — Detected product card, shopper price, verify tabs

ONE-TIME SETUP: Supabase -> SQL Editor -> paste supabase-link-details-v213.sql -> Run

WEBSITE (paste a store link we don't track)
- "Is this the product you want?" card: Brand, Model, Product type, Variant/size,
  Colour, Category - read from the link, shopper can fix them
- "Price you saw on <store>" (optional) - saved as NOT verified
- "Yes, this is it, compare stores" -> request saved with details + price,
  then "Best match" search buttons only for stores that sell that category
  (electronics: Amazon/Flipkart/Croma, fashion: Myntra/AJIO/Amazon/Flipkart/Meesho, etc.)
- Short links (amzn.in / fktr.in) have no product name: shopper fills the card

ADMIN -> Growth & Links
- What to verify next: tabs New (never checked) / Due (expired) / Ready ✓ (all fresh)
- Ready products show "✓ Fresh" instead of "Verify now"
- Clicks: friendly empty message until the site gets clicks
- Track requests show shopper-confirmed details and "Shopper saw ₹X · not verified"

V214 — Compare by name (no link needed)
- Normal search with no match: "Compare it across stores" card opens below the results
  (brand / model / type / variant / colour / category, pre-filled from the search words)
- Search with some matches: "Can't find the exact product? Compare across stores" strip
- Confirm -> request saved (Admin shows "Searched by name" + details) and best-match
  search buttons for the right category stores
- No new SQL needed (uses supabase-link-details-v213.sql)

V214.2 fixes
- Search now really hides non-matching products (old CSS rule '#deals .deal-card{display:grid!important}' kept hidden cards visible - this was why search showed all products)
- Mobile: search suggestions open below the search box instead of covering it
- Search never reloads the page
