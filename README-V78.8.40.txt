PricePulse V78.8.40 — Home/Category 520px Anchored Premium Card

Base: V78.8.39 restored / V78.8.37 Home-card base.
Scope: Home/Category desktop card CSS only.

Changes:
- 4 cards/row preserved.
- Card height fixed at 520px on desktop.
- Explicit fixed rows lock Brand/Compare/Heart, image, title/rating/meta/variant,
  retailer logos, Best Verified Price, and Find Best Price CTA to the same baselines.
- Long title behavior remains single-line + More from the existing implementation.
- Best-price and CTA internals stay compact/readable without flex redistribution.
- Missing rating/meta/variant data does not move the bottom price/CTA rows.

Untouched:
Popup, Wishlist, Deal Alerts, Auth, Preferences, Help & Support, Smart Search,
footer, Admin, capture/bookmarklet, Amazon/Flipkart price parser, Supabase,
Premium Product Image controls/logic, compare rows, retailer logic.
