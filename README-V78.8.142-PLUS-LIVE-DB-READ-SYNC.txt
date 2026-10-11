PricePulse V78.8.142 — Plus Live Database Read Sync Fix

Base: V78.8.141 final backend integration.
Scope: Website Plus-state read/sync only. No Wallet, Admin, popup design, Wishlist, Deal Alerts, Catalog or other approved behavior changed.

Fixes:
- Website reconciles the authenticated Supabase user before reading Plus membership.
- Once pp_plus_memberships is available, database state is authoritative.
- A successful DB query with no row means AVAILABLE; stale local/test Pending or Active state is not restored.
- Old local Plus test state is cleared after a successful backend read.
- Local/URL test transfer remains only as fallback when the production Plus table is unavailable.
- Plus state refreshes automatically when the website regains focus / becomes visible, so an Admin activation can reflect without stale local UI.

Expected production test:
1. Admin activates a specific real user for 1 year.
2. Same real user opens/refocuses V78.8.142 index.html.
3. Header shows Hi, Name ★.
4. Account status shows gold ★ + PricePulse Plus.
5. Plus row shows Premium membership active.
