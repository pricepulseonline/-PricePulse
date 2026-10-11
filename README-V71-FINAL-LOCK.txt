PricePulse V71 FINAL LOCK

Final retailer-row LOWEST PRICE rule:
- One unique minimum price: badge that retailer.
- Two or more retailers share the minimum while at least one available retailer is higher: badge every minimum-price retailer.
- All currently available retailers have exactly the same price: do not repeat LOWEST PRICE badges on every row.

Examples:
₹4,849 / ₹4,849 / ₹5,199 -> Amazon + Flipkart show LOWEST PRICE.
₹387 / ₹387 / ₹387 -> no retailer row shows LOWEST PRICE.
₹2,999 / ₹3,000 / ₹3,099 -> only ₹2,999 shows LOWEST PRICE.

The compact Best Price Found by PricePulse card, single View Best Deal CTA, and verified price-history reason remain unchanged.

Final last fix (71.2):
- The all-same test now considers every retailer row that has a verified numeric price, including out-of-stock rows.
- The actual best/lowest price selection still uses in-stock/available retailers only.
- Therefore 4849 / 4849 / 5199 OUT OF STOCK shows LOWEST PRICE on the two 4849 rows.
- 387 / 387 / 387 still shows no repeated LOWEST PRICE badge.
