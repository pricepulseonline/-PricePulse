PricePulse V77.2 — Capture Match Fix

- Retailer SKU/ASIN is no longer treated as the canonical product model.
- Exact product title/model identity can validate a listing even when Amazon only exposes an ASIN.
- Captured ASIN remains preserved inside last_capture JSON for reference, but is not saved as captured_model.
- Amazon variant detection expanded to read selected variation labels and common RAM/storage text.
- Bookmarklet bumped to PricePulse Capture v1.2. Replace the older bookmark once.
- Existing 24h verification, manual confirmation, mismatch blocking and catalog logic are preserved.
