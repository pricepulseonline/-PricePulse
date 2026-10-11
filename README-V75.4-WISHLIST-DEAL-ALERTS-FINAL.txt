PricePulse V75.4 — Wishlist Deal Alerts final UX

What changed
- Wishlist filters: All / Price Drops / Deals / New Updates.
- Deals shows Wishlist products whose Deal Alert target is reached.
- New Updates is a real recent-activity feed combining verified price activity and Deal Alert create/edit/target-reached activity.
- Wishlist cards show Deal Alert state: Set Deal Alert / Watching + target / Target Reached + View Deal.
- Set Deal Alert opens as a compact popover inside the Wishlist context; Wishlist stays open.
- The popover uses the official navy-background PricePulse icon (favicon-v18.png).
- Account > Deal Alerts remains the management dashboard: Active / Triggered / All, Edit, Remove, View Deal.
- Future email plumbing remains prepared in Supabase SQL.

Backend timing
- You can inspect and test the final UI before running SQL. If pp_deal_alerts does not exist, alerts are stored in a browser-local preview fallback.
- Later run supabase-deal-alerts-v75.4.sql. On the next load, local preview alerts are automatically migrated to Supabase.
- Email delivery remains OFF until an email sender/Edge Function is connected and the global switch is enabled.

Locked areas preserved
- Existing Wishlist core behavior/history architecture from V73.5 is preserved and extended only for the requested Deal Alerts / Deals / New Updates flow.
- Auth V74.1 remains unchanged.
