PricePulse V78.5 — Central Brand & Store Logo Management
========================================================

Base
----
Built on the locked V78.4 catalog-management package. Existing website layout,
Wishlist, Auth, Deal Alerts, Preferences, Help & Support, Smart Search, footer/CTA,
retailer capture, verified-price logic and live best-store product-image sync were
not intentionally changed.

What V78.5 adds
---------------
1. Add Brand / Edit Brand can upload one official logo directly from the Admin Panel.
2. Add Store / Edit Store can upload one official logo directly from the Admin Panel.
3. Existing Logo URL / local path remains supported as a fallback/manual option.
4. SVG, PNG, JPG and WebP are accepted; maximum upload size is 2 MB.
5. Brand/Store dialogs show a live logo preview before saving.
6. Manage Brands / Manage Stores shows the currently saved logo so the central source
   can be visually checked.
7. Uploaded logos are stored in the Supabase public bucket `pp-catalog-logos`; only
   users in the existing `pp_price_admins` allowlist may upload/change/delete objects.
8. The saved public URL continues to use the existing `logo_url` column, so no catalog
   schema migration is required and future API/feed/site consumers can reuse it.

One-time setup
--------------
Run `supabase-catalog-logo-storage-v78.5.sql` once in Supabase SQL Editor before using
file upload. Existing URL/local-path logo saving continues to work even before this
storage SQL is installed.

Important architecture
----------------------
The Admin Panel stores the original/official logo source only. It does NOT bake a
single display width/height into the logo record. The website should control logo
presentation separately per placement (brand card, retailer row, comparison modal,
etc.) with CSS/object-fit/padding. This allows one clean official logo to be reused at
whatever size each website component needs.

Website behavior
----------------
V78.5 intentionally does not replace the current website's hardcoded logo rendering.
The next safe step is to bind website brand/store logo rendering to the existing
`pp_catalog_brands.logo_url` / `pp_catalog_stores.logo_url` values with local assets as
fallback, then tune display size independently by placement.
