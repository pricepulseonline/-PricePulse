PricePulse V78.8.140 — Wallet user isolation + reset + history fix

- Preserves V78.8.139 admin organization and approved Wallet/Plus behavior.
- Local admin Wallet test now opens the exact requested User UUID even when the browser is signed in as a different admin account.
- Wallet transfer payload is scoped to the selected user instead of shipping every local test record.
- Added Reset Current Test User Wallet in Admin > Wallet & Rewards. It clears only local test data for the entered UUID (and linked local referral test pair), not Supabase.
- Manual voucher fulfillment remains attached to the existing redemption and does not create a second Wallet debit/history row.
- Expected clean history after fresh test: Referral/Welcome Reward +₹100 -> Croma Reward Redemption -₹100.
