PricePulse V78.8.3 — Global Product Image + Brand Logo System

Base: V78.8.2 Admin Panel Fit + Select Arrows.
All earlier approved comparison, pricing, retailer-logo, Wishlist, Deal Alerts, Auth, footer and capture logic remains locked.

What changed
1. One Primary product-image configuration is now reused across:
   - Home / Category product cards
   - Compare / Best Price popup product visual
   - Wishlist product media
   - Deal Alerts product media
   - Deal Alert editor / Wishlist alert popover
2. The same saved Background, Fit, Tilt/3D Angle, Scale, X and Y settings are reused globally.
3. Compact surfaces use an automatic safe-stage calculation so the product remains inside the frame instead of being cut after rotation/scale/position changes.
4. Admin Edit Product now shows a Global Live Preview for Compare Popup, Home/Category Card, Wishlist and Deal Alerts before saving.
5. Secondary image remains the popup alternate image; Primary remains the global default image.
6. Brand logo source is global: Admin pp_catalog_brands.logo_url is preferred everywhere a product brand logo is shown, with the existing local product-card logo as fallback.
7. Broken Admin brand-logo URLs fall back to the existing local logo instead of leaving broken-image text.
8. “Rotate / angle” label is clarified as “Tilt / 3D angle”.

SQL
- No new SQL is required for V78.8.3.
- Existing supabase-product-image-storage-v78.8.sql remains sufficient for local product-image uploads.
- Existing catalog logo storage setup remains sufficient for Admin brand/store logo uploads.
