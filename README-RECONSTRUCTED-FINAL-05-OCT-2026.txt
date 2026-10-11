PricePulse — reconstructed working build (05 Oct 2026)

Recovered base:
- V78.8.68 V35-style natural Compare / short-screen fit

Reconstructed from the approved work in the chat:
- Global brand-logo box sizes restored to the approved compact contract:
  master 140x58, Home 108x36, Compare Popup 130x40, Wishlist 86x29.
- Home/Category top row uses Brand -> COMPARE & SAVE -> available blank space -> Heart.
  Compare & Save is content-fit, 36px tall; Heart is 36x36 and anchored at the far right.
- Initial HTML now says COMPARE & SAVE instead of N STORES, removing the visible 2/3/4 STORES flash before JS hydration.
- Compare popup heading/subtitle/share/View Best Deal manual polish reconstructed from final screenshots.
- Best Price saving line readability retained/bolded.
- Compare popup opens in the same click task instead of waiting extra animation frames; transition timing is shortened for a more immediate response.

Preserved:
- Pricing / tie rules / verified retailer data
- Wishlist / Deal Alerts / Auth / Preferences / Help & Support
- Admin capture and verification logic
- Product images / retailer ordering / footer / search logic
