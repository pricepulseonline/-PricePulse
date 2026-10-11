PricePulse V78.8.62 — Compare content-driven vertical sizing

Base: V78.8.61 locked working base.
Scope: desktop Compare popup vertical geometry only.

Root issue confirmed from the 2-store Samsung vs 3-store OnePlus screenshots:
V78.8.61 stopped 2 retailer rows from stretching, but the retailer viewport itself was still fixed at 332px and the popup shell was still fixed at 675px. That left reserved blank space and pushed Best Price too far down in the 2-store case.

Fix:
- Retailer list is now content-height for 1/2/3 stores, capped at 332px.
- 4th/5th stores still scroll only inside the retailer list (same 3-row cap).
- Best Price follows directly after the last visible retailer row.
- Desktop popup shell is content-driven, with the same 675px safety cap inside the white content area.
- Footer follows content instead of being pushed to the bottom of an empty fixed-height shell.

Preserved exactly:
- V78.8.57 retailer logo/text/button horizontal alignment
- 106px retailer rows
- Best Price 140px geometry and pricing/tie/history logic
- connected-card animation / white-content anchoring
- Home cards + mobile 2-column layout
- Wishlist, Deal Alerts, Auth
- Admin, capture/price parser
- product image system
