PricePulse V78.8.31 — Admin Edit + Category + Flipkart Capture Fix

Base: user-supplied V78.8.30 ZIP.

Scope (only requested fixes):
1. Admin Edit Product text persistence
   - Product ID stays immutable during edits.
   - Mutable canonical text fields are updated and the saved row is read back before closing.
   - Public Home/Category cards now consume the live catalog product name/category/brand so saved canonical text edits become visible without changing image logic.

2. Edit Product Category list
   - Category is now a dropdown.
   - Includes current PricePulse categories (Mobiles, Laptops, Electronics, Home & Kitchen, Fashion, Appliances, Beauty, Watches) plus any category already present in catalog data.
   - Current category is preselected.

3. Flipkart browser capture selling-price hardening
   - Stops selecting the smallest number on the page.
   - Prioritizes the selected product's main Flipkart selling-price DOM / structured product price.
   - Ignores EMI/monthly amounts, protection fees, coupons, discount/save text and unrelated recommendation prices.
   - MRP comes from struck/MRP context and must not be below selling price.
   - Capture helper version bumped to 2.2.

LOCKED / UNTOUCHED:
- Premium Product Image fields and Primary/Secondary image selectors.
- Scale/Tilt/X/Y and Global Live Preview.
- Existing retailer image verification and exact-match safeguards.
- All unrelated public website, Wishlist, Deal Alert, Auth, Preferences, footer and comparison logic.
