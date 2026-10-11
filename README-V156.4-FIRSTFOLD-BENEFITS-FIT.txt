PricePulse Plus V78.8.156.4 — first-view and next-section fitting
Based ONLY on V78.8.156.3-value-strip-layout-fix.

Requested: First desktop view shows the full approved Hero + floating 3D Value Strip.
The next “Four ways Plus gives you more” section begins after the first view,
so its heading does not peek in cut-off at the bottom; scrolling reveals the
normal complete section and four benefit cards.

Implementation: desktop-only measurement of real remaining viewport space,
with capped extra min-height on the hero inner container. The extra height is
allocated inside the existing navy hero rather than creating a white empty gap.
At small viewports and on mobile, content scrolls naturally without clipping.

Preserved: premium card, sheen/animation speed, 3D strip, colors, text,
buttons, backend and all other website sections. No CSS, Supabase or admin change.
