PricePulse V78.8.24 — Home/Category Premium Card Detail Completion

Base: V78.8.23, itself built from approved V78.8.22.

This patch only completes items visibly present in the approved premium-card reference that were missing in V78.8.23:
- Category • Brand • Model row from canonical catalog / verified matching data.
- Variant row from canonical catalog or safe reviewed matching retailer data.
- Lowest/Tie retailer status badge visibility fixed while keeping the shared lowest-first retailer logic.
- Best Verified Price kept on one line and compact.
- Verified discount badge overlays the product image only when real MRP/saving data exists.
- Home/Category thumbnail rail reuses the locked Premium Product Image primary/secondary images; it appears only when 2+ real images exist. No fake thumbnails or +N counts are created.
- Thumbnail click reuses the locked global image safe-fit/position system.

Locked/unchanged:
- Compare/detail popup rows and Best Price logic
- Premium Product Image Admin controls / exact preview behavior
- Wishlist logic/history, Deal Alerts, Auth, Preferences, Help & Support, Smart Search, footer
- Admin capture/verification and Supabase data model
- Retailer/store logo assets and existing logo normalization
