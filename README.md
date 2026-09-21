# PricePulse — Clean Final Build

Fixes screenshot-like assets, mobile layout, dead buttons, category/deal visuals, hero glitch, CTA copy, wishlist, search/filtering, and footer information links.

Prices and store counts remain demo data until marketplace affiliate/API integrations are added.


## V3 polish
- Separate boxed CSS hamburger icon for All Categories
- Consistent hover color + underline + micro-animation across navigation, footer links, cards and buttons
- Improved sticky-header anchor offsets
- Slightly larger desktop brand mark

## V5
- All Categories is no longer forced green on first load
- All Categories opens a real category dropdown
- Dropdown supports click-away and Escape close
- Dropdown categories filter the demo product grid
- Selected top category gets active green/underline state


## V6 Final nav polish
- Hamburger icon perfectly centered
- Hamburger lines remain fixed on hover
- Icon and All Categories text are visually separate
- Underline appears only under text
- No forced green state on load
- All Categories opens downward without shifting page content
- Desktop menu is compact 4x2 grid
- Category click closes menu, marks top nav active, filters products, then scrolls to deals

## V7 fixes
- Removed duplicate All Categories click handlers that caused the menu to open and immediately close
- All Categories dropdown now reliably opens downward
- Underline has more breathing room and visually matches normal nav items such as Electronics
- Hamburger remains centered and its three lines stay fixed

## V8
- All Categories now opens as a compact dropdown directly downward from the button
- No more full-width mega-menu
- Desktop uses a 2-column x 4-row category list
- Mobile uses a single-column dropdown
- While the menu is open, only All Categories is highlighted; previously selected top category is temporarily neutral

## V9
- Desktop All Categories dropdown is a compact single horizontal row of 8 categories
- Dropdown is wider but much shorter
- Heading spacing reduced
- Close button smaller and moved to the top-right corner
- Responsive fallback: 4x2 on smaller desktop/tablet, 2 columns on small screens, 1 column on phones

## V10
- All Categories opens as a compact vertical list downward
- One category per row
- Added PRICEPULSE EASY SETTINGS at the top of style.css
- You can now change dropdown width, gap, radius, row height and green hover color yourself
- Save style.css and refresh the browser to preview changes


## Approved V13 changes
- Based on the user's uploaded `pricepulse-clean-final-v10 2.zip`.
- Restored Sign In -> Email OTP -> Verify flow using Supabase.
- Kept Google sign-in visible as Coming soon (not falsely presented as live).
- Header never shows `Complete Profile`; it shows Sign In until a complete profile exists, then Account.
- Auth/profile popup uses the approved PricePulse logo asset.
- Full Name uses browser autofill.
- Mobile uses a separate fixed +91 prefix and 10-digit Indian number field.
- State / UT is a dropdown with all Indian states and union territories.
- Country defaults to India and PIN validates as 6 digits.
- Profile reads/writes the Supabase `profiles` table.
- Removed preview-mode banner text.
- About, Contact, Privacy, Terms and Affiliate Disclosure have branded content using pricepulseonline@gmail.com.


## V14 approved polish
- Header shows `Hi, FirstName` for signed-in users with a completed profile.
- PricePulse logo gets the approved deep-blue background tile on auth/profile/legal white screens.
- Profile Full Name uses stronger browser autofill hints (`autocomplete=name`, standard `name` field, form autocomplete on).
- Existing Supabase OTP/profile flow, +91 mobile layout, state/UT dropdown, India country default and 6-digit PIN validation are preserved.
