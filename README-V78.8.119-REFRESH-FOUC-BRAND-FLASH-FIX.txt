PricePulse V78.8.119 — Refresh FOUC + Brand Flash Fix

Base: V78.8.118 (locked)

Changes only:
- Prevents the raw/legacy Home card state from flashing during browser refresh.
- Prevents the product brand logo from briefly appearing in its old image-area position before JS moves it into the approved top brand box.
- Hides only the Popular Deals grid during the very short premium-card boot phase; header, navigation and the rest of the page remain visible.
- Uses visibility (not display:none), so card/grid geometry does not collapse or jump.
- Reveals the grid after the locked premium card DOM + initial price/retailer pass is complete, using two requestAnimationFrame steps so the first visible paint is the final card state.
- Includes a 2.6s safety fallback so cards cannot remain hidden if startup JS is interrupted.
- No card design, V78.8.118 readability/price styling, popup, Wishlist, Deal Alerts, Auth, Admin, pricing logic, or approved behavior changes.
