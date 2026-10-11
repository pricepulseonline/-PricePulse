/* PricePulse V224 — Admin: Review products.
   One screen to go through every product once: name, variant, brand, category and every store link
   (open, replace, move to another store, remove, add). "Save & mark reviewed" stores reviewed_at in
   the product metadata, so the counter shows how many are done. Uses admin-prices.js globals
   (api, user, permitted, products, brands, stores, catalogListings, refreshAll). No new SQL. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof api!=='undefined'&&api&&typeof permitted!=='undefined'&&permitted&&typeof catalogListings!=='undefined'&&typeof catalogReady!=='undefined'&&catalogReady;
  const SEARCH_RE=/amazon\.[a-z.]+\/s\?|[?&](q|k|text|searchQuery|search_query)=|\/search(\/|\?|-listing|$)|\/searchB\?/i;
  const AFF_HOST=/(^|\.)(fktr\.in|ekaro\.in|earnkaro\.com|linksredirect\.com|amzn\.(to|in)|link\.amazon|clnk\.in|bitli\.in)$/i;
  let tab='todo',q='';
  const cats=()=>{const base=(typeof PP_ADMIN_BASE_CATEGORIES!=='undefined'?PP_ADMIN_BASE_CATEGORIES:[['mobiles','Mobiles'],['laptops','Laptops'],['electronics','Electronics'],['home','Home & Kitchen'],['fashion','Fashion'],['appliances','Appliances'],['beauty','Beauty'],['watches','Watches']]).slice();const have=new Set(base.map(c=>c[0]));(products||[]).forEach(p=>{if(p.category&&!have.has(p.category)){have.add(p.category);base.push([p.category,p.category]);}});return base;};
  const reviewed=p=>!!(p.metadata&&p.metadata.reviewed_at);
  const live=()=>(typeof products!=='undefined'?products:[]).filter(p=>p.status!=='archived');
  const listingsOf=pid=>(catalogListings||[]).filter(l=>l.product_id===pid);
  const linkOf=l=>String(l.affiliate_url||l.direct_url||'');
  const storeDomain=slug=>String((stores||[]).find(s=>s.slug===slug)?.domain||'').toLowerCase().replace(/^www\./,'');
  const msg=(t,bad)=>{const el=$('ppRvMsg');if(el){el.textContent=t||'';el.style.color=bad?'#a33':'#64756e'}};

  function counterText(){const all=live();const done=all.filter(reviewed).length;return `${done}/${all.length}`;}
  function install(){
    const bar=document.querySelector('#dashboard .catalog-actions');if(!bar)return false;
    if(!$('ppReviewBtn')){const b=document.createElement('button');b.type='button';b.id='ppReviewBtn';b.className='ghost';b.innerHTML='✓ Review products <b id="ppReviewCount"></b>';bar.prepend(b);b.addEventListener('click',open);}
    if(!$('ppReviewDialog')){
      const d=document.createElement('dialog');d.id='ppReviewDialog';
      d.innerHTML=`<div class="pp-rv">
        <div class="pp-rv-head"><div><h2>Review products <span id="ppRvCounter" class="pp-rv-count"></span></h2><p class="muted">Go through each product once. Fix the name, variant, brand, category or any store link right here, then press <b>Save &amp; mark reviewed</b>.</p></div><button type="button" class="subtle" data-rv-close>Close ✕</button></div>
        <div class="pp-rv-tools"><div class="pp-growth-tabs" id="ppRvTabs"></div><input id="ppRvSearch" type="search" placeholder="Search product, brand or store…"></div>
        <p id="ppRvMsg" class="muted" role="status"></p>
        <div id="ppRvList"></div></div>`;
      document.body.appendChild(d);
      d.addEventListener('click',onClick);d.addEventListener('change',onChange);
      $('ppRvSearch').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();render();});
      const st=document.createElement('style');st.textContent=`#ppReviewDialog{width:min(1100px,calc(100vw - 16px));max-width:none;max-height:94dvh;border:0;border-radius:20px;padding:0;box-shadow:0 30px 80px rgba(8,34,53,.35)}#ppReviewDialog::backdrop{background:rgba(8,34,53,.55)}.pp-rv{padding:20px;max-height:94dvh;overflow:auto}.pp-rv-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pp-rv-head h2{margin:0 0 4px}.pp-rv-count{display:inline-block;margin-left:8px;padding:3px 10px;border-radius:999px;background:#e3f5ec;color:#13805A;font-size:14px}.pp-rv-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}.pp-rv-tools input{flex:1;min-width:200px;height:38px;padding:0 12px;border:1px solid #dce9e4;border-radius:10px}.pp-rv-card{border:1px solid #dce9e4;border-radius:16px;padding:16px;margin:0 0 14px;background:#fff}.pp-rv-card.is-done{background:#f6fbf8}.pp-rv-grid{display:grid;grid-template-columns:2fr 1.4fr 1fr 1fr;gap:10px}.pp-rv-grid label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#587080}.pp-rv-grid input,.pp-rv-grid select,.pp-rv-l input,.pp-rv-l select{height:36px;padding:0 10px;border:1px solid #dce9e4;border-radius:9px;font:inherit;font-size:14px;min-width:0}.pp-rv-ls{margin-top:12px;display:flex;flex-direction:column;gap:8px}.pp-rv-l{display:grid;grid-template-columns:150px 1fr auto auto;gap:8px;align-items:center}.pp-rv-l.is-off{opacity:.55}.pp-rv-l a{font-weight:700;color:#13805A;text-decoration:none;white-space:nowrap}.pp-rv-l .pp-rv-x{border:0;background:#fde8e8;color:#9b1c1c;border-radius:8px;height:34px;padding:0 10px;cursor:pointer}.pp-rv-foot{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap}.pp-rv-tag{font-size:12px;font-weight:800;padding:3px 9px;border-radius:999px;background:#fff3d6;color:#7a5a12}.pp-rv-tag.ok{background:#e3f5ec;color:#13805A}.pp-rv-warn{font-size:12px;color:#9b1c1c}@media(max-width:760px){.pp-rv-grid{grid-template-columns:1fr 1fr}.pp-rv-l{grid-template-columns:1fr auto}.pp-rv-l input{grid-column:1/-1}}`;document.head.appendChild(st);
    }
    updateCount();return true;
  }
  function updateCount(){const c=$('ppReviewCount');if(c&&ready())c.textContent=counterText();}
  function open(){if(!ready()){alert('Sign in with an admin account and wait for the catalog to load.');return;}render();$('ppReviewDialog').showModal();}
  function storeOptions(sel){return (stores||[]).filter(s=>s.active!==false||s.slug===sel).map(s=>`<option value="${h(s.slug)}"${s.slug===sel?' selected':''}>${h(s.name)}</option>`).join('');}
  function listingRow(l){
    const u=linkOf(l),off=l.active===false||l.listing_status==='not_listed',search=u&&SEARCH_RE.test(u);
    return `<div class="pp-rv-l${off?' is-off':''}" data-rv-store="${h(l.store_slug)}">
      <select data-rv-f="store">${storeOptions(l.store_slug)}</select>
      <input data-rv-f="url" type="url" value="${h(u)}" placeholder="${off?'Hidden on site. Paste the exact product link to show it again':'Exact product page link'}">
      ${u?`<a href="${h(u)}" target="_blank" rel="noopener noreferrer">Open ↗</a>`:'<span></span>'}
      ${off?'<span class="pp-rv-tag">Hidden</span>':`<button type="button" class="pp-rv-x" data-rv-remove title="Hide this store for this product">Remove</button>`}
      ${search?'<span class="pp-rv-warn" style="grid-column:1/-1">This is a store search page, not the product. Paste the product page link.</span>':''}</div>`;
  }
  function card(p){
    const done=reviewed(p),ls=listingsOf(p.id);
    return `<article class="pp-rv-card${done?' is-done':''}" data-rv-pid="${h(p.id)}">
      <div class="pp-rv-grid">
        <label>Product name<input data-rv-f="name" value="${h(p.name)}"></label>
        <label>Variant (RAM / storage / size / colour)<input data-rv-f="variant" value="${h(p.variant||'')}"></label>
        <label>Brand<select data-rv-f="brand">${(brands||[]).map(b=>`<option value="${h(b.slug)}"${b.slug===p.brandSlug?' selected':''}>${h(b.name)}</option>`).join('')}</select></label>
        <label>Category<select data-rv-f="category">${cats().map(([v,l])=>`<option value="${h(v)}"${v===p.category?' selected':''}>${h(l)}</option>`).join('')}</select></label>
      </div>
      <div class="pp-rv-ls">${ls.map(listingRow).join('')}
        <div class="pp-rv-l" data-rv-new><select data-rv-f="store"><option value="">+ Add a store…</option>${storeOptions('')}</select><input data-rv-f="url" type="url" placeholder="Exact product link for the new store"><span></span><span></span></div>
      </div>
      <div class="pp-rv-foot"><span class="pp-rv-tag${done?' ok':''}">${done?'Reviewed ✓':'Not reviewed yet'}</span><div class="pp-lf-actions" style="display:flex;gap:8px"><a href="index.html#/product/${encodeURIComponent(p.id)}" target="_blank" rel="noopener" style="align-self:center;font-weight:700;color:#13805A;text-decoration:none">View on site ↗</a><button type="button" data-rv-save>${done?'Save changes':'Save &amp; mark reviewed ✓'}</button></div></div>
    </article>`;
  }
  function render(){
    const list=$('ppRvList');if(!list)return;
    const all=live(),todo=all.filter(p=>!reviewed(p)),done=all.filter(reviewed);
    $('ppRvCounter').textContent=`Reviewed ${done.length}/${all.length}`;
    $('ppRvTabs').innerHTML=[['todo','To review',todo.length],['done','Reviewed ✓',done.length],['all','All',all.length]].map(([k,l,n])=>`<button type="button" data-rv-tab="${k}" class="${tab===k?'is-on':''}">${l} <b class="pp-dem-n">${n}</b></button>`).join('');
    const src=tab==='todo'?todo:tab==='done'?done:all;
    const shown=src.filter(p=>!q||`${p.name} ${p.variant} ${p.brand} ${listingsOf(p.id).map(l=>l.store_slug).join(' ')}`.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
    list.innerHTML=shown.length?shown.map(card).join(''):`<div class="pp-deals-row"><div><h3>${tab==='todo'?'All products reviewed 🎉':'Nothing here'}</h3><p>${tab==='todo'?'Every product has been checked once.':''}</p></div></div>`;
    updateCount();
  }
  function onChange(e){const row=e.target.closest('.pp-rv-l');if(row&&e.target.matches('[data-rv-f="store"]'))row.dataset.rvMoved='1';}
  function validUrl(raw,store){
    let u;try{u=new URL(raw);if(!/^https?:$/.test(u.protocol))throw 0;}catch(_){return {err:'Paste a full link that starts with https://'};}
    if(SEARCH_RE.test(u.href))return {err:'That is a search page. Open the product itself and copy its address.'};
    const host=u.hostname.toLowerCase().replace(/^www\.|^m\./,''),aff=AFF_HOST.test(host),dom=storeDomain(store);
    if(!aff&&dom&&!(host===dom||host.endsWith('.'+dom)))return {warn:`Link is from ${host}, store is ${dom}.`,u,aff};
    return {u,aff};
  }
  async function save(cardEl){
    const pid=cardEl.dataset.rvPid,p=(products||[]).find(x=>x.id===pid);if(!p)return;
    const f=k=>cardEl.querySelector(`.pp-rv-grid [data-rv-f="${k}"]`).value.trim();
    const now=new Date().toISOString(),by=(typeof user!=='undefined'&&user?.id)?{updated_by:user.id}:{};
    const ops=[];let warn=null;
    for(const row of cardEl.querySelectorAll('.pp-rv-l')){
      const isNew=row.hasAttribute('data-rv-new'),oldStore=row.dataset.rvStore||'',store=row.querySelector('[data-rv-f="store"]').value,raw=row.querySelector('[data-rv-f="url"]').value.trim();
      if(isNew){if(!store&&!raw)continue;if(!store||!raw){msg('Pick a store and paste its product link to add it.',true);return;}}
      const l=isNew?null:listingsOf(pid).find(x=>x.store_slug===oldStore);
      const changedUrl=!isNew&&raw!==linkOf(l),moved=!isNew&&store!==oldStore;
      if(!isNew&&!changedUrl&&!moved)continue;
      if(!raw){msg(`Paste a link for ${store}, or press Remove to hide it.`,true);return;}
      const v=validUrl(raw,store);if(v.err){msg(v.err,true);row.querySelector('[data-rv-f="url"]').focus();return;}
      if(v.warn&&cardEl.dataset.rvWarned!==v.warn){warn=v.warn;cardEl.dataset.rvWarned=v.warn;}
      const urlFields=v.aff?{affiliate_url:v.u.href}:{direct_url:v.u.href,affiliate_url:null};
      const target=moved||isNew?store:oldStore;
      ops.push({kind:'upsert',value:{product_id:pid,store_slug:target,...urlFields,listing_status:'active',match_status:'match',active:true,updated_at:now,...by}});
      if(moved)ops.push({kind:'hide',store:oldStore});
    }
    if(warn){msg(`${warn} Press Save again if that is right.`,true);return;}
    const btn=cardEl.querySelector('[data-rv-save]');btn.disabled=true;btn.textContent='Saving…';
    const meta={...(p.metadata||{}),reviewed_at:now};
    const pr=await api.from('pp_catalog_products').update({name:f('name')||p.name,variant:f('variant')||null,brand_slug:f('brand')||p.brandSlug||null,category:f('category')||p.category,metadata:meta,updated_at:now,...by}).eq('product_id',pid);
    if(pr.error){btn.disabled=false;btn.textContent='Save & mark reviewed ✓';msg(pr.error.message,true);return;}
    for(const op of ops){
      const r=op.kind==='upsert'?await api.from('pp_product_store_listings').upsert(op.value,{onConflict:'product_id,store_slug'}):await api.from('pp_product_store_listings').update({active:false,listing_status:'not_listed',updated_at:now,...by}).eq('product_id',pid).eq('store_slug',op.store);
      if(r.error){btn.disabled=false;btn.textContent='Save & mark reviewed ✓';msg(r.error.message,true);return;}
    }
    if(typeof refreshAll==='function')await refreshAll();
    msg(`${f('name')||p.name} saved and marked reviewed.`);render();
  }
  async function onClick(e){
    if(e.target.closest('[data-rv-close]')){$('ppReviewDialog').close();return;}
    const t=e.target.closest('[data-rv-tab]');if(t){tab=t.dataset.rvTab;render();return;}
    const cardEl=e.target.closest('[data-rv-pid]');if(!cardEl)return;
    if(e.target.closest('[data-rv-remove]')){
      const row=e.target.closest('.pp-rv-l'),store=row.dataset.rvStore,pid=cardEl.dataset.rvPid;
      const r=await api.from('pp_product_store_listings').update({active:false,listing_status:'not_listed',updated_at:new Date().toISOString()}).eq('product_id',pid).eq('store_slug',store);
      if(r.error){msg(r.error.message,true);return;}
      const l=listingsOf(pid).find(x=>x.store_slug===store);if(l){l.active=false;l.listing_status='not_listed';}
      msg('Store hidden for this product. Paste a link later to show it again.');render();return;
    }
    if(e.target.closest('[data-rv-save]'))save(cardEl);
  }
  let tries=0;const iv=setInterval(()=>{if(install()&&++tries>4)clearInterval(iv);else if(++tries>60)clearInterval(iv);},500);
  setInterval(updateCount,4000);
})();
