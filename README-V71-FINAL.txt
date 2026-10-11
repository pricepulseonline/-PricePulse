PricePulse V71 FINAL — locked comparison UI polish

Base: V70 FINAL. Existing products, affiliate links, product imagery, categories, auth/wishlist and current verified prices are preserved.

Locked V71 changes:
1. Home verified-price cues stay exactly as in V70.
2. A retailer row shows LOWEST PRICE only when exactly one in-stock retailer has the unique lowest current price.
3. If 2+ retailers share the same lowest current price, LOWEST PRICE is not repeated on each tied row.
4. The compact summary heading always remains “Best Price Found by PricePulse”; “Best Price (Tie)” is removed.
5. In a current-price tie, the summary shows one selected retailer logo beside the best price and one “View Best Deal →” CTA.
6. Tie selection is based on verified history in this order: more lower-price wins, lower historical average, stronger verified in-stock consistency, more recent lower-price result, then most recently verified current tied listing while history is still building.
7. The compact summary adds a Price history block for tied prices. Once history contains decisive comparisons, it shows lines such as “Flipkart was lower — 7 times (70%)” and “Amazon was lower — 3 times (30%)”. It never invents 7/10 data.
8. If no past lower-price winner exists yet, the history block honestly says verified history is still building and the current tied listing is selected by most recent verification.
9. Historical comparisons use only snapshots where all currently tied retailers had verified in-stock prices, so the tie-break evidence compares like-for-like stores.
10. The existing V70 history architecture remains source-agnostic. Manual checks work now; authorized API/feed history can take over later without redesigning the public UI.

Database:
- Reuse supabase-price-history-v70.sql. Run it once if it has not already been run.
- Existing current prices are not reset by V71.

Intentionally unchanged:
- Current modal structure and visual language
- Product cards apart from the already-approved V70 price cue
- Affiliate URLs and retailer View Deal links
- Login, wishlist, categories and navigation
- Product selection and images
