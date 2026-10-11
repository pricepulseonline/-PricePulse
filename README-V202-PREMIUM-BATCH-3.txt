PricePulse V202 — Premium Batch 3 (builds on V201)

Changed files: premium-v200.css, premium-v200.js, script.js (2 lines), index.html, wallet.html

New pages (popups turned into pages)
- #/account         My Account: profile card, saved/alerts/membership stats, profile details,
                    shortcuts (Wishlist, Alerts, Wallet, Plus, Preferences, Help) and Sign out.
                    "Edit profile" still opens the existing profile form popup (popup is right there).
- #/preferences     Preferences page (same form and saving)
- #/help            Help & Support page (same FAQ search, email and problem report)
- #/brands, #/stores  All Brands / All Stores pages (tap a brand/store -> filtered deals on home)
- #/info/about | contact | privacy | terms | affiliate   Legal/info pages with side navigation
- Signed-out visitors opening Account/Preferences/Wishlist/Alerts see sign-in, then land on that page.

Bug fixed
- Brand filter showed 0 products: card brand ids were being overwritten by display names.
  Display name now lives in data-brand-name; data-brand keeps the id. Brand counts and
  "Explore Deals" by brand work again.

Wallet page
- Uses the premium theme (fonts, cards, tabs). Wallet logic unchanged.

Still popups (by design): sign-in/OTP, profile edit form, price-alert editor, categories menu,
account dropdown, share, confirmations.
