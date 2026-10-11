PricePulse V78.8.122 — Selective No-Blank Refresh

Root cause fixed:
- V119-V121 hid the entire #dealGrid until the main deferred script executed.
- script.js is intentionally ordered after the deferred Supabase CDN dependency, so every refresh could still show a blank Popular Deals area before script.js was allowed to run.
- Shortening requestAnimationFrame/fade timings could not remove that pre-script wait.

Fix:
- Removed whole-grid visibility/opacity boot hiding.
- Product cards stay visible from first paint.
- Brand logos are pre-positioned in their final top-row DOM location in index.html, eliminating the old image-area logo flash.
- Only legacy fields that JS replaces are selectively suppressed until the first premium card pass completes.
- Premium identity/price rows are pre-reserved so the approved V78.8.118 geometry does not collapse during boot.
- After the initial synchronous premium pass, each card gets pp-card-ready and all final content is visible immediately.
- Safety fallback reveals legacy fields if the main script fails to initialize.

No changes to V78.8.118 card design/pricing geometry or V78.8.112/V111 comparison-popup behavior.
