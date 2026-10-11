PricePulse V60 — retailer logo display-source fix only
Base: pricepulse-v59-retailer-logo-consistency.zip.
Issue confirmed from user screenshots: external retailer logo images could load but still appear very small inside fixed image frames because of large embedded whitespace. The V59 local fallback previews were correct; live remote-primary renders were not.
Fix: Use the SAME existing local fallback wordmark asset references used by the Compare Across Stores discovery cards as the stable primary images in retailerLogo(). Retain V59 local SVG viewBox fragment cropping to remove their existing whitespace and fall back to uncropped local asset if a fragment fails. This same retailerLogo() feeds Home product cards, comparison-popup rows and the Best Price chip (also Wishlist). Compare Across Stores original store cards and their remote/fallback logo settings were not touched.
No changes to CSS, existing assets, product/pricing data, affiliate URLs, layouts, buttons or functionality.
Both stylesheet and script file query versions are now v60.0 so the browser does not keep earlier logo code/styles after deployment; file contents for stylesheet were not edited.
