/* PricePulse V212 — Admin: Affiliate links, Clicks, What to verify next, Add-as-product.
   Needs supabase-links-clicks-v212.sql installed once. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof api!=='undefined'&&api&&typeof permitted!=='undefined'&&permitted;
  const missing=e=>/does not exist|schema cache|Could not find/i.test(e?.message||'');
  const DEF={amazon_tag:'pricepulsein-21',cuelinks_enabled:false,cuelinks_cid:'',cuelinks_stores:['Tata CLiQ','Nykaa','Nykaa Fashion','Vijay Sales'],cuelinks_format:'https://linksredirect.com/?cid={cid}&source=linkkit&url={url}'};
  let days=7,demand=[];
  const CUE_STORES=['Tata CLiQ','Nykaa','Nykaa Fashion','Vijay Sales','Croma','Myntra','AJIO','Meesho','Flipkart','JioMart','Reliance Digital','Purplle'];
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
        <div class="full"><b style="font-size:13px">Stores that use Cuelinks</b><div id="ppAffStores" class="pp-deals-checks" style="flex-wrap:wrap;gap:8px 16px;margin-top:6px">${CUE_STORES.map(n=>`<label><input type="checkbox" data-cue-store="${h(n)}"> ${h(n)}</label>`).join('')}</div></div>
      </form>
      <div class="pp-deals-actions"><button id="ppAffSave" type="button">Save affiliate settings</button></div>
      <p id="ppAffMsg" class="muted" role="status"></p>
      <div class="pp-deals-guidance"><b>Rules:</b> links open only on the shopper's click (no auto-redirect, no hidden cookies). Tick a store only when its Cuelinks campaign is <b>Active</b> with <b>Deeplink: Yes</b>. If Cuelinks shows a campaign as <b>Paused</b>, untick it. That store's links then open normally (no commission, the price still shows). Amazon always uses the tracking ID above. EarnKaro links are never changed. <code>{cid}</code> and <code>{url}</code> are filled in automatically.</div>
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
    /* "Add as product" on track requests */
    $('ppReqList')?.addEventListener('click',e=>{const b=e.target.closest('[data-req-add]');if(b)addAsProduct(b.closest('[data-req]'));},true);
    const list=$('ppReqList');
    if(list)new MutationObserver(()=>decorateRequests()).observe(list,{childList:true});
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(loadAll,0));
    [0,900,2200].forEach(t=>setTimeout(()=>{if(document.body.dataset.adminView==='growth')loadAll()},t));
    return true;
  }
  function loadAll(){loadClicks();loadDemand();loadAff();}
  async function loadAff(){
    let v={...DEF};
    if(ready()){const q=await api.from('pp_site_settings').select('value').eq('key','affiliate').maybeSingle().then(r=>r,e=>({error:e}));
      if(!q.error&&q.data?.value)v={...DEF,...q.data.value};
      else{const p=await api.rpc('pp_public_settings');if(!p.error&&p.data?.affiliate)v={...DEF,...p.data.affiliate};else if(p.error&&missing(p.error))msg('ppAffMsg','Run supabase-links-clicks-v212.sql once in Supabase.',true);}}
    $('ppAffTag').value=v.amazon_tag||'';$('ppAffCid').value=v.cuelinks_cid||'';$('ppAffFmt').value=v.cuelinks_format||DEF.cuelinks_format;$('ppAffCue').checked=!!v.cuelinks_enabled;
    const on=new Set(Array.isArray(v.cuelinks_stores)?v.cuelinks_stores:DEF.cuelinks_stores);document.querySelectorAll('[data-cue-store]').forEach(c=>c.checked=on.has(c.dataset.cueStore));
  }
  async function saveAff(){
    if(!ready()){msg('ppAffMsg','Admin database access required.',true);return}
    const tag=$('ppAffTag').value.trim().toLowerCase();
    if(tag&&!/^[a-z0-9-]+-21$/.test(tag)){msg('ppAffMsg','Amazon India tracking IDs end with -21 (e.g. pricepulsein-21).',true);return}
    const fmt=$('ppAffFmt').value.trim();
    if($('ppAffCue').checked&&(!$('ppAffCid').value.trim()||!fmt.includes('{url}'))){msg('ppAffMsg','To switch Cuelinks ON, add the Channel ID and a link format containing {url}.',true);return}
    const value={amazon_tag:tag,cuelinks_enabled:$('ppAffCue').checked,cuelinks_cid:$('ppAffCid').value.trim(),cuelinks_stores:[...document.querySelectorAll('[data-cue-store]:checked')].map(c=>c.dataset.cueStore),cuelinks_format:fmt||DEF.cuelinks_format};
    const q=await api.rpc('pp_admin_save_setting',{set_key:'affiliate',set_value:value,set_public:true});
    if(q.error){msg('ppAffMsg',missing(q.error)?'Run supabase-links-clicks-v212.sql once in Supabase first.':q.error.message,true);return}
    msg('ppAffMsg','Saved. The website uses the new settings on the next page load.');
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
  function boot(){if(!install())setTimeout(boot,300);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
