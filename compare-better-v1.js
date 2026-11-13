/* PricePulse AI-PLAN E — Compare page: "Which is better for you?" (Camera / Battery / Speed & gaming / Display / Value).
   Answers ONLY from the numbers we have: product details read from store pages (pp_ext_details_public, same block as the
   product page) + the product name + our verified price and Deal Score. No AI call, no cost; a missing number is said
   plainly ("not in our data"). Nothing is "tested by PricePulse" and the box says so. */
(function(){
  'use strict';
  if(window.__ppBetterV1)return;window.__ppBetterV1=true;
  const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const M=n=>'₹'+Math.round(n).toLocaleString('en-IN');
  const K=()=>window.ppLinkKit;
  const cache=new Map();
  function details(id){
    if(cache.has(id))return cache.get(id);
    const p=(async()=>{try{if(typeof supabaseClient==='undefined'||!supabaseClient)return null;const r=await supabaseClient.rpc('pp_ext_details_public',{p_product_id:id});return r.error||!r.data||r.data.ok===false?null:r.data;}catch(_){return null;}})();
    cache.set(id,p);return p;
  }
  const val=v=>v&&typeof v==='object'?String(v.v??v.value??''):String(v??'');
  function textOf(d,name){
    const parts=[name];
    if(d){for(const grp of [d.fields,d.specs])if(grp&&typeof grp==='object')for(const [k,v] of Object.entries(grp))parts.push(k+': '+val(v));}
    return parts.join(' | ');
  }
  const maxNum=(t,re)=>{let m=0;for(const x of String(t).matchAll(re)){const n=parseFloat(x[1]);if(n>m)m=n;}return m||null;};
  function read(t){
    return {
      mp:maxNum(t,/(\d{2,3}(?:\.\d)?)\s?MP\b/gi),
      mah:maxNum(t,/(\d{4,5})\s?mAh\b/gi),
      ram:maxNum(t,/(\d{1,2})\s?GB\s?(?:RAM|LPDDR|DDR)|RAM[^|]{0,12}?(\d{1,2})\s?GB/gi)||maxNum(t,/RAM[^|]{0,14}?(\d{1,2})\s?GB/gi),
      hz:maxNum(t,/(\d{2,3})\s?Hz\b/gi),
      inch:maxNum(t,/(\d{1,2}(?:\.\d{1,2})?)\s?(?:inch|in\b|")/gi),
      panel:(String(t).match(/\b(LTPO AMOLED|Dynamic AMOLED|Super AMOLED|AMOLED|P?OLED|IPS LCD|LCD|LED)\b/i)||[])[1]||'',
      cpu:(String(t).match(/\b(Snapdragon\s?[\w+ ]{1,14}?(?:Gen\s?\d)?|Dimensity\s?\d{3,4}\w*|Helio\s?\w+|Exynos\s?\d{3,4}|Tensor\s?G?\d|A\d{2}\s?(?:Pro|Bionic)?|Apple M\d\w*|Core\s?i\d[-\s]?\w*|Ryzen\s?\d\s?\w*|Unisoc\s?\w+)\b/i)||[])[1]||''
    };
  }
  const TOPICS=[['camera','Camera'],['battery','Battery'],['speed','Speed & gaming'],['display','Display'],['value','Value for money']];
  function answer(topic,items){
    const name=i=>`<b>${H(i.name)}</b>`;
    const have=(k)=>items.filter(i=>i.r[k]);
    const missing=k=>items.filter(i=>!i.r[k]).map(i=>H(i.name));
    const miss=k=>missing(k).length?` Not in our data for ${missing(k).join(', ')}.`:'';
    const lead=(k,unit,label)=>{const h=have(k);if(!h.length)return `We don't have ${label} numbers for these products yet.`;const top=Math.max(...h.map(i=>i.r[k]));const w=h.filter(i=>i.r[k]===top);
      return `${w.map(name).join(' and ')} ${w.length>1?'have':'has'} the ${label} in our data (${top}${unit}${h.length>1?' vs '+h.filter(i=>i.r[k]!==top).map(i=>i.r[k]+unit).join(', '):''}).${miss(k)}`;};
    if(topic==='camera')return lead('mp',' MP','highest main camera megapixels')+' Megapixels are only one part of photo quality.';
    if(topic==='battery')return lead('mah',' mAh','biggest battery');
    if(topic==='display'){const a=lead('hz',' Hz','smoothest screen');const b=items.map(i=>`${H(i.name)}: ${[i.r.inch?i.r.inch+'"':'',i.r.panel,i.r.hz?i.r.hz+' Hz':''].filter(Boolean).join(' · ')||'not in our data'}`).join('<br>');return a+'<br>'+b;}
    if(topic==='speed'){const a=lead('ram',' GB RAM','most RAM');const b=items.map(i=>`${H(i.name)}: ${i.r.cpu?H(i.r.cpu):'processor not in our data'}${i.r.ram?' · '+i.r.ram+' GB RAM':''}${i.r.hz?' · '+i.r.hz+' Hz':''}`).join('<br>');return a+'<br>'+b+'<br><small>We show the processor names; we do not rank chips ourselves.</small>';}
    if(topic==='value'){const p=items.filter(i=>Number.isFinite(i.price));if(p.length<2)return 'Verified prices are missing for some of these products.';
      const cheap=p.reduce((a,b)=>b.price<a.price?b:a);const sc=p.filter(i=>i.score!=null);const bestS=sc.length?sc.reduce((a,b)=>b.score>a.score?b:a):null;
      return `${name(cheap)} is the cheapest at ${M(cheap.price)}.${bestS?` ${name(bestS)} has the best Deal Score (${bestS.score}/100) - its price is the best compared to its own history.`:''}`;}
    return '';
  }
  function css(){if(document.getElementById('ppBetterCss'))return;const st=document.createElement('style');st.id='ppBetterCss';
    st.textContent='.ppb-box{margin:16px 0;padding:14px 16px;border-radius:16px;border:1px solid rgba(31,122,85,.2);background:#f6fbf8}.ppb-box h2{margin:0 0 8px;font-size:18px}.ppb-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.ppb-tabs button{border:1px solid #cfe0d7;background:#fff;border-radius:99px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer}.ppb-tabs button.on{background:#1f7a55;color:#fff;border-color:#1f7a55}.ppb-out{font-size:14px;line-height:1.55}.ppb-note{font-size:11.5px;color:#64756e;margin:8px 0 0}';document.head.appendChild(st);}
  let busy=false;
  async function paint(){
    const m=/^#\/compare\/([^?]+)/.exec(location.hash);if(!m||busy)return;
    const grid=document.querySelector('.ppx-cmpx');if(!grid)return;
    const ids=decodeURIComponent(m[1]).split(',').map(s=>s.trim()).filter(Boolean).slice(0,3);
    if(ids.length<2)return;
    const sig=ids.join(',');const old=document.getElementById('ppbBox');if(old&&old.dataset.sig===sig&&old.isConnected)return;
    busy=true;
    try{
      const k=K();const idx=k?k.productIndex():[];
      const items=await Promise.all(ids.map(async id=>{const p=idx.find(x=>x.id===id);const name=p?p.name:id;const d=await details(id);
        let price=null,score=null;try{const b=k.bestPrice(p);price=b.price;const a=k.dealAnalysis(id,b.price,null,b.stores);score=a?a.score:null;}catch(_){}
        return {id,name,r:read(textOf(d,name+' '+(p?p.hay:''))),price,score,hasDet:!!d};}));
      if(!document.querySelector('.ppx-cmpx'))return;
      css();
      const box=old||document.createElement('section');box.id='ppbBox';box.className='ppb-box';box.dataset.sig=sig;
      box.innerHTML=`<h2>Which is better for you?</h2><div class="ppb-tabs">${TOPICS.map(([t,l],i)=>`<button type="button" data-ppb="${t}"${i?'':' class="on"'}>${H(l)}</button>`).join('')}</div><div class="ppb-out"></div><p class="ppb-note">From the details stores show on their pages${items.some(i=>!i.hasDet)?' and the product names':''}. Not tested by PricePulse.</p>`;
      const out=box.querySelector('.ppb-out');const show=t=>{out.innerHTML=answer(t,items);box.querySelectorAll('[data-ppb]').forEach(b=>b.classList.toggle('on',b.dataset.ppb===t));};
      box.querySelector('.ppb-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-ppb]');if(b)show(b.dataset.ppb);});
      show('camera');
      if(!old)document.querySelector('.ppx-cmpx').insertAdjacentElement('afterend',box);
    }finally{busy=false;}
  }
  let t=0;const later=()=>{clearTimeout(t);t=setTimeout(paint,200);};
  new MutationObserver(later).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',later);later();
  window.ppBetter={read,answer};
})();
