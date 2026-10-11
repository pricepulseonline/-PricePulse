PricePulse V78.8.144 — Plus Member Deals

AUTHORITATIVE BASE
pricepulse-v78.8.143-plus-own-membership-rpc-sync.zip
Base SHA-256: db746d013c1544cc1e06cc188700e27dd7816d3ce88fc59ec16c08043ecdf402

EXACT CHANGES
1. script.js: Active Plus CTA now uses data-plus-action="members" and calls
   ppOpenMemberDeals(). Existing pending shop action and popup markup/design remain.
2. index.html: script.js cache version changed to 78.8.144; loads the two new
   isolated Member Deals assets. Header/category markup is unchanged.
3. New plus-member-deals.js: dedicated main-content view beneath existing navigation;
   membership status/expiry, Exclusive Member Offers, Plus Rewards, Eligible Coupons
   & Bank Offers, Early-access Campaigns, honest empty states, Back to shopping.
   Home/category/search navigation restores the original content.
4. New plus-member-deals.css: styles scoped to the new view; two-column desktop and
   single-column mobile sections. Original CSS file is byte-identical.
5. This README: change log, validation, and integration limits.

ACCESS
Fresh getUser + existing own-user membership and master-control RPCs required.
Local/test membership alone cannot grant entry. Failed verification blocks entry.
Available/pending/expired members in Individual mode return to their existing Plus
state. Existing V143 Master ON/OFF/Individual semantics remain: Master ON grants
its existing effective active status, Master OFF blocks access.
Checks cover expiry, sign-out/account change, focus/visibility and a 60-second
server refresh while the view is open. No new database migration is required for
an installed V143 backend. No production database data was changed.
This is a frontend view gate; future protected offers must also enforce access
and eligibility server-side.

GENUINE OFFERS AND FUTURE SHOP DEAL
The base has no member-offer feed or standalone tracked Member Deals shop endpoint.
All four sections therefore ship empty; no public deal is relabeled as Plus,
no prices/coupons/rewards are invented, and there are no Shop Deal buttons yet.
The existing fresh SubID session implementation is tied to Wallet redemption,
including locking a reward amount. It was not repurposed to create shopping links.
Before publishing real offers, connect a server-authorized member campaign source
and its fresh tracked PricePulse retailer/SubID route. Recheck membership/campaign
eligibility on each Shop Deal; never use a stored SubID or direct/raw retailer URL
as a fallback. This future offer/Shop Deal integration is NOT implemented or
end-to-end verified in V144 because the standalone route and campaigns are absent.

PRESERVATION
330 of 332 original files are byte-identical; only index.html and
script.js changed. Wallet files, Wishlist/Deal Alerts implementation, original
styles, header/category markup, Plus popup design, catalog, images, retailer URLs,
Admin and SQL files are preserved. Original ZIP remains unchanged.

VALIDATION ACTUALLY PERFORMED
- JavaScript syntax checks passed for script.js and plus-member-deals.js.
- In-app browser with isolated mocked Supabase responses; no live writes.
- 1440px desktop and 390px mobile CSS viewports: new content placement, four sections,
  expiry and no horizontal overflow passed; screenshots visually inspected.
- Active CTA with incomplete profile opens Member Deals and closes the modal.
- Normal/pending/expired/elapsed-expiry, failed RPC, Master OFF, revocation,
  sign-out, Home and search-return checks passed.
- A 318px exploratory viewport showed existing header overflow; locked header was
  not changed. 390px and 1440px checks passed.
- Browser logged the pre-existing ReferenceError: ppAutoFitBestStoreLogo is not
  defined. The original script has its unresolved call at line 4568; unchanged
  by this scoped patch. No claim of a fully error-free legacy app is made.
- Real signed-in production account, real campaign eligibility, retailer checkout
  and fresh tracked Shop Deal were NOT tested.
- Test harness/fixtures are excluded from the deliverable ZIP.
