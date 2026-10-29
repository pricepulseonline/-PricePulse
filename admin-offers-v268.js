/* PricePulse V268 (+V270 Cuelinks tag) — Admin: "Store offers" (needs supabase-offers-v268.sql).
   Bank / coupon / gift card / EMI / cashback offers per store. They show on the Find best price page under that store's row,
   and bank + coupon savings are used in the Net effective price. Expired offers are hidden automatically. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof api!=='undefined'&&api;
  const STORES=[['amazon','Amazon'],['flipkart','Flipkart'],['croma','Croma'],['vijay-sales','Vijay Sales'],['reliance-digital','Reliance Digital'],['tata-cliq','Tata CLiQ'],['jiomart','JioMart'],['shopsy','Shopsy'],['myntra','Myntra'],['ajio','AJIO'],['nykaa','Nykaa'],['nykaa-fashion','Nykaa Fashion'],['purplle','Purplle'],['meesho','Meesho'],['adidas','Adidas']];
  const KINDS=[['bank','Bank / card offer'],['coupon','Coupon code'],['giftcard','Gift card discount'],['emi','EMI'],['cashback','Cashback'],['other','Other']];
  const CATS=[['','All categories'],['mobiles','Mobiles'],['laptops','Laptops'],['electronics','Electronics'],['home','Home & Kitchen'],['fashion','Fashion'],['appliances','Appliances'],['beauty','Beauty']];
  const name=s=>(STORES.find(x=>x[0]===s)||[s,s])[1];
  const kname=k=>(KINDS.find(x=>x[0]===k)||[k,k])[1];
  const inr=v=>'₹'+Math.round(Number(v)).toLocaleString('en-IN');
  const opts=(l,sel)=>l.map(([v,t])=>`<option value="${h(v)}"${v===sel?' selected':''}>${h(t)}</option>`).join('');
  let rows=[],editing=null;
  const msg=(t,bad)=>{const el=$('ppSoMsg');if(el){el.textContent=t||'';el.style.color=bad?'#a33':'#64756e';}};
  const needSql=e=>e&&(/does not exist|Could not find the function/i.test(e.message||'')||['PGRST202','42883','42P01'].includes(e.code));

  function install(){
    const host=$('ppGrowthAdmin');if(!host)return false;if($('ppStoreOffers'))return true;
    const w=document.createElement('section');w.id='ppStoreOffers';w.className='pp-deals-admin-card pp-growth-card';
    w.innerHTML=`<div class="pp-deals-admin-head"><div><h2>Store offers</h2><p class="muted">Bank offers, coupon codes, gift card discounts and EMI per store. They appear under that store's row on <b>Find best price</b>. Net effective price uses the best <b>bank</b> offer + best <b>coupon</b> (gift cards are shown as an extra saving). Expired offers hide by themselves. Only add offers you have checked.</p></div><span class="pp-deals-admin-badge">🏷 OFFERS</span></div>
      <form id="ppSoForm" class="pp-so-form" autocomplete="off">
        <label>Store<select name="store">${opts(STORES,'')}</select></label>
        <label>Type<select name="kind">${opts(KINDS,'bank')}</select></label>
        <label class="wide">Title (what the shopper reads)<input name="title" maxlength="120" placeholder="e.g. Flat 6% off with code JM6"></label>
        <label>Bank / card (optional)<input name="bank" maxlength="40" placeholder="HDFC, Axis, SBI…"></label>
        <label>Coupon code<input name="code" maxlength="30" placeholder="JM6"></label>
        <label>Percent off<input name="pct" type="number" min="0" max="100" step="0.01" placeholder="10"></label>
        <label>Flat ₹ off<input name="flat" type="number" min="0" step="1" placeholder="1500"></label>
        <label>Max ₹ saving (cap)<input name="cap" type="number" min="0" step="1" placeholder="2000"></label>
        <label>Min order ₹<input name="min_order" type="number" min="0" step="1" placeholder="5000"></label>
        <label>Category<select name="category">${opts(CATS,'')}</select></label>
        <label>Valid till<input name="valid_till" type="date"></label>
        <div class="pp-so-act"><button type="submit" id="ppSoSave">Add offer</button><button type="button" id="ppSoCancel" class="subtle" hidden>Cancel edit</button></div>
      </form>
      <p id="ppSoMsg" class="muted" role="status"></p>
      <div id="ppSoList" class="pp-deals-list"></div>`;
    const a=$('ppExtAdmin')||$('ppFullUrlAdmin');
    if(a&&a.parentNode===host)a.before(w);else host.prepend(w);
    if(!$('ppSoStyle')){const st=document.createElement('style');st.id='ppSoStyle';st.textContent=`.pp-so-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}.pp-so-form label{display:grid;gap:4px;font-size:12px;font-weight:700;color:#4a5b55}.pp-so-form .wide{grid-column:1/-1}.pp-so-form input,.pp-so-form select{padding:8px 10px;border:1px solid #d6e2dd;border-radius:10px;font:inherit;font-weight:500}.pp-so-act{display:flex;gap:8px;align-items:end}.pp-so-row{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid #e3ece8;border-radius:12px;margin-top:8px;background:#fff}.pp-so-row.off{opacity:.55}.pp-so-row h3{font-size:14px;margin:0}.pp-so-row small{color:#64756e}.pp-so-btns{display:flex;gap:6px}`;document.head.appendChild(st);}
    $('ppSoForm').addEventListener('submit',save);
    $('ppSoCancel').addEventListener('click',()=>reset());
    $('ppSoList').addEventListener('click',onList);
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(load,0));
    [800,2400,6000].forEach(t=>setTimeout(load,t));
    return true;
  }
  function reset(){editing=null;const f=$('ppSoForm');if(!f)return;f.reset();$('ppSoSave').textContent='Add offer';$('ppSoCancel').hidden=true;}
  const num=v=>{v=String(v||'').trim();if(!v)return null;const n=Number(v);return Number.isFinite(n)&&n>0?n:null;};
  async function save(e){
    e.preventDefault();if(!ready())return;
    const f=e.target,d=Object.fromEntries(new FormData(f).entries());
    if(!d.title.trim()){msg('Write a title.',true);return;}
    if(d.kind==='coupon'&&!d.code.trim()){msg('A coupon needs a code.',true);return;}
    if(['bank','coupon','giftcard'].includes(d.kind)&&!num(d.pct)&&!num(d.flat)&&!num(d.cap)){msg('Add a percent, a flat ₹ amount or a cap, so the saving can be calculated.',true);return;}
    const {data,error}=await api.rpc('pp_store_offer_save',{p_id:editing,p_store:d.store,p_kind:d.kind,p_title:d.title,p_bank:d.bank||null,p_pct:num(d.pct),p_flat:num(d.flat),p_cap:num(d.cap),p_min:num(d.min_order),p_code:d.code||null,p_category:d.category||null,p_valid:d.valid_till||null,p_active:true});
    if(error||!data||!data.ok){msg(error?(needSql(error)?'Run supabase-offers-v268.sql in Supabase first.':error.message):(data&&data.error)||'Not saved',true);return;}
    msg(editing?'Offer updated.':'Offer added.');reset();load();
  }
  async function load(){
    if(!ready()||!$('ppSoList'))return;
    const {data,error}=await api.rpc('pp_store_offers_admin');
    if(error){msg(needSql(error)?'Run supabase-offers-v268.sql in Supabase first.':error.message,true);return;}
    rows=data&&data.ok&&Array.isArray(data.rows)?data.rows:[];render();
  }
  function render(){
    const el=$('ppSoList');if(!el)return;
    const today=new Date().toISOString().slice(0,10);
    el.innerHTML=rows.length?rows.map(o=>{
      const expired=o.valid_till&&o.valid_till<today;
      const val=[o.pct?o.pct+'% off':'',o.flat?inr(o.flat)+' off':'',o.cap?'up to '+inr(o.cap):'',o.min_order?'min '+inr(o.min_order):''].filter(Boolean).join(' · ');
      return `<div class="pp-so-row${o.active&&!expired?'':' off'}" data-id="${o.id}"><div><h3>${o.source==='cuelinks'?'<span style="background:#e8f0ff;color:#2450a8;border-radius:6px;padding:1px 6px;font-size:11px;margin-right:4px">Cuelinks</span>':''}${h(name(o.store))} · ${h(kname(o.kind))}${o.code?` · <code>${h(o.code)}</code>`:''}</h3><small>${h(o.title)}${o.bank?' · '+h(o.bank):''}${val?' · '+h(val):''}${o.category?' · '+h(o.category):''}${o.valid_till?' · till '+h(o.valid_till):''}${expired?' · EXPIRED':''}${o.active?'':' · HIDDEN'}</small></div><div class="pp-so-btns"><button type="button" class="subtle" data-act="edit">Edit</button><button type="button" class="subtle" data-act="toggle">${o.active?'Hide':'Show'}</button><button type="button" class="subtle" data-act="del">Delete</button></div></div>`;}).join(''):'<p class="muted">No offers yet. Add the first one above.</p>';
  }
  async function onList(e){
    const b=e.target.closest('[data-act]');if(!b)return;
    const id=Number(b.closest('[data-id]').dataset.id),o=rows.find(x=>x.id===id);if(!o)return;
    if(b.dataset.act==='edit'){
      editing=id;const f=$('ppSoForm');
      ['store','kind','title','bank','code','pct','flat','cap','min_order','category','valid_till'].forEach(k=>{if(f.elements[k])f.elements[k].value=o[k]==null?'':o[k];});
      $('ppSoSave').textContent='Save changes';$('ppSoCancel').hidden=false;f.scrollIntoView({behavior:'smooth',block:'center'});return;
    }
    if(b.dataset.act==='del'){if(!confirm('Delete this offer?'))return;const {error}=await api.rpc('pp_store_offer_delete',{p_id:id});if(error){msg(error.message,true);return;}msg('Deleted.');load();return;}
    if(b.dataset.act==='toggle'){const {error}=await api.rpc('pp_store_offer_save',{p_id:id,p_store:o.store,p_kind:o.kind,p_title:o.title,p_bank:o.bank,p_pct:o.pct,p_flat:o.flat,p_cap:o.cap,p_min:o.min_order,p_code:o.code,p_category:o.category,p_valid:o.valid_till,p_active:!o.active});if(error){msg(error.message,true);return;}load();}
  }
  let tries=0;const t=setInterval(()=>{if(install()||++tries>40)clearInterval(t);},500);
})();
