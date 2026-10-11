PricePulse V61 — Flipkart lockup + Amazon size correction ONLY
Based directly on V60. No designs, grids, category structures or interactive functions changed.

1. Existing logos/flipkart-wordmark.svg: moved its existing shopping-bag group from x276 to x226 and tightened intrinsic viewBox from 370x110 to (7,3,292,101). Text and bag now sit together. Removed obsolete V60 extended fragment crop for this already-tight SVG and added ?v=61 to its retailer-image URL to avoid stale browser caching. Same single Flipkart local file is used in Home retailer strips, comparison popup and Best Price; the existing Compare Across Stores local fallback gets the updated asset too if fallback is needed (same path with v61 cache version); its remote primary logo and its styling are unchanged.
2. Amazon only: optically reduced image widths in the Home retailer strip (78→70 desktop), popup rows (108→98 desktop), Best Price chip (88→80 desktop), with restrained mobile equivalents. Croma and other retailer assets and sizing left as-is.
3. Bumped HTML CSS/script query versions from 60.0 to 61.0 to avoid cached old rules.

UNCHANGED: price-data, prices, all affiliate URLs, product image/details, layout dimensions/grids, buttons, other retailer assets and application functionality.
