PricePulse V77.8 — Flipkart review capture safety fix

- Restores the working synchronous bookmarklet flow from V77.6/V77.5.
- Removes the blocking review-page fetch that could make the bookmark appear dead before clipboard copy.
- Only review-count detection was changed. Price, MRP, rating, delivery, stock, model, variant and all existing working capture logic are preserved.
- Review count is now taken only from Flipkart data already present in the loaded page DOM/scripts. If Flipkart does not expose it there, the field remains Manual required rather than breaking the whole capture.
- Bookmarklet bumped to PricePulse Capture v1.8.
