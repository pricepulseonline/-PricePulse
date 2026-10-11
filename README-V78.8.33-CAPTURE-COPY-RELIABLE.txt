PricePulse V78.8.33 — Capture Copy Reliable

Base: V78.8.32.
Scope: Capture helper copy stage only.

Fix:
- Replaced async navigator.clipboard-only capture-copy path with a synchronous user-gesture copy path using a hidden textarea + document.execCommand('copy').
- If automatic copy is blocked, a manual-copy prompt opens immediately in the same click instead of waiting for an async rejection.
- Capture payload version is now 2.4.

Preserved:
- V78.8.31 Edit Product save/category dropdown fixes.
- Flipkart selected-product price hardening.
- Premium Product Image system and all other locked systems.
