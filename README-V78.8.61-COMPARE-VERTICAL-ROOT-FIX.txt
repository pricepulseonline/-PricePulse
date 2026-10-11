PricePulse V78.8.61 — Compare vertical root fix

Base: V78.8.57 reference-alignment build.

Root causes fixed:
1. Best Price fixed-height selectors previously treated .pp-v787-summary and .pp-v52-summary as parent/child, but both classes are on the same element. The fixed 140px/tie-history rules therefore never applied. V78.8.61 uses correct same-element selectors.
2. The fixed retailer viewport did not define fixed implicit grid tracks. With only two stores, CSS Grid stretched the two rows to fill the reserved 3-row viewport. V78.8.61 uses grid-auto-rows:106px + align-content:start. 4th/5th stores scroll only inside that viewport.

Preserved from V78.8.57:
- approved logo/text/CTA horizontal alignment
- 106px retailer row visuals
- Best Price visual styling
- popup white-content positioning and connected animation
- pricing, lowest/tie logic, Wishlist, Home cards, Admin/capture logic

Desktop popup height is capped at 675px within the available white content region so the verified 3-row viewport + 140px summary + footer fit without clipping.
