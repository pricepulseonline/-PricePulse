PricePulse V78.8.17 — FINAL GLOBAL BRAND LOGO SYSTEM

Audited every current brand-logo surface:
1. Shop by Brand carousel
2. All Brands modal
3. Home / Category product cards
4. Compare Popup
5. Wishlist
6. Admin Global Live Preview
7. Admin exact Compare Popup mirror

Deal Alerts currently do not render a brand logo, so no brand-logo sizing rule is needed there.

Final behavior:
- Central Admin brand logo remains the canonical source.
- All Brands is the master optical reference.
- One canonical optical profile per existing brand is reused globally.
- Surface scale changes only by UI context (master/home/popup/wishlist).
- Old per-brand test transforms / filters / manual offsets are neutralized.
- Transparent / plain-background whitespace is trimmed at render time when possible.
- Future brands automatically inherit the generic optical profile and the same trimming logic.
- No per-page manual brand sizing is needed.
- Store / retailer logos are untouched.
- Product-image controls, pricing, Wishlist logic, Deal Alerts logic, Auth, search, capture and comparison logic are untouched.
- No SQL required.
