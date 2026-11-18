/* PricePulse V250 — Admin: browser extension tools (needs supabase-ext-v2.sql).
   1) "Extension: Admin mode"  : create / remove the key you paste into the extension popup. With it, your
      extension saves the price it reads on an exact, checked listing as a verified price (fresh 24 hours).
   2) "Extension: price checks": Due for check (no fresh verified price) and Price changed (a shopper's
      extension saw another price after your last check). Open → the extension in Admin mode saves it.
   3) "Extension: stores"      : which stores the extension reads, their product-code pattern and optional
      price / MRP / title selectors. A store's website must be in the extension's list (EXT_SITES) to work. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof api!=='undefined'&&api&&typeof permitted!=='undefined'&&permitted;
  // Same list as manifest.json of extension V1.3.0 (5-store-sites.txt). Update both together.
  const EXT_SITES=['amazon.in','flipkart.com','shopsy.in','croma.com','reliancedigital.in','vijaysales.com','tatacliq.com','myntra.com','ajio.com','nykaa.com','nykaafashion.com','purplle.com','jiomart.com','meesho.com','adidas.co.in','bigbasket.com','pepperfry.com','firstcry.com','lenskart.com','decathlon.in','boat-lifestyle.com','oneplus.in','mi.com','samsung.com','puma.com'];
  const BUILTIN={amazon:'Built in (ASIN)',flipkart:'Built in (pid)'};
  const extReady=d=>{if(window.PP_EXT_ALL_SITES!==false)return !!String(d||'').trim();d=String(d||'').toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0];return !!d&&EXT_SITES.some(s=>d===s||d.endsWith('.'+s));};
  const when=t=>{if(!t)return 'never';const d=new Date(t);return d.toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});};
  const inr=v=>v==null?'–':'₹'+Math.round(Number(v)).toLocaleString('en-IN');
  const setMsg=(id,t,bad)=>{const el=$(id);if(el){el.textContent=t||'';el.style.color=bad?'#a33':'#64756e';}};
  const sqlMissing=e=>e&&(/function .* does not exist|Could not find the function|pp_ext_store_rules/i.test(e.message||'')||['PGRST202','42883','42P01','PGRST205'].includes(e.code));
  const NEED_SQL='Run the extension SQL files (v2, v3, v4 in the extension zip) in Supabase first.';

  let dTab='check',details=[],qTab='due',queue={due:[],confirm:[],changed:[],oos:[]},rules=new Map(),keys=[];

  function card(id,title,text,badge,body){
    const w=document.createElement('section');w.id=id;w.className='pp-deals-admin-card pp-growth-card';
    w.innerHTML=`<div class="pp-deals-admin-head"><div><h2>${title}</h2><p class="muted">${text}</p></div><span class="pp-deals-admin-badge">${badge}</span></div>${body}`;
    return w;
  }
  function install(){
    const host=$('ppGrowthAdmin');if(!host)return false;if($('ppExtAdmin'))return true;
    const a=card('ppExtAdmin','Extension: Admin mode','Turn your PricePulse extension into a price checker. Create a key, open the extension menu, open <b>Admin mode</b> and paste it. Then every time you open a product page that is an exact, checked listing, its price, MRP and stock are saved as <b>verified</b> (fresh for 24 hours), the same as Publish. Prices that moved 30% or more wait for your click.','🧩 ADMIN MODE',
      `<div class="pp-dl-tools"><input id="ppXkLabel" type="text" maxlength="60" placeholder="Name for this browser (e.g. MacBook Chrome)"><button type="button" id="ppXkNew">Create key</button></div>
       <div id="ppXkShow" hidden class="pp-deals-guidance"></div><p id="ppXkMsg" class="muted" role="status"></p><div id="ppXkList" class="pp-deals-list"></div>`);
    const q=card('ppExtQueue','Extension: price checks','Check prices with your extension (Admin mode must be on). <b>Due</b>: no fresh verified price. <b>Price changed</b>: shoppers saw another price after your last check. <b>Out of stock</b>: sold out when last checked. <b>To confirm</b>: listings not confirmed yet; the extension reads the store title and photo, we score the match and you confirm. <b>All listings</b>: every active listing, checkable any time. The extension opens each page in a background tab, saves the price and closes the tab.','⏱ CHECKS',
      `<div class="pp-growth-tabs" id="ppXqTabs"></div><div class="pp-dl-tools"><input id="ppXqSearch" type="search" placeholder="Search product or store…"><button type="button" id="ppXqReload" class="subtle">Refresh</button><button type="button" id="ppXqGo">Check all shown</button><span id="ppXqCount" class="muted"></span></div><div id="ppXqConf" hidden class="pp-dl-tools"><button type="button" id="ppXqCapAll" class="subtle"></button><button type="button" id="ppXqOkAll"></button><span class="muted" style="font-size:12px">Nothing is confirmed without your click.</span></div><div id="ppXqProg" hidden style="margin:10px 0;padding:10px 12px;background:#f3f7f5;border-radius:10px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px"><span id="ppXqProgT"></span><button type="button" id="ppXqStop" class="subtle">Stop</button></div><div style="height:6px;border-radius:3px;background:#dce9e4;margin:8px 0 6px;overflow:hidden"><div id="ppXqBar" style="width:0;height:100%;background:#13805A"></div></div><div id="ppXqProgS" class="muted" style="font-size:12px"></div></div><p class="muted" style="margin:10px 0 4px;font-size:12.5px">Check a whole store</p><div id="ppXqStores" class="pp-x-act"></div><p id="ppXqMsg" class="muted" role="status"></p><div id="ppXqList" class="pp-deals-list"></div>`);
    const s=card('ppExtStores','Extension: stores','Stores the extension reads. <b>Ready</b> = the store\'s website is in this extension version, so a store you add in the catalog starts working here without an update. <b>Needs extension update</b> = tell Claude the domain for the next version. The product-code pattern finds the product number in the store\'s product address; selectors are only needed when a store shows the wrong price.','🏬 STORES',
      `<p id="ppXsMsg" class="muted" role="status"></p><div id="ppXsList" class="pp-deals-list"></div>`);
    const dt=card('ppExtDetails','Extension: product details','Details the extension read from store pages (brand, model, RAM, colour, all spec rows). <b>Needs check</b>: a later visit saw a different value, or two places on a page disagreed. Nothing is overwritten automatically. A value you <b>Approve</b> always wins on the site; <b>Remove</b> deletes a wrong one.','Details',
      `<div class="pp-growth-tabs" id="ppXdTabs"></div><div class="pp-dl-tools"><input id="ppXdSearch" type="search" placeholder="Search product or store…"><button type="button" id="ppXdReload" class="ppx-btn">Reload</button></div><p id="ppXdMsg" class="muted" role="status"></p><div id="ppXdList" class="pp-deals-list"></div>`);
    // V2.0.1 (Hissa 7): what shoppers do with the extension (counts from pp_ext_events)
    const ev=card('ppExtEvents','Extension: usage','How shoppers use the extension: <b>Buy clicks</b> (store links in Compare), <b>Alerts set</b> and <b>Sign-ins</b>. Counts come from the extension itself, so treat them as a guide.','📊 USAGE',
      `<div class="pp-dl-tools"><button type="button" id="ppXeReload" class="subtle">Refresh</button><span id="ppXeTime" class="muted"></span></div><p id="ppXeMsg" class="muted" role="status"></p><div id="ppXeList"></div>`);
    const anchor=$('ppFullUrlAdmin');
    if(anchor&&anchor.parentNode===host){anchor.after(ev);ev.after(a);a.after(q);q.after(s);s.after(dt);}else{host.prepend(dt);host.prepend(s);host.prepend(q);host.prepend(a);host.prepend(ev);}
    if(!$('ppXStyle')){const st=document.createElement('style');st.id='ppXStyle';st.textContent=`.pp-x-row{flex-wrap:wrap;gap:10px}.pp-x-row h3{font-size:15px}.pp-x-sub{font-size:12.5px;color:#64756e}.pp-x-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;margin-left:6px;background:#e3f5ec;color:#13805A}.pp-x-chip.warn{background:#fff3d6;color:#7a5a12}.pp-x-chip.off{background:#fde8e8;color:#9b1c1c}.pp-x-key{font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all;background:#fff;border:1px dashed #d7c38a;border-radius:8px;padding:8px;margin:6px 0;display:block}.pp-xd-fs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.pp-xd-f{font-size:12.5px;border:1px solid #dce9e4;border-radius:999px;padding:3px 8px;background:#fff}.pp-xd-f i{font-style:normal;font-size:10.5px;color:#64756e;margin-left:6px}.pp-xd-f button,.pp-xd-c button{border:0;background:none;cursor:pointer;font-weight:800;margin-left:4px}.pp-xd-c{font-size:13px;margin:4px 0}.pp-xd-c button{border:1px solid #dce9e4;border-radius:8px;padding:2px 8px;background:#fff}.pp-x-chk{flex-direction:row!important;align-items:center;gap:6px!important}.pp-x-grid{flex:1 1 100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}.pp-x-grid label{font-size:11.5px;color:#64756e;display:flex;flex-direction:column;gap:3px}.pp-x-grid input{height:34px;padding:0 9px;border:1px solid #dce9e4;border-radius:9px;font-size:12.5px}.pp-x-act{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pp-x-act a{font-weight:700;color:#13805A;text-decoration:none}`;document.head.appendChild(st);}
    $('ppXeReload').addEventListener('click',loadEvents);
    $('ppXkNew').addEventListener('click',createKey);
    $('ppXkList').addEventListener('click',onKeyClick);
    $('ppXqTabs').addEventListener('click',e=>{const b=e.target.closest('[data-xq]');if(b){qTab=b.dataset.xq;renderQueue();}});
    $('ppXqSearch').addEventListener('input',renderQueue);
    $('ppXqList').addEventListener('click',e=>{const b=e.target.closest('[data-xq-now]');if(b){startCheck([b.dataset.xqNow]);return;}const o=e.target.closest('[data-xq-ok]');if(o){const r=(queue.confirm||[]).find(x=>x.product_id+'|'+x.store_slug===o.dataset.xqOk);if(r)confirmRows([r]);}});
    $('ppXqOkAll').addEventListener('click',()=>{const hi=shownRows().filter(r=>r.level==='high');if(!hi.length){setMsg('ppXqMsg','No high matches yet. Press Capture first.');return;}if(window.confirm(`Confirm ${hi.length} listings as the same product? Their prices are then saved.`))confirmRows(hi);});
    $('ppXqCapAll').addEventListener('click',()=>{const nc=shownRows().filter(r=>!r.ctitle).map(r=>r.url);if(!nc.length){setMsg('ppXqMsg','Every listing here is already captured.');return;}startCheck(nc);});
    $('ppXqGo').addEventListener('click',()=>checkMany(shownRows().map(r=>r.url).filter(Boolean),'These listings'));
    $('ppXqStop').addEventListener('click',()=>window.postMessage({pp:'site',type:'pp-bulk-stop'},'*'));
    $('ppXqStores').addEventListener('click',e=>{const b=e.target.closest('[data-xq-store]');if(!b||!anyData)return;const k=b.dataset.xqStore;let u;
      if(k==='*'){const g={};anyData.forEach(r=>(g[r.store_slug]=g[r.store_slug]||[]).push(r.url));const Ls=Object.values(g);u=[];for(let i=0;Ls.some(x=>i<x.length);i++)Ls.forEach(x=>{if(i<x.length)u.push(x[i]);});}
      else u=anyData.filter(r=>r.store_slug===k).map(r=>r.url);
      checkMany(u,k==='*'?'Everything':'This store');});
    window.addEventListener('message',e=>{if(e.source!==window||!e.data||e.data.pp!=='ext')return;
      if(e.data.type==='pp-chk-log-result'){chkLog=e.data.log||{};renderQueue();return;}
      if(e.data.type==='pp-bulk-progress'&&e.data.s){showProgress(e.data.s);askLog();if(e.data.s.running===false&&ranNow){ranNow=false;loadQueue();}}});
    loadAny().then(()=>{renderStoreBtns();renderQueue();});setTimeout(askLog,1200);setInterval(()=>{if(!document.hidden)askLog();},60000);
    setTimeout(()=>{loadAny().then(renderStoreBtns);},1500);
    $('ppXqReload').addEventListener('click',loadQueue);
    $('ppXsList').addEventListener('click',onStoreClick);
    $('ppXdTabs').addEventListener('click',e=>{const b=e.target.closest('[data-xd]');if(b){dTab=b.dataset.xd;renderDetails();}});
    $('ppXdSearch').addEventListener('input',renderDetails);
    $('ppXdReload').addEventListener('click',loadDetails);
    $('ppXdList').addEventListener('click',onDetailClick);
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(loadAll,0));
    [800,2500,6000].forEach(t=>setTimeout(loadAll,t));
    return true;
  }

  let loading=false;
  async function loadAll(){if(!ready()||loading)return;loading=true;try{await Promise.all([loadKeys(),loadQueue(),loadRules(),loadDetails(),loadEvents()]);}finally{loading=false;}}

  /* ---- 1) admin keys ---- */
  async function loadEvents(){
    const box=$('ppXeList');if(!box)return;
    const {data,error}=await api.rpc('pp_ext_events_summary');
    if(error){setMsg('ppXeMsg',sqlMissing(error)?'Run supabase-ext-events-v2.sql in Supabase first.':'Could not load: '+(error.message||'error'));box.innerHTML='';return;}
    if(!data||!data.ok){setMsg('ppXeMsg','Admin only.');box.innerHTML='';return;}
    setMsg('ppXeMsg','');
    const L={buy_click:'Buy clicks',alert_set:'Alerts set',login:'Sign-ins'},by={};(data.rows||[]).forEach(r=>{by[r.event]=r;});
    const n=v=>Number(v||0).toLocaleString('en-IN'),th='padding:8px 10px;text-align:right;font-size:12px;color:#64756e;font-weight:700',td='padding:9px 10px;text-align:right;font-weight:800;font-variant-numeric:tabular-nums';
    box.innerHTML=`<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e3ebe7;border-radius:12px;overflow:hidden"><thead><tr style="background:#f6faf8"><th style="${th};text-align:left">Event</th><th style="${th}">Today</th><th style="${th}">Last 7 days</th><th style="${th}">Last 30 days</th><th style="${th}">All time</th></tr></thead><tbody>${Object.keys(L).map(k=>{const r=by[k]||{};return `<tr style="border-top:1px solid #eef3f0"><td style="${td};text-align:left;font-weight:700">${L[k]}</td><td style="${td}">${n(r.today)}</td><td style="${td}">${n(r.last7)}</td><td style="${td}">${n(r.last30)}</td><td style="${td}">${n(r.total)}</td></tr>`;}).join('')}</tbody></table>`;
    const t=$('ppXeTime');if(t)t.textContent='Updated '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  }
  async function loadKeys(){
    const {data,error}=await api.rpc('pp_ext_admin_keys');
    if(error){setMsg('ppXkMsg',sqlMissing(error)?NEED_SQL:error.message,true);return;}
    keys=Array.isArray(data)?data:[];renderKeys();
  }
  function renderKeys(){
    const list=$('ppXkList');if(!list)return;
    list.innerHTML=keys.length?keys.map(k=>`<article class="pp-deals-row pp-x-row" data-xk="${h(k.id)}"><div style="flex:1 1 260px"><h3>${h(k.label||'Extension key')}</h3><p class="pp-x-sub">Created ${h(when(k.created_at))} · last used ${h(when(k.last_used_at))}</p></div><div class="pp-x-act"><button type="button" class="subtle" data-xk-del>Remove</button></div></article>`).join('')
      :'<div class="pp-deals-row"><div><h3>No active key</h3><p>Create one for each browser where you check prices.</p></div></div>';
  }
  /* ---- 2b) all listings, checks on demand, "checked X ago" tags ---- */
  let anyData=null,chkLog={},ranNow=false;
  const normU=u=>{try{const x=new URL(u);return (x.hostname.replace(/^www\./,'')+x.pathname.replace(/\/+$/,'')).toLowerCase();}catch(_){return '';}};
  const ago=t=>{const m=Math.round((Date.now()-t)/60000);if(m<1)return 'just now';if(m<60)return m+' min ago';const hr=Math.round(m/60);return hr<24?hr+' h ago':when(t);};
  const RECENT=60*60*1000;
  async function loadAny(){
    if(anyData||!ready())return anyData;
    const [pr,ls]=await Promise.all([api.from('pp_catalog_products').select('product_id,name,variant,model_code').limit(2000),api.from('pp_product_store_listings').select('product_id,store_slug,direct_url,active,match_status,match_score,captured_title,captured_image_url,last_captured_at').eq('active',true).limit(5000)]);
    if(pr.error||ls.error){setMsg('ppXqMsg',(pr.error||ls.error).message,true);return null;}
    const pn=new Map((pr.data||[]).map(p=>[p.product_id,p]));
    const sn=new Map(((typeof stores!=='undefined'&&Array.isArray(stores))?stores:[]).map(x=>[x.slug,x.name]));
    anyData=(ls.data||[]).filter(l=>/^https:\/\//.test(l.direct_url||'')&&pn.has(l.product_id)).map(l=>({url:l.direct_url,store_slug:l.store_slug,product_id:l.product_id,product_name:pn.get(l.product_id).name,variant:pn.get(l.product_id).variant||'',model:pn.get(l.product_id).model_code||'',store_name:sn.get(l.store_slug)||l.store_slug,match_status:l.match_status,ctitle:l.captured_title||'',cimg:l.captured_image_url||'',cat:l.last_captured_at||null}));
    anyData.forEach(r=>{if(r.match_status!=='match'&&r.ctitle){const m=scoreMatch(r);r.score=m.score;r.level=m.level;r.why=m.why;}});
    queue.all=anyData;queue.confirm=anyData.filter(r=>r.match_status!=='match');return anyData;
  }
  /* match score: store page title vs our catalog product (never confirms anything by itself) */
  const STOP=new Set(['and','with','the','for','of','in','a','an','new','latest','buy','online','at','price','india','by','from','to','on','is']);
  const TIER=new Set(['pro','plus','max','ultra','lite','se','fe','mini','air','neo','gt','fold','flip','prime','turbo','edge','note','power']);
  const UNIT=/^(\d+(?:\.\d+)?)(gb|tb|mb|mah|inch|in|mp|w|hz|ml|l|kg|g|cm|mm)$/;
  const normT=x=>String(x||'').toLowerCase().replace(/(\d)\s*(gb|tb|mb|mah|inch|in|mp|w|hz|ml|l|kg|g|cm|mm)\b/g,'$1$2').replace(/["”]/g,'inch').replace(/[^a-z0-9.]+/g,' ').trim();
  const toksT=x=>normT(x).split(' ').filter(t=>t&&!STOP.has(t));
  function scoreMatch(r){
    const C=[...new Set(toksT(`${r.product_name} ${r.variant} ${r.model}`))],T=new Set(toksT(r.ctitle));
    if(!C.length||!T.size)return {score:0,level:'none',why:'No store title yet'};
    const has=c=>T.has(c)||[...T].some(t=>t.length>3&&c.length>3&&(t.includes(c)||c.includes(t)));
    const miss=C.filter(c=>!has(c));const cov=(C.length-miss.length)/C.length;
    const why=[];let level='high';let score=Math.round(cov*100);
    const hard=miss.filter(c=>/\d/.test(c));if(hard.length){level='review';score=Math.min(score,70);why.push('missing: '+hard.join(', '));}
    const units={};C.forEach(c=>{const m=c.match(UNIT);if(m)(units[m[2]]=units[m[2]]||{c:[],t:[]}).c.push(c);});
    [...T].forEach(t=>{const m=t.match(UNIT);if(m&&units[m[2]])units[m[2]].t.push(t);});
    Object.entries(units).forEach(([u,v])=>{if(v.t.length&&v.c.some(c=>!v.t.includes(c))){level='review';score=Math.min(score,60);why.push(`${u} differs: store ${v.t.join('/')} vs ours ${v.c.join('/')}`);}});
    const cs=new Set(C);const tier=[...T].filter(t=>TIER.has(t)&&!cs.has(t)).concat(C.filter(c=>TIER.has(c)&&!T.has(c)));
    if(tier.length){level='review';score=Math.min(score,65);why.push('model tier differs: '+[...new Set(tier)].join(', '));}
    const brand=C[0];if(brand&&!has(brand)){level='review';score=Math.min(score,50);why.push('brand not in store title');}
    if(level==='high'&&cov<0.8){level='review';why.push('only '+Math.round(cov*100)+'% of our words found');}
    return {score,level,why:why.join(' · ')};
  }
  async function confirmRows(rows){
    if(!rows.length){setMsg('ppXqMsg','Nothing to confirm.');return;}
    let uid=null;try{const g=await api.auth.getUser();uid=g&&g.data&&g.data.user&&g.data.user.id;}catch(_){}
    if(!uid){try{const g=await api.auth.getSession();uid=g&&g.data&&g.data.session&&g.data.session.user&&g.data.session.user.id;}catch(_){}}
    if(!uid){setMsg('ppXqMsg','Could not read your admin login. Refresh the page.',true);return;}
    let ok=0,bad=0;
    for(let i=0;i<rows.length;i++){const r=rows[i];setMsg('ppXqMsg',`Confirming ${i+1} of ${rows.length}…`);
      const {error}=await api.from('pp_product_store_listings').update({match_status:'match',match_score:Math.max(0,Math.min(100,r.score||0)),updated_by:uid,updated_at:new Date().toISOString()}).eq('product_id',r.product_id).eq('store_slug',r.store_slug).eq('active',true);
      if(error){bad++;}else{ok++;r.match_status='match';}}
    anyData=null;await loadAny();renderStoreBtns();renderQueue();
    setMsg('ppXqMsg',`Confirmed ${ok}${bad?`, failed ${bad}`:''}. Now checking their prices…`,!!bad&&!ok);
    if(ok)startCheck(rows.filter(r=>r.match_status==='match').map(r=>r.url));
  }
  function askLog(){window.postMessage({pp:'site',type:'pp-chk-log'},'*');}
  function renderStoreBtns(){
    const el=$('ppXqStores');if(!el)return;if(!anyData){el.innerHTML='<span class="muted">Loading…</span>';return;}
    const c={};anyData.forEach(r=>{c[r.store_slug]=c[r.store_slug]||{n:0,name:r.store_name};c[r.store_slug].n++;});
    el.innerHTML=Object.entries(c).sort((a,b)=>b[1].n-a[1].n).map(([k,v])=>`<button type="button" class="subtle" data-xq-store="${h(k)}">${h(v.name)} ${v.n}</button>`).join('')+`<button type="button" data-xq-store="*">Everything ${anyData.length}</button>`;
  }
  function shownRows(){
    const q=($('ppXqSearch').value||'').trim().toLowerCase();const words=q.split(/\s+/).filter(Boolean);
    return (queue[qTab]||[]).filter(r=>!words.length||words.every(w=>`${r.product_name} ${r.variant||''} ${r.store_name}`.toLowerCase().includes(w)));
  }
  function startCheck(urls){
    urls=[...new Set((urls||[]).filter(u=>/^https:\/\//.test(u||'')&&!/price-pulse\.in/.test(u)))];
    if(!urls.length){setMsg('ppXqMsg','Nothing to check here.');return;}
    if(!document.documentElement.getAttribute('data-pp-ext')){setMsg('ppXqMsg','PricePulse extension not found in this browser. Install / reload it, then refresh this page.',true);return;}
    ranNow=true;setMsg('ppXqMsg','Starting…');window.postMessage({pp:'site',type:'pp-bulk-start',urls},'*');
  }
  function checkMany(urls,label){
    const now=Date.now();const todo=[],skip=[];
    [...new Set(urls)].forEach(u=>{const l=chkLog[normU(u)];(l&&now-l.t<RECENT?skip:todo).push(u);});
    if(!todo.length){setMsg('ppXqMsg',`${label}: all ${skip.length} were already checked in the last hour. Use Check now on a row to check one again.`);return;}
    startCheck(todo);if(skip.length)setTimeout(()=>setMsg('ppXqMsg',`Skipping ${skip.length} checked in the last hour.`),1200);
  }
  function showProgress(s){
    const box=$('ppXqProg');if(!box)return;
    if(s.error){setMsg('ppXqMsg',s.error,true);return;}
    box.hidden=false;const pct=s.total?Math.round(100*s.done/s.total):0;
    $('ppXqBar').style.width=pct+'%';
    $('ppXqProgT').textContent=s.running?`Checking ${Math.min(s.done+1,s.total)} of ${s.total}${s.cur?' · '+s.cur:''}`:`Done · ${s.done} of ${s.total} checked`;
    $('ppXqProgS').textContent=`Saved ${s.saved} · captured ${s.cap||0} · already fresh ${s.fresh} · sold out ${s.oos} · needs confirm ${s.confirm} · skipped ${s.other}`;
    $('ppXqStop').hidden=!s.running;$('ppXqGo').disabled=!!s.running;
    if(s.running)setMsg('ppXqMsg','');
  }
  async function createKey(){
    if(!ready())return;const label=$('ppXkLabel').value.trim();
    const {data,error}=await api.rpc('pp_ext_admin_key_create',{p_label:label||null});
    if(error){setMsg('ppXkMsg',sqlMissing(error)?NEED_SQL:error.message,true);return;}
    const box=$('ppXkShow');box.hidden=false;
    box.innerHTML=`<b>Your new key (shown only once):</b><code class="pp-x-key" id="ppXkVal">${h(data)}</code><button type="button" id="ppXkCopy">Copy key</button> <span class="muted">Paste it in the extension menu → Admin mode → Turn on. Keep it private: anyone with it can save prices.</span>`;
    $('ppXkCopy').onclick=async()=>{try{await navigator.clipboard.writeText(String(data));setMsg('ppXkMsg','Key copied.');}catch(_){setMsg('ppXkMsg','Select the key and copy it.',true);}};
    $('ppXkLabel').value='';setMsg('ppXkMsg','Key created.');loadKeys();
  }
  async function onKeyClick(e){
    const row=e.target.closest('[data-xk]');if(!row||!e.target.closest('[data-xk-del]'))return;
    const {error}=await api.rpc('pp_ext_admin_key_revoke',{p_id:Number(row.dataset.xk)});
    if(error){setMsg('ppXkMsg',error.message,true);return;}
    setMsg('ppXkMsg','Key removed. That browser can no longer save prices.');loadKeys();
  }

  /* ---- 2) due / changed ---- */
  async function loadQueue(){
    if(!ready())return;setMsg('ppXqMsg','Loading…');
    const {data,error}=await api.rpc('pp_ext_admin_queue');
    if(error){setMsg('ppXqMsg',sqlMissing(error)?NEED_SQL:error.message,true);return;}
    let allDue=(data&&data.due)||[],oosRows=[];
    try{const {data:oo}=await api.rpc('pp_ext_oos_list');oosRows=Array.isArray(oo)?oo:[];}catch(e){oosRows=[];}  /* V7: sold-out checks from the extension (24 h) */
    const isOos=r=>r.url&&oosRows.some(o=>o.store===r.store_slug&&String(r.url).toUpperCase().includes(String(o.code).toUpperCase()));
    await loadAny();
    queue={all:anyData||[],confirm:(anyData||[]).filter(r=>r.match_status!=='match'),due:allDue.filter(r=>!isOos(r)),changed:(data&&data.changed)||[],oos:allDue.filter(isOos).map(r=>{const o=oosRows.find(o=>o.store===r.store_slug&&String(r.url).toUpperCase().includes(String(o.code).toUpperCase()))||{};return {...r,oos_seen_at:o.seen_at};})};
    setMsg('ppXqMsg','');renderStoreBtns();renderQueue();
  }
  function renderQueue(){
    const list=$('ppXqList');if(!list)return;
    const TABS=[['due','Due'],['confirm','To confirm'],['changed','Price changed'],['oos','Out of stock'],['all','All listings']];
    $('ppXqTabs').innerHTML=TABS.map(([k,l])=>`<button type="button" data-xq="${k}" class="${qTab===k?'is-on':''}">${l} <b class="pp-dem-n">${k==='all'&&!anyData?'…':(queue[k]||[]).length}</b></button>`).join('');
    const rows=shownRows();
    const cf=$('ppXqConf');if(cf){cf.hidden=qTab!=='confirm';if(qTab==='confirm'){const hi=rows.filter(r=>r.level==='high'),nc=rows.filter(r=>!r.ctitle);$('ppXqOkAll').textContent=`Confirm all high matches (${hi.length})`;$('ppXqCapAll').textContent=`Capture ${nc.length} not read yet`;}}
    $('ppXqCount').textContent=`${rows.length} shown`;$('ppXqGo').textContent=`Check all shown (${rows.length})`;
    if(qTab==='all'&&!anyData){list.innerHTML='<div class="pp-deals-row"><div><h3>Loading listings…</h3></div></div>';return;}
    list.innerHTML=rows.length?rows.slice(0,300).map(r=>{
      const dom=r.domain||((typeof stores!=='undefined'&&Array.isArray(stores)&&stores.find(x=>x.slug===r.store_slug))||{}).domain||'';const ready=extReady(dom)||BUILTIN[r.store_slug];
      const info=qTab==='confirm'?(r.ctitle?`Store page says: <b>${h(r.ctitle.slice(0,140))}</b>${r.why?'<br><span style="color:#7a5a12">'+h(r.why)+'</span>':''}`:'Not captured yet. Press Check now (extension reads the page title and photo).'):qTab==='all'?(r.url?'':'No link'):qTab==='oos'?`Checked as out of stock · ${h(when(r.oos_seen_at))} · no price to save (counts as checked for 24 h)`:qTab==='due'
        ?(r.last_checked?`Last verified ${inr(r.last_price)} · ${h(when(r.last_checked))}${r.expires_at&&new Date(r.expires_at)>new Date()?' · expires '+h(when(r.expires_at)):' · expired'}`:'Never verified')
        :`Verified ${inr(r.verified_price)} (${h(when(r.verified_at))}) → shoppers saw <b>${inr(r.seen_price)}</b> (${h(when(r.seen_at))})${r.seen_in_stock===false?' · out of stock':''}`;
      const lg=r.url?chkLog[normU(r.url)]:null;const mt=qTab==='confirm'&&r.ctitle?`<span class="pp-x-chip${r.level==='high'?'':' warn'}">Match ${r.score}% · ${r.level==='high'?'high':'check'}</span>`:'';
      const tag=lg?`<span class="pp-x-chip${Date.now()-lg.t<RECENT?'':' off'}" style="${Date.now()-lg.t<RECENT?'':'background:#eef2f0;color:#4d5f58'}">Checked ${h(ago(lg.t))} · ${lg.s==='saved'?'saved'+(lg.p?' '+inr(lg.p):''):lg.s==='fresh'?'already fresh':lg.s==='oos'?'sold out':'needs your confirm'}</span>`:'';
      return `<article class="pp-deals-row pp-x-row"><div style="flex:1 1 300px;min-width:0"><h3>${h(r.product_name)} · ${h(r.store_name)}${ready?'':'<span class="pp-x-chip warn">Extension cannot read this store yet</span>'}${mt}${tag}</h3><p>${h(r.variant||'')}</p>${info?`<p class="pp-x-sub">${info}</p>`:''}</div>
        <div class="pp-x-act">${qTab==='confirm'&&r.cimg?`<img src="${h(r.cimg)}" alt="" style="width:44px;height:44px;object-fit:contain;border-radius:8px;background:#fff;border:1px solid #dce9e4" loading="lazy" referrerpolicy="no-referrer">`:''}${qTab==='confirm'&&r.ctitle?`<button type="button" data-xq-ok="${h(r.product_id+'|'+r.store_slug)}">Confirm</button> `:''}${r.url?`<button type="button" data-xq-now="${h(r.url)}">Check now</button> <a href="${h(r.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a>`:'<span class="muted">No link</span>'}</div></article>`;}).join('')
      :`<div class="pp-deals-row"><div><h3>${qTab==='due'?'Nothing due':qTab==='oos'?'No out-of-stock checks yet':qTab==='all'?'No listing found':qTab==='confirm'?'Nothing to confirm':'No price changes seen'}</h3><p>${qTab==='due'?'Every checked listing has a fresh verified price or an out-of-stock check.':qTab==='oos'?'Open a sold-out listing with the extension in Admin mode and it shows here.':qTab==='all'?'Only active listings with a full store link can be checked.':qTab==='confirm'?'Every active listing is confirmed.':'Shoppers saw the same prices as your last checks (last 7 days).'}</p></div></div>`;
  }

  /* ---- 3) stores ---- */
  async function loadRules(){
    if(!ready())return;
    const {data,error}=await api.from('pp_ext_store_rules').select('*');
    if(error){setMsg('ppXsMsg',sqlMissing(error)?NEED_SQL:error.message,true);rules=new Map();}
    else{rules=new Map((data||[]).map(r=>[r.store_slug,r]));setMsg('ppXsMsg','');}
    renderStores();
  }
  function renderStores(){
    const list=$('ppXsList');if(!list)return;
    const all=(typeof stores!=='undefined'&&Array.isArray(stores)?stores:[]).filter(s=>s&&s.slug).slice().sort((a,b)=>a.name.localeCompare(b.name));
    list.innerHTML=all.length?all.map(s=>{
      const slug0=x=>x.slug;const r=rules.get(s.slug)||{},builtin=BUILTIN[s.slug],ok=extReady(s.domain)||!!builtin,on=r.enabled!==false&&s.active!==false;
      const chip=!ok?'<span class="pp-x-chip off">Needs extension update</span>':!on?'<span class="pp-x-chip warn">Off</span>':'<span class="pp-x-chip">Ready</span>';
      return `<article class="pp-deals-row pp-x-row" data-xs="${h(s.slug)}"><div style="flex:1 1 260px"><h3>${h(s.name)}${chip}</h3><p class="pp-x-sub">${h(s.domain||'no domain set')}${builtin?' · '+h(builtin):''}</p></div>
        <div class="pp-x-act"><label class="pp-x-sub"><input type="checkbox" data-xs-on ${r.enabled===false?'':'checked'}> Read this store</label><button type="button" data-xs-save>Save</button></div>
        ${builtin?'':`<div class="pp-x-grid"><label>Product-code pattern (one ( ) group)<input data-xs-f="key_regex" value="${h(r.key_regex||'')}" placeholder="auto: last number in the address"></label><label>Price selector (optional)<input data-xs-f="price_selector" value="${h(r.price_selector||'')}" placeholder=".pdp-price"></label><label>MRP selector (optional)<input data-xs-f="mrp_selector" value="${h(r.mrp_selector||'')}"></label><label>Title selector (optional)<input data-xs-f="title_selector" value="${h(r.title_selector||'')}"></label></div>`}
        ${slug0(s)==='amazon'?'':`<div class="pp-x-grid pp-x-live"><label>Search page address (needs {q})<input data-xs-f="search_url" value="${h(r.search_url||'')}" placeholder="https://store.com/search?q={q}  (empty = built-in)"></label><label>Result card selector (optional)<input data-xs-f="search_card" value="${h(r.search_card||'')}"></label><label>Result title selector (optional)<input data-xs-f="search_title" value="${h(r.search_title||'')}"></label><label>Result price selector (optional)<input data-xs-f="search_price" value="${h(r.search_price||'')}"></label><label>Result link selector (optional)<input data-xs-f="search_link" value="${h(r.search_link||'')}"></label><label>Affiliate link template (needs {url})<input data-xs-f="aff_template" value="${h(r.aff_template||'')}" placeholder="https://…?url={url}  (empty = built-in)"></label><label>Spec rows selector (optional)<input data-xs-f="spec_selector" value="${h(r.spec_selector||'')}"></label><label>Sectors (comma list, * = all)<input data-xs-f="sectors" value="${h(r.sectors||'')}" placeholder="mobiles, laptops, fashion, beauty"></label><label class="pp-x-chk"><input type="checkbox" data-xs-live ${r.live===false?'':'checked'}> Use for live compare</label></div>`}</article>`;}).join('')
      :'<div class="pp-deals-row"><div><h3>Sign in with an admin account</h3><p>The store list loads with your catalog.</p></div></div>';
  }
  async function onStoreClick(e){
    const row=e.target.closest('[data-xs]');if(!row||!e.target.closest('[data-xs-save]'))return;
    const slug=row.dataset.xs,val={store_slug:slug,enabled:row.querySelector('[data-xs-on]').checked,updated_at:new Date().toISOString()};
    if(typeof user!=='undefined'&&user?.id)val.updated_by=user.id;
    for(const inp of row.querySelectorAll('[data-xs-f]')){const v=inp.value.trim();val[inp.dataset.xsF]=v||null;}
    const lv=row.querySelector('[data-xs-live]');if(lv)val.live=lv.checked;
    if(val.search_url&&!(/^https:\/\//.test(val.search_url)&&val.search_url.includes('{q')&&val.search_url.length<=300)){setMsg('ppXsMsg','Search page address must start with https:// and contain {q}',true);return;}
    if(val.aff_template&&!(/^https:\/\//.test(val.aff_template)&&val.aff_template.includes('{url}')&&val.aff_template.length<=300)){setMsg('ppXsMsg','Affiliate link template must start with https:// and contain {url}',true);return;}
    if(val.sectors&&!/^[a-z*, ]{1,120}$/.test(val.sectors)){setMsg('ppXsMsg','Sectors: small letters, commas and spaces only',true);return;}
    if(val.key_regex){try{const re=new RegExp(val.key_regex,'i');if(!/\((?!\?)/.test(val.key_regex))throw new Error('needs a ( ) group');void re;}catch(err){setMsg('ppXsMsg','Product-code pattern is not valid: '+err.message,true);return;}}
    const {error}=await api.from('pp_ext_store_rules').upsert(val,{onConflict:'store_slug'});
    if(error){setMsg('ppXsMsg',sqlMissing(error)?NEED_SQL:error.message,true);return;}
    rules.set(slug,{...(rules.get(slug)||{}),...val});renderStores();
    setMsg('ppXsMsg',`Saved. Extensions pick this up within 6 hours (or at once after turning Admin mode on).`);
  }


  /* ---- 4) product details ---- */
  const needs=d=>(d.changes&&Object.keys(d.changes).length)||(Array.isArray(d.conflicts)&&d.conflicts.length);
  async function loadDetails(){
    if(!ready())return;
    const {data,error}=await api.rpc('pp_ext_details_admin',{p_limit:300});
    if(error){setMsg('ppXdMsg',sqlMissing(error)?NEED_SQL:error.message,true);details=[];}
    else{details=Array.isArray(data)?data:[];setMsg('ppXdMsg','');}
    renderDetails();
  }
  const val=v=>typeof v==='object'&&v!==null?JSON.stringify(v):String(v??'');
  function renderDetails(){
    const list=$('ppXdList'),tabs=$('ppXdTabs');if(!list)return;
    const n=details.filter(needs).length;
    if(tabs)tabs.innerHTML=[['check','Needs check ('+n+')'],['all','All ('+details.length+')']].map(([k,l])=>`<button type="button" data-xd="${k}" class="${dTab===k?'is-on':''}">${l}</button>`).join('');
    const q=($('ppXdSearch')?.value||'').trim().toLowerCase();
    const rows=details.filter(d=>(dTab==='all'||needs(d))&&(!q||(d.title||'').toLowerCase().includes(q)||String(d.store).includes(q)||String(d.product_key).toLowerCase().includes(q)));
    list.innerHTML=rows.length?rows.slice(0,60).map(d=>{
      const f=d.fields||{},src=d.sources||{},ch=d.changes||{};
      const fl=Object.keys(f).map(k=>`<span class="pp-xd-f"><b>${h(k)}</b> ${h(val(f[k]))}<i>${h(src[k]||'page')}</i>${src[k]==='admin'?'':`<button type="button" data-xd-act="approve_field" data-field="${h(k)}" title="Approve: always shown on the site">✓</button>`}<button type="button" data-xd-act="remove_field" data-field="${h(k)}" title="Remove this value">×</button></span>`).join('');
      const cl=Object.keys(ch).map(k=>`<div class="pp-xd-c"><b>${h(k)}</b>: saved <em>${h(val(ch[k].old))}</em> → seen <em>${h(val(ch[k].new))}</em> <button type="button" data-xd-act="accept_change" data-field="${h(k)}">Use new</button><button type="button" data-xd-act="keep_old" data-field="${h(k)}">Keep old</button></div>`).join('');
      const cf=Array.isArray(d.conflicts)&&d.conflicts.length?`<p class="pp-x-sub">Page disagreed with itself on: ${h(d.conflicts.map(c=>typeof c==='string'?c:(c.field||val(c))).join(', '))} (not saved).</p>`:'';
      const sc=Object.keys(d.specs||{}).length;
      return `<article class="pp-deals-row pp-x-row" data-xd-store="${h(d.store)}" data-xd-key="${h(d.product_key)}"><div style="flex:1 1 100%;min-width:0"><h3>${h(d.title||d.product_key)} · ${h(d.store)}${needs(d)?'<span class="pp-x-chip warn">Needs check</span>':''}</h3><p class="pp-x-sub">${h((d.category||[]).join(' › ')||'no category')} · ${sc} spec rows · seen ${h(d.seen_count)}× · ${when(d.updated_at)}${d.url?` · <a href="${h(d.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a>`:''}</p>${cf}${cl}<div class="pp-xd-fs">${fl||'<span class="muted">No fields</span>'}</div><p><button type="button" data-xd-act="delete_row">Delete this saved listing</button></p></div></article>`;}).join('')
      :`<div class="pp-deals-row"><div><h3>${dTab==='check'?'Nothing needs checking':'No details saved yet'}</h3><p>${dTab==='check'?'No saved value was contradicted.':'Open product pages on a store with the extension on, then reload.'}</p></div></div>`;
  }
  async function onDetailClick(e){
    const b=e.target.closest('[data-xd-act]');const row=e.target.closest('[data-xd-store]');if(!b||!row)return;
    const act=b.dataset.xdAct;
    if(act==='delete_row'&&!confirm('Delete this saved listing and all its details?'))return;
    if(act==='remove_field'&&!confirm('Remove this value?'))return;
    const {data,error}=await api.rpc('pp_ext_details_act',{p_store:row.dataset.xdStore,p_key:row.dataset.xdKey,p_action:act,p_field:b.dataset.field||null});
    if(error||!data||data.ok===false){setMsg('ppXdMsg',error?(sqlMissing(error)?NEED_SQL:error.message):('Not done: '+(data&&data.error||'unknown')),true);return;}
    setMsg('ppXdMsg','Done.');await loadDetails();
  }


  /* ---- 5) Add / Edit Product: "Fill from store link" (extension-saved details, SQL v4) ---- */
  const CAT_WORDS={mobiles:['mobile','mobiles','smartphone','smartphones','phone','phones'],laptops:['laptop','laptops','notebook','notebooks','macbook','computers'],
    electronics:['electronics','headphone','headphones','earbuds','audio','speaker','speakers','television','tv','camera','cameras','tablet','tablets','accessories'],
    watches:['watch','watches','smartwatch','smartwatches','wearable','wearables'],home:['home','kitchen','cookware','dining','furniture','decor'],
    appliances:['appliance','appliances','refrigerator','refrigerators','washing','conditioner','fryer','fryers','microwave','purifier','geyser','fan','fans'],
    fashion:['fashion','clothing','apparel','footwear','shoes','shirt','shirts','jeans','men','women','sneakers','bags'],
    beauty:['beauty','makeup','skin','skincare','lip','lipstick','hair','fragrance','personal','care','cosmetics']};
  function pickCategory(sel,path){
    if(!sel||!path.length)return '';
    const words=path.join(' ').toLowerCase().split(/[^a-z]+/).filter(Boolean);
    let best='',bs=0;
    [...sel.options].forEach(o=>{
      const v=String(o.value||'').toLowerCase();if(!v)return;
      const own=[v,...String(o.textContent||'').toLowerCase().split(/[^a-z]+/).filter(w=>w.length>2),...(CAT_WORDS[v]||[])];
      // later (more exact) path parts count more
      let sc=0;path.forEach((part,i)=>{const pw=String(part).toLowerCase().split(/[^a-z]+/);if(pw.some(w=>own.includes(w)))sc+=1+i;});
      if(sc>bs){bs=sc;best=o.value;}
    });
    return words.length?best:'';
  }
  /* Store titles are long ("... with Built-in Privacy Display, AI Phone ..."): cut at " with " / " | " / " - ", keep the (colour, RAM, storage) bracket */
  function shortName(t,brand){
    t=String(t||'').replace(/\s+/g,' ').trim();if(!t)return '';
    let out=t;
    const cut=out.search(/\s+(?:with|\||–|—|-|:)\s+|\s*,\s*(?=[A-Z][a-z]+ )/);
    if(cut>25&&(out.length>70||/\s+with\s+/i.test(out.slice(cut))))out=out.slice(0,cut);
    if(out.length>90){const sp=out.lastIndexOf(' ',90);out=out.slice(0,sp>40?sp:90);}
    return out.replace(/[\s,;:|-]+$/,'');
  }
  function identityFromName(name,brand){
    // v266: drop only brackets with colour / RAM / storage ("(White, 256 GB)"); keep model brackets like "(4a)"
    let n=String(name||'').replace(/\(([^)]*)\)/g,(m,x)=>/,|\b\d+\s?(GB|TB|MB)\b|\bRAM\b|\bSSD\b|\bROM\b/i.test(x)||/^(black|white|blue|red|green|grey|gray|silver|gold|pink|purple|yellow|orange|titanium|natural|midnight|starlight|cream|beige|brown)\b/i.test(x.trim())?' ':m).replace(/\s+/g,' ').trim();
    if(brand){const b=String(brand).trim();if(n.toLowerCase().startsWith(b.toLowerCase()))n=n.slice(b.length).trim();}
    return n.length>=2&&n.length<=60?n:'';
  }
  /* v265: storage, RAM and colour named in a store title */
  const gb=s=>String(s||'').replace(/\s+/g,'').toUpperCase().replace(/^(\d+)(GB|TB|MB)$/,'$1 $2');
  function sizesIn(t){return [...String(t||'').matchAll(/(\d{1,4})\s?(GB|TB)\b/gi)].map(m=>gb(m[1]+m[2]));}
  function variantFromTitle(t){
    t=String(t||'');const out={ram:'',storage:'',color:''};
    const ram=t.match(/(\d{1,3})\s?GB\s*(?:RAM|LPDDR\w*|DDR\w*)/i);if(ram)out.ram=gb(ram[1]+'GB');
    const all=sizesIn(t),num=x=>parseFloat(x)*(/TB/.test(x)?1024:1);
    const rest=all.filter(x=>x!==out.ram);
    if(rest.length)out.storage=rest.sort((a,b)=>num(b)-num(a))[0];
    if(!out.ram&&all.length>=2){const small=all.slice().sort((a,b)=>num(a)-num(b))[0];if(small!==out.storage&&num(small)<=32)out.ram=small;}
    const br=t.match(/\(([^)]{2,80})\)/);
    if(br){const first=br[1].split(',')[0].trim();if(first&&!/\d/.test(first)&&first.length<=30)out.color=first;}
    return out;
  }
  let lastSpec={ram:'',storage:''};
  function installFill(){
    const f=$('productForm');if(!f||$('ppXfBox'))return !!f;
    const grid=f.querySelector('.dialog-grid');if(!grid)return false;
    const box=document.createElement('div');box.className='wide pp-xf';box.id='ppXfBox';
    box.innerHTML=`<label>Fill from a store link <span class="muted">(details saved by the extension)</span></label><div class="pp-xf-row"><input id="ppXfUrl" type="url" placeholder="Paste the product page address, e.g. https://www.croma.com/…/p/123456"><button type="button" id="ppXfGo">Fill</button></div><p id="ppXfMsg" class="fine"></p>`;
    grid.prepend(box);
    $('ppXfGo').addEventListener('click',()=>fillThenPending());
    $('ppXfUrl').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();fillThenPending();}});
    const pb=document.createElement('div');pb.id='ppXpBox';pb.hidden=true;box.appendChild(pb);
    pb.addEventListener('click',onPendingBoxClick);pb.addEventListener('change',()=>paintCheck());
    f.addEventListener('submit',onFormSubmit,true);
    // v268: remember when the admin picks Brand / Category by hand, so Fill never blanks a choice the admin made
    ['brand_slug','category'].forEach(n=>{const s=f.elements[n];if(s)s.addEventListener('change',e=>{if(e.isTrusted)s.dataset.ppUser='1';});});
    $('productDialog')?.addEventListener('close',()=>{['brand_slug','category'].forEach(n=>{const s=f.elements[n];if(s)delete s.dataset.ppUser;});});
    // a fresh dialog starts with an empty box
    $('productDialog')?.addEventListener('close',()=>{$('ppXfUrl').value='';setMsg('ppXfMsg','');pend=null;lastCheck=null;const pb=$('ppXpBox');if(pb){pb.hidden=true;pb.innerHTML='';}f.querySelectorAll('.pp-xf-filled').forEach(x=>x.classList.remove('pp-xf-filled'));});
    if(!$('ppXfStyle')){const st=document.createElement('style');st.id='ppXfStyle';st.textContent='.pp-xf{padding:12px;border:1px dashed #d7c38a;border-radius:12px;background:#fffaf0}.pp-xf-row{display:flex;gap:8px}.pp-xf-row input{flex:1}.pp-xf-filled{outline:2px solid #3DDC97;outline-offset:1px;background:#effcf5!important}';document.head.appendChild(st);}
    return true;
  }
  // v268: Brand / Category the page did not give: leave the dropdown EMPTY (it used to show the first item of the list, a wrong one)
  function blankSel(sel){try{if(![...sel.options].some(x=>x.value===''))sel.insertBefore(new Option('Select…',''),sel.firstChild);sel.value='';sel.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){}}
  // v268: photos of the SAME product on other stores, through the extension bridge (same engine as the Find page: it borrows them when this store has none, e.g. Amazon)
  function bridgePhotos(url,ms){return new Promise(res=>{
    const id='xf'+Date.now()+Math.random().toString(36).slice(2,6);let best=[],from='',done=false,t=null,ex=0,sim=0,fin_=false,got=false;
    const fin=(r)=>{if(done)return;done=true;clearTimeout(t);window.removeEventListener('message',on);res({images:best,from,ex,sim,got,timeout:r==='t'});};
    const on=e=>{const d=e.data;if(e.source!==window||!d||d.pp!=='ext'||d.id!==id)return;got=true;
      if(Array.isArray(d.rows)){ex=d.rows.filter(r=>r&&r.match==='exact'&&!r.source).length;sim=d.rows.filter(r=>r&&r.match!=='exact'&&!r.source).length;}
      if(d.product&&Array.isArray(d.product.images)&&d.product.images.length){best=d.product.images.filter(u=>typeof u==='string');from=d.product.enrichedFrom||'';if(best.length>=3)fin();}
      if(d.type==='pp-find-result')fin();};
    t=setTimeout(()=>fin('t'),ms);window.addEventListener('message',on);
    try{window.postMessage({pp:'site',type:'pp-find',id,url},'*');}catch(_){fin();}
  });}
  async function fillFromLink(){
    const f=$('productForm'),url=($('ppXfUrl').value||'').trim();
    if(!/^https:\/\//i.test(url)){setMsg('ppXfMsg','Paste the full product address (starts with https://).',true);return;}
    if(!ready()){setMsg('ppXfMsg','Sign in with an admin account first.',true);return;}
    setMsg('ppXfMsg','Looking for saved details…');
    const {data,error}=await api.rpc('pp_ext_details_for_url',{p_url:url});
    if(error){setMsg('ppXfMsg',sqlMissing(error)?NEED_SQL:error.message,true);return;}
    if(!data||data.ok===false){setMsg('ppXfMsg',data&&data.error==='not saved'?'No saved details for this page yet. Open it once in Chrome with the PricePulse extension on, then try again.':'Not found: '+(data&&data.error||'unknown'),true);return;}
    // v271 (Fix 3): the pending row's own (fresh) title wins; old saved fields/specs of another product are ignored
    const ptl=(pend&&pend.title&&pend.product_key&&url.includes(pend.product_key))?String(pend.title):'';
    const stale=!!ptl&&!agree(data.title,ptl),ttl=ptl||data.title;
    const fd=stale?{}:(data.fields||{}),isNew=!f.elements.editing_id.value,done=[],skipped=[];
    const put=(name,val,label)=>{const el=f.elements[name];if(!el||val==null||String(val).trim()==='')return;if(String(el.value||'').trim()){if(String(el.value).trim()!==String(val).trim())skipped.push(label);return;}el.value=String(val).trim();el.classList.add('pp-xf-filled');el.dispatchEvent(new Event('input',{bubbles:true}));done.push(label);};
    const short=shortName(ttl,fd.brand);
    put('name',short,'Name');
    const model=fd.mpn||fd.model||'';
    put('model_code',model,'Model / SKU');
    put('identity_key',fd.model||fd.mpn||identityFromName(short,fd.brand),'Identity key');
    const img0=(Array.isArray(data.images)?data.images:[]).find(u=>/^https:\/\//.test(u));
    if(img0)put('image_url',img0,'Photo');
    // v265: storage / RAM / colour also from the page title, e.g. "(Frost, 512 GB)" or "12GB RAM | 256GB"
    const tv=variantFromTitle(ttl);
    // v266: RAM / storage also from the store's spec rows (Flipkart shows "RAM 12 GB" there, not in the title)
    const sp=stale?{}:(data.specs||{}),spv=(re,no)=>{const k=Object.keys(sp).find(x=>re.test(x)&&!no.test(x)&&/\d/.test(String(sp[x])));return k?String(sp[k]):'';};
    const spRam=gb((spv(/(^|[^a-z])ram($|[^a-z])/i,/type|speed|frequency|slots|expandable/i).match(/(\d{1,3})\s?GB/i)||[])[0]||''),spSto=gb((spv(/internal storage|internal memory|^storage|storage capacity|(^|[^a-z])rom($|[^a-z])/i,/type|expandable|slot|card/i).match(/(\d{1,4})\s?(GB|TB)/i)||[])[0]||'');
    tv.ram=tv.ram||spRam;tv.storage=tv.storage||spSto;lastSpec={ram:spRam,storage:spSto};
    const variant=[[fd.ram||tv.ram,fd.storage||tv.storage].filter(Boolean).join('/'),fd.qty,fd.size,fd.color||tv.color].filter(Boolean).join(', ');
    put('variant',variant,'Variant');
    if(isNew&&fd.brand){
      const sel=f.elements.brand_slug,want=String(fd.brand).toLowerCase().replace(/[^a-z0-9]/g,'');
      const o=[...sel.options].find(o=>String(o.textContent).toLowerCase().replace(/\(inactive\)/,'').replace(/[^a-z0-9]/g,'')===want||String(o.value).replace(/[^a-z0-9]/g,'')===want);
      if(o&&sel.value===o.value&&sel.classList.contains('pp-xf-filled')){}
      else if(o){sel.value=o.value;sel.classList.add('pp-xf-filled');sel.dispatchEvent(new Event('change',{bubbles:true}));done.push('Brand');}
      else{
        // v264: the dropdown would silently show the first brand (wrong). Make it empty so it cannot be saved by mistake.
        if(![...sel.options].some(x=>x.value===''))sel.insertBefore(new Option('Select brand…',''),sel.firstChild);
        sel.value='';sel.dispatchEvent(new Event('change',{bubbles:true}));
        skipped.push(`Brand "${fd.brand}" is not in your brand list: add it in Brands first, then Fill again (Brand is left empty on purpose)`);
      }
    }
    else if(isNew){const sel=f.elements.brand_slug;if(sel&&!sel.dataset.ppUser&&!sel.classList.contains('pp-xf-filled')){blankSel(sel);skipped.push('Brand was not found on the page: choose it yourself (left empty on purpose)');}}
    if(isNew){
      const sel=f.elements.category,c=Array.isArray(data.category)&&data.category.length?pickCategory(sel,data.category):null;
      if(c&&sel.value===c&&sel.classList.contains('pp-xf-filled')){}
      else if(c){sel.value=c;sel.classList.add('pp-xf-filled');sel.dispatchEvent(new Event('change',{bubbles:true}));done.push('Category');}
      else if(sel&&!sel.dataset.ppUser&&!sel.classList.contains('pp-xf-filled')){blankSel(sel);skipped.push('Category was not found on the page: choose it yourself (left empty on purpose)');}
    }
    try{if(typeof productFormPreview==='function')productFormPreview();}catch(_){}
    const specs=stale?0:Object.keys(data.specs||{}).length;
    const base=(done.length?`Filled: ${done.join(', ')} (green). `:'Nothing new to fill. ')+(skipped.length?`Kept your values: ${skipped.join(', ')}. `:'')+(stale?'Old saved details belong to another product, so Name / Variant come from the new page title. ':'')+`From ${data.store}${specs?` · ${specs} spec rows saved (shown on the product page after you add this store link)`:''}.`;
    const PROMO=/\/(?:promos?|fk-p-flap|internalised)\//i,PROMO2=/\/www\/\d+\/\d+\//;   // v269: store promo graphics (EMI / offer tiles), also those saved before 1.5.11
    const SMALLPIC=u=>{const m=String(u).match(/\/image\/(\d+)\/(\d+)\//);return !!m&&Number(m[1])<250;};   // v270: 40/80/160 px = thumbnails or "similar products" of the store page
    let pics=(Array.isArray(data.images)?data.images:[]).filter(u=>/^https:\/\//.test(u)&&!PROMO.test(u)&&!PROMO2.test(u)&&!SMALLPIC(u)),from='',bnote='';
    if(pics.length<3){
      if(document.documentElement.getAttribute('data-pp-ext')){
        setMsg('ppXfMsg',base+' Looking for more photos of this product on other stores…');
        // Amazon links often have no product name in them (".../dp/B0DSF14WQZ"): then the bridge cannot search other stores. Give it the saved name inside the link.
        let bUrl=url;
        try{if(/amazon\./i.test(new URL(url).hostname)&&data.product_key&&data.title){const slug=String(data.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);if(slug)bUrl=`https://${new URL(url).hostname}/${slug}/dp/${data.product_key}`;}}catch(_){}
        const b=await bridgePhotos(bUrl,45000);
        const more=b.images.filter(u=>/^https:\/\//.test(u)&&!PROMO.test(u)&&!PROMO2.test(u)&&!SMALLPIC(u));
        if(more.length){pics=pics.concat(more);from=b.from;}
        else bnote=b.got?` (Looked on other stores${b.timeout?' for 45 s':''}: ${b.ex} exact and ${b.sim} similar matches, none gave a usable photo.)`:' (The extension did not answer on this page: reload the extension and this page.)';
      }else bnote=' (The PricePulse extension is not active on this page, so photos from other stores could not be looked up.)';
    }
    if(!pics.length){setMsg('ppXfMsg',base+' No photo found for this product.'+bnote+' Check before saving.');return;}
    setMsg('ppXfMsg',base+' Checking store photos…');
    let ph;try{ph=await fillPhotos(f,pics);}catch(e){ph={used:[],skip:[e.message||'photo check failed'],full:false};}
    const pt=ph.used.length?` Photos: ${ph.used.length} auto-fitted into ${ph.used.map(x=>x.label).join(', ')} (website mode set to Curated; they upload when you save).`:(ph.full?' Photos: your Image 1-3 are already set, nothing changed.':' Photos: none passed the check, nothing changed.');
    const ps=(from&&ph.used.length?` Some photos came from ${from} (same product).`:'')+(ph.skip.length?` Skipped: ${ph.skip.join('; ')}.`:'');
    setMsg('ppXfMsg',base+pt+ps+(pics.length>ph.used.length?' All store photos still show in the product page gallery.':'')+(ph.gaps&&ph.gaps.length?` [v267 difference: ${ph.gaps.join(', ')}]`:' [v264]')+' Check before saving.');
  }
  /* Store photos -> Premium site images 1-3. Each photo is auto-fitted (white background, centred, equal border).
     A photo goes in only if it passes: it loads, the store lets the browser process it, it is big enough and its
     background is white / off-white / transparent. Anything else is skipped and the next photo is tried. */
  const SLOT_LABEL={primary:'Image 1',secondary:'Image 2',tertiary:'Image 3'};
  function loadPic(u){return new Promise((res,rej)=>{const im=new Image();im.crossOrigin='anonymous';im.referrerPolicy='no-referrer';const t=setTimeout(()=>{im.src='';rej(new Error('too slow'));},15000);im.onload=()=>{clearTimeout(t);res(im);};im.onerror=()=>{clearTimeout(t);rej(new Error('store blocks it'));};im.src=u;});}
  async function fillPhotos(f,pics){
    const T=window.ppImgTools,used=[],skip=[];
    const free=['primary','secondary','tertiary'].filter(sl=>f.elements[`site_${sl}_url`]&&!String(f.elements[`site_${sl}_url`].value||'').trim()&&!f.elements[`site_${sl}_file`]?.files?.length);
    if(!free.length)return {used,skip,full:true};
    if(!T||typeof T.autoFit!=='function')return {used,skip:['photo tools not loaded (reload the page)'],full:false};
    const toBlob=c=>new Promise(r=>c.toBlob(r,'image/png'));
    // the same picture often comes twice in different sizes: compare the link and a tiny grey copy of the result
    const ukey=u=>String(u).replace(/[?#].*$/,'').replace(/\/image\/\d+\/\d+\//,'/image/').replace(/\/(?:[hwq]_\d+,?)+\//,'/').replace(/[-_]?\d{2,4}x\d{2,4}/g,'');
    const sig=cv=>{const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.drawImage(cv,0,0,16,16);const d=x.getImageData(0,0,16,16).data,o=[];for(let i=0;i<d.length;i+=4)o.push((d[i]+d[i+1]+d[i+2])/3);return o;};
    const dist=(a,b)=>{let t=0;for(let i=0;i<a.length;i++)t+=Math.abs(a[i]-b[i]);return t/a.length;};
    const NEAR=14,gaps=[],cands=[];
    // share of non-white pixels: a phone on white is low, a banner full of text blocks is high
    const busyOf=cv=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.drawImage(cv,0,0,64,64);const d=x.getImageData(0,0,64,64).data;let n=0;for(let i=0;i<d.length;i+=4){if(d[i+3]>20&&Math.min(d[i],d[i+1],d[i+2])<235)n++;}return n/4096;};
    const seenKeys=new Map(),seenSigs=[];
    // pictures already in Image 1-3 count too, so a second Fill never adds the same one again
    for(const sl of ['primary','secondary','tertiary']){
      const nm=SLOT_LABEL[sl],src=f.elements[`site_${sl}_source`]?.selectedOptions?.[0]?.dataset?.source||'';
      if(src.startsWith('store:'))seenKeys.set(ukey(src.slice(6)),nm);
      const url=String(f.elements[`site_${sl}_url`]?.value||'').trim();if(url)seenKeys.set(ukey(url),nm);
      const file=f.elements[`site_${sl}_file`]?.files?.[0];
      try{const bm=file?await createImageBitmap(file):url?await loadPic(url):null;if(bm)seenSigs.push({s:sig(bm),n:nm});}catch(_){}
    }
    for(let i=0;i<pics.length&&cands.length<free.length+2;i++){
      const u=pics[i],n=`photo ${i+1}`,k=ukey(u);
      if(seenKeys.has(k)){skip.push(`${n} (same as ${seenKeys.get(k)})`);continue;}
      seenKeys.set(k,n);
      let im;try{im=await loadPic(u);}catch(e){skip.push(`${n} (${e.message})`);continue;}
      if(Math.max(im.naturalWidth,im.naturalHeight)<300){skip.push(`${n} (too small)`);continue;}
      const ring=T.analyze(im);
      if(!ring){skip.push(`${n} (store blocks processing)`);continue;}
      if(ring.kind==='colour'){skip.push(`${n} (has its own background)`);continue;}
      let r;try{r=T.autoFit(im);}catch(e){skip.push(`${n} (${e.message})`);continue;}
      const sg=sig(r.canvas);let best=null;for(const x of seenSigs){const d=dist(x.s,sg);if(!best||d<best.d)best={d,n:x.n};}
      if(best&&best.d<NEAR){skip.push(`${n} (same picture as ${best.n})`);continue;}
      if(best)gaps.push(`${n} vs ${best.n}: ${best.d.toFixed(1)}`);
      seenSigs.push({s:sg,n});
      let cv=r.canvas,blob=await toBlob(cv);
      while(blob&&blob.size>4.6*1024*1024&&cv.width>600){const nc=document.createElement('canvas');nc.width=Math.round(cv.width*.8);nc.height=Math.round(cv.height*.8);nc.getContext('2d').drawImage(cv,0,0,nc.width,nc.height);cv=nc;blob=await toBlob(cv);}
      if(!blob||blob.size>4.9*1024*1024){skip.push(`${n} (too large)`);continue;}
      cands.push({blob,u,n,busy:busyOf(cv)});
    }
    cands.sort((x,y)=>x.busy-y.busy);
    for(const c of cands){
      if(!free.length)break;
      const {blob,u,n}=c;
      const sl=free.shift(),fi=f.elements[`site_${sl}_file`];
      const dt=new DataTransfer();dt.items.add(new File([blob],`store-${sl}-fit.png`,{type:'image/png'}));fi.files=dt.files;
      // remember which store photo this was (saved as the slot "source"), so the site gallery does not show it twice
      const src=f.elements[`site_${sl}_source`];
      if(src){const o=document.createElement('option');o.value=u;o.dataset.source='store:'+u;o.textContent='Store photo (auto-fitted)';src.appendChild(o);o.selected=true;}
      fi.dispatchEvent(new Event('input',{bubbles:true}));fi.dispatchEvent(new Event('change',{bubbles:true}));
      try{if(typeof updateSiteImagePreview==='function')updateSiteImagePreview(sl);}catch(_){}
      const art=document.querySelector(`.site-image-slot[data-site-slot="${sl}"] .af-row small`);if(art)art.textContent='Auto-fitted store photo is ready. It uploads when you save the product.';
      used.push({slot:sl,label:SLOT_LABEL[sl],url:u});
    }
    if(used.length&&f.elements.site_image_mode){f.elements.site_image_mode.value='curated';f.elements.site_image_mode.dispatchEvent(new Event('change',{bubbles:true}));}
    return {used,skip,gaps,full:false};
  }
  /* ---- 6) v265 Step 0.5: "Save to PricePulse" pending pages -> Check -> Save & Confirm (needs SQL v6) ---- */
  const NEED_V6='Run supabase-ext-v6-pending.sql in Supabase first.';
  let pendList=[],pend=null,lastCheck=null,confirmIntent=null,ourClick=false,affCfg=null;
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const ageH=t=>t?(Date.now()-Date.parse(t))/3600e3:Infinity;
  const agoTxt=t=>{const h=ageH(t);return !isFinite(h)?'never':h<1?Math.max(1,Math.round(h*60))+' min ago':h<48?Math.round(h)+'h ago':Math.round(h/24)+' days ago';};
  const words=s=>new Set(String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>1));
  function agree(a,b){const A=words(a),B=words(b);if(!A.size||!B.size)return true;let n=0;A.forEach(w=>{if(B.has(w))n++;});return n/Math.min(A.size,B.size)>=0.6;}
  const prodList=()=>typeof products!=='undefined'&&Array.isArray(products)?products:[];
  function dupesFor(r){
    const t=(r.details&&r.details.title)||r.title||'',tv=variantFromTitle(t),tS=sizesIn(t);
    const id=identityFromName(shortName(t),r.details&&r.details.fields&&r.details.fields.brand);
    return prodList().filter(p=>{
      if(!(norm(p.identityKey)&&(norm(p.identityKey)===norm(id)||norm(t).includes(norm(p.identityKey))&&norm(p.identityKey).length>=5)))return false;
      const pS=sizesIn(`${p.name} ${p.variant}`);
      return !tS.length||!pS.length||tS.every(x=>pS.includes(x));   // same storage (or unknown)
    }).slice(0,2);
  }
  function installPending(){
    const host=$('ppGrowthAdmin'),a=$('ppExtAdmin');if(!host||!a)return false;if($('ppExtPending'))return true;
    const c=card('ppExtPending','Extension: new products','Pages you saved with <b>Save to PricePulse</b> in the extension (Admin mode), or with <b>Fill</b> in Add Product. They are <b>not on the site</b> until you press <b>Review</b> → <b>Check</b> → <b>Save &amp; Confirm</b>.','🆕 PENDING',
      `<div class="pp-dl-tools"><button type="button" id="ppXpReload" class="subtle">Refresh</button><span id="ppXpCount" class="muted"></span></div><p id="ppXpMsg" class="muted" role="status"></p><div id="ppXpList" class="pp-deals-list"></div>`);
    a.before(c);
    $('ppXpReload').addEventListener('click',loadPending);
    $('ppXpList').addEventListener('click',onPendingListClick);
    if(!$('ppXpStyle')){const st=document.createElement('style');st.id='ppXpStyle';st.textContent=`.pp-xp-img{width:56px;height:56px;object-fit:contain;background:#fff;border:1px solid #e3ece8;border-radius:10px}.pp-xp-box{margin-top:10px;padding:10px;border:1px solid #dce9e4;border-radius:12px;background:#fff}.pp-xp-box h4{margin:0 0 6px;font-size:14px}.pp-xp-rep{list-style:none;padding:0;margin:8px 0;display:grid;gap:4px}.pp-xp-rep li{font-size:12.5px;padding:5px 9px;border-radius:8px}.pp-xp-rep .ok{background:#e3f5ec;color:#13573c}.pp-xp-rep .warn{background:#fff3d6;color:#6b4f0f}.pp-xp-rep .bad{background:#fde8e8;color:#8f1a1a;font-weight:700}.pp-xp-act{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.pp-xp-act input[type=url]{flex:1 1 240px}.pp-xp-act button[disabled]{opacity:.45;cursor:not-allowed}`;document.head.appendChild(st);}
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(loadPending,0));
    [900,2600,6200].forEach(t=>setTimeout(loadPending,t));
    return true;
  }
  async function loadPending(){
    if(!ready())return;
    const {data,error}=await api.rpc('pp_ext_pending_list');
    if(error){setMsg('ppXpMsg',sqlMissing(error)?NEED_V6:error.message,true);return;}
    pendList=data&&data.ok&&Array.isArray(data.rows)?data.rows:[];setMsg('ppXpMsg','');renderPending();
  }
  function renderPending(){
    const list=$('ppXpList');if(!list)return;
    $('ppXpCount').textContent=pendList.length?`${pendList.length} waiting`:'';
    list.innerHTML=pendList.length?pendList.map(r=>{
      const img=r.image_url||((r.details&&r.details.images)||[])[0]||'',d=dupesFor(r);
      const price=r.price?`${inr(r.price)}${r.mrp?` <s class="muted">${inr(r.mrp)}</s>`:''} · seen ${h(agoTxt(r.price_seen_at))}${r.in_stock?'':' · out of stock'}`:'no price';
      return `<article class="pp-deals-row pp-x-row" data-xp-id="${h(r.id)}">${img?`<img class="pp-xp-img" src="${h(img)}" alt="" referrerpolicy="no-referrer" loading="lazy">`:''}<div style="flex:1 1 280px;min-width:0"><h3>${h(r.title||r.product_key)} · ${h(r.store_name||r.store)}</h3><p class="pp-x-sub">${price} · ${r.details?`${h(r.details.spec_count)} spec rows`:'no details yet'} · saved ${h(agoTxt(r.updated_at))}${r.source==='admin'?' (from Fill)':''}</p>${d.length?`<p class="pp-x-sub">Looks like: ${d.map(p=>`<b>${h(p.name)}</b>${p.variant?' ('+h(p.variant)+')':''}`).join(', ')}</p>`:''}</div>
        <div class="pp-x-act">${d.map(p=>`<button type="button" data-xp-to="${h(p.id)}">Add to ${h(p.name.slice(0,28))}</button>`).join('')}<button type="button" data-xp-review>${d.length?'Review as new':'Review'}</button><a href="${h(r.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a><button type="button" class="subtle" data-xp-reject>Reject</button></div></article>`;}).join('')
      :'<div class="pp-deals-row"><div><h3>Nothing waiting</h3><p>On a store page not yet on PricePulse, open the extension card (Admin mode on) and press <b>Save to PricePulse</b>.</p></div></div>';
  }
  async function onPendingListClick(e){
    const row=e.target.closest('[data-xp-id]');if(!row)return;const r=pendList.find(x=>String(x.id)===row.dataset.xpId);if(!r)return;
    if(e.target.closest('[data-xp-reject]')){
      if(!confirm('Reject this page? It leaves the list and nothing goes on the site.'))return;
      const {data,error}=await api.rpc('pp_ext_pending_reject',{p_id:r.id});
      if(error||!data||!data.ok){setMsg('ppXpMsg',error?error.message:'Not done.',true);return;}
      setMsg('ppXpMsg','Rejected.');loadPending();return;
    }
    const to=e.target.closest('[data-xp-to]');
    if(to||e.target.closest('[data-xp-review]'))openReview(r,to?to.dataset.xpTo:'');
  }
  async function openReview(r,productId){
    if(productId){if(typeof editSelectedProduct!=='function')return;selectedId=productId;editSelectedProduct();}
    else{if(typeof newProduct!=='function')return;newProduct();}
    await new Promise(res=>setTimeout(res,50));
    $('ppXfUrl').value=r.url;pend=r;
    await fillFromLink();
    renderBox();
  }
  async function fillThenPending(){
    await fillFromLink();
    const url=($('ppXfUrl').value||'').trim();
    if(!/^https:\/\//i.test(url)||!ready())return;
    if(pend&&url.includes(pend.product_key))return renderBox();
    const {data,error}=await api.rpc('pp_ext_pending_from_url',{p_url:url});
    const pb=$('ppXpBox');
    if(error){pb.hidden=false;pb.innerHTML=`<div class="pp-xp-box"><p class="fine">${h(sqlMissing(error)?NEED_V6:error.message)}</p></div>`;return;}
    if(data&&data.status==='exists'){pend=null;pb.hidden=false;pb.innerHTML=`<div class="pp-xp-box"><p class="fine">This store page is already linked to <b>${h(data.product_name||data.product_id)}</b>.</p></div>`;return;}
    if(!data||data.status!=='pending'){pend=null;pb.hidden=true;return;}
    await loadPending();pend=pendList.find(x=>x.id===data.id)||null;renderBox();
  }
  // v272 (Fix 5b): other stores the extension compared for this product (pend.live, needs v8 SQL for url).
  // Exact match + same RAM/storage = ticked. Similar / other variant = shown, not ticked. Their price is NOT verified.
  function othersList(){
    if(!pend)return [];
    const f=$('productForm'),vS=[...new Set(sizesIn(f&&f.elements.variant?f.elements.variant.value:''))],best=new Map();
    (pend.live||[]).forEach(x=>{
      if(!x||!x.store||x.store===pend.store||!/^https:\/\//.test(x.url||''))return;
      const o=best.get(x.store);
      if(!o||(x.match==='exact'&&o.match!=='exact')||(x.match===o.match&&Number(x.price)<Number(o.price)))best.set(x.store,x);
    });
    return [...best.values()].map(x=>{
      const s=sizesIn(`${x.variant||''} ${x.title||''}`),off=!!s.length&&!!vS.length&&!vS.every(y=>s.includes(y));
      return {...x,off,tick:x.match==='exact'&&!off};
    });
  }
  function othersBox(){
    const L=othersList(),nm=sl=>((typeof stores!=='undefined'&&Array.isArray(stores)?stores:[]).find(s=>s&&s.slug===sl)||{}).name||sl;
    if(!L.length)return '<div class="pp-xp-oth" style="margin:10px 0"><p class="fine"><b>Other stores found:</b> none yet. Open this store page with the extension ON, wait until "Checking other stores" is finished, then press Refresh. You can confirm without them.</p></div>';
    return '<div class="pp-xp-oth" style="margin:10px 0"><p class="fine"><b>Other stores found</b> (ticked = same product and variant). Ticked links are added on Confirm; their price is NOT verified.</p>'+L.map((x,i)=>`<label class="pp-x-chk fine" style="display:block"><input type="checkbox" data-xo="${i}" data-xo-store="${h(x.store)}" data-xo-url="${h(x.url)}" data-xo-title="${h(String(x.title||'').slice(0,300))}"${x.tick?' checked':''}> <b>${h(nm(x.store))}</b> ${inr(x.price)} · ${h(String(x.title||'').slice(0,70))}${x.match==='exact'?'':' · <i>similar, not exact</i>'}${x.off?' · <i>different variant</i>':''} · <a href="${h(x.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a></label>`).join('')+'</div>';
  }
  function renderBox(){
    const pb=$('ppXpBox');if(!pb)return;if(!pend){pb.hidden=true;return;}
    pb.hidden=false;lastCheck=null;
    pb.innerHTML=`<div class="pp-xp-box"><h4>Store link waiting for Confirm: ${h(pend.store_name||pend.store)} · ${pend.price?inr(pend.price):'no price'} · seen ${h(agoTxt(pend.price_seen_at))}</h4>
      <p class="fine">Code <b>${h(pend.product_key)}</b> · <a href="${h(pend.url)}" target="_blank" rel="noopener noreferrer">Open store page ↗</a>. Fix the fields above, then press <b>Check</b>.</p>
      <div class="pp-xp-act"><button type="button" data-xp="check">Check</button><span class="fine" id="ppXpState"></span></div>
      <ul class="pp-xp-rep" id="ppXpRep"></ul>${othersBox()}
      <label class="pp-x-chk fine"><input type="checkbox" id="ppXpAck"> I compared <b>Variant</b> and <b>Model</b> with the store page (RAM / storage / colour).</label>
      <div class="pp-xp-act"><input type="url" id="ppXpAff" placeholder="Affiliate link for this page (optional, e.g. EarnKaro / fktr.in)"><button type="button" data-xp="confirm" id="ppXpGo" disabled>Save &amp; Confirm</button></div></div>`;
  }
  function formSig(){const f=$('productForm');return ['editing_id','name','brand_slug','category','identity_key','model_code','variant','product_id'].map(n=>f.elements[n]?.value||'').join('|');}
  async function runCheck(){
    const f=$('productForm');if(!f||!pend)return;
    if(!affCfg){try{const {data}=await api.rpc('pp_public_settings');affCfg=(data&&data.affiliate)||{};}catch(_){affCfg={};}}
    const L=[],ok=t=>L.push(['ok',t]),warn=t=>L.push(['warn',t]),bad=t=>L.push(['bad',t]);
    const v=n=>String(f.elements[n]?.value||'').trim();
    const name=v('name'),variant=v('variant'),editing=v('editing_id'),det=pend.details||null;
    const T=pend.title||(det&&det.title)||'',fields=(det&&det.fields)||{};
    // 1) variant vs store title / name
    const tS=[...new Set(sizesIn(T))],vS=[...new Set(sizesIn(variant))],nS=[...new Set(sizesIn(name))];
    tS.filter(x=>!vS.includes(x)).forEach(x=>bad(`Store title says ${x}, Variant does not.`));
    if(tS.length)vS.filter(x=>!tS.includes(x)&&x!==lastSpec.ram&&x!==lastSpec.storage).forEach(x=>bad(`Variant says ${x}, the store title and spec rows do not.`));
    nS.filter(x=>!vS.includes(x)&&!tS.includes(x)).forEach(x=>bad(`Name says ${x}, Variant / store title do not.`));
    if(!tS.length&&!vS.length&&/mobile|laptop|tablet/i.test(v('category')))warn('No RAM / storage in Variant (check the store page).');
    if(tS.length&&tS.every(x=>vS.includes(x)))ok(`Storage / RAM match the store title (${tS.join(', ')}).`);
    const col=fields.color||variantFromTitle(T).color;
    if(col){if(norm(variant).includes(norm(col)))ok(`Colour ${col} is in Variant.`);else warn(`Store page colour "${col}" is not in Variant.`);}
    // 2) required fields
    [['name','Name'],['brand_slug','Brand'],['category','Category'],['identity_key','Identity key']].forEach(([n,l])=>{if(!v(n))bad(`${l} is empty.`);});
    if(!v('model_code'))warn('Model / SKU is empty.');
    // v266: RAM / storage from the store's spec rows must be in Variant; identity key must name the model
    if(lastSpec.ram&&!vS.includes(lastSpec.ram))bad(`Store spec rows say RAM ${lastSpec.ram}, Variant does not.`);
    if(lastSpec.storage&&!vS.includes(lastSpec.storage))bad(`Store spec rows say storage ${lastSpec.storage}, Variant does not.`);
    const ik=v('identity_key');
    if(ik&&!/\d/.test(ik)&&ik.split(/\s+/).length<2)warn(`Identity key "${ik}" is very general: add the model name or number so other models are not mixed in.`);
    warn('Open "Global Live Preview" below: Image 1 must show the phone / product itself, not a banner.');
    if(fields.brand&&v('brand_slug')&&norm(fields.brand)!==norm(v('brand_slug'))&&!norm(f.elements.brand_slug.selectedOptions?.[0]?.textContent).includes(norm(fields.brand)))bad(`Store says brand "${fields.brand}", form has another brand.`);
    // 3) duplicates
    if(!editing){
      const id=typeof slugify==='function'?slugify(v('product_id')||name):'';
      const same=prodList().filter(p=>p.id===id||(norm(p.identityKey)===norm(v('identity_key'))&&norm(p.variant)===norm(variant))||norm(p.name)===norm(name));
      if(same.length)bad(`Already in the catalog: ${same.map(p=>p.name).join(', ')}. Close this and use "Add to …" in the pending list.`);else ok('Not a duplicate of a catalog product.');
    }else{
      const cur=prodList().find(p=>p.id===editing),st=cur&&(cur.stores||[]).find(s=>s.slug===pend.store);
      if(st&&st.url&&!String(st.directUrl||st.url).includes(pend.product_key))warn(`This replaces the product's current ${pend.store_name||pend.store} link.`);
    }
    // 4) store link
    if(pend.linked_product&&pend.linked_product!==editing)bad(`This store page is already linked to ${pend.linked_product}.`);
    else if(String(pend.url).includes(pend.product_key))ok(`Store link has the product code ${pend.product_key}; full address saved.`);
    // 5) price
    if(!pend.price)bad('No price was saved for this page.');
    else{
      if(ageH(pend.price_seen_at)>23)warn(`Price is ${agoTxt(pend.price_seen_at)}: it will not be saved as verified. After Confirm, open the page once with Admin mode on.`);else ok(`Price ${inr(pend.price)} seen ${agoTxt(pend.price_seen_at)}: saved as verified on Confirm.`);
      if(!pend.in_stock)warn('Out of stock on the store page.');
      if(pend.mrp&&pend.price>pend.mrp)warn('Price is higher than MRP.');
      if(pend.mrp&&pend.price<pend.mrp*0.1)bad('Price is less than 10% of MRP: looks wrong.');
    }
    // 6) photos + stale data
    const pics=['primary','secondary','tertiary'].filter(sl=>v(`site_${sl}_url`)||f.elements[`site_${sl}_file`]?.files?.length).length+(v('image_url')?1:0);
    if(!pics)bad('No photo.');else ok(`${pics} photo${pics>1?'s':''} set.`);
    if(!det)warn('No details saved by the extension for this page.');
    else if(!agree(det.title,pend.title))bad('Saved details belong to another product (old page data). Open the store page again, then Refresh.');
    // 7) specs
    if(det){if(det.spec_count>0)ok(`${det.spec_count} spec rows saved.`);else warn('No spec rows saved.');if(det.has_changes)warn('Details have changes waiting in "Extension: product details".');}
    // 8) live compare
    const live=(pend.live||[]).filter(x=>x.match==='exact');
    if(!live.length)warn('No other store compared yet (open the store page with the extension and wait for the compare).');
    else{
      const off=live.filter(x=>{const s=sizesIn(`${x.variant||''} ${x.title||''}`);return s.length&&vS.length&&!vS.every(y=>s.includes(y));});
      off.forEach(x=>warn(`${x.store} matched a different variant: ${x.variant||x.title}.`));
      if(!off.length)ok(`${live.length} other store${live.length>1?'s':''} matched this variant.`);
    }
    // 9) affiliate
    const aff=($('ppXpAff')?.value||'').trim(),sn=pend.store_name||'';
    if(aff)ok('Affiliate link added.');
    else if(pend.store==='amazon'&&affCfg.amazon_tag!=='')ok('Amazon: tracking tag is added on the site.');
    else if(/[?&](affid|affExtParam1|tag)=/.test(pend.url))ok('Store link already has affiliate tracking.');
    else if(pend.aff_template)ok('Store affiliate template is set.');
    else if(affCfg.cuelinks_enabled&&(!Array.isArray(affCfg.cuelinks_stores)||affCfg.cuelinks_stores.includes(sn)))ok('Cuelinks wraps this store on the site.');
    else warn('No affiliate link: shoppers get a plain link (no commission). Paste one below if you have it.');
    lastCheck={items:L,sig:formSig()};paintCheck();
  }
  function paintCheck(){
    const rep=$('ppXpRep'),go=$('ppXpGo'),stx=$('ppXpState');if(!rep||!go)return;
    if(!lastCheck){rep.innerHTML='';go.disabled=true;return;}
    const icon={ok:'✓',warn:'!',bad:'✕'},L=lastCheck.items,nb=L.filter(x=>x[0]==='bad').length,nw=L.filter(x=>x[0]==='warn').length;
    rep.innerHTML=L.slice().sort((a,b)=>({bad:0,warn:1,ok:2})[a[0]]-({bad:0,warn:1,ok:2})[b[0]]).map(([k,t])=>`<li class="${k}">${icon[k]} ${h(t)}</li>`).join('');
    const changed=lastCheck.sig!==formSig(),ack=$('ppXpAck')?.checked;
    go.disabled=!!(nb||changed||!ack);
    stx.textContent=changed?'Fields changed: press Check again.':nb?`${nb} problem${nb>1?'s':''} to fix`:`${nw} to look at`+(ack?'':' · tick the box below');
    stx.style.color=nb||changed?'#a33':'#64756e';
  }
  function onPendingBoxClick(e){
    const b=e.target.closest('[data-xp]');if(!b)return;
    if(b.dataset.xp==='check'){b.disabled=true;runCheck().finally(()=>{b.disabled=false;});return;}
    if(b.dataset.xp==='confirm'){
      paintCheck();if(b.disabled||!pend)return;
      const f=$('productForm');
      confirmIntent={id:pend.id,aff:($('ppXpAff').value||'').trim(),name:f.elements.name.value.trim(),store:pend.store_name||pend.store,others:[...document.querySelectorAll('#ppXpBox [data-xo]:checked')].map(c=>({store:c.dataset.xoStore,url:c.dataset.xoUrl,title:c.dataset.xoTitle||null}))};
      ourClick=true;f.requestSubmit($('saveProduct'));
    }
  }
  function onFormSubmit(e){
    if(!ourClick){confirmIntent=null;return;}
    ourClick=false;if(!confirmIntent)return;
    const it=confirmIntent;const sm=$('saveMsg');if(sm)sm.textContent='';
    const t0=Date.now(),re=new RegExp('^'+it.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' (added|updated) successfully');
    const iv2=setInterval(async()=>{
      if(Date.now()-t0>90000){clearInterval(iv2);return;}
      if(!re.test(($('saveMsg')?.textContent)||''))return;
      clearInterval(iv2);if(confirmIntent!==it)return;confirmIntent=null;
      const pid=selectedId;
      const {data,error}=await api.rpc('pp_ext_pending_confirm',{p_id:it.id,p_product_id:pid,p_affiliate_url:it.aff||null});
      if(error||!data||!data.ok){msg('saveMsg',`Product saved, but the ${it.store} link was NOT confirmed: ${error?error.message:(data&&data.error)||'unknown'}. It is still in "Extension: new products".`,true);loadPending();return;}
      let note=`${it.name} saved and the ${it.store} link confirmed.${data.price_saved?` Verified price ${inr(data.price)} is live.`:' No fresh price: open the store page once with Admin mode on.'}${data.replaced_url?' The old store link was replaced.':''}`,noteBad=false;
      if(it.others&&it.others.length){
        const r2=await api.rpc('pp_ext_pending_confirm_others',{p_id:it.id,p_product_id:pid,p_rows:it.others}),d2=r2.data;
        if(r2.error||!d2||!d2.ok){noteBad=true;note+=` Other stores were NOT added: ${r2.error?(sqlMissing(r2.error)?'run the v9 SQL in Supabase first':r2.error.message):(d2&&d2.error)||'unknown'}.`;}
        else{
          const ad=d2.added||[],sk=d2.skipped||[];
          if(ad.length)note+=` Other store links added (price not verified): ${ad.join(', ')}.`;
          if(sk.length){noteBad=true;note+=` Not added: ${sk.map(s=>`${s.store} (${s.reason})`).join(', ')}.`;}
        }
      }
      msg('saveMsg',note,noteBad);
      try{if(typeof refreshAll==='function')await refreshAll();}catch(_){}
      loadPending();
    },400);
  }
  let ptries=0;const piv=setInterval(()=>{if(installPending()||++ptries>60)clearInterval(piv);},300);

  let ftries=0;const fiv=setInterval(()=>{if(installFill()||++ftries>40)clearInterval(fiv);},300);

  let tries=0;const iv=setInterval(()=>{if(install()||++tries>40)clearInterval(iv);},250);
})();
