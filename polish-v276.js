/* PricePulse V276 - site polish (29 Oct 2026)
   P1  Header row 1: Logo | Search | Wishlist | Deal Alerts | (space) | Get Plus | Sign in
   P2  Menu row 2: Home · All Categories · Sales · Coupons · Gift Cards (Soon) · Price Check · (space) · Live Deals
       + Sales page (#/sales, #/sales/<id>) with the store's theme, + Gift Cards page (#/gift-cards, notify me)
   P5  Search button opens the one search box as a panel on pages where the box is hidden
   Loaded after compare-v251.js. script.js is never changed. */
(function(){
'use strict';
const K=window.ppLinkKit||{};
const H=K.H||(s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const M=K.M||(n=>'₹'+Math.round(n).toLocaleString('en-IN'));
document.body.classList.add('pp-v276');

const SVG={
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  sale:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11V4h7l10 10-7 7z"/><path d="m14 7 3 3"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  coupon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M10 9.5h.01M14 14.5h.01M14.5 9l-5 6"/></svg>',
  gift:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9M7.5 8a2.5 2.5 0 1 1 4.5-1.5V8M16.5 8A2.5 2.5 0 1 0 12 6.5"/></svg>',
  chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19h16"/><path d="m5 15 4-4 3 3 6-7"/><path d="M15 7h3v3"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};

/* ---------------- P1: header row 1 ---------------- */
function header(){
  const act=document.querySelector('.site-header .header-actions');if(!act)return;
  if(!document.getElementById('ppSearchTop')){
    const b=document.createElement('button');
    b.type='button';b.id='ppSearchTop';b.className='header-link pp-search-link';
    b.setAttribute('aria-label','Search products or paste a store link');
    b.innerHTML=`<span class="pp-search-ic">${SVG.search}</span><span>Search</span>`;
    act.prepend(b);
  }
  const deal=document.getElementById('dealTop');
  if(deal){
    const lab=[...deal.children].find(n=>n.tagName==='SPAN'&&!n.classList.contains('deal-bell'));
    if(lab&&lab.textContent.trim()==='Deal')lab.textContent='Deal Alerts';
    deal.setAttribute('aria-label','Deal Alerts');
    if(!act.querySelector('.pp-hdr-space'))deal.insertAdjacentHTML('afterend','<span class="pp-hdr-space" aria-hidden="true"></span>');
  }
}

/* ---------------- P2: menu row 2 ---------------- */
const MENU=[['sales','Sales','#/sales',SVG.sale,''],['offers','Coupons','#/offers',SVG.coupon,''],['gift-cards','Gift Cards','#/gift-cards',SVG.gift,'Soon'],['find','Price Check','#/find',SVG.chart,'']];
function menu(){
  const nav=document.querySelector('.category-nav');if(!nav||nav.querySelector('.pp-mnav'))return;
  const allBtn=document.getElementById('allCategoriesBtn');
  const html=MENU.map(([k,t,h,ic,tag])=>`<a class="pp-mnav" href="${h}" data-ppf-top="${k}" data-pp-mnav="${k}"><span class="pp-mnav-ic">${ic}</span><span>${t}</span>${tag?`<em class="pp-soon">${tag}</em>`:''}</a>`).join('')+'<span class="pp-mnav-space" aria-hidden="true"></span>';
  (allBtn||nav.firstElementChild).insertAdjacentHTML('afterend',html);
  const dl=nav.querySelector('.deals-nav');
  if(dl){dl.innerHTML='<i class="pp-live-dot" aria-hidden="true"></i><span>Live Deals</span>';dl.setAttribute('aria-label','Live Deals');nav.appendChild(dl);}
  active();
}
function active(){
  const r=(location.hash.match(/^#\/([a-z-]+)/)||[])[1]||'';
  document.querySelectorAll('[data-pp-mnav]').forEach(a=>{const on=a.dataset.ppMnav===r;a.classList.toggle('is-on',on);a.toggleAttribute('aria-current',on);});
  const dl=document.querySelector('.category-nav .deals-nav');if(dl)dl.classList.toggle('is-on',r==='deals');
}
window.addEventListener('hashchange',active);

/* ---------------- P5: search panel ---------------- */
function boxVisible(){return !document.body.classList.contains('pp-box-off');}
function openSearch(){
  const b=document.body,inp=document.getElementById('searchInput');if(!inp)return;
  if(boxVisible()){
    const r=inp.getBoundingClientRect();
    if(r.top<0||r.bottom>innerHeight)inp.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>inp.focus(),120);return;
  }
  const hdr=document.querySelector('.site-header');
  b.style.setProperty('--pp-hdr-b',Math.max(0,Math.round(hdr?hdr.getBoundingClientRect().bottom:64))+'px');
  b.classList.add('pp-search-open');
  if(!document.querySelector('.pp-search-scrim'))b.insertAdjacentHTML('beforeend','<div class="pp-search-scrim" data-pp-search-x></div>');
  /* V277 (P20): only the bar - no title / help line; a small X inside the bar closes it */
  const form=document.getElementById('siteSearch');
  if(form&&!form.querySelector('.pp-ob-x'))form.insertAdjacentHTML('beforeend',`<button type="button" class="pp-ob-x" data-pp-search-x aria-label="Close search">${SVG.close}</button>`);
  setTimeout(()=>{inp.focus();inp.ppfPlace?.();},60);
}
function closeSearch(){
  document.body.classList.remove('pp-search-open');
  document.querySelectorAll('.pp-search-scrim').forEach(x=>x.remove());
}
document.addEventListener('click',e=>{
  if(e.target.closest&&e.target.closest('#ppSearchTop')){e.preventDefault();document.body.classList.contains('pp-search-open')?closeSearch():openSearch();return;}
  if(e.target.closest&&e.target.closest('[data-pp-search-x]')){closeSearch();return;}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('pp-search-open'))closeSearch();});
window.addEventListener('hashchange',closeSearch);
document.addEventListener('submit',e=>{if(e.target&&e.target.id==='siteSearch')setTimeout(closeSearch,50);},true);
/* the box can come back (page change) while the panel is open: close the panel then */
new MutationObserver(()=>{if(document.body.classList.contains('pp-search-open')&&boxVisible())closeSearch();}).observe(document.body,{attributes:true,attributeFilter:['class']});

/* ---------------- P2: Sales page ---------------- */
/* Store colours: Admin can set them per sale (theme colour + dark shade); these are the defaults. */
const STORE_THEME={amazon:['#F28A1E','#1D1D1D'],flipkart:['#FFD23F','#1D3FA8'],myntra:['#E6256B','#6E1040'],nykaa:['#E80071','#5A0E33'],nykaafashion:['#E80071','#5A0E33'],
  ajio:['#2C4152','#0E1C26'],tatacliq:['#DA1C5C','#2B0F1C'],croma:['#12DAA8','#0B2A26'],vijaysales:['#E5343A','#3A0C0E'],reliancedigital:['#E42529','#2A0B0C'],meesho:['#9F2089','#3B0C33'],jiomart:['#0078AD','#062B3D'],shopsy:['#7B2FF7','#2A0F55']};
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const okHex=c=>/^#[0-9a-f]{6}$/i.test(String(c||'').trim());
function themeOf(s){const d=STORE_THEME[norm(s.store)]||['#3DDC97','#0F1F1A'];return [okHex(s.theme_color)?s.theme_color:d[0],okHex(s.theme_dark)?s.theme_dark:d[1]];}
function ink(hex){const n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;return (0.299*r+0.587*g+0.114*b)>150?'#14110A':'#FFFFFF';}
const DAY=864e5;
function stateOf(s,now=Date.now()){const a=Date.parse(s.starts_at),b=Date.parse(s.ends_at);return b<now?'ended':a<=now?'live':'upcoming';}
function when(s){
  const now=Date.now(),a=Date.parse(s.starts_at),b=Date.parse(s.ends_at),st=stateOf(s,now);
  const left=t=>{const d=Math.floor(t/DAY),h=Math.floor(t%DAY/36e5);return d>0?`${d}d ${h}h`:`${Math.max(1,h)}h`;};
  const dt=t=>new Date(t).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  if(st==='live')return {st,chip:'Live now',line:`Ends in ${left(b-now)} · ${dt(b)}`};
  if(st==='upcoming'){const d=Math.ceil((a-now)/DAY);return {st,chip:d<=1?'Starts tomorrow':`Starts in ${d} days`,line:`${dt(a)} – ${dt(b)}`};}
  return {st,chip:'Ended',line:`Ended ${dt(b)}`};
}
let salesP=null,sales=[];
function loadSales(force){
  if(salesP&&!force)return salesP;
  salesP=(async()=>{
    try{
      if(typeof supabaseClient==='undefined'||!supabaseClient)return [];
      let r=await supabaseClient.rpc('pp_public_sales_v276');
      if(r.error){r=await supabaseClient.rpc('pp_public_sale_events');} /* before the V276 SQL is run: old list (no colours/links) */
      return r.error||!Array.isArray(r.data)?[]:r.data;
    }catch(_){return [];}
  })().then(l=>{sales=l.filter(s=>s&&s.id&&s.title&&s.starts_at&&s.ends_at);return sales;});
  return salesP;
}
const logo=s=>{const kit=window.ppOffersKit;return kit?kit.logo(s):`<b>${H(s)}</b>`;};
const label=s=>{const kit=window.ppOffersKit;return kit?kit.storeLabel(s):String(s||'');};
const crumbs=(items)=>`<nav class="ppx-crumbs" aria-label="Breadcrumb"><a href="#home" class="ppx-back" data-ppx-action="back">${K.ICON&&K.ICON.back||'‹'}Back</a>${items.map((t,i)=>i<items.length-1&&t[1]?`<span>/</span><a href="${t[1]}">${H(t[0])}</a>`:`<span>/</span><span class="is-current">${H(t[0])}</span>`).join('')}</nav>`;
function saleCard(s){
  const w=when(s),[c,d]=themeOf(s);
  return `<a class="pp-sale-card is-${w.st}" href="#/sales/${encodeURIComponent(s.id)}" style="--sale-c:${c};--sale-d:${d}">
    <span class="pp-sale-logo">${s.store?logo(s.store):''}</span>
    <span class="pp-sale-chip is-${w.st}">${w.st==='live'?'<i aria-hidden="true"></i>':''}${H(w.chip)}</span>
    <b class="pp-sale-t">${H(s.title)}</b>
    <small class="pp-sale-l">${H(w.line)}</small>
    ${s.note?`<small class="pp-sale-n">${H(s.note)}</small>`:''}
    <em class="pp-sale-go">${w.st==='ended'?'See what dropped':'Open sale'} <i aria-hidden="true">→</i></em>
  </a>`;
}
let saleStore='',saleTab='';
function salesListHTML(){
  const stores=[...new Set(sales.map(s=>s.store).filter(Boolean))];
  const l=sales.filter(s=>!saleStore||norm(s.store)===norm(saleStore));
  const now=Date.now();
  const live=l.filter(s=>stateOf(s,now)==='live'),up=l.filter(s=>stateOf(s,now)==='upcoming'),ended=l.filter(s=>stateOf(s,now)==='ended'&&now-Date.parse(s.ends_at)<30*DAY);
  const sec=(t,sub,list,k)=>list.length&&(!saleTab||saleTab===k)?`<section class="pp-sales-sec"><div class="ppf-cp-sh"><h2>${t} <i>${list.length}</i></h2><p>${sub}</p></div><div class="pp-sales-grid">${list.map(saleCard).join('')}</div></section>`:'';
  const chip=(v,t)=>`<button type="button" class="ppf-lchip${norm(saleStore)===norm(v)?' is-on':''}" data-pp-salestore="${H(v)}">${v?`<span class="ppf-lchip-i">${logo(v)}</span>`:''}<span>${H(t||label(v))}</span></button>`;
  return `<div class="ppx-product ppx-list-page container pp-sales-page">${crumbs([['Sales','']])}
    <div class="pp-head-unit">
      <header class="pp-bar"><div class="pp-bar-copy"><span class="ppx-eyebrow">STORE SALES</span><h1>Big sales, verified prices</h1><p>Official sale dates from each store, and the products whose verified price is the lowest there.</p></div>
        <div class="pp-bar-stats"><div><b>${live.length}</b><span>live now</span></div><div><b>${up.length}</b><span>upcoming</span></div></div></header>
      <div class="pp-panel pp-sales-panel"><div class="pp-tabs" role="tablist" aria-label="Sale status">${[['','All',l.length],['live','Live now',live.length],['upcoming','Upcoming',up.length],['ended','Ended',ended.length]].map(([k,t,n])=>`<button type="button" role="tab" aria-selected="${saleTab===k}" class="pp-tab${saleTab===k?' is-on':''}" data-pp-saletab="${k}"${k&&!n?' disabled':''}>${k==='live'?'<i class="pp-live-dot" aria-hidden="true"></i>':''}${t} <em>${n}</em></button>`).join('')}</div>
        ${stores.length>1?`<div class="ppf-cp-row">${chip('','All stores')}${stores.map(x=>chip(x)).join('')}</div>`:''}</div>
    </div>
    ${sec('Live now','Running right now. Prices on PricePulse are checked by us, not copied from the sale banner.',live,'live')}
    ${sec('Upcoming','Dates announced by the store. We add the deals once the sale starts.',up,'upcoming')}
    ${sec('Recently ended','What the prices did during the sale.',ended,'ended')}
    ${!live.length&&!up.length&&!ended.length?`<div class="ppf-cp-empty"><b>No store sales right now</b><span>Big sales are added here as soon as the store announces the dates. Meanwhile, see today's <a href="#/deals">Live Deals</a>.</span></div>`:''}
    <p class="ppf-off-note">Sale names and dates belong to the stores. PricePulse is not part of the store; links to stores may earn us a commission at no cost to you.</p>
  </div>`;
}
/* products whose verified lowest price right now is on this store */
function saleProducts(store){
  const idx=(K.productIndex&&K.productIndex())||[];
  return idx.map(p=>{
    let b=null;try{b=K.bestPrice(p);}catch(_){return null;}
    const st=b&&b.state||{};const offers=(st.inStock||[]).filter(o=>Number.isFinite(o.price));
    const here=offers.find(o=>norm(o.name)===norm(store));if(!here||!Number.isFinite(b.price)||here.price>b.price)return null;
    let ser=[];try{ser=(K.lowestSeries&&K.lowestSeries(p.id))||[];}catch(_){}
    const pts=ser.filter(x=>Date.now()-x.time<=30*DAY).map(x=>x.price);
    const avg=pts.length?pts.reduce((a,c)=>a+c,0)/pts.length:here.price;
    return {p,price:here.price,below:avg>here.price?Math.round((avg-here.price)/avg*1000)/10:0,cat:String(p.category||'').toLowerCase()};
  }).filter(Boolean).sort((a,b)=>b.below-a.below||a.price-b.price);
}
let saleCat='';
function saleHTML(s){
  const w=when(s),[c,d]=themeOf(s),ci=ink(c);
  const kit=window.ppOffersKit;
  const items=s.store?saleProducts(s.store).filter(x=>w.st!=='live'||x.below>0):[]; /* "price drops" = below its own 30-day average */
  const cats=[...new Set(items.map(x=>x.cat).filter(Boolean))];
  const shown=items.filter(x=>!saleCat||x.cat===saleCat);
  const offers=kit&&s.store?kit.all().filter(o=>kit.sameStore(o.store,s.store)):[];
  const card=x=>typeof window.ppPremiumCardHTML==='function'?window.ppPremiumCardHTML(x.p):'';
  const catName=c=>(K.catLabel?K.catLabel(c):c);
  const link=s.link||'';
  return `<div class="ppx-product ppx-list-page container pp-sales-page pp-sale-one" style="--sale-c:${c};--sale-d:${d};--sale-ink:${ci}">${crumbs([['Sales','#/sales'],[s.title,'']])}
    <div class="pp-head-unit">
      <header class="pp-bar pp-sale-hero">
        <div class="pp-bar-copy">
          <span class="pp-sale-chip is-${w.st}">${w.st==='live'?'<i aria-hidden="true"></i>':''}${H(w.chip)}</span>
          <h1>${H(s.title)}${s.store?` <span class="pp-sale-on">on ${H(label(s.store))}</span>`:''}</h1>
          <p>${H(s.note||'Verified price drops, checked by PricePulse.')}</p>
          <small class="pp-sale-when">${H(w.line)}</small>
        </div>
        <div class="pp-sale-side">${/^https:\/\//i.test(s.banner_url||'')?`<img class="pp-sale-banner" src="${H(s.banner_url)}" alt="" loading="lazy">`:s.store?`<span class="pp-sale-logo is-big">${logo(s.store)}</span>`:''}${link&&w.st!=='ended'?`<a class="pp-sale-shop" href="${H(link)}" target="_blank" rel="sponsored noopener">Shop the sale <i aria-hidden="true">↗</i></a>`:''}</div>
      </header>
      <div class="pp-panel pp-sale-panel">${cats.length>1?`<div class="pp-sale-cats">${[['','All']].concat(cats.map(x=>[x,catName(x)])).map(([v,t])=>`<button type="button" class="pp-sale-cat${saleCat===v?' is-on':''}" data-pp-salecat="${H(v)}">${H(t)}</button>`).join('')}</div>`:`<span class="pp-panel-note">${shown.length} verified ${shown.length===1?'product':'products'}</span>`}
        <span class="pp-panel-acts">${offers.length?`<a class="pp-pbtn" href="#ppSaleOffers" data-pp-jump="ppSaleOffers">🏷 Coupons <em>${offers.length}</em></a>`:''}${link&&w.st!=='ended'?`<a class="pp-pbtn is-go" href="${H(link)}" target="_blank" rel="sponsored noopener">Shop the sale ↗</a>`:''}</span></div>
    </div>
    <section class="pp-sale-zone">
      <div class="pp-sale-zh"><h2>${w.st==='live'?'Top price drops from':w.st==='upcoming'?'Lowest verified prices on':'Lowest verified prices now on'} ${H(label(s.store||'this store'))}</h2><p>${shown.length?`${shown.length} ${shown.length===1?'product':'products'} with the lowest verified price on ${H(label(s.store))}`:'Verified prices only'}</p></div>
      ${shown.length?`<div class="pp-sale-grid">${shown.slice(0,24).map(card).join('')}</div>`:`<div class="pp-sale-empty"><b>No verified price drops from ${H(label(s.store||'this store'))} yet</b><span>We only show prices we have checked. More products are added every day.</span>${link&&w.st!=='ended'?`<a class="pp-sale-shop is-line" href="${H(link)}" target="_blank" rel="sponsored noopener">Open the sale on ${H(label(s.store))} <i aria-hidden="true">↗</i></a>`:''}</div>`}
    </section>
    ${offers.length?`<section class="ppf-cp-sec pp-sale-offers" id="ppSaleOffers"><div class="ppf-cp-sh"><h2><span aria-hidden="true">🏷</span>Coupons and bank offers on ${H(label(s.store))} <i>${offers.length}</i></h2><p>Stack them with the sale price at checkout.</p></div>${kit.scroller(offers.slice(0,14).map(kit.ticket).join(''))}</section>`:''}
    <p class="ppf-off-note">"${H(s.title)}" is the store's own sale. PricePulse is not part of it. Prices shown are verified by PricePulse; the store's checkout price is final.</p>
  </div>`;
}
async function renderSales(param){
  window.ppShowPage('sales','<div class="ppx-product ppx-list-page container"><p class="ppf-muted" style="padding:60px 0;text-align:center">Loading sales…</p></div>');
  await Promise.all([loadSales(),window.ppOffersKit?window.ppOffersKit.load():null]);
  if(!/^#\/sales/.test(location.hash))return;
  if(param){
    const s=sales.find(x=>String(x.id)===String(param));
    if(!s){window.ppShowPage('sales',`<div class="ppx-product ppx-list-page container">${crumbs([['Sales','#/sales'],['Not found','']])}<div class="ppf-cp-empty"><b>This sale is not listed any more</b><span><a href="#/sales">See all store sales</a></span></div></div>`);return;}
    window.ppShowPage('sales',saleHTML(s));document.title=`${s.title} | PricePulse`;
  }else{window.ppShowPage('sales',salesListHTML());document.title='Store sales | PricePulse';}
  window.ppOffersKit&&window.ppOffersKit.markScrollers();
  active();
}
document.addEventListener('click',e=>{
  const st=e.target.closest&&e.target.closest('[data-pp-salestore]');
  if(st){saleStore=st.dataset.ppSalestore;const y=scrollY;window.ppShowPage('sales',salesListHTML());scrollTo(0,y);return;}
  const tb=e.target.closest&&e.target.closest('[data-pp-saletab]');
  if(tb){saleTab=tb.dataset.ppSaletab;const y=scrollY;window.ppShowPage('sales',salesListHTML());scrollTo(0,y);return;}
  const jp=e.target.closest&&e.target.closest('[data-pp-jump]');
  if(jp){const t=document.getElementById(jp.dataset.ppJump);if(t){e.preventDefault();scrollTo({top:t.getBoundingClientRect().top+scrollY-(stickOff()+80),behavior:'smooth'});}return;}
  const ct=e.target.closest&&e.target.closest('[data-pp-salecat]');
  if(ct){saleCat=ct.dataset.ppSalecat;const id=decodeURIComponent((location.hash.split('/')[2]||''));const s=sales.find(x=>String(x.id)===id);if(s){const y=scrollY;window.ppShowPage('sales',saleHTML(s));scrollTo(0,y);window.ppOffersKit&&window.ppOffersKit.markScrollers();}return;}
});
window.addEventListener('hashchange',()=>{if(!/^#\/sales\//.test(location.hash))saleCat='';});

/* ---------------- P2: Gift Cards page (coming soon + notify me) ---------------- */
function giftHTML(){
  const email=(typeof currentUser!=='undefined'&&currentUser&&currentUser.email)||'';
  return `<div class="ppx-product ppx-list-page container pp-gift-page">${crumbs([['Gift Cards','']])}
    <div class="pp-head-unit">
      <header class="pp-bar"><div class="pp-bar-copy"><span class="ppx-eyebrow">COMING SOON</span><h1>Gift cards for less</h1><p>Buy store gift cards at a discount, then shop with them. Extra savings on top of coupons and bank offers.</p></div></header>
      <div class="pp-panel pp-gift-btns"><span class="pp-panel-note">Launching soon. Get one email when it is live.</span>
        <span class="pp-panel-acts"><button type="button" class="pp-pbtn is-go" data-pp-giftfocus>🔔 Notify me</button><a class="pp-pbtn" href="#/offers">Coupons &amp; offers</a><a class="pp-pbtn" href="#/find">Price Check</a></span></div>
    </div>
      <div class="pp-panel pp-gift-panel pp-gift-body">
        <ol class="pp-gift-how"><li><b>1</b><span><strong>Buy a gift card</strong>Amazon, Flipkart, Myntra and more, below face value.</span></li><li><b>2</b><span><strong>Shop with it</strong>Pay with the gift card on the store as usual.</span></li><li><b>3</b><span><strong>Stack the savings</strong>Coupons and sale prices still apply.</span></li></ol>
        <form class="pp-notify" id="ppGiftNotify" novalidate>
          <label for="ppGiftEmail">Get one email when gift cards go live</label>
          <div class="pp-notify-row"><input id="ppGiftEmail" type="email" autocomplete="email" placeholder="name@example.com" value="${H(email)}"><button type="submit" class="ppx-btn ppx-btn-primary">Notify me</button></div>
          <p class="pp-notify-msg" id="ppGiftMsg" role="status"></p>
          <small>One email when it launches. No spam, and you can ask us to remove it any time.</small>
        </form>
      </div>
    <p class="ppf-off-note">Meanwhile, save with <a href="#/offers">coupons and bank offers</a> or check <a href="#/find">what you really pay</a>.</p>
  </div>`;
}
function renderGift(){window.ppShowPage('gift-cards',giftHTML());document.title='Gift cards (coming soon) | PricePulse';active();}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-pp-giftfocus]');if(!b)return;const f=document.getElementById('ppGiftNotify'),i=document.getElementById('ppGiftEmail');if(!f)return;scrollTo({top:f.getBoundingClientRect().top+scrollY-(stickOff()+90),behavior:'smooth'});setTimeout(()=>i&&i.focus({preventScroll:true}),350);});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='ppGiftEmail'){const m=document.getElementById('ppGiftMsg');if(m){m.textContent='';m.className='pp-notify-msg';}}});
document.addEventListener('submit',async e=>{
  if(!e.target||e.target.id!=='ppGiftNotify')return;
  e.preventDefault();
  const inp=document.getElementById('ppGiftEmail'),msg=document.getElementById('ppGiftMsg'),btn=e.target.querySelector('button');
  const v=String(inp.value||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)){msg.textContent='Enter a valid email address.';msg.className='pp-notify-msg is-err';inp.focus();return;}
  btn.disabled=true;btn.textContent='Saving…';
  let ok=false;
  try{if(typeof supabaseClient!=='undefined'&&supabaseClient){const r=await supabaseClient.rpc('pp_notify_signup_v276',{p_email:v,p_topic:'giftcards'});ok=!r.error;}}catch(_){}
  btn.disabled=false;btn.textContent='Notify me';
  if(ok){msg.textContent='Done. We will email you once, when gift cards go live.';msg.className='pp-notify-msg is-ok';inp.value='';}
  else{msg.textContent='Could not save right now. Please try again in a minute.';msg.className='pp-notify-msg is-err';}
});

/* ---------------- V277 (P18 + P24): the white panel under each page head stays under the header while you scroll ----------------
   The dark bar scrolls away; the panel (filters / tabs / buttons) sticks. --pp-hdr-h = live header height. */
function stickOff(){const h=document.querySelector('.site-header');return Math.round(h?h.getBoundingClientRect().height:64);}
function setHdrH(){const v=stickOff();const b=document.body.style;b.setProperty('--pp-hdr-h',v+'px');b.setProperty('--ppx-sticky',v+'px');b.setProperty('--ppx-sticky-m',v+'px');}
const STICK='.pp-head-unit>.pp-panel:not(.pp-gift-body),.pp-head-unit>.ppf-cp-bar,.ppx-cmpx-hero+.pp-panel,#ppxWishHost .pp-wishlist-summary,#ppxAlertHost .pp-da-toolbar,.pp-dtabs-bar,.ppx-dl-filters';
let stT=0;
let lastH=0;
function markStuck(){stT=0;const hh=stickOff();if(hh!==lastH){lastH=hh;setHdrH();}const top=hh+2;document.querySelectorAll(STICK).forEach(el=>{if(!el.offsetParent){el.classList.remove('is-stuck');return;}const r=el.getBoundingClientRect();el.classList.toggle('is-stuck',scrollY>40&&r.top<=top);});}
addEventListener('scroll',()=>{if(!stT)stT=requestAnimationFrame(markStuck);},{passive:true});
addEventListener('resize',()=>{setHdrH();markStuck();});
window.addEventListener('hashchange',()=>setTimeout(()=>{setHdrH();markStuck();},60));
/* P24: Home "Popular deals" category chips go in their own white bar right above the cards (sticky only while the cards are on screen,
   because the bar lives inside the deals block and stops where that block ends) */
function dealTabsBar(){
  const grid=document.getElementById('dealGrid'),tabs=document.querySelector('#deals .deal-tabs');
  if(!grid||!tabs)return false;
  let bar=document.querySelector('.pp-dtabs-bar');
  if(!bar){bar=document.createElement('div');bar.className='pp-dtabs-bar';bar.setAttribute('role','region');bar.setAttribute('aria-label','Deal categories');}
  if(bar.nextElementSibling!==grid)grid.before(bar);
  if(tabs.parentElement!==bar)bar.appendChild(tabs);
  return true;
}

if(typeof window.ppRegisterRoute==='function'){
  window.ppRegisterRoute('sales',renderSales);
  window.ppRegisterRoute('gift-cards',renderGift);
}
const run=()=>{header();menu();};
run();
setHdrH();
if(!dealTabsBar()){let n=0;const t=setInterval(()=>{if(dealTabsBar()||++n>40)clearInterval(t);},250);}
new MutationObserver(()=>{if(!document.getElementById('ppSearchTop')||!document.querySelector('.pp-mnav'))run();}).observe(document.querySelector('.site-header')||document.body,{childList:true,subtree:true});
})();
