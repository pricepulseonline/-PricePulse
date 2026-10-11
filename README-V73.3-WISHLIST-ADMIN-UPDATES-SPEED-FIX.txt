PricePulse V73.3 — Wishlist Admin Updates + Load Speed Fix

Exact fixes:
1. New Updates counts one recent PricePulse/admin verification session per saved product (not customer wishlist actions, not every retailer history row).
2. New Updates activity feed summarizes the latest admin verification for each saved product.
3. Initial page load fetches current verified prices only; 30-day price history is deferred until Wishlist/comparison needs it.
4. Discovery store logos use bundled local assets instead of third-party image hosts.
5. Supabase and local JS load with defer; preconnect hints added.
6. Root folder/ZIP naming corrected to V73.3.

No other design/layout/comparison-modal changes.
