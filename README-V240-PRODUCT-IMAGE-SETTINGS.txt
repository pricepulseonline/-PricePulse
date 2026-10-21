PricePulse V240

Changed files: premium-v200.js, premium-v200.css, index.html (cache version only),
               admin-prices.html, admin-prices.js, admin-live-preview.html
No SQL required. script.js is NOT changed.

Product page
- Badge uses the price-history verdict again (no longer forced to match the Deal Score card).
  Icon matches the meaning: low price = down arrow, high price = up arrow, normal = shield.
- Hero spacing tightened. Left column is 374px: brand row, 344x258 image box, 58px thumbnails, title.
- Admin image settings (Scale / Tilt / X / Y / Position / Fit / Background) now apply on the product page
  exactly like the Admin preview. The image can pop out above/below the box; it is clipped at the
  left/right edge of the column so it never covers the price card.

One global image setting
- Recently viewed, You may also like, Popular deals product tile and the Home hero card now use the same
  Admin image setting (fit + background) instead of fixed boxes. No more cut images.

Top Brands / Shop by Store
- Tiles not in the fixed colour list now take their colour automatically from the logo.
  Existing brand/store colours are unchanged.

Admin (admin-prices.html / admin-prices.js / admin-live-preview.html)
- "Compare Popup" preview replaced by the exact Product page preview. Red border = image is cut at the side on the live site.
- New "Small cards" preview. Home, Wishlist and Deal Alerts previews stay. A red "Cut" tag shows when an image is cut.
- New "Remove background" button under each image slot (browser only, tolerance slider, preview, then Use this image).
