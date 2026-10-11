PricePulse V78.8.32 — Capture popup/copy reliability fix

Base: V78.8.31.

Changed only the PricePulse Capture bookmarklet/helper flow:
- Removed asynchronous Flipkart deep-review scan from the click-critical path.
- Capture now runs synchronously so browser user-gesture/clipboard permission is preserved.
- Flipkart V78.8.31 selected-product selling-price hardening remains intact.
- Added explicit top-level error alert so runtime capture errors are visible instead of failing silently.
- Capture payload version is now 2.3.
- Existing Edit Product save fix, Category dropdown, Premium Product Image system and all other locked logic are unchanged.
