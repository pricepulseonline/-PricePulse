PRICEPULSE V66 — PRIVATE ONE-PRODUCT PRICE PILOT
Base: approved/locked V65 popup and card design. No original retailer logos, prices,
affiliate links, or main-page layout were modified.

The pilot is PREPARED BUT NOT ACTIVATED: PP_PRICE_PILOT_ENABLED is false in
index.html. Until setup is finished, your public page functions as V65 does.

STEP 1 — In your EXISTING Supabase project, SQL Editor, run
supabase-price-pilot.sql. Do not run the SQL against a different project.

STEP 2 — Deploy the ZIP to a STAGING URL (or local dev server), not your live
production site yet. Open /admin-prices.html. Sign in using your intended admin
account's existing email OTP. Copy the displayed UUID in the admin panel.
Never paste the UUID, login OTP, database password, or any secret into public chat.

STEP 3 — In Supabase SQL Editor, personally authorize that EXACT UUID:
  insert into public.pp_price_admins(user_id)
  values ('YOUR-USER-UUID-HERE'::uuid)
  on conflict (user_id) do nothing;
Only the SQL Editor can grant admin access. No public user can self-register.
Refresh the admin page and verify "Admin access confirmed".

STEP 4 — For OnePlus Nord 6, use the links on the private admin page to visit
Amazon, Flipkart and Croma. Verify exact model/variant, in-stock status and
shown prices. Enter prices only from your own CURRENT checks and confirm.
No prices are seeded by this SQL and no retailer data is scraped.

STEP 5 — Only AFTER at least two store prices are saved and you have verified
that SQL row security works, activate the pilot with the single change in
index.html:  window.PP_PRICE_PILOT_ENABLED=true;
Test on staging before publishing. The main site then reads ONLY fresh,
explicitly permitted and published entries for OnePlus Nord 6 from Supabase.
The client also rejects manual checks older than 24 hours.

Public price reads are anonymous RLS-filtered. Browser writes require signed-in
Supabase auth PLUS membership in a table that only you can change in SQL Editor.
NEVER put a Supabase service_role key in browser code.

To turn the pilot off, set PP_PRICE_PILOT_ENABLED=false; this restores V65's
existing static-price behavior, which itself expires old manual checks.

Other products remain unchanged in V66. Once the one-product pilot is tested,
expand coverage by using the same approved admin/RLS pattern for the remaining
products. Authorized APIs/feeds can be added later if access and display rights
are approved; this version provides manual verified-price management only.
