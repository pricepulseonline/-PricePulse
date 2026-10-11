PricePulse V59 — retailer logo source consistency (logo-only).
Base: user supplied V58 ZIP.
- Home retailer strip, comparison popup rows and Best Price chip use the same primary logo asset reference as each existing Compare Across Stores discovery card.
- If the existing remote primary image is unavailable, all three reuse its existing local fallback. SVG fallback viewBox fragments crop transparent padding for better readable logo size without modifying logo files.
- Existing V58 logo sizing/alignment CSS was retained except two narrowly scoped mobile/tablet image-fit adjustments to prevent newly readable wordmarks from overlapping the existing price column. Grid and all other layout values remain unchanged. No cards, product details, pricing, affiliate links, buttons, or business logic changed.
- The actual images used on the live site depend on existing external logo host availability. Local fallback checked in offline browser preview.
