/* PricePulse V211 — Admin: Track requests + Sale countdown. V278: Cashback panel (Cuelinks sync status, own rules, share, app links).
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
      <div class="pp-deals-admin-head"><div><h2>Sale countdown + Sales page</h2><p class="muted">Shown as a strip above the home hero from 21 days before the sale starts until it ends, and on the Sales page (#/sales) with the store's colours. Only <b>Active</b> sales are shown.</p></div><span class="pp-deals-admin-badge">⏱ SALES</span></div>
      <form id="ppSaleForm" class="pp-deals-form">
        <input type="hidden" id="ppSaleId">
        <label class="wide">Sale name<input id="ppSaleTitle" required maxlength="80" placeholder="Big Billion Days"></label>
        <label>Store<select id="ppSaleStore"><option value="">All stores</option><option>Amazon</option><option>Flipkart</option><option>Croma</option><option>Myntra</option><option>AJIO</option><option>Meesho</option><option>Nykaa</option><option>Nykaa Fashion</option><option>Tata CLiQ</option><option>Vijay Sales</option><option>Reliance Digital</option><option>JioMart</option><option>Shopsy</option></select></label>
        <label>Starts<input id="ppSaleStart" type="datetime-local" required></label>
        <label>Ends<input id="ppSaleEnd" type="datetime-local" required></label>
        <label class="wide">Short note (optional)<input id="ppSaleNote" maxlength="80" placeholder="Biggest sale of the year"></label>
        <label class="wide">Sale page link on the store (V276, optional)<input id="ppSaleLink" type="url" maxlength="500" placeholder="https://www.amazon.in/greatindianfestival"></label>
        <label>Theme colour (V276)<span class="pp-sale-colour"><input id="ppSaleColorPick" type="color" value="#f28a1e"><input id="ppSaleColor" maxlength="7" placeholder="auto"></span></label>
        <label>Dark shade (V276)<span class="pp-sale-colour"><input id="ppSaleDarkPick" type="color" value="#1d1d1d"><input id="ppSaleDark" maxlength="7" placeholder="auto"></span></label>
        <label class="wide">Banner image URL (V276, optional, your own design only)<input id="ppSaleBanner" type="url" maxlength="500" placeholder="https://..."></label>
        <p class="full muted">Leave the colours empty to use the store's default colours. Never copy the store's own sale banner or logo artwork.</p>
        <div class="full pp-deals-checks"><label><input id="ppSaleActive" type="checkbox"> Active / show on website</label></div>
      </form>
      <div class="pp-deals-actions"><button id="ppSaleSave" type="button">Save sale</button><button id="ppSaleReset" class="ghost" type="button">Clear form</button></div>
      <p id="ppSaleMsg" class="muted" role="status"></p>
      <div class="pp-deals-guidance"><b>Rule:</b> enter only official sale dates announced by the store. Wrong dates break trust faster than no countdown.</div>
      <div id="ppSaleList" class="pp-deals-list"></div>
    </section>
    <section class="pp-deals-admin-card pp-growth-card" id="ppCbCard">
      <div class="pp-deals-admin-head"><div><h2>Cashback (V278)</h2><p class="muted">Rates come from <b>Cuelinks every morning</b> (Edge Function <b>cuelinks-rates</b>): store + category + <b>brand</b> + model rows + <b>cap per sale</b>. There is <b>no store-wide rate</b>: a product with no matching rule shows no cashback. The shopper gets the <b>share</b> below of our commission. Synced rules count only for stores whose links go through Cuelinks (Links settings). <b>Amazon is never allowed.</b> Display only; payouts come with the wallet (Step 4).</p></div><span class="pp-deals-admin-badge">💸 CASHBACK</span></div>
      <form id="ppCbSetForm" class="pp-deals-form" onsubmit="return false">
        <label>Shopper share of our commission (%)<input id="ppCbShare" type="number" min="1" max="90" step="1" value="40"></label>
        <label>Smallest amount shown (₹)<input id="ppCbMin" type="number" min="1" max="500" step="1" value="5"></label>
        <label class="wide">Last Cuelinks sync<input id="ppCbLast" readonly value="—"></label>
      </form>
      <div class="pp-deals-actions"><button id="ppCbSetSave" type="button">Save share</button><button id="ppCbReload" type="button" class="ghost">Refresh</button></div>
      <p id="ppCbSetMsg" class="muted" role="status"></p>
      <h3 class="pp-cb-h" style="margin:24px 0 8px;display:flex;align-items:center;gap:10px;font-size:16px">Stores (what the last sync saw)</h3>
      <div id="ppCbStores" class="pp-deals-list"></div>
      <h3 class="pp-cb-h" style="margin:24px 0 8px;display:flex;align-items:center;gap:10px;font-size:16px">Products with no cashback <button id="ppCbNoMatchBtn" type="button" class="ghost">Check now</button></h3>
      <p class="muted">Products sold on a cashback store that match no rule (or a "no commission" rule). Add your own rule below if Cuelinks does pay for them.</p>
      <div id="ppCbNoMatch" class="pp-deals-list"></div>
      <h3 class="pp-cb-h" style="margin:24px 0 8px;display:flex;align-items:center;gap:10px;font-size:16px">Lines from Cuelinks we did not understand</h3>
      <div id="ppCbLines" class="pp-deals-list"></div>
      <h3 class="pp-cb-h" style="margin:24px 0 8px;display:flex;align-items:center;gap:10px;font-size:16px">Your own rules (they win over the synced rules)</h3>
      <form id="ppCbForm" class="pp-deals-form" onsubmit="return false">
        <input id="ppCbId" type="hidden">
        <label>Store<select id="ppCbStore"><option>Flipkart</option><option>Croma</option><option>Myntra</option><option>AJIO</option><option>Meesho</option><option>Nykaa</option><option>Nykaa Fashion</option><option>Tata CLiQ</option><option>Vijay Sales</option><option>Reliance Digital</option><option>JioMart</option><option>Purplle</option><option>Shopsy</option><option>Adidas</option></select></label>
        <label>Category<select id="ppCbCat"><option value="*">Any category (needs brand or words)</option><option value="mobiles">Mobiles</option><option value="laptops">Laptops</option><option value="electronics">Electronics</option><option value="home">Home &amp; Kitchen</option><option value="appliances">Appliances</option><option value="fashion">Fashion</option><option value="beauty">Beauty</option><option value="watches">Watches</option></select></label>
        <label>Brands (comma list, optional)<input id="ppCbBrands" maxlength="200" placeholder="e.g. Motorola, Poco"></label>
        <label>Product name has (comma list, optional)<input id="ppCbWords" maxlength="300" placeholder="e.g. iPhone 16, Galaxy S25"></label>
        <label>Commission %<input id="ppCbPct" type="number" min="0" max="50" step="0.01" placeholder="0 = no cashback"></label>
        <label>or flat ₹ per sale<input id="ppCbFlat" type="number" min="0" step="1" placeholder="optional"></label>
        <label>Max commission ₹ per sale (cap)<input id="ppCbCap" type="number" min="0" step="1" placeholder="optional"></label>
        <label class="wide">Note (optional)<input id="ppCbNote" maxlength="200" placeholder="From Cuelinks, checked 30 Oct"></label>
        <div class="full pp-deals-checks"><label><input id="ppCbActive" type="checkbox" checked> Active / show on website</label></div>
      </form>
      <div class="pp-deals-actions"><button id="ppCbSave" type="button">Save rule</button><button id="ppCbClear" type="button" class="ghost">Clear</button></div>
      <p id="ppCbMsg" class="muted" role="status"></p>
      <div class="pp-deals-guidance"><b>How a rule is picked:</b> model rows &gt; brand rows &gt; sub-category words &gt; category. Your own rules always win. 0% = no cashback for those products.</div>
      <div id="ppCbList" class="pp-deals-list"></div>
      <details class="pp-cb-synced" style="margin:14px 0"><summary>Synced Cuelinks rules (<span id="ppCbSyncedN">0</span>)</summary><div id="ppCbSynced" class="pp-deals-list"></div></details>
      <h3 class="pp-cb-h" style="margin:24px 0 8px;display:flex;align-items:center;gap:10px;font-size:16px">App links (shown on the website)</h3>
      <form id="ppAppForm" class="pp-deals-form" onsubmit="return false">
        <label class="wide">Chrome Web Store link<input id="ppAppExt" type="url" placeholder="https://chromewebstore.google.com/detail/..."></label>
        <label class="wide">Android app link<input id="ppAppAndroid" type="url" placeholder="https://play.google.com/store/apps/details?id=..."></label>
      </form>
      <div class="pp-deals-actions"><button id="ppAppSave" type="button">Save links</button></div>
      <p id="ppAppMsg" class="muted" role="status">Empty = the website shows "Coming soon".</p>
    </section>`;
    anchor.parentElement.insertBefore(wrap,anchor);
    wrap.addEventListener('click',onClick);
    wrap.addEventListener('input',e=>{const m={ppSaleColorPick:'ppSaleColor',ppSaleDarkPick:'ppSaleDark'}[e.target.id];if(m)$(m).value=e.target.value;}); /* V276 colour pickers */
    $('ppSaleSave').addEventListener('click',saveSale);
    $('ppCbSave').addEventListener('click',saveCb);$('ppCbClear').addEventListener('click',clearCb);$('ppCbSetSave').addEventListener('click',saveCbSet);$('ppCbReload').addEventListener('click',loadCb);$('ppCbNoMatchBtn').addEventListener('click',loadNoMatch);$('ppAppSave').addEventListener('click',saveApps);
    $('ppSaleReset').addEventListener('click',resetSale);
    $('ppReqRefresh').addEventListener('click',loadAll);
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(loadAll,0));
    resetSale();
    [0,900,2200].forEach(t=>setTimeout(()=>{if(document.body.dataset.adminView==='growth')loadAll()},t));
  }
  const msg=(id,t,bad)=>{const el=$(id);if(el){el.textContent=t||'';el.style.color=bad?'#a33':'#64756e'}};
  async function loadAll(){await Promise.all([loadReqs(),loadSales(),loadCb()]);}
  /* V278: cashback - synced Cuelinks rules + own rules + share setting + status + products with no match + app links */
  let cbRows=[],cbStat=null;
  const rs=v=>'₹'+Number(v).toLocaleString('en-IN',{maximumFractionDigits:2});
  const cbNeedSql=e=>missing(e)?'Run supabase-cashback-v278.sql once in Supabase, then refresh.':(e?.message||'Error');
  const ruleText=r=>[r.category==='*'?'any category':h(r.category),r.brands?`brand ${h(r.brands)}`:r.brand_rx?'brand rule':'',r.words?`name has ${h(r.words)}`:r.name_rx?'model / words rule':''].filter(Boolean).join(' · ');
  const payText=r=>Number(r.flat_amount)>0?`${rs(r.flat_amount)} flat`:Number(r.commission_pct)>0?`${Number(r.commission_pct)}%`:'no cashback';
  async function loadCb(){
    if(!ready())return;
    const [q,st,ap]=await Promise.all([api.rpc('pp_admin_list_cashback_rates'),api.rpc('pp_admin_cashback_status'),api.rpc('pp_public_settings')]);
    if(q.error){msg('ppCbMsg',cbNeedSql(q.error),true);return}
    cbRows=Array.isArray(q.data)?q.data:[];cbStat=st.error?null:st.data;
    if(st.error)msg('ppCbSetMsg',cbNeedSql(st.error),true);
    const set=cbStat&&cbStat.settings||{};
    if(set.share)$('ppCbShare').value=Math.round(Number(set.share)*100);if(set.min)$('ppCbMin').value=set.min;
    $('ppCbLast').value=set.last_sync?new Date(set.last_sync).toLocaleString('en-IN'):'Not synced yet - deploy the Edge Function cuelinks-rates';
    const apps=!ap.error&&ap.data&&ap.data.apps||{};$('ppAppExt').value=apps.extension_url||'';$('ppAppAndroid').value=apps.android_url||'';
    const ST={ok:['Cashback allowed','#137A52'],cashback_not_allowed:['Cashback NOT allowed by the store','#a33'],no_campaign:['No Cuelinks campaign found','#8a6d1f'],error:['Sync error','#a33']};
    const camps=cbStat&&Array.isArray(cbStat.campaigns)?cbStat.campaigns:[];
    $('ppCbStores').innerHTML=camps.length?camps.map(c=>{const [t,col]=ST[c.status]||[c.status,'#555'];return `<article class="pp-deals-row"><div><h3>${h(c.store)} · <span class="pp-deals-chip" style="color:${col}">${h(t)}</span>${c.campaign_id?` <span class="pp-deals-chip">Cuelinks #${h(c.campaign_id)}</span>`:''}</h3><p>${c.rules||0} rules · ${c.unmatched||0} lines not understood${c.coupons_allowed===false?' · <b>Coupons not allowed</b>':''}${c.deals_allowed===false?' · <b>Deals not allowed</b>':''}${c.validation_time?` · validation ${h(c.validation_time)}`:''}${c.payment_time?` · payment ${h(c.payment_time)}`:''}${c.error?` · ${h(c.error)}`:''}</p></div></article>`;}).join(''):'<div class="pp-deals-row"><div><h3>No sync yet</h3><p>Deploy the Edge Function <b>cuelinks-rates</b> and run it once (see README).</p></div></div>';
    const lines=cbStat&&Array.isArray(cbStat.lines)?cbStat.lines.filter(l=>l.result==='unmatched'):[];
    $('ppCbLines').innerHTML=lines.length?lines.map(l=>`<article class="pp-deals-row"><div><h3>${h(l.store)} · ${h(String(l.raw_name).slice(0,140))}</h3><p>${h(l.payout_type||'')} ${h(l.payout)} · ${h(l.detail||'')}</p></div></article>`).join(''):'<p class="muted">Nothing - every line was understood (or no sync yet).</p>';
    const own=cbRows.filter(r=>r.source!=='cuelinks'),syn=cbRows.filter(r=>r.source==='cuelinks');
    $('ppCbList').innerHTML=own.length?own.map(r=>`<article class="pp-deals-row" data-cb="${h(r.id)}"><div><h3>${h(r.store)} · ${ruleText(r)} · <span class="pp-deals-chip">${payText(r)}</span>${r.cap_amount?` <span class="pp-deals-chip">max ${rs(r.cap_amount)} / sale</span>`:''} ${r.active?'':'<span class="pp-deals-chip">OFF</span>'}</h3><p>e.g. ₹20,000 → shopper sees "Earn up to ${eg(r)}"${r.note?` · ${h(r.note)}`:''}</p></div><div class="pp-deals-row-actions"><button type="button" class="ghost" data-cb-edit>Edit</button><button type="button" class="ghost" data-cb-del>Delete</button></div></article>`).join(''):'<p class="muted">No own rules. The synced Cuelinks rules are used.</p>';
    $('ppCbSyncedN').textContent=syn.length;
    $('ppCbSynced').innerHTML=syn.map(r=>`<article class="pp-deals-row"><div><h3>${h(r.store)} · ${h(String(r.raw_name||'').slice(0,90))} · <span class="pp-deals-chip">${payText(r)}</span>${r.cap_amount?` <span class="pp-deals-chip">max ${rs(r.cap_amount)} / sale</span>`:''}</h3><p>${ruleText(r)} · priority ${r.priority}</p></div></article>`).join('');
  }
  function eg(r){const sh=(Number($('ppCbShare').value)||40)/100;let c=Number(r.flat_amount)>0?Number(r.flat_amount):20000*Number(r.commission_pct)/100;if(Number(r.cap_amount)>0)c=Math.min(c,Number(r.cap_amount));const a=Math.floor(c*sh);return a>=5?'₹'+a.toLocaleString('en-IN'):'no cashback';}
  async function loadNoMatch(){
    if(!ready())return;const box=$('ppCbNoMatch');box.innerHTML='<p class="muted">Checking…</p>';
    const q=await api.rpc('pp_admin_cashback_no_match');
    if(q.error){box.innerHTML=`<p class="muted" style="color:#a33">${h(cbNeedSql(q.error))}</p>`;return}
    const l=Array.isArray(q.data)?q.data:[];
    box.innerHTML=l.length?l.map(x=>`<article class="pp-deals-row"><div><h3>${h(x.name)} · ${h(x.store)}</h3><p>${h(x.brand||'')} · ${h(x.category||'')} · ${h(x.why||'')}</p></div><div class="pp-deals-row-actions"><button type="button" class="ghost" data-cb-fix="${h(x.store)}|${h(x.category||'*')}|${h(x.brand||'')}">Add rule</button></div></article>`).join(''):'<p class="muted">Every product on a cashback store has a rule.</p>';
  }
  async function saveCbSet(){
    if(!ready())return;const sh=Number($('ppCbShare').value),mn=Number($('ppCbMin').value);
    if(!(sh>=1&&sh<=90)){msg('ppCbSetMsg','Share must be 1-90 %.',true);return}
    const q=await api.rpc('pp_admin_save_cashback_settings',{p_share:sh/100,p_min:Math.round(mn)||5,p_campaigns:null});
    if(q.error){msg('ppCbSetMsg',cbNeedSql(q.error),true);return}
    msg('ppCbSetMsg',`Saved. Shoppers now see ${sh}% of our commission (on the next page load).`);await loadCb();
  }
  function clearCb(){['ppCbId','ppCbBrands','ppCbWords','ppCbPct','ppCbFlat','ppCbCap','ppCbNote'].forEach(i=>$(i).value='');$('ppCbCat').value='*';$('ppCbActive').checked=true;msg('ppCbMsg','');}
  async function saveCb(){
    if(!ready()){msg('ppCbMsg','Admin database access required.',true);return}
    const store=$('ppCbStore').value,cat=$('ppCbCat').value||'*',brands=clean($('ppCbBrands').value),words=clean($('ppCbWords').value);
    const pct=Number($('ppCbPct').value||0),flat=Number($('ppCbFlat').value||0),cap=Number($('ppCbCap').value||0);
    if(/^amazon/i.test(store)){msg('ppCbMsg','Amazon cannot have cashback (Associates rules).',true);return}
    if(cat==='*'&&!brands&&!words){msg('ppCbMsg','Pick a category, or type brands / product words. A store-wide rate is not allowed.',true);return}
    if(!(pct>=0&&pct<=50)){msg('ppCbMsg','Commission must be 0-50 %.',true);return}
    const btn=$('ppCbSave');btn.disabled=true;
    const q=await api.rpc('pp_admin_save_cashback_rate',{p_id:$('ppCbId').value||null,p_store:store,p_category:cat,p_brands:brands,p_words:words,p_pct:pct,p_flat:flat||null,p_cap:cap||null,p_active:$('ppCbActive').checked,p_note:clean($('ppCbNote').value)||null});
    btn.disabled=false;
    if(q.error){msg('ppCbMsg',cbNeedSql(q.error),true);return}
    clearCb();await loadCb();msg('ppCbMsg','Rule saved. The website uses it on the next page load.');
  }
  async function saveApps(){
    if(!ready())return;const ext=clean($('ppAppExt').value),and=clean($('ppAppAndroid').value);
    if((ext&&!/^https:\/\//i.test(ext))||(and&&!/^https:\/\//i.test(and))){msg('ppAppMsg','Links must start with https://',true);return}
    const q=await api.rpc('pp_admin_save_setting',{set_key:'apps',set_value:{extension_url:ext,android_url:and},set_public:true});
    if(q.error){msg('ppAppMsg',q.error.message,true);return}
    msg('ppAppMsg','Saved. Empty = "Coming soon" on the website.');
  }
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
  function resetSale(){['ppSaleId','ppSaleTitle','ppSaleNote','ppSaleStart','ppSaleEnd','ppSaleLink','ppSaleColor','ppSaleDark','ppSaleBanner'].forEach(id=>{const el=$(id);if(el)el.value='';});$('ppSaleStore').value='';$('ppSaleActive').checked=false;msg('ppSaleMsg','')}
  async function saveSale(){
    if(!ready()){msg('ppSaleMsg','Admin database access required.',true);return}
    const title=clean($('ppSaleTitle').value),st=toIso($('ppSaleStart').value),en=toIso($('ppSaleEnd').value);
    if(title.length<3||!st||!en){msg('ppSaleMsg','Sale name, start and end are required.',true);return}
    if(Date.parse(en)<=Date.parse(st)){msg('ppSaleMsg','End must be after start.',true);return}
    const btn=$('ppSaleSave');btn.disabled=true;
    const hex=v=>{v=clean(v).toLowerCase();return /^#[0-9a-f]{6}$/.test(v)?v:null;};
    const link=clean($('ppSaleLink')?.value||''),banner=clean($('ppSaleBanner')?.value||'');
    if(link&&!/^https:\/\//i.test(link)){btn.disabled=false;msg('ppSaleMsg','Sale link must start with https://',true);return}
    if(banner&&!/^https:\/\//i.test(banner)){btn.disabled=false;msg('ppSaleMsg','Banner URL must start with https://',true);return}
    const base={ev_id:clean($('ppSaleId').value)||null,ev_title:title,ev_store:$('ppSaleStore').value||null,ev_starts_at:st,ev_ends_at:en,ev_note:clean($('ppSaleNote').value)||null,ev_active:$('ppSaleActive').checked};
    let q=await api.rpc('pp_admin_upsert_sale_event_v276',{...base,ev_link:link||null,ev_theme_color:hex($('ppSaleColor')?.value||''),ev_theme_dark:hex($('ppSaleDark')?.value||''),ev_banner_url:banner||null});
    if(q.error&&missing(q.error)){q=await api.rpc('pp_admin_upsert_sale_event',base);if(!q.error){btn.disabled=false;resetSale();await loadSales();msg('ppSaleMsg','Saved without link/colours: run supabase-sales-v276.sql once in Supabase to save them too.',true);return}}
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
    const fix=e.target.closest('[data-cb-fix]');
    if(fix){const [st,cat,br]=fix.dataset.cbFix.split('|');clearCb();$('ppCbStore').value=st;$('ppCbCat').value=cat||'*';$('ppCbBrands').value=br||'';$('ppCbPct').focus();$('ppCbForm').scrollIntoView({block:'center'});return}
    const crow=e.target.closest('[data-cb]');
    if(crow){
      const r=cbRows.find(x=>x.id===crow.dataset.cb);if(!r)return;
      if(e.target.closest('[data-cb-edit]')){$('ppCbId').value=r.id;$('ppCbStore').value=r.store;$('ppCbCat').value=r.category||'*';$('ppCbBrands').value=r.brands||'';$('ppCbWords').value=r.words||'';$('ppCbPct').value=r.commission_pct;$('ppCbFlat').value=r.flat_amount||'';$('ppCbCap').value=r.cap_amount||'';$('ppCbNote').value=r.note||'';$('ppCbActive').checked=!!r.active;$('ppCbPct').focus();return}
      if(e.target.closest('[data-cb-del]')){if(!confirm(`Delete this ${r.store} rule?`))return;const q=await api.rpc('pp_admin_delete_cashback_rate',{p_id:r.id});if(q.error){msg('ppCbMsg',q.error.message,true);return}await loadCb();}
      return;
    }
    const srow=e.target.closest('[data-sale]');
    if(srow){
      const ev=events.find(x=>x.id===srow.dataset.sale);if(!ev)return;
      if(e.target.closest('[data-sale-edit]')){$('ppSaleId').value=ev.id;$('ppSaleTitle').value=ev.title||'';$('ppSaleStore').value=ev.store||'';$('ppSaleStart').value=toLocal(ev.starts_at);$('ppSaleEnd').value=toLocal(ev.ends_at);$('ppSaleNote').value=ev.note||'';$('ppSaleActive').checked=!!ev.active;if($('ppSaleLink'))$('ppSaleLink').value=ev.link||'';if($('ppSaleColor'))$('ppSaleColor').value=ev.theme_color||'';if($('ppSaleDark'))$('ppSaleDark').value=ev.theme_dark||'';if($('ppSaleBanner'))$('ppSaleBanner').value=ev.banner_url||'';$('ppSaleTitle').focus();return}
      if(e.target.closest('[data-sale-del]')){if(!confirm(`Delete “${ev.title}”?`))return;const q=await api.rpc('pp_admin_delete_sale_event',{ev_id:ev.id});if(q.error){msg('ppSaleMsg',q.error.message,true);return}await loadSales();}
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
