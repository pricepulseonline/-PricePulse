PricePulse V78.8.64 — Compare readable short-screen fit

Base: V78.8.63
Scope: Compare popup desktop short-screen fit only.

Changes:
- Typical short laptop viewport now uses 95% scale instead of 92%.
- Keeps text, logos, prices and buttons visibly larger/readable.
- Fits the footer by trimming only spare vertical spacing:
  * popup top/bottom padding
  * market header spare height/margin
  * Best Price outer margins only (not its internal locked geometry)
  * footer top gap
- Very short viewports (<=740px) use 92% fallback instead of the former 88%.
- Retailer row geometry remains 106px before scaling.
- 4/5-store retailer-list scroll behavior remains unchanged.
- No changes to Home cards, mobile 2-column layout, Wishlist, Deal Alerts, Auth, Admin, capture/parser, product image system, pricing logic or retailer alignment.
