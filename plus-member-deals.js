/* PricePulse V78.8.145: protected Plus Member Deals feed.
 * Membership is verified server-side first, then genuine admin-published campaigns
 * are loaded through pp_get_my_plus_member_deals(). Public deals are never relabeled.
 */
let ppMemberDealsView=null;
let ppMemberDealsRequest=0;
let ppMemberDealsTimer=null;
let ppMemberDealsUser=null;
let ppMemberDealsExpiry=0;
let ppMemberDealsVerifiedAt=0;
let ppMemberDealsRows=[];

const PP_MD_TYPES={
  exclusive_offer:['Exclusive Member Offers','No exclusive member offers are available right now.'],
  plus_reward:['Plus Rewards','No Plus-only reward campaigns are available right now.'],
  coupon_bank:['Eligible Coupons & Bank Offers','No eligible member-only coupons or bank offers are available right now.'],
  early_access:['Early-access Campaigns','No early-access member campaigns are available right now.']
};

function ppCloseMemberDeals(){
  ppMemberDealsRequest++;
  clearInterval(ppMemberDealsTimer);
  ppMemberDealsTimer=null;
  ppMemberDealsView?.remove();
  ppMemberDealsView=null;
  ppMemberDealsUser=null;
  ppMemberDealsRows=[];
  document.body.classList.remove('pp-member-deals-open');
}

async function ppVerifyMemberDeals(){
  if(!supabaseClient||!currentUser?.id)return null;
  const uid=currentUser.id;
  const auth=await supabaseClient.auth.getUser();
  if(auth.error||auth.data?.user?.id!==uid)return null;
  const [own,master]=await Promise.all([
    supabaseClient.rpc('pp_get_my_plus_membership'),
    supabaseClient.rpc('pp_get_plus_master_control')
  ]);
  if(own.error||master.error||currentUser?.id!==uid)return null;
  const membership=(Array.isArray(own.data)?own.data[0]:own.data)||{status:'available'};
  const control=(Array.isArray(master.data)?master.data[0]:master.data)||{mode:'individual'};
  ppPlusMembership={...ppPlusMembership,...membership,status:ppNormalizePlusStatus(membership.status)};
  ppPlusMaster={...ppPlusMaster,...control,mode:ppNormalizePlusMaster(control.mode)};
  if(ppPlusMaster.mode==='active'&&!ppMasterIsActive())ppPlusMaster={mode:'individual',expires_at:null};
  if(ppIndividualPlusExpired())ppPlusMembership.status='expired';
  const expires=ppPlusMaster.mode==='active'?ppPlusMaster.expires_at:ppPlusMembership.expires_at;
  const expiry=expires?Date.parse(expires):0;
  if(!ppPlusIsActive()||(expires&&!Number.isFinite(expiry)))return {active:false};
  return {active:true,uid,expiry,expires};
}

async function ppFetchMemberDeals(){
  if(!supabaseClient)return {rows:[],error:true};
  const q=await supabaseClient.rpc('pp_get_my_plus_member_deals');
  if(q.error){console.warn('Plus Member Deals feed failed',q.error);return {rows:[],error:true};}
  return {rows:Array.isArray(q.data)?q.data:[],error:false};
}

function ppMdCopyButton(code){
  return code?`<button type="button" class="pp-md-copy" data-copy-member-code="${escapeHTML(code)}">Copy code</button>`:'';
}
function ppMdActionButton(row){
  if(row.action_kind==='internal_path'&&row.action_target){return `<button type="button" class="pp-md-action" data-member-action="internal" data-target="${escapeHTML(row.action_target)}">${escapeHTML(row.action_label||'View benefit')} →</button>`;}
  return '';
}
function ppMdDealCard(row){
  const ends=row.expires_at?`Ends ${escapeHTML(new Date(row.expires_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}))}`:'';
  return `<article class="pp-md-offer${row.featured?' featured':''}">
    <div class="pp-md-offer-top"><div>${row.retailer?`<span class="pp-md-retailer">${escapeHTML(row.retailer)}</span>`:''}<h3>${escapeHTML(row.title)}</h3></div>${row.value_label?`<strong class="pp-md-value">${escapeHTML(row.value_label)}</strong>`:''}</div>
    <p>${escapeHTML(row.benefit_text)}</p>
    ${row.coupon_code?`<div class="pp-md-code"><span><small>MEMBER CODE</small><b>${escapeHTML(row.coupon_code)}</b></span>${ppMdCopyButton(row.coupon_code)}</div>`:''}
    ${row.terms?`<p class="pp-md-terms">${escapeHTML(row.terms)}</p>`:''}
    <div class="pp-md-offer-foot">${ends?`<span>${ends}</span>`:'<span>Plus member benefit</span>'}${ppMdActionButton(row)}</div>
  </article>`;
}
function ppMdSection(type,rows){
  const [title,empty]=PP_MD_TYPES[type];
  const items=rows.filter(r=>r.offer_type===type);
  return `<section class="pp-md-card pp-md-section"><div class="pp-md-section-head"><h2>${title}</h2><span>${items.length||''}</span></div>${items.length?`<div class="pp-md-offers">${items.map(ppMdDealCard).join('')}</div>`:`<p>${empty}</p>`}</section>`;
}

