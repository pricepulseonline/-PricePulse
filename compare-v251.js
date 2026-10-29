/* =====================================================================
   PricePulse V252 — Find best price page + one search box (file name kept: compare-v251.js)
   - #/find            : landing (how it works, hot verified deals, recently compared, categories)
   - #/find/<link>     : compare result for one store link
   - #/welcome         : extension installed page (opened by the extension)
   - ONE search box: on home the header search hides while the hero box is on screen,
     everywhere else the header search is the only box (rotating store logo placeholder)
   - Mobile home: deal card moves up into the first screen (short lead, one-row trending,
     trust cards + stats after the deal card)
   - price-pulse.in/<store link> (404.html) also lands on #/find/<link>
   - Extension bridge (1.4+): live prices from other stores (window.postMessage, see EXT BRIDGE)
   Loaded after premium-v200.js. script.js is not changed.
   ===================================================================== */
(function(){
'use strict';
if(window.__ppFindV251)return;
window.__ppFindV251=true;
const K=window.ppLinkKit;
if(!K||typeof window.ppRegisterRoute!=='function'){console.warn('PricePulse V252: premium-v200.js hooks missing');return;}
const {H,M}=K;

/* Chrome Web Store page of the extension. Empty = install banners stay hidden.
   Paste the real link here after the extension is published. */
const EXT_STORE_URL=window.PP_EXT_STORE_URL||'';
const SITE='https://price-pulse.in/';
const CONTACT='pricepulseonline@gmail.com';

/* ---------- logos ---------- */
const ROTATE=[
  ['Amazon','logos/amazon-wordmark.svg'],['Flipkart','logos/flipkart-wordmark.svg'],['Croma','logos/croma-wordmark.svg'],
  ['Myntra','logos/myntra-logo.png'],['Vijay Sales','logos/stores/vijay-sales.svg'],['Nykaa','logos/stores/nykaa.svg'],
  ['Reliance Digital','logos/reliance-digital-logo.png'],['AJIO','logos/ajio-wordmark.svg'],['Tata CLiQ','logos/tatacliq-logo.png']];
const MORE_LOGOS={vijaysales:'logos/stores/vijay-sales.svg',nykaa:'logos/stores/nykaa.svg',nykaafashion:'logos/stores/nykaa-fashion.svg',purplle:'logos/stores/purplle.svg',shopsy:'logos/stores/shopsy.svg',adidas:'logos/stores/adidas.svg',croma:'logos/croma-wordmark.svg'};
function logo(store){const k=String(store||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(MORE_LOGOS[k])return `<img src="${MORE_LOGOS[k]}" alt="${H(store)} logo">`;const l=K.storeLogoFor(storeLabel(store));return /<img/.test(l||'')?l:`<b class="ppf-st-name">${H(storeLabel(store))}</b>`;}
const normStore=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const sameStore=(a,b)=>normStore(a)===normStore(b);
function storeLabel(s){const hit=ROTATE.find(([n])=>normStore(n)===normStore(s));if(hit)return hit[0];return String(s||'').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
const ICON_BOX='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 41 14v20L24 43 7 34V14z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M7 14l17 9 17-9M24 23v20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';
const CATS=[['mobiles','Mobiles'],['laptops','Laptops'],['electronics','Electronics'],['home','Home & Kitchen'],['fashion','Fashion'],['appliances','Appliances'],['beauty','Beauty']];
const catName=c=>(CATS.find(x=>x[0]===c)||[0,K.catLabel(c)])[1];

/* V258: placeholder logo ("Search or paste any [logo] link"): own list (the Find page strip keeps ROTATE).
   Every 3 s the logo rolls up and the next one rolls in from below; the slot width follows the logo, so "link" always sits right after it. */
const PH_LOGOS=[
  ['Amazon','logos/amazon-logo.png'],['Flipkart','logos/flipkart-logo.png'],['Myntra','logos/myntra-logo.png'],['Croma','logos/stores/croma-round.svg'],
  ['AJIO','logos/ajio-logo.png'],['Nykaa','logos/stores/nykaa.svg'],['Reliance Digital','logos/reliance-digital-logo.png'],['Tata CLiQ','logos/tatacliq-logo.png'],
  ['Meesho','logos/stores/meesho.png'],['Vijay Sales','logos/stores/vijay-sales.svg'],['JioMart','logos/jiomart-logo.png'],['Nykaa Fashion','logos/stores/nykaa-fashion.svg']];
function rotator(){return `<span class="ppf-rot" aria-hidden="true">${PH_LOGOS.map(([n,src],i)=>`<img src="${src}" alt=""${i?'':' class="is-on"'}>`).join('')}</span>`;}
let rotI=0;
const ROT_STILL=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function rotFit(r){const on=r.querySelector('img.is-on');if(on&&on.offsetWidth)r.style.width=on.offsetWidth+'px';}
setInterval(()=>{
  if(document.hidden)return;
  const prev=rotI;rotI=(rotI+1)%PH_LOGOS.length;
  document.querySelectorAll('.ppf-rot').forEach(r=>{
    const ims=r.querySelectorAll('img');
    ims.forEach((im,i)=>{im.classList.toggle('is-on',i===rotI);im.classList.toggle('is-out',i===prev&&!ROT_STILL);});
    rotFit(r);
    setTimeout(()=>ims[prev]?.classList.remove('is-out'),550);
  });
},3000);
window.addEventListener('load',()=>document.querySelectorAll('.ppf-rot').forEach(rotFit));

/* V257: "Works with" logos in the box: 3 round slots, all 12 stores in turns.
   Every 3 s each slot flips like a coin (one after another); the logo changes when the coin is edge-on. */
{const slots=[...document.querySelectorAll('.pp-ob-works .pp-ob-ic')];let g=0;
 const n=slots.length?slots[0].children.length:0;
 const still=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const show=sl=>[...sl.children].forEach((im,k)=>im.classList.toggle('is-on',k===g));
 if(n>1)setInterval(()=>{
   if(document.hidden)return;g=(g+1)%n;
   slots.forEach((sl,i)=>{
     if(still){show(sl);return;}
     setTimeout(()=>{sl.classList.remove('is-flip');void sl.offsetWidth;sl.classList.add('is-flip');setTimeout(()=>show(sl),300);},i*150);
   });
 },3000);}

/* placeholder overlay on an input: "Search or paste any [logo] link" */
function addRotatingPlaceholder(input){
  if(!input||input.dataset.ppfPh)return;
  input.dataset.ppfPh='1';
  const form=input.closest('form')||input.parentElement;
  if(getComputedStyle(form).position==='static')form.style.position='relative';
  const ph=document.createElement('span');
  ph.className='ppf-ph';
  ph.innerHTML=`<span class="ppf-ph-l">Search or paste any</span><span class="ppf-ph-s">Paste any</span>${rotator()}<span>link</span>`;
  form.appendChild(ph);
  input.setAttribute('placeholder','');
  input.setAttribute('aria-label','Search a product or paste a product link');
  const place=()=>{
    const fr=form.getBoundingClientRect(),ir=input.getBoundingClientRect();
    if(!ir.width){ph.hidden=true;return;}
    const cs=getComputedStyle(input);
    ph.style.left=(ir.left-fr.left+parseFloat(cs.paddingLeft||0)+parseFloat(cs.borderLeftWidth||0))+'px';
    ph.style.top=(ir.top-fr.top)+'px';
    ph.style.height=ir.height+'px';
    ph.style.maxWidth=Math.max(60,ir.width-parseFloat(cs.paddingLeft||0)-8)+'px';
    ph.style.fontSize=cs.fontSize;
    ph.classList.toggle('is-short',ir.width<300);
    ph.hidden=!!input.value;
    input.ppfSync&&input.ppfSync();
    const rt=ph.querySelector('.ppf-rot');if(rt)rotFit(rt);
  };
  ['input','change','focus','blur'].forEach(ev=>input.addEventListener(ev,place));
  window.addEventListener('resize',place);
  try{new ResizeObserver(place).observe(input);}catch(_){}
  place();setTimeout(place,600);
  input.ppfPlace=place;
}
const headerInput=()=>document.getElementById('searchInput');
function focusHeaderSearch(value){
  const inp=headerInput();if(!inp)return;
  if(value!==undefined){inp.value=value;inp.dispatchEvent(new Event('input',{bubbles:true}));}
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>{inp.focus();if(value)inp.select();inp.ppfPlace?.();},120);
}
/* V253: one search box (#siteSearch under the category row, in index.html) on every page */
addRotatingPlaceholder(headerInput());
/* V265: "Clear" button replaces the "Works with" logos while the box holds text */
{const inp=headerInput();
 if(inp){
  const box=inp.closest('.pp-onebox')||inp.closest('form');
  const works=box&&box.querySelector('.pp-ob-works');
  if(box&&!box.querySelector('.pp-ob-clear')){
    const b=document.createElement('button');b.type='button';b.className='pp-ob-clear';b.textContent='Clear';b.setAttribute('aria-label','Clear the search box');
    (works||inp).insertAdjacentElement(works?'beforebegin':'afterend',b);
    b.addEventListener('click',()=>{
      inp.value='';inp.dispatchEvent(new Event('input',{bubbles:true}));
      box.classList.remove('is-link');sync();inp.focus();inp.ppfPlace?.();
    });
  }
  function sync(){if(box)box.classList.toggle('has-text',!!inp.value);}
  inp.ppfSync=sync;
  ['input','change','focus','blur','keyup','paste'].forEach(ev=>inp.addEventListener(ev,()=>setTimeout(sync,0)));
  sync();
 }}
/* leaving the Find page: a pasted link should not stay in the box */
let wasFind=false;
function clearLinkOffFind(){const inp=headerInput();const onFind=document.body.dataset.ppPage==='find'&&document.body.classList.contains('pp-page-mode');const left=wasFind&&!onFind;wasFind=onFind;if(!inp||!left)return;if(K.parseStoreLink(inp.value)){inp.value='';inp.ppfPlace?.();inp.closest('form')?.classList.remove('is-link');}}
new MutationObserver(clearLinkOffFind).observe(document.body,{attributes:true,attributeFilter:['class','data-pp-page']});
/* V276 (P5): the one box (paste a link / search) sits only where it is needed.
   Home: under the category row (top of the hero). Find (Price Check) page: inside the page head.
   Every other page: hidden; the header "Search" button opens it as a panel (polish-v276.js). */
const BOX=document.getElementById('siteSearch'),BOX_ROW=document.querySelector('#ppOneBoxRow .container');
function boxSlot(page){
  const v=document.getElementById('ppPageView');if(!v||v.hidden)return null;
  return page==='find'?v.querySelector('.ppf-box-slot'):null;
}
function placeBox(){
  if(!BOX||!BOX_ROW)return;
  const b=document.body,inPage=b.classList.contains('pp-page-mode');
  const page=inPage?b.dataset.ppPage:'';
  const slot=inPage?boxSlot(page):null;
  const off=b.classList.contains('pp-plus-page-open')||(inPage&&!slot);
  if(slot){if(BOX.parentElement!==slot)slot.appendChild(BOX);}
  else if(BOX.parentElement!==BOX_ROW)BOX_ROW.prepend(BOX);
  b.classList.toggle('pp-box-inpage',!!slot);
  b.classList.toggle('pp-box-off',!slot&&off);
  BOX.querySelector('input')?.ppfPlace?.();
}
new MutationObserver(placeBox).observe(document.body,{attributes:true,attributeFilter:['class','data-pp-page']});
{const v=document.getElementById('ppPageView');if(v)new MutationObserver(placeBox).observe(v,{childList:true});}
placeBox();

/* V258: home: the hero background runs up behind the box row (no colour break between box and hero).
   --pp-ob-row-h = live height of the row (it grows when the install strip shows). */
{const row=document.getElementById('ppOneBoxRow');
 const setH=()=>document.body.style.setProperty('--pp-ob-row-h',(row&&row.offsetHeight||0)+'px');
 if(row){setH();try{new ResizeObserver(setH).observe(row);}catch(_){window.addEventListener('resize',setH);}}}

/* ---------- mobile home: deal card inside the first screen ---------- */
const SHORT_LEAD='Compare verified prices across stores and buy at the right time.';
function heroMobile(){
  const copy=document.querySelector('.hero-copy'),art=document.querySelector('.hero-grid .hero-art');
  const trust=document.querySelector('.ppx-hero-trust'),stats=document.getElementById('ppxHeroStats'),lead=document.querySelector('.hero .hero-lead');
  if(!copy||!art||!trust)return false;
  const m=window.matchMedia('(max-width:620px)').matches;
  if(lead){if(!lead.dataset.ppfLong)lead.dataset.ppfLong=lead.textContent;lead.textContent=m?SHORT_LEAD:lead.dataset.ppfLong;}
  let after=document.querySelector('.ppf-hero-after');
  if(m&&trust.parentElement===copy){
    if(!after){after=document.createElement('div');after.className='ppf-hero-after';}
    art.after(after);after.append(trust);if(stats)after.append(stats);
  }else if(!m&&after){copy.append(trust);if(stats)copy.append(stats);after.remove();}
  return true;
}
if(!heroMobile()){let n=0;const t=setInterval(()=>{if(heroMobile()||++n>40)clearInterval(t);},250);}
window.matchMedia('(max-width:620px)').addEventListener?.('change',heroMobile);

/* ---------- EXT BRIDGE (extension 1.4+) ----------
   Extension content script on price-pulse.in:
     sets <html data-pp-ext="1.4.0"> and posts {pp:'ext',type:'pp-hello',version}
   Site asks:   {pp:'site',type:'pp-find',id,url}
   Extension:   {pp:'ext',type:'pp-find-result',id,url,product:{name,brand,model,variant,price,mrp,image,store,rating,ratingCount},
                 rows:[{store,price,mrp,url,title,match:'exact'|'similar',inStock,seenAt,delivery,deliveryCharge,variant}],
                 offers:[{store,text,kind:'bank'|'emi'|'exchange'|'coupon',value}],error}
   ------------------------------------------------ */
let extVersion=document.documentElement.dataset.ppExt||'';
const extWaiters=[];
let findReq=null;
window.addEventListener('message',e=>{
  if(e.source!==window||!e.data||e.data.pp!=='ext')return;
  const d=e.data;
  if(d.type==='pp-hello'){extVersion=String(d.version||'1');document.documentElement.dataset.ppExt=extVersion;extWaiters.splice(0).forEach(f=>f(true));onExtChange();}
  if(d.type==='pp-find-result'&&findReq&&d.id===findReq.id)findReq.done(d);
  if(d.type==='pp-find-progress'&&findReq&&d.id===findReq.id&&findReq.onProgress)findReq.onProgress(d);
});
function hasExtension(){return !!(extVersion||document.documentElement.dataset.ppExt);}
function waitExtension(ms=1200){return hasExtension()?Promise.resolve(true):new Promise(res=>{extWaiters.push(res);setTimeout(()=>res(hasExtension()),ms);});}
function askExtension(url,onProgress){
  return new Promise(res=>{
    const id='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    let last=null;
    /* progress messages keep arriving while the extension works; if it is slow, show what we have */
    const t=setTimeout(()=>{if(findReq&&findReq.id===id)findReq=null;res(last?{...last,error:'timeout'}:{error:'timeout'});},45000);
    findReq={id,onProgress:d=>{last=d;try{onProgress&&onProgress(d);}catch(_){}},done:d=>{clearTimeout(t);if(findReq&&findReq.id===id)findReq=null;res(d);}};
    /* a page opened from a file (local test copy) has an opaque origin ("file://" or "null"), so a postMessage aimed at it is silently dropped */
    try{window.postMessage({pp:'site',type:'pp-find',id,url},location.protocol==='file:'||!location.origin||location.origin==='null'?'*':location.origin);}
    catch(_){clearTimeout(t);if(findReq&&findReq.id===id)findReq=null;res({error:'post-failed'});}
  });
}
const isDesktopChrome=()=>/Chrome\/\d+/.test(navigator.userAgent)&&!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)&&window.matchMedia('(min-width:900px)').matches;
function canOfferInstall(){return !!EXT_STORE_URL&&isDesktopChrome()&&!hasExtension();}

/* install strip under the hero search (desktop Chrome, no extension, store link set) */
function dismissed(){try{return localStorage.getItem('ppfExtStrip')==='x';}catch(_){return false;}}
function renderInstallStrip(){
  document.getElementById('ppfExtStrip')?.remove();
  if(!canOfferInstall()||dismissed())return;
  const hero=document.getElementById('siteSearch');if(!hero||document.body.classList.contains('pp-page-mode'))return;
  const s=document.createElement('div');
  s.id='ppfExtStrip';s.className='ppf-strip';
  s.innerHTML=`<span class="ppf-strip-dot" aria-hidden="true"></span><span>See verified prices from other stores right on Amazon, Flipkart and Croma.</span><a href="${H(EXT_STORE_URL)}" target="_blank" rel="noopener">Add to Chrome, it's free →</a><button type="button" aria-label="Hide">×</button>`;
  s.querySelector('button').addEventListener('click',()=>{try{localStorage.setItem('ppfExtStrip','x');}catch(_){}s.remove();});
  hero.after(s);
}
function onExtChange(){renderInstallStrip();if(/^#\/welcome/.test(location.hash))renderWelcome();}
setTimeout(renderInstallStrip,1600);

/* ---------- small helpers ---------- */
function ago(t){const ms=Date.now()-(typeof t==='number'?t:Date.parse(t||''));if(!Number.isFinite(ms)||ms<0)return '';const h=Math.floor(ms/3600000);if(h<1){const m=Math.floor(ms/60000);return m<2?'just now':`${m} min ago`;}if(h<24)return `${h}h ago`;const d=Math.floor(h/24);return `${d}d ago`;}
let toastT=0;
function toast(msg){let t=document.getElementById('ppfToast');if(!t){t=document.createElement('div');t.id='ppfToast';t.className='ppf-toast';t.setAttribute('role','status');document.body.appendChild(t);}t.textContent=msg;t.classList.add('is-on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('is-on'),2200);}
async function share(title,url){
  try{if(navigator.share){await navigator.share({title,url});return;}}catch(_){return;}
  try{await navigator.clipboard.writeText(url);toast('Link copied');}catch(_){toast(url);}
}
const signedIn=()=>{try{return typeof currentUser!=='undefined'&&!!currentUser;}catch(_){return false;}};
const findUrl=link=>`${SITE}#/find/${encodeURIComponent(link)}`;

/* product name from the link address (better than the word-guesser for display + store search) */
const FILLER=/^(buy|online|at|best|price|prices|in|india|indias|offer|offers|sale|new|latest|with|free|delivery|shop|official|store)$/i;
const UNIT=/^(\d+(?:\.\d+)?)(gb|tb|mb|mah|w|ml|l|kg|g|mm|cm|inch|inches|hz|mp|pcs|pc|ltr|litre|litres)$/i;
const BRANDCASE={iphone:'iPhone',ipad:'iPad',ipod:'iPod',imac:'iMac',macbook:'MacBook',airpods:'AirPods',airtag:'AirTag',oneplus:'OnePlus',playstation:'PlayStation',boat:'boAt',realme:'realme',oppo:'OPPO',vivo:'vivo',iqoo:'iQOO',poco:'POCO',jbl:'JBL',lg:'LG',hp:'HP',asus:'ASUS',msi:'MSI',tcl:'TCL',jiomart:'JioMart'};
function niceWord(w){
  { const bc=BRANDCASE[String(w).toLowerCase()]; if(bc)return bc; }
  if(/^\d+g$/i.test(w))return w.toUpperCase();
  const u=w.match(UNIT);if(u)return u[1]+(/^(gb|tb|mb|mah|w|hz|mp)$/i.test(u[2])?u[2].toUpperCase().replace('MAH','mAh'):u[2].toLowerCase());
  if(/^(tv|ac|hd|uhd|fhd|uv|pc|led|lcd|oled|qled|usb|ssd|hdd|ram|anc|tws|spf|bldc|ips)$/i.test(w))return w.toUpperCase();
  if(/^(ml|kg|gm|mm|cm|ltr)$/i.test(w))return w.toLowerCase();
  if(/^[a-z]+$/.test(w))return w[0].toUpperCase()+w.slice(1);
  if(/^[a-z][a-z0-9]*\d[a-z0-9]*$/i.test(w))return w[0].toUpperCase()+w.slice(1);
  return w;
}
function slugTitle(link){
  let u;try{u=new URL(link.url);}catch(_){return '';}
  const bad=/^(dp|p|gp|product|products|buy|d|aw|s|pd|item|itm\w*|ref=.*|[A-Z0-9]{10}|\d+|p\d+|mp\d+)$/i;
  let best=[];
  u.pathname.split('/').forEach(seg=>{
    let s=seg;try{s=decodeURIComponent(seg.replace(/\+/g,' '));}catch(_){s=seg.replace(/\+/g,' ');}
    if(!s||bad.test(s)||/\.(html?|php|aspx?)$/i.test(s)&&s.split(/[-_ ]/).length<3)return;
    const words=s.replace(/\.(html?|php|aspx?)$/i,'').split(/[-_\s]+/).filter(Boolean);
    if(words.length>best.length)best=words;
  });
  if(best.length<2)return '';
  let words=best.filter(w=>!/^\d{6,}$/.test(w)&&!FILLER.test(w)&&!/^[A-Z0-9]{10}$/.test(w)).map(w=>w.replace(/[^\p{L}\p{N}.%&+']/gu,'')).filter(Boolean);
  /* "the derma co the derma co ..." -> once */
  for(let n=Math.min(4,Math.floor(words.length/2));n>=1;n--){const a=words.slice(0,n).join(' ').toLowerCase(),b=words.slice(n,2*n).join(' ').toLowerCase();if(a===b){words=words.slice(n);break;}}
  return words.slice(0,16).map(niceWord).join(' ').replace(/\s+/g,' ').trim();
}
function searchQuery(title){return title.split(' ').filter(w=>w.length>1||/\d/.test(w)).slice(0,8).join(' ');}
/* category from words when the guesser says "other" */
const CAT_WORDS=[
  ['beauty',/\b(serum|cream|moisturi[sz]er|face ?wash|cleanser|sunscreen|sunblock|spf|lotion|shampoo|conditioner|lipstick|lip ?balm|kajal|eyeliner|mascara|foundation|toner|niacinamide|salicylic|hyaluronic|retinol|ceramide|vitamin c|hair ?oil|body ?wash|perfume|deodorant|skin ?care|hydrating|barrier|face ?mask|scrub|primer|nail)\b/i],
  ['mobiles',/\b(smartphone|mobile phone|iphone|galaxy [asmfz]\d+|redmi|poco|iqoo|vivo [vty]\d+|oppo|realme|oneplus|infinix|tecno|lava|moto g|nord|pixel \d|dimensity|snapdragon [678]|5g)\b/i],
  ['laptops',/\b(laptop|notebook|macbook|chromebook|ultrabook)\b/i],
  ['appliances',/\b(refrigerator|fridge|washing machine|air conditioner|microwave|geyser|water heater|dishwasher|air purifier|water purifier|chimney)\b/i],
  ['electronics',/\b(earbuds|earphones|headphones|headset|speaker|soundbar|smartwatch|smart watch|power ?bank|charger|television|smart tv|monitor|tablet|camera|keyboard|mouse)\b/i],
  ['fashion',/\b(t-?shirt|shirt|jeans|kurta|kurti|saree|dress|shoes|sneakers|sandals|slippers|jacket|hoodie|trousers|track ?pants|shorts|leggings|handbag|backpack|sunglasses|socks)\b/i],
  ['home',/\b(cookware|kadai|pan|pressure cooker|mixer|grinder|kettle|bottle|bedsheet|pillow|mattress|curtain|air fryer|toaster|iron|lamp|towel|container)\b/i]];
function guessCat(text){for(const [c,re] of CAT_WORDS)if(re.test(text))return c;return '';}

/* recently compared (this browser only) */
const RKEY='ppfRecent';
function recentList(){try{const a=JSON.parse(localStorage.getItem(RKEY)||'[]');return Array.isArray(a)?a:[];}catch(_){return [];}}
function saveRecent(item){try{const a=recentList().filter(x=>x.url!==item.url);a.unshift({...item,t:Date.now()});localStorage.setItem(RKEY,JSON.stringify(a.slice(0,8)));}catch(_){}}

/* ---------- catalog helpers ---------- */
function catalogRows(p){
  const info=K.productData(p.id);
  const offers=typeof window.ppCatalogOffersForProduct==='function'?window.ppCatalogOffersForProduct(p.id,info?.data||{}):(K.bestPrice(p).state.offers||[]);
  return offers.map(o=>({store:o.name,url:o.url,price:Number.isFinite(o.price)?o.price:null,inStock:o.availability!=='out_of_stock',checkedAt:o.checkedAt||o.updatedAt||'',kind:Number.isFinite(o.price)?'verified':'link',raw:o}));
}
function sortRows(rows){
  return rows.sort((a,b)=>{
    const ah=Number.isFinite(a.price)&&a.inStock!==false?0:1,bh=Number.isFinite(b.price)&&b.inStock!==false?0:1;
    if(ah!==bh)return ah-bh;
    return (a.price??9e15)-(b.price??9e15);
  });
}
function lowestOf(rows){const pr=rows.filter(r=>Number.isFinite(r.price)&&r.inStock!==false);if(!pr.length)return null;const low=Math.min(...pr.map(r=>r.price));const at=pr.filter(r=>r.price===low);return {price:low,row:at[0],unique:at.length===1,count:pr.length};}
function dealOf(p){
  const b=K.bestPrice(p);if(!Number.isFinite(b.price))return null;
  let a=null;try{const sav=b.state.uniqueLowest&&typeof window.ppOfferSavings==='function'?window.ppOfferSavings(b.state.uniqueLowest):null;a=K.dealAnalysis(p.id,b.price,sav,b.state.inStock?.length||0);}catch(_){}
  return {p,price:b.price,stores:b.stores,a};
}
function topDeals(cat,excludeId,n=4){
  const list=K.productIndex().filter(p=>p.id!==excludeId&&(!cat||p.category===cat)).map(dealOf).filter(Boolean);
  list.sort((x,y)=>(y.a?.score||0)-(x.a?.score||0)||y.stores-x.stores);
  return list.slice(0,n);
}
const CMP_ICON='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/></svg>';
function dealCardsHTML(list){
  return `<div class="ppf-deals">${list.map(d=>{const img=K.photoOf(d.p);
    const on=typeof window.ppCmpHas==='function'&&window.ppCmpHas(d.p.id);
    return `<div class="ppf-deal-w"><a class="ppf-deal" href="#/product/${encodeURIComponent(d.p.id)}">
    <span class="ppf-deal-img">${img?`<img src="${H(img)}" alt="" loading="lazy">`:ICON_BOX}</span>
    <span class="ppf-deal-name">${H(d.p.name)}</span>
    <span class="ppf-deal-price"><b>${M(d.price)}</b><small>${d.stores} stores</small></span>
    ${d.a?`<span class="ppf-deal-score is-${H(d.a.tone)}">Deal Score ${d.a.score} · ${H(d.a.label)}</span>`:''}</a>
    <button type="button" class="ppx-btn ppx-btn-soft ppx-pp-cmp ppf-deal-cmp${on?' is-on':''}" data-pc-cmp="${H(d.p.id)}" data-cmp-style="pp" aria-pressed="${on}">${typeof window.ppCmpIcon==='string'?window.ppCmpIcon:CMP_ICON}<span>${on?'Added to compare':'Compare'}</span></button></div>`;}).join('')}</div>`;
}
function recentHTML(exceptUrl){
  const list=recentList().filter(x=>x.url!==exceptUrl).slice(0,4);
  if(!list.length)return '';
  return `<section class="ppf-sec"><div class="ppf-sec-h"><h2>Recently compared</h2><small>On this device</small></div><div class="ppf-recent">${list.map(r=>`<button type="button" class="ppf-rc" data-ppf-open="${H(r.url)}">
    <span class="ppf-rc-img">${r.img?`<img src="${H(r.img)}" alt="" loading="lazy">`:ICON_BOX}</span>
    <span class="ppf-rc-copy"><b>${H(r.name||'Product')}</b><small>${r.store?H(r.store)+' link':''}${r.price?` · Best ${M(r.price)}`:''} · ${H(ago(r.t))}</small></span></button>`).join('')}</div></section>`;
}
function historyHTML(p,current){
  let s=[];try{s=K.lowestSeries(p.id)||[];}catch(_){}
  const now=Date.now(),DAY=86400000;
  const pts=s.filter(x=>now-x.time<=60*DAY);
  if(pts.length<2)return '';
  const all=[...pts.map(x=>x.price),...(Number.isFinite(current)?[current]:[])];
  const last30=s.filter(x=>now-x.time<=30*DAY).map(x=>x.price);
  const lo=Math.min(...all),hi=Math.max(...all);
  const avgArr=last30.length?last30:all;const avg=Math.round(avgArr.reduce((a,b)=>a+b,0)/avgArr.length);
  const t0=pts[0].time,t1=Math.max(now,pts[pts.length-1].time);
  const W=600,Hh=110,pad=8;
  const xy=pts.map(x=>[pad+(W-2*pad)*(x.time-t0)/Math.max(1,t1-t0),pad+(Hh-2*pad)*(hi===lo?.5:(hi-x.price)/(hi-lo))]);
  if(Number.isFinite(current))xy.push([W-pad,pad+(Hh-2*pad)*(hi===lo?.5:(hi-current)/(hi-lo))]);
  const line=xy.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area=`${line} L${xy[xy.length-1][0].toFixed(1)} ${Hh} L${xy[0][0].toFixed(1)} ${Hh} Z`;
  const days=Math.max(1,Math.round((t1-t0)/DAY));
  return `<section class="ppf-card ppf-hist"><div class="ppf-sec-h"><h2>Price history</h2><small>Lowest verified price · last ${days} days</small></div>
    <svg class="ppf-spark" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Price history chart"><defs><linearGradient id="ppfG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2EA06E" stop-opacity=".28"/><stop offset="1" stop-color="#2EA06E" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#ppfG)"/><path d="${line}" fill="none" stroke="#1E7A55" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>
    <div class="ppf-hist-stats"><span><small>LOWEST</small><b class="is-low">${M(lo)}</b></span><span><small>AVERAGE</small><b>${M(avg)}</b></span><span><small>HIGHEST</small><b class="is-high">${M(hi)}</b></span></div>
    <a class="ppf-link" href="#/product/${encodeURIComponent(p.id)}">Full price history and details →</a></section>`;
}

/* ---------- store rows ---------- */
/* ---------- offers: saving per offer + net effective price (page offers + offers added in Admin) ---------- */
/* V273: a new-user coupon, or a Cuelinks % offer with no max saving stated, is shown but never counted in Net */
const NEWU=/\b(first|1st)\s*(purchase|order|app\s*order|transaction|buy)|\bnew\s*(users?|customers?|members?)\b/i;
function offFlag(o){
  if(!o||!['bank','coupon','giftcard'].includes(o.kind))return null;
  if(o.newu||NEWU.test(o.text||''))return 'new';
  if(o.src==='cuelinks'&&o.pct&&!o.cap&&!o.amount)return 'nocap';
  return null;
}
function offerSave(o,price){
  if(!o||offFlag(o)||!['bank','coupon','giftcard'].includes(o.kind)||!Number.isFinite(price)||price<=0)return null;
  if(o.min&&price<o.min)return null;
  let v=null;
  if(o.pct)v=price*o.pct/100,v=o.cap?Math.min(v,o.cap):v;
  else v=o.amount||o.cap||null;
  if(!v||v>=price*0.5)return null;
  return Math.round(v);
}
function bestOfKind(offers,price,kind){
  let best=null;
  (offers||[]).forEach(o=>{if(o.kind!==kind)return;const v=offerSave(o,price);if(v&&(!best||v>best.save))best={save:v,offer:o};});
  return best;
}
/* net = price - best bank offer - best coupon. A gift card is a separate, extra saving (you buy the card first). */
function netCalc(offers,price){
  const bank=bestOfKind(offers,price,'bank'),coupon=bestOfKind(offers,price,'coupon'),gift=bestOfKind(offers,price,'giftcard');
  return {bank,coupon,gift,save:(bank?bank.save:0)+(coupon?coupon.save:0)};
}
const OFFER_KIND={bank:'Bank offer',emi:'EMI',cashback:'Cashback',exchange:'Exchange',coupon:'Coupon',giftcard:'Gift card',other:'Offer'};
const OFF_SEC=[['giftcard','Gift card offers'],['bank','Bank offers'],['emi','EMI offers'],['coupon','Coupons'],['exchange','Exchange'],['cashback','Cashback'],['other','Other offers']];
const offOpenMap=new Map();
function offerCardHTML(o,price){
  const v=offerSave(o,price);
  const money=x=>M(x);
  const big=v?`<b class="is-save">-${money(v)}</b>`:o.pct&&['bank','coupon','giftcard'].includes(o.kind)?`<b>${o.pct}% off</b>`:['bank','coupon','giftcard'].includes(o.kind)&&(o.cap||o.amount)?`<b>${o.amount&&!o.cap?'':'Up to '}${money(o.cap||o.amount)}${o.amount&&!o.cap?' off':''}</b>`:o.kind==='exchange'&&o.cap?`<b>Up to ${money(o.cap)}</b>`:o.kind==='cashback'&&o.pct?`<b>${o.pct}% back</b>`:'';
  const sub=v&&o.pct?`${o.pct}% off${o.cap?' · up to '+money(o.cap):''}${o.min?' · min '+money(o.min):''}`:o.min?`Min order ${money(o.min)}`:'';
  const title=o.kind==='coupon'?'Coupon':o.bank?o.bank+(o.kind==='bank'?' card':''):OFFER_KIND[o.kind]||'Offer';
  const fl=offFlag(o),flag=fl==='new'?'<em class="ppf-oc-f">New users only</em>':fl==='nocap'?'<em class="ppf-oc-f">Max saving not stated</em>':'';
  const code=o.code?`<button type="button" class="ppf-code" data-ppf-copy="${H(o.code)}" title="Copy code">${H(o.code)} <i aria-hidden="true">⧉</i></button>`:'';
  return `<div class="ppf-oc"><span class="ppf-oc-t">${o.kind==='bank'||o.kind==='emi'?bankBadge(o.bank||'Bank'):o.kind==='coupon'?'<i class="ppf-bk is-cp" aria-hidden="true">%</i>':o.kind==='giftcard'?'<i class="ppf-bk is-gc" aria-hidden="true">GC</i>':''}${H(title)}${o.src==='cuelinks'?'':''}</span>${big}${sub?`<small>${H(sub)}</small>`:''}${flag}${code}<span class="ppf-oc-x">${H(o.text)}</span></div>`;
}
function scroller(inner){return `<div class="ppf-sc"><button type="button" class="ppf-sc-b is-prev" data-ppf-sc="-1" aria-label="Previous offers">‹</button><div class="ppf-ocs">${inner}</div><button type="button" class="ppf-sc-b is-next" data-ppf-sc="1" aria-label="More offers">›</button></div>`;}
/* shows the ‹ › buttons only when a row of offers is wider than the box */
function markScrollers(root){(root||document).querySelectorAll('.ppf-sc').forEach(w=>{const s=w.querySelector('.ppf-ocs');if(!s||!s.clientWidth)return;const more=s.scrollWidth>s.clientWidth+4;w.classList.toggle('can-scroll',more);w.classList.toggle('at-start',s.scrollLeft<4);w.classList.toggle('at-end',s.scrollLeft+s.clientWidth>=s.scrollWidth-4);if(!s.dataset.ppfScw){s.dataset.ppfScw=1;s.addEventListener('scroll',()=>{w.classList.toggle('at-start',s.scrollLeft<4);w.classList.toggle('at-end',s.scrollLeft+s.clientWidth>=s.scrollWidth-4);},{passive:true});}});}
if(!window.__ppfScr){window.__ppfScr=1;let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>markScrollers(),150);});}
function offersPanelHTML(offers,price,calc,storeName,fromPage,key,open,cards){
  const net=calc&&calc.save?price-calc.save:null;
  const secs=OFF_SEC.map(([k,t])=>{const l=offers.filter(o=>(OFF_SEC.some(x=>x[0]===o.kind)?o.kind:'other')===k);return l.length?`<div class="ppf-os"><h3>${t} <i>${l.length}</i></h3>${scroller(l.map(o=>offerCardHTML(o,price)).join(''))}</div>`:'';}).join('')+(cards&&cards.length?`<div class="ppf-os"><div class="ppf-stk-sh"><h3>Card rewards <i>${cards.length}</i></h3><button type="button" class="ppf-addc" data-ppf-cards>${myCards().length?'My cards':'+ Add your cards'}</button></div>${scroller(cards.map(cardRowHTML).join(''))}</div>`:'');
  const sum=net!=null?`<div class="ppf-off-net"><div><span>Total savings</span><b>${M(calc.save)}</b></div><div><span>Net effective price</span><b>${M(net)}</b></div></div>`:'';
  const gift=calc&&calc.gift&&net!=null?`<p class="ppf-off-gift">Extra with a ${H(storeName||'store')} gift card: save ${M(calc.gift.save)} more (${M(net-calc.gift.save)}). You buy the gift card first.</p>`:'';
  const o=offOpenMap.has(key)?offOpenMap.get(key):open;
  const what=net!=null?'<b>Offers · Net '+M(net)+'</b>':offers.length?`<b>Offers (${offers.length})</b>`:cards&&cards.length?`<b>Save up to ${M(cards[0].save)} more with a card</b>`:'<b>Card rewards</b>';
  return `<div class="ppf-off" data-ppf-offkey="${H(key)}"><button type="button" class="ppf-off-t" data-ppf-off aria-expanded="${o}">${what}<span>${o?'Hide':'Show'} <i aria-hidden="true">${o?'▴':'▾'}</i></span></button><div class="ppf-off-b"${o?'':' hidden'}>${secs}${sum}${gift}${offers.length?'':'<p class="ppf-off-note">Card rewards come after you pay and follow each bank\'s limits.</p>'}<p class="ppf-off-note"${offers.length?'':' hidden'}>${fromPage?`Bank offers are read from the ${H(storeName||'store')} page. `:''}Other offers are added by PricePulse and can change. Net price = best bank offer + best coupon. Check at checkout.</p></div></div>`;
}
if(!window.__ppfOffToggle){window.__ppfOffToggle=1;document.addEventListener('click',e=>{
  const cp=e.target.closest&&e.target.closest('[data-ppf-copy]');
  if(cp){e.preventDefault();const c=cp.dataset.ppfCopy;try{navigator.clipboard.writeText(c);}catch(_){}const old=cp.innerHTML;cp.textContent='Copied';setTimeout(()=>{cp.innerHTML=old;},1200);return;}
  const sb=e.target.closest&&e.target.closest('[data-ppf-sc]');
  if(sb){e.preventDefault();const s=sb.parentElement.querySelector('.ppf-ocs');s.scrollBy({left:Number(sb.dataset.ppfSc)*Math.max(220,s.clientWidth*.8),behavior:'smooth'});return;}
  const t=e.target.closest&&e.target.closest('[data-ppf-off]');if(!t)return;e.preventDefault();
  const w=t.closest('.ppf-off'),bd=w.querySelector('.ppf-off-b'),o=bd.hidden;bd.hidden=!o;offOpenMap.set(w.dataset.ppfOffkey,o);
  t.setAttribute('aria-expanded',o);t.querySelector('span').innerHTML=(o?'Hide':'Show')+' <i aria-hidden="true">'+(o?'▴':'▾')+'</i>';if(o)markScrollers(w);
});}
/* offers added in Admin (pp_store_offers) */
let adminOffers=null,adminOffersP=null;
function loadAdminOffers(){
  if(adminOffersP)return adminOffersP;
  adminOffersP=(async()=>{try{
    if(typeof supabaseClient==='undefined'||!supabaseClient)return [];
    const r=await supabaseClient.rpc('pp_store_offers_public');
    return r.error||!Array.isArray(r.data)?[]:r.data;
  }catch(_){return [];}})().then(l=>{adminOffers=l;return l;});
  return adminOffersP;
}
/* an offer saved for one category (fashion, beauty, electronics, home, mobiles ...) shows only on products of that kind */
const CAT_RX={electronics:/mobile|phone|laptop|electronic|appliance|\btv|television|audio|headphone|earbud|speaker|camera|computer|tablet|gaming|wearable|smart ?watch/,mobiles:/mobile|phone/,laptops:/laptop|notebook|computer/,appliances:/appliance|refrigerator|fridge|washing|\bac\b|air condition|microwave|kitchen/,fashion:/fashion|cloth|apparel|wear|footwear|shoe|watch|bag|jewel|accessor|\bmen|women|kid|saree|kurta/,beauty:/beauty|skin|hair|makeup|make-up|fragrance|perfume|personal care|grooming|bath|serum|cosmetic|nail|lip/,home:/home|kitchen|furniture|decor|bed|dining|bath/};
function catOk(oc,cats){if(!oc)return true;if(!cats.length)return false;/* kind of product unknown: a category-only coupon is not shown */oc=String(oc).toLowerCase();return cats.some(c=>c.includes(oc)||(CAT_RX[oc]&&CAT_RX[oc].test(c)));}
function adminOffersFor(store,cats){return normOffers((adminOffers||[]).filter(o=>sameStore(o.store,store)&&catOk(o.category,cats)));}
function normOffers(list){
  return list
    .map(o=>{const viaCard=o.kind==='coupon'&&/\b(credit|debit)\s*cards?\b/i.test(o.title||'');/* "Rs 500 off using Tata Neu credit cards" needs that card: it is a bank offer */
      return {store:o.store,kind:viaCard?'bank':o.kind,bank:o.bank||(viaCard?(((o.title||'').match(/(?:using|with|on|via)\s+([A-Za-z][A-Za-z ]{1,24}?)\s+(?:bank\s+)?(?:credit|debit)/i)||[])[1]||null):null),pct:o.pct!=null?Number(o.pct):null,amount:o.flat!=null?Number(o.flat):null,cap:o.cap!=null?Number(o.cap):null,min:o.min_order!=null?Number(o.min_order):null,code:o.code||null,text:o.title,src:o.source||'admin',category:o.category||null,till:o.valid_till||null,url:o.url||null};})
    .map((o,i,l)=>o.code&&l.some(x=>x.code&&x.store===o.store&&String(x.code).toUpperCase()===String(o.code).toUpperCase()&&NEWU.test(x.text||''))?{...o,newu:true}:o) /* one title says "first purchase": the code is for new users */
    .filter((o,i,l)=>{if(!o.code)return true;const k=String(o.code).toUpperCase(),sc=x=>(x.src!=='cuelinks'?1e9:0)+(x.pct||0)*1e4+(x.amount||0)+(x.cap||0)/1e3;
      return !l.some((x,j)=>j!==i&&x.code&&x.store===o.store&&String(x.code).toUpperCase()===k&&(sc(x)>sc(o)||(sc(x)===sc(o)&&j<i)));}); // same code twice (Cuelinks sends some codes under 2 titles): keep one
}

/* ---------- V270: card rewards (pp_card_rewards) + "My cards" + Saving stack ---------- */
let cardRewards=null,cardRewardsP=null;
function loadCardRewards(){
  if(cardRewardsP)return cardRewardsP;
  cardRewardsP=(async()=>{try{
    if(typeof supabaseClient==='undefined'||!supabaseClient)return [];
    const r=await supabaseClient.rpc('pp_card_rewards_public');
    return r.error||!Array.isArray(r.data)?[]:r.data;
  }catch(_){return [];}})().then(l=>{cardRewards=l;return l;});
  return cardRewardsP;
}
const MYC='ppMyCards';
function myCards(){try{const a=JSON.parse(localStorage.getItem(MYC)||'[]');return Array.isArray(a)?a:[];}catch(_){return [];}}
function setMyCards(a){try{localStorage.setItem(MYC,JSON.stringify(a));}catch(_){}}
const BANK_C={hdfc:'#2E614E',sbi:'#2B6CB0',axis:'#97144D',icici:'#B02A30',kotak:'#ED1C24',indusind:'#8B1D41',yes:'#36735D',idfc:'#9C1D26',au:'#6B2C91',rbl:'#21409A',hsbc:'#DB0011',amex:'#2671B9',bob:'#F15A29',onecard:'#111'};
function bankBadge(b){const k=String(b||'').toLowerCase().replace(/[^a-z]/g,'').replace(/bank$/,'');const c=Object.keys(BANK_C).find(x=>k.startsWith(x));const t=String(b||'₹').replace(/bank/i,'').trim().slice(0,c==='indusind'?3:4).toUpperCase()||'₹';return `<i class="ppf-bk" style="--bk:${c?BANK_C[c]:'#616D66'}" aria-hidden="true">${H(t)}</i>`;}
/* every card's best reward on this store (store row beats the "*" any-online row); sorted by ₹ back */
function cardsFor(store,pay,skipBank){
  if(!Array.isArray(cardRewards)||!Number.isFinite(pay)||pay<=0)return [];
  const by=new Map();
  cardRewards.forEach(c=>{if(c.store!=='*'&&!sameStore(c.store,store))return;if(skipBank&&normStore(c.bank)===normStore(skipBank))return;const cur=by.get(c.card);if(!cur||(cur.store==='*'&&c.store!=='*'))by.set(c.card,c);});
  return [...by.values()].map(c=>{let v=pay*Number(c.pct)/100;if(c.cap)v=Math.min(v,Number(c.cap));return {...c,save:Math.round(v),own:c.store!=='*'};})
    .filter(c=>c.save>0).sort((a,b)=>b.save-a.save||(b.own-a.own));
}
/* best card for the shopper: one of "My cards" if any are picked, else the best card overall */
function bestCard(store,pay,skipBank){const l=cardsFor(store,pay,skipBank);const mine=myCards();if(mine.length){return l.find(c=>mine.includes(c.card))||null;}return l[0]||null;}
const CAP_P={month:'a month',quarter:'a quarter',statement:'a statement',year:'a year',order:'an order'};
function cardRowHTML(c){
  const mine=myCards().includes(c.card);
  return `<div class="ppf-cr${mine?' is-mine':''}">${bankBadge(c.bank)}<span class="ppf-cr-n"><b>${H(c.card)}</b><small>${H(c.note||'')}${c.cap&&!/up to/i.test(c.note||'')?` · max ${M(c.cap)} ${CAP_P[c.cap_period]||''}`:''}</small></span><span class="ppf-cr-v"><b>-${M(c.save)}</b><em>${Number(c.pct)}% ${c.reward==='points'?'points':'back'}</em></span></div>`;
}
/* V273: one card pays the bill. A bank offer needs that bank's card, so a card reward can only add to it from the same bank.
   Two ways are tried: (A) bank offer + coupon + same-bank card reward, (B) coupon + best card reward, no bank offer. The bigger one wins. */
function sameBank(a,b){const x=normStore(a).replace(/bank$/,''),y=normStore(b).replace(/bank$/,'');return !!x&&!!y&&(x.startsWith(y)||y.startsWith(x));}
function plan(store,price,all){
  const calc=netCalc(all,price),cpn=calc.coupon?calc.coupon.save:0,mine=myCards(),gift=calc.gift?calc.gift.save:0;
  let A=null;
  if(calc.bank){
    const ob=calc.bank.offer,pay=price-calc.save;
    const l=/cashback/i.test(ob.text||'')||!['admin','cuelinks'].includes(ob.src)?[]:cardsFor(store,pay,null).filter(c=>sameBank(c.bank,ob.bank)); /* a bank offer read from the store page often already is the card's cashback */
    const c=(mine.length?l.find(x=>mine.includes(x.card)):l[0])||null;
    A={offers:calc.save,card:c,pay,dropBank:false};
  }
  const payB=price-cpn,cB=bestCard(store,payB,null);
  const B={offers:cpn,card:cB,pay:payB,dropBank:!!calc.bank};
  const tot=x=>x.offers+(x.card?x.card.save:0);
  const best=!A||tot(B)>tot(A)?B:A;
  return {calc,gift,...best,total:tot(best),final:price-tot(best)-gift,listPay:payB};
}
/* adds offer panel, net price and the "Save ₹X more" line to each row */
function decorateRows(rows,ownOffers,srcRow,cats,snOf){
  let srcHasPanel=false;
  const out=rows.map(r=>{
    const own=srcRow&&r===srcRow?ownOffers:[];
    const all=own.concat(adminOffersFor(r.store,cats));
    const priced=Number.isFinite(r.price)&&r.inStock!==false;
    const pl=priced?plan(r.store,r.price,all):null;
    const calc=pl&&all.length?pl.calc:null;
    const card=pl?pl.card:null,gift=pl?pl.gift:0;
    const extra=pl?gift+pl.total-(calc?calc.save:0):0;
    if(!all.length&&!card)return r;
    if(r===srcRow&&all.length)srcHasPanel=true;
    const sn=snOf(r);
    return {...r,net:calc&&calc.save?{save:calc.save}:null,more:extra>0?{save:extra,gift:!!gift,card:!!card}:null,plan:pl,
      offHTML:offersPanelHTML(all,priced?r.price:NaN,calc,sn,r===srcRow&&own.length>0,r.store,r===srcRow,pl?cardsFor(r.store,pl.listPay,null).slice(0,6):[])};
  });
  return {rows:out,srcHasPanel};
}
/* Saving stack: side panel for one store (the lowest priced row) */
let stackPick=null,stackCats=[];
function stackHTML(rows){
  const pr=rows.filter(r=>Number.isFinite(r.price)&&r.inStock!==false);
  if(!pr.length||!Array.isArray(cardRewards))return '';
  const P=x=>x.plan||plan(x.store,x.price,adminOffersFor(x.store,stackCats));
  const lo=pr.slice().sort((a,b)=>P(a).final-P(b).final)[0];
  const r=(stackPick&&pr.find(x=>sameStore(x.store,stackPick)))||lo;
  const pl=P(r),calc=pl.calc,bc=pl.card,final=pl.final;
  const cards=cardsFor(r.store,pl.listPay,null);const mine=myCards();
  const shown=mine.length?cards.filter(c=>mine.includes(c.card)).concat(cards.filter(c=>!mine.includes(c.card))):cards;
  const tabs=pr.length>1?`<div class="ppf-stk-tabs" role="tablist">${pr.slice(0,6).map(x=>`<button type="button" role="tab" data-ppf-stk="${H(x.store)}" aria-selected="${x===r}"${x===r?' class="is-on"':''}>${H(storeLabel(x.store))}</button>`).join('')}</div>`:'';
  return `<aside class="ppf-stack" aria-label="Saving stack">
    <div class="ppf-stk-h"><b>Saving stack</b><small>${H(storeLabel(r.store))} · ${M(r.price)}</small></div>${tabs}
    <div class="ppf-stk-best"><span>Best you can pay</span><b>${M(final)}</b><small>${[calc.coupon&&pl.offers?`coupon -${M(calc.coupon.save)}`:'',calc.bank&&!pl.dropBank?`${H(calc.bank.offer.bank||'bank')} card offer -${M(calc.bank.save)}`:'',calc.gift?`gift card -${M(calc.gift.save)}`:'',bc?`${H(bc.card.replace(/ credit card$/i,''))} -${M(bc.save)}`:''].filter(Boolean).join(' · ')||'No extra savings found'}</small>${calc.bank&&!pl.dropBank&&!pl.card?`<small class="ppf-stk-why">This price needs a ${H(calc.bank.offer.bank||'bank')} card. The card rewards below are other ways to pay, not extra on top.</small>`:''}${pl.dropBank?`<small class="ppf-stk-why">Paying with this card saves more than the ${H(calc.bank.offer.bank||'bank')} offer, so that offer is left out.</small>`:''}</div>
    ${window.ppCashback?window.ppCashback.span(r.store,r.price,stackCats[0]||'','stack'):''}
    ${calc.gift?`<div class="ppf-stk-s"><h3>Gift card</h3><div class="ppf-cr">${bankBadge('GC')}<span class="ppf-cr-n"><b>${H(storeLabel(r.store))} gift card</b><small>${H(calc.gift.offer.text||'')}</small></span><span class="ppf-cr-v"><b>-${M(calc.gift.save)}</b><em>${calc.gift.offer.pct?calc.gift.offer.pct+'% off':''}</em></span></div></div>`:''}
    <div class="ppf-stk-s"><div class="ppf-stk-sh"><h3>Credit card rewards</h3><button type="button" class="ppf-addc" data-ppf-cards>${mine.length?`My cards (${mine.length})`:'+ Add your cards'}</button></div>
      ${shown.length?shown.slice(0,8).map(cardRowHTML).join(''):'<p class="ppf-muted">No card rewards for this store yet.</p>'}</div>
    <p class="ppf-off-note">Card rewards come after you pay and follow each bank's limits. Rates are taken from the banks' pages and can change.</p>
  </aside>`;
}
function cardsPickerHTML(){
  const names=[...new Map((cardRewards||[]).map(c=>[c.card,c])).values()].sort((a,b)=>a.bank.localeCompare(b.bank)||a.card.localeCompare(b.card));
  const mine=myCards();
  return `<div class="ppf-cp" role="dialog" aria-modal="true" aria-label="Your cards"><div class="ppf-cp-in">
    <div class="ppf-cp-h"><b>Which cards do you have?</b><button type="button" data-ppf-cpx aria-label="Close">×</button></div>
    <p class="ppf-muted">We show savings for your cards first. Saved only on this device.</p>
    <div class="ppf-cp-l">${names.map(c=>`<label class="ppf-cp-i">${bankBadge(c.bank)}<span>${H(c.card)}</span><input type="checkbox" value="${H(c.card)}"${mine.includes(c.card)?' checked':''}></label>`).join('')}</div>
    <div class="ppf-cp-f"><button type="button" class="ppf-act" data-ppf-cpclear>Clear</button><button type="button" class="ppx-btn ppx-btn-primary" data-ppf-cpok>Done</button></div>
  </div></div>`;
}
let stackRepaint=null;
function paintStack(out,rows,cats){
  const host=out;if(!host)return;if(cats)stackCats=cats;
  let a=host.querySelector(':scope>.ppf-stack');const html=stackHTML(rows);
  stackRepaint=()=>paintStack(out,rows);
  let bar=host.querySelector(':scope>.ppf-stkbar');
  if(!html){a&&a.remove();bar&&bar.remove();closeSheet();host.classList.remove('has-stack');return;}
  const sheet=!!(a&&a.classList.contains('is-sheet'));
  const t=document.createElement('div');t.innerHTML=html;const n=t.firstElementChild;
  if(sheet)n.classList.add('is-sheet');
  n.querySelector('.ppf-stk-h').insertAdjacentHTML('beforeend','<button type="button" class="ppf-stk-x" data-ppf-sheetx aria-label="Close">×</button>');
  if(a)a.replaceWith(n);else{const m=host.querySelector(':scope>.ppf-main');m?m.after(n):host.appendChild(n);}
  host.classList.add('has-stack');
  /* phones and tablets: a bar fixed at the bottom opens the Saving stack as a sheet */
  if(!bar){bar=document.createElement('button');bar.type='button';bar.className='ppf-stkbar';bar.setAttribute('data-ppf-sheet','');host.appendChild(bar);}
  const best=(n.querySelector('.ppf-stk-best b')||{}).textContent||'',sn=((n.querySelector('.ppf-stk-h small')||{}).textContent||'').split('·')[0].trim();
  bar.innerHTML=`<span><small>Best you can pay${sn?' at '+H(sn):''}</small><b>${H(best)}</b></span><em>View savings <i aria-hidden="true">›</i></em>`;
}
function openSheet(){const st=document.querySelector('.ppf-stack');if(!st||window.innerWidth>=1100)return false;st.classList.add('is-sheet');st.scrollTop=0;document.body.classList.add('ppf-sheet-on');if(!document.querySelector('.ppf-sheet-bd'))document.body.insertAdjacentHTML('beforeend','<div class="ppf-sheet-bd" data-ppf-sheetx></div>');return true;}
function closeSheet(){document.querySelectorAll('.ppf-stack.is-sheet').forEach(x=>x.classList.remove('is-sheet'));document.body.classList.remove('ppf-sheet-on');document.querySelectorAll('.ppf-sheet-bd').forEach(x=>x.remove());}
window.addEventListener('hashchange',closeSheet);
if(!window.__ppfStack){window.__ppfStack=1;document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-ppf-stk],[data-ppf-cards],[data-ppf-cpx],[data-ppf-cpok],[data-ppf-cpclear],[data-ppf-sheet],[data-ppf-sheetx]');if(!t)return;
  if(t.hasAttribute('data-ppf-sheet')){openSheet();return;}
  if(t.hasAttribute('data-ppf-sheetx')){closeSheet();return;}
  if(t.dataset.ppfStk){stackPick=t.dataset.ppfStk;stackRepaint&&stackRepaint();if(t.classList.contains('ppf-moreS'))openSheet();return;}
  if(t.hasAttribute('data-ppf-cards')){if(!document.querySelector('.ppf-cp'))document.body.insertAdjacentHTML('beforeend',cardsPickerHTML());return;}
  const cp=document.querySelector('.ppf-cp');if(!cp)return;
  if(t.hasAttribute('data-ppf-cpclear')){cp.querySelectorAll('input').forEach(i=>i.checked=false);return;}
  if(t.hasAttribute('data-ppf-cpok'))setMyCards([...cp.querySelectorAll('input:checked')].map(i=>i.value));
  cp.remove();
  if(t.hasAttribute('data-ppf-cpok'))window.dispatchEvent(new Event('ppf-cards'));
});}

function rowsHTML(rows,link,noLow){
  const lo=noLow?null:lowestOf(rows);
  const priced=rows.filter(r=>Number.isFinite(r.price)&&r.inStock!==false);
  const minP=priced.length?Math.min(...priced.map(r=>r.price)):null;
  const tie=!noLow&&priced.length>1&&priced.filter(r=>r.price===minP).length>1;
  return `<ol class="ppf-rows">${rows.map(r=>{
    const isLow=!!lo&&lo.unique&&lo.count>1&&r===lo.row;
    const isTie=tie&&Number.isFinite(r.price)&&r.inStock!==false&&r.price===minP;
    const yours=link&&sameStore(r.store,link.store);
    const tag=r.kind==='verified'?`Verified ${ago(r.checkedAt)||''}`.trim():r.kind==='live'?`Seen ${ago(r.seenAt)||'just now'}${r.match==='similar'?' · similar product':''}`:r.kind==='search'?'Search results':'Product page';
    const extra=[r.delivery?`Delivery ${H(r.delivery)}`:'',r.deliveryCharge?H(r.deliveryCharge):''].filter(Boolean).join(' · ');
    const more=!noLow&&priced.length>1&&minP!=null&&Number.isFinite(r.price)&&r.inStock!==false&&r.price>minP?`<small class="ppf-more">${M(r.price-minP)} more</small>`:'';
    const net=r.net?`<small class="ppf-netline">Net ${M(r.price-r.net.save)} with offer</small>`:'';
    const moreS=r.more&&r.inStock!==false&&!r.offHTML?`<button type="button" class="ppf-moreS" data-ppf-stk="${H(r.store)}">Save ${M(r.more.save)} more with ${r.more.gift&&r.more.card?'gift card &amp; card rewards':r.more.gift?'a gift card':'card rewards'} <i aria-hidden="true">›</i></button>`:'';
    const cbx=Number.isFinite(r.price)&&r.inStock!==false&&window.ppCashback?window.ppCashback.span(r.store,r.price,stackCats[0]||'','tag'):'';
    const price=r.inStock===false?'<span class="ppf-oos">Out of stock</span>':Number.isFinite(r.price)?`<b class="ppf-price">${M(r.price)}</b>${more}${net}${cbx}`:'';
    const btn=isLow?'Buy':r.kind==='search'?'Search':'Open';
    return `<li class="ppf-row${isLow?' is-low':''}${isTie?' is-tie':''}${Number.isFinite(r.price)?'':' is-noprice'}"><a href="${H(r.url)}" target="_blank" rel="noopener" data-ppf-store="${H(r.store)}">
      <span class="ppf-logo">${logo(r.store)}</span>
      <span class="ppf-meta">${isLow?'<em class="ppf-badge">LOWEST</em>':''}${isTie?'<em class="ppf-badge is-same">SAME PRICE</em>':''}${yours?'<em class="ppf-badge is-you">YOUR LINK</em>':''}<small>${H(tag)}${extra?' · '+extra:''}</small></span>
      <span class="ppf-pr">${price}</span>
      <span class="ppf-go${isLow?' is-primary':''}">${btn} ↗</span></a>${moreS}${r.offHTML||''}</li>`;}).join('')}</ol>`;
}

/* ---------- page shell ---------- */
let renderToken=0;
window.ppOpenFind=url=>{
  const target='#/find/'+encodeURIComponent(url);
  if(location.hash===target)routeFind(url);else location.hash=target;
};
function storesStrip(){return `<div class="ppf-stores" aria-label="Stores we compare">${ROTATE.map(([n,src])=>`<span><img src="${src}" alt="${H(n)}"></span>`).join('')}</div>`;}
function pastePill(){return `<button type="button" class="ppf-pill" data-ppf-focus><b aria-hidden="true">↑</b>Paste any product link in the search bar<small>Amazon, Flipkart, Croma &amp; more</small></button>`;}
/* V276 (P8): one Price Check page. The head (title, the box, store logos) stays the same before and after a link is pasted;
   with a link the head gets compact and the result shows under it. Steps and deals show only while the box is empty. */
function headHTML(compact){
  return `<section class="ppf-hero${compact?' is-compact':''}">
      <span class="ppx-eyebrow">PASTE · COMPARE · SAVE</span>
      <h1>Find the best price for <span class="ppx-gold-text">any product</span></h1>
      ${compact?'':'<p>Paste a product link from any store. We match the exact product and show every store\'s price.</p>'}
      <div class="ppf-box-slot"></div>
      ${storesStrip()}
    </section>`;
}
function landingHTML(){
  const deals=topDeals('',null,4);
  return `${headHTML(false)}
    <section class="ppf-sec"><div class="ppf-how">
      <div class="ppf-step"><i>1</i><b>Copy the product link</b><span>From the store's app or website (Share → Copy link).</span></div>
      <div class="ppf-step"><i>2</i><b>Paste it in the box above</b><span>We read the link and find the same product on other stores.</span></div>
      <div class="ppf-step"><i>3</i><b>Buy at the lowest price</b><span>We show the same product on other stores, lowest first.</span></div>
    </div></section>
    ${deals.length?`<section class="ppf-sec"><div class="ppf-sec-h"><h2>Hot verified deals</h2><a class="ppf-link" href="#/deals">See all deals →</a></div>${dealCardsHTML(deals)}</section>`:''}
    ${recentHTML('')}
    <section class="ppf-sec"><div class="ppf-sec-h"><h2>Shop by category</h2></div><div class="ppf-cats">${CATS.map(([c,n])=>`<button type="button" data-ppf-cat="${c}">${H(n)}</button>`).join('')}</div></section>`;
}
function bindPage(root,link){
  root.addEventListener('click',e=>{
    if(e.target.closest('[data-ppf-focus]')){focusHeaderSearch();return;}
    const op=e.target.closest('[data-ppf-open]');if(op){window.ppOpenFind(op.dataset.ppfOpen);return;}
    const cat=e.target.closest('[data-ppf-cat]');if(cat){e.preventDefault();goCategory(cat.dataset.ppfCat);return;}
    const hm=e.target.closest('[data-ppf-home]');if(hm){e.preventDefault();window.ppGoHome?.(hm.dataset.ppfHome);return;}
  });
}
function goCategory(cat){
  window.ppGoHome?.('#deals');
  setTimeout(()=>{document.querySelector(`.category-nav [data-cat="${cat}"]`)?.click();document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'});},80);
}
function routeFind(param){
  const raw=String(param||'');
  const link=raw?K.parseStoreLink(raw):null;
  const body=!raw?landingHTML():`${headHTML(true)}<div class="ppf-result"><div id="ppfResult" aria-live="polite"></div></div>`;
  window.ppShowPage('find',`<div class="ppx-product ppx-list-page container ppf-page${raw?' has-link':''}">${K.crumbs('Price Check')}${body}</div>`);
  document.title='Price Check: find the best price | PricePulse';
  const page=document.querySelector('.ppf-page');
  placeBox();
  bindPage(page,link);
  const inp=headerInput();
  if(!raw){if(inp&&!/Mobi|Android|iPhone/i.test(navigator.userAgent))setTimeout(()=>inp.focus(),200);return;}
  if(inp&&inp.value!==raw){inp.value=raw;inp.ppfPlace?.();inp.closest('form')?.classList.toggle('is-link',!!link);}
  const out=page.querySelector('#ppfResult');
  if(!link){out.innerHTML=noteHTML('This does not look like a product link','Copy the full address of the product page (it starts with https://) and paste it in the search bar.');return;}
  if(!link.known){out.innerHTML=noteHTML(`We don't compare ${H(link.host)} yet`,'We compare Amazon, Flipkart, Croma, Vijay Sales, Reliance Digital, Tata CLiQ, Myntra, AJIO, Nykaa, Nykaa Fashion, JioMart and Meesho. Search the product name instead.');return;}
  if(link.isList){out.innerHTML=noteHTML('This link opens a list of products','Open one product and paste the address of that product page.');return;}
  runFind(link,out);
}
function noteHTML(title,text){return `<div class="ppf-card ppf-note"><p class="ppf-title">${title}</p><p class="ppf-muted">${text}</p></div>`;}

async function runFind(link,out){
  const token=++renderToken;
  out.innerHTML=`<div class="ppf-card ppf-loading"><span class="ppf-spin" aria-hidden="true"></span>Finding this product on other stores…</div>`;
  let m=null;try{m=await K.matchStoreLink(link);}catch(_){}
  if(token!==renderToken)return;
  if(m&&m.exact){renderMatched(out,m.p,link);return;}
  if(m&&!m.exact){
    out.innerHTML=`<div class="ppf-card ppf-ask"><p class="ppf-title">Is this the product?</p>${miniProductHTML(m.p)}<div class="ppf-ask-btns"><button type="button" class="ppx-btn ppx-btn-primary" data-yes>Yes, compare it</button><button type="button" class="ppx-btn ppx-btn-ghost" data-no>No, it's different</button></div></div>`;
    out.querySelector('[data-yes]').addEventListener('click',()=>renderMatched(out,m.p,link));
    out.querySelector('[data-no]').addEventListener('click',()=>renderUnknown(out,link));
    return;
  }
  renderUnknown(out,link);
}
function miniProductHTML(p){
  const b=K.bestPrice(p);const img=K.photoOf(p);
  return `<a class="ppf-mini" href="#/product/${encodeURIComponent(p.id)}"><span class="ppf-img">${img?`<img src="${H(img)}" alt="">`:ICON_BOX}</span><span><b>${H(p.name)}</b><small>${Number.isFinite(b.price)?`Best verified ${M(b.price)} · ${b.stores} stores`:`${b.stores} stores`}</small></span></a>`;
}

/* ---------- matched product (in our catalog) ---------- */
function wishBtn(p){
  const heart=document.querySelector(`.deal-card .heart[data-id="${CSS.escape(p.id)}"]`);
  if(!heart)return '';
  const on=heart.classList.contains('saved');
  return `<button type="button" class="ppf-act${on?' is-on':''}" data-ppf-wish aria-pressed="${on}"><span aria-hidden="true">${on?'♥':'♡'}</span>${on?'Saved':'Wishlist'}</button>`;
}
function renderMatched(out,p,link){
  const rows=sortRows(catalogRows(p));
  const lo=lowestOf(rows);
  const b=K.bestPrice(p);
  const best=lo?lo.price:(Number.isFinite(b.price)?b.price:null);
  let insight='';
  try{const sav=lo&&typeof window.ppOfferSavings==='function'?window.ppOfferSavings(lo.row.raw||{}):null;const a=K.dealAnalysis(p.id,best,sav,lo?lo.count:0);insight=a?K.dealInsightHTML(a,{compact:true}):'';}catch(_){}
  const target=Number.isFinite(best)?Math.max(1,Math.round(best*.97/100)*100-1):null;
  const img=K.photoOf(p);
  const yourRow=rows.find(r=>sameStore(r.store,link.store));
  const save=yourRow&&Number.isFinite(yourRow.price)&&Number.isFinite(best)&&yourRow.price>best?yourRow.price-best:0;
  const chips=[p.brand,p.category?catName(p.category):''].filter(Boolean);
  const buy=lo&&lo.unique&&lo.count>1&&!(yourRow&&yourRow===lo.row)?lo.row:null;
  out.innerHTML=`<div class="ppf-card ppf-main" data-product-id="${H(p.id)}">
    <div class="ppf-prod">
      <span class="ppf-img">${img?`<img src="${H(img)}" alt="">`:ICON_BOX}</span>
      <div class="ppf-prod-copy">
        <span class="ppf-from">From your ${H(link.store)} link · exact product</span>
        <h1>${H(p.name)}</h1>
        ${chips.length?`<div class="ppf-chips">${chips.map(c=>`<span>${H(c)}</span>`).join('')}</div>`:''}
        ${Number.isFinite(best)?`<p class="ppf-best">Best price <b>${M(best)}</b>${lo&&lo.unique?` at ${H(lo.row.store)}`:''}${save?` <span class="ppf-save">You save ${M(save)} vs ${H(link.store)}</span>`:''}</p>`:'<p class="ppf-muted">Verified prices are being checked. Open a store below to see its price now.</p>'}
        <div class="ppf-acts">
          ${buy?`<a class="ppx-btn ppx-btn-primary ppf-buy" href="${H(buy.url)}" target="_blank" rel="noopener">Buy at ${H(buy.store)} ↗</a>`:yourRow&&lo&&yourRow===lo.row&&lo.count>1?`<span class="ppf-onbest">✓ Your link already has the best price</span>`:''}
          ${wishBtn(p)}
          ${target?`<a class="ppf-act" href="#/product/${encodeURIComponent(p.id)}?alert=${target}"><span aria-hidden="true">🔔</span>Alert me at ${M(target)}</a>`:''}
          <button type="button" class="ppf-act" data-ppf-share><span aria-hidden="true">↗</span>Share</button>
        </div>
      </div>
      ${insight?`<div class="ppf-insight">${insight}</div>`:''}
    </div>
    <div class="ppf-list-h"><h2>All stores <small>${rows.length}</small></h2><span class="ppf-muted">Verified prices are checked by PricePulse.</span></div>
    <div data-ppf-rows>${rowsHTML(rows,link)}</div>
    <div data-ppf-live></div>
    <p class="ppf-fine"><a href="mailto:${CONTACT}?subject=${encodeURIComponent('Wrong product match')}&body=${encodeURIComponent(`Link: ${link.url}\nShown as: ${p.name}\n`)}">Wrong product? Report it</a> · Store links may earn us a commission at no cost to you.</p>
  </div>
  ${historyHTML(p,best)}
  ${moreDealsHTML(p.category,p.id)}
  ${recentHTML(link.url)}
  ${lo&&lo.count>1?stickyHTML(lo.row):''}`;
  saveRecent({url:link.url,name:p.name,store:link.store,price:best,img:img||'',pid:p.id});
  bindMatched(out,p,link);
  liveBlock(out,link,p);
}
function moreDealsHTML(cat,exclude){
  if(!cat)return '';
  const list=topDeals(cat,exclude,4);if(!list.length)return '';
  return `<section class="ppf-sec"><div class="ppf-sec-h"><h2>More verified deals in ${H(catName(cat))}</h2><a class="ppf-link" href="#deals" data-ppf-cat="${H(cat)}">See all →</a></div>${dealCardsHTML(list)}</section>`;
}
function stickyHTML(row){return `<div class="ppf-sticky" role="region" aria-label="Lowest price"><span>Lowest <b>${M(row.price)}</b> at</span><span class="ppf-sticky-logo">${logo(row.store)}</span><a href="${H(row.url)}" target="_blank" rel="noopener">Buy ↗</a></div>`;}
function placeSticky(){const s=document.querySelector('.ppf-sticky');if(!s)return;const bn=document.querySelector('.ppx-bottom-nav');const h=bn&&getComputedStyle(bn).display!=='none'?bn.getBoundingClientRect().height:0;s.style.bottom=(h+10)+'px';}
window.addEventListener('resize',placeSticky);
function bindMatched(out,p,link){
  out.querySelector('[data-ppf-share]')?.addEventListener('click',()=>share(`${p.name} | PricePulse`,findUrl(link.url)));
  const wb=out.querySelector('[data-ppf-wish]');
  wb?.addEventListener('click',()=>{
    const heart=document.querySelector(`.deal-card .heart[data-id="${CSS.escape(p.id)}"]`);heart?.click();
    setTimeout(()=>{const on=!!heart?.classList.contains('saved');wb.classList.toggle('is-on',on);wb.setAttribute('aria-pressed',String(on));wb.innerHTML=`<span aria-hidden="true">${on?'♥':'♡'}</span>${on?'Saved':'Wishlist'}`;},350);
  });
  placeSticky();
}

/* ---------- product not in our catalog ---------- */
const JUNKQ=/\b(processor|originos|funtouch|security|display|camera|battery|charging|fast|android|dimensity|snapdragon|bionic|amoled|mah|ram|rom|smartphone|mobile|phone)\b/gi;
function cleanQuery(t){
  const x=String(t||'').replace(/[(),|]/g,' ').replace(JUNKQ,m=>/^(smartphone|mobile|phone)$/i.test(m)?'':' ').replace(/\s+/g,' ').trim();
  return x.split(' ').filter(w=>w.length>1||/\d/.test(w)).slice(0,7).join(' ');
}
const ELEC_CATS=['mobiles','electronics','laptops','appliances'];
function catStores(cat){
  if(!cat)return ['Amazon','Flipkart'];
  return K.storesForCat(cat).filter(s=>!(ELEC_CATS.includes(cat)&&s==='Tata CLiQ'));
}
function unknownInfo(link,catOverride,pr,qOver){
  const d=K.detectProduct(link)||{};
  const prTitle=pr&&(pr.read==='page'||pr.enrichedTitle)?cleanHeading((pr.read!=='page'&&pr.enrichedTitle)?pr.enrichedTitle:pr.title,link.store):'';
  const title=prTitle||slugTitle(link);
  const text=title+' '+(link.words||[]).join(' ')+' '+(pr&&Array.isArray(pr.category)?pr.category.join(' '):'');
  let cat=catOverride||(d.category&&d.category!=='other'?d.category:'')||guessCat(text);
  const sure=!!catOverride||(!!cat&&!!(d.category&&d.category!=='other'))||(!!cat&&!!prTitle);
  let q=qOver||(title?cleanQuery(title)||searchQuery(title):(K.canSearchStores(d)?K.detQuery(d):''));
  if(!qOver&&q&&q.split(' ').length<2){const w={mobiles:'smartphone',laptops:'laptop'}[cat];if(w)q+=' '+w;}
  const rows=[{store:link.store,url:link.url,price:null,kind:'link'}];
  if(q)catStores(cat).filter(s=>!sameStore(s,link.store)).forEach(s=>{const f=K.STORE_SEARCH.find(([n])=>n===s);if(f)rows.push({store:s,url:f[1](q),price:null,kind:'search'});});
  return {d,title,q,cat,sure,rows,catOverride:catOverride||''};
}
function renderUnknown(out,link,catOverride){
  const info=unknownInfo(link,catOverride);
  const {title,q,cat,sure,rows}=info;
  const signed=signedIn();
  out.innerHTML=`<div class="ppf-card ppf-main ppf-unknown">
    <div class="ppf-prod">
      <span class="ppf-img ppf-img-ph">${ICON_BOX}</span>
      <div class="ppf-prod-copy">
        <span class="ppf-from">From your ${H(link.store)} link</span>
        <h1>${title?H(title):`Product from your ${H(link.store)} link`}</h1>
        <div class="ppf-chips">${cat?`<span>${H(catName(cat))}</span>`:''}<span class="is-plain">Not tracked yet</span></div>
        <p class="ppf-muted">We don't have verified prices for this product yet. Track it and we will add it.</p>
        <div class="ppf-acts ppf-track">
          <button type="button" class="ppx-btn ppx-btn-primary" data-ppf-track>Track this product</button>
          ${signed?`<label class="ppf-target"><span>Alert me below</span><b>₹</b><input name="target" inputmode="numeric" placeholder="e.g. 799" autocomplete="off"></label>`:`<button type="button" class="ppf-act" data-ppf-signin><span aria-hidden="true">🔔</span>Sign in for a price alert</button>`}
          <button type="button" class="ppf-act" data-ppf-share><span aria-hidden="true">↗</span>Share</button>
        </div>
        <p class="ppf-done" data-ppf-done hidden></p>
      </div>
    </div>
    <div class="ppf-list-h"><h2>${q?'Find it on other stores':'Open the product'}</h2><span class="ppf-muted">${q?'Prices open on each store.':''}</span></div>
    <p class="ppf-muted ppf-qline" data-ppf-q></p>
    <div data-ppf-rows>${rowsHTML(rows,link)}</div>
    <div class="ppf-catpick${sure?'':' is-ask'}"><span>${sure?'Wrong stores?':'What is this product?'}</span>${CATS.map(([c,n])=>`<button type="button" data-ppf-pick="${c}"${c===cat?' class="is-on" aria-pressed="true"':''}>${H(n)}</button>`).join('')}</div>
    <div data-ppf-live></div>
    <p class="ppf-fine">We add products people ask for. Store links may earn us a commission at no cost to you.</p>
  </div>
  ${moreDealsHTML(cat,null)}
  ${recentHTML(link.url)}`;
  saveRecent({url:link.url,name:title||`${link.store} product`,store:link.store,price:null,img:''});
  out.querySelectorAll('[data-ppf-pick]').forEach(btn=>btn.addEventListener('click',()=>renderUnknown(out,link,btn.dataset.ppfPick)));
  out.querySelector('[data-ppf-signin]')?.addEventListener('click',()=>document.getElementById('signInBtn')?.click());
  out.querySelector('.ppf-unknown')?.addEventListener('click',e=>{
    const eb=e.target.closest('[data-ppf-editq]');if(!eb)return;
    const hdr=out.querySelector('[data-ppf-q]');if(!hdr)return;
    hdr._h='';hdr.innerHTML=`<form class="ppf-qform"><input type="text" value="${H(out.dataset.ppfQ||q||'')}" maxlength="80" aria-label="Product name to search"><button type="submit">Search</button></form>`;
    const inp=hdr.querySelector('input');inp.focus();inp.select();
    hdr.querySelector('form').addEventListener('submit',ev=>{
      ev.preventDefault();const v=inp.value.replace(/\s+/g,' ').trim().slice(0,80);
      out.dataset.ppfQ=v;
      const inf=unknownInfo(link,catOverride||'',null,v);
      const rb=out.querySelector('[data-ppf-rows]');if(rb)rb.innerHTML=rowsHTML(inf.rows,link);
      paintSearchBits(out,inf);
    });
  });
  out.querySelector('[data-ppf-share]')?.addEventListener('click',()=>share(`${title||'Product'} | PricePulse`,findUrl(link.url)));
  const tb=out.querySelector('[data-ppf-track]');
  tb?.addEventListener('click',async()=>{
    const tIn=out.querySelector('.ppf-target input');
    const target=Number(String(tIn?.value||'').replace(/[^\d]/g,''))||null;
    tb.disabled=true;tb.textContent='Sending…';
    let r={ok:false};try{r=await K.requestTrack(link.url,link.key,link.store);}catch(_){}
    if(r.ok&&target){try{await K.trackFollowup(link.key,null,target);}catch(_){}}
    const done=out.querySelector('[data-ppf-done]');
    tb.textContent='✓ Tracking';
    if(done){done.hidden=false;done.textContent=r.ok?`Got it. We will add verified prices for this product soon.${target?` We'll alert you below ${M(target)}.`:''}${r.data?.count>1?` ${r.data.count} shoppers have asked for it.`:''}`:'Saved on this device. We will send it when you are back online.';}
  });
  paintSearchBits(out,info);
  liveBlock(out,link,null,info);
}

/* Product header for a product we do not track (V262): real title, brand, variant, rating, photos, product details.
   Everything comes from the extension; nothing is saved. Amazon pages are never read, so for an Amazon link the
   photos / details are borrowed from the same product on another store and the page says so. */
/* Store breadcrumbs start with the store name and end with the product name: neither is a category */
function cleanCrumbs(list,pr){
  const c=(Array.isArray(list)?list:[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim());
  const stores=[pr.storeName,pr.enrichedFrom].filter(Boolean).map(x=>String(x).toLowerCase());
  if(c.length&&stores.includes(c[0].toLowerCase()))c.shift();
  const tok=t=>String(t||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2);
  const titleWords=new Set([...tok(pr.title),...tok(pr.enrichedTitle)]);
  if(c.length){
    const last=c[c.length-1],lw=tok(last);
    const overlap=lw.length?lw.filter(w=>titleWords.has(w)).length/lw.length:0;
    if(overlap>=.6||/\d+\s?(gb|tb|ml|kg|mah|inch|w)\b/i.test(last)||last.length>45)c.pop();
  }
  return c;
}
const imgKey=u=>String(u||'').replace(/[?#].*$/,'');
function cleanHeading(t,store){
  let x=String(t||'').replace(/\s+/g,' ').trim();
  x=x.replace(/\s*[|–—]\s*[^|–—]*$/,m=>/\b(buy|online|price|best|offers?|india|store|shop|croma|flipkart|amazon|reliance|vijay|tata|jiomart|ajio|myntra|nykaa)\b/i.test(m)?'':m);
  x=x.replace(/\s+-\s+(buy|shop)?[^-]*\b(online|croma|flipkart|amazon|reliance digital|vijay sales|tata cliq|jiomart|ajio|myntra|nykaa)\b[^-]*$/i,'');
  x=x.replace(/^(buy|shop)\s+/i,'').replace(/\s+(online|at best price[^|]*|online at best price[^|]*|online in india)\s*$/i,'').replace(/\s+[-–]\s*$/,'');
  return x.trim()||String(t||'').trim();
}
const BADIMG=/(^|[\/_.-])(logo|favicon|sprite|placeholder|no-?image|default|brand|banner|icon)([\/_.-]|\d|$)/i;
function fillProduct(out,link,pr,final){
  const card=out.querySelector('.ppf-unknown');if(!card||!pr)return;
  const read=pr.read==='page';
  const useEnr=!read&&!!pr.enrichedTitle;
  const t=cleanHeading(useEnr?pr.enrichedTitle:pr.title,link.store);
  const h1=card.querySelector('h1');
  if(h1&&t&&(read||useEnr||/^Product from your /.test(h1.textContent))&&h1.textContent!==t.slice(0,200))h1.textContent=t.slice(0,200);
  /* chips: brand, variant, last category step, rating */
  const chips=card.querySelector('.ppf-chips');
  if(chips){
    chips.querySelectorAll('[data-ppf-x]').forEach(x=>x.remove());
    const crumbs=cleanCrumbs(pr.category,pr);
    const have=[...chips.querySelectorAll('span')].map(x=>x.textContent.trim().toLowerCase());
    const add=[];
    if(pr.brand){const b=String(pr.brand).trim();const bc=BRANDCASE[b.toLowerCase()];add.push(bc?(/^i(phone|pad|pod|mac)$/i.test(b)?'Apple':bc):(b===b.toLowerCase()?b.replace(/\b\w/g,c=>c.toUpperCase()):b));}
    if(pr.variant)add.push(String(pr.variant));
    if(crumbs.length&&!have.includes(crumbs[crumbs.length-1].toLowerCase()))add.push(crumbs[crumbs.length-1]);
    if(pr.rating)add.push({star:true,t:`${pr.rating}${pr.ratingCount?` (${pr.ratingCount})`:''}`});
    chips.insertAdjacentHTML('beforeend',add.slice(0,5).map(x=>x&&x.star?`<span data-ppf-x class="ppf-rate"><i class="ppf-star" aria-hidden="true">★</i> ${H(x.t)}</span>`:`<span data-ppf-x>${H(x)}</span>`).join(''));
  }
  /* photos */
  const seen=new Set();
  const imgs=[pr.image,...(Array.isArray(pr.images)?pr.images:[])].filter(u=>{if(typeof u!=='string'||!/^https:\/\//.test(u)||BADIMG.test(u.split('?')[0]))return false;const k=imgKey(u);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,4);
  const box=card.querySelector('.ppf-prod>.ppf-img');
  const copy=card.querySelector('.ppf-prod-copy');
  const key=imgs.map(imgKey).join('|');
  if(box&&imgs.length&&box.dataset.ppfKey!==key){
    box.dataset.ppfKey=key;
    box.classList.remove('ppf-img-ph');
    box.innerHTML='';
    const main=document.createElement('img');main.alt='';main.referrerPolicy='no-referrer';main.src=imgs[0];
    main.onerror=()=>{box.classList.add('ppf-img-ph');box.innerHTML=ICON_BOX;};
    box.appendChild(main);
    copy?.querySelectorAll(':scope>.ppf-thumbs,:scope>.ppf-src').forEach(x=>x.remove());
    const anchor=chips||copy?.querySelector('h1');
    let after=anchor;
    if(imgs.length>1&&anchor){
      const bar=document.createElement('div');bar.className='ppf-thumbs';
      imgs.forEach((u,i)=>{
        const b=document.createElement('button');b.type='button';b.className='ppf-th'+(i?'':' is-on');b.setAttribute('aria-label','Photo '+(i+1));
        const im=document.createElement('img');im.src=u;im.alt='';im.loading='lazy';im.referrerPolicy='no-referrer';im.onerror=()=>b.remove();b.appendChild(im);
        const show=()=>{main.src=u;bar.querySelectorAll('.ppf-th').forEach(x=>x.classList.toggle('is-on',x===b));};
        b.addEventListener('mouseenter',show);b.addEventListener('click',show);bar.appendChild(b);
      });
      anchor.insertAdjacentElement('afterend',bar);after=bar;
    }
    if(pr.enrichedFrom&&after)after.insertAdjacentHTML('afterend',`<p class="ppf-muted ppf-src">Matched on ${H(pr.enrichedFrom)}${pr.enrichedTitle?`: <b>${H(pr.enrichedTitle)}</b>`:''}. Photos and details are from there.</p>`);
  }
  /* product details (same block as the product page) */
  if(typeof window.ppDetailsBlockHTML==='function'&&pr.details){
    const fields={},specs={};
    Object.entries(pr.details.fields||{}).forEach(([k,v])=>{if(v==null||String(v).trim()==='')return;const sv=String(v).trim();if((k==='model'||k==='mpn')&&(/^\d{5,}$/.test(sv)||(pr.key&&sv.toLowerCase()===String(pr.key).toLowerCase())))return;fields[k]={v};});
    Object.entries(pr.details.specs||{}).forEach(([k,v])=>{if(v!=null&&String(v).trim()!=='')specs[k]={v};});
    const src=pr.enrichedFrom||pr.storeName||'';
    let html='';
    try{html=window.ppDetailsBlockHTML({fields,specs,category:cleanCrumbs(pr.category,pr),stores:src?[src]:[],note:`Only what ${src||'the store'} states on its page${pr.enrichedFrom?' for this product':''}. Not checked by PricePulse.`})||'';}catch(_){}
    let sec=out.querySelector('[data-ppf-ddet]');
    if(html){
      if(!sec){sec=document.createElement('section');sec.className='ppd';sec.setAttribute('data-ppf-ddet','');card.insertAdjacentElement('afterend',sec);}
      if(sec._html!==html){sec._html=html;sec.innerHTML=html;}
    }
  }
  /* recently compared: real name and photo instead of the link words */
  if(final&&(read||imgs.length)){saveRecent({url:link.url,name:(h1&&h1.textContent)||t||`${link.store} product`,store:link.store,price:null,img:imgs[0]||''});}
}

/* ---------- live prices from the extension (or an install note) ---------- */

/* ---------- V263: price history seen by shoppers (cheapest store, untracked products) ---------- */
const histCache=new Map();
function seenHistory(store,key){
  const id=store+'|'+key;
  if(histCache.has(id))return histCache.get(id);
  const pr=(async()=>{try{
    if(typeof supabaseClient==='undefined'||!supabaseClient)return [];
    const r=await supabaseClient.rpc('pp_ext_seen_history',{p_store:store,p_key:key});
    return r.error||!Array.isArray(r.data)?[]:r.data;
  }catch(_){return [];}})();
  histCache.set(id,pr);return pr;
}
function histChartHTML(pts,storeName,nowPrice){
  const fmt=n=>'₹'+Math.round(n).toLocaleString('en-IN');
  const dayMs=864e5;
  let a=pts.map(x=>({t:Date.parse(x.d+'T12:00:00+05:30'),p:Number(x.p)})).filter(x=>x.t&&x.p>0).sort((x,y)=>x.t-y.t);
  if(a.length>=3){const s=a.map(x=>x.p).sort((x,y)=>x-y),med=s[Math.floor(s.length/2)];a=a.filter(x=>x.p>=med*0.4&&x.p<=med*2.5);}
  if(Number.isFinite(nowPrice)&&nowPrice>0){const today=Date.now();const last=a[a.length-1];if(!last||today-last.t>dayMs*0.5||last.p!==nowPrice)a.push({t:today,p:nowPrice});}
  const label=`<span class="ppf-hist-tag">Seen by shoppers · not verified by PricePulse</span>`;
  if(a.length<3){
    return `<div class="ppf-hist"><div class="ppf-list-h"><h2>Price history</h2>${label}</div><p class="ppf-muted">Price tracking started on ${H(storeName)}. The graph appears after a few more visits.</p></div>`;
  }
  const W=320,Ht=96,pad=6,lo=Math.min(...a.map(x=>x.p)),hi=Math.max(...a.map(x=>x.p)),t0=a[0].t,t1=a[a.length-1].t||t0+1;
  const X=t=>pad+(t1===t0?0.5:(t-t0)/(t1-t0))*(W-pad*2),Y=v=>hi===lo?Ht/2:pad+(1-(v-lo)/(hi-lo))*(Ht-pad*2);
  let d='';a.forEach((x,i)=>{d+=(i?`L${X(x.t).toFixed(1)} ${Y(a[i-1].p).toFixed(1)}L${X(x.t).toFixed(1)} ${Y(x.p).toFixed(1)}`:`M${X(x.t).toFixed(1)} ${Y(x.p).toFixed(1)}`);});
  const avg=a.reduce((s,x)=>s+x.p,0)/a.length,cur=a[a.length-1].p;
  const days=Math.max(1,Math.round((t1-t0)/dayMs));
  return `<div class="ppf-hist"><div class="ppf-list-h"><h2>Price history</h2>${label}</div>
    <svg class="ppf-hist-svg" viewBox="0 0 ${W} ${Ht}" preserveAspectRatio="none" role="img" aria-label="Price history on ${H(storeName)}"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
    <div class="ppf-hist-stats"><span>Lowest <b>${fmt(lo)}</b></span><span>Average <b>${fmt(avg)}</b></span><span>Highest <b>${fmt(hi)}</b></span></div>
    <p class="ppf-muted ppf-hist-note">${H(storeName)} · last ${days} day${days>1?'s':''} · ${a.length} prices${cur<=lo?' · now at its lowest seen':''}</p></div>`;
}
const ownSeen=new Map();
/* "Searched for" line + category picker state, refreshed whenever the extension tells us more about the product */
function paintSearchBits(out,inf){
  const hdr=out.querySelector('[data-ppf-q]');
  if(hdr){
    const html=inf.q?`Searched for: <b>${H(inf.q)}</b> <button type="button" data-ppf-editq>Change</button>`:'';
    if(hdr._h!==html){hdr._h=html;hdr.innerHTML=html;}
  }
  const pick=out.querySelector('.ppf-catpick');
  if(pick&&inf.sure){
    pick.classList.remove('is-ask');
    const lab=pick.querySelector(':scope>span');if(lab)lab.textContent='Wrong stores?';
    pick.querySelectorAll('[data-ppf-pick]').forEach(b=>{const on=b.dataset.ppfPick===inf.cat;b.classList.toggle('is-on',on);if(on)b.setAttribute('aria-pressed','true');else b.removeAttribute('aria-pressed');});
  }
}
async function liveHistory(out,d,live,rerender){
  if(!out||!out.isConnected)return;
  const cands=[];
  const pr=d&&d.product;
  /* the linked page gave no price (pages built by script): use the latest price a shopper's extension saw, if it is recent */
  if(pr&&pr.store&&pr.key&&!(Number(pr.price)>0)&&!ownSeen.has(pr.store+'|'+pr.key)){
    const ph=await seenHistory(pr.store,pr.key);const last=ph[ph.length-1];
    const at=last?Date.parse(last.d+'T12:00:00+05:30'):0;
    if(last&&Number(last.p)>0&&Date.now()-at<2.5*864e5){
      ownSeen.set(pr.store+'|'+pr.key,{price:Number(last.p),seenAt:new Date(Math.min(at,Date.now())).toISOString()});
      try{rerender&&rerender();}catch(_){}
      return;
    }
    ownSeen.set(pr.store+'|'+pr.key,null);
  }
  if(pr&&pr.store&&pr.key&&Number(pr.price)>0)cands.push({store:pr.store,name:pr.storeName||pr.store,key:pr.key,price:Number(pr.price)});
  (d.rows||[]).forEach(r=>{if(r&&r.store&&r.key&&r.match!=='similar'&&r.match!=='no'&&Number(r.price)>0&&!cands.some(c=>c.store===r.store))cands.push({store:r.store,name:r.store,key:r.key,price:Number(r.price)});});
  if(!cands.length)return;
  cands.sort((x,y)=>x.price-y.price);
  const best=cands[0],sig=best.store+'|'+best.key+'|'+best.price;
  let box=out.querySelector('[data-ppf-hist]');
  if(!box){box=document.createElement('div');box.setAttribute('data-ppf-hist','');const lv=out.querySelector('[data-ppf-live]');if(lv)lv.insertAdjacentElement('beforebegin',box);else out.appendChild(box);}
  if(box.dataset.sig===sig)return;
  box.dataset.sig=sig;
  const pts=await seenHistory(best.store,best.key);
  if(!out.isConnected||box.dataset.sig!==sig)return;
  const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');const hit=ROTATE.find(([n])=>norm(n)===norm(best.store));const nm=hit?hit[0]:(best.name.charAt(0).toUpperCase()+best.name.slice(1)).replace(/-/g,' ');
  box.innerHTML=histChartHTML(pts,nm,best.price);
}

let lastApply=null;
window.addEventListener('ppf-cards',()=>{lastApply&&lastApply();});
/* without the extension: Admin offers + card rewards on the rows we already have */
async function plainOffers(out,link,p,info){
  await Promise.all([loadAdminOffers(),loadCardRewards()]);
  const run=()=>{
    const rowsBox=out.querySelector('[data-ppf-rows]');if(!rowsBox||!out.isConnected)return;
    const base=p?catalogRows(p):unknownInfo(link,(info&&info.catOverride)||'',null,out.dataset.ppfQ||'').rows;
    const cats=p&&p.category?[String(p.category).toLowerCase()]:info&&info.cat?[info.cat]:[];
    const dec=decorateRows(base,[],null,cats,r=>storeLabel(r.store));
    rowsBox.innerHTML=rowsHTML(sortRows(dec.rows),link);
    paintStack(out,dec.rows,cats);markScrollers(out);
  };
  lastApply=run;run();
}
async function liveBlock(out,link,p,info){
  const box=out.querySelector('[data-ppf-live]');if(!box)return;
  const ok=await waitExtension();
  if(!box.isConnected)return;
  if(!ok){
    plainOffers(out,link,p,info);
    if(canOfferInstall())box.innerHTML=`<div class="ppf-ext-note"><b>Live prices from every store</b><span>Add the free PricePulse extension and this page also checks other stores live for this exact product.</span><a class="ppx-btn ppx-btn-ghost" href="${H(EXT_STORE_URL)}" target="_blank" rel="noopener">Add to Chrome</a></div>`;
    return;
  }
  const waitHTML=`<div class="ppf-live-wait"><span class="ppf-spin" aria-hidden="true"></span>Checking other stores live…</div>`;
  box.innerHTML=waitHTML;
  /* called for every progress message (final=false) and once for the result (final=true) */
  const apply=(d,final)=>{
    if(!d||!box.isConnected)return;
    const srcP=Number(d.product&&d.product.price)||0;/* V273: an "exact" price far from the pasted product's price is most likely another size / variant */
    const live=(d.rows||[]).filter(r=>r&&r.store&&r.url&&r.match!=='no').map(r=>({store:r.store,url:r.url,price:Number(r.price)||null,inStock:r.inStock!==false,seenAt:r.seenAt||new Date().toISOString(),match:r.match==='similar'||(srcP&&Number(r.price)&&(r.price<srcP*0.6||r.price>srcP*1.6))?'similar':'exact',kind:'live',delivery:r.delivery||'',deliveryCharge:r.deliveryCharge||''}));
    const rowsBox=out.querySelector('[data-ppf-rows]');
    if(!p&&d.product&&!Number(d.product.price)){const o=ownSeen.get(d.product.store+'|'+d.product.key);if(o&&o.price){d.product.price=o.price;d.product.seenAt=o.seenAt;}}
    const inf=p?null:unknownInfo(link,(info&&info.catOverride)||'',d.product,out.dataset.ppfQ||'');
    const base=p?catalogRows(p):inf.rows.map(r=>r.kind==='link'&&Number(d.product?.price)?{...r,price:Number(d.product.price),kind:'live',seenAt:d.product.seenAt||new Date().toISOString()}:r);
    let merged=[...base];
    live.filter(r=>r.match==='exact').forEach(r=>{const i=merged.findIndex(x=>sameStore(x.store,r.store));if(i<0)merged.push(r);else if(!Number.isFinite(merged[i].price))merged[i]=r;});
    /* a store that already has a priced row does not also need its "Search results" row */
    merged=merged.filter(r=>r.kind!=='search'||!merged.some(x=>x!==r&&x.kind!=='search'&&sameStore(x.store,r.store)));
    const offersAll=(d.offers||[]).filter(o=>o&&o.text).slice(0,8);
    if(adminOffers===null)loadAdminOffers().then(()=>{if(box.isConnected)apply(d,final);});
    const cats=((d.product&&d.product.category)||[]).map(c=>String(c).toLowerCase());
    const srcRow=d.product?merged.find(r=>Number.isFinite(r.price)&&r.inStock!==false&&sameStore(r.store,d.product.store)):null;
    if(cardRewards===null)loadCardRewards().then(()=>{if(box.isConnected)apply(d,final);});
    const dec=decorateRows(merged,offersAll,srcRow,cats,r=>(d.product&&sameStore(r.store,d.product.store)&&d.product.storeName)||storeLabel(r.store));
    merged=dec.rows;const srcHasPanel=dec.srcHasPanel;
    lastApply=()=>apply(d,final);
    if(rowsBox)rowsBox.innerHTML=rowsHTML(sortRows(merged),link);
    paintStack(out,merged,cats);markScrollers(out);
    if(inf)paintSearchBits(out,inf);
    if(!p&&d.product)fillProduct(out,link,d.product,final);
    if(!p)liveHistory(out,d,live,()=>apply(d,final)).catch(()=>{});
    const similar=live.filter(r=>r.match==='similar');
    const offers=offersAll;
    if(final&&!live.length&&!offers.length){box.innerHTML=d.error?'':`<p class="ppf-muted ppf-live-none">No other store has this exact product right now.</p>`;return;}
    box.innerHTML=`${offers.length&&!srcHasPanel?offersPanelHTML(offers,NaN,null,'',true,'_page',true):''}${similar.length?`<div class="ppf-list-h"><h2>Similar products</h2><span class="ppf-muted">Not the exact same product. Check before you buy.</span></div>${rowsHTML(sortRows(similar),null,true)}`:''}${final?'':waitHTML}`;
  };
  const d=await askExtension(link.url,pd=>apply(pd,false));
  apply(d,true);
}

/* ---------- welcome page (opened by the extension after install) ---------- */
function renderWelcome(){
  if(!/^#\/welcome/.test(location.hash))return;
  const on=hasExtension();
  const test=[['Amazon','https://www.amazon.in/'],['Flipkart','https://www.flipkart.com/'],['Croma','https://www.croma.com/'],['Vijay Sales','https://www.vijaysales.com/'],['Reliance Digital','https://www.reliancedigital.in/']];
  const feats=[
    ['📈','Price history on every product page','See the real price over time and a clear Deal Score: buy now or wait.'],
    ['✅','Verified prices at other stores','The same product on other stores, checked by PricePulse. The lowest one is marked.'],
    ['🔗','Paste any link','Paste a product link in the search box to compare every store.'],
    ['🔔','Price alerts','Set your target price and we tell you when it drops.']];
  window.ppShowPage('welcome',`<div class="ppx-product ppx-list-page container ppf-page ppf-welcome">${K.crumbs('Welcome')}
    <section class="ppf-hero">
      ${on?'<span class="ppf-installed">✓ PricePulse extension is installed</span>':''}
      <h1>Welcome to <span class="ppx-gold-text">PricePulse</span></h1>
      <p>${on?'PricePulse now works on your favourite shopping sites. Open any product to see it in action.':'Install the free PricePulse extension to see price history and verified prices right on store pages.'}</p>
      ${!on&&EXT_STORE_URL?`<a class="ppx-btn ppx-btn-primary" href="${H(EXT_STORE_URL)}" target="_blank" rel="noopener">Add to Chrome, it's free</a>`:''}
      <div class="ppf-test"><span>Test it live on</span>${test.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${logo(n)}<i>↗</i></a>`).join('')}</div>
      ${on?'<p class="ppf-tip">Tip: click the puzzle icon in Chrome and pin PricePulse so it is always one click away.</p>':''}
    </section>
    <section class="ppf-feats">${feats.map(([i,t,s])=>`<div class="ppf-card ppf-feat"><span class="ppf-feat-ic" aria-hidden="true">${i}</span><b>${t}</b><p>${s}</p></div>`).join('')}</section>
    <section class="ppf-welcome-paste">${pastePill()}</section>
  </div>`);
  document.title='Welcome | PricePulse';
  bindPage(document.querySelector('.ppf-welcome'),null);
}

window.ppRegisterRoute('find',routeFind);
window.ppRegisterRoute('welcome',renderWelcome);

/* ---------- V276 (P14): product page = the same Saving stack as the Price Check page ----------
   Desktop: in the left column under the photo, next to "All stores" (sticky). Phones/tablets: under "All stores".
   Coupons and bank offers of the picked store show inside the stack (light cards, no dark blocks). */
(function(){
  let t=0;
  function build(p){
    const cats=p.category?[String(p.category).toLowerCase()]:[];
    stackCats=cats;
    const rows=catalogRows(p).filter(r=>Number.isFinite(r.price)&&r.inStock!==false).map(r=>{const all=adminOffersFor(r.store,cats);return {...r,all,plan:plan(r.store,r.price,all)};});
    if(!rows.length||!rows.some(r=>r.all.length||r.plan.card))return null;
    const html=stackHTML(rows);if(!html)return null;
    const lo=rows.slice().sort((a,b)=>a.plan.final-b.plan.final)[0];
    const r=(stackPick&&rows.find(x=>sameStore(x.store,stackPick)))||lo;
    return {html,r};
  }
  async function ensure(force){
    t=0;
    const host=document.querySelector('.ppx-product[data-product-id]');if(!host)return;
    const id=host.dataset.productId,top=host.querySelector('.ppx-top');if(!top||!host.querySelector('.ppx-stores'))return;
    /* V277 (P19): the stack is a full-width block right under the photo + stores (was: left column, sticky) */
    let el=host.querySelector(':scope>.ppf-pof');
    if(el&&el.dataset.for===id&&!force)return;
    await Promise.all([loadAdminOffers(),loadCardRewards()]);
    const p=(K.productIndex()||[]).find(x=>String(x.id)===String(id));if(!p||!host.isConnected)return;
    const b=build(p);el=host.querySelector(':scope>.ppf-pof');
    if(!b){el&&el.remove();return;}
    if(!el){el=document.createElement('div');el.className='ppf-pof';}
    if(el.previousElementSibling!==top)top.after(el);
    el.dataset.for=id;el.innerHTML=b.html;
    const r=b.r,best=el.querySelector('.ppf-stk-best');
    if(best&&r.url)best.insertAdjacentHTML('beforeend',`<a class="ppf-stk-go" href="${H(r.url)}" target="_blank" rel="noopener sponsored">Open ${H(storeLabel(r.store))} <i aria-hidden="true">↗</i></a>`);
    const offs=r.all.filter(o=>o.kind!=='giftcard');
    if(best&&offs.length)best.insertAdjacentHTML('afterend',`<div class="ppf-stk-s ppf-stk-offs"><h3>Coupons and bank offers <i>${offs.length}</i></h3>${scroller(offs.map(o=>offerCardHTML(o,r.price)).join(''))}</div>`);
    /* card rewards: top 6 in a grid, the rest behind "View all cards" */
    const cr=[...el.querySelectorAll('.ppf-stk-s .ppf-cr')];
    if(cr.length>6){const sec=cr[0].parentElement;sec.classList.add('ppf-cr-cut');sec.insertAdjacentHTML('beforeend',`<button type="button" class="ppf-cr-more" data-ppf-crmore>View all cards (${cr.length})</button>`);}
    stackRepaint=()=>ensure(true);
    markScrollers(el);
  }
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-ppf-crmore]');if(!b)return;const sec=b.parentElement,all=sec.classList.toggle('is-all');b.textContent=all?'Show fewer cards':`View all cards (${sec.querySelectorAll('.ppf-cr').length})`;});
  window.addEventListener('ppf-cards',()=>{if(document.querySelector('.ppx-product[data-product-id]'))ensure(true);});
  window.addEventListener('hashchange',()=>{if(/^#\/product\//.test(location.hash))stackPick=null;});
  const mo=new MutationObserver(()=>{if(!t)t=setTimeout(()=>ensure(false),300);});
  const start=()=>{mo.observe(document.body,{childList:true,subtree:true});ensure(false);};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();

/* ---------- V275: Coupons & offers system (premium) ----------
   Top menu (Deals · Coupons & Offers · Price History · Price Tracker), mobile bottom-nav "Offers",
   ticket-style coupon cards (Copy code + Shop now through the partner link), dark home strip,
   full Coupons page (#/offers) with sections, deal-card badges. Plus / gift cards plug in later. */
(function(){
  const NAME={coupon:'Coupon',bank:'Bank offer',giftcard:'Gift card',emi:'EMI',cashback:'Cashback',other:'Offer'};
  const dayLeft=t=>{if(!t)return null;const d=Math.round((new Date(t+'T23:59:59')-Date.now())/864e5);return d<0?null:d;};
  const ends=t=>{const d=dayLeft(t);return d==null?'':d===0?'Ends today':d===1?'Ends tomorrow':d<=7?`Ends in ${d} days`:`Valid till ${new Date(t).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`;};
  const big=o=>o.pct?`${o.pct}%<small>OFF</small>`:o.amount?`${M(o.amount)}<small>OFF</small>`:o.cap?`<small>UP TO</small>${M(o.cap)}`:H(NAME[o.kind]||'Offer');
  const line=o=>[o.pct&&o.cap?`Up to ${M(o.cap)}`:'',o.min?`Min order ${M(o.min)}`:'',o.kind==='bank'&&o.bank?`With ${o.bank} cards`:''].filter(Boolean).join(' · ');
  function ticket(o){
    const fl=offFlag(o),d=dayLeft(o.till),hot=d!=null&&d<=2;
    const tags=[fl==='new'?'<em class="t-new">New users</em>':'',fl==='nocap'?'<em class="t-nocap">Max saving not stated</em>':'',o.till?`<em class="t-time${hot?' is-hot':''}">${H(ends(o.till))}</em>`:'',window.ppCashback?window.ppCashback.span(o.store,NaN,o.category||'','chip'):''].join('');
    const go=o.url?`<a class="ppf-tk-go" href="${H(o.url)}" target="_blank" rel="sponsored noopener" data-ppf-tkgo="${H(o.store)}">${o.code||o.kind==='coupon'?'Shop now':'View offer'} <i aria-hidden="true">↗</i></a>`:'';
    return `<article class="ppf-tk is-${H(o.kind)}">
      <div class="ppf-tk-top"><span class="ppf-tk-logo">${logo(o.store)}</span><span class="ppf-tk-k">${o.kind==='bank'?'🏦 '+H((o.bank||'Bank')+' card'):o.kind==='giftcard'?'🎁 Gift card':'🏷 '+H(NAME[o.kind]||'Offer')}</span></div>
      <div class="ppf-tk-v">${big(o)}</div>${line(o)?`<div class="ppf-tk-l">${H(line(o))}</div>`:''}
      <p class="ppf-tk-x" title="${H(o.text||'')}">${H(o.text||'')}</p>${tags?`<div class="ppf-tk-tags">${tags}</div>`:''}
      <div class="ppf-tk-cut" aria-hidden="true"></div>
      <div class="ppf-tk-act">${o.code?`<button type="button" class="ppf-tk-code" data-ppf-copy="${H(o.code)}" title="Copy code"><b>${H(o.code)}</b><span>Copy</span></button>`:'<span class="ppf-tk-auto">✓ No code needed</span>'}${go}</div>
    </article>`;
  }
  function allOffers(){
    const l=normOffers((adminOffers||[]).slice()).filter(o=>['coupon','bank','giftcard','cashback'].includes(o.kind));
    const w=o=>(offFlag(o)?0:1e6)+(o.amount||0)+(o.pct||0)*40+(o.cap||0)/10+(o.url?50:0);
    return l.sort((a,b)=>w(b)-w(a));
  }
  const storesOf=l=>[...new Set(l.map(o=>o.store))];
  const logoChip=(k,v,cur,label)=>`<button type="button" class="ppf-lchip${cur===v?' is-on':''}" data-ppf-of="${k}:${H(v)}" aria-pressed="${cur===v}">${v?`<span class="ppf-lchip-i">${logo(v)}</span>`:''}<span>${label||H(storeLabel(v))}</span></button>`;

  /* deal-card badges: what you pay with the best offer + card */
  function bestWithOffers(p){
    const cats=p.category?[String(p.category).toLowerCase()]:[];
    const rows=catalogRows(p).filter(r=>Number.isFinite(r.price)&&r.inStock!==false);if(!rows.length)return null;
    const minP=Math.min(...rows.map(r=>r.price));
    let best=null;for(const r of rows){const pl=plan(r.store,r.price,adminOffersFor(r.store,cats));if(!best||pl.final<best.final)best={final:pl.final,store:r.store};}
    return best&&minP-best.final>=Math.max(50,minP*0.01)?{...best,save:minP-best.final}:null;
  }
  function badges(){
    if(!Array.isArray(adminOffers)||!Array.isArray(cardRewards))return;
    const idx=K.productIndex()||[];
    document.querySelectorAll('.ppx-pc[data-pc-id]:not([data-ppf-b]),.ppx-dc-card[data-product-id]:not([data-ppf-b]),.ppf-deal-w:not([data-ppf-b])').forEach(c=>{
      c.dataset.ppfB='1';
      if(c.classList.contains('ppx-dc-card')&&c.querySelector('.ppx-pc'))return; /* the inner card gets it */
      const id=c.dataset.pcId||c.dataset.productId||decodeURIComponent(((c.querySelector('a[href^="#/product/"]')||{}).getAttribute?.('href')||'').replace('#/product/',''));
      const p=idx.find(x=>String(x.id)===String(id));if(!p)return;
      const b=bestWithOffers(p);if(!b)return;
      const el=document.createElement('a');el.className='ppf-obdg';el.href=`#/product/${encodeURIComponent(p.id)}`;
      el.innerHTML=`<span aria-hidden="true">🏷</span><span>With offers <b>${M(b.final)}</b> at ${H(storeLabel(b.store))}</span><em>save ${M(b.save)}</em>`;
      /* V276 (P9): one short line under the store bars, not a separate box */
      el.classList.add('is-line');
      const lad=c.querySelector('.ppx-pc-ladder'),pr=c.querySelector('.ppx-pc-price,.ppx-pc-pending');
      if(lad)lad.after(el);else if(pr)pr.after(el);else{const at=c.querySelector('.ppx-pc-plus,.ppx-dc-lock');at?at.before(el):c.appendChild(el);}
    });
  }

  /* home: dark "Coupons & offers" strip */
  let stripStore='';
  /* V276 (P10): one dark box, two rows: Coupons, then Bank and card offers (shown once there are 6 or more).
     The bank row ends with a "Credit card rewards" card that opens that section of the Coupons page. */
  function stripHTML(){
    const all=allOffers(),stores=storesOf(all);
    const l=all.filter(o=>!stripStore||o.store===stripStore);
    const cps=l.filter(o=>o.kind==='coupon'||o.kind==='giftcard').slice(0,14);
    /* V277 (P17): row 2 = Card rewards (small tiles), not bank offers - shorter box, and two different kinds of saving.
       Bank offers stay on the Coupons page. */
    const mine=myCards();
    const crs=[...new Map((cardRewards||[]).filter(c=>!stripStore||c.store==='*'||sameStore(c.store,stripStore))
      .sort((a,b)=>(mine.includes(b.card)-mine.includes(a.card))||b.pct-a.pct).map(c=>[c.card,c])).values()].slice(0,12);
    const nCards=(cardRewards||[]).length?new Set(cardRewards.map(c=>c.card)).size:0;
    const crTile=c=>`<a class="ppf-crt${mine.includes(c.card)?' is-mine':''}" href="#/offers" data-ppf-goto="cp-cards">${bankBadge(c.bank)}<span class="ppf-crt-n"><b>${H(c.card)}</b><small>${c.store==='*'?'Any online store':'On '+H(storeLabel(c.store))}</small></span><span class="ppf-crt-p">${Number(c.pct)}%<small>${c.reward==='points'||c.kind==='points'?'points':'back'}</small></span></a>`;
    const crMore=nCards?`<a class="ppf-crt ppf-crt-more" href="#/offers" data-ppf-goto="cp-cards"><b>All ${nCards} cards</b><em>See card rewards <i aria-hidden="true">→</i></em></a>`:'';
    return `<div class="container discovery-container"><div class="ppf-os-box">
      <div class="ppf-os-h"><div><p class="ppf-os-eb"><i aria-hidden="true"></i>COUPONS · UPDATED EVERY MORNING</p><h2>Save more with <span class="ppx-gold-text">coupons &amp; card rewards</span></h2>
        <p class="ppf-os-sub"><b>${all.length}</b> live offers · <b>${stores.length}</b> stores · copy a code, shop, paste at checkout</p></div>
        <a class="ppf-os-all" href="#/offers">See all offers <i aria-hidden="true">→</i></a></div>
      <div class="ppf-os-tabs">${logoChip('strip','',stripStore,'All')}${stores.map(x=>logoChip('strip',x,stripStore)).join('')}</div>
      ${cps.length?`<p class="ppf-os-row">🏷 Coupons</p>${scroller(cps.map(ticket).join(''))}`:''}
      ${crs.length?`<p class="ppf-os-row">💳 Card rewards <span class="ppf-os-rs">cashback or points from your card, after you pay</span></p>${scroller(crs.map(crTile).join('')+crMore)}`:''}
      ${!cps.length&&!crs.length?'<p class="ppf-os-sub">No offers for this store right now.</p>':''}
    </div></div>`;
  }
  function strip(force){
    const after=document.getElementById('stores');if(!after)return;
    let sec=document.getElementById('ppfOffersStrip');
    if(sec&&!force)return;
    if(!allOffers().length){sec&&sec.remove();return;}
    if(!sec){sec=document.createElement('section');sec.id='ppfOffersStrip';sec.className='section ppf-os';after.insertAdjacentElement('afterend',sec);}
    sec.innerHTML=stripHTML();markScrollers(sec);
  }

  /* Coupons & Offers page */
  const st={store:'',kind:'',open:new Set()};let gotoSec='';
  /* V276 (P11, P12): compact hero joined to the filter panel; each section shows 2 rows first, "View all (N)" opens it in place.
     Picking a type chip (Coupons / Bank offers / Gift cards) or a store opens the matching sections in full. */
  function page(){
    const all=allOffers(),stores=storesOf(all);
    const f=all.filter(o=>(!st.store||o.store===st.store)&&(!st.kind||o.kind===st.kind||(st.kind==='bank'&&o.kind==='cashback')));
    const coupons=f.filter(o=>o.kind==='coupon'),banks=f.filter(o=>o.kind==='bank'||o.kind==='cashback'),gifts=f.filter(o=>o.kind==='giftcard');
    const mine=myCards();
    const cards=[...new Map((cardRewards||[]).filter(c=>!st.store?true:(c.store==='*'||sameStore(c.store,st.store))).sort((a,b)=>(mine.includes(b.card)-mine.includes(a.card))||b.pct-a.pct).map(c=>[c.card+'|'+c.store,c])).values()];
    const full=!!(st.kind||st.store);
    const head=(id,ic,t,sub,n,extra='')=>{const open=full||st.open.has(id);
      return `<div class="ppf-cp-sh"><h2><span aria-hidden="true">${ic}</span>${t} <i>${n}</i></h2><p>${sub}</p>${extra}${full?'':`<button type="button" class="ppf-cp-all" data-ppf-cpall="${id}" aria-expanded="${open}">${open?'Show less':`View all (${n})`}</button>`}</div>`;};
    const cls=id=>`ppf-cp-sec${full||st.open.has(id)?'':' is-clip'}`;
    const sec=(id,ic,t,sub,list)=>list.length?`<section class="${cls(id)}" id="${id}">${head(id,ic,t,sub,list.length)}<div class="ppf-cp-grid">${list.map(ticket).join('')}</div></section>`:'';
    const empty=!coupons.length&&!banks.length&&!gifts.length;
    const nCards=(cardRewards||[]).length?new Set(cardRewards.map(c=>c.card)).size:0;
    return `<div class="ppx-product ppx-list-page container ppf-page ppf-cpp">${K.crumbs('Coupons & Offers')}
      <div class="pp-head-unit">
      <section class="ppf-cp-hero pp-onebar"><h1>Coupons &amp; offers <span class="ppx-gold-text">that actually work</span></h1>
        <div class="pp-ob-stats"><span><i class="ppx-dx-dot" aria-hidden="true"></i><b>${all.length}</b> live offers</span><span><b>${stores.length}</b> stores</span><span><b>${nCards}</b> credit cards</span><span>Updated every morning</span></div>
        <div class="pp-ob-acts"><a class="pp-ob-btn" href="#/find">Price Check <i aria-hidden="true">→</i></a></div>
      </section>
      <div class="ppf-cp-bar"><div class="ppf-cp-row">${logoChip('store','',st.store,'All stores')}${stores.map(x=>logoChip('store',x,st.store)).join('')}</div>
        <div class="ppf-cp-row">${[['','All'],['coupon','🏷 Coupons'],['bank','🏦 Bank offers'],['giftcard','🎁 Gift cards']].map(([v,t])=>`<button type="button" class="ppf-tchip${st.kind===v?' is-on':''}" data-ppf-of="kind:${v}">${t}</button>`).join('')}</div></div>
      </div>
      ${sec('cp-top','🔥','Top coupons today','Biggest savings first. "New users" codes work only on your first order.',coupons)}
      ${sec('cp-bank','🏦','Bank &amp; card offers','Instant discounts when you pay with these cards.',banks)}
      ${sec('cp-gift','🎁','Gift card offers','Buy a store gift card at a discount, then pay with it.',gifts)}
      ${empty?'<div class="ppf-cp-empty"><b>No offers for this filter right now.</b><span>New coupons arrive every morning.</span></div>':''}
      ${(!st.kind||st.kind==='bank')&&cards.length?`<section class="${cls('cp-cards')}" id="cp-cards">${head('cp-cards','💳','Card rewards','Cashback or points from your credit card, after you pay. Add your cards and we show yours first.',cards.length,`<button type="button" class="ppf-addc" data-ppf-cards>${mine.length?`My cards (${mine.length})`:'+ Add your cards'}</button>`)}
        <div class="ppf-cp-cards">${cards.map(c=>`<div class="ppf-cp-card${mine.includes(c.card)?' is-mine':''}">${bankBadge(c.bank)}<span class="ppf-cr-n"><b>${H(c.card)}</b><small>${c.store==='*'?'Any online store':'On '+H(storeLabel(c.store))} · ${H(c.note||'')}</small></span><span class="ppf-cp-pct">${Number(c.pct)}%<small>${c.reward==='points'?'points':'back'}</small></span></div>`).join('')}</div></section>`:''}
      ${!gifts.length&&(!st.kind||st.kind==='giftcard')?`<section class="ppf-cp-soon"><span aria-hidden="true">🎁</span><div><b>Discounted gift cards are coming</b><p>Buy Amazon, Flipkart, Myntra and more gift cards for less, then shop with them. Extra savings on top of coupons.</p></div><a class="ppx-btn ppx-btn-gold" href="#/gift-cards">Get notified</a></section>`:''}
      <p class="ppf-off-note">Offers come from the stores and our partners and can change or end early. Links to stores may earn us a commission at no cost to you.</p>
    </div>`;
  }
  /* 2 rows per section: columns come from the grid itself, so desktop shows 8, tablets 6, phones 4 */
  function clip(){
    document.querySelectorAll('.ppf-cpp .ppf-cp-sec').forEach(sec=>{
      const g=sec.querySelector('.ppf-cp-grid,.ppf-cp-cards');if(!g)return;
      const items=[...g.children],btn=sec.querySelector('[data-ppf-cpall]');
      if(!sec.classList.contains('is-clip')){items.forEach(i=>i.hidden=false);return;}
      const cols=Math.max(1,getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length);
      const lim=Math.max(cols*2,4);
      items.forEach((i,k)=>i.hidden=k>=lim);
      if(btn)btn.hidden=items.length<=lim;
    });
  }
  let clipT=0;window.addEventListener('resize',()=>{clearTimeout(clipT);clipT=setTimeout(clip,150);});
  async function renderOffers(){
    window.ppShowPage('offers','<div class="ppx-product ppx-list-page container ppf-page"><p class="ppf-muted" style="padding:60px 0;text-align:center">Loading coupons…</p></div>');
    await Promise.all([loadAdminOffers(),loadCardRewards()]);
    if(!/^#\/offers/.test(location.hash))return;
    window.ppShowPage('offers',page());markScrollers();clip();document.title='Coupons & Offers | PricePulse';
    if(gotoSec){const el=document.getElementById(gotoSec);gotoSec='';el&&setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),60);}
    topNavActive();
  }
  window.ppRegisterRoute('offers',renderOffers);
  window.ppOffersKit={load:()=>Promise.all([loadAdminOffers(),loadCardRewards()]),all:allOffers,ticket,logo,storeLabel,sameStore,markScrollers,scroller,
    best:p=>Array.isArray(adminOffers)&&Array.isArray(cardRewards)?bestWithOffers(p):null,
    /* V278 (L3): coupons + bank offers + card rewards of ONE store, for the Deal Radar total */
    netAt:(p,store,price)=>{if(!Array.isArray(adminOffers)||!Array.isArray(cardRewards)||!Number.isFinite(price))return null;const cats=p&&p.category?[String(p.category).toLowerCase()]:[];const pl=plan(store,price,adminOffersFor(store,cats));return {final:pl.final,save:price-pl.final};}};
  /* V277 (P26): Deal Radar "Biggest total saving" needs the offers - redraw the home rows once they are in */
  Promise.all([loadAdminOffers(),loadCardRewards()]).then(()=>{try{window.ppHomeLayout&&window.ppHomeLayout();}catch(_){}});
  window.addEventListener('pp-cashback',()=>{try{window.ppHomeLayout&&window.ppHomeLayout();}catch(_){}});

  /* top menu (desktop header) + bottom nav (phones) */
  const TOP=[['deals','🔥','Deals','#/deals'],['offers','🏷','Coupons','#/offers'],['find','📈','Price History','#/find']]; /* price alerts = the bell in the header */
  /* V276 (P1, P2): the old Deals / Coupons / Price History pills in the header are gone; the menu row (polish-v276.js) has them.
     topNavActive() still marks the menu item of the open page. */
  function topNav(){}
  function topNavActive(){const r=(location.hash.match(/^#\/([a-z-]+)/)||[])[1]||'';document.querySelectorAll('[data-ppf-top]').forEach(a=>a.classList.toggle('is-on',a.dataset.ppfTop===r));}
  window.addEventListener('hashchange',topNavActive);
  function bottomNav(){
    const b=document.querySelector('#ppBottomNav [data-ppx-nav="categories"]');if(!b)return;
    b.dataset.ppxNav='offers';b.dataset.ppfOffersNav='1';
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.5"/></svg><span>Offers</span><b class="ppx-nav-count" hidden></b>';
  }
  document.addEventListener('click',e=>{
    const f=e.target.closest&&e.target.closest('[data-ppf-of]');
    if(f){const [k,v]=f.dataset.ppfOf.split(':');
      if(k==='strip'){stripStore=v;strip(true);return;}
      st[k]=v;const y=scrollY;window.ppShowPage('offers',page());clip();scrollTo(0,y);return;}
    const gt=e.target.closest&&e.target.closest('[data-ppf-goto]');if(gt){gotoSec=gt.dataset.ppfGoto;if(/^#\/offers/.test(location.hash)){e.preventDefault();renderOffers();}}
    const va=e.target.closest&&e.target.closest('[data-ppf-cpall]');
    if(va){const id=va.dataset.ppfCpall;st.open.has(id)?st.open.delete(id):st.open.add(id);const y=scrollY;window.ppShowPage('offers',page());clip();scrollTo(0,y);if(!st.open.has(id))document.getElementById(id)?.scrollIntoView({block:'start'});return;}
    const n=e.target.closest&&e.target.closest('[data-ppf-offers-nav]');if(n){e.preventDefault();location.hash='#/offers';}
    const g=e.target.closest&&e.target.closest('[data-ppf-tkgo]');if(g){try{const r=window.PPData&&window.PPData.logClick&&window.PPData.logClick(null,storeLabel(g.dataset.ppfTkgo),'coupon',true);r&&r.catch&&r.catch(()=>{});}catch(_){}}
  });
  window.addEventListener('ppf-cards',()=>{if(/^#\/offers/.test(location.hash)){const y=scrollY;window.ppShowPage('offers',page());clip();scrollTo(0,y);}});
  let t=0;
  const run=()=>{t=0;topNav();bottomNav();strip(false);badges();};
  Promise.all([loadAdminOffers(),loadCardRewards()]).then(run);
  const mo=new MutationObserver(()=>{if(!t)t=setTimeout(run,400);});
  const start=()=>{mo.observe(document.body,{childList:true,subtree:true});topNav();bottomNav();};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();

})(); /* end of the V251 find-page scope (V273 blocks live inside it) */
