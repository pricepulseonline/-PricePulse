/* PricePulse AI-PLAN D (+ Q9 budget finder) — natural-language search over OUR catalog.
   "best camera phone under 20000", "laptop for college below 50k", "boat earbuds under ₹2,000"
   -> category + budget + brand + need words are read from the sentence, then our products with a VERIFIED price are
   picked and sorted by our Deal Score. Runs in the browser: no AI call, no cost, only real products and real prices.
   Shown as a "Smart picks" box above the normal search results (normal search keeps working as before). */
(function(){
  'use strict';
  if(window.__ppSmartSearchV1)return;window.__ppSmartSearchV1=true;
  const K=()=>window.ppLinkKit;
  const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const M=n=>'₹'+Math.round(n).toLocaleString('en-IN');

  const CAT_WORDS=[
    ['mobiles',/\b(phones?|mobiles?|smart ?phones?|iphone|5g phone)\b/i],
    ['laptops',/\b(laptops?|notebooks?|macbook|chromebook)\b/i],
    ['appliances',/\b(fridge|refrigerator|washing machine|ac|air conditioner|microwave|geyser|water purifier|air fryer|vacuum)\b/i],
    ['electronics',/\b(tv|television|earbuds?|earphones?|headphones?|tws|neckband|speakers?|smart ?watch|watch|tablet|ipad|monitor|camera|power ?bank|charger)\b/i],
    ['home',/\b(kitchen|mixer|grinder|cooker|cookware|bedsheet|mattress|furniture|home decor)\b/i],
    ['fashion',/\b(shoes?|sneakers?|t-?shirts?|shirts?|jeans|kurta|saree|dress|jacket|bag|sandals?)\b/i],
    ['beauty',/\b(face ?wash|cream|serum|sunscreen|shampoo|lipstick|perfume|moisturi[sz]er|makeup|lotion|trimmer)\b/i]];
  const NEEDS={camera:/\b(camera|photo|selfie)\b/i,battery:/\b(battery|backup|long lasting)\b/i,gaming:/\b(gaming|games?|bgmi|pubg)\b/i,student:/\b(college|student|study|office|work)\b/i};
  const NEED_HAY={camera:/\b(\d{2,3}\s?mp|camera|ois|sony|telephoto)\b/i,battery:/\b(\d{4,5}\s?mah|battery)\b/i,gaming:/\b(snapdragon|dimensity|gaming|120\s?hz|144\s?hz|rtx|ryzen|i5|i7)\b/i,student:/\b(i3|i5|ryzen|8\s?gb|16\s?gb|ssd)\b/i};
  const money=(n,u)=>{let v=Number(String(n).replace(/,/g,''));if(!Number.isFinite(v))return null;u=String(u||'').toLowerCase();if(u==='k'||u==='thousand')v*=1000;if(u==='lakh'||u==='l')v*=100000;return v;};

  function parse(q){
    const s=String(q||'').toLowerCase().replace(/₹|rs\.?|inr/g,' ').replace(/\s+/g,' ').trim();
    const out={max:null,min:null,cat:'',brand:'',needs:[],q:s};
    const mx=s.match(/\b(?:under|below|upto|up to|within|less than|max|budget(?: of)?|around)\s*([\d,.]+)\s*(k|thousand|lakh|l)?\b/);
    if(mx)out.max=money(mx[1],mx[2]);
    const mn=s.match(/\b(?:above|over|more than|min|from)\s*([\d,.]+)\s*(k|thousand|lakh|l)?\b/);
    if(mn)out.min=money(mn[1],mn[2]);
    const rg=s.match(/\b([\d,.]+)\s*(k|thousand)?\s*(?:-|to)\s*([\d,.]+)\s*(k|thousand|lakh)?\b/);
    if(rg&&!out.max){out.min=money(rg[1],rg[2]||rg[4]);out.max=money(rg[3],rg[4]);}
    for(const [c,re] of CAT_WORDS)if(re.test(s)){out.cat=c;break;}
    for(const [n,re] of Object.entries(NEEDS))if(re.test(s))out.needs.push(n);
    return out;
  }
  // only "sentence" searches get Smart picks; a plain product name keeps the normal search alone
  const isSentence=(q,p)=>!!(p.max||p.min||(p.cat&&(p.needs.length||/\b(best|good|cheap|budget|top|for)\b/i.test(q))));

  function picks(p){
    const k=K();if(!k)return {list:[],total:0};
    const all=k.productIndex();
    const brands=[...new Set(all.map(x=>String(x.brand||'').toLowerCase()).filter(b=>b.length>1))];
    p.brand=brands.find(b=>new RegExp('\\b'+b.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(p.q))||'';
    let list=all.filter(x=>(!p.cat||x.category===p.cat)&&(!p.brand||String(x.brand).toLowerCase()===p.brand)).map(x=>{
      const b=k.bestPrice(x);let a=null;try{a=k.dealAnalysis(x.id,b.price,null,b.stores);}catch(_){}
      const need=p.needs.filter(n=>NEED_HAY[n].test(x.hay)).length;
      return {x,price:b.price,stores:b.stores,a,need};
    }).filter(r=>Number.isFinite(r.price)&&r.price>0&&(!p.max||r.price<=p.max)&&(!p.min||r.price>=p.min));
    const total=list.length;
    list.sort((A,B)=>(B.need-A.need)||((B.a?.score??-1)-(A.a?.score??-1))||(A.price-B.price));
    return {list:list.slice(0,6),total};
  }
  function why(r,p){
    const bits=[];
    if(r.a)bits.push(`Deal Score ${r.a.score} · ${r.a.label}`);
    if(p.max)bits.push(`${M(p.max-r.price)} under your budget`);
    if(r.need)bits.push(`matches "${p.needs.join(', ')}" in our product data`);
    return bits.join(' · ');
  }
  function css(){
    if(document.getElementById('ppSmartCss'))return;
    const st=document.createElement('style');st.id='ppSmartCss';
    st.textContent='.pps-box{margin:12px auto;max-width:1180px;padding:14px;border-radius:16px;border:1px solid rgba(31,122,85,.2);background:#f6fbf8;box-sizing:border-box}.pps-h{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}.pps-h b{font-size:16px}.pps-chip{font-size:12px;padding:3px 9px;border-radius:99px;background:#fff;border:1px solid #d8e6df}.pps-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}.pps-it{display:flex;gap:10px;align-items:center;padding:9px;border-radius:12px;background:#fff;border:1px solid #e3ebe7;text-decoration:none;color:inherit}.pps-it img{width:52px;height:52px;object-fit:contain;flex:none}.pps-it b{display:block;font-size:13.5px;line-height:1.3}.pps-it .pp{font-weight:800;color:#1f7a55}.pps-it small{display:block;font-size:11.5px;color:#64756e;margin-top:2px}.pps-note{font-size:11.5px;color:#64756e;margin:8px 0 0}.pps-x{margin-left:auto;border:0;background:none;font-size:18px;cursor:pointer;color:#64756e}';
    document.head.appendChild(st);
  }
  function render(q){
    document.getElementById('ppsBox')?.remove();
    const p=parse(q);if(!isSentence(q,p))return;
    const {list,total}=picks(p);
    css();
    const k=K(),box=document.createElement('section');box.id='ppsBox';box.className='pps-box';box.setAttribute('aria-label','Smart picks');
    const chips=[p.cat?(k.catLabel?k.catLabel(p.cat):p.cat):'All products',p.brand?p.brand.replace(/\b\w/g,c=>c.toUpperCase()):'',p.min&&p.max?`${M(p.min)} to ${M(p.max)}`:p.max?`Up to ${M(p.max)}`:p.min?`From ${M(p.min)}`:'',...p.needs.map(n=>'Good for '+n)].filter(Boolean);
    box.innerHTML=`<div class="pps-h"><b>Smart picks</b>${chips.map(c=>`<span class="pps-chip">${H(c)}</span>`).join('')}<button type="button" class="pps-x" aria-label="Close">×</button></div>`+
      (list.length?`<div class="pps-grid">${list.map(r=>{const img=k.photoOf?k.photoOf(r.x):'';return `<a class="pps-it" href="#/product/${encodeURIComponent(r.x.id)}">${img?`<img src="${H(img)}" alt="">`:''}<span><b>${H(r.x.name)}</b><span class="pp">${M(r.price)}</span> <small>${H(why(r,p))}</small></span></a>`;}).join('')}</div>`
        :`<p class="pps-note">No ${H(p.cat?(k.catLabel?k.catLabel(p.cat):p.cat).toLowerCase():'product')} ${p.max?'under '+M(p.max)+' ':''}with a verified price on PricePulse yet. Paste a store link in the search bar to compare any product.</p>`)+
      (list.length?`<p class="pps-note">${total} product${total>1?'s':''} match. Only products with a verified price, sorted by our Deal Score${p.needs.length?' (need words are matched in our product data, not tested by us)':''}.</p>`:'');
    box.querySelector('.pps-x').addEventListener('click',()=>box.remove());
    const anchor=document.getElementById('ppxSearchBar')||document.getElementById('deals');
    if(anchor)anchor.insertAdjacentElement(anchor.id==='deals'?'afterbegin':'beforebegin',box);
  }
  document.getElementById('siteSearch')?.addEventListener('submit',()=>{
    const v=String(document.querySelector('#siteSearch input')?.value||'');
    setTimeout(()=>{try{render(v);}catch(_){}},90);
  });
  document.addEventListener('click',e=>{if(e.target.closest('[data-sb-clear],.category-nav [data-cat],.deal-tabs button'))document.getElementById('ppsBox')?.remove();},true);
  window.ppSmartSearch={parse,picks,render};
})();
