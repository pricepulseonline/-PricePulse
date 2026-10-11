PricePulse V78.8.147-chat — Premium live Plus page
Base: V78.8.146 Plus Savings Membership only. The Work-mode V147 ZIP is NOT used as a code base.

Changed only the PricePulse Plus membership presentation:
- Plus opens as a dedicated full-width content page below the existing header/category nav instead of a membership popup.
- Premium navy/champagne hero is built from live HTML/CSS, not a pasted hero image.
- Interactive CSS membership card with subtle depth, shine, hover, gold crown and pedestal treatment.
- ₹99/year, CTA, four locked benefits, Free vs Plus comparison, Savings Tracker/Why Upgrade and Wallet-free reassurance all appear on the same page.
- Desktop layout is compacted to fit the first viewport where the available height is >= 620px; shorter/smaller screens fall back to normal scrolling.
- Active Plus users keep proper active/expiry state and actions for Member Deals / Plus Savings.
- Non-active users keep the existing checkout development flow.

Preserved:
- V146 backend and SQL rules
- Plus live DB sync and Master/individual logic
- Deal Alerts Free=1 / Plus=up to 3
- Wallet Free/Plus rules, rewards and vouchers
- Member Deals Manager
- Wishlist, Deal Alerts dashboard, Auth, Admin, header/category navigation and all other approved features

No new SQL is required for this UI-only update.
