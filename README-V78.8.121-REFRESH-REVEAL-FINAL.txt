PricePulse V78.8.121 — Refresh Reveal Final

Base: V78.8.120.

Scope: refresh-only visual polish for Popular Deals cards.
- Preserves V119 anti-FOUC protection so raw legacy cards and the old brand-logo position never flash.
- Reduces the reveal from two requestAnimationFrame waits to one.
- Shortens the final opacity transition from 130ms to 85ms.
- Keeps a safety fallback so cards cannot remain hidden if JavaScript boot is interrupted.
- No changes to V78.8.118 card design/readability/pricing layout, V78.8.112 popup side connection border, V78.8.111 premium popup behavior, Wishlist, Deal Alerts, Auth, Admin, or pricing logic.
