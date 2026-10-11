PricePulse V78.8.136 — Wallet Referral Reward Engine

Base preserved:
- V78.8.135 Plus effective-status behavior remains unchanged.
- No Wishlist, Deal Alerts, Compare popup, product card, auth design, or catalog behavior was intentionally changed.

Wallet / referral rules in this build:
- Referrer target: ₹100.
- Friend welcome target: ₹100.
- Referral is created as Pending.
- Self-referral is blocked.
- A friend can be linked to only one referrer.
- Shopping progress starts only after purchase confirmation.
- Reward unlock requires ALL three: purchase confirmed + return/cancellation window clear + affiliate commission confirmed.
- Up to 50% of confirmed affiliate commission funds the combined ₹200 pair target.
- Unlock slabs: 10% -> 25% -> 50% -> 75% -> 100%.
- Returned/cancelled orders are excluded and related reward progress recalculates.
- Multiple confirmed eligible purchases can accumulate commission toward the ₹200 pair target.

New test flow in Admin Dashboard:
1) Enter Referrer UUID + Friend UUID.
2) Create ₹100 + ₹100 Referral.
3) Mark Purchase Confirmed.
4) Mark Return Window Clear.
5) Enter confirmed affiliate commission and Confirm Commission & Unlock.
6) Use Return / Cancel Order to verify reversal.
7) Open Referrer Wallet / Friend Wallet for local UI verification.

Before SQL is installed:
- The same flow has a local test fallback.
- Referral links can be tested in the same browser/origin after the referrer opens Wallet and shares the generated code.
- Cross-device/new-browser production persistence requires the final SQL/backend.

Final SQL draft (DO NOT RUN YET):
- supabase-wallet-rewards-v136.sql
- Adds referral-code mapping, secure referral claim RPC, anti-self/duplicate protection,
  purchase/return/commission event tracking, reward recalculation, Wallet balance refresh,
  protected admin test RPCs, and a service-role production event ingestion RPC.
- If the Plus activation function is installed, a fully eligible confirmed referred purchase
  also activates an already-claimed PricePulse Plus membership for exactly 1 year.
