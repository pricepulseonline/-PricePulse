PricePulse V78.8.132 — Plus Admin local-test live sync fix

Scope: ONLY manual PricePulse Plus Activate/Deactivate testing.

Fix:
- Direct file:// pages can isolate localStorage by HTML file, so admin-prices.html and index.html did not always see the same local Plus state.
- Manual Admin Activate/Deactivate now transfers the test state directly to the PricePulse index tab.
- index.html stores that received state in its own local test storage and removes the temporary URL parameters.
- Activate => Hi, Name ⭐ + gold ⭐ + PricePulse Plus.
- Deactivate => normal Hi, Name + green dot + Account active, while the Plus claim returns to pending.
- Database/Supabase flow remains unchanged. Final Plus SQL is still intentionally not run.
- No Wishlist, Deal Alerts, Wallet, product, header/category layout, premium Plus popup design, or other approved feature was changed.
