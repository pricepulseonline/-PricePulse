PricePulse V74.1 — Unified Auth + Feature Gate

Base: V74 signup flow, preserving locked Wishlist V73.5 behavior.

Changes:
- One unified auth screen: Continue with Google or Email + Continue.
- Removed separate Create Account / Sign In mode switch and account-not-found flow.
- Email OTP always allows existing users to sign in and new users to create an account.
- Existing users with a complete profile go directly back to the site.
- New/incomplete users are sent to Complete Profile.
- PIN field placeholder changed to "Enter PIN code" (no hardcoded 302001).
- Wishlist header and product heart are account-gated.
- Guest can browse products/prices/comparisons freely.
- Clicking an account-only Wishlist action opens auth.
- After auth/profile completion, the originally requested Wishlist action resumes automatically.
- Google OAuth keeps the pending Wishlist action across redirect via sessionStorage.
- Future account-only features can reuse the same pending-action auth flow.
