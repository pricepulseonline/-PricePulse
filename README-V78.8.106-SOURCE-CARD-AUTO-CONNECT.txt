PricePulse V78.8.106 — Source Card Auto-Connect

Base: approved V78.8.105 Four-Card Anchor Final.

Isolated update:
- Compare popup still opens only from the product card's Find Best Price / compare CTA.
- Before opening on desktop, the page checks the clicked source card's vertical position.
- If needed, the page performs a short smooth auto-scroll so the source card is vertically aligned with the popup's content area.
- If the source card is already aligned, no scroll is performed.
- After alignment, the approved V78.8.105 four-card horizontal anchor logic runs unchanged:
  1st card -> starts over 2nd-card left area, no border touch.
  2nd card -> touches right site border.
  3rd card -> touches left site border.
  4th card -> starts over 3rd-card right area, no border touch.
- Existing green source-card highlight remains active.
- Truncated product-title clicks no longer proxy-open Compare; popup opening is reserved for Find Best Price.
- Mobile/tablet popup behavior is unchanged by the desktop auto-scroll alignment.
- Pricing, retailer order, Wishlist, Deal Alerts, Auth, Admin, Share, footer, pending/verified states, outside-click close, and approved compare styling remain unchanged.

Technical:
- script.js: added desktop source-card vertical alignment + scroll-settle helper.
- index.html: script cache token bumped to v=78.8.106.
