PricePulse V78.8.123 — Wallet + Subscription integrated into V78.8.122 base

Preserved base:
- V78.8.122 selective no-blank refresh behavior
- Existing comparison, Wishlist, Deal Alerts, Auth, Preferences, Help & Support, Admin, capture/parser logic

Added:
1. Account menu -> Wallet
   - Opens dedicated wallet.html full page
   - Rewards / Invite & Earn / Redeem & Shop / History
   - Premium balance-card layout
   - Full-width green underline on tab hover/active
   - Same PricePulse green/navy visual language
   - Signed-in Supabase session/profile aware
   - Safely shows zero/empty states until Wallet tables/data are enabled
   - Future-ready reads for pp_wallet_accounts, pp_wallet_transactions, pp_referrals

2. Account menu -> Subscription directly below Deal Alerts
   - Opens a separate premium membership popup
   - Plus / Pro / Max / Elite
   - No prices added
   - Coming Soon only; no payment flow

3. Referral bridge
   - ?ref=PULSE... is safely remembered locally for future backend activation

4. Optional future SQL
   - supabase-wallet-rewards-v0.1.sql
   - Not required for current UI to load
   - Creates Wallet ledger/referral/redemption/campaign-rule foundations with read-only customer RLS

No Cuelinks API, gift-card API, commission automation, or real voucher issuance has been invented/activated in this version.
