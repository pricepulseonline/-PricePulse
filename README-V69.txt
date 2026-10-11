PricePulse V69 — Multi-product verified-price display

Base: V68 multi-product manual admin + locked V67 public comparison design.

Changed only public verified-price data loading:
- Every product comparison now fetches that product's fresh published rows from Supabase pp_retailer_prices.
- 24-hour expiry, display_permitted, published status and in-stock/out-of-stock logic remain enforced.
- Existing retailer links, comparison design, logos, buttons, product cards and admin dashboard are unchanged.
- Wishlist comparisons use the same per-product live price fetch.
- No static price hardcoding was added.

Known data note: Dot & Key Barrier Repair Moisturizer Flipkart remains pending because its retailer page errored during manual verification; Amazon + Meesho fresh rows are enough for Best Price.
