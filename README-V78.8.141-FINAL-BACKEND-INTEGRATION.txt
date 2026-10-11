PricePulse V78.8.141 — Final Plus + Wallet Backend Integration

Base: V78.8.140 approved/locked. No approved website/Wallet/Plus visual behavior was intentionally redesigned.

WHAT IS NEW
- One final migration: supabase-plus-wallet-v141-final.sql
- Merges Plus membership, Master Plus override, Wallet accounts, referral ₹100 + ₹100 engine, reward ledger, redemption sessions and voucher lifecycle.
- Keeps individual Plus status separate from Master ON/OFF. Actual expiry alone marks an individual membership expired.
- Adds trusted pp_confirm_eligible_purchase() service-role hook for future affiliate/feed order confirmation.
- Reinstalls the Wallet -> Plus activation trigger after both schemas exist.
- Adds V141 production-safe manual voucher RPCs. Manual voucher issuance fulfills an existing redemption and cannot create a second Wallet debit.
- Admin manual voucher issue can auto-match the one eligible redemption by User + Retailer + Amount; if more than one match exists, the exact Redemption ID is required.
- Wallet header Plus star now follows effective Master mode as well as individual membership.
- Adds backend version marker 78.8.141.

INSTALL ORDER
1. Keep the existing approved Auth / profiles / Admin-Catalog backend in place. public.pp_price_admins must exist.
2. In Supabase SQL Editor, run ONLY: supabase-plus-wallet-v141-final.sql
3. Do NOT separately run older supabase-plus-membership-v*.sql or supabase-wallet-rewards-v*.sql drafts after V141. They remain in the package only as historical project files.
4. Refresh the Admin dashboard. Plus and Wallet controls should automatically switch from LOCAL TEST to DATABASE mode when the RPCs are available.
5. Test with two real Auth users in separate browser sessions.

IMPORTANT PRODUCTION RULES
- Never put the Supabase service_role key in browser JavaScript.
- Croma/Myntra/AJIO reward campaign seed rows are intentionally INACTIVE. Enable a retailer only after its affiliate/provider terms confirm rewards and SubID tracking are allowed.
- Real voucher codes must come from an authorized retailer/provider. PricePulse only stores/fulfills the code against an existing redemption.
- The local Reset Current Test User Wallet control clears local test data only; it does not delete Supabase Wallet records.

EXPECTED END-TO-END BACKEND FLOW
Plus claim -> pending -> eligible purchase confirmed -> Plus active for exactly 1 year.
Referral join -> Purchase Confirmed -> Return Window Clear -> Commission Confirmed -> ₹100/₹100 target unlock according to the approved commission pool stages.
Wallet Available -> Redeem & Shop -> locked redemption -> authorized/manual voucher fulfillment -> one -₹ redemption ledger entry only -> voucher Active/Used lifecycle.
