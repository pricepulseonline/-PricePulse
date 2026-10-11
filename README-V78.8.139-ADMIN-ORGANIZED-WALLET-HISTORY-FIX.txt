PricePulse V78.8.139 — Organized Admin Workspace + Wallet Voucher History Fix

Base: V78.8.138. All approved website, Plus, referral/reward, Redeem & Shop, My Vouchers, catalog and price-verification behavior is preserved unless noted below.

1) Admin organization
- Admin is now split into four sticky workspace tabs: Catalog & Prices, PricePulse Plus, Wallet & Rewards, Tools & Setup.
- Only the selected workspace is visible, so the admin page no longer becomes one very long scrolling page.
- Existing controls keep their IDs and logic; this is an organization/navigation layer, not a redesign of business logic.
- Catalog actions appear only in Catalog & Prices.
- Capture helper and admin account details appear only in Tools & Setup.
- Last selected admin workspace is remembered locally.

2) Manual voucher / History double-debit fix
- Manual Voucher Issuance no longer creates a second wallet redemption debit.
- A manual voucher must fulfill an existing locked/requested/issued redemption. If Redemption ID is blank, local test mode auto-links the newest matching user + retailer + amount redemption.
- If no matching redemption exists, issuance is blocked with a clear message telling the admin to start Redeem & Shop first or paste a Redemption ID.
- The existing redemption transaction is updated to voucher-fulfilled/used; no extra -₹ amount is added to History.
- Marking the voucher used changes voucher lifecycle only and does not create another wallet debit.

SQL remains deferred until the Wallet/Plus workflow is fully finalized.
