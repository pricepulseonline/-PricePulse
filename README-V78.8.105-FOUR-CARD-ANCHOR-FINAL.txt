PricePulse V78.8.105 — Four-Card Anchored Comparison Popup

Base: V78.8.104 smart source-card peek final.

Desktop comparison popup positioning now follows the approved 4-card system:
1) 1st card: popup starts over the left area of card 2; it does NOT touch the site border.
2) 2nd card: popup snaps to/touches the right content border.
3) 3rd card: popup snaps to/touches the left content border.
4) 4th card: popup starts over the right area of card 3; it does NOT touch the site border.

The clicked source card keeps the existing green source outline/glow and the popup animation origin remains tied to the clicked card.

No CSS/layout/pricing/Wishlist/Auth/Deal Alerts/Admin/footer/Share/readability/outside-click behavior was changed. Only comparison popup desktop positioning logic in script.js was updated.
