PricePulse V78.8.63 — Compare short-screen fit

Base: V78.8.62 content-driven Compare height.
Scope: desktop Compare popup only.

Confirmed cause:
The Compare content itself is now content-driven, but on laptop/browser viewports with limited
vertical CSS pixels the complete natural popup (header + up to 3 retailer rows + 140px Best Price
+ footer + panel padding) can still be taller than the white content area below the sticky site header.
V78.8.62 correctly caps the outer panel and keeps overflow hidden, so the lowest footer portion can
be visually clipped on short screens.

Fix:
- Keep all approved Compare geometry/logic intact.
- On desktop viewports <= 820px high, visually scale the complete #modalBody to 92% and compensate
  width so it still fills the popup horizontally.
- On very short desktop viewports <= 740px, use 88%.
- Taller desktop viewports remain unchanged.
- Bumped CSS cache query to v=78.8.63 so the new rule is not masked by an old cached stylesheet.

Preserved:
- V78.8.57 retailer logo/text/button horizontal alignment
- 106px retailer row geometry before visual scaling
- Best Price 140px geometry / tie / history / CTA logic
- 1/2/3 content-driven retailer height and 4/5 retailer internal scroll
- connected-card animation and white-content anchoring
- Home cards, mobile 2-column layout, Wishlist, Deal Alerts, Auth
- Admin, capture/price parser, image system
