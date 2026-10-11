PricePulse V78.8.68 — V35-style natural Compare + short-screen fit

Base: V78.8.64 Readable Fit.
Scope: desktop Compare popup vertical geometry only.

Preserved:
- “Compare prices across stores” heading + subtitle
- V78.8.57 retailer logo / text / View Deal horizontal alignment
- Best Price visual columns
- connected-card popup behavior and white-content positioning
- all Home, Wishlist, Deal Alerts, Auth, Admin, capture/parser, image-system logic

Changed only for Compare vertical fit:
- removed effective fixed-shell/fixed-332/fixed-140 behavior through a final consolidated override
- no transform/zoom scaling
- 1/2/3 retailer rows use natural content height; 4/5 retailers scroll only inside retailer list
- normal Best Price is content-driven
- tie Price History gets a real second row instead of being squeezed/overlapped
- status/no-price summary is content-driven
- footer returns to normal flow below summary
- short laptop viewport uses tighter vertical rhythm without shrinking typography
