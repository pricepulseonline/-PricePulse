PricePulse V78.8.131 — Plus activation completion + Admin manual test control
Base: V78.8.130 premium Plus popup (preserved).

ONLY Plus activation/admin-control work added:
- Plus claim remains Pending until a trusted eligible-purchase confirmation.
- New final backend SQL file: supabase-plus-membership-v131.sql.
- Trusted function activates a Pending Plus claim and sets activated_at + exact 1-year expires_at.
- Optional Wallet bridge automatically activates Plus when a positive shopping_reward transaction becomes Available/confirmed.
- Admin Dashboard now has PricePulse Plus Membership controls: Check status, Activate Plus · 1 Year, Deactivate → Pending.
- Before SQL is installed, Admin controls use same-origin localStorage test mode so the active/normal account UI can be tested immediately in another PricePulse tab.
- After SQL is installed, the same Admin controls automatically use protected admin RPCs; no service_role key is placed in browser code.
- Local test activation also sets exact 1-year expiry. Cross-tab storage sync updates Hi, Name ⭐ / gold star / PricePulse Plus state live.

Important:
- Deactivate returns membership to Pending (claim preserved); it does not delete the claim.
- Run SQL only after final approval. If Wallet confirmation bridge is desired, run supabase-wallet-rewards-v0.1.sql before supabase-plus-membership-v131.sql.
- Wishlist, Deal Alerts, Compare, product cards, Auth, Wallet UI, Plus premium popup design and all other approved features are untouched.
