PricePulse V68 — Multi-product manual price admin dashboard

Base: V67 locked working OnePlus live-price pilot.
Public comparison popup/design, affiliate links, retailer logos, product cards and V67 public price pilot are unchanged in this step.

Admin-only changes:
- admin-prices.html now manages all 10 current products from the locked V67 site.
- Uses the exact existing retailer/affiliate links already present in index.html.
- Shows Products Best Price ready, Fresh retailer checks, and Due/Never checked counts.
- Product status filter: Needs attention / All products / Best Price ready.
- One-click "Next product needing review" navigation.
- Each product opens its own existing retailer links and supports the same secure 24-hour manual verification/upsert flow.
- Existing OnePlus Nord 6 database rows remain intact and appear automatically.
- No new SQL is required; the existing pp_price_admins and pp_retailer_prices tables/RLS are reused.

Next safe step after validating this dashboard: verify one second product manually, then extend the public Supabase price reader from OnePlus-only to all products.
