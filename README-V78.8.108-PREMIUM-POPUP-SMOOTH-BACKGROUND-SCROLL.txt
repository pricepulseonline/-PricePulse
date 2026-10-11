PricePulse V78.8.108 — Premium popup + smooth background source-card connection

Base: V78.8.107 popup-first background-connect final.

Scope (isolated):
- Popup still opens immediately from Find Best Price only.
- Approved premium popup opening animation is allowed to paint before background scroll starts.
- Background auto-scroll now uses a controlled eased animation (about 580–820 ms depending on distance) instead of browser-native fast smooth scrolling.
- If the clicked source card is already visually connected, the page does not move.
- V78.8.105 four-card horizontal anchor rules remain unchanged.
- V78.8.106/V107 vertical connection target remains unchanged.
- No comparison UI, pricing, Share, footer, pending/verified state, Wishlist, Deal Alerts, Auth, Admin, or outside-click behavior changed.
