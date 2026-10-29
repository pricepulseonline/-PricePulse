/* PricePulse V278 - site polish batch 3 (30 Oct 2026). Loaded last. script.js is never changed.
   L6 Plus page breadcrumb · L7 Wishlist card layout (price block in its own column) + "All stores" label on alerts
   L8 Chrome extension + mobile app promotion (not forced, dismissible, desktop only for the extension) */
(function(){
'use strict';
const K=window.ppLinkKit||{};
const H=K.H||(s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const BACK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const route=()=>(location.hash.match(/^#\/([a-z-]+)/)||[])[1]||'';

/* ---------- L7: wishlist card = product | price | actions ---------- */
function wishCards(){
  document.querySelectorAll('#ppxWishHost .pp-wish-track-card').forEach(c=>{
    const bp=c.querySelector('.pp-wish-product-main>.pp-wish-best-price');
    if(bp){const main=c.querySelector('.pp-wish-product-main');main.after(bp);}
  });
  document.querySelectorAll('#ppxAlertHost .pp-da-store-fallback').forEach(e=>{if(/^all$/i.test(e.textContent.trim()))e.textContent='All stores';});
}
/* ---------- L6: Plus page gets the same slim breadcrumb row ---------- */
function plusCrumbs(){
  if(route()!=='plus')return;
  const pg=document.getElementById('ppPlusPage');if(!pg||pg.querySelector(':scope>.pp78-crumbs'))return;
  pg.insertAdjacentHTML('afterbegin',`<nav class="ppx-crumbs pp78-crumbs" aria-label="Breadcrumb"><a href="#home" class="ppx-back" data-ppx-action="back">${BACK}Back</a><span>/</span><span class="is-current">PricePulse Plus</span></nav>`);
}

/* ---------- L8: Chrome extension + mobile app promotion ----------
   Never forced, every piece can be closed. Extension = desktop only, hidden once the extension is on the page
   (<html data-pp-ext>). App = phones only. Links come from Admin (setting "apps": extension_url, android_url);
   without a link the button says "Coming soon". */
let apps={};
const store=k=>{try{return localStorage.getItem(k);}catch(_){return null;}};
const keep=(k,v)=>{try{localStorage.setItem(k,v);}catch(_){}};
const hasExt=()=>!!document.documentElement.dataset.ppExt;
const desktop=()=>matchMedia('(min-width:1024px)').matches&&!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const phone=()=>matchMedia('(max-width:760px)').matches;
const okUrl=u=>/^https:\/\//i.test(String(u||''));
const IC={ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3h7z"/></svg>',
  app:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'};
const extBtn=(cls)=>okUrl(apps.extension_url)?`<a class="${cls}" href="${H(apps.extension_url)}" target="_blank" rel="noopener">Add to Chrome, it's free</a>`:`<span class="${cls} is-soon">Coming soon</span>`;
const appBtn=(cls)=>okUrl(apps.android_url)?`<a class="${cls}" href="${H(apps.android_url)}" target="_blank" rel="noopener">Get the app</a>`:`<span class="${cls} is-soon">Coming soon</span>`;
function headerLink(){
  const act=document.querySelector('.site-header .header-actions');if(!act)return;
  let a=document.getElementById('pp78ExtTop');
  const show=desktop()&&!hasExt();
  if(!show){a&&a.remove();return;}
  if(a)return;
  const plus=document.getElementById('ppGetPlusChip')||document.getElementById('signInBtn');
  a=document.createElement('button');a.type='button';a.id='pp78ExtTop';a.className='header-link pp78-ext-top';a.setAttribute('aria-haspopup','dialog');
  a.innerHTML=`<span class="pp78-ext-ic">${IC.ext}</span><span>Get extension</span>`;
  if(plus&&plus.parentElement===act)act.insertBefore(a,plus);else act.appendChild(a);
}
function popHTML(){
  return `<div class="pp78-pop" role="dialog" aria-label="Get PricePulse"><button type="button" class="pp78-x" data-pp78-x aria-label="Close">${IC.x}</button>
    <div class="pp78-pop-row"><span class="pp78-pop-ic">${IC.ext}</span><div><b>PricePulse for Chrome</b><small>See verified prices from other stores right on Amazon, Flipkart, Croma and more.</small></div></div>
    <div class="pp78-pop-act">${extBtn('pp78-btn is-go')}<a class="pp78-btn" href="#/welcome">What it does</a></div>
    <div class="pp78-pop-row is-app"><span class="pp78-pop-ic">${IC.app}</span><div><b>PricePulse Android app</b><small>Deals and price alerts on your phone.</small></div>${appBtn('pp78-btn is-sm')}</div></div>`;
}
function togglePop(btn){
  const old=document.querySelector('.pp78-pop');if(old){old.remove();return;}
  document.body.insertAdjacentHTML('beforeend',popHTML());
  const p=document.querySelector('.pp78-pop'),r=btn.getBoundingClientRect();
  p.style.top=Math.round(r.bottom+10)+'px';p.style.left=Math.round(Math.max(12,Math.min(innerWidth-p.offsetWidth-12,r.right-p.offsetWidth)))+'px';
}
function homeStrip(){
  const old=document.getElementById('pp78Strip');
  const home=!location.hash||/^#(home)?$/.test(location.hash);
  const kind=desktop()&&!hasExt()?'ext':phone()?'app':'';
  if(!home||!kind||store('pp78Strip_'+kind)==='x'||document.body.classList.contains('pp-page-mode')){old&&old.remove();return;}
  if(old&&old.dataset.kind===kind)return;old&&old.remove();
  const at=document.getElementById('stores')||document.getElementById('deals');if(!at)return;
  const s=document.createElement('div');s.id='pp78Strip';s.dataset.kind=kind;s.className='container pp78-strip';
  s.innerHTML=kind==='ext'
    ?`<span class="pp78-strip-ic">${IC.ext}</span><span class="pp78-strip-t"><b>PricePulse for Chrome</b> See verified prices from other stores right on the store page.</span>${extBtn('pp78-btn is-go')}<a class="pp78-btn is-ghost" href="#/welcome">Learn more</a><button type="button" class="pp78-x" data-pp78-strip aria-label="Hide">${IC.x}</button>`
    :`<span class="pp78-strip-ic">${IC.app}</span><span class="pp78-strip-t"><b>PricePulse app</b> Deals and price alerts on your phone.</span>${appBtn('pp78-btn is-go')}<button type="button" class="pp78-x" data-pp78-strip aria-label="Hide">${IC.x}</button>`;
  at.before(s);
}
function productCard(){
  const g=document.querySelector('.ppx-product .ppx-gallery');
  const old=document.getElementById('pp78ExtCard');
  if(!g||route()!=='product'||!desktop()||hasExt()||store('pp78ExtCard')==='x'){old&&old.remove();return;}
  if(old&&g.contains(old))return;old&&old.remove();
  g.insertAdjacentHTML('beforeend',`<div class="pp78-card" id="pp78ExtCard"><button type="button" class="pp78-x" data-pp78-card aria-label="Hide">${IC.x}</button>
    <span class="pp78-card-ic">${IC.ext}</span><div><b>See these prices on the store page</b><small>Our free Chrome extension shows verified prices from other stores right on Amazon, Flipkart and Croma.</small><div class="pp78-card-act">${extBtn('pp78-btn is-go is-sm')}<a class="pp78-btn is-sm" href="#/welcome">What it does</a></div></div></div>`);
}
function promos(){try{headerLink();}catch(_){}try{homeStrip();}catch(_){}try{productCard();}catch(_){}}
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('#pp78ExtTop');if(t){e.preventDefault();togglePop(t);return;}
  if(e.target.closest&&e.target.closest('[data-pp78-x]')){document.querySelector('.pp78-pop')?.remove();return;}
  const st=e.target.closest&&e.target.closest('[data-pp78-strip]');if(st){const s=document.getElementById('pp78Strip');if(s){keep('pp78Strip_'+s.dataset.kind,'x');s.remove();}return;}
  if(e.target.closest&&e.target.closest('[data-pp78-card]')){keep('pp78ExtCard','x');document.getElementById('pp78ExtCard')?.remove();return;}
  const pop=document.querySelector('.pp78-pop');if(pop&&!pop.contains(e.target))pop.remove();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.pp78-pop')?.remove();});
window.addEventListener('message',e=>{if(e.source===window&&e.data&&e.data.pp==='ext'&&e.data.type==='pp-hello')setTimeout(promos,50);});
window.addEventListener('hashchange',()=>{document.querySelector('.pp78-pop')?.remove();setTimeout(promos,120);});
window.addEventListener('resize',()=>{clearTimeout(promos._t);promos._t=setTimeout(promos,200);});
(async()=>{try{const s=window.PPData&&window.PPData.settings?await window.PPData.settings():null;if(s&&s.apps&&typeof s.apps==='object')apps=s.apps;}catch(_){}
  document.getElementById('pp78Strip')?.remove();document.getElementById('pp78ExtCard')?.remove();promos();})();

let t=0;
function tick(){t=0;try{wishCards();}catch(_){}try{plusCrumbs();}catch(_){}try{promos();}catch(_){}}
new MutationObserver(()=>{if(!t)t=requestAnimationFrame(tick);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(tick,80));
tick();
})();
