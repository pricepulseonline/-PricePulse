PricePulse V78.8.4 — Global Safe Preview Fix

Base: V78.8.3. Existing approved V78.7.9.6+ logic remains locked.

Changes only in the premium image/global brand layer:
- Exact geometry-based safe-fit per surface (Home, Compare Popup, Wishlist, Deal Alerts, alert editor/thumbnails).
- Tilt / 3D angle, Scale and X/Y are now visibly rendered while the full product is clamped inside each frame.
- Admin Compare preview now uses the live popup image-frame proportions; Home/Wishlist/Deal previews use live-like aspect ratios.
- Primary image remains the global safe customer image. Secondary remains the popup alternate/back/angle image with independent settings.
- Central Admin brand logo now refreshes product cards and Shop-by-Brand cards, with existing local logos retained as fallback.
- Resize/mutation hydration keeps dynamic Wishlist/Deal/Popup images fitted after rendering.
- No SQL change required. Existing product image storage SQL remains sufficient.
