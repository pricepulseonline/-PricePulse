# PricePulse V78.8.136

Wallet referral/reward engine checkpoint built on locked V78.8.135.

- ₹100 referrer + ₹100 friend.
- Pending until purchase confirmed + return window clear + affiliate commission confirmed.
- 50% commission funding pool, staged unlock: 10% / 25% / 50% / 75% / 100%.
- Self-referral and duplicate-referrer protection.
- Admin end-to-end test console with reversal testing.
- Local testing works before SQL; final backend draft is `supabase-wallet-rewards-v136.sql` and should be run only after approval.


## V78.8.138 — My Vouchers + Admin Manual Voucher Issue
- Preserves approved V78.8.137 referral, reward, redeem and history behavior.
- Adds Wallet > My Vouchers with Active / Used / Expired / Test-only states and Copy Code.
- Adds Admin Manual Voucher Issuance for authorized real retailer/provider codes while API integration is pending.
- Adds local testing for issue + mark used + open user wallet.
- `supabase-wallet-rewards-v138.sql` is draft-only until final approval.
