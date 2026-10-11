PricePulse V78.8.104 — Smart Source Card Peek Final

Base: user's latest uploaded V78.8.103 working ZIP with all manual approved CSS/JS changes preserved.

Changed only comparison popup source-card positioning logic:
- Side-card behavior is preserved.
- Middle cards now also shift the popup intelligently left/right.
- Roughly a 64px source-card strip is kept visible where viewport space allows.
- Popup shift is viewport-clamped and capped at 190px.
- Animation origin is recalculated after the smart shift so the popup still feels connected to the clicked card.

Preserved unchanged:
- Popup design, dimensions and retailer rows
- Latest readability polish
- Final Share styling/position
- Footer text/background polish
- Pending/verified state styling
- Outside-click header/top-area close fix and Escape close
- Pricing, retailer, Wishlist, Deal Alerts, Auth, Admin, capture/parser and all other business logic
