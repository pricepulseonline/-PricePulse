PricePulse V78.8 · Premium Product Images
Base: V78.7.9.6 (approved/locked)

LOCK PRESERVED
- Existing comparison popup alignment, logo system, prices, ratings/reviews, Wishlist, Deal Alerts, Auth, footer/CTA, Admin capture/verification logic and verified best-store live-image architecture remain unchanged by default.
- Existing products stay in Auto mode unless an admin explicitly selects Curated 2-image mode.

NEW ADMIN IMAGE CONTROLS (Edit Product)
- Website image mode: Auto verified best-store image OR Curated fixed 2-image gallery.
- Image 1 Primary + Image 2 Alternate.
- Pick from current live/fallback image or verified exact-match retailer images.
- Manual URL field for each slot.
- Local file upload for each slot (optional storage setup below).
- Display controls per image: background (soft/white/transparent), fit (contain/cover), position, scale.
- Live preview in Admin before Save.

WEBSITE BEHAVIOR
- Auto mode preserves the current verified best-store image behavior and existing legacy galleries.
- Curated mode uses Image 1 as the website/card primary image and Image 2 as the alternate popup thumbnail.
- Popup main image switches between the two curated images while applying each image's saved display settings.
- If a curated Primary is empty, the existing verified/fallback image remains the main image.

DATA STORAGE
- Gallery settings are stored inside existing pp_catalog_products.metadata.site_images JSON. No catalog-table migration is required.
- Local-file uploads use a new public bucket: pp-product-images.
- Run supabase-product-image-storage-v78.8.sql once only if local-file uploads are required. URL-based curated images do not need the bucket.

SAFETY
- Retailer source choices are restricted to images previously saved as exact-match + image-verified retailer captures.
- Manual URLs/uploads remain explicit admin overrides.
- Display background controls style the website frame; they do not remove pixels from an image. For true background removal, upload a cleaned image file.
