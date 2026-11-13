/* PricePulse service worker (AI-1). Needed so phones can install the site and show it in the Share menu.
   It caches NOTHING and never changes a request: every page and price always comes fresh from the network. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{ if(e.request.mode==='navigate')e.respondWith(fetch(e.request)); });
