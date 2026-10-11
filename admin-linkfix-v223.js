/* PricePulse V223 — Admin: "Links to fix".
   One list of store links that still need you: missing exact link (switched off / store search link)
   and exact links nobody has checked yet. Open → paste the right link → Save.
   Uses the catalog already loaded by admin-prices.js (products, stores, catalogListings, api). No new SQL. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof api!=='undefined'&&api&&typeof permitted!=='undefined'&&permitted&&typeof catalogListings!=='undefined';
  const SEARCH_RE=/amazon\.[a-z.]+\/s\?|[?&](q|k|text|searchQuery|search_query)=|\/search(\/|\?|-listing|$)|\/searchB\?/i;
  const AFF_HOST=/(^|\.)(fktr\.in|ekaro\.in|earnkaro\.com|linksredirect\.com|amzn\.(to|in)|link\.amazon|clnk\.in|bitli\.in)$/i;
  const SEARCH={amazon:q=>`https://www.amazon.in/s?k=${encodeURIComponent(q)}`,flipkart:q=>`https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,croma:q=>`https://www.croma.com/searchB?q=${encodeURIComponent(q)}`,'reliance-digital':q=>`https://www.reliancedigital.in/search?q=${encodeURIComponent(q)}`,reliance:q=>`https://www.reliancedigital.in/search?q=${encodeURIComponent(q)}`,'vijay-sales':q=>`https://www.vijaysales.com/search-listing?q=${encodeURIComponent(q)}`,'tata-cliq':q=>`https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(q)}`,myntra:q=>`https://www.myntra.com/${encodeURIComponent(q.toLowerCase().replace(/\s+/g,'-'))}`,ajio:q=>`https://www.ajio.com/search/?text=${encodeURIComponent(q)}`,nykaa:q=>`https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}`,purplle:q=>`https://www.purplle.com/search?q=${encodeURIComponent(q)}`,jiomart:q=>`https://www.jiomart.com/search/${encodeURIComponent(q)}`,meesho:q=>`https://www.meesho.com/search?q=${encodeURIComponent(q)}`};
  let tab='missing',q='';
  const msg=(t,bad)=>{const el=$('ppLfMsg');if(el){el.textContent=t||'';el.style.color=bad?'#a33':'#64756e'}};
  const linkOf=l=>String(l.affiliate_url||l.direct_url||'');
  const isSearch=u=>SEARCH_RE.test(u);
  const groupOf=l=>{const u=linkOf(l);if(l.active===false||l.match_status==='needs_review'||!u||isSearch(u))return 'missing';if(l.match_status==='match')return 'done';return 'check';};
  const storeName=slug=>(typeof stores!=='undefined'&&stores.find(s=>s.slug===slug)?.name)||slug;
  const storeDomain=slug=>(typeof stores!=='undefined'&&stores.find(s=>s.slug===slug)?.domain)||'';
  const prod=id=>(typeof products!=='undefined'&&products.find(p=>p.id===id))||null;

  function install(){
    const host=$('ppGrowthAdmin');if(!host||$('ppLinkFixAdmin'))return !!$('ppLinkFixAdmin');
    const wrap=document.createElement('section');wrap.id='ppLinkFixAdmin';wrap.className='pp-deals-admin-card pp-growth-card';
    wrap.innerHTML=`
      <div class="pp-deals-admin-head"><div><h2>Links to fix</h2><p class="muted">Store links that still need you. <b>Missing</b>: no exact product page yet, so it is hidden on the website or shows "Search on store". <b>Check once</b>: an exact link was added for you. Open it once and confirm it is the same model, RAM/storage, size and colour.</p></div><span class="pp-deals-admin-badge">🔗 LINKS</span></div>
      <div class="pp-growth-tabs" id="ppLfTabs"></div>
      <div class="pp-dl-tools"><input id="ppLfSearch" type="search" placeholder="Search product or store…"><span id="ppLfCount" class="muted"></span></div>
      <p id="ppLfMsg" class="muted" role="status"></p>
      <div id="ppLfList" class="pp-deals-list"></div>
      <div class="pp-deals-guidance"><b>How:</b> press <b>Find on store</b> (or <b>Open</b>) to go to the product, copy the product page address, paste it and press <b>Save</b>. EarnKaro / fktr.in links go in as affiliate links automatically. A saved link counts as checked by you.</div>`;
    const anchor=$('ppLinksAdmin');
    if(anchor&&anchor.parentNode===host)anchor.after(wrap);else host.prepend(wrap);
    if(!$('ppLfStyle')){const st=document.createElement('style');st.id='ppLfStyle';st.textContent=`.pp-lf-row{flex-wrap:wrap;gap:10px}.pp-lf-row h3{font-size:15px}.pp-lf-url{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#64756e}.pp-lf-edit{flex:1 1 100%;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pp-lf-edit input{flex:1 1 260px;min-width:0;height:36px;padding:0 10px;border:1px solid #dce9e4;border-radius:9px}.pp-lf-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;background:#fff3d6;color:#7a5a12;margin-left:6px}.pp-lf-chip.off{background:#fde8e8;color:#9b1c1c}.pp-lf-chip.ok{background:#e3f5ec;color:#13805A}.pp-lf-actions{display:flex;gap:8px;flex-wrap:wrap}.pp-lf-actions a{font-weight:700;color:#13805A;text-decoration:none;align-self:center}`;document.head.appendChild(st);}
    $('ppLfSearch').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();render();});
    wrap.addEventListener('click',onClick);
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(render,0));
    [0,1200,3000,6000].forEach(t=>setTimeout(render,t));
    return true;
  }
  function rows(){
    if(!ready())return [];
    return (catalogListings||[]).filter(l=>l&&l.product_id&&!['not_listed','track_only'].includes(l.listing_status)).map(l=>({l,p:prod(l.product_id),g:groupOf(l)})).filter(x=>x.p&&x.p.status!=='archived');
  }
  function render(){
    const list=$('ppLfList');if(!list)return;
    if(!ready()){list.innerHTML='<div class="pp-deals-row"><div><h3>Sign in with an admin account</h3><p>The list loads with your catalog.</p></div></div>';return;}
    const all=rows();const n={missing:0,check:0,done:0};all.forEach(x=>n[x.g]++);
    $('ppLfTabs').innerHTML=[['missing','Missing link'],['check','Check once'],['done','Done ✓']].map(([k,l])=>`<button type="button" data-lf-tab="${k}" class="${tab===k?'is-on':''}">${l} <b class="pp-dem-n">${n[k]}</b></button>`).join('');
    const shown=all.filter(x=>x.g===tab&&(!q||`${x.p.name} ${x.p.variant} ${storeName(x.l.store_slug)}`.toLowerCase().includes(q))).sort((a,b)=>a.p.name.localeCompare(b.p.name)||storeName(a.l.store_slug).localeCompare(storeName(b.l.store_slug)));
    $('ppLfCount').textContent=`${shown.length} shown`;
    list.innerHTML=shown.length?shown.map(({l,p,g})=>{
      const u=linkOf(l),sName=storeName(l.store_slug),query=`${p.name} ${String(p.variant||'').split('·')[0]}`.trim();
      const openUrl=g==='missing'?(SEARCH[l.store_slug]?.(query)||u):u;
      const chip=g==='missing'?(l.active===false?'<span class="pp-lf-chip off">Hidden on site</span>':'<span class="pp-lf-chip">Shows "Search on store"</span>'):g==='done'?'<span class="pp-lf-chip ok">Checked</span>':'<span class="pp-lf-chip">Not checked</span>';
      return `<article class="pp-deals-row pp-lf-row" data-lf-pid="${h(l.product_id)}" data-lf-store="${h(l.store_slug)}">
        <div style="flex:1 1 280px;min-width:0"><h3>${h(p.name)} · ${h(sName)}${chip}</h3><p>${h(p.variant||'')}</p>${u?`<span class="pp-lf-url" title="${h(u)}">${h(u)}</span>`:''}</div>
        <div class="pp-lf-actions">${openUrl?`<a href="${h(openUrl)}" target="_blank" rel="noopener noreferrer">${g==='missing'?`Find on ${h(sName)} ↗`:'Open ↗'}</a>`:''}${g==='check'?`<button type="button" data-lf-ok>✓ Looks right</button><button type="button" class="subtle" data-lf-bad>Wrong product</button>`:''}</div>
        <div class="pp-lf-edit"><input type="url" data-lf-input placeholder="Paste the exact ${h(sName)} product link…" value="${g==='missing'?'':''}"><button type="button" data-lf-save>Save link</button></div></article>`;}).join(''):`<div class="pp-deals-row"><div><h3>${tab==='missing'?'No missing links':'Nothing here'}</h3><p>${tab==='missing'?'Every store link points to an exact product page.':'Good, nothing waiting in this list.'}</p></div></div>`;
  }
  async function update(pid,store,patch){
    const value={...patch,updated_at:new Date().toISOString()};if(typeof user!=='undefined'&&user?.id)value.updated_by=user.id;
    const {error}=await api.from('pp_product_store_listings').update(value).eq('product_id',pid).eq('store_slug',store);
    if(error){msg(error.message,true);return false;}
    const l=(catalogListings||[]).find(x=>x.product_id===pid&&x.store_slug===store);if(l)Object.assign(l,value);
    return true;
  }
  async function onClick(e){
    const t=e.target.closest('[data-lf-tab]');if(t){tab=t.dataset.lfTab;render();return;}
    const row=e.target.closest('[data-lf-pid]');if(!row)return;
    const pid=row.dataset.lfPid,store=row.dataset.lfStore,sName=storeName(store);
    if(e.target.closest('[data-lf-ok]')){if(await update(pid,store,{match_status:'match'})){msg(`${sName} link marked as checked.`);render();}return;}
    if(e.target.closest('[data-lf-bad]')){if(await update(pid,store,{match_status:'needs_review',active:false})){msg(`${sName} link hidden on the website until you paste the right one.`);tab='missing';render();}return;}
    if(e.target.closest('[data-lf-save]')){
      const raw=row.querySelector('[data-lf-input]').value.trim();let u;
      try{u=new URL(raw);if(!/^https?:$/.test(u.protocol))throw 0;}catch(_){msg('Paste a full link that starts with https://',true);return;}
      if(SEARCH_RE.test(u.href)){msg('That is a search page. Open the product itself and copy its address.',true);return;}
      const host=u.hostname.toLowerCase().replace(/^www\.|^m\./,''),aff=AFF_HOST.test(host),dom=String(storeDomain(store)).toLowerCase().replace(/^www\./,'');
      if(!aff&&dom&&!(host===dom||host.endsWith('.'+dom))&&!confirmDomain(row,host,dom))return;
      const patch=aff?{affiliate_url:u.href,match_status:'match',active:true,listing_status:'active'}:{direct_url:u.href,match_status:'match',active:true,listing_status:'active'};
      if(await update(pid,store,patch)){msg(`${sName} link saved${aff?' as affiliate link':''}. It is live on the website on the next page load.`);render();}
    }
  }
  function confirmDomain(row,host,dom){
    if(row.dataset.lfWarned===host){return true;}
    row.dataset.lfWarned=host;msg(`This link is from ${host}, not ${dom}. Press Save link again if it is right.`,true);return false;
  }
  let tries=0;const iv=setInterval(()=>{if(install()||++tries>40)clearInterval(iv)},250);
})();
