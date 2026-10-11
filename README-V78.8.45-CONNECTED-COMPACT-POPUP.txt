PricePulse V78.8.45 — Connected Compact Comparison Popup

Base: V78.8.44 approved working base.

Changed ONLY comparison-popup shell/interaction:
- Desktop comparison popup is smaller: 66vw, max 940px; 70dvh, max 640px.
- Existing comparison content/rows/data/logic are untouched.
- Find Best Price on a Home card opens the comparison popup with a subtle 0.94 -> 1 fade/scale animation using the clicked card as transform origin.
- Popup gets a small intelligent horizontal bias away from the clicked card so the Home card relationship remains visible.
- Background uses a lighter 30% dim + 2.5px blur.
- Clicked Home card receives a subtle green outline/glow while its comparison is open.
- Closing reverses the animation back toward the same card.
- Tablet/mobile preserve their approved popup sizing; only the subtle fade/scale animation is added.

Not changed:
Home card layout, mobile 2-column layout, popup internal HTML/content, retailer rows, prices, lowest/tie rules, Wishlist, Deal Alerts, Admin, Capture, Supabase, product image system, Auth, footer.
