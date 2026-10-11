/* PricePulse V211 — Admin: Track requests + Sale countdown.
   Needs supabase-hero-growth-v211.sql installed once. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=s=>String(s??'').trim();
  const ready=()=>typeof api!=='undefined'&&api&&typeof permitted!=='undefined'&&permitted;
  const toLocal=v=>{if(!v)return'';const d=new Date(v);if(!Number.isFinite(d.getTime()))return'';const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`};
  const toIso=v=>v?new Date(v).toISOString():null;
  const missing=e=>/does not exist|schema cache|Could not find/i.test(e?.message||'');
  let reqs=[],events=[],reqFilter='new';
  const detailsHTML=r=>{const d=r.details&&typeof r.details==='object'?r.details:{};const parts=[['Brand',d.brand],['Model',d.model],['Variant',d.variant],['Colour',d.color],['Category',d.category]].filter(([,v])=>v);
    const price=r.reported_price?`<span class="pp-req-price">Shopper saw ₹${Number(r.reported_price).toLocaleString('en-IN')}${r.reported_store?` on ${h(r.reported_store)}`:''} · not verified</span>`:'';
    const watch=r.watchers_count?`<span class="pp-req-price">🔔 ${r.watchers_count} want an alert${r.lowest_target?` · lowest target ₹${Number(r.lowest_target).toLocaleString('en-IN')}`:''}</span>`:'';
    if(!parts.length&&!price&&!watch)return '';
    return `<div class="pp-req-det">${d.confirmed?'<span class="pp-req-ok">✓ Confirmed by shopper</span>':''}${parts.map(([k,v])=>`<span><small>${k}</small>${h(v)}</span>`).join('')}${price}${watch}</div>`;};
  const shortUrl=u=>{try{const x=new URL(u);if(/#search=/.test(x.hash))return 'Name search: '+decodeURIComponent(x.hash.replace(/^#search=/,''));let path=x.pathname.replace(/\/ref=.*$/,'');if(path.length>60)path=path.slice(0,57)+'…';return x.hostname.replace(/^www\./,'')+path}catch(_){return String(u).slice(0,70)}};

  function install(){
    const anchor=$('plusAdminCard');if(!anchor||$('ppGrowthAdmin'))return;
    const wrap=document.createElement('div');wrap.id='ppGrowthAdmin';wrap.className='growth-only';
    wrap.innerHTML=`
    <section class="pp-deals-admin-card pp-growth-card">
      <div class="pp-deals-admin-head"><div><h2>Track requests</h2><p class="muted">Links shoppers pasted that we don't track yet. Add the product in Catalog, then mark the request <b>Added</b> with its product ID. Next time anyone pastes the same link, the website opens that product directly, and shoppers who asked for an alert get a Deal Alert automatically.</p></div><span class="pp-deals-admin-badge">↗ DEMAND</span></div>
      <div class="pp-growth-tabs" role="tablist">
        <button type="button" data-req-filter="new" class="is-on">New</button><button type="button" data-req-filter="added">Added</button><button type="button" data-req-filter="rejected">Rejected</button><button type="button" data-req-filter="all">All</button>
        <button type="button" class="subtle" id="ppReqRefresh">Refresh</button>
      </div>
      <p id="ppReqMsg" class="muted" role="status"></p>
      <div id="ppReqList" class="pp-deals-list"></div>
    </section>
    <section class="pp-deals-admin-card pp-growth-card">
      <div class="pp-deals-admin-head"><div><h2>Sale countdown</h2><p class="muted">Shown as a strip above the home hero from 21 days before the sale starts until it ends. Only <b>Active</b> sales are shown; the nearest one appears.</p></div><span class="pp-deals-admin-badge">⏱ SALES</span></div>
      <form id="ppSaleForm" class="pp-deals-form">
        <input type="hidden" id="ppSaleId">
        <label class="wide">Sale name<input id="ppSaleTitle" required maxlength="80" placeholder="Big Billion Days"></label>
        <label>Store<select id="ppSaleStore"><option value="">All stores</option><option>Amazon</option><option>Flipkart</option><option>Croma</option><option>Myntra</option><option>AJIO</option><option>Meesho</option></select></label>
        <label>Starts<input id="ppSaleStart" type="datetime-local" required></label>
        <label>Ends<input id="ppSaleEnd" type="datetime-local" required></label>
        <label class="wide">Short note (optional)<input id="ppSaleNote" maxlength="80" placeholder="Biggest sale of the year"></label>
        <div class="full pp-deals-checks"><label><input id="ppSaleActive" type="checkbox"> Active / show on website</label></div>
      </form>
      <div class="pp-deals-actions"><button id="ppSaleSave" type="button">Save sale</button><button id="ppSaleReset" class="ghost" type="button">Clear form</button></div>
      <p id="ppSaleMsg" class="muted" role="status"></p>
      <div class="pp-deals-guidance"><b>Rule:</b> enter only official sale dates announced by the store. Wrong dates break trust faster than no countdown.</div>
      <div id="ppSaleList" class="pp-deals-list"></div>
    </section>`;
    anchor.parentElement.insertBefore(wrap,anchor);
    wrap.addEventListener('click',onClick);
    $('ppSaleSave').addEventListener('click',saveSale);
    $('ppSaleReset').addEventListener('click',resetSale);
    $('ppReqRefresh').addEventListener('click',loadAll);
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(loadAll,0));
    resetSale();
    [0,900,2200].forEach(t=>setTimeout(()=>{if(document.body.dataset.adminView==='growth')loadAll()},t));
  }
  const msg=(id,t,bad)=>{const el=$(id);if(el){el.textContent=t||'';el.style.color=bad?'#a33':'#64756e'}};
  async function loadAll(){await Promise.all([loadReqs(),loadSales()]);}
  async function loadReqs(){
    if(!ready()){msg('ppReqMsg','Sign in with an admin account to see requests.');return}
    msg('ppReqMsg','Loading requests…');
    const q=await api.rpc('pp_admin_list_track_requests');
    if(q.error){msg('ppReqMsg',missing(q.error)?'Run supabase-hero-growth-v211.sql once in Supabase, then refresh.':q.error.message,true);return}
    reqs=Array.isArray(q.data)?q.data:[];renderReqs();
  }
  function renderReqs(){
    const list=$('ppReqList');
    const rows=reqFilter==='all'?reqs:reqs.filter(r=>r.status===reqFilter);
    const newCount=reqs.filter(r=>r.status==='new').length;
    msg('ppReqMsg',`${newCount} new request${newCount===1?'':'s'} · ${reqs.length} total`);
    if(!rows.length){list.innerHTML='<div class="pp-deals-row"><div><h3>Nothing here</h3><p>New links pasted on the website will appear here.</p></div></div>';return}
    list.innerHTML=rows.map(r=>`<article class="pp-deals-row" data-req="${h(r.id)}"><div style="min-width:0">
      <h3>${h(r.store||(String(r.url_key||'').startsWith('search:')?'Searched by name':'Unknown store'))} · <span class="pp-deals-chip">${h(r.request_count)}× asked</span> <span class="pp-deals-chip ${r.status==='new'?'':'off'}">${h(r.status.toUpperCase())}</span></h3>
      <p style="word-break:break-all"><a href="${h(r.url)}" target="_blank" rel="noopener noreferrer" title="${h(r.url)}">${h(shortUrl(r.url))}</a> <button type="button" class="ghost" data-req-copy style="padding:3px 9px;font-size:11px">Copy link</button></p>
      ${detailsHTML(r)}<p class="muted">First asked ${h(new Date(r.created_at).toLocaleString('en-IN'))}${r.product_id?` · Product: <b>${h(r.product_id)}</b>`:''}${r.admin_note?` · ${h(r.admin_note)}`:''}</p>
      <div class="pp-growth-inline"><input placeholder="product-id (e.g. oneplus-nord6)" value="${h(r.product_id||'')}" data-req-pid><input placeholder="Note (optional)" value="${h(r.admin_note||'')}" data-req-note></div>
    </div><div class="pp-deals-row-actions"><button type="button" data-req-set="added">Mark added</button><button type="button" class="ghost" data-req-set="rejected">Reject</button><button type="button" class="danger-soft" data-req-del>Delete</button></div></article>`).join('');
  }
  async function loadSales(){
    if(!ready())return;
    const q=await api.rpc('pp_admin_list_sale_events');
    if(q.error){msg('ppSaleMsg',missing(q.error)?'Run supabase-hero-growth-v211.sql once in Supabase, then refresh.':q.error.message,true);return}
    events=Array.isArray(q.data)?q.data:[];renderSales();
  }
  function renderSales(){
    const list=$('ppSaleList');
    if(!events.length){list.innerHTML='<div class="pp-deals-row"><div><h3>No sales yet</h3><p>Add the next official sale above.</p></div></div>';return}
    const now=Date.now();
    list.innerHTML=events.map(e=>{const s=Date.parse(e.starts_at),en=Date.parse(e.ends_at);const state=en<now?'ENDED':s<=now?'LIVE':'UPCOMING';return `<article class="pp-deals-row" data-sale="${h(e.id)}"><div><h3>${h(e.title)}${e.store?` · ${h(e.store)}`:''}</h3><p>${h(new Date(e.starts_at).toLocaleString('en-IN'))} → ${h(new Date(e.ends_at).toLocaleString('en-IN'))}</p>${e.note?`<p>${h(e.note)}</p>`:''}<div class="meta"><span class="pp-deals-chip ${e.active?'':'off'}">${e.active?'ACTIVE':'HIDDEN'}</span><span class="pp-deals-chip">${state}</span></div></div><div class="pp-deals-row-actions"><button type="button" data-sale-edit>Edit</button><button type="button" class="danger-soft" data-sale-del>Delete</button></div></article>`}).join('');
  }
  function resetSale(){['ppSaleId','ppSaleTitle','ppSaleNote','ppSaleStart','ppSaleEnd'].forEach(id=>$(id).value='');$('ppSaleStore').value='';$('ppSaleActive').checked=false;msg('ppSaleMsg','')}
  async function saveSale(){
    if(!ready()){msg('ppSaleMsg','Admin database access required.',true);return}
    const title=clean($('ppSaleTitle').value),st=toIso($('ppSaleStart').value),en=toIso($('ppSaleEnd').value);
    if(title.length<3||!st||!en){msg('ppSaleMsg','Sale name, start and end are required.',true);return}
    if(Date.parse(en)<=Date.parse(st)){msg('ppSaleMsg','End must be after start.',true);return}
    const btn=$('ppSaleSave');btn.disabled=true;
    const q=await api.rpc('pp_admin_upsert_sale_event',{ev_id:clean($('ppSaleId').value)||null,ev_title:title,ev_store:$('ppSaleStore').value||null,ev_starts_at:st,ev_ends_at:en,ev_note:clean($('ppSaleNote').value)||null,ev_active:$('ppSaleActive').checked});
    btn.disabled=false;
    if(q.error){msg('ppSaleMsg',missing(q.error)?'Run supabase-hero-growth-v211.sql once in Supabase first.':q.error.message,true);return}
    resetSale();await loadSales();msg('ppSaleMsg','Sale saved. Active sales show on the website within a minute.');
  }
  async function onClick(e){
    const f=e.target.closest('[data-req-filter]');
    if(f){reqFilter=f.dataset.reqFilter;document.querySelectorAll('[data-req-filter]').forEach(b=>b.classList.toggle('is-on',b===f));renderReqs();return}
    const row=e.target.closest('[data-req]');
    if(row){
      const id=row.dataset.req;
      if(e.target.closest('[data-req-copy]')){const r=reqs.find(x=>x.id===id);try{await navigator.clipboard.writeText(r.url);msg('ppReqMsg','Link copied.')}catch(_){prompt('Copy link:',r.url)}return}
      if(e.target.closest('[data-req-del]')){if(!confirm('Delete this request?'))return;const q=await api.rpc('pp_admin_delete_track_request',{req_id:id});if(q.error){msg('ppReqMsg',q.error.message,true);return}await loadReqs();return}
      const set=e.target.closest('[data-req-set]');
      if(set){const pid=clean(row.querySelector('[data-req-pid]').value),note=clean(row.querySelector('[data-req-note]').value);
        if(set.dataset.reqSet==='added'&&!/^[a-z0-9-]+$/.test(pid)){msg('ppReqMsg','Enter the product ID from Catalog (lowercase, e.g. oneplus-nord6) before marking Added.',true);return}
        const q=await api.rpc('pp_admin_update_track_request',{req_id:id,req_status:set.dataset.reqSet,req_product_id:pid||null,req_note:note||null});
        if(q.error){msg('ppReqMsg',q.error.message,true);return}await loadReqs();}
      return;
    }
    const srow=e.target.closest('[data-sale]');
    if(srow){
      const ev=events.find(x=>x.id===srow.dataset.sale);if(!ev)return;
      if(e.target.closest('[data-sale-edit]')){$('ppSaleId').value=ev.id;$('ppSaleTitle').value=ev.title||'';$('ppSaleStore').value=ev.store||'';$('ppSaleStart').value=toLocal(ev.starts_at);$('ppSaleEnd').value=toLocal(ev.ends_at);$('ppSaleNote').value=ev.note||'';$('ppSaleActive').checked=!!ev.active;$('ppSaleTitle').focus();return}
      if(e.target.closest('[data-sale-del]')){if(!confirm(`Delete “${ev.title}”?`))return;const q=await api.rpc('pp_admin_delete_sale_event',{ev_id:ev.id});if(q.error){msg('ppSaleMsg',q.error.message,true);return}await loadSales();}
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
