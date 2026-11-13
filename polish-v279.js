/* PricePulse V279 (31 Oct 2026) - site polish batch 4.
   L9  card charts: price history is loaded at start (it was loaded only on the product page / wishlist), cards redraw when it arrives.
   L10 card charts: hover / touch shows the date + price of that point.
   Store icons: one round icon per store (logos/store-icons/<slug>.png) next to the store name everywhere a store is shown. */
(function(){
'use strict';
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

/* ---------- L9: history at start ---------- */
(function historyAtStart(){
  if(window.PP_PRICE_PILOT_ENABLED!==true||typeof ppPreloadHistory!=='function')return;
  try{
    if(typeof ppHistoryReady!=='undefined'&&ppHistoryReady)return;
    Promise.resolve(ppPreloadHistory(false)).then(()=>{
      try{typeof window.ppUpdateHomeCardPrices==='function'&&window.ppUpdateHomeCardPrices();}catch(_){}
    }).catch(()=>{});
  }catch(_){}
})();

/* ---------- L10: chart tooltip ---------- */
const fmtD=t=>new Date(t).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
const fmtM=v=>'₹'+Math.round(v).toLocaleString('en-IN');
function chartTip(chart,clientX){
  let d=chart.__ppPts;
  if(!d){try{d=chart.__ppPts=JSON.parse(chart.dataset.ppPts||'null');}catch(_){d=null;}}
  if(!d||!d.p||!d.p.length)return;
  const svg=chart.querySelector('svg');if(!svg)return;
  const r=svg.getBoundingClientRect();if(!r.width)return;
  const fx=Math.min(1,Math.max(0,(clientX-r.left)/r.width));
  const t=d.t0+fx*(d.t1-d.t0);
  /* step line: the price in force at time t = last point at or before t */
  let k=0;for(let i=0;i<d.p.length;i++){if(d.p[i][0]<=t)k=i;else break;}
  const [pt,pp]=d.p[k];
  const yv=d.T+((d.hi-pp)/(d.hi-d.lo||1))*(d.Hh-d.T-d.B);
  let tip=chart.querySelector('.pp79-tip'),dot=chart.querySelector('.pp79-dot'),ln=chart.querySelector('.pp79-ln');
  if(!tip){
    tip=document.createElement('b');tip.className='pp79-tip';
    dot=document.createElement('u');dot.className='pp79-dot';
    ln=document.createElement('s');ln.className='pp79-ln';
    chart.append(ln,dot,tip);
  }
  const svgTop=r.top-chart.getBoundingClientRect().top,svgLeft=r.left-chart.getBoundingClientRect().left;
  const x=svgLeft+fx*r.width,y=svgTop+(yv/d.Hh)*r.height;
  const isLast=k===d.p.length-1&&t>=d.p[k][0];
  tip.textContent=`${isLast&&Date.now()-pt<2*864e5?'Now':fmtD(pt)} · ${fmtM(pp)}`;
  ln.style.cssText=`left:${x}px;top:${svgTop}px;height:${r.height}px`;
  dot.style.cssText=`left:${x}px;top:${y}px`;
  chart.classList.add('pp79-on');
  const cw=chart.clientWidth,tw=tip.offsetWidth||90;
  tip.style.left=Math.min(cw-tw,Math.max(0,x-tw/2))+'px';
  tip.style.top=Math.max(-4,svgTop-26)+'px';
}
function chartOff(chart){chart&&chart.classList.remove('pp79-on');}
document.addEventListener('pointermove',e=>{
  const c=e.target.closest&&e.target.closest('.ppx-pc-chart[data-pp-pts]');
  if(c)chartTip(c,e.clientX);
  $$('.ppx-pc-chart.pp79-on').forEach(x=>{if(x!==c)chartOff(x);});
},{passive:true});
document.addEventListener('pointerdown',e=>{const c=e.target.closest&&e.target.closest('.ppx-pc-chart[data-pp-pts]');if(c)chartTip(c,e.clientX);},{passive:true});
document.addEventListener('pointerleave',e=>{if(e.target&&e.target.matches&&e.target.matches('.ppx-pc-chart'))chartOff(e.target);},true);

/* ---------- Store icons (40 stores) ----------
   One list for the whole site: name, icon file, domain. Every old store logo (wordmark) is swapped for the round icon,
   and the store NAME is written next to it where the name is not already shown (rows, coupon tickets, hero card). */
const STORES=[
 ['Amazon','amazon','amazon.in'],['Flipkart','flipkart','flipkart.com'],['Croma','croma','croma.com'],['Reliance Digital','reliance-digital','reliancedigital.in'],
 ['Vijay Sales','vijay-sales','vijaysales.com'],['Tata CLiQ','tata-cliq','tatacliq.com'],['JioMart','jiomart','jiomart.com'],['Poorvika','poorvika','poorvika.com'],
 ['Sangeetha Mobiles','sangeetha','sangeetha.com'],['Samsung Shop','samsung','samsung.com'],['OnePlus','oneplus','oneplus.in'],['Xiaomi','xiaomi','mi.com'],
 ['Lenovo','lenovo','lenovo.com'],['HP','hp','hp.com'],['Dell','dell','dell.com'],['Myntra','myntra','myntra.com'],['AJIO','ajio','ajio.com'],
 ['Nykaa Fashion','nykaa-fashion','nykaafashion.com'],['Meesho','meesho','meesho.com'],['Shopsy','shopsy','shopsy.in'],['Adidas','adidas','adidas.co.in'],
 ['Nike','nike','nike.com'],['Puma','puma','in.puma.com'],['Bewakoof','bewakoof','bewakoof.com'],['Snapdeal','snapdeal','snapdeal.com'],['Nykaa','nykaa','nykaa.com'],
 ['Purplle','purplle','purplle.com'],['Tira','tira','tirabeauty.com'],['BigBasket','bigbasket','bigbasket.com'],['PharmEasy','pharmeasy','pharmeasy.in'],
 ['Apollo Pharmacy','apollo-pharmacy','apollopharmacy.in'],['Pepperfry','pepperfry','pepperfry.com'],['IKEA','ikea','ikea.com'],['Decathlon','decathlon','decathlon.in'],
 ['boAt','boat','boat-lifestyle.com'],['Lenskart','lenskart','lenskart.com'],['FirstCry','firstcry','firstcry.com'],['Blinkit','blinkit','blinkit.com'],
 ['Zepto','zepto','zeptonow.com'],['Swiggy Instamart','instamart','swiggy.com']];
const ALIAS={samsung:'samsung',samsungshop:'samsung',sangeetha:'sangeetha',mi:'xiaomi',xiaomi:'xiaomi',instamart:'instamart',swiggyinstamart:'instamart',tatacliq:'tata-cliq',
  reliancedigital:'reliance-digital',vijaysales:'vijay-sales',nykaafashion:'nykaa-fashion',apollo:'apollo-pharmacy',apollo247:'apollo-pharmacy',apollopharmacy:'apollo-pharmacy',
  boatlifestyle:'boat',boatstore:'boat',firstcry:'firstcry',bigbasket:'bigbasket',oneplusstore:'oneplus',xiaomistore:'xiaomi',mistore:'xiaomi',lenovostore:'lenovo',hpstore:'hp',dellstore:'dell',pumastore:'puma',sangeethamobiles:'sangeetha',tiraBeauty:'tira',tirabeauty:'tira'};
const key=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const BY={};STORES.forEach(([n,f,d])=>{BY[key(n)]={name:n,file:f,domain:d};BY[key(f)]=BY[key(n)];});
Object.entries(ALIAS).forEach(([a,f])=>{const hit=STORES.find(s=>s[1]===f);if(hit)BY[a]=BY[key(hit[0])];});
const ICON_DIR='logos/store-icons/';
function storeInfo(name){const k=key(name);return BY[k]||null;}
/* old logo files -> store */
const FILE_STORE={'amazon-logo.png':'Amazon','amazon-wordmark.svg':'Amazon','amazon.svg':'Amazon','flipkart-logo.png':'Flipkart','flipkart-wordmark.svg':'Flipkart','flipkart.svg':'Flipkart',
 'croma-wordmark.svg':'Croma','croma-round.svg':'Croma','myntra-logo.png':'Myntra','myntra.svg':'Myntra','myntra-mark.png':'Myntra','ajio-logo.png':'AJIO','ajio-wordmark.svg':'AJIO',
 'meesho-wordmark.png':'Meesho','meesho.png':'Meesho','reliance-digital-logo.png':'Reliance Digital','tatacliq-logo.png':'Tata CLiQ','jiomart-logo.png':'JioMart','jiomart-mark.png':'JioMart',
 'nykaa.svg':'Nykaa','nykaa-fashion.svg':'Nykaa Fashion','purplle.svg':'Purplle','shopsy.svg':'Shopsy','vijay-sales.svg':'Vijay Sales'};
function storeOfImg(img){
  const ds=img.dataset||{};
  if(ds.ppSmallStore)return ds.ppSmallStore;
  if(ds.extraStore)return ds.extraStore;
  const src=(img.getAttribute('src')||'').split(/[?#]/)[0];
  {const m=src.match(/logos\/store-icons\/([a-z0-9-]+)\.png$/);if(m){const hit=STORES.find(x=>x[1]===m[1]);return hit?hit[0]:null;}} /* logo already set to an icon (Admin / SQL V279) */
  if(/logos\/(brands|product-cards|icons|official)\//.test(src))return null;
  const m=src.match(/logos\/(?:stores\/)?([a-z0-9-]+\.(?:png|svg|jpe?g|webp))$/i);
  if(m&&FILE_STORE[m[1]]&&(!/logos\/stores\//.test(src)||/stores\/(croma-round|myntra-mark|meesho|jiomart-mark|nykaa|nykaa-fashion|purplle|shopsy|vijay-sales|adidas)\./.test(src)))return FILE_STORE[m[1]];
  if(/logos\/stores\/adidas\.svg/.test(src))return 'Adidas';
  /* an Admin-uploaded store logo in a store row */
  const alt=(img.getAttribute('alt')||'').replace(/\s+logo$/i,'');
  if(alt&&img.closest('.pp-v787-logo-wrap,.ppf-tk-logo,.ppf-lchip-i,.ppf-st,.ppf-row,.ppx-store,.store-logo-panel,.pp-retailer-chip')&&storeInfo(alt))return alt;
  return null;
}
/* where the round icon stands alone (the name is already next to it, or the slot is a small ring) */
const ICON_ONLY='.pp-ob-ic,.ppf-rot,.ppf-lchip-i,.ppx-dx-spot-logo';
function nameShownNear(img,name){
  /* only the logo's own box counts (a coupon text like "... at Nykaa Fashion" is not the store label) */
  const box=img.closest('.pp-v787-logo-wrap,.ppf-tk-logo,.store-logo-panel,.pp-retailer-chip')||img.parentElement;
  const n=name.toLowerCase();
  if((box.textContent||'').toLowerCase().includes(n))return true;
  /* Shop by Store tile / chip: the name sits right next to the logo box */
  const sib=box.parentElement&&[...box.parentElement.children].filter(x=>x!==box).map(x=>x.textContent||'').join(' ').toLowerCase();
  return !!(box.matches('.store-logo-panel,.ppf-lchip-i')&&sib&&sib.includes(n));
}
function swapImg(img){
  if(img.dataset.pp79)return;
  const st=storeOfImg(img);if(!st){img.dataset.pp79='0';return;}
  const info=storeInfo(st);if(!info){img.dataset.pp79='0';return;}
  img.dataset.pp79='1';
  img.removeAttribute('onerror');
  img.setAttribute('src',ICON_DIR+info.file+'.png');
  img.setAttribute('alt',info.name);
  img.removeAttribute('width');img.removeAttribute('height');
  img.hidden=false;
  img.classList.add('pp79-sic');
  const wrap=img.closest('.pp-v787-logo-wrap,.ppf-tk-logo,.store-logo-panel,.pp-retailer-chip');
  if(wrap)wrap.classList.add('pp79-has-sic');
  if(img.closest(ICON_ONLY))return;
  /* store rows keep a hidden text fallback: show it as the name */
  const fb=wrap&&wrap.querySelector('.pp-v787-logo-text[hidden]');
  if(fb){fb.querySelectorAll('img').forEach(x=>x.remove());fb.hidden=false;fb.textContent=info.name;fb.classList.remove('pp79-texticon');fb.classList.add('pp79-sname');fb.dataset.pp79='1';wrap.classList.add('pp79-named');return;}
  if(!nameShownNear(img,info.name)){
    const s=document.createElement('span');s.className='pp79-sname';s.textContent=info.name;
    img.insertAdjacentElement('afterend',s);
    (wrap||img.parentElement).classList.add('pp79-named');
  }
}
/* store names written as text (stores with no logo file yet): put the icon in front */
function iconForText(el){
  if(el.dataset.pp79)return;el.dataset.pp79='1';
  if(el.hidden||el.closest('[hidden]'))return;
  const info=storeInfo(el.textContent.trim().replace(/\s*★\s*$/,''));if(!info)return;
  const i=document.createElement('img');i.className='pp79-sic pp79-sic-inline';i.src=ICON_DIR+info.file+'.png';i.alt='';i.dataset.pp79='1';
  el.prepend(i);el.classList.add('pp79-texticon');
}
const TEXT_SEL='.pp-retailer-name[data-pp-store-text],.pp-v787-logo-text,.ppf-st-name';
/* card charts: the same product can be drawn twice (Home + Live Deals). Its gradient ids were the same, so the
   line pointed at the hidden copy's gradient and did not paint. Give every chart its own ids. */
let gradN=0;
function uniqueGradients(){
  document.querySelectorAll('.ppx-pc-chart svg:not([data-pp79g])').forEach(svg=>{
    svg.dataset.pp79g='1';
    svg.querySelectorAll('linearGradient[id]').forEach(g=>{
      const old=g.id,neu=old+'-u'+(++gradN);g.id=neu;
      svg.querySelectorAll('[fill="url(#'+old+')"],[stroke="url(#'+old+')"]').forEach(el=>{
        if(el.getAttribute('fill')==='url(#'+old+')')el.setAttribute('fill','url(#'+neu+')');
        if(el.getAttribute('stroke')==='url(#'+old+')')el.setAttribute('stroke','url(#'+neu+')');
      });
    });
  });
}
function scan(root){
  uniqueGradients();
  (root||document).querySelectorAll('img:not([data-pp79])').forEach(swapImg);
  (root||document).querySelectorAll(TEXT_SEL).forEach(el=>{if(!el.dataset.pp79)iconForText(el);});
}
let scanQ=0;
function queue(){if(scanQ)return;scanQ=requestAnimationFrame(()=>{scanQ=0;try{scan();}catch(e){console.warn('pp79 icons',e);}});}
new MutationObserver(muts=>{for(const m of muts){if(m.addedNodes.length||(m.type==='attributes'&&m.target.tagName==='IMG'&&!m.target.classList.contains('pp79-sic'))){queue();return;}}})
  .observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
/* an old renderer may set the src again later (ppRefreshSmallRetailerLogos): re-swap that img */
new MutationObserver(muts=>{muts.forEach(m=>{const i=m.target;if(i.classList&&i.classList.contains('pp79-sic')&&!/store-icons\//.test(i.getAttribute('src')||'')){i.removeAttribute('data-pp79');i.classList.remove('pp79-sic');}});queue();})
  .observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['src']});
scan();
window.ppStoreIcon=function(name){const i=storeInfo(name);return i?ICON_DIR+i.file+'.png':'';};
window.ppStoreList=STORES.map(([name,file,domain])=>({name,icon:ICON_DIR+file+'.png',domain}));

/* ---------- L14: Home is the active menu item on the home page ---------- */
function homeActive(){const h=document.getElementById('homeNavBtn');if(h)h.classList.remove('is-on');} /* V280: nothing is active on Home */
window.addEventListener('hashchange',()=>setTimeout(homeActive,30));
new MutationObserver(homeActive).observe(document.body,{attributes:true,attributeFilter:['class']});
homeActive();
/* phone menu: short label for All Categories */
{const c=document.getElementById('allCategoriesBtn');if(c&&!c.querySelector('.pp79-short')){const sp=document.createElement('span');sp.className='pp79-short';sp.textContent='Categories';c.appendChild(sp);}}

})();
