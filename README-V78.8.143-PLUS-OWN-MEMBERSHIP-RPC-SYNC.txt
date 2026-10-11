PricePulse V78.8.143 — Plus live database read sync

Scope only:
- Website Plus status now reads the signed-in user's own membership through pp_get_my_plus_membership().
- The RPC is scoped to auth.uid(); users cannot request another user's membership.
- Master Plus still uses the existing protected RPC.
- Local/test Plus state cannot override a successful production backend read.
- script.js cache tag bumped to V78.8.143.

Existing V141 database:
Run ONLY supabase-plus-v143-own-read-rpc.sql once in Supabase SQL Editor.
Do NOT rerun older Plus/Wallet drafts.

Then reopen/refresh V78.8.143 index.html while signed into the user that Admin shows ACTIVE.
Expected: Hi, Name ★ / gold star / PricePulse Plus / active Plus panel.
