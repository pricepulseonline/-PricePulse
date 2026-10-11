# PricePulse V78.1 — Verified Best-Store Product Image

Base: V78.0 / V77.9 behavior retained. No Wishlist, Auth, Deal Alerts, Preferences,
Help & Support, Smart Search, footer/CTA, comparison UI, or existing capture parsing
logic was redesigned.

## What V78.1 fixes
V78.0 already had the best-price live-image architecture, but its DB eligibility check
used only `match_status='match' + image_url`. V78.1 adds explicit image provenance so a
manual image value cannot accidentally become the public product-card image.

A retailer image becomes eligible only when:
1. the retailer row is the actual current lowest fresh in-stock published price,
2. canonical product/variant result is `Match`,
3. the image is explicitly marked `image_verified=true`, and
4. image URL is present.

The Admin Panel sets `image_verified=true` only when the image came from the current
PricePulse Capture payload, the image field was not changed after capture, and the final
product/variant result is `Match`. `Needs Review`, mismatch override, manually typed image,
or missing image remain price-saveable but cannot replace the live product image. If a
retailer image was already safely verified earlier, a later price-only recheck preserves that
image verification as long as the image URL is unchanged and the product still resolves to Match.

## Persistence behavior
- 24-hour price expiry does NOT clear the last verified live image.
- If a new lowest-price store has missing/wrong/unverified image, the previous verified
  live image remains.
- The image switches only when the current lowest-price store itself has a newly valid,
  exact-match verified image.
- Canonical `pp_catalog_products.image_url` remains the permanent fallback.

## Future API/feed compatibility
The selection trigger is source-agnostic. Authorized API/feed ingestion can write the
same `pp_retailer_prices` row model and set `image_verified=true` only after its own exact
product/variant validation. The same trigger then updates the website image automatically.

## One-time database step
Run `supabase-live-product-images-v78.1.sql` in the existing Supabase project.
It is safe whether V78.0 was already run or not, and it supersedes the V78.0 migration.
