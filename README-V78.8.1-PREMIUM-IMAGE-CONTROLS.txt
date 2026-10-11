PricePulse V78.8.1 — Premium Product Image Controls

Base / lock
- Built only on the existing V78.8 premium-image layer, which itself sits on the approved V78.7.9.6 state.
- No approved comparison-popup layout, Best Price alignment, logo sizing, rating/review layout, Wishlist, Deal Alerts, Auth, footer/CTA, or retailer capture/verification logic was intentionally redesigned.

Added in V78.8.1
1. Admin Website Preview
   - Primary / Secondary images now show in one website-style preview before saving.
   - Two preview thumbnails switch the preview between the selected images.
   - Canonical fallback remains a backup field and is used only if no curated preview image is selected.

2. Verified source picker
   - Available live/fallback/exact-match verified retailer images are shown as visual source cards.
   - Use as 1 = Primary, Use as 2 = Secondary.
   - Existing URL and local-upload paths remain available.

3. Per-image premium controls
   - Fit: Contain / Cover
   - Background canvas: Soft premium light / Pure white / Transparent / Original background
   - Position preset: Center / Top / Bottom / Left / Right
   - Scale: 70%–140%
   - Rotate / angle: -30° to +30°
   - X position: -30 to +30
   - Y position: -30 to +30
   - All controls update the Admin preview live.

4. Website rendering
   - Curated Primary / Secondary images retain their saved fit, scale, angle and X/Y adjustments in the comparison popup.
   - Popup thumbnail switching applies the correct saved settings to each image.
   - Primary remains the product-card image URL in curated mode; the existing automatic verified-image fallback remains intact.

5. Data compatibility
   - site_images metadata version is now 2.
   - Existing V78.8 version-1 image data continues to load with safe defaults for Rotate/X/Y.

Not added yet
- Actual AI/background-removal processing is intentionally NOT included in this version. The background selector controls the display canvas. Background removal remains a future phase so the original uploaded image can be preserved and edited versions can be reverted safely.
