PricePulse V78.8.34 — Bookmarklet URL execution fix

Root cause fixed:
- The capture helper contained raw # characters inside CSS selectors.
- In a javascript: bookmark URL, # starts a URL fragment and truncated the helper before execution.
- The browser therefore raised a parse error (Unexpected end of input) before the helper could show any popup.

Fix:
- Keep the capture source readable internally, but generate the actual bookmark URL as javascript: + encodeURIComponent(source body).
- The bookmark URL now contains no raw # and executes the full helper.
- Capture payload/alert bumped to v2.5.
- Admin helper label now shows v2.5 instead of the stale v2.1 label.
- Copy capture helper now uses synchronous textarea + execCommand copy first, with prompt fallback.

Unchanged:
- Flipkart price hardening from V78.8.31.
- Admin Edit Product and Category dropdown fixes.
- Premium Product Image system and all other locked systems.
