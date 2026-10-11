PricePulse V77 — Admin Catalog & Verification Manager

What changed
- Admin header now uses the same PricePulse brand mark + Price/Pulse wordmark treatment as the website.
- Added + Add Product, + Add Brand and + Add Store.
- Added retailer/affiliate link management per product.
- Added Active / Out of Stock / Not Listed Yet / Track Only listing states.
- Not Listed / Track Only listings never count toward public Best Price or live-store counts.
- Added richer manual verification fields: MRP, rating, review count, delivery, offer/coupon, retailer title, model/SKU, variant and captured image.
- Added strict product-match helper: Match / Needs Review / Mismatch. A mismatch is blocked unless the admin deliberately overrides it with a reason.
- Exact product/model/variant confirmation is always required before a manual publish.
- Missing enrichment fields must be explicitly reviewed before publishing, so blank details are never silently accepted.
- Existing verified manual price continues to expire after 24 hours.
- Added a browser bookmarklet helper (“PricePulse Capture”) that reads retailer-exposed JSON-LD/meta data and copies detectable title/image/price/rating/stock information. It never publishes anything automatically.
- Captured retailer image can be reviewed and selected as the canonical product image.
- Current verified price table now has API-ready columns. Future authorized APIs/feeds can populate the same fields.

One-time setup
1. In Supabase SQL Editor, run: supabase-admin-catalog-v77.sql
2. Hard refresh admin-prices.html.
3. Sign in with the same PricePulse price-admin account.

Capture helper
1. Drag “PricePulse Capture” from the Admin dashboard to Chrome bookmarks bar (or click Copy capture helper and paste it into a new bookmark URL).
2. Click Open & Verify for a retailer.
3. On the retailer product page click the PricePulse Capture bookmark.
4. Return to Admin and click Paste Capture.
5. Complete anything the retailer did not expose, confirm exact product/variant, then Confirm & Publish 24h.

Important
- The capture helper is best-effort only. Retailers expose different structured data and may change pages.
- Auto-detected values are suggestions only. They do not become public until the authorized admin confirms them.
- Public product cards / comparison popup are intentionally not redesigned in V77. This release completes the admin/data foundation first. The next phase can connect the richer fields to those two customer screens.
