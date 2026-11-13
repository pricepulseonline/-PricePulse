/* PricePulse V212 — Admin: Affiliate links, Clicks, What to verify next, Add-as-product.
   Needs supabase-links-clicks-v212.sql installed once. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof api!=='undefined'&&api&&typeof permitted!=='undefined'&&permitted;
  const missing=e=>/does not exist|schema cache|Could not find/i.test(e?.message||'');
  const DEF={amazon_tag:'pricepulsein-21',cuelinks_enabled:false,cuelinks_cid:'',cuelinks_stores:['Tata CLiQ','Nykaa','Nykaa Fashion','Vijay Sales'],cuelinks_format:'https://linksredirect.com/?cid={cid}&source=linkkit&url={url}'};
  let days=7,demand=[];
  const CUE_STORES=['Tata CLiQ','Nykaa','Nykaa Fashion','Vijay Sales','Croma','Myntra','AJIO','Meesho','Flipkart','JioMart','Reliance Digital','Purplle','Shopsy','Snapdeal','Adidas','Samsung','BigBasket','Dell','Nike','Lenovo','HP','IKEA'];
  const msg=(id,t,bad)=>{const el=$(id);if(el){el.textContent=t||'';el.style.color=bad?'#a33':'#64756e'}};

  function install(){
    const host=$('ppGrowthAdmin');if(!host||$('ppLinksAdmin'))return false;
    const wrap=document.createElement('div');wrap.id='ppLinksAdmin';
    wrap.innerHTML=`
    <section class="pp-deals-admin-card pp-growth-card">
      <div class="pp-deals-admin-head"><div><h2>Clicks to stores</h2><p class="muted">Every "Buy / View deal" click on the website (no personal data). See which stores shoppers go to.</p></div><span class="pp-deals-admin-badge">↗ TRAFFIC</span></div>
      <div class="pp-growth-tabs"><button type="button" data-days="1">Today</button><button type="button" data-days="7" class="is-on">7 days</button><button type="button" data-days="30">30 days</button><button type="button" class="subtle" id="ppClkRefresh">Refresh</button></div>
      <div class="pp-deals-readiness"><div><b id="ppClkTotal">–</b><small>Clicks</small></div><div><b id="ppClkToday">–</b><small>Today</small></div><div><b id="ppClkAff">–</b><small>With affiliate</small></div><div><b id="ppClkTop">–</b><small>Top store</small></div></div>
      <p id="ppClkMsg" class="muted" role="status"></p>
      <div id="ppClkBars" class="pp-clk-bars"></div>
    </section>
    <section class="pp-deals-admin-card pp-growth-card">
      <div class="pp-deals-admin-head"><div><h2>What to verify next</h2><p class="muted">Products shoppers actually look at (clicks in 7 days, wishlists, active alerts), with how many stores are fresh. Verify the top rows first.</p></div><span class="pp-deals-admin-badge">✓ PRIORITY</span></div>
      <div class="pp-growth-tabs" id="ppDemTabs"></div>
      <p id="ppDemMsg" class="muted" role="status"></p>
      <div id="ppDemList" class="pp-deals-list"></div>
    </section>
    <section class="pp-deals-admin-card pp-growth-card">
      <div class="pp-deals-admin-head"><div><h2>Affiliate links</h2><p class="muted">Applied to every Buy link only when the shopper clicks. Links that are already affiliate (EarnKaro, link.amazon, fktr.in, tag=) are never changed.</p></div><span class="pp-deals-admin-badge">₹ EARN</span></div>
      <form id="ppAffForm" class="pp-deals-form">
        <label>Amazon tracking ID<input id="ppAffTag" placeholder="pricepulsein-21" pattern="[a-z0-9-]+-21"></label>
        <label>Cuelinks Channel ID (cid)<input id="ppAffCid" placeholder="Cuelinks → Installation → cId (e.g. 322788)"></label>
        <label class="wide">Cuelinks link format<input id="ppAffFmt"></label>
        <div class="full pp-deals-checks"><label><input id="ppAffCue" type="checkbox"> Cuelinks ON</label></div>
        <div class="full"><b style="font-size:13px">Cuelinks per store</b>
          <p class="muted" style="margin:4px 0 8px"><b>Auto</b> = affiliate only while Cuelinks says the campaign is approved (checked every morning). <b>ON</b> / <b>OFF</b> = you decide, whatever Cuelinks says. Works for the website and the Chrome extension.</p>
          <div id="ppAffStores" style="display:grid;gap:6px"></div>
          <div class="pp-deals-actions" style="margin-top:8px"><button type="button" id="ppAffSync" class="subtle">Sync with Cuelinks now</button><button type="button" id="ppAffAllAuto" class="subtle" style="margin-left:8px">Set all stores to Auto</button><span id="ppAffSyncMsg" class="muted" style="margin-left:10px"></span></div>
        </div>
      </form>
      <div class="pp-deals-actions"><button id="ppAffSave" type="button">Save affiliate settings</button></div>
      <p id="ppAffMsg" class="muted" role="status"></p>
      <div class="pp-deals-guidance"><b>Rules:</b> links open only on the shopper's click (no auto-redirect, no hidden cookies). Tick a store only when its Cuelinks campaign is <b>Active</b> with <b>Deeplink: Yes</b>. If Cuelinks shows a campaign as <b>Paused</b>, untick it. That store's links then open normally (no commission, the price still shows). Amazon always uses the tracking ID above. <code>{cid}</code> and <code>{url}</code> are filled in automatically.</div>
    </section>`;
    host.prepend(wrap);
    wrap.addEventListener('click',e=>{
      const d=e.target.closest('[data-days]');if(d){days=+d.dataset.days;wrap.querySelectorAll('[data-days]').forEach(b=>b.classList.toggle('is-on',b===d));loadClicks();return}
      const t=e.target.closest('[data-dem-tab]');if(t){demTab=t.dataset.demTab;renderDemand();return}
      if(e.target.closest('[data-dem-refresh]')){loadDemand();return}
      const v=e.target.closest('[data-verify]');if(v){verify(v.dataset.verify);}
    });
    $('ppClkRefresh').addEventListener('click',loadClicks);
    $('ppAffSave').addEventListener('click',saveAff);
    $('ppAffSync').addEventListener('click',syncNow);
    $('ppAffAllAuto').addEventListener('click',e=>{
      const box=e.currentTarget.closest('section')||document;
      const rows=[...box.querySelectorAll('[data-aff-row]')];let aff=0;
      rows.forEach(r=>{const sel=r.querySelector('[data-aff-mode]'),eff=r.querySelector('[data-aff-eff]'),ok=r.dataset.ok==='1';if(sel)sel.value='auto';affModes[r.dataset.affRow]='auto';if(ok)aff++;
        if(eff){eff.textContent=ok?'Affiliate link (approved)':'Plain link (not approved)';eff.style.color=ok?'#137A52':'#8a6d1f';}});
      affDirty=true;msg('ppAffMsg','All '+rows.length+' stores set to Auto: '+aff+' will use affiliate links (Cuelinks approved), '+(rows.length-aff)+' stay plain. Set any store to OFF if you want it plain, then press Save.');
    });
    $('ppAffStores').addEventListener('change',e=>{const sel=e.target.closest('[data-aff-mode]');if(!sel)return;affModes[sel.dataset.affMode]=sel.value;affDirty=true;const row=sel.closest('[data-aff-row]'),eff=row&&row.querySelector('[data-aff-eff]');if(eff){const [t,c]=effText(sel.value,sel.dataset.affMode);eff.textContent=t;eff.style.color=c;}});
    /* "Add as product" on track requests */
    $('ppReqList')?.addEventListener('click',e=>{const b=e.target.closest('[data-req-add]');if(b)addAsProduct(b.closest('[data-req]'));},true);
    const list=$('ppReqList');
    if(list)new MutationObserver(()=>decorateRequests()).observe(list,{childList:true});
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(loadAll,0));
    [0,900,2200].forEach(t=>setTimeout(()=>{if(document.body.dataset.adminView==='growth')loadAll()},t));
    return true;
  }
  function loadAll(){loadClicks();loadDemand();loadAff();}
  let affAuto=[];
  const nm=x=>String(x||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
  const autoOf=n=>affAuto.find(x=>nm(x.store)===nm(n));
  const effText=(mode,n)=>{const e=autoOf(n);if(mode==='on')return['Affiliate link','#137A52'];if(mode==='off')return['Plain link','#8a6d1f'];return e&&e.link_allowed?['Affiliate link (approved)','#137A52']:['Plain link (not approved)','#8a6d1f'];};
  const cueChip=n=>{const e=autoOf(n);if(!e||!e.synced_at)return['not synced yet','#6B7D75'];return[String(e.status||'no_campaign').replace(/_/g,' '),e.link_allowed?'#137A52':'#a33'];};
  let affModes={}; /* V2.1: the choices live here (not only in the select boxes), so nothing can reset them by accident */
  function drawStores(modes){
    affModes={...modes};
    const names=affAuto.length?affAuto.map(x=>x.store):CUE_STORES;
    const html=names.map(n=>{const m=modes[n]||'auto',[c,cc]=cueChip(n),[t,tc]=effText(m,n);
      return `<div data-aff-row="${h(n)}" data-ok="${autoOf(n)?.link_allowed?1:0}" style="display:grid;grid-template-columns:minmax(120px,1.2fr) 1fr 90px 1.3fr;gap:8px;align-items:center;font-size:13px;padding:4px 0;border-bottom:1px solid #EAF0EC"><b>${h(n)}</b><span style="color:${cc}">Cuelinks: ${h(c)}</span><select data-aff-mode="${h(n)}"><option value="auto"${m==='auto'?' selected':''}>Auto</option><option value="on"${m==='on'?' selected':''}>ON</option><option value="off"${m==='off'?' selected':''}>OFF</option></select><span data-aff-eff style="color:${tc};font-weight:700">${h(t)}</span></div>`;}).join('');
    document.querySelectorAll('[id="ppAffStores"]').forEach(el=>{el.innerHTML=html;});
    const last=affAuto.map(x=>x.synced_at).filter(Boolean).sort().pop();
    if($('ppAffSyncMsg')&&last)$('ppAffSyncMsg').textContent='Last sync: '+new Date(last).toLocaleString('en-IN');
  }
  let affDirty=false; /* V2.1: unsaved changes on screen: a reload of this card (tab click etc.) must not throw them away */
  async function loadAff(keep){
    if(affDirty)keep=true; /* keep = true: refresh Cuelinks status only, keep the choices on screen (not saved yet) */
    const cur=keep?readModes():null;
    let v={...DEF};
    if(ready()){const q=await api.from('pp_site_settings').select('value').eq('key','affiliate').maybeSingle().then(r=>r,e=>({error:e}));
      if(!q.error&&q.data?.value)v={...DEF,...q.data.value};
      else{const p=await api.rpc('pp_public_settings');if(!p.error&&p.data?.affiliate)v={...DEF,...p.data.affiliate};else if(p.error&&missing(p.error))msg('ppAffMsg','Run supabase-links-clicks-v212.sql once in Supabase.',true);}
      const a=await api.rpc('pp_affiliate_auto').then(r=>r,e=>({error:e}));
      if(!a.error&&Array.isArray(a.data))affAuto=a.data;else if(a.error&&missing(a.error))msg('ppAffMsg','Run supabase-affiliate-auto-v1.sql once in Supabase to switch Auto on.',true);}
    $('ppAffTag').value=v.amazon_tag||'';$('ppAffCid').value=v.cuelinks_cid||'';$('ppAffFmt').value=v.cuelinks_format||DEF.cuelinks_format;$('ppAffCue').checked=!!v.cuelinks_enabled;
    const names=affAuto.length?affAuto.map(x=>x.store):CUE_STORES,modes={};
    if(Number(v.mode_v)>=2&&v.store_mode&&typeof v.store_mode==='object')names.forEach(n=>{const k=Object.keys(v.store_mode).find(x=>nm(x)===nm(n));modes[n]=k?v.store_mode[k]:'auto';});
    else{const on=Array.isArray(v.cuelinks_stores)?new Set(v.cuelinks_stores.map(nm)):null;names.forEach(n=>{modes[n]=on&&!on.has(nm(n))?'off':'auto';});} /* old tick list: unticked = OFF, ticked = Auto (saved only when you press Save) */
    if(cur&&Object.keys(cur).length)names.forEach(n=>{if(cur[n])modes[n]=cur[n];});
    drawStores(modes);
  }
  function readModes(){const m={...affModes};const box=$('ppAffSave')?.closest('section')||document;box.querySelectorAll('[data-aff-mode]').forEach(s=>{m[s.dataset.affMode]=s.value;});return m;}
  async function saveAff(){
    if(!ready()){msg('ppAffMsg','Admin database access required.',true);return}
    const tag=$('ppAffTag').value.trim().toLowerCase();
    if(tag&&!/^[a-z0-9-]+-21$/.test(tag)){msg('ppAffMsg','Amazon India tracking IDs end with -21 (e.g. pricepulsein-21).',true);return}
    const fmt=$('ppAffFmt').value.trim();
    if($('ppAffCue').checked&&(!$('ppAffCid').value.trim()||!fmt.includes('{url}'))){msg('ppAffMsg','To switch Cuelinks ON, add the Channel ID and a link format containing {url}.',true);return}
    const modes=readModes(),store_mode={};
    Object.keys(modes).forEach(n=>{if(modes[n]==='on'||modes[n]==='off')store_mode[n]=modes[n];});
    const eff=Object.keys(modes).filter(n=>modes[n]==='on'||(modes[n]==='auto'&&autoOf(n)?.link_allowed)); /* list kept for older extension builds */
    const value={amazon_tag:tag,cuelinks_enabled:$('ppAffCue').checked,cuelinks_cid:$('ppAffCid').value.trim(),mode_v:2,store_mode,cuelinks_stores:eff,cuelinks_format:fmt||DEF.cuelinks_format};
    const q=await api.rpc('pp_admin_save_setting',{set_key:'affiliate',set_value:value,set_public:true});
    if(q.error){msg('ppAffMsg',missing(q.error)?'Run supabase-links-clicks-v212.sql once in Supabase first.':q.error.message,true);return}
    affDirty=false;
    msg('ppAffMsg','Saved. The website uses it on the next page load; the extension within 5 minutes.');
  }
  async function syncNow(){
    if(!ready()){msg('ppAffSyncMsg','Admin database access required.',true);return}
    msg('ppAffSyncMsg','Asking Cuelinks…');
    try{
      const ses=await api.auth.getSession();const tok=ses?.data?.session?.access_token;
      const base=typeof SUPABASE_URL!=='undefined'?SUPABASE_URL:api.supabaseUrl,key=typeof SUPABASE_KEY!=='undefined'?SUPABASE_KEY:api.supabaseKey;
      const r=await fetch(base+'/functions/v1/cuelinks-rates?force=1',{headers:{Authorization:'Bearer '+(tok||key),apikey:key}});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j.ok===false){msg('ppAffSyncMsg',(j&&j.error)||('Sync failed ('+r.status+'). Deploy the Edge Function cuelinks-rates and set CUELINKS_V3_KEY.'),true);return}
      if(j.skipped){msg('ppAffSyncMsg','Synced less than 10 minutes ago. Showing that result.');}
      await loadAff(true);
      if(!j.skipped)msg('ppAffSyncMsg','Synced just now.');
    }catch(e){msg('ppAffSyncMsg','Sync failed: '+(e&&e.message||e),true);}
  }
  async function loadClicks(){
    if(!ready()){msg('ppClkMsg','Sign in with an admin account to see clicks.');return}
    const q=await api.rpc('pp_admin_click_stats',{stat_days:days});
    if(q.error){msg('ppClkMsg',missing(q.error)?'Run supabase-links-clicks-v212.sql once in Supabase, then refresh.':q.error.message,true);return}
    const d=q.data||{};
    $('ppClkTotal').textContent=Number(d.total||0).toLocaleString('en-IN');
    $('ppClkToday').textContent=Number(d.today||0).toLocaleString('en-IN');
    $('ppClkAff').textContent=d.total?`${Math.round((d.affiliate||0)*100/d.total)}%`:'0%';
    $('ppClkTop').textContent=d.by_store?.[0]?.store||'None yet';
    const stores=d.by_store||[],max=Math.max(1,...stores.map(s=>s.clicks));
    $('ppClkBars').innerHTML=stores.length?stores.map(s=>`<div class="pp-clk-row"><span>${h(s.store)}</span><i><b style="width:${(s.clicks*100/max).toFixed(1)}%"></b></i><em>${h(s.clicks)}</em></div>`).join('')+(d.by_source?.length?`<p class="muted" style="margin-top:8px">From: ${d.by_source.map(x=>`${h(x.source)} ${h(x.clicks)}`).join(' · ')}</p>`:''):(Number(d.total||0)===0?'<p class="pp-clk-empty">No clicks yet. Once the site is live, every Buy / View deal click shows here.</p>':'<p class="muted">No clicks yet in this period.</p>');
    msg('ppClkMsg',`Last ${d.days||days} day${(d.days||days)===1?'':'s'}`);
  }
  let demTab='due';
  async function loadDemand(){
    if(!ready())return;
    const q=await api.rpc('pp_admin_product_demand');
    if(q.error){msg('ppDemMsg',missing(q.error)?'Run supabase-links-clicks-v212.sql once in Supabase, then refresh.':q.error.message,true);return}
    const dem=new Map((q.data||[]).map(r=>[r.product_id,r]));
    const allRows=typeof rows!=='undefined'?rows:[];
    demand=(typeof products!=='undefined'?products:[]).filter(p=>p.status!=='archived').map(p=>{
      const d=dem.get(p.id)||{clicks_7d:0,wishlists:0,active_alerts:0};
      const stores=(p.stores||[]).filter(s=>s.active!==false&&s.listingStatus!=='not_listed').length;
      const mine=allRows.filter(r=>r.product_id===p.id);
      const fresh=typeof isFresh==='function'?new Set(mine.filter(r=>isFresh(r)).map(r=>r.retailer)).size:0;
      const group=!mine.length?'new':(stores&&fresh>=stores?'ready':'due');
      const score=Number(d.clicks_7d)*3+Number(d.wishlists)*2+Number(d.active_alerts)*4+(stores-fresh)*0.5;
      return {p,d,stores,fresh,group,score};
    }).sort((a,b)=>b.score-a.score||a.fresh-b.fresh);
    renderDemand();
  }
  function renderDemand(){
    const groups={new:[],due:[],ready:[]};demand.forEach(x=>groups[x.group].push(x));
    const tabs=$('ppDemTabs');
    if(tabs)tabs.innerHTML=[['new','New','never checked'],['due','Due','price expired'],['ready','Ready ✓','all stores fresh']].map(([k,l,t])=>`<button type="button" data-dem-tab="${k}" class="${demTab===k?'is-on':''}" title="${t}">${l} <b class="pp-dem-n">${groups[k].length}</b></button>`).join('')+'<button type="button" class="subtle" data-dem-refresh>Refresh</button>';
    const list=groups[demTab]||[];
    const hint={new:'Products whose price was never checked. Add retailer prices first.',due:'Products with expired prices. Re-check them so Best Price shows again.',ready:'All stores fresh. Nothing to do now.'}[demTab];
    $('ppDemList').innerHTML=list.length?list.map((x,i)=>`<article class="pp-deals-row pp-dem-row"><div><h3>${demTab==='ready'?'':`${i+1}. `}${h(x.p.name)}</h3><p>${h(x.d.clicks_7d)} clicks · ${h(x.d.wishlists)} wishlists · ${h(x.d.active_alerts)} alerts</p><div class="meta"><span class="pp-deals-chip ${x.group==='ready'?'':'off'}">${x.fresh}/${x.stores} stores fresh</span></div></div><div class="pp-deals-row-actions">${x.group==='ready'?'<span class="pp-dem-fresh">✓ Fresh</span>':`<button type="button" data-verify="${h(x.p.id)}">Verify now</button>`}</div></article>`).join(''):`<div class="pp-deals-row"><div><h3>${demTab==='ready'?'No product is fully fresh yet':'Nothing here'}</h3><p>${demTab==='ready'?'Verify products in New and Due to fill this list.':'Good, nothing waiting in this list.'}</p></div></div>`;
    msg('ppDemMsg',hint);
  }
  function verify(id){
    document.querySelector('.admin-nav-btn[data-admin-view="catalog"]')?.click();
    setTimeout(()=>{if(typeof selectProduct==='function')selectProduct(id);},120);
  }
  function decorateRequests(){
    document.querySelectorAll('#ppReqList [data-req]').forEach(row=>{
      if(row.querySelector('[data-req-add]'))return;
      const act=row.querySelector('.pp-deals-row-actions');if(!act)return;
      const b=document.createElement('button');b.type='button';b.className='subtle';b.dataset.reqAdd='1';b.textContent='Add as product';
      act.prepend(b);
    });
  }
  function nameFromUrl(u){
    try{const x=new URL(u);if(/#search=/.test(x.hash))return decodeURIComponent(x.hash.replace(/^#search=/,''));const path=decodeURIComponent(x.pathname).replace(/\/(dp|p|gp|product|buy)\/.*$/i,'');
      return path.split(/[\/\-_+]+/).map(w=>w.replace(/[^\p{L}\p{N}.]/gu,'')).filter(w=>w.length>1&&!/^(dp|ref|s|p)$/i.test(w)).slice(0,8).join(' ');}catch(_){return ''}
  }
  function addAsProduct(row){
    const a=row?.querySelector('a[href]');const url=a?.getAttribute('href')||'';
    if(typeof newProduct!=='function'){alert('Open Catalog & Prices → + Add Product. Link: '+url);return}
    document.querySelector('.admin-nav-btn[data-admin-view="catalog"]')?.click();
    setTimeout(()=>{
      newProduct();
      const f=document.getElementById('productForm');if(!f)return;
      const nm=nameFromUrl(url);if(nm&&f.elements.name){f.elements.name.value=nm;f.elements.name.dispatchEvent(new Event('input',{bubbles:true}));}
      if(f.elements.status)f.elements.status.value='tracking';
      const m=document.getElementById('productMsg');if(m)m.innerHTML=`From track request. After saving, use <b>+ Add Retailer Link</b> with: <a href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(url.slice(0,80))}${url.length>80?'…':''}</a>. Then go back to Requests and press <b>Mark added</b> with the new product ID.`;
    },150);
  }
  function boot(){if($('ppLinksAdmin'))return;if(!install())setTimeout(boot,300);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
