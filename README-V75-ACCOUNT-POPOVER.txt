PricePulse V75 — Premium Account Popover

Base: V74.1 unified auth flow.

Locked/untouched:
- Wishlist V73.5 design and logic
- Sign In / Sign Up / Auth V74.1 flow and profile persistence

Added only for completed signed-in accounts:
- Existing header user/login icon stays in place; no initials/avatar badge in header.
- Header label remains dynamic: Hi, {First Name}.
- Header account item stays active with PricePulse green underline/icon while popup is open.
- Premium account popover opens directly below the active header account item.
- No pointer/triangle and no dark page overlay.
- Account summary uses the existing user icon, full name, email and active status.
- Menu: My Profile, My Wishlist, Deal Alerts, Preferences, Help & Support, Sign Out.
- My Profile reuses the existing V74.1 profile editor.
- My Wishlist reuses the locked V73.5 Wishlist.
- Deal Alerts reuses the existing profile form and focuses the alerts option.
- Preferences and Help & Support are visually present and currently show a coming-soon toast until those sections are built.
- Clicking outside or pressing Escape closes the popover.
