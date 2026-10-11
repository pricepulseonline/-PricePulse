PricePulse V77.3 — Retailer-aware capture + field source clarity

- Added retailer-specific best-effort capture for Amazon, Flipkart, Croma, Myntra, AJIO and Meesho.
- Each admin field now shows Captured now / Existing manual-helper-API / Manual required.
- Manual edits are marked Edited manually.
- Availability no longer defaults silently to In stock; it must be captured or explicitly verified.
- Delivery parser ignores bare “FREE delivery” because that is shipping cost, not an ETA.
- Existing guarded product/variant match and 24h publish workflow remain intact.
- Capture is best-effort because retailer DOMs can change; missing fields remain manual-review gated.
