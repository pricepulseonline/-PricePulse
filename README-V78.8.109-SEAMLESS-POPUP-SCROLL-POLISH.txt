PricePulse V78.8.109 — Seamless Popup + Background Scroll Polish

Base: V78.8.108.

Isolated change only:
- Popup still opens immediately from Find Best Price.
- Background source-card alignment now begins after the first rendered popup frame with only a tiny ~24ms handoff, removing the visible pause/dead-gap.
- Background auto-scroll uses a smootherstep easing curve for softer acceleration/deceleration.
- Scroll duration is slightly longer and distance-aware for a more premium glide.

Preserved unchanged:
- V78.8.105 four-card horizontal anchor rules.
- V78.8.106 vertical source-card connection target.
- V78.8.107 popup-first behavior.
- Existing popup animation CSS and all approved popup design.
- Wishlist, Deal Alerts, Auth, Preferences, Help & Support, Admin, pricing/verification logic, footer, Share, outside-click close, and all other approved behavior.
