/* PricePulse V280 (1 Nov 2026) - polish stage 1.
   L28/L30 menu: only the open page's item is active; on Home nothing is active (not even Home). */
(function(){
'use strict';
function menuActive(){
  const r=((location.hash||'').match(/^#\/?([a-z-]+)/)||[])[1]||'';
  document.querySelectorAll('[data-pp-mnav]').forEach(a=>{const on=a.dataset.ppMnav===r;a.classList.toggle('is-on',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const dl=document.querySelector('.category-nav .deals-nav');if(dl)dl.classList.toggle('is-on',r==='deals');
  const h=document.getElementById('homeNavBtn');if(h)h.classList.remove('is-on');
}
let q=0;const later=()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;menuActive();});};
window.addEventListener('hashchange',later);
window.addEventListener('popstate',later);
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.category-nav,.pp-bn,.brand,[data-ppf-home],[data-pp-home]')){setTimeout(menuActive,40);setTimeout(menuActive,300);}},true);
new MutationObserver(later).observe(document.body,{attributes:true,attributeFilter:['class']});

/* L3/L4 (V281) Price Check store list: only the TOP stores, one line, each in a white box (logo + name). No labels. */
const PASTE=['Amazon','Flipkart','Croma','Myntra','Vijay Sales','Nykaa','Reliance Digital','AJIO','Tata CLiQ'];
const nk=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const esc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function mark(n){const ic=window.ppStoreIcon?window.ppStoreIcon(n):'';return '<span class="ppf-sm">'+(ic?'<img class="pp79-sic" data-pp79="1" src="'+esc(ic)+'" alt="">':'')+'<b>'+esc(n)+'</b></span>';}
function fillStores(){
  document.querySelectorAll('[data-pp80-stores]:not([data-done])').forEach(el=>{
    if(!(window.ppStoreList||[]).length)return;
    el.dataset.done='1';
    el.innerHTML='<div class="ppf-sg"><div class="ppf-sg-r">'+PASTE.map(mark).join('')+'</div></div>';
  });
}
new MutationObserver(fillStores).observe(document.body,{childList:true,subtree:true});
fillStores();

/* L1/L2 (V281) "Works with" circles: every store in turns (not only the first 12), logos overlap a little */
function fillWorks(){
  const list=(window.ppStoreList||[]).filter(x=>x.icon);if(!list.length)return;
  document.querySelectorAll('.pp-ob-works:not([data-pp81])').forEach(w=>{
    const slots=[...w.querySelectorAll('.pp-ob-ic')];if(!slots.length)return;
    w.dataset.pp81='1';
    slots.forEach(sl=>{sl.innerHTML=list.map((x,k)=>'<img class="pp79-sic'+(k===0?' is-on':'')+'" data-pp79="1" src="'+esc(x.icon)+'" alt="'+esc(x.name)+'">').join('');});
    const st=Math.max(1,Math.floor(list.length/slots.length));
    slots.forEach((sl,i)=>[...sl.children].forEach((im,k)=>im.classList.toggle('is-on',k===(i*st)%list.length)));
  });
}
new MutationObserver(fillWorks).observe(document.body,{childList:true,subtree:true});
fillWorks();

/* L42 sentence case: fixed labels written in Title Case / ALL CAPS in older files. Brand, store and product names are never touched. */
const CASE={'Deal Alerts':'Deal alerts','Sign In':'Sign in','All Categories':'All categories','Gift Cards':'Gift cards','Price Check':'Price check','Live Deals':'Live deals','Compare Prices':'Compare prices',
 'Trusted Deals':'Trusted deals','Save Time':'Save time','Shop by Brand':'Shop by brand','Shop by Store':'Shop by store','Price History':'Price history','Today\'s Deals':'Today\'s deals','Get The App':'Get the app','Coming Soon':'Coming soon','Quick Links':'Quick links','Affiliate Disclosure':'Affiliate disclosure','Follow Us':'Follow us','Privacy Policy':'Privacy policy','Terms of Service':'Terms of service','Contact Us':'Contact us','About Us':'About us','Help Center':'Help center','Deal Radar':'Deal radar'};
const BADGE='.ppx-dx-tag,.ppx-v-pre,.ppx-tag,.ppx-badge,.ppx-hero-kicker,.ppx-verdict,.ppx-pc-verdict,.ppx-tile-badge,.ppx-dx-low,.pp-sale-chip,.ppf-okind';
const KEEP=/^(EMI|UPI|OTP|FAQ|AI|GST|SBI|HDFC|ICICI|AMEX|NEW|SOON|FREE)$/;
function sentence(t){return t.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g,(m,a,b)=>a+b.toUpperCase()).replace(/^(\W*)([a-z])/,(m,a,b)=>a+b.toUpperCase()).replace(/\b(emi|upi|otp|faq|gst|sbi|hdfc|icici|amex|ai)\b/g,x=>x.toUpperCase()).replace(/\bpricepulse\b/g,'PricePulse');}
const EMO={'🏷':'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12.5V4h8.5L21 13.5 13.5 21z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>','🏦':'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>','🎁':'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8h14v-8M12 8c-2.5 0-4-1-4-2.5S9.5 3 11 4.2 12 8 12 8zm0 0c2.5 0 4-1 4-2.5S14.5 3 13 4.2 12 8 12 8z"/></svg>','💳':'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/></svg>','🔥':'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3.5 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4 .2 1.3.8 2 1.6 2.4C10.2 8.6 10.6 5.5 12 3z"/></svg>','🔔':'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg>','📈':'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l5-5 4 3 8-9M15 6h5v5"/></svg>','⚡':'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/></svg>','🛒':'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.5l2 11h10l2-8H7M9 20a1 1 0 1 0 0 .01M17 20a1 1 0 1 0 0 .01"/></svg>'};
const EMO_RX=new RegExp(Object.keys(EMO).join('|'),'g');

function emojiToIcons(root){
  const w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentElement;return p&&!/SCRIPT|STYLE|TEXTAREA|INPUT|OPTION/.test(p.tagName)&&EMO_RX.test(n.nodeValue)?(EMO_RX.lastIndex=0,NodeFilter.FILTER_ACCEPT):(EMO_RX.lastIndex=0,NodeFilter.FILTER_REJECT);}});
  const list=[];let n;while(n=w.nextNode())list.push(n);
  list.forEach(t=>{const frag=document.createDocumentFragment();let last=0;const s=t.nodeValue;s.replace(EMO_RX,(m,i)=>{if(i>last)frag.append(s.slice(last,i));const e=document.createElement('i');e.className='ppf-ei';e.innerHTML=EMO[m];frag.append(e);last=i+m.length;return m;});if(last<s.length)frag.append(s.slice(last));t.replaceWith(frag);});
}
function fixText(root){
  const w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentElement;return p&&!/SCRIPT|STYLE|TEXTAREA|INPUT/.test(p.tagName)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
  let n;while(n=w.nextNode()){
    const raw=n.nodeValue,t=raw.trim();if(!t)continue;
    if(CASE[t]){n.nodeValue=raw.replace(t,CASE[t]);continue;}
    const p=n.parentElement;
    if(p.closest(BADGE)){const L=t.replace(/[^A-Za-z]/g,'');if(L.length>=5&&L===L.toUpperCase()&&!KEEP.test(L))n.nodeValue=raw.replace(t,sentence(t));}
  }
  emojiToIcons(root);
  document.querySelectorAll('[aria-label]').forEach(e=>{const a=e.getAttribute('aria-label');if(CASE[a])e.setAttribute('aria-label',CASE[a]);});
}
let tq=0;const textLater=()=>{if(tq)return;tq=requestAnimationFrame(()=>{tq=0;try{fixText();}catch(_){}});};
new MutationObserver(textLater).observe(document.body,{childList:true,subtree:true,characterData:true});
fixText();

