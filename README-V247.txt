V247 (16 Oct 2026) - mobile/tablet fixes. Desktop (>1100px) unchanged. script.js untouched.
Files changed: premium-v200.css, premium-v200.js, index.html (?v=247 only).
1. Product page Image 2 and Image 3: same fit rule on every screen (Admin Scale/Tilt/X/Y apply as on desktop). Image 1 keeps the fit-inside rule on small screens. (premium-v200.js, "V247")
2. Product page brand logo shown on phones (was hidden at <=620px).
3. Shop by Brand/Store: bigger text that scales with card width; phones show 2 cards, tablets (701-1100px) show 3 cards in one swipe row, spotlight card first.
