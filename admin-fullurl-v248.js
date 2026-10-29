/* PricePulse V248 — Admin: "Full product URL" (for the PricePulse browser extension).
   The extension recognises a product on Amazon / Flipkart by its ASIN / pid. Short affiliate links
   (link.amazon, amzn.to, fktr.in…) do not contain it, so those listings are not linked to the extension.
   This list shows Amazon / Flipkart listings without a full product URL: Open → copy the address → paste → Save.
   Saves direct_url and (V250) marks the listing as checked by you (match_status 'match', active), because you
   pasted the exact product page. The extension only shows checked listings. Affiliate link is not changed. No new SQL. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof api!=='undefined'&&api&&typeof permitted!=='undefined'&&permitted&&typeof catalogListings!=='undefined';
  const STORES={
    amazon:{name:'Amazon',host:/(^|\.)amazon\.in$/i,key:u=>{const m=String(u).match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?#]|$)/i);return m?m[1].toUpperCase():'';},
      clean:(u,k)=>`https://www.amazon.in/dp/${k}`,search:q=>`https://www.amazon.in/s?k=${encodeURIComponent(q)}`},
    flipkart:{name:'Flipkart',host:/(^|\.)flipkart\.com$/i,key:u=>{const m=String(u).match(/[?&]pid=([A-Za-z0-9]{6,20})(?:&|#|$)/);return m?m[1].toUpperCase():'';},
      clean:(u,k)=>{try{const x=new URL(u);return `https://www.flipkart.com${x.pathname}?pid=${k}`;}catch(_){return '';}},search:q=>`https://www.flipkart.com/search?q=${encodeURIComponent(q)}`}
  };
  let tab='missing',q='';
  const msg=(t,bad)=>{const el=$('ppFuMsg');if(el){el.textContent=t||'';el.style.color=bad?'#a33':'#64756e';}};
  const prod=id=>(typeof products!=='undefined'&&products.find(p=>p.id===id))||null;
  const keyOf=l=>{const s=STORES[l.store_slug];return s?(s.key(l.direct_url||'')||s.key(l.affiliate_url||'')):'';};

  function install(){
    const host=$('ppGrowthAdmin');if(!host||$('ppFullUrlAdmin'))return !!$('ppFullUrlAdmin');
    const wrap=document.createElement('section');wrap.id='ppFullUrlAdmin';wrap.className='pp-deals-admin-card pp-growth-card';
    wrap.innerHTML=`
      <div class="pp-deals-admin-head"><div><h2>Full product URL (extension)</h2><p class="muted">The PricePulse extension finds your product on Amazon / Flipkart by its product code (ASIN / pid). Short affiliate links (link.amazon, amzn.to, fktr.in) do not show it, so these listings are <b>not linked</b> to the extension yet: shoppers do not see your verified prices, history or alert button there.</p></div><span class="pp-deals-admin-badge">🧩 EXTENSION</span></div>
      <div class="pp-growth-tabs" id="ppFuTabs"></div>
      <div class="pp-dl-tools"><input id="ppFuSearch" type="search" placeholder="Search product…"><span id="ppFuCount" class="muted"></span></div>
      <p id="ppFuMsg" class="muted" role="status"></p>
      <div id="ppFuList" class="pp-deals-list"></div>
      <div class="pp-deals-guidance"><b>How:</b> press <b>Open product</b>, copy the address from the browser bar (it has <b>/dp/B0…</b> on Amazon or <b>pid=…</b> on Flipkart), paste it and press <b>Save</b>. Saving also marks the link as checked by you, so make sure it is the same model, RAM / storage and colour. Your affiliate link is not changed.</div>`;
    const anchor=$('ppLinkFixAdmin');
    if(anchor&&anchor.parentNode===host)anchor.after(wrap);else host.prepend(wrap);
    if(!$('ppFuStyle')){const st=document.createElement('style');st.id='ppFuStyle';st.textContent=`.pp-fu-row{flex-wrap:wrap;gap:10px}.pp-fu-row h3{font-size:15px}.pp-fu-url{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#64756e}.pp-fu-edit{flex:1 1 100%;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pp-fu-edit input{flex:1 1 260px;min-width:0;height:36px;padding:0 10px;border:1px solid #dce9e4;border-radius:9px}.pp-fu-actions{display:flex;gap:8px;flex-wrap:wrap}.pp-fu-actions a{font-weight:700;color:#13805A;text-decoration:none;align-self:center}.pp-fu-key{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;background:#e3f5ec;color:#13805A;margin-left:6px}`;document.head.appendChild(st);}
    $('ppFuSearch').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();render();});
    wrap.addEventListener('click',onClick);
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(render,0));
    [0,1200,3000,6000].forEach(t=>setTimeout(render,t));
    return true;
  }
  function rows(){
    if(!ready())return [];
    return (catalogListings||[]).filter(l=>l&&STORES[l.store_slug]&&l.active!==false&&!['not_listed','track_only'].includes(l.listing_status))
      .map(l=>({l,p:prod(l.product_id),k:keyOf(l)})).filter(x=>x.p&&x.p.status!=='archived');
  }
  function render(){
    const list=$('ppFuList');if(!list)return;
    if(!ready()){list.innerHTML='<div class="pp-deals-row"><div><h3>Sign in with an admin account</h3><p>The list loads with your catalog.</p></div></div>';return;}
    const all=rows().map(x=>({...x,k:(x.k&&x.l.match_status==='match'&&x.l.active!==false)?x.k:''}));const n={missing:all.filter(x=>!x.k).length,done:all.filter(x=>x.k).length};
    $('ppFuTabs').innerHTML=[['missing','Not linked'],['done','Linked ✓']].map(([k,l])=>`<button type="button" data-fu-tab="${k}" class="${tab===k?'is-on':''}">${l} <b class="pp-dem-n">${n[k]}</b></button>`).join('');
    const shown=all.filter(x=>(tab==='missing'?!x.k:!!x.k)&&(!q||`${x.p.name} ${x.p.variant||''}`.toLowerCase().includes(q)))
      .sort((a,b)=>a.p.name.localeCompare(b.p.name)||a.l.store_slug.localeCompare(b.l.store_slug));
    $('ppFuCount').textContent=`${shown.length} shown`;
    list.innerHTML=shown.length?shown.slice(0,300).map(({l,p,k})=>{
      const s=STORES[l.store_slug],query=`${p.name} ${String(p.variant||'').split('·')[0]}`.trim();
      const open=l.affiliate_url||l.direct_url||s.search(query);
      return `<article class="pp-deals-row pp-fu-row" data-fu-pid="${h(l.product_id)}" data-fu-store="${h(l.store_slug)}">
        <div style="flex:1 1 280px;min-width:0"><h3>${h(p.name)} · ${h(s.name)}${k?`<span class="pp-fu-key">${h(k)}</span>`:''}</h3><p>${h(p.variant||'')}</p>${l.direct_url?`<span class="pp-fu-url" title="${h(l.direct_url)}">${h(l.direct_url)}</span>`:l.affiliate_url?`<span class="pp-fu-url" title="${h(l.affiliate_url)}">Affiliate: ${h(l.affiliate_url)}</span>`:''}</div>
        <div class="pp-fu-actions"><a href="${h(open)}" target="_blank" rel="noopener noreferrer">Open product ↗</a></div>
        <div class="pp-fu-edit"><input type="url" data-fu-input placeholder="Paste the full ${h(s.name)} product URL…"><button type="button" data-fu-save>Save</button></div></article>`;}).join('')
      :`<div class="pp-deals-row"><div><h3>${tab==='missing'?'All Amazon / Flipkart listings are linked':'Nothing linked yet'}</h3><p>${tab==='missing'?'The extension can recognise every listed product.':'Paste full URLs in the "Not linked" tab.'}</p></div></div>`;
  }
  async function onClick(e){
    const t=e.target.closest('[data-fu-tab]');if(t){tab=t.dataset.fuTab;render();return;}
    const row=e.target.closest('[data-fu-pid]');if(!row||!e.target.closest('[data-fu-save]'))return;
    const pid=row.dataset.fuPid,store=row.dataset.fuStore,s=STORES[store];
    const raw=row.querySelector('[data-fu-input]').value.trim();let u;
    try{u=new URL(raw);if(!/^https?:$/.test(u.protocol))throw 0;}catch(_){msg('Paste a full link that starts with https://',true);return;}
    if(!s.host.test(u.hostname.replace(/^m\./,''))){msg(`This is not a ${s.name} link. Open the product on ${s.name} and copy its address.`,true);return;}
    const k=s.key(u.href);
    if(!k){msg(store==='amazon'?'No product code found. The Amazon address must contain /dp/B0… (open the product page, not a search page).':'No product code found. The Flipkart address must contain pid=… (open the product page, not a search page).',true);return;}
    const clean=s.clean(u.href,k);
    const value={direct_url:clean,match_status:'match',active:true,listing_status:'active',updated_at:new Date().toISOString()};if(typeof user!=='undefined'&&user?.id)value.updated_by=user.id;
    const {error}=await api.from('pp_product_store_listings').update(value).eq('product_id',pid).eq('store_slug',store);
    if(error){msg(error.message,true);return;}
    const l=(catalogListings||[]).find(x=>x.product_id===pid&&x.store_slug===store);if(l)Object.assign(l,value);
    msg(`${s.name} linked (${k}). The extension recognises this product now.`);render();
  }
  let tries=0;const iv=setInterval(()=>{if(install()||++tries>40)clearInterval(iv);},250);
})();
