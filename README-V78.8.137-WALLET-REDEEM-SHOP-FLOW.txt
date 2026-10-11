PricePulse V78.8.137 — Wallet Redeem & Shop Flow

Base: V78.8.136 referral/reward engine preserved.

Added:
- Eligible store redemption modal uses the user's real Available Rewards balance.
- User can choose reward amount (₹25/₹50/₹100/MAX or custom whole-rupee amount).
- Starting redemption locks only the selected amount and creates a fresh tracking/SubID session.
- Wallet Available balance drops by locked amount; Redemption Pending rises by the same amount.
- Active redemption sessions are visible inside Redeem & Shop.
- Local test mode can simulate authorized voucher issuance with a clearly marked no-value TEST voucher.
- Cancelling a locked local test session releases the reward back to Available.
- Issued redemption remains deducted and is recorded in Wallet History.
- Amazon remains restricted/not eligible.
- Final SQL draft extended as supabase-wallet-rewards-v137.sql with customer start/cancel RPCs and protected admin/provider issuance RPC.

Do NOT run final Wallet SQL yet. Current build remains testable in local mode until the complete Wallet is approved.