/* L32 Deal Radar "Biggest total saving": the global image system writes inline "width:148px!important;height:148px!important" on the photo (an inline !important cannot be beaten from CSS),
   so the box looked tall with a small photo inside. Make the photo follow its own shape and the white box hug it. */
function hugRadar(){
  document.querySelectorAll('.pp-lf-top .ph img:not([data-pp80h])').forEach(img=>{
    img.dataset.pp80h='1';
    const set=()=>{img.style.setProperty('width','auto','important');img.style.setProperty('height','100%','important');img.style.setProperty('max-width','100%','important');img.style.setProperty('max-height','100%','important');};
    set();new MutationObserver(()=>{if(img.style.width!=='auto'||img.style.height!=='100%')set();}).observe(img,{attributes:true,attributeFilter:['style']});
  });
}
new MutationObserver(hugRadar).observe(document.body,{childList:true,subtree:true});
hugRadar();

/* ===== L41 phone: product page ===== */
const mq=window.matchMedia('(max-width:760px)');
function mobProduct(){
  if(!mq.matches)return;
  /* 1. Save / Share / Compare = icon buttons on the right of the title row */
  document.querySelectorAll('.ppx-identity:not([data-pp80t])').forEach(id=>{
    const h=id.querySelector('h1'),act=id.querySelector('.ppx-id-actions');if(!h||!act)return;
    id.dataset.pp80t='1';
    const row=document.createElement('div');row.className='pp80-titlerow';h.before(row);row.append(h,act);
  });
  /* 2. collapsible sections: long panels start folded on a phone */
  document.querySelectorAll('.ppx-product .ppx-panel:not([data-pp80c]),.ppx-product .ppx-xc:not([data-pp80c])').forEach(sec=>{
    if(sec.matches('.ppx-gallery,.ppx-side,.ppx-alert,.ppx-acc-links,.ppx-acc-details'))return;
    if(sec.matches('.ppx-xc'))return;
    sec.dataset.pp80c='1';
    const head=sec.querySelector(':scope > .ppx-panel-head, :scope > h2, :scope > .ppx-hist-top, :scope .ppf-stk-s>h3');
    if(!head||sec.matches('.ppx-stores'))return; /* store prices stay open */
    sec.classList.add('pp80-fold');
    const open=sec.matches('.ppx-history')?false:false;
    sec.classList.toggle('is-folded',!open);
    head.classList.add('pp80-fold-h');head.setAttribute('role','button');head.setAttribute('tabindex','0');head.setAttribute('aria-expanded',String(open));
    const tog=()=>{const f=sec.classList.toggle('is-folded');head.setAttribute('aria-expanded',String(!f));};
    head.addEventListener('click',e=>{if(e.target.closest('a,button:not(.pp80-fold-h)'))return;tog();});
    head.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tog();}});
  });
  /* 3. sticky buy bar (shown once the big Buy button has scrolled out of view) */
  const hero=document.querySelector('.ppx-hero-actions .ppx-btn-primary');
  let bar=document.getElementById('pp80Buy');
  if(!hero||!document.querySelector('.ppx-product')){if(bar)bar.remove();return;}
  const price=(document.querySelector('.ppx-hero-price')||{}).textContent||'';
  const pm=price.match(/₹\s?[\d,]+/);const label=(hero.textContent||'').replace(/\s+/g,' ').trim();
  const store=(label.match(/on\s+(.+?)\s*$/i)||[])[1]||'';
  if(!bar){bar=document.createElement('div');bar.id='pp80Buy';bar.className='pp80-buybar';document.body.appendChild(bar);
    bar.addEventListener('click',e=>{const b=e.target.closest('button');if(b){const h=document.querySelector('.ppx-hero-actions .ppx-btn-primary');if(h)h.click();}});}
  const html='<div><small>Best verified price</small><b>'+esc(pm?pm[0]:'')+'</b></div><button type="button">'+esc(store?'Buy on '+store:'View deal')+' <span aria-hidden="true">↗</span></button>';
  if(bar.dataset.h!==html){bar.dataset.h=html;bar.innerHTML=html;}
  if(!bar._io){bar._io=new IntersectionObserver(es=>{es.forEach(e=>bar.classList.toggle('is-on',!e.isIntersecting&&e.boundingClientRect.top<0));},{threshold:0});}
  if(bar._t!==hero){bar._t=hero;bar._io.disconnect();bar._io.observe(hero);}
}
let mpq=0;new MutationObserver(ms=>{if(ms.every(m=>m.target.id==='pp80Buy'||(m.target.closest&&m.target.closest('#pp80Buy'))))return;if(mpq)return;mpq=requestAnimationFrame(()=>{mpq=0;if(!document.querySelector('.ppx-product')){const b=document.getElementById('pp80Buy');if(b)b.classList.remove('is-on');}mobProduct();});}).observe(document.body,{childList:true,subtree:true});
mq.addEventListener&&mq.addEventListener('change',mobProduct);
mobProduct();

