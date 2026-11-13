/* PricePulse AI-1 — Admin > Growth: "AI link compare" (needs supabase-ai-link-v1.sql + Edge Function ai-link-compare).
   Shows this month's AI spend, last links, settings (on/off, provider, models, budget, limits) and a test box. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof api!=='undefined'&&api;
  const rs=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
  const t=d=>{try{return new Date(d).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch(_){return '';}};
  const msg=(id,text,bad)=>{const el=$(id);if(el){el.textContent=text||'';el.style.color=bad?'#a33':'#64756e';}};
  const notRun=e=>/does not exist|Could not find/i.test(String(e&&e.message||e));
  let S=null;

  function install(){
    const host=$('ppGrowthAdmin');if(!host)return false;if($('ppAiAdmin'))return true;
    const w=document.createElement('section');w.id='ppAiAdmin';w.className='pp-deals-admin-card pp-growth-card';
    w.innerHTML=`<div class="pp-deals-admin-head"><div><h2>AI link compare</h2><p class="muted">Price Check page: AI finds the same product on other stores, our server reads each store page for the price. AI prices are never shown. Over the monthly budget the site shows normal search links only.</p></div><span class="pp-deals-admin-badge">🤖 AI</span></div>
      <div id="ppAiStats" class="pp-ai-stats"></div>
      <form id="ppAiForm" class="pp-so-form" autocomplete="off">
        <label>AI on<select name="enabled"><option value="true">On</option><option value="false">Off</option></select></label>
        <label>Main finder<select name="provider"><option value="claude">Claude</option><option value="gemini">Gemini</option></select></label>
        <label>Backup<select name="backup_provider"><option value="gemini">Gemini</option><option value="claude">Claude</option><option value="">Off</option></select></label>
        <label>Claude model<input name="model" maxlength="60"></label>
        <label>Claude bigger model<input name="fallback_model" maxlength="60" placeholder="empty = off"></label>
        <label>Gemini model<input name="gemini_model" maxlength="60"></label>
        <label>Searches per link<input name="max_searches" type="number" min="1" max="8"></label>
        <label>Cache hours<input name="cache_hours" type="number" min="1" max="168"></label>
        <label>Monthly budget ₹<input name="monthly_budget_inr" type="number" min="0" step="100"></label>
        <label>Links per visitor / day<input name="per_ip_daily" type="number" min="1" max="500"></label>
        <label>1 USD in ₹<input name="usd_inr" type="number" min="1" step="0.5"></label>
        <div class="pp-so-act"><button type="submit">Save settings</button><button type="button" class="subtle" id="ppAiClear">Clear cache</button><button type="button" class="subtle" id="ppAiReload">Refresh</button></div>
      </form><p id="ppAiMsg" class="muted" role="status"></p>
      <form id="ppAiTest" class="pp-so-form" autocomplete="off">
        <label class="wide">Test a link (costs like a normal search, not saved in cache)<input name="url" maxlength="1500" placeholder="https://www.flipkart.com/..."></label>
        <label>Category<select name="cat"><option value="">Auto</option><option value="mobiles">Mobiles</option><option value="laptops">Laptops</option><option value="electronics">Electronics</option><option value="appliances">Appliances</option><option value="fashion">Fashion</option><option value="beauty">Beauty</option><option value="home">Home</option></select></label>
        <div class="pp-so-act"><button type="submit" id="ppAiTestBtn">Run test</button></div>
      </form><div id="ppAiTestOut"></div>
      <h3 class="pp-ai-h3">Last links</h3><div id="ppAiList" class="pp-ai-list"></div>`;
    const st=document.createElement('style');
    st.textContent=`.pp-ai-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0}.pp-ai-stats div{border:1px solid #e3ebe7;border-radius:10px;padding:8px 10px;background:#fbfdfc}.pp-ai-stats b{display:block;font-size:18px}.pp-ai-stats small{color:#64756e}.pp-ai-bar{height:6px;border-radius:9px;background:#e8efeb;margin-top:6px;overflow:hidden}.pp-ai-bar i{display:block;height:100%;background:#1f7a55}.pp-ai-bar i.hot{background:#c2410c}.pp-ai-h3{margin:14px 0 6px;font-size:15px}.pp-ai-list{overflow-x:auto}.pp-ai-list table,#ppAiTestOut table{width:100%;border-collapse:collapse;font-size:12.5px}.pp-ai-list td,.pp-ai-list th,#ppAiTestOut td,#ppAiTestOut th{border-bottom:1px solid #edf2ef;padding:5px 6px;text-align:left;vertical-align:top}.pp-ai-list .bad{color:#a33}.pp-ai-url{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}#ppAiTestOut{margin:6px 0 4px}#ppAiTestOut pre{white-space:pre-wrap;font-size:11.5px;background:#f6f8f7;padding:8px;border-radius:8px;max-height:220px;overflow:auto}`;
    w.appendChild(st);
    const anchor=$('ppCardRewards')||$('ppStoreOffers');if(anchor)anchor.after(w);else host.prepend(w);
    $('ppAiForm').addEventListener('submit',save);
    $('ppAiReload').addEventListener('click',load);
    $('ppAiClear').addEventListener('click',clearCache);
    $('ppAiTest').addEventListener('submit',runTest);
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(load,0));
    [900,2500,6000].forEach(x=>setTimeout(load,x));
    return true;
  }

  async function load(){
    if(!ready()||!$('ppAiStats'))return;
    const {data,error}=await api.rpc('pp_ai_admin_summary');
    if(error){msg('ppAiMsg',notRun(error)?'Run supabase-ai-link-v1.sql first.':error.message,true);return;}
    if(!data?.ok){msg('ppAiMsg','Admin only.',true);return;}
    S=data.settings||{};
    const f=$('ppAiForm');
    ['enabled','provider','backup_provider','model','fallback_model','gemini_model','max_searches','cache_hours','monthly_budget_inr','per_ip_daily','usd_inr'].forEach(k=>{if(f.elements[k]&&document.activeElement!==f.elements[k])f.elements[k].value=S[k]==null?'':String(S[k]);});
    const m=data.month||{},d=data.today||{},cap=Number(S.monthly_budget_inr||0),pct=cap?Math.min(100,Math.round(Number(m.rs||0)/cap*100)):0;
    const per=m.links?Number(m.rs||0)/m.links:0;
    $('ppAiStats').innerHTML=`<div><small>This month</small><b>${rs(m.rs)}</b><small>of ${rs(cap)} budget</small><div class="pp-ai-bar"><i class="${pct>=80?'hot':''}" style="width:${pct}%"></i></div></div>
      <div><small>Links this month</small><b>${m.links||0}</b><small>${m.ok||0} worked · ${m.searches||0} searches</small></div>
      <div><small>Today</small><b>${d.links||0} links</b><small>${rs(d.rs)}</small></div>
      <div><small>Cost per new link</small><b>${rs(per)}</b><small>${S.enabled===false?'AI is OFF':'AI is on'} · ${h(S.provider||'claude')}</small></div>
      <div><small>Stores with a price</small><b>${m.priced_rows||0} / ${m.rows||0}</b><small>rows read from store pages</small></div>
      <div><small>Links in cache</small><b>${data.cache||0}</b><small>re-used free for ${S.cache_hours||12} h</small></div>`;
    const last=data.last||[];
    $('ppAiList').innerHTML=last.length?`<table><thead><tr><th>Time</th><th>Kind</th><th>Model</th><th>Link</th><th>Stores</th><th>Priced</th><th>₹</th><th>Note</th></tr></thead><tbody>${last.map(r=>`<tr class="${r.ok?'':'bad'}"><td>${h(t(r.created_at))}</td><td>${h(r.kind||'compare')}</td><td>${h(String(r.model||'').replace(/^claude-|^gemini-/,''))}</td><td><a class="pp-ai-url" href="${h(r.url)}" target="_blank" rel="noopener" title="${h(r.url)}">${h(r.url)}</a></td><td>${r.rows||0}</td><td>${r.priced||0}</td><td>${Number(r.cost_inr||0).toFixed(2)}</td><td><small>${h(noteText(r.note))}</small></td></tr>`).join('')}</tbody></table>`:'<p class="muted">No AI links yet.</p>';
    msg('ppAiMsg','');
  }
  function noteText(n){
    if(!n)return '';
    try{const a=JSON.parse(n);if(Array.isArray(a))return a.map(x=>`${String(x.url||'').replace(/^https?:\/\/(www\.)?/,'').split('/')[0]}: ${x.why}`).join(' · ').slice(0,220);}catch(_){}
    return String(n).slice(0,220);
  }
  async function save(e){
    e.preventDefault();if(!ready())return;
    const d=Object.fromEntries(new FormData(e.target).entries());
    const p={...d,enabled:d.enabled==='true'};
    ['max_searches','cache_hours','per_ip_daily'].forEach(k=>{p[k]=d[k]===''?null:parseInt(d[k],10);});
    ['monthly_budget_inr','usd_inr'].forEach(k=>{p[k]=d[k]===''?null:Number(d[k]);});
    const {data,error}=await api.rpc('pp_ai_settings_save',{p});
    if(error||!data?.ok){msg('ppAiMsg',error?(notRun(error)?'Run supabase-ai-link-v1.sql first.':error.message):data?.error||'Not saved',true);return;}
    msg('ppAiMsg','Saved.');load();
  }
  async function clearCache(){
    if(!ready()||!confirm('Clear all saved AI results? The next visit of each link runs the AI again (costs money).'))return;
    const {data,error}=await api.rpc('pp_ai_cache_clear',{p_key:null});
    msg('ppAiMsg',error?error.message:`Cleared ${data?.deleted||0} links.`,!!error);load();
  }
  async function runTest(e){
    e.preventDefault();if(!ready())return;
    const d=Object.fromEntries(new FormData(e.target).entries());
    if(!/^https?:\/\//i.test(d.url||'')){$('ppAiTestOut').innerHTML='<p class="muted">Paste a full product link.</p>';return;}
    const b=$('ppAiTestBtn');b.disabled=true;b.textContent='Running… (up to 60 s)';
    $('ppAiTestOut').innerHTML='';
    let r;
    try{r=await api.functions.invoke('ai-link-compare',{body:{url:d.url,cat:d.cat,dry:true}});}catch(err){r={error:err};}
    b.disabled=false;b.textContent='Run test';
    const res=r.data||{},err=r.error;
    if(err||!res.ok){$('ppAiTestOut').innerHTML=`<p class="muted" style="color:#a33">Failed: ${h(err?(err.message||err):res.error||'no answer')}${/no api key/.test(res.error||'')?' — add ANTHROPIC_API_KEY in Supabase Secrets.':''}</p>`;load();return;}
    const p=res.product||{};
    $('ppAiTestOut').innerHTML=`<p><b>${h(p.title||'')}</b> · ${h([p.brand,p.variant].filter(Boolean).join(' · '))} · ${h((p.category||[]).join(', '))} · page price ${p.price!=null?rs(p.price):'—'} · ${h(res.provider||'')} · ${rs(res.cost_inr)} · ${(res.usages||[]).reduce((a,u)=>a+(u.searches||0),0)} searches</p>
      <table><thead><tr><th>Store</th><th>Price</th><th>MRP</th><th>Link</th></tr></thead><tbody>${(res.rows||[]).map(x=>`<tr><td>${h(x.store)}</td><td>${x.price!=null?rs(x.price):'not read'}</td><td>${x.mrp!=null?rs(x.mrp):''}</td><td><a class="pp-ai-url" href="${h(x.url)}" target="_blank" rel="noopener">${h(x.url)}</a></td></tr>`).join('')||'<tr><td colspan="4">No other store found.</td></tr>'}</tbody></table>
      ${(res.dropped||[]).length?`<p class="muted">Dropped: ${h(noteText(JSON.stringify(res.dropped)))}</p>`:''}`;
    load();
  }

  /* ---------- AI fill (B): "AI fill" button next to "Fill" in the Add / Edit Product dialog ----------
     Fills only EMPTY fields (name, model, identity key, variant, brand, category, photo) and shows specs + highlights to check.
     The admin still checks everything and presses Save. AI never fills a price. */
  function installFill(){
    const box=$('ppXfBox'),go=$('ppXfGo');if(!box||!go)return false;if($('ppAiFillGo'))return true;
    const b=document.createElement('button');b.type='button';b.id='ppAiFillGo';b.textContent='AI fill';b.title='Read the page / web with AI and fill empty fields';b.className='subtle';
    go.after(b);
    const o=document.createElement('div');o.id='ppAiFillOut';o.className='pp-ai-fill';box.appendChild(o);
    b.addEventListener('click',aiFill);
    $('productDialog')?.addEventListener('close',()=>{o.innerHTML='';});
    if(!$('ppAiFillStyle')){const st=document.createElement('style');st.id='ppAiFillStyle';st.textContent='.pp-ai-fill{margin-top:6px}.pp-ai-fill table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}.pp-ai-fill td{border-bottom:1px solid #efe6cc;padding:3px 5px;vertical-align:top}.pp-ai-fill td:first-child{color:#64756e;width:38%}.pp-ai-fill ul{margin:4px 0 0 18px;font-size:12px}.pp-ai-fill .note{font-size:12px;color:#64756e}';document.head.appendChild(st);}
    return true;
  }
  async function aiFill(){
    const f=$('productForm'),url=($('ppXfUrl')?.value||'').trim(),o=$('ppAiFillOut'),b=$('ppAiFillGo');
    const say=(t,bad)=>{o.innerHTML=`<p class="note"${bad?' style="color:#a33"':''}>${h(t)}</p>`;};
    if(!/^https:\/\//i.test(url)){say('Paste the full product address (starts with https://) in the box first.',true);return;}
    if(!ready()){say('Sign in with an admin account first.',true);return;}
    b.disabled=true;b.textContent='AI reading…';say('Reading the page with AI (10-40 s)…');
    let r;try{r=await api.functions.invoke('ai-link-compare',{body:{url,mode:'fill'}});}catch(e){r={error:e};}
    b.disabled=false;b.textContent='AI fill';
    const res=r.data||{};
    if(r.error||!res.ok){const e=String(r.error?.message||res.error||'no answer');say('AI fill failed: '+e+(/admin/.test(e)?' (sign in as admin)':/no api key/.test(e)?' (add ANTHROPIC_API_KEY or GEMINI_API_KEY in Supabase Secrets)':/budget/.test(e)?' (monthly AI budget used up)':''),true);return;}
    const d=res.fill||{},done=[],skipped=[];
    const put=(name,val,label)=>{const el=f.elements[name];if(!el||val==null||String(val).trim()==='')return;if(String(el.value||'').trim()){if(String(el.value).trim()!==String(val).trim())skipped.push(label);return;}el.value=String(val).trim();el.classList.add('pp-xf-filled');el.dispatchEvent(new Event('input',{bubbles:true}));done.push(label);};
    const pick=(name,want,label)=>{const sel=f.elements[name];if(!sel||!want||sel.dataset.ppUser==='1')return;const w=String(want).toLowerCase().replace(/[^a-z0-9]/g,'');const opt=[...sel.options].find(x=>x.value&&(x.value.toLowerCase().replace(/[^a-z0-9]/g,'')===w||x.textContent.toLowerCase().replace(/[^a-z0-9]/g,'')===w));if(!opt){skipped.push(label+' "'+want+'" (not in the list)');return;}if(sel.value===opt.value)return;sel.value=opt.value;sel.classList.add('pp-xf-filled');sel.dispatchEvent(new Event('change',{bubbles:true}));done.push(label);};
    put('name',d.name,'Name');put('model_code',d.model,'Model / SKU');put('variant',d.variant,'Variant');
    put('identity_key',[d.brand,d.model,d.variant].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80),'Identity key');
    if(d.image)put('image_url',d.image,'Photo');
    pick('brand_slug',d.brand,'Brand');pick('category',d.category,'Category');
    const specs=Object.entries(d.specs||{});
    o.innerHTML=`<p class="note">AI (${h(res.provider||'')}, from the ${h(res.source||'page')}, ${rs(res.cost_inr)}): ${done.length?'filled '+h(done.join(', ')):'nothing new to fill'}${skipped.length?' · kept yours: '+h(skipped.join(', ')):''}. Check every field before Save. Prices are never filled by AI.</p>
      ${d.mrp?`<p class="note">MRP on the page: ${rs(d.mrp)}</p>`:''}
      ${(d.highlights||[]).length?`<ul>${d.highlights.map(x=>`<li>${h(x)}</li>`).join('')}</ul>`:''}
      ${specs.length?`<details><summary class="note">Specs found (${specs.length})</summary><table>${specs.map(([k,v])=>`<tr><td>${h(k)}</td><td>${h(v)}</td></tr>`).join('')}</table></details>`:''}`;
  }

  /* ---------- AI read offer text (B): above the "Store offers" form ----------
     Paste a bank / coupon offer text -> AI splits it into offers -> "Use" fills the form. Numbers not written in the text are dropped.
     Admin checks and presses "Add offer" (nothing is saved by the AI). */
  let aiOffers=[];
  function installOffer(){
    const f=$('ppSoForm');if(!f)return false;if($('ppAiOffer'))return true;
    const box=document.createElement('div');box.id='ppAiOffer';box.className='pp-ai-offer';
    box.innerHTML=`<label>AI read offer text <span class="muted">(paste from the bank / store page, then check the form)</span><textarea id="ppAiOfferText" rows="3" maxlength="4000" placeholder="e.g. 10% Instant Discount up to ₹1,500 on HDFC Bank Credit Cards, min order ₹5,000. Valid till 30 Nov."></textarea></label><div class="pp-so-act"><button type="button" id="ppAiOfferGo" class="subtle">AI read</button></div><div id="ppAiOfferOut"></div>`;
    f.before(box);
    if(!$('ppAiOfferStyle')){const st=document.createElement('style');st.id='ppAiOfferStyle';st.textContent='.pp-ai-offer{padding:10px 12px;border:1px dashed #d7c38a;border-radius:12px;background:#fffaf0;margin:8px 0}.pp-ai-offer textarea{width:100%;box-sizing:border-box;font:inherit}.pp-ai-offer .row{display:flex;gap:8px;align-items:center;border-bottom:1px solid #efe6cc;padding:5px 0;font-size:12.5px}.pp-ai-offer .row span{flex:1}';document.head.appendChild(st);}
    $('ppAiOfferGo').addEventListener('click',readOffer);
    $('ppAiOfferOut').addEventListener('click',e=>{const b=e.target.closest('[data-use]');if(b)useOffer(aiOffers[Number(b.dataset.use)]);});
    return true;
  }
  async function readOffer(){
    const text=($('ppAiOfferText').value||'').trim(),o=$('ppAiOfferOut'),b=$('ppAiOfferGo');
    if(text.length<8){o.innerHTML='<p class="muted">Paste the offer text first.</p>';return;}
    if(!ready()){o.innerHTML='<p class="muted" style="color:#a33">Sign in with an admin account first.</p>';return;}
    b.disabled=true;b.textContent='AI reading…';o.innerHTML='';
    let r;try{r=await api.functions.invoke('ai-link-compare',{body:{mode:'offer',text}});}catch(e){r={error:e};}
    b.disabled=false;b.textContent='AI read';
    const res=r.data||{};
    if(r.error||!res.ok){o.innerHTML=`<p class="muted" style="color:#a33">AI read failed: ${h(r.error?.message||res.error||'no answer')}</p>`;return;}
    aiOffers=res.offers||[];
    if(!aiOffers.length){o.innerHTML='<p class="muted">No offer found in this text.</p>';return;}
    const line=x=>[x.pct?x.pct+'%':'',x.flat?'₹'+x.flat+' off':'',x.cap?'max ₹'+x.cap:'',x.min_order?'min ₹'+x.min_order:'',x.code?'code '+x.code:'',x.bank,x.valid_till?'till '+x.valid_till:'',x.store,x.category].filter(Boolean).join(' · ');
    o.innerHTML=`<p class="muted">AI found ${aiOffers.length} offer${aiOffers.length>1?'s':''} (${rs(res.cost_inr)}). Press Use, check the form, then Add offer.</p>`+aiOffers.map((x,i)=>`<div class="row"><span><b>${h(x.title||x.kind)}</b><br><small>${h(x.kind)} · ${h(line(x))}</small></span><button type="button" class="subtle" data-use="${i}">Use</button></div>`).join('');
    if(aiOffers.length===1)useOffer(aiOffers[0]);
  }
  function useOffer(x){
    const f=$('ppSoForm');if(!f||!x)return;
    const set=(n,v)=>{const el=f.elements[n];if(!el)return;if(el.tagName==='SELECT'){if(v==null||v===''||![...el.options].some(o=>o.value===v))return;el.value=v;}else el.value=v==null?'':String(v);el.classList.add('pp-xf-filled');};
    set('store',x.store);set('kind',x.kind);set('category',x.category||'');
    ['title','bank','code','pct','flat','cap','min_order','valid_till'].forEach(k=>set(k,x[k]));
    f.scrollIntoView({behavior:'smooth',block:'center'});
  }

  /* ---------- G: Instagram post / story maker (Admin > Growth) ----------
     Picks deals from OUR verified prices (lowest fresh published price vs 30-day average of daily lows), draws a
     1080x1350 post and a 1080x1920 story in the browser (PNG download), and writes a caption: a free plain one at once,
     or an AI one (facts only; a caption with any other ₹ amount is refused by the server). The admin posts by hand. */
  const IG={list:[],sel:null,img:null};
  function installIg(){
    const host=$('ppGrowthAdmin');if(!host||!$('ppAiAdmin'))return false;if($('ppIgAdmin'))return true;
    const w=document.createElement('section');w.id='ppIgAdmin';w.className='pp-deals-admin-card pp-growth-card';
    w.innerHTML=`<div class="pp-deals-admin-head"><div><h2>Instagram post maker</h2><p class="muted">Deals from verified prices only. Pick one, download the post / story picture, copy the caption, post it yourself. No MRP, no made-up discount.</p></div><span class="pp-deals-admin-badge">📸 SOCIAL</span></div>
      <div class="pp-so-act"><button type="button" id="ppIgLoad" class="subtle">Find today's deals</button><input id="ppIgFind" placeholder="or search any product name" style="flex:1;min-width:180px"></div>
      <div id="ppIgList" class="pp-ig-list"></div>
      <div class="pp-so-act"><button type="button" id="ppWaText" class="subtle">WhatsApp text (top 5)</button><button type="button" id="ppReel" class="subtle">Reel hooks (AI)</button></div>
      <div id="ppIgExtra" hidden><textarea id="ppIgExtraText" rows="9" style="width:100%;box-sizing:border-box;font:inherit"></textarea><div class="pp-so-act"><button type="button" id="ppIgExtraCopy">Copy</button></div><p id="ppIgExtraMsg" class="muted"></p></div>
      <div id="ppIgWork" hidden>
        <div class="pp-ig-row"><canvas id="ppIgPost" width="1080" height="1350"></canvas><canvas id="ppIgStory" width="1080" height="1920"></canvas></div>
        <div class="pp-so-act"><button type="button" data-ig-dl="post">Download post (1080×1350)</button><button type="button" data-ig-dl="story">Download story (1080×1920)</button></div>
        <label class="wide">Caption<textarea id="ppIgCap" rows="7"></textarea></label>
        <div class="pp-so-act"><select id="ppIgLang"><option value="english">English</option><option value="hinglish">Hinglish</option></select><button type="button" id="ppIgAi" class="subtle">AI caption</button><button type="button" id="ppIgCopy">Copy caption</button></div>
        <p id="ppIgMsg" class="muted" role="status"></p>
      </div>`;
    const st=document.createElement('style');
    st.textContent='.pp-ig-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin:8px 0}.pp-ig-it{display:flex;gap:8px;align-items:center;text-align:left;border:1px solid #e3ebe7;border-radius:10px;padding:8px;background:#fff;cursor:pointer;font:inherit}.pp-ig-it.on{outline:2px solid #1f7a55}.pp-ig-it img{width:44px;height:44px;object-fit:contain}.pp-ig-it small{display:block;color:#64756e}.pp-ig-row{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.pp-ig-row canvas{height:300px;width:auto;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.15)}#ppIgCap{width:100%;box-sizing:border-box;font:inherit}';
    w.appendChild(st);
    $('ppAiAdmin').after(w);
    $('ppIgLoad').addEventListener('click',()=>igLoad(''));
    let ft=0;$('ppIgFind').addEventListener('input',e=>{clearTimeout(ft);const v=e.target.value.trim();ft=setTimeout(()=>{if(v.length>=3)igLoad(v);},400);});
    $('ppIgList').addEventListener('click',e=>{const b=e.target.closest('[data-ig]');if(b)igPick(IG.list[Number(b.dataset.ig)]);});
    w.addEventListener('click',e=>{const d=e.target.closest('[data-ig-dl]');if(d)igDownload(d.dataset.igDl);});
    $('ppIgAi').addEventListener('click',igAiCaption);
    $('ppWaText').addEventListener('click',waText);
    $('ppReel').addEventListener('click',reelHooks);
    $('ppIgExtraCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('ppIgExtraText').value);msg('ppIgExtraMsg','Copied.');}catch(_){$('ppIgExtraText').select();}});
    $('ppIgCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('ppIgCap').value);msg('ppIgMsg','Caption copied.');}catch(_){$('ppIgCap').select();msg('ppIgMsg','Press Cmd+C to copy.');}});
    return true;
  }
  const igSay=(t,bad)=>msg('ppIgMsg',t,bad);
  async function igLoad(q){
    if(!ready())return;
    const L=$('ppIgList');L.innerHTML='<p class="muted">Loading verified prices…</p>';
    const nowIso=new Date().toISOString(),since=new Date(Date.now()-30*864e5).toISOString();
    let pq=api.from('pp_catalog_products').select('product_id,name,image_url,category,status').eq('status','active').limit(q?30:400);
    if(q)pq=pq.ilike('name','%'+q.replace(/[%_,()]/g,' ')+'%');
    const [P,R]=await Promise.all([pq,api.from('pp_retailer_prices').select('product_id,retailer,price,availability,published,expires_at,checked_at').eq('published',true).gt('expires_at',nowIso).limit(2000)]);
    if(P.error||R.error){L.innerHTML=`<p class="muted" style="color:#a33">${h((P.error||R.error).message)}</p>`;return;}
    const cur={};for(const r of R.data||[]){if(r.availability!=='in_stock')continue;const c=cur[r.product_id];if(!c||Number(r.price)<Number(c.price))cur[r.product_id]=r;}
    const prods=(P.data||[]).filter(p=>cur[p.product_id]);
    const ids=prods.map(p=>p.product_id);
    const Hh=ids.length?await api.from('pp_retailer_price_history').select('product_id,price,availability,checked_at').in('product_id',ids.slice(0,300)).gte('checked_at',since).limit(20000):{data:[]};
    const daily={};for(const x of Hh.data||[]){if(x.availability!=='in_stock')continue;const d=new Date(new Date(x.checked_at).getTime()+5.5*36e5).toISOString().slice(0,10);const k=x.product_id;(daily[k]||(daily[k]={}));daily[k][d]=Math.min(daily[k][d]??Infinity,Number(x.price));}
    IG.list=prods.map(p=>{const c=cur[p.product_id],v=Object.values(daily[p.product_id]||{});const price=Number(c.price);
      const avg=v.length?v.reduce((a,b)=>a+b,0)/v.length:null,low=v.length?Math.min(...v,price):null;
      return {id:p.product_id,name:p.name,img:p.image_url||'',category:p.category,store:c.retailer,price,checked:c.checked_at,avg,low,days:v.length,pct:avg?Math.round((avg-price)/avg*1000)/10:null,lowest:low!=null&&v.length>=5&&price<=low};})
      .filter(x=>q||(x.days>=5&&x.pct>=3)).sort((a,b)=>(b.pct??-99)-(a.pct??-99)).slice(0,q?30:12);
    L.innerHTML=IG.list.length?IG.list.map((x,i)=>`<button type="button" class="pp-ig-it" data-ig="${i}">${x.img?`<img src="${h(x.img)}" alt="">`:''}<span><b>${h(x.name)}</b><small>${rs(x.price)} · ${h(x.store)}${x.pct!=null&&x.days>=5?` · ${x.lowest?'lowest in 30 days':x.pct+'% below avg'}`:' · not enough history'}</small></span></button>`).join(''):`<p class="muted">${q?'No product with a verified price matches.':'No verified price is 3% or more below its 30-day average today. Search a product instead.'}</p>`;
  }
  const igFact=x=>x.days>=5&&x.pct!=null?(x.lowest?'Lowest price in 30 days':x.pct>=1?`${x.pct}% below its 30-day average`:'Verified price today'):'Verified price today';
  const igDate=t=>{try{return new Date(t).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short'});}catch(_){return '';}};
  function igPlain(x){return `${x.name} 👇\n${rs(x.price)} on ${x.store}\n${igFact(x)}${x.avg&&x.days>=5?` (30-day average ${rs(x.avg)})`:''}\nPrice checked ${igDate(x.checked)}, may change. Link in bio. #ad\n\n#PricePulse #DealsIndia #PriceDrop #${String(x.store||'').replace(/[^A-Za-z0-9]/g,'')} #${String(x.category||'deals').replace(/[^A-Za-z0-9]/g,'')} #OnlineShopping #SaveMoney`;}
  async function igPick(x){
    if(!x)return;IG.sel=x;$('ppIgWork').hidden=false;
    document.querySelectorAll('.pp-ig-it').forEach((b,i)=>b.classList.toggle('on',IG.list[i]===x));
    $('ppIgCap').value=igPlain(x);igSay('Plain caption ready (free). Press "AI caption" for a written one.');
    IG.img=null;
    if(x.img){IG.img=await new Promise(res=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>res(im);im.onerror=()=>res(null);im.src=x.img;});}
    if(x.img&&!IG.img)igSay('The photo could not be loaded into the picture (other site blocks it). The picture is made without it.',true);
    igDraw($('ppIgPost'),x,false);igDraw($('ppIgStory'),x,true);
  }
  function wrap(ctx,text,maxW,maxLines){const w=String(text).split(/\s+/),out=[];let line='';for(const t of w){const tr=line?line+' '+t:t;if(ctx.measureText(tr).width>maxW&&line){out.push(line);line=t;if(out.length===maxLines)break;}else line=tr;}if(out.length<maxLines&&line)out.push(line);if(out.length===maxLines&&w.join(' ').length>out.join(' ').length)out[maxLines-1]=out[maxLines-1].replace(/\s*\S*$/,'')+'…';return out;}
  function igDraw(cv,x,story){
    const c=cv.getContext('2d'),W=cv.width,Ht=cv.height;
    const g=c.createLinearGradient(0,0,W,Ht);g.addColorStop(0,'#0E2231');g.addColorStop(1,'#0A2A26');c.fillStyle=g;c.fillRect(0,0,W,Ht);
    const pad=72;let y=story?150:90;
    c.fillStyle='#fff';c.font='800 46px Manrope,system-ui,sans-serif';c.fillText('Price',pad,y);const pw=c.measureText('Price').width;c.fillStyle='#3DDC97';c.fillText('Pulse',pad+pw,y);
    c.fillStyle='#C7D6D0';c.font='600 26px Manrope,system-ui,sans-serif';c.fillText('RIGHT PRICE, RIGHT CHOICE',pad,y+40);
    const box=story?820:600,bx=(W-box)/2,by=y+90;
    c.fillStyle='#fff';c.beginPath();c.roundRect?c.roundRect(bx,by,box,box,40):c.rect(bx,by,box,box);c.fill();
    if(IG.img){const im=IG.img,s=Math.min((box-80)/im.width,(box-80)/im.height);const iw=im.width*s,ih=im.height*s;c.drawImage(im,bx+(box-iw)/2,by+(box-ih)/2,iw,ih);}
    else{c.fillStyle='#9fb3ab';c.font='600 34px Manrope,system-ui,sans-serif';c.textAlign='center';c.fillText(x.store,W/2,by+box/2);c.textAlign='left';}
    y=by+box+90;
    c.fillStyle='#fff';c.font=`800 ${story?54:48}px Manrope,system-ui,sans-serif`;for(const l of wrap(c,x.name,W-pad*2,2)){c.fillText(l,pad,y);y+=story?66:58;}
    y+=story?30:14;c.fillStyle='#3DDC97';c.font=`800 ${story?120:104}px Sora,Manrope,system-ui,sans-serif`;c.fillText(rs(x.price),pad,y+(story?90:76));
    const pw2=c.measureText(rs(x.price)).width;c.fillStyle='#E8B954';c.font=`700 ${story?40:36}px Manrope,system-ui,sans-serif`;c.fillText('on '+x.store,pad+pw2+24,y+(story?84:70));
    y+=story?175:150;c.fillStyle='#F0B429';c.font=`800 ${story?40:36}px Manrope,system-ui,sans-serif`;c.fillText('📉 '+igFact(x),pad,y);
    c.fillStyle='#C7D6D0';c.font='600 26px Manrope,system-ui,sans-serif';
    c.fillText(`Price checked ${igDate(x.checked)}. Prices change. price-pulse.in`,pad,Ht-(story?150:60));
  }
  function igDownload(kind){
    if(!IG.sel)return;const cv=$(kind==='story'?'ppIgStory':'ppIgPost');
    try{cv.toBlob(b=>{if(!b){igSay('Could not make the picture.',true);return;}const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`pricepulse-${IG.sel.id}-${kind}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);},'image/png');}
    catch(_){igSay('This photo blocks downloads (other site). Make it without the photo: remove the image and try again.',true);}
  }
  async function igAiCaption(){
    const x=IG.sel;if(!x||!ready())return;const b=$('ppIgAi');b.disabled=true;b.textContent='Writing…';
    const facts={name:x.name,store:x.store,price:x.price,avg30:x.days>=5?x.avg:null,low30:x.days>=5?x.low:null,pct:x.days>=5?x.pct:null,lowest:x.lowest,checked:igDate(x.checked),category:x.category};
    let r;try{r=await api.functions.invoke('ai-link-compare',{body:{mode:'caption',facts,lang:$('ppIgLang').value}});}catch(e){r={error:e};}
    b.disabled=false;b.textContent='AI caption';const res=r.data||{};
    if(r.error||!res.ok){igSay('AI caption failed: '+(r.error?.message||res.error||'no answer')+'. The plain caption is still there.',true);return;}
    $('ppIgCap').value=res.caption+'\n\n'+(res.hashtags||[]).join(' ');igSay(`AI caption (${res.provider||''}, ${rs(res.cost_inr)}). Read it once before posting.`);
  }


  /* H: WhatsApp channel daily text - top 5 verified deals, plain text, no AI, no cost */
  async function dealsTop(){if(!IG.list.length||IG.list.some(x=>!(x.days>=5&&x.pct>=3)))await igLoad('');return IG.list.filter(x=>x.days>=5&&x.pct>=3).slice(0,5);}
  async function waText(){
    const top=await dealsTop(),box=$('ppIgExtra');box.hidden=false;
    if(!top.length){$('ppIgExtraText').value='';msg('ppIgExtraMsg','No verified deal is 3% or more below its 30-day average today.',true);return;}
    const site='https://price-pulse.in';
    const day=new Date().toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short'});
    $('ppIgExtraText').value=`*PricePulse deals · ${day}* 🔥\nVerified prices, checked by us.\n\n`+top.map((x,i)=>`${i+1}. *${x.name}*\n${rs(x.price)} on ${x.store} · ${x.lowest?'lowest in 30 days':x.pct+'% below 30-day avg'}\n${site}/p/${encodeURIComponent(x.id)}/`).join('\n\n')+`\n\n_Prices change often. Links may earn us a commission at no cost to you._`;
    msg('ppIgExtraMsg','Free text from verified prices. Paste it in the WhatsApp channel.');
  }
  /* I: reel hooks + a short script from OUR deal facts (AI; numbers checked by the server like the caption) */
  async function reelHooks(){
    const top=await dealsTop(),box=$('ppIgExtra');box.hidden=false;
    if(!top.length){msg('ppIgExtraMsg','No verified deal to talk about today.',true);return;}
    const b=$('ppReel');b.disabled=true;b.textContent='Writing…';
    const facts=top.slice(0,3).map(x=>({name:x.name,store:x.store,price:x.price,avg30:Math.round(x.avg),low30:x.low,pct:x.pct,lowest:x.lowest,checked:igDate(x.checked)}));
    let r;try{r=await api.functions.invoke('ai-link-compare',{body:{mode:'reel',facts,lang:$('ppIgLang')?.value||'hinglish'}});}catch(e){r={error:e};}
    b.disabled=false;b.textContent='Reel hooks (AI)';const res=r.data||{};
    if(r.error||!res.ok){msg('ppIgExtraMsg','AI failed: '+(r.error?.message||res.error||'no answer'),true);return;}
    $('ppIgExtraText').value='HOOKS\n'+(res.hooks||[]).map((h,i)=>`${i+1}. ${h}`).join('\n')+'\n\nSCRIPT (about 30 s)\n'+(res.script||'');
    msg('ppIgExtraMsg',`AI (${res.provider||''}, ${rs(res.cost_inr)}). Only our verified numbers are used; read it once before recording.`);
  }

  /* P5 + P6 + Q7: Admin > Growth "Today's checks": shopper "wrong price" reports + prices that look wrong next to their own
     30-day history or the other stores (needs supabase-trust-v1.sql). Nothing changes by itself: Admin opens and fixes. */
  function installTrust(){
    const host=$('ppGrowthAdmin');if(!host||!$('ppAiAdmin'))return false;if($('ppTrustAdmin'))return true;
    const w=document.createElement('section');w.id='ppTrustAdmin';w.className='pp-deals-admin-card pp-growth-card';
    w.innerHTML=`<div class="pp-deals-admin-head"><div><h2>Today's checks</h2><p class="muted">Wrong-price reports from shoppers + verified prices that look wrong (far from their own 30-day price or from the other stores). Check them first.</p></div><span class="pp-deals-admin-badge">✅ CHECK</span></div>
      <div class="pp-so-act"><button type="button" id="ppTrLoad" class="subtle">Refresh</button></div><p id="ppTrMsg" class="muted"></p>
      <h3 class="pp-ai-h3">Prices that look wrong</h3><div id="ppTrSan" class="pp-ai-list"></div>
      <h3 class="pp-ai-h3">Reports from shoppers</h3><div id="ppTrRep" class="pp-ai-list"></div>`;
    ($('ppIgAdmin')||$('ppAiAdmin')).after(w);
    $('ppTrLoad').addEventListener('click',trustLoad);
    $('ppTrRep').addEventListener('click',async e=>{const b=e.target.closest('[data-tr]');if(!b)return;await api.rpc('pp_price_report_set',{p_id:Number(b.dataset.id),p_status:b.dataset.tr});trustLoad();});
    [1200,4000].forEach(x=>setTimeout(trustLoad,x));
    return true;
  }
  async function trustLoad(){
    if(!ready()||!$('ppTrSan'))return;
    const [S,R]=await Promise.all([api.rpc('pp_price_sanity_admin'),api.rpc('pp_price_reports_admin')]);
    if(S.error||R.error){msg('ppTrMsg',notRun(S.error||R.error)?'Run supabase-trust-v1.sql first.':(S.error||R.error).message,true);return;}
    const s=S.data?.rows||[],r=R.data?.rows||[];
    msg('ppTrMsg',`${s.length} price${s.length===1?'':'s'} to check · ${r.length} new report${r.length===1?'':'s'}`);
    const link=id=>`<a href="index.html#/product/${encodeURIComponent(id)}" target="_blank" rel="noopener">${h(id)}</a>`;
    $('ppTrSan').innerHTML=s.length?`<table><thead><tr><th>Product</th><th>Store</th><th>Price</th><th>30-day usual</th><th>Other stores</th><th>Why</th></tr></thead><tbody>${s.map(x=>`<tr><td>${h(x.name||'')}<br><small>${link(x.product_id)}</small></td><td>${h(x.retailer)}</td><td><b>${rs(x.price)}</b></td><td>${x.median30?rs(x.median30):'—'}</td><td>${x.others_median?rs(x.others_median):'—'}</td><td><small>${h(x.why)}</small></td></tr>`).join('')}</tbody></table>`:'<p class="muted">Nothing looks wrong. 👍</p>';
    $('ppTrRep').innerHTML=r.length?`<table><thead><tr><th>When</th><th>Product</th><th>Store</th><th>Shopper saw</th><th>Note</th><th></th></tr></thead><tbody>${r.map(x=>`<tr><td>${h(t(x.created_at))}</td><td>${h(x.name||'')}<br><small>${link(x.product_id)}</small></td><td>${h(x.store||'')}</td><td>${x.seen_price?rs(x.seen_price):''}</td><td><small>${h(x.note||'')}</small></td><td><button type="button" class="subtle" data-tr="fixed" data-id="${x.id}">Fixed</button> <button type="button" class="subtle" data-tr="ok" data-id="${x.id}">Price was OK</button> <button type="button" class="subtle" data-tr="spam" data-id="${x.id}">Spam</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">No new reports.</p>';
  }

  let tries=0;const iv=setInterval(()=>{if(install()||++tries>40)clearInterval(iv);},500);
  let ttries=0;const tv=setInterval(()=>{if(installTrust()||++ttries>60)clearInterval(tv);},800);
  let gtries=0;const gv=setInterval(()=>{if(installIg()||++gtries>60)clearInterval(gv);},700);
  let otries=0;const ov=setInterval(()=>{if(installOffer()||++otries>60)clearInterval(ov);},600);
  let ftries=0;const fv=setInterval(()=>{if(installFill()||++ftries>120)clearInterval(fv);},700);
  window.ppAdminAi={load,aiFill};
})();
