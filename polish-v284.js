/* PricePulse V284 - "Add to Chrome" button beside the search bar + "Get app" item in menu row 2 (18 Nov 2026). Loaded last. script.js is never changed.
   Add to Chrome: desktop Chrome-family browsers only, hidden as soon as the extension is on the page (<html data-pp-ext>, set by the extension's bridge.js).
   Get app: same look as Home / Coupons / Price check. Link = Admin > Growth > "Android app link" (setting "apps"); empty = "Soon" tag, like Gift cards.
   Chrome link = Admin > Growth > "Chrome Web Store link" (setting "apps", extension_url); empty = a short "coming soon" note. */
(function(){
'use strict';
const H=(window.ppLinkKit&&window.ppLinkKit.H)||(s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
let apps={};
const okUrl=u=>/^https:\/\//i.test(String(u||''));
const hasExt=()=>!!document.documentElement.dataset.ppExt;
const chromeFamily=()=>!!window.chrome&&!/Mobi|Android|iPhone|iPad|Firefox/i.test(navigator.userAgent);
const desktop=()=>matchMedia('(min-width:1024px)').matches&&chromeFamily();

const CHROME='<svg width="38" height="38" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M4.94 13A22 22 0 0 1 43.06 13H24A11 11 0 0 0 14.47 29.5Z"/><path fill="#FBBC05" d="M43.06 13A22 22 0 0 1 24 46L33.53 29.5A11 11 0 0 0 24 13Z"/><path fill="#34A853" d="M24 46A22 22 0 0 1 4.94 13L14.47 29.5A11 11 0 0 0 33.53 29.5Z"/><circle cx="24" cy="24" r="10.5" fill="#fff"/><circle cx="24" cy="24" r="8" fill="#4285F4"/></svg>';
const PHONE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>';

let toastT=0;
function toast(msg){
  let t=document.getElementById('pp84Toast');
  if(!t){document.body.insertAdjacentHTML('beforeend','<div class="pp84-toast" id="pp84Toast" role="status" aria-live="polite"></div>');t=document.getElementById('pp84Toast');}
  t.textContent=msg;t.classList.add('is-on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('is-on'),3200);
}

/* ---------- Add to Chrome, beside the search bar ---------- */
function chromeBtn(){
  /* the one search bar (#siteSearch) moves between places: home row, the floating search panel, the Price check page. The button follows it. */
  const box=document.getElementById('siteSearch');
  const wrap=document.getElementById('pp84Chrome');
  const vis=!!box&&box.getBoundingClientRect().width>200;
  const show=vis&&desktop()&&!hasExt();
  if(!show){
    if(wrap){wrap.parentElement&&wrap.parentElement.classList.remove('pp84-has');wrap.remove();}
    document.documentElement.classList.remove('pp84-bar');
    return;
  }
  const cont=box.parentElement;
  if(wrap&&wrap.parentElement===cont){document.documentElement.classList.add('pp84-bar');return;}
  if(wrap){wrap.parentElement&&wrap.parentElement.classList.remove('pp84-has');wrap.remove();}
  const a=okUrl(apps.extension_url)
    ?`<a class="pp84-chrome-btn" href="${H(apps.extension_url)}" target="_blank" rel="noopener">${CHROME}<span>Add to Chrome</span></a>`
    :`<button type="button" class="pp84-chrome-btn" data-pp84-soon="ext">${CHROME}<span>Add to Chrome</span></button>`;
  cont.classList.add('pp84-has');
  cont.insertAdjacentHTML('beforeend',`<div class="pp84-chrome" id="pp84Chrome">${a}</div>`);
  document.documentElement.classList.add('pp84-bar');
}

/* ---------- Get app, menu row 2 (same markup as Home / Coupons / Price check) ---------- */
function getApp(){
  const nav=document.querySelector('.category-nav');if(!nav||!nav.querySelector('.pp-mnav'))return;
  const have=document.getElementById('pp84App');
  const live=okUrl(apps.android_url);
  if(have){
    const isLink=have.tagName==='A';
    if(isLink===live)return;
    have.remove();
  }
  const dl=nav.querySelector('.deals-nav');
  const inner=`<span class="pp-mnav-ic">${PHONE}</span><span>Get app</span>${live?'':'<em class="pp-soon">Soon</em>'}`;
  const html=live
    ?`<a class="pp-mnav" id="pp84App" href="${H(apps.android_url)}" target="_blank" rel="noopener">${inner}</a>`
    :`<button type="button" class="pp-mnav" id="pp84App" data-pp84-soon="app">${inner}</button>`;
  if(dl)dl.insertAdjacentHTML('beforebegin',html);else nav.insertAdjacentHTML('beforeend',html);
}

document.addEventListener('click',e=>{
  const s=e.target.closest&&e.target.closest('[data-pp84-soon]');if(!s)return;
  e.preventDefault();
  toast(s.dataset.pp84Soon==='app'?'The PricePulse Android app is coming soon.':'The Chrome extension is coming soon to the Chrome Web Store.');
});

function all(){try{chromeBtn();}catch(_){}try{getApp();}catch(_){}}
let t=0;
const tick=()=>{t=0;all();};
new MutationObserver(()=>{if(!t)t=requestAnimationFrame(tick);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(tick,120));
window.addEventListener('resize',()=>{clearTimeout(all._t);all._t=setTimeout(all,200);});
window.addEventListener('message',e=>{if(e.source===window&&e.data&&e.data.pp==='ext'&&e.data.type==='pp-hello')setTimeout(all,50);});
(async()=>{try{const s=window.PPData&&window.PPData.settings?await window.PPData.settings():null;if(s&&s.apps&&typeof s.apps==='object')apps=s.apps;}catch(_){}
  document.getElementById('pp84App')?.remove();all();})();
all();
})();
