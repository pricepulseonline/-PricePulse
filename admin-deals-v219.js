/* PricePulse V219 — Admin: "Today's Deals" page controls.
   Saved in pp_site_settings key "deals" (public) through pp_admin_save_setting.
   Needs supabase-links-clicks-v212.sql (already installed). No new SQL. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof api!=='undefined'&&api&&typeof permitted!=='undefined'&&permitted;
  const missing=e=>/does not exist|schema cache|Could not find/i.test(e?.message||'');
  const DEF={featured:[],plus_early:{},hidden:[],headline:'',note:'',insights:{}};
  let cfg={...DEF},q='';
  const msg=(t,bad)=>{const el=$('ppDlMsg');if(el){el.textContent=t||'';el.style.color=bad?'#a33':'#64756e'}};
  const list=()=>(typeof products!=='undefined'?products:[]).filter(p=>p.status!=='archived');
  const earlyLeft=id=>{const t=Date.parse(cfg.plus_early?.[id]||'');if(!Number.isFinite(t)||t<=Date.now())return '';const m=Math.round((t-Date.now())/60000);return m>=60?`${Math.floor(m/60)}h ${m%60}m left`:`${m}m left`;};

  function install(){
    const host=$('ppGrowthAdmin');if(!host||$('ppDealsPageAdmin'))return false;
    const wrap=document.createElement('section');wrap.id='ppDealsPageAdmin';wrap.className='pp-deals-admin-card pp-growth-card';
    wrap.innerHTML=`
      <div class="pp-deals-admin-head"><div><h2>Today's Deals page</h2><p class="muted">Controls the 🔥 Deals page on the website. Price drops, lowest prices, Deal Score and store savings are worked out automatically from verified prices. Here you only pick extras.</p></div><span class="pp-deals-admin-badge">🔥 DEALS</span></div>
      <form id="ppDlForm" class="pp-deals-form" onsubmit="return false">
        <label>Page headline<input id="ppDlHead" maxlength="70" placeholder="Today's best deals"></label>
        <label class="wide">Line under the headline<input id="ppDlNote" maxlength="160" placeholder="Only real price drops and lowest prices, checked across stores. No fake MRP discounts."></label>
      </form>
      <div class="pp-deals-guidance"><b>⭐ Top pick</b> shows the product first in "Today's top picks" (in the order you tick them, max 4). <b>👑 Plus early</b> blurs the deal for non-Plus shoppers until the time ends, then it opens for everyone automatically. <b>👑 Plus tip</b> is shown only to Plus members on the product card (others see it blurred). Write it as <code>Label: value</code>, e.g. <code>Next expected drop: ₹42,999 by 18 Oct</code> or <code>Bank offer price: ₹2,159 with HDFC</code>. Empty = automatic 30-day low &amp; average. <b>Hide</b> removes it from the Deals page only.</div>
      <div class="pp-dl-tools"><input id="ppDlSearch" type="search" placeholder="Search products…"><span id="ppDlCount" class="muted"></span></div>
      <div id="ppDlList" class="pp-deals-list"></div>
      <div class="pp-deals-actions"><button id="ppDlSave" type="button">Save Deals page</button><a href="index.html#/deals" target="_blank" rel="noopener" class="subtle pp-dl-open">Open Deals page ↗</a></div>
      <p id="ppDlMsg" class="muted" role="status"></p>`;
    host.appendChild(wrap);
    if(!$('ppDlStyle')){const st=document.createElement('style');st.id='ppDlStyle';st.textContent=`.pp-dl-tools{display:flex;align-items:center;gap:10px;margin:12px 0 6px}.pp-dl-tools input{flex:1;max-width:320px;height:36px;padding:0 12px;border:1px solid #dce9e4;border-radius:10px}.pp-dl-ctrls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.pp-dl-ctrls label{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;white-space:nowrap}.pp-dl-ctrls select{height:32px;border:1px solid #dce9e4;border-radius:8px;padding:0 6px}.pp-dl-row.is-hidden{opacity:.55}.pp-dl-rank{display:inline-grid;place-items:center;width:22px;height:22px;margin-right:6px;border-radius:50%;background:#E8B954;color:#0F1B24;font-size:12px}.pp-dl-row{flex-wrap:wrap}.pp-dl-tip{flex:1 1 100%;display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;font-weight:700;color:#7a5a12}.pp-dl-tip input{flex:1;height:34px;padding:0 10px;border:1px dashed #e0c27a;border-radius:9px;background:#fffaf0}.pp-dl-open{margin-left:10px;font-weight:700;color:#13805A;text-decoration:none}`;document.head.appendChild(st);}
    $('ppDlSearch').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();render();});
    $('ppDlSave').addEventListener('click',save);
    wrap.addEventListener('input',e=>{if(!e.target.matches('[data-dl-tip]'))return;const id=e.target.closest('[data-dl-id]').dataset.dlId;const v=e.target.value.trim().slice(0,90);const ins={...(cfg.insights||{})};if(v)ins[id]=v;else delete ins[id];cfg.insights=ins;msg('Not saved yet.');});
    wrap.addEventListener('change',e=>{if(e.target.matches('[data-dl-tip]'))return;
      const row=e.target.closest('[data-dl-id]');if(!row)return;const id=row.dataset.dlId;
      if(e.target.matches('[data-dl-feat]')){cfg.featured=cfg.featured.filter(x=>x!==id);if(e.target.checked){if(cfg.featured.length>=4){e.target.checked=false;msg('Max 4 top picks. Untick one first.',true);return}cfg.featured.push(id);}render();}
      if(e.target.matches('[data-dl-hide]')){cfg.hidden=cfg.hidden.filter(x=>x!==id);if(e.target.checked)cfg.hidden.push(id);render();}
      if(e.target.matches('[data-dl-early]')){if(e.target.value==='keep')return;const hrs=Number(e.target.value);const pe={...(cfg.plus_early||{})};if(hrs>0)pe[id]=new Date(Date.now()+hrs*3600000).toISOString();else delete pe[id];cfg.plus_early=pe;render();}
      msg('Not saved yet.');
    });
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(load,0));
    [0,900,2200].forEach(t=>setTimeout(()=>{if(document.body.dataset.adminView==='growth')load()},t));
    return true;
  }
  function render(){
    const el=$('ppDlList');if(!el)return;
    const all=list();
    const rows=all.filter(p=>!q||`${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q))
      .sort((a,b)=>{const fa=cfg.featured.indexOf(a.id),fb=cfg.featured.indexOf(b.id);return (fb>=0)-(fa>=0)||(fa-fb)||a.name.localeCompare(b.name);});
    $('ppDlCount').textContent=`${cfg.featured.length}/4 top picks · ${Object.keys(cfg.plus_early||{}).filter(id=>earlyLeft(id)).length} Plus early · ${cfg.hidden.length} hidden`;
    el.innerHTML=rows.length?rows.map(p=>{const fi=cfg.featured.indexOf(p.id),left=earlyLeft(p.id),hid=cfg.hidden.includes(p.id);
      return `<article class="pp-deals-row pp-dl-row${hid?' is-hidden':''}" data-dl-id="${h(p.id)}"><div><h3>${fi>=0?`<span class="pp-dl-rank">${fi+1}</span>`:''}${h(p.name)}</h3><p>${h(p.brand||'')}${p.category?` · ${h(p.category)}`:''}</p>${left?`<div class="meta"><span class="pp-deals-chip">👑 Plus early · ${h(left)}</span></div>`:''}</div>
        <div class="pp-deals-row-actions pp-dl-ctrls"><label><input type="checkbox" data-dl-feat ${fi>=0?'checked':''}> ⭐ Top pick</label>
        <label>👑 <select data-dl-early>${left?`<option value="keep" selected>On · ${h(left)}</option>`:''}<option value="0"${left?'':' selected'}>Plus early: off</option>${[2,6,12,24,48].map(n=>`<option value="${n}">${n}h early</option>`).join('')}</select></label>
        <label><input type="checkbox" data-dl-hide ${hid?'checked':''}> Hide</label></div><label class="pp-dl-tip">👑 Plus tip<input data-dl-tip maxlength="90" placeholder="Next expected drop: ₹42,999 by 18 Oct" value="${h(cfg.insights?.[p.id]||'')}"></label></article>`;}).join(''):'<div class="pp-deals-row"><div><h3>No products</h3><p>Add products in Catalog & Prices first.</p></div></div>';
  }
  async function load(){
    let v=null;
    if(ready()){
      const r=await api.from('pp_site_settings').select('value').eq('key','deals').maybeSingle().then(x=>x,e=>({error:e}));
      if(!r.error&&r.data?.value)v=r.data.value;
      else{const p=await api.rpc('pp_public_settings').then(x=>x,e=>({error:e}));if(!p.error&&p.data?.deals)v=p.data.deals;else if(p.error&&missing(p.error))msg('Run supabase-links-clicks-v212.sql once in Supabase.',true);}
    }
    cfg={...DEF,...(v||{})};
    cfg.featured=(cfg.featured||[]).slice(0,4);cfg.hidden=cfg.hidden||[];cfg.insights=cfg.insights&&typeof cfg.insights==='object'?cfg.insights:{};
    const pe={};Object.entries(cfg.plus_early||{}).forEach(([id,t])=>{if(Date.parse(t)>Date.now())pe[id]=t;});cfg.plus_early=pe;
    if($('ppDlHead'))$('ppDlHead').value=cfg.headline||'';
    if($('ppDlNote'))$('ppDlNote').value=cfg.note||'';
    render();
  }
  async function save(){
    if(!ready()){msg('Admin database access required.',true);return}
    const ids=new Set(list().map(p=>p.id));
    const value={headline:$('ppDlHead').value.trim().slice(0,70),note:$('ppDlNote').value.trim().slice(0,160),
      insights:Object.fromEntries(Object.entries(cfg.insights||{}).filter(([id,t])=>ids.has(id)&&String(t).trim()).map(([id,t])=>[id,String(t).trim().slice(0,90)])),featured:cfg.featured.filter(id=>ids.has(id)).slice(0,4),hidden:cfg.hidden.filter(id=>ids.has(id)),
      plus_early:Object.fromEntries(Object.entries(cfg.plus_early||{}).filter(([id,t])=>ids.has(id)&&Date.parse(t)>Date.now())),updated_at:new Date().toISOString()};
    const btn=$('ppDlSave');btn.disabled=true;btn.textContent='Saving…';
    const r=await api.rpc('pp_admin_save_setting',{set_key:'deals',set_value:value,set_public:true});
    btn.disabled=false;btn.textContent='Save Deals page';
    if(r.error){msg(missing(r.error)?'Run supabase-links-clicks-v212.sql once in Supabase first.':r.error.message,true);return}
    cfg={...cfg,...value};render();
    msg('Saved. The Deals page shows the changes on the next page load.');
  }
  let tries=0;const t=setInterval(()=>{if(install()||++tries>40)clearInterval(t)},250);
})();
