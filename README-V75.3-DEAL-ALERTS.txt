PricePulse V75.3 — Wishlist-connected Deal Alerts

What changed
- Deal Alerts is now a real per-product target-price feature, not an On/Off preference screen.
- Wishlist cards get a Set Deal Alert / Edit Deal Alert action.
- Account > Deal Alerts opens a real dashboard with Active, Triggered and All views.
- Alert target, retailer scope and account email are stored in Supabase.
- Existing verified pp_retailer_prices updates automatically mark matching alerts Triggered.
- Wishlist V73.5 and Auth V74.1 core behavior remain intact; Wishlist only receives the requested alert action.

ONE-TIME SETUP NOW
Run supabase-deal-alerts-v75.3.sql in your existing Supabase SQL Editor once.

Future email setup
The migration already creates a private notification outbox and a global email delivery switch.
Keep email_enabled=false now.
Later connect your email sender/Edge Function to pending pp_deal_alert_notifications rows.
After that, activate future email queuing with:

update public.pp_alert_delivery_settings
set email_enabled=true,updated_at=now()
where id=true;

No PricePulse frontend rewrite is required at that stage.
