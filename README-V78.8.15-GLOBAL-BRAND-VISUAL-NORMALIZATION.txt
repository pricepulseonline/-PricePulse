PricePulse V78.8.15

Brand-logo polish only on top of approved V78.8.14 / V78.8.13 image-preview system.

- Central Admin brand logo remains the canonical source.
- Runtime display normalizer trims transparent/plain background whitespace without modifying source files.
- One global visual sizing contract is used for Home/Category cards, Compare Popup, Wishlist, Brand cards and Admin previews.
- No per-brand CSS is required for future brands. New brands inherit the same system automatically.
- Existing product-image controls, pricing, Wishlist, Deal Alerts, auth, capture/verification and approved preview geometry are untouched.
- No SQL required.
