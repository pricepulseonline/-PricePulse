/* PricePulse V270 — Admin: "Card rewards" (needs supabase-offers-v270.sql).
   Credit card cashback / points per store. Shown in "Saving stack" and "Save ₹X more" on Find best price. */
(function(){
  const $=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof api!=='undefined'&&api;
  const STORES=[['*','Any online store'],['amazon','Amazon'],['flipkart','Flipkart'],['croma','Croma'],['vijay-sales','Vijay Sales'],['reliance-digital','Reliance Digital'],['tata-cliq','Tata CLiQ'],['jiomart','JioMart'],['myntra','Myntra'],['ajio','AJIO'],['nykaa','Nykaa'],['nykaa-fashion','Nykaa Fashion']];
  const PER=[['','No limit'],['month','Month'],['quarter','Quarter'],['statement','Statement'],['year','Year'],['order','Order']];
  const opts=(l,sel)=>l.map(([v,t])=>`<option value="${h(v)}"${v===sel?' selected':''}>${h(t)}</option>`).join('');
  let rows=[],editing=null;
  const msg=(t,bad)=>{const el=$('ppCrMsg');if(el){el.textContent=t||'';el.style.color=bad?'#a33':'#64756e';}};
  const num=v=>{v=String(v||'').trim();if(!v)return null;const n=Number(v);return Number.isFinite(n)&&n>0?n:null;};
  function install(){
    const host=$('ppGrowthAdmin');if(!host)return false;if($('ppCardRewards'))return true;
    const w=document.createElement('section');w.id='ppCardRewards';w.className='pp-deals-admin-card pp-growth-card';
    w.innerHTML=`<div class="pp-deals-admin-head"><div><h2>Card rewards</h2><p class="muted">Cashback / points a credit card gives on a store. Store "Any online store" = default for that card. Points: write the ₹ value as a percent. Always fill the bank page link and Valid till.</p></div><span class="pp-deals-admin-badge">💳 CARDS</span></div>
      <form id="ppCrForm" class="pp-so-form" autocomplete="off">
        <label class="wide">Card name<input name="card" maxlength="80" placeholder="Flipkart Axis Bank Credit Card"></label>
        <label>Bank<input name="bank" maxlength="30" placeholder="Axis"></label>
        <label>Store<select name="store">${opts(STORES,'*')}</select></label>
        <label>Type<select name="reward"><option value="cashback">Cashback</option><option value="points">Points</option></select></label>
        <label>Percent back<input name="pct" type="number" min="0" max="20" step="0.1" placeholder="5"></label>
        <label>Max ₹ back<input name="cap" type="number" min="0" step="1" placeholder="4000"></label>
        <label>Limit per<select name="cap_period">${opts(PER,'')}</select></label>
        <label>Valid till<input name="valid_till" type="date"></label>
        <label class="wide">Shopper text<input name="note" maxlength="120" placeholder="5% cashback on Flipkart, up to ₹4,000 per quarter"></label>
        <label class="wide">Bank page link<input name="source_url" maxlength="300" placeholder="https://"></label>
        <div class="pp-so-act"><button type="submit" id="ppCrSave">Add card reward</button><button type="button" id="ppCrCancel" class="subtle" hidden>Cancel edit</button></div>
      </form><p id="ppCrMsg" class="muted" role="status"></p><div id="ppCrList" class="pp-deals-list"></div>`;
    const so=$('ppStoreOffers');if(so)so.after(w);else host.prepend(w);
    $('ppCrForm').addEventListener('submit',save);$('ppCrCancel').addEventListener('click',reset);$('ppCrList').addEventListener('click',onList);
    document.querySelector('[data-admin-view="growth"]')?.addEventListener('click',()=>setTimeout(load,0));
    [900,2500,6000].forEach(t=>setTimeout(load,t));return true;
  }
  function reset(){editing=null;$('ppCrForm').reset();$('ppCrSave').textContent='Add card reward';$('ppCrCancel').hidden=true;}
  const args=(d,id,active)=>({p_id:id,p_card:d.card,p_bank:d.bank,p_store:d.store,p_reward:d.reward,p_pct:num(d.pct),p_cap:num(d.cap),p_cap_period:d.cap_period||null,p_note:d.note||null,p_source:d.source_url||null,p_valid:d.valid_till||null,p_active:active});
  async function save(e){
    e.preventDefault();if(!ready())return;const d=Object.fromEntries(new FormData(e.target).entries());
    if(!d.card.trim()||!d.bank.trim()||!num(d.pct)){msg('Card, bank and percent are needed.',true);return;}
    const {data,error}=await api.rpc('pp_card_reward_save',args(d,editing,true));
    if(error||!data?.ok){msg(error?(/does not exist|Could not find/i.test(error.message)?'Run supabase-offers-v270.sql first.':error.message):data?.error||'Not saved',true);return;}
    msg(editing?'Updated.':'Added.');reset();load();
  }
  async function load(){
    if(!ready()||!$('ppCrList'))return;const {data,error}=await api.rpc('pp_card_rewards_admin');
    if(error){msg(/does not exist|Could not find/i.test(error.message)?'Run supabase-offers-v270.sql first.':error.message,true);return;}
    rows=data?.ok?data.rows:[];const today=new Date().toISOString().slice(0,10);
    $('ppCrList').innerHTML=rows.length?rows.map(c=>{const ex=c.valid_till&&c.valid_till<today;return `<div class="pp-so-row${c.active&&!ex?'':' off'}" data-id="${c.id}"><div><h3>${h(c.card)} · ${h((STORES.find(s=>s[0]===c.store)||[0,c.store])[1])} · ${c.pct}% ${h(c.reward)}</h3><small>${h(c.note||'')}${c.cap?' · max ₹'+c.cap+(c.cap_period?' / '+c.cap_period:''):''}${c.valid_till?' · till '+h(c.valid_till):''}${ex?' · EXPIRED':''}${c.active?'':' · HIDDEN'}${c.source_url?` · <a href="${h(c.source_url)}" target="_blank" rel="noopener">bank page</a>`:''}</small></div><div class="pp-so-btns"><button type="button" class="subtle" data-act="edit">Edit</button><button type="button" class="subtle" data-act="toggle">${c.active?'Hide':'Show'}</button><button type="button" class="subtle" data-act="del">Delete</button></div></div>`;}).join(''):'<p class="muted">No card rewards yet.</p>';
  }
  async function onList(e){
    const b=e.target.closest('[data-act]');if(!b)return;const id=Number(b.closest('[data-id]').dataset.id),c=rows.find(x=>x.id===id);if(!c)return;
    if(b.dataset.act==='edit'){editing=id;const f=$('ppCrForm');['card','bank','store','reward','pct','cap','cap_period','valid_till','note','source_url'].forEach(k=>{f.elements[k].value=c[k]==null?'':c[k];});$('ppCrSave').textContent='Save changes';$('ppCrCancel').hidden=false;f.scrollIntoView({behavior:'smooth',block:'center'});return;}
    if(b.dataset.act==='del'){if(!confirm('Delete this card reward?'))return;await api.rpc('pp_card_reward_delete',{p_id:id});load();return;}
    if(b.dataset.act==='toggle'){await api.rpc('pp_card_reward_save',args({...c,cap:c.cap??'',pct:c.pct},id,!c.active));load();}
  }
  let tries=0;const t=setInterval(()=>{if(install()||++tries>40)clearInterval(t);},500);
})();