/* V281 L7: arrow on phone swipe rows (Popular deals, Live deals sections): shows while more cards are to the right */
const ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
const phone=window.matchMedia('(max-width:760px)');
function place(b){const g=b._g;if(!g||!g.isConnected){b.remove();return;}
  const more=phone.matches&&g.scrollWidth-g.clientWidth-g.scrollLeft>8&&g.children.length>1;
  b.classList.toggle('is-on',more);b.style.top=(g.offsetTop+g.offsetHeight/2-17)+'px';}
function rowArrows(){
  document.querySelectorAll('.pp81-next').forEach(b=>{if(!b._g||!b._g.isConnected)b.remove();});
  document.querySelectorAll('#deals.ppx-pc-section .deal-grid[data-pp-swipe], .ppx-deals-page .ppx-dl-grid').forEach(g=>{
    if(g._pp81){place(g._pp81);return;}
    const b=document.createElement('button');b.type='button';b.className='pp81-next';b.setAttribute('aria-label','Next cards');b.innerHTML=ARROW;b._g=g;g._pp81=b;
    g.parentElement.appendChild(b);
    b.addEventListener('click',()=>g.scrollBy({left:Math.round(g.clientWidth*.84),behavior:'smooth'}));
    g.addEventListener('scroll',()=>place(b),{passive:true});
    place(b);
  });
}
let raq=0;const arrowsLater=()=>{if(raq)return;raq=requestAnimationFrame(()=>{raq=0;rowArrows();});};
new MutationObserver(arrowsLater).observe(document.body,{childList:true,subtree:true});
window.addEventListener('resize',arrowsLater);
phone.addEventListener&&phone.addEventListener('change',arrowsLater);
rowArrows();

/* V281 L10: on tablet + phone the "Shop by brand / Shop by store" buttons live inside the spotlight row (right side of the first card); back in the head above 1100px */
const tabletMq=window.matchMedia('(max-width:1100px)');
function moveTabs(){
  const sec=document.getElementById('ppxDiscover');if(!sec)return;
  const tools=sec.querySelector('.ppx-discover-tools'),row=sec.querySelector('.ppx-dx-row'),head=sec.querySelector('.ppx-discover-head');
  if(!tools||!row||!head)return;
  if(tabletMq.matches){if(tools.parentElement!==row)row.prepend(tools);}
  else if(tools.parentElement!==head)head.appendChild(tools);
}
let mtq=0;const tabsLater=()=>{if(mtq)return;mtq=requestAnimationFrame(()=>{mtq=0;moveTabs();});};
new MutationObserver(tabsLater).observe(document.body,{childList:true,subtree:true});
tabletMq.addEventListener&&tabletMq.addEventListener('change',tabsLater);
moveTabs();
menuActive();
})();
