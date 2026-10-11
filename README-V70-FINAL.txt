PricePulse V70 FINAL

Base: V69 multiproduct live prices. Existing design, product links, affiliate URLs, auth/wishlist, categories and verified current prices are preserved.

Final changes:
1. Fresh Supabase prices preload in the background to reduce popup price pop-in.
2. Same-current-price ties show every lowest retailer.
3. Tie recommendation uses recent verified price history when there is enough evidence, with a visible reason: “Lowest in X of the last Y verified checks”.
4. If enough official API/feed history exists later, it is preferred over manual history automatically.
5. The no-best-price PricePulse logo is kept and aligned to the same retailer/logo column as the Best Price state.
6. Home-card Amazon retailer logo is optically shifted down for baseline alignment.
7. Home product cards now show a compact verified-price cue: Best verified price / single verified price / no in-stock verified price / check latest prices.
8. Added supabase-price-history-v70.sql. Run it once to enable persistent verified history and history-based tie suggestions. It preserves existing prices and seeds them into history.

Tie behavior:
- Unique lowest current price: View Best Deal goes directly to that retailer.
- Current price tie + enough history: PricePulse Suggests a retailer, explains why, and View Suggested Deal uses that retailer's existing affiliate URL.
- Current price tie + insufficient history: no arbitrary retailer is recommended; users can use the tied retailer rows above.

Pending retailer check intentionally unchanged: Dot & Key Barrier Repair Moisturizer 50g / Flipkart can remain pending while the retailer listing errors.
