PricePulse V73.2 — Wishlist New Updates fix

- Fixed New Updates showing 0 after Admin Dashboard price verification.
- Admin Dashboard uses source `user-manual-check`; this is a legacy source label for an admin verification event, not a customer wishlist action.
- New Updates now includes all approved PricePulse verification history events from the last 24 hours for products in the user's wishlist.
- Customer wishlist add/remove activity still does not count as a New Update because those actions do not write retailer price-history rows.
- No other Wishlist/site design changes.
