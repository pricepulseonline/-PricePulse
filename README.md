# PricePulse V19

Only the approved changes were made:
- Supabase account wishlist sync (guest wishlist merges into the signed-in account)
- Premium animated wishlist heart and account icon styling
- Multicolor Google G icon in the Google sign-in button
- Resend OTP cooldown changed from 30 seconds to 60 seconds
- Privacy text updated only to accurately describe wishlist storage/sync

Before deploying, run `supabase-wishlist.sql` once in Supabase SQL Editor.

No other layout, auth flow, product content, category layout, footer behavior, profile fields, favicon, or Google OAuth settings were changed.