function ppMemberDealsHTML(access,feedError=false){
  const has=ppMemberDealsRows.length>0;
  return `<div class="pp-md-heading"><div><p class="pp-md-eyebrow">PRICEPULSE PLUS ★</p><h1 id="ppMemberDealsTitle" tabindex="-1">PricePulse Plus Member Deals</h1><p>Benefits reserved for eligible Plus members.</p></div><button type="button" data-member-deals-back>Back to shopping →</button></div>
    <div class="pp-md-status"><span aria-hidden="true">★</span><div><strong>Premium membership active</strong><p>${access.expires?`Active until ${escapeHTML(ppFormatPlusDate(access.expires))}`:'Expiry date not provided'}</p></div><span class="pp-md-badge">ACTIVE</span></div>
    ${feedError?`<div class="pp-md-empty"><span aria-hidden="true">◇</span><h2>Member offers are temporarily unavailable</h2><p>Please try again in a moment.</p></div>`:has?'':`<div class="pp-md-empty"><span aria-hidden="true">◇</span><h2>No member-only deals available right now</h2><p>New Plus offers will appear here.</p></div>`}
    <div class="pp-md-grid">${Object.keys(PP_MD_TYPES).map(type=>ppMdSection(type,ppMemberDealsRows)).join('')}</div>`;
}

function ppBindMemberDealsActions(){
  if(!ppMemberDealsView)return;
  ppMemberDealsView.querySelector('[data-member-deals-back]')?.addEventListener('click',()=>{ppCloseMemberDeals();document.querySelector('#homeNavBtn')?.focus();window.scrollTo({top:0})});
  ppMemberDealsView.querySelectorAll('[data-copy-member-code]').forEach(btn=>btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(btn.dataset.copyMemberCode);showToast('Member code copied.')}catch(_){showToast('Could not copy the code.')}}));
  ppMemberDealsView.querySelectorAll('[data-member-action="internal"]').forEach(btn=>btn.addEventListener('click',()=>{
    const target=String(btn.dataset.target||'').trim(); if(!target)return;
    ppCloseMemberDeals();
    if(target.startsWith('#')){const el=document.querySelector(target);if(el)el.scrollIntoView({behavior:'smooth'});else location.hash=target;return;}
    if(!/^https?:/i.test(target)&&!target.startsWith('//'))location.href=target;
  }));
}

async function ppOpenMemberDeals(){
  const request=++ppMemberDealsRequest;
  const btn=document.querySelector('[data-plus-action="members"]');
  if(btn)setBusy(btn,true,'Checking membership…');
  let access=null,feed={rows:[],error:false};
  try{access=await ppVerifyMemberDeals();if(access?.active)feed=await ppFetchMemberDeals()}catch(err){console.warn('Member Deals verification failed',err);feed.error=true}
  if(btn)setBusy(btn,false);
  if(request!==ppMemberDealsRequest)return;
  if(!access?.active){ppCloseMemberDeals();renderPlusPanel();if(!access)showToast('Could not verify Plus membership. Please try again.');return;}
  ppMemberDealsRows=feed.rows;
  closeModal();closeAccountPopover();ppCloseMemberDeals();
  ppMemberDealsRows=feed.rows;
  ppMemberDealsUser=access.uid;ppMemberDealsExpiry=access.expiry;ppMemberDealsVerifiedAt=Date.now();
  ppMemberDealsView=document.createElement('section');ppMemberDealsView.id='ppMemberDeals';ppMemberDealsView.className='container';ppMemberDealsView.setAttribute('aria-labelledby','ppMemberDealsTitle');
  ppMemberDealsView.innerHTML=ppMemberDealsHTML(access,feed.error);
  document.querySelector('main').prepend(ppMemberDealsView);document.body.classList.add('pp-member-deals-open');ppBindMemberDealsActions();window.scrollTo({top:0});ppMemberDealsView.querySelector('h1')?.focus({preventScroll:true});
  ppMemberDealsTimer=setInterval(()=>{if(!ppMemberDealsView||ppMemberDealsView.hidden)return;if(currentUser?.id!==ppMemberDealsUser||!ppPlusIsActive()||(ppMemberDealsExpiry&&Date.now()>=ppMemberDealsExpiry)){ppCloseMemberDeals();if(ppIndividualPlusExpired())ppPlusMembership.status='expired';renderPlusPanel();}else if(Date.now()-ppMemberDealsVerifiedAt>=60000){void ppRecheckMemberDeals()}},1000);
}

async function ppRecheckMemberDeals(){
  if(!ppMemberDealsView)return;
  const request=++ppMemberDealsRequest;ppMemberDealsVerifiedAt=Date.now();ppMemberDealsView.hidden=true;
  let access=null,feed={rows:[],error:false};
  try{access=await ppVerifyMemberDeals();if(access?.active)feed=await ppFetchMemberDeals()}catch(_){feed.error=true}
  if(request!==ppMemberDealsRequest||!ppMemberDealsView)return;
  if(!access?.active||access.uid!==ppMemberDealsUser){ppCloseMemberDeals();renderPlusPanel();if(!access)showToast('Could not verify Plus membership. Please try again.');return;}
  ppMemberDealsRows=feed.rows;ppMemberDealsExpiry=access.expiry;ppMemberDealsView.innerHTML=ppMemberDealsHTML(access,feed.error);ppBindMemberDealsActions();ppMemberDealsView.hidden=false;
}

document.addEventListener('click',e=>{if(e.target.closest('.category-nav button,.brand,[data-scroll],#footerCategoriesLink,[data-account-action="signout"]'))ppCloseMemberDeals();},true);
document.querySelector('#siteSearch')?.addEventListener('submit',ppCloseMemberDeals,true);
document.querySelector('#searchInput')?.addEventListener('input',ppCloseMemberDeals,true);
window.addEventListener('focus',()=>{void ppRecheckMemberDeals()});
document.addEventListener('visibilitychange',()=>{if(!ppMemberDealsView)return;if(document.hidden)ppMemberDealsView.hidden=true;else void ppRecheckMemberDeals();});
