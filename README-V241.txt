PricePulse v241 — what changed (script.js is NOT touched)

SITE
G1  Image 3: product page now shows up to 3 thumbnails (Admin "Image 3 · Extra", saved in metadata.site_images.tertiary; works in Curated mode, no SQL).
G3  The big picture never blocks clicks (pointer-events:none on the stage image).
I1  Shop by Brand / Store tiles: the picture stays fully inside the round bubble.
J1  Tile colours: fixed colours added for all logos in the site folder; tiles of new brands/stores read the colour saved with the logo (see Admin), then fall back to the logo's own colour (works on the live site, not when opening the folder directly).
L1  Every product-picture background is white (Brand/Store tile bubbles keep their logo colour; the top brand/store spotlight picture panel is white too).
O1  "Verify exact model & variant on the retailer's page." on one line (wraps only on phones).
P1  Price graph colour follows the price level: low = green, middle = amber, high = red; a very small range (<3%) stays one calm colour. End dot shows today's level.

ADMIN (admin-prices.html / .js / admin-live-preview.html)
G1  Image 3 slot (same controls), "Use as 3" on verified sources, 3 thumbnails in the Product page preview.
G2  Auto-fit button on every image slot: trims empty margin, centres the product, equal 8% border, square result.
M1  Auto-fit also turns an off-white background pure white.
K1  Image 1 (the only picture used all over the site): if it has its own background a red notice appears and Save is blocked until you Remove background / Auto-fit, or tick "Keep as is". Images 2 and 3 only get a note. Links that the browser cannot read show "could not check" (download + upload instead).
H1  Product search box (name, brand, category, model, variant, store; spaces/hyphens/case ignored; "No product found" message; clear ×).
N1  New previews: Brand / Store tile (round bubble) and Deal Radar / Popular deals card, next to Deal Alerts.
J1  Brand and Store forms: "Tile colour" picker, filled automatically from the logo you upload (you can change it). Saved inside the logo address (#ppc=RRGGBB) so no SQL is needed.
Default image background option is now "White · default".

NOT DONE YET: automatic background check for images that will come from a future API (the checker is ready as window.ppImgTools; it needs the API itself first).
