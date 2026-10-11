PricePulse V78.8.35 — retailer selling-price parser fix

Scope only: browser capture selling-price/MRP extraction in admin-prices.js.

Amazon:
- Selling price now prioritizes visible Price-to-Pay / non-a-text-price elements.
- Generic selector that could accidentally pick struck/list MRP as selling price was removed.
- Visible non-struck near-title price is checked before structured Offer fallback.
- MRP remains separately sourced from basisPrice / a-text-price / struck values.

Flipkart:
- Visible selected-product selling price now wins before JSON-LD/Offer fallback.
- EMI/monthly, protection fee, coupons, cashback, bank offers, exchange, WOW Deal promo values remain excluded from normal selling-price candidates.
- Visible struck MRP wins before structured/text fallback.

Capture helper version bumped to v2.6.
No Admin product editing, category, image system, public site, Wishlist, Deal Alerts, Auth, pricing persistence, or other locked logic changed.

Validation fixtures executed in Chromium:
- Amazon fixture: visible current price ₹250 + visible MRP ₹275 + misleading structured price ₹275 => captured ₹250 / ₹275.
- Flipkart fixture: visible current price ₹2,999 + MRP ₹4,990 + EMI ₹1,000 + WOW deal ₹2,989 + misleading structured price ₹1,000 => captured ₹2,999 / ₹4,990.
