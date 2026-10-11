PricePulse V78.8.145 — Plus Member Deals Manager

AUTHORITATIVE BASE
pricepulse-v78.8.144-plus-member-deals.zip

SCOPE
Only the PricePulse Plus Member Deals system was extended. Existing Wallet, Wishlist,
Deal Alerts, catalog, Plus membership status, Plus popup design and header/category
navigation are preserved.

WHAT CHANGED
1. Admin → PricePulse Plus now gets an isolated Plus Member Deals Manager.
2. Admin can create/edit/delete genuine Plus campaigns in exactly four sections:
   - Exclusive Member Offers
   - Plus Rewards
   - Eligible Coupons & Bank Offers
   - Early-access Campaigns
3. Campaign fields include partner/retailer, value label, title, member benefit,
   coupon code, campaign key, terms/how-to-use, start/expiry, Active, Featured,
   sort order and a future-safe action type.
4. New protected backend patch `supabase-plus-member-deals-v145.sql` adds:
   - `pp_plus_member_deals`
   - admin-only list/upsert/delete RPCs
   - customer `pp_get_my_plus_member_deals()` RPC which requires effective active Plus
5. Member Deals screen now loads real admin-published, date-valid campaigns and places
   them in the matching four sections. If there are none, the honest empty state remains.
6. Coupon codes can be copied from a member card. Internal PricePulse actions are
   supported. Raw retailer URLs are intentionally not accepted as a tracking fallback.

PAID PLUS VALUE RULE
Partner offers can change. A paid plan should therefore not rely only on external
retailer/bank deals. The Admin Manager shows a readiness signal and includes a rule:
keep at least one PricePulse-owned, always-available benefit live before charging,
then layer verified retailer offers, reward campaigns, coupons/bank benefits and
early access on top.

TRACKED SHOPPING
`tracked_campaign` is stored as a future-safe campaign type, but no raw external URL
is exposed from the customer UI. Connect a server-authorized fresh tracked campaign
route before enabling Shop Deal buttons for external retailers.

INSTALL
The already-installed V141/V143 backend remains valid. Run only the incremental file:
  supabase-plus-member-deals-v145.sql
Do not rerun old Plus/Wallet migrations just for V145.
