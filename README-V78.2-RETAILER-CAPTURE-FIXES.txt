# PricePulse V78.2 — Retailer Capture Fixes

Base: V78.1 verified best-store image sync. Existing website, Wishlist, Auth, Deal Alerts, Preferences, Help & Support, Smart Search, footer/CTA, Admin Catalog logic, 24-hour verification, Amazon/Croma capture, and live-image sync logic are retained.

## Targeted fixes only
1. Myntra selected variant
   - Captures only an explicitly selected size from selected/active/aria-selected size controls.
   - Falls back to visible "Selected Size / Size: X" text when present.
   - Does not invent a size if the shopper has not selected one.

2. Meesho product image + identity cleanup
   - Chooses the strongest visible main product image by rendered/natural image size instead of the first images.meesho.com image.
   - Keeps a safe fallback to the older image selector.
   - Normalizes Dot & Key brand naming.
   - Prevents a Meesho path/product token such as ba7dnt from being treated as the model; it can remain as SKU/reference data.
   - Extracts pack size such as 50g/50ml from the product title as the variant when exposed.

3. Flipkart review count
   - Adds itemprop reviewCount fallback.
   - Reads visible Ratings/Reviews text even when Flipkart separates the two values across nested markup.
   - Reads additional review-count keys from page scripts, including escaped JSON.
   - Adds a final current-page HTML fallback for review counts.

## Capture helper
PricePulse Capture is now v2.0. Replace the old bookmark/bookmarklet with the new v2.0 helper from the Admin Panel before testing these retailer fixes.

## Database
No new SQL migration is required for V78.2. Continue using the V78.1 database migration already supplied.
