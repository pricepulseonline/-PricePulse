PricePulse V78.8.120 — Refresh Fade-In Final

Base: V78.8.119 refresh FOUC / old brand-logo flash fix.

Change scope only:
- Preserves the first-paint preboot protection that hides raw legacy cards and the old brand-logo position.
- Replaces the abrupt final reveal with a subtle ~130ms opacity fade-in after premium card hydration is complete.
- Keeps layout space reserved during boot, so there is no collapse/jump.
- Keeps the existing safety fallback.
- No card geometry, pricing logic, popup behavior, Wishlist, Deal Alerts, Auth, Admin, images, or approved styling changed.
