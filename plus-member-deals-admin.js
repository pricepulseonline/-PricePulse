/* PricePulse V78.8.145 — isolated Plus Member Deals Manager. */
(function(){
  const TYPES={
    exclusive_offer:'Exclusive Member Offers',
    plus_reward:'Plus Rewards',
    coupon_bank:'Eligible Coupons & Bank Offers',
    early_access:'Early-access Campaigns'
  };
  const $=id=>document.getElementById(id);
  const clean=s=>String(s??'').trim();
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let rows=[];

  function install(){
    const anchor=$('plusAdminCard'); if(!anchor||$('plusDealsManager'))return;
    const section=document.createElement('section'); section.id='plusDealsManager'; section.className='pp-deals-admin-card plus-only';
    section.innerHTML=`<div class="pp-deals-admin-head"><div><h2>Plus Member Deals Manager</h2><p class="muted">Publish only genuine Plus value. Active campaigns automatically appear in the four Member Deals sections for eligible members.</p></div><span class="pp-deals-admin-badge">★ MEMBER VALUE</span></div>
      <div class="pp-deals-readiness"><div><b id="ppDealsActiveCount">0</b><small>Active campaigns</small></div><div><b id="ppDealsFeaturedCount">0</b><small>Featured</small></div><div><b id="ppDealsCategoryCount">0/4</b><small>Sections with value</small></div><div><b id="ppDealsPaidReady">NOT READY</b><small>Paid Plus readiness</small></div></div>
      <form id="ppDealsForm" class="pp-deals-form">
        <input type="hidden" id="ppDealId">
        <label>Section<select id="ppDealType"><option value="exclusive_offer">Exclusive Member Offers</option><option value="plus_reward">Plus Rewards</option><option value="coupon_bank">Coupons & Bank Offers</option><option value="early_access">Early-access Campaigns</option></select></label>
        <label>Retailer / Partner<input id="ppDealRetailer" placeholder="Croma / HDFC / PricePulse"></label>
        <label>Value label<input id="ppDealValue" placeholder="Extra ₹500 off / 2× rewards"></label>
        <label>Sort order<input id="ppDealSort" type="number" value="0" step="1"></label>
        <label class="wide">Offer title<input id="ppDealTitle" required placeholder="Plus members get extra ₹500 off"></label>
        <label class="wide">Member benefit<input id="ppDealBenefit" required placeholder="Clear one-line benefit shown to Plus members"></label>
        <label>Coupon / code<input id="ppDealCode" placeholder="Optional"></label>
        <label>Campaign key<input id="ppDealCampaign" placeholder="Optional tracking/reward key"></label>
        <label>Starts<input id="ppDealStart" type="datetime-local"></label>
        <label>Expires<input id="ppDealExpiry" type="datetime-local"></label>
        <label class="full">Terms / how to use<textarea id="ppDealTerms" placeholder="Eligibility, minimum order, card/network terms, return rules, redemption instructions…"></textarea></label>
        <label>Action type<select id="ppDealActionKind"><option value="none">No button yet</option><option value="internal_path">PricePulse internal path</option><option value="tracked_campaign">Tracked campaign (future route)</option></select></label>
        <label>Button label<input id="ppDealActionLabel" placeholder="Shop Deal"></label>
        <label class="wide">Action target<input id="ppDealActionTarget" placeholder="Internal path or future server-authorized campaign target"></label>
        <div class="full pp-deals-checks"><label><input id="ppDealActive" type="checkbox"> Active / publish</label><label><input id="ppDealFeatured" type="checkbox"> Featured</label></div>
      </form>
      <div class="pp-deals-actions"><button id="ppDealSave" type="button">Save campaign</button><button id="ppDealReset" class="ghost" type="button">Clear form</button><button id="ppDealsRefresh" class="subtle" type="button">Refresh list</button></div>
      <p id="ppDealsMsg" class="muted" role="status"></p>
      <div class="pp-deals-guidance"><b>Paid Plus value rule:</b> partner offers can change, so do not rely on them alone. Keep at least one PricePulse-owned, always-available benefit live before charging customers; publish retailer/bank/reward claims only when funding and terms are verified.</div>
      <div id="ppDealsList" class="pp-deals-list"></div>`;
    anchor.insertAdjacentElement('afterend',section);
    $('ppDealSave').addEventListener('click',save);
    $('ppDealReset').addEventListener('click',reset);
    $('ppDealsRefresh').addEventListener('click',load);
    $('ppDealsList').addEventListener('click',listClick);
    document.querySelector('[data-admin-view="plus"]')?.addEventListener('click',()=>setTimeout(load,0));
    if(document.body.dataset.adminView==='plus')load();
    setTimeout(()=>{if(document.body.dataset.adminView==='plus')load()},900);
    setTimeout(()=>{if(document.body.dataset.adminView==='plus')load()},2200);
  }

  function setMsg(text,bad=false){const el=$('ppDealsMsg');if(!el)return;el.textContent=text||'';el.style.color=bad?'#a33':'#64756e'}
  function toIso(v){return v?new Date(v).toISOString():null}
  function toLocal(v){if(!v)return'';const d=new Date(v);if(!Number.isFinite(d.getTime()))return'';const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
  function reset(){['ppDealId','ppDealRetailer','ppDealValue','ppDealTitle','ppDealBenefit','ppDealCode','ppDealCampaign','ppDealExpiry','ppDealTerms','ppDealActionLabel','ppDealActionTarget'].forEach(id=>$(id).value='');$('ppDealType').value='exclusive_offer';$('ppDealSort').value='0';$('ppDealStart').value=toLocal(new Date().toISOString());$('ppDealActionKind').value='none';$('ppDealActive').checked=false;$('ppDealFeatured').checked=false;setMsg('')}
  function fill(r){$('ppDealId').value=r.id||'';$('ppDealType').value=r.offer_type;$('ppDealRetailer').value=r.retailer||'';$('ppDealValue').value=r.value_label||'';$('ppDealSort').value=Number(r.sort_order||0);$('ppDealTitle').value=r.title||'';$('ppDealBenefit').value=r.benefit_text||'';$('ppDealCode').value=r.coupon_code||'';$('ppDealCampaign').value=r.campaign_key||'';$('ppDealStart').value=toLocal(r.starts_at);$('ppDealExpiry').value=toLocal(r.expires_at);$('ppDealTerms').value=r.terms||'';$('ppDealActionKind').value=r.action_kind||'none';$('ppDealActionLabel').value=r.action_label||'';$('ppDealActionTarget').value=r.action_target||'';$('ppDealActive').checked=!!r.active;$('ppDealFeatured').checked=!!r.featured;window.scrollTo({top:Math.max(0,$('plusDealsManager').offsetTop-90),behavior:'smooth'})}
  function readiness(){const active=rows.filter(r=>r.active&&(!r.expires_at||new Date(r.expires_at)>new Date()));const cats=new Set(active.map(r=>r.offer_type));$('ppDealsActiveCount').textContent=active.length;$('ppDealsFeaturedCount').textContent=active.filter(r=>r.featured).length;$('ppDealsCategoryCount').textContent=`${cats.size}/4`;const owned=active.some(r=>String(r.retailer||'').toLowerCase()==='pricepulse'||r.offer_type==='plus_reward');$('ppDealsPaidReady').textContent=owned?'BASE VALUE LIVE':'NOT READY'}
  function render(){readiness();const list=$('ppDealsList');if(!rows.length){list.innerHTML='<div class="pp-deals-row"><div><h3>No campaigns yet</h3><p>Create a genuine Plus benefit above. Keep inactive until terms/funding are verified.</p></div></div>';return}list.innerHTML=rows.map(r=>`<article class="pp-deals-row" data-id="${h(r.id)}"><div><h3>${h(r.title)}</h3><p>${h(TYPES[r.offer_type]||r.offer_type)}${r.retailer?` · ${h(r.retailer)}`:''}${r.value_label?` · ${h(r.value_label)}`:''}</p><p>${h(r.benefit_text)}</p><div class="meta"><span class="pp-deals-chip ${r.active?'':'off'}">${r.active?'ACTIVE':'DRAFT'}</span>${r.featured?'<span class="pp-deals-chip">FEATURED</span>':''}${r.expires_at?`<span class="pp-deals-chip">Ends ${h(new Date(r.expires_at).toLocaleDateString('en-IN'))}</span>`:''}</div></div><div class="pp-deals-row-actions"><button type="button" data-edit>Edit</button><button type="button" class="danger-soft" data-delete>Delete</button></div></article>`).join('')}

  async function load(){if(typeof api==='undefined'||!api||typeof permitted==='undefined'||!permitted)return;setMsg('Loading Plus campaigns…');const q=await api.rpc('pp_admin_list_plus_member_deals');if(q.error){setMsg(/does not exist|schema cache/i.test(q.error.message||'')?'Install supabase-plus-member-deals-v145.sql once, then refresh.':q.error.message,true);return}rows=Array.isArray(q.data)?q.data:[];render();setMsg(`${rows.length} campaign${rows.length===1?'':'s'} loaded.`)}
  async function save(){if(typeof api==='undefined'||!api||!permitted){setMsg('Admin database access required.',true);return}const title=clean($('ppDealTitle').value),benefit=clean($('ppDealBenefit').value);if(!title||!benefit){setMsg('Offer title and member benefit are required.',true);return}const kind=$('ppDealActionKind').value;if(kind==='tracked_campaign'&&!clean($('ppDealCampaign').value)){setMsg('Tracked campaign actions need a Campaign key. Do not use a raw retailer URL.',true);return}const btn=$('ppDealSave'),old=btn.textContent;btn.disabled=true;btn.textContent='Saving…';const params={deal_id:clean($('ppDealId').value)||null,deal_type:$('ppDealType').value,deal_title:title,deal_benefit_text:benefit,deal_value_label:clean($('ppDealValue').value)||null,deal_retailer:clean($('ppDealRetailer').value)||null,deal_coupon_code:clean($('ppDealCode').value)||null,deal_campaign_key:clean($('ppDealCampaign').value)||null,deal_terms:clean($('ppDealTerms').value)||null,deal_starts_at:toIso($('ppDealStart').value)||new Date().toISOString(),deal_expires_at:toIso($('ppDealExpiry').value),deal_featured:$('ppDealFeatured').checked,deal_active:$('ppDealActive').checked,deal_sort_order:Number($('ppDealSort').value||0),deal_action_kind:kind,deal_action_label:clean($('ppDealActionLabel').value)||null,deal_action_target:clean($('ppDealActionTarget').value)||null};try{const q=await api.rpc('pp_admin_upsert_plus_member_deal',params);if(q.error)throw q.error;reset();await load();setMsg('Plus campaign saved. Active/date-valid campaigns are now available to eligible Plus members.')}catch(e){setMsg(e.message||String(e),true)}finally{btn.disabled=false;btn.textContent=old}}
  async function listClick(e){const row=e.target.closest('[data-id]');if(!row)return;const r=rows.find(x=>x.id===row.dataset.id);if(!r)return;if(e.target.closest('[data-edit]'))return fill(r);if(e.target.closest('[data-delete]')){if(!confirm(`Delete “${r.title}”?`))return;const q=await api.rpc('pp_admin_delete_plus_member_deal',{deal_id:r.id});if(q.error){setMsg(q.error.message,true);return}await load();setMsg('Campaign deleted.')}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
