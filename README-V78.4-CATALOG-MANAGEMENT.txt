PricePulse V78.4 — Safe Catalog Management

Base: V78.3. Existing website, Wishlist, Auth, Deal Alerts, Preferences, Help & Support, Smart Search, footer/CTA, capture/verification and V78.1 live-image sync are unchanged.

Added:
- Manage Brands: edit metadata, activate/deactivate, guarded permanent delete.
- Manage Stores: edit metadata, activate/deactivate, guarded permanent delete.
- Product controls: Edit Product, Archive/Restore Product, guarded permanent delete.
- Brand/store slugs and product IDs remain immutable during edit to protect existing references.
- Brand deactivation is blocked while active/tracking products still use it.
- Store deactivation is blocked while retailer links still use it.
- Brand/store hard delete is blocked while dependent records exist.
- Product hard delete is blocked while retailer links, current price rows, or price-history rows exist.
- Archiving a product changes catalog status to draft and unpublishes current live price rows; historical/catalog data is retained. Restoring does not republish stale prices — retailer prices must be verified again.

One-time database step for hard Delete buttons:
Run `supabase-admin-management-v78.4.sql` in Supabase SQL Editor.
Edit/archive/restore continue to use the existing V77 update permissions.

Important: Delete is intentionally conservative. If dependencies exist, use Archive/Deactivate instead of forcing deletion.
