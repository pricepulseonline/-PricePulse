PricePulse V78.8.146 — Plus Savings Membership

Base: V78.8.145.

Locked product model applied:
- PricePulse Plus positioned as ₹99/year savings membership.
- ₹100 Plus Welcome Reward after first eligible confirmed purchase (backend patch included).
- Free users: 1 active Deal Alert. Plus: up to 3 active Deal Alerts / Deal Alerts+.
- Wallet remains free for all users.
- Free Wallet redemption minimum: ₹100. Plus redemption minimum: ₹25.
- Plus Wallet upsell / active Savings Tracker added.
- Plus Reward Boost and Member-only Savings are shown as Plus benefits; actual reward campaigns remain governed by genuine admin/affiliate campaign rules.
- Free vs Plus comparison added to Plus UI.
- Paid CTA shows ₹99/year. This development build does NOT charge a card; payment checkout is intentionally not faked and remains a later integration.

SQL PATCH
Run supabase-plus-savings-v146.sql after the already-installed V141/V143/V145 backend patches.
It adds server-side Deal Alert limits, Wallet redemption minimum enforcement, and the one-time ₹100 Plus Welcome Reward trigger.
