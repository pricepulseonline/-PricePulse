/* PricePulse AI-PLAN P2 (similar but cheaper) + R3 (ask about this product) — product page, from OUR data only.
   P2: up to 3 products of the same category with a verified price at or below this one (not below 60% of it),
       best Deal Score first, clearly labelled "Similar, not the same product".
   R3: shopper types a question (or taps a chip); we look for it in the product details stores show on their pages
       (pp_ext_details_public). Found -> the store's own words; not found -> "Not in our data". No AI, nothing guessed. */
(function(){
  'use strict';
  if(window.__ppProductAiV1)return;window.__ppProductAiV1=true;
  const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const M=n=>'₹'+Math.round(n).toLocaleString('en-IN');
  const K=()=>window.ppLinkKit;
  const det=new Map();
  function details(id){if(det.has(id))return det.get(id);const p=(async()=>{try{if(typeof supabaseClient==='undefined'||!supabaseClient)return null;const r=await supabaseClient.rpc('pp_ext_details_public',{p_product_id:id});return r.error||!r.data||r.data.ok===false?null:r.data;}catch(_){return null;}})();det.set(id,p);return p;}
  const val=v=>v&&typeof v==='object'?String(v.v??v.value??''):String(v??'');
  function pairs(d){const out=[];if(d)for(const g of [d.fields,d.specs])if(g&&typeof g==='object')for(const [k,v] of Object.entries(g)){const s=val(v).trim();if(s)out.push([k,s]);}return out;}
  const TOPICS=[['Battery',/battery|mah/i],['Warranty',/warranty|guarantee/i],['In the box',/in the box|box contents|package|sales package|charger|adapter|cable/i],['Display',/display|screen|resolution|refresh|hz|inch/i],['Weight',/weight|kg\b|grams?/i],['Camera',/camera|mp\b/i],['Processor',/processor|chipset|cpu/i],['Size',/size|dimension|length|width|height/i],['Colour',/colou?r|shade/i],['Material',/material|fabric/i]];
  const STOP=/^(is|are|does|do|it|this|the|a|an|have|has|with|of|in|kya|hai|me|ka|ki|ke|and|or|how|what|much|many|there)$/i;
  function ask(q,list){
    const qs=String(q||'').toLowerCase();if(qs.trim().length<2)return null;
    const topic=TOPICS.find(([,re])=>re.test(qs));
    let hits=topic?list.filter(([k,v])=>topic[1].test(k)||(topic[0]==='In the box'&&/in the box|package/i.test(k))):[];
    if(!hits.length){const words=qs.split(/[^a-z0-9]+/).filter(w=>w.length>2&&!STOP.test(w));hits=list.filter(([k,v])=>words.some(w=>(k+' '+v).toLowerCase().includes(w)));}
    return hits.slice(0,4);
  }
  function css(){if(document.getElementById('ppPaiCss'))return;const st=document.createElement('style');st.id='ppPaiCss';
    st.textContent='.ppai-sec{margin:18px 0;padding:14px 16px;border:1px solid #e3ebe7;border-radius:16px;background:#fff}.ppai-sec h2{font-size:17px;margin:0 0 4px}.ppai-sec .mut{font-size:12px;color:#64756e;margin:0 0 8px}.ppai-sim{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}.ppai-sim a{display:flex;gap:10px;align-items:center;padding:8px;border:1px solid #e3ebe7;border-radius:12px;text-decoration:none;color:inherit}.ppai-sim img{width:48px;height:48px;object-fit:contain}.ppai-sim b{display:block;font-size:13px}.ppai-sim .pr{color:#1f7a55;font-weight:800}.ppai-sim small{display:block;font-size:11.5px;color:#64756e}.ppai-q form{display:flex;gap:6px}.ppai-q input{flex:1;font:inherit;padding:8px 10px;border:1px solid #d5e2db;border-radius:10px}.ppai-q button{font:inherit;border:0;border-radius:10px;background:#1f7a55;color:#fff;padding:8px 14px;font-weight:700;cursor:pointer}.ppai-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.ppai-chips button{background:#f3f7f5;color:#10211b;border:1px solid #dbe7e1;border-radius:99px;padding:4px 10px;font-size:12px;font-weight:600}.ppai-ans{font-size:13.5px;line-height:1.5}.ppai-ans dt{color:#64756e;font-size:12px}.ppai-ans dd{margin:0 0 6px}';document.head.appendChild(st);}
  async function paint(){
    const m=/^#\/product\/([^?/]+)/.exec(location.hash);if(!m)return;const id=decodeURIComponent(m[1]);
    const page=document.querySelector('.ppx-product');const hero=page&&page.querySelector('.ppx-hero');if(!hero)return;
    if(page.dataset.ppaiFor===id)return;page.dataset.ppaiFor=id;css();
    page.querySelectorAll('.ppai-sec').forEach(x=>x.remove());
    const k=K();const idx=k?k.productIndex():[];const me=idx.find(x=>x.id===id);
    const myPrice=Number(String((hero.querySelector('.ppx-hero-price b')||{}).textContent||'').replace(/[^\d.]/g,''));
    const host=hero.closest('section,div')?.parentNode||page;
    // R3
    const qa=document.createElement('section');qa.className='ppai-sec ppai-q';
    qa.innerHTML=`<h2>Ask about this product</h2><p class="mut">Answers come only from the details stores show on their pages. Not checked by PricePulse.</p><form><input maxlength="120" placeholder="e.g. Is the charger in the box?"><button type="submit">Ask</button></form><div class="ppai-chips">${TOPICS.slice(0,7).map(([t])=>`<button type="button">${H(t)}</button>`).join('')}</div><div class="ppai-ans"></div>`;
    const answer=async q=>{const out=qa.querySelector('.ppai-ans');out.textContent='Looking…';const list=pairs(await details(id));
      if(!list.length){out.innerHTML='We don\'t have store details for this product yet. Please check the store page.';return;}
      const hits=ask(q,list)||[];out.innerHTML=hits.length?`<dl>${hits.map(([k,v])=>`<dt>${H(k)}</dt><dd>${H(v)}</dd>`).join('')}</dl>`:'Not in our data. Please check the store page before you buy.';};
    qa.querySelector('form').addEventListener('submit',e=>{e.preventDefault();answer(qa.querySelector('input').value);});
    qa.querySelector('.ppai-chips').addEventListener('click',e=>{const b=e.target.closest('button');if(b){qa.querySelector('input').value=b.textContent;answer(b.textContent);}});
    // P2
    let sim=null;
    if(me&&me.category&&myPrice>0&&k){
      const list=idx.filter(x=>x.id!==id&&x.category===me.category).map(x=>{const b=k.bestPrice(x);let a=null;try{a=k.dealAnalysis(x.id,b.price,null,b.stores);}catch(_){}return {x,price:b.price,a};})
        .filter(r=>Number.isFinite(r.price)&&r.price<=myPrice&&r.price>=myPrice*0.6).sort((A,B)=>((B.a?.score??-1)-(A.a?.score??-1))||(A.price-B.price)).slice(0,3);
      if(list.length){sim=document.createElement('section');sim.className='ppai-sec';
        sim.innerHTML=`<h2>Similar, but cheaper</h2><p class="mut">Similar products in ${H(k.catLabel?k.catLabel(me.category):me.category)} with a verified price at or below this one. Not the same product: compare the details before you buy.</p><div class="ppai-sim">${list.map(r=>{const img=k.photoOf?k.photoOf(r.x):'';return `<a href="#/product/${encodeURIComponent(r.x.id)}">${img?`<img src="${H(img)}" alt="">`:''}<span><b>${H(r.x.name)}</b><span class="pr">${M(r.price)}</span>${r.price<myPrice?` <small>${M(myPrice-r.price)} less${r.a?' · Deal Score '+r.a.score:''}</small>`:r.a?` <small>Deal Score ${r.a.score}</small>`:''}</span></a>`;}).join('')}</div>`;}
    }
    const heroBlock=hero.parentNode===page?hero:hero.closest('.ppx-product > *')||hero;
    heroBlock.insertAdjacentElement('afterend',qa);
    if(sim)qa.insertAdjacentElement('afterend',sim);
  }
  let t=0;const later=()=>{clearTimeout(t);t=setTimeout(()=>{paint().catch(()=>{});},350);};
  new MutationObserver(later).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',later);later();
  window.ppProductAi={ask};
})();
