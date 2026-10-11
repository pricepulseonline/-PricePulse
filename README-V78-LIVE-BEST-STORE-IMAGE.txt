IMPORTANT: This V78.0 note is historical. In the V78.1 package, use README-V78.1-VERIFIED-BEST-STORE-IMAGE.txt.
The included V78 SQL filename has also been hardened to the V78.1 safety rules.

# PricePulse V78.0 — Best-Store Live Product Image

This version keeps V77.9 Admin/Capture behaviour and adds the requested automatic product-image flow.

## One-time database step
Run `supabase-live-product-images-v78.sql` in the same Supabase project.

## Behaviour
- When a retailer price is published/updated, Supabase finds the lowest fresh in-stock offer.
- If that winning retailer has an exact product Match and a captured image, its image becomes the website live product image.
- The canonical `image_url` is preserved as a fallback.
- When 24-hour prices expire, the last verified live image stays visible. It does not disappear or revert just because time elapsed.
- On the next verified update, the image moves to the new lowest store if that store has an exact-match image.
- Future authorized API/feed writes to `pp_retailer_prices` use the same trigger automatically; no frontend redesign is required.
- If the lowest-price row has no safe exact-match image, the previous verified live image is retained.

## Admin checkbox
The old image checkbox is still available, but it now only means “replace the permanent canonical fallback image.” Live best-store switching is automatic and does not require the checkbox.
