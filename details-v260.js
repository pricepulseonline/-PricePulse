/* PricePulse V260 — "Product details" block on the product page and the Find page.
   Data: pp_ext_details_public(product_id) (extension-v4.sql). Only what store pages state; values two stores
   disagree on are left out by the database; a value approved in Admin always wins.
   Self-contained: adds its own small CSS, watches the page for a product / Find card, adds one block. */
(function(){
  if(window.__ppDetails)return;window.__ppDetails=true;
  const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LABEL={brand:'Brand',model:'Model',ram:'RAM',storage:'Storage',color:'Colour',colour:'Colour',size:'Size',gtin:'EAN / barcode',mpn:'Model number',qty:'Pack / quantity',gender:'For',network:'Network',material:'Material',type:'Type'};
  const ORDER=['brand','model','mpn','ram','storage','color','colour','size','qty','gender','network','material','type','gtin'];
  const STORE={flipkart:'Flipkart',amazon:'Amazon',croma:'Croma','vijay-sales':'Vijay Sales','reliance-digital':'Reliance Digital','tata-cliq':'Tata CLiQ',myntra:'Myntra',ajio:'AJIO',nykaa:'Nykaa','nykaa-fashion':'Nykaa Fashion',purplle:'Purplle',shopsy:'Shopsy',PricePulse:'PricePulse'};
  const nice=s=>STORE[s]||String(s).replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const cap=s=>{s=String(s||'');return s.charAt(0).toUpperCase()+s.slice(1);};
  const cache=new Map();

  if(!document.getElementById('ppDetStyle')){
    const st=document.createElement('style');st.id='ppDetStyle';
    st.textContent=`.ppd{margin:18px 0;padding:18px 20px;border:1px solid rgba(16,33,27,.1);border-radius:18px;background:#fff;color:#10211B}
.ppd h2{margin:0 0 4px;font-size:18px}.ppd .ppd-cat{margin:0 0 12px;font-size:12.5px;color:#64756e}
.ppd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.ppd-grid div{padding:10px 12px;border-radius:12px;background:#f4f7f6}.ppd-grid small{display:block;font-size:11px;letter-spacing:.04em;color:#64756e;text-transform:uppercase}
.ppd-grid b{display:block;margin-top:2px;font-size:14px;overflow-wrap:anywhere}
.ppd details{margin-top:12px}.ppd-tw{margin-top:8px;border-radius:12px}.ppd-tw.is-all{max-height:460px;overflow:auto;border:1px solid rgba(16,33,27,.08);padding:0 6px}.ppd-tw:not(.is-all) .ppd-x{display:none}.ppd-more{margin-top:10px;padding:8px 16px;border:1px solid #DAE0DC;border-radius:10px;background:#fff;font:800 13px Manrope,sans-serif;color:#152821;cursor:pointer}.ppd-more:hover{border-color:#E8B954;background:#F7F8F7}.ppd summary{cursor:pointer;font-weight:800;font-size:14px;display:inline-flex;align-items:center;gap:8px;list-style:none;padding:9px 16px;border:1px solid #DAE0DC;border-radius:12px;background:#fff;color:#152821}.ppd summary::-webkit-details-marker{display:none}.ppd summary::after{content:'';width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .15s}.ppd summary:hover{border-color:#E8B954;background:#F7F8F7}.ppd details[open] summary::after{transform:rotate(-135deg) translateY(-2px)}.ppd details[open] .ppd-s-closed,.ppd details:not([open]) .ppd-s-open{display:none}
.ppd table{width:100%;margin-top:8px;border-collapse:collapse;font-size:13.5px}.ppd td{padding:7px 8px;border-top:1px solid rgba(16,33,27,.08);vertical-align:top}
.ppd td:first-child{width:38%;color:#64756e}.ppd .ppd-note{margin:12px 0 0;font-size:11.5px;color:#64756e}
@media (prefers-color-scheme:dark){html[data-theme="dark"] .ppd{background:#142921;color:#EAF2EF;border-color:rgba(255,255,255,.1)}}`;
    document.head.appendChild(st);
  }

  function blockHTML(d){
    const f=d.fields||{},sp=d.specs||{};
    const keys=Object.keys(f).filter(k=>f[k]&&f[k].v!=null&&String(f[k].v).trim()!=='');
    keys.sort((a,b)=>{const x=ORDER.indexOf(a),y=ORDER.indexOf(b);return (x<0?99:x)-(y<0?99:y)||a.localeCompare(b);});
    const spKeys=Object.keys(sp).filter(k=>sp[k]&&sp[k].v!=null&&String(sp[k].v).trim()!=='');
    if(!keys.length&&!spKeys.length)return '';
    const cat=Array.isArray(d.category)&&d.category.length?`<p class="ppd-cat">${d.category.map(H).join(' › ')}</p>`:'';
    const grid=keys.length?`<div class="ppd-grid">${keys.map(k=>`<div><small>${H(LABEL[k]||cap(k))}</small><b>${H(f[k].v)}</b></div>`).join('')}</div>`:'';
    const rows=spKeys.length?`<details><summary><span class="ppd-s-closed">View all specifications (${spKeys.length})</span><span class="ppd-s-open">Hide specifications</span></summary><div class="ppd-tw"><table><tbody>${spKeys.map((k,i)=>`<tr${i>=10?' class="ppd-x"':''}><td>${H(cap(k))}</td><td>${H(sp[k].v)}</td></tr>`).join('')}</tbody></table></div>${spKeys.length>10?`<button type="button" class="ppd-more" data-ppd-more data-n="${spKeys.length-10}">Show ${spKeys.length-10} more</button>`:''}</details>`:'';
    const from=(d.stores||[]).map(nice);
    return `<h2>Product details</h2>${cat}${grid}${rows}<p class="ppd-note">${d.note!=null?`${from.length?`Read from ${from.map(H).join(', ')}. `:''}${H(d.note)}`:`${from.length?`Read from ${from.map(H).join(', ')}. `:''}Only values the stores state; details they disagree on are not shown.`}</p>`;
  }

  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-ppd-more]');if(!b)return;const det=b.closest('details');const tw=det&&det.querySelector('.ppd-tw');if(!tw)return;const all=tw.classList.toggle('is-all');b.textContent=all?'Show less':`Show ${b.dataset.n} more`;});
  window.ppDetailsBlockHTML=blockHTML;   // the Find page uses the same block for products it does not track
  async function load(id){
    if(cache.has(id))return cache.get(id);
    const p=(async()=>{
      try{
        if(typeof supabaseClient==='undefined'||!supabaseClient)return null;
        const r=await supabaseClient.rpc('pp_ext_details_public',{p_product_id:id});
        return r.error||!r.data||r.data.ok===false?null:r.data;
      }catch(_){return null;}
    })();
    cache.set(id,p);
    p.then(v=>{if(!v)setTimeout(()=>cache.delete(id),60000);});   // retry later if SQL v4 is not installed yet
    return p;
  }

  /* Store photos (links read by the extension, never Amazon), shown straight from the store's server.
     - Site has its own gallery (Admin Image 1-3): the other store photos are added after it.
     - Site has one picture or none: a small gallery is made from it + the store photos.
     A store photo that Admin Fill already auto-fitted into Image 1-3 is not shown twice. Hover or tap to swap. */
  const MAX_PICS=4;   // product page gallery: never more than 4 pictures in total
  const ukey=u=>String(u||'').replace(/[?#].*$/,'').replace(/\/image\/\d+\/\d+\//,'/image/').replace(/\/(?:[hwq]_\d+,?)+\//,'/').replace(/[-_]?\d{2,4}x\d{2,4}/g,'');
  const PLAIN={bg:'soft',fit:'contain',position:'center',scale:'100',rotate:'0',x:'0',y:'0'};
  function usedSources(id){
    const out=new Set();
    try{const c=typeof ppCatalogProduct==='function'?ppCatalogProduct(id):null;const si=c&&c.metadata&&c.metadata.site_images;
      if(si&&typeof si==='object')Object.values(si).forEach(v=>{if(v&&typeof v==='object'){const s=String(v.source||'');if(s.startsWith('store:'))out.add(ukey(s.slice(6)));if(v.url)out.add(ukey(v.url));}});}catch(_){}
    return out;
  }
  function showStore(main,u){main.referrerPolicy='no-referrer';main.src=u;
    try{if(typeof ppApplyGlobalImageToElement==='function')ppApplyGlobalImageToElement(main,{url:u,...PLAIN});else main.style.transform='';}catch(_){main.style.transform='';}}
  function thumb(u,i,onShow){
    const b=document.createElement('button');b.type='button';b.className='ppx-thumb ppd-x';b.setAttribute('aria-label','View store photo '+(i+1));
    const t=document.createElement('img');t.src=u;t.alt='';t.loading='lazy';t.referrerPolicy='no-referrer';t.onerror=()=>b.remove();b.appendChild(t);
    b.addEventListener('mouseenter',()=>onShow(b,u));b.addEventListener('click',()=>onShow(b,u));return b;
  }
  function ensureGallery(host,d,id){
    if(!d||!Array.isArray(d.images)||!d.images.length){host.dataset.ppdNoGal=id;return;}
    const stage=host.querySelector('.ppx-stage');if(!stage)return;
    const skip=usedSources(id);
    const keys=new Set();let imgs=d.images.filter(u=>{if(!/^https:\/\//.test(u))return false;const k=ukey(u);if(skip.has(k)||keys.has(k))return false;keys.add(k);return true;});
    const siteBar=host.querySelector('.ppx-thumbs:not(.ppd-thumbs)');
    if(siteBar){
      if(siteBar.dataset.ppdx===id)return;
      siteBar.dataset.ppdx=id;
      const have=new Set([...siteBar.querySelectorAll('img')].map(i=>ukey(i.getAttribute('src'))));
      const room=MAX_PICS-siteBar.querySelectorAll('.ppx-thumb').length;
      imgs=imgs.filter(u=>!have.has(ukey(u))).slice(0,Math.max(0,room));if(!imgs.length)return;
      const onShow=(b,u)=>{const main=stage.querySelector('img.ppx-main-image');if(!main)return;showStore(main,u);
        siteBar.querySelectorAll('.ppx-thumb').forEach(x=>{const on=x===b;x.classList.toggle('is-active',on);x.setAttribute('aria-pressed',String(on));});};
      imgs.forEach((u,i)=>siteBar.appendChild(thumb(u,i,onShow)));
      // the site's own buttons switch back: take the highlight off the store ones
      siteBar.addEventListener('click',e=>{if(e.target.closest('[data-ppx-thumb]'))siteBar.querySelectorAll('.ppd-x').forEach(x=>{x.classList.remove('is-active');x.setAttribute('aria-pressed','false');});});
      return;
    }
    if(host.querySelector('.ppd-thumbs'))return;
    if(!imgs.length){host.dataset.ppdNoGal=id;return;}
    let main=stage.querySelector('img.ppx-main-image');
    if(!main){stage.querySelector('.ppx-noimg')?.remove();main=document.createElement('img');main.className='pp-global-product-image ppx-main-image ppd-store-img';main.alt=host.dataset.productName||'';main.loading='eager';main.style.cssText='object-fit:contain;max-width:100%;max-height:100%';main.referrerPolicy='no-referrer';main.src=imgs[0];stage.appendChild(main);}
    const first=main.getAttribute('src')||'';
    const list=[first,...imgs.filter(u=>ukey(u)!==ukey(first))].filter(Boolean).slice(0,MAX_PICS);
    if(list.length<2){host.dataset.ppdNoGal=id;return;}
    const bar=document.createElement('div');bar.className='ppx-thumbs ppd-thumbs';bar.setAttribute('aria-label','Product pictures');
    const orig={src:first,style:main.getAttribute('style')||''};
    const onShow=(b,u)=>{if(u===orig.src){main.src=u;main.setAttribute('style',orig.style);}else showStore(main,u);
      bar.querySelectorAll('.ppx-thumb').forEach(x=>{const on=x===b;x.classList.toggle('is-active',on);x.setAttribute('aria-pressed',String(on));});};
    list.forEach((u,i)=>{const b=thumb(u,i,onShow);if(i===0)b.classList.add('is-active');bar.appendChild(b);});
    stage.insertAdjacentElement('afterend',bar);
  }
  function galleryDone(host,id){return host.dataset.ppdNoGal===id||!!host.querySelector('.ppd-thumbs')||host.querySelector('.ppx-thumbs')?.dataset.ppdx===id;}

  async function ensure(host,id,place){
    if(!id)return;
    // V277: on the Find page other blocks get inserted right after the card, so look for ANY sibling block for this product (was: only the next sibling -> block added twice)
    const sib=()=>{const par=host.parentElement;return !!(par&&[...par.children].some(c=>c!==host&&c.classList.contains('ppd')&&c.dataset.for===String(id)));};
    const has=place==='after'?sib():!!host.querySelector(':scope > .ppd');
    if(has&&(place==='after'||galleryDone(host,id)))return;
    if(host.dataset.ppdBusy===id)return;host.dataset.ppdBusy=id;
    const d=await load(id);
    delete host.dataset.ppdBusy;
    if(!d||!host.isConnected)return;
    if(place!=='after')try{ensureGallery(host,d,id);}catch(_){}
    const html=blockHTML(d);if(!html)return;
    if(place==='after'?sib():host.querySelector(':scope > .ppd'))return;
    const el=document.createElement('section');el.className='ppd';el.dataset.for=id;el.innerHTML=html;
    if(place==='after')host.insertAdjacentElement('afterend',el);else host.appendChild(el);
  }

  let t=0;
  function scan(){
    t=0;
    const pr=document.querySelector('.ppx-product[data-product-id]');
    if(pr)ensure(pr,pr.dataset.productId,'inside');
    const fd=document.querySelector('.ppf-main[data-product-id]');
    if(fd)ensure(fd,fd.dataset.productId,'after');
  }
  const mo=new MutationObserver(()=>{if(!t)t=setTimeout(scan,250);});
  const start=()=>{mo.observe(document.body,{childList:true,subtree:true});scan();};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
