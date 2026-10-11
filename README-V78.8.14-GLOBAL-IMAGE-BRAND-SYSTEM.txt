PricePulse V78.8.14

Base: V78.8.13 approved Admin preview vertical match.

ONLY requested global-system updates:
1. Premium image Scale is now 70-260 for BOTH Primary and Alternate controls.
2. Compare Popup/Admin exact-live hero respects Scale/Tilt/X/Y above 100% for every product, not only OnePlus. Compact Home/Wishlist/Deal surfaces remain safe-fit.
3. Brand binding now defensively resolves stale mismatches from product name/identity against the central Admin brand catalog. This fixes cases like OnePlus product showing boAt when stored mapping is stale.
4. Brand logos use one global context sizing contract based on the central Admin logo URL, so current and future brands do not need brand-specific CSS.
5. Future new products automatically inherit the same image defaults/controls through the existing site_images metadata model; future brands automatically use the same central logo resolver/sizing when assigned to a product.

No SQL required. Existing pricing, Wishlist, Deal Alerts, Auth, capture/verification, footer/search and approved V78.8.13 preview layout are unchanged.
