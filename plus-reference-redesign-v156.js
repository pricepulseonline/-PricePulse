/* PricePulse V78.8.150 — readable Plus membership page; V146 backend and feature lineage unchanged. */
let ppPlusPageView=null;
let ppPlusPageResizeTimer=null;

function ppClosePremiumPlusPage(){
  clearTimeout(ppPlusPageResizeTimer);
  ppPlusPageView?.remove();
  ppPlusPageView=null;
  document.body.classList.remove('pp-plus-page-open');
  document.body.style.removeProperty('overflow');
}
function ppPlusPageRows(){return [
  ['Price comparison, Wallet & normal rewards','Included','Included','yes'],
  ['Referral ₹100 + ₹100','Included','Included','yes'],
  ['Active Deal Alerts','1','Up to 3','plus'],
  ['Minimum Wallet redemption','₹100','₹25','plus'],
  ['₹100 Welcome Reward','—','Eligible first purchase','plus'],
  ['Extra Plus Reward Boost','—','Eligible campaigns','plus'],
  ['Member-only savings','Public offers','Exclusive offers','plus'],
  ['Plus Savings Tracker','—','Included','plus']
];}
function ppPlusPageTable(){return `<div class="pp-pg-table"><div class="pp-pg-cell pp-pg-th">Feature</div><div class="pp-pg-cell pp-pg-th">Free</div><div class="pp-pg-cell pp-pg-th pp-pg-plus">PricePulse Plus</div>${ppPlusPageRows().map(([f,free,plus,type])=>`<div class="pp-pg-cell">${escapeHTML(f)}</div><div class="pp-pg-cell ${free==='—'?'is-no':''}">${escapeHTML(free)}</div><div class="pp-pg-cell pp-pg-plus ${type==='yes'||type==='plus'?'is-yes':''}">${escapeHTML(plus)}</div>`).join('')}</div>`;}
function ppPlusCrownSVG(){return `<svg viewBox="0 0 120 80" aria-hidden="true"><defs><linearGradient id="ppPgGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a6"/><stop offset=".45" stop-color="#efc04f"/><stop offset="1" stop-color="#b8781d"/></linearGradient></defs><path d="M13 61 7 25l26 17L50 9l15 34 30-25-7 43z" fill="url(#ppPgGold)" stroke="#ffe8a0" stroke-width="2"/><rect x="15" y="60" width="75" height="11" rx="4" fill="#d99b2d" stroke="#ffe8a0" stroke-width="2"/></svg>`;}
function ppRdIcon(name){
  const paths={
    gift:'<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9C7 9 5 8 5 6s3-3 5-1l2 4Zm0 0c5 0 7-1 7-3s-3-3-5-1l-2 4Z"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4"/>',
    wallet:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M15 13h6M17 15h.01"/>',
    star:'<path d="m12 2 3 6.5 7 .9-5.2 4.8 1.4 7-6.2-3.5-6.2 3.5 1.4-7L2 9.4l7-.9L12 2Z"/>',
    check:'<path d="M5 12l4 4L19 6"/>',
    arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
    shield:'<path d="M12 2 4 5v6c0 6 4 9 8 11 4-2 8-5 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    crown:'<path d="m3 8 4 5 5-8 5 8 4-5-2 12H5L3 8Z"/><path d="M5 20h14"/>',
    coin:'<circle cx="12" cy="12" r="9"/><path d="M8 9h8M8 12h8m-5-6c5 0 5 6 0 6l5 6"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.star}</svg>`;
}
function ppRdCta(active,paused,label,extraClass=''){
  const action=active?'members':paused?'paused':'checkout';
  return `<button type="button" class="pp-rd-cta ${extraClass}" data-pp-pg-action="${action}" ${paused?'disabled':''}>${escapeHTML(label)} ${paused?'':ppRdIcon('arrow')}</button>`;
}
function ppRdActivePageHTML(){
  // Active state derives from the EXISTING, already authenticated membership/RPC;
  // never infer payment success from an Admin override or a static mockup.
  const master=ppNormalizePlusMaster(ppPlusMaster.mode);
  const own=ppNormalizePlusStatus(ppPlusMembership.status)==='active'&&!ppIndividualPlusExpired();
  const testAccess=master==='active'&&!own;
  const dateValue=master==='active'?ppPlusMaster.expires_at:ppPlusMembership.expires_at;
  const validTill=dateValue?ppFormatPlusDate(dateValue):'As per membership status';
  const fullName=String(currentProfile?.full_name||currentUser?.user_metadata?.full_name||'Plus Member').trim().slice(0,70)||'Plus Member';
  const displayName=escapeHTML(fullName);
  const firstName=escapeHTML((fullName.split(/\s+/)[0]||'Member').slice(0,35));
  const line=testAccess?'PLUS ACCESS ACTIVE · ADMIN TEST MODE':'YOUR PLUS MEMBERSHIP IS ACTIVE';
  return `<section id="ppPlusPage" class="pp-rd" aria-labelledby="ppPlusPageTitle">
    <div class="pp-rd-welcome">
      <div class="pp-rd-welcome-inner">
        
        <span class="pp-rd-member-check">${ppRdIcon('check')}</span>
        <span class="pp-rd-member-head">${line}</span>
        <h1 class="pp-rd-member-title" id="ppPlusPageTitle">Welcome to <em>Plus</em>, ${firstName}!</h1>
        <p class="pp-rd-member-description">${testAccess?'Plus features are currently enabled by Admin for testing. This does not confirm a paid subscription or qualify as a paid-member Welcome Reward.':'Your membership benefits are unlocked. Find great deals, set up Deal Alerts+ and track confirmed Plus rewards in your Wallet.'}</p>
        <div class="pp-rd-member-pass" aria-label="Active PricePulse Plus member pass">
          <div class="pp-rd-member-pass-top"><span class="pp-rd-member-brand">PricePulse <em>Plus</em><small>SAVINGS MEMBERSHIP</small></span><span class="pp-rd-member-active">${testAccess?'TEST ACCESS':'ACTIVE'}</span></div>
          <div class="pp-rd-member-chip" aria-hidden="true"></div>
          <div class="pp-rd-member-pass-footer"><div><small>MEMBER</small><strong>${displayName}</strong></div><div><small>VALID UNTIL</small><strong>${escapeHTML(validTill)}</strong></div></div>
        </div>
        <section class="pp-rd-welcome-reward" aria-label="Welcome Reward eligibility steps">
          <h2>YOUR ₹100 WELCOME REWARD · HOW IT WORKS</h2>
          <div class="pp-rd-welcome-steps">
            <div class="pp-rd-step ${own?'is-complete':''}"><i></i><b>${own?'Individual membership active':'Individual membership verification'}</b><small>${own?'Your individual membership is active.':'Paid-member reward requires your own verified individual membership.'}</small></div>
            <div class="pp-rd-step" data-pp-welcome-stage="purchase"><i></i><b>First eligible purchase</b><small>A qualifying purchase must clear confirmation and return checks.</small></div>
            <div class="pp-rd-step" data-pp-welcome-stage="reward"><i></i><b>₹100 Wallet Reward</b><small>Check Wallet for actual credit; it is never instant cashback.</small></div>
          </div>
        </section>
        <div class="pp-rd-member-actions"><button type="button" class="pp-rd-cta" data-pp-pg-action="shop">Start shopping ${ppRdIcon('arrow')}</button><button type="button" class="pp-rd-member-secondary" data-pp-pg-action="alerts">Set up your Deal Alerts+</button></div>
        <div class="pp-rd-member-links"><button type="button" data-pp-pg-action="members">Explore member-only deals →</button><button type="button" data-pp-pg-action="savings">View Wallet & Plus Savings →</button></div>
        <p class="pp-rd-member-terms">${testAccess?'Admin-controlled access is for testing. No payment or Wallet credit is implied.':'The Welcome Reward is subject to eligibility and verified purchase/return conditions. Actual Wallet transactions and earned savings are shown in Wallet.'}</p>
      </div>
    </div>
  </section>`;
}
function ppPlusPageHTML(){
  const active=ppPlusIsActive();
  if(active)return ppRdActivePageHTML();
  const masterMode=ppNormalizePlusMaster(ppPlusMaster.mode);
  const state=ppNormalizePlusStatus(ppPlusMembership.status);
  const effectiveExpiry=masterMode==='active'?ppPlusMaster.expires_at:ppPlusMembership.expires_at;
  const expiry=ppFormatPlusDate(effectiveExpiry);
  const paused=masterMode==='inactive';
  const primary=active?'Explore Member Deals':paused?'Plus temporarily paused':'Get Plus for ₹99/year';
  const join=ppRdCta(active,paused,primary);
  const footerJoin=ppRdCta(active,paused,active?'Explore Member Deals':primary,'pp-rd-cta--final');
  const compareJoin=ppRdCta(active,paused,active?'See Member Deals':primary,'pp-rd-cta--plan');
  const status=active?`<div class="pp-rd-status is-active">${ppRdIcon('check')} Your Plus membership is active${expiry?` · valid until ${escapeHTML(expiry)}`:''}</div>`:
    paused?`<div class="pp-rd-status is-paused">Membership access is temporarily paused by Admin.</div>`:
    state==='pending'?`<div class="pp-rd-status">Membership activation is pending.</div>`:
    state==='expired'?`<div class="pp-rd-status">Your previous membership period has ended. Renewal billing is not connected yet.</div>`:'';
  return `<section id="ppPlusPage" class="pp-rd" aria-labelledby="ppPlusPageTitle">
    <div class="pp-rd-hero">
      <div class="pp-rd-hero-inner">
        
        <div class="pp-rd-hero-copy">
          <span class="pp-rd-eyebrow">${ppRdIcon('crown')} PRICEPULSE PLUS · SAVINGS MEMBERSHIP</span>
          <h1 id="ppPlusPageTitle">Pay <span class="pp-rd-white">₹99.</span><br><span class="pp-rd-gold">Unlock ₹100 Welcome Reward.</span></h1>
          <p class="pp-rd-hero-desc">One small annual membership. More reasons to save every time you shop — better deal alerts, extra rewards and exclusive member offers.</p>
          <div class="pp-rd-hero-actions">${join}<button type="button" class="pp-rd-ghost" data-pp-pg-action="compare">Compare Free vs Plus ↓</button></div>
          ${status}
          <p class="pp-rd-hero-fine">₹100 Welcome Reward after your first eligible confirmed purchase and the applicable return/cancellation period. Terms apply.</p>
        </div>
        <div class="pp-rd-hero-visual" aria-label="PricePulse Plus premium savings membership card">
          <div class="pp-rd-aura"></div>
          <div class="pp-rd-premium-card">
            <div class="pp-rd-card-top"><div class="pp-rd-card-name"><span class="pp-rd-card-logo">${ppRdIcon('crown')}</span><span>PricePulse <em>Plus</em></span></div><span class="pp-rd-card-year">ANNUAL</span></div>
            <div class="pp-rd-card-center">PREMIUM<br><strong>SAVINGS MEMBERSHIP</strong></div>
            <div class="pp-rd-card-bottom"><span>MORE DEALS · MORE REWARDS</span><span class="pp-rd-card-glyph">✦</span></div>
            <div class="pp-rd-card-sheen"></div>
          </div>
          <div class="pp-rd-card-caption"><span>${ppRdIcon('bell')} 3 deal alerts</span><span>${ppRdIcon('gift')} Extra rewards</span><span>${ppRdIcon('star')} Member offers</span></div>
        </div>
      </div>
    </div>
    <div class="pp-rd-inner">
      <section class="pp-rd-equation" aria-label="Plus membership value illustration">
        <div class="pp-rd-eq-col"><span>YOU PAY</span><strong>₹99</strong><small>Annual membership</small></div>
        <span class="pp-rd-eq-symbol">→</span>
        <div class="pp-rd-eq-col is-green"><span>FIRST ELIGIBLE PURCHASE</span><strong>₹100</strong><small>Potential Welcome Reward</small></div>
        <span class="pp-rd-eq-symbol">=</span>
        <div class="pp-rd-eq-result"><span>YOUR POTENTIAL VALUE</span><strong>₹1 potential extra</strong><small>in Wallet reward value*</small></div>
        <p class="pp-rd-eq-note">*Reward is conditional, not instant cashback. Eligible purchase must be confirmed and clear returns/cancellations before wallet credit.</p>
      </section>
      <section class="pp-rd-benefit-section" id="ppPlusBenefits">
        <div class="pp-rd-section-head"><div><span class="pp-rd-overline">WHAT YOU UNLOCK</span><h2>Four ways Plus gives you more</h2></div><p>Smarter shopping benefits, beyond basic price comparison.</p></div>
        <div class="pp-rd-benefits">
          <article class="pp-rd-benefit"><span class="pp-rd-feature-stat"><strong>₹100</strong><small>WELCOME REWARD</small></span><span class="pp-rd-icon">${ppRdIcon('gift')}</span><h3>₹100 Welcome Reward</h3><p>Earn ₹100 in your PricePulse Wallet after your first eligible confirmed purchase clears the return window.</p><span class="pp-rd-benefit-foot">One eligible purchase can cover ₹99</span></article>
          <article class="pp-rd-benefit"><span class="pp-rd-feature-stat"><strong>3</strong><small>ACTIVE DEAL ALERTS</small></span><span class="pp-rd-icon">${ppRdIcon('bell')}</span><h3>Deal Alerts+</h3><p>Track up to 3 products at once. Free gets 1 active alert; Plus unlocks a richer alert experience.</p><span class="pp-rd-benefit-foot">1 Free alert → Up to 3 Plus alerts</span></article>
          <article class="pp-rd-benefit"><span class="pp-rd-feature-stat"><strong>₹25</strong><small>WALLET REDEMPTION FROM</small></span><span class="pp-rd-icon">${ppRdIcon('wallet')}</span><h3>Plus Reward Boost</h3><p>Extra rewards on eligible campaigns, special vouchers and earlier wallet redemption from ₹25.</p><span class="pp-rd-benefit-foot">More ways to use your Wallet</span></article>
          <article class="pp-rd-benefit"><span class="pp-rd-feature-stat"><strong>PLUS</strong><small>MEMBER ACCESS</small></span><span class="pp-rd-icon">${ppRdIcon('star')}</span><h3>Member-only Savings</h3><p>Get access to genuine Plus-only deals, selected coupons, eligible bank offers and early-access campaigns.</p><span class="pp-rd-benefit-foot">Exclusive when available</span></article>
        </div>
      </section>
      <section class="pp-rd-compare-section" id="ppPlusCompareInline">
        <div class="pp-rd-section-head is-center"><div><span class="pp-rd-overline">CHOOSE YOUR PLAN</span><h2>Free is good. <span>Plus is better.</span></h2></div><p>Everything Free offers stays free. Plus adds more ways to save.</p></div>
        <div class="pp-rd-plan-grid">
          <article class="pp-rd-plan is-free"><span class="pp-rd-plan-name">PricePulse Free</span><div class="pp-rd-plan-price">₹0 <small>forever</small></div><p>All the essentials for comparing prices and shopping smarter.</p><ul><li>${ppRdIcon('check')} Price comparisons across stores</li><li>${ppRdIcon('check')} Free Wallet & normal rewards</li><li>${ppRdIcon('check')} Referral rewards where eligible</li><li>${ppRdIcon('check')} 1 active Deal Alert</li><li>${ppRdIcon('check')} Wallet redemption from ₹100</li></ul><button type="button" class="pp-rd-free-btn" data-pp-pg-action="back">Continue with Free →</button></article>
          <article class="pp-rd-plan is-plus"><span class="pp-rd-best">BEST VALUE</span><span class="pp-rd-plan-name">PricePulse <em>Plus</em></span><div class="pp-rd-plan-price">₹99 <small>/ year</small></div><p>Everything in Free, plus benefits built to deliver extra value.</p><ul><li>${ppRdIcon('check')} <b>₹100 Welcome Reward</b> on eligible first purchase</li><li>${ppRdIcon('check')} <b>Up to 3</b> active Deal Alerts</li><li>${ppRdIcon('check')} Wallet redemption from <b>₹25</b></li><li>${ppRdIcon('check')} Extra rewards & selected special vouchers</li><li>${ppRdIcon('check')} Member-only offers & Savings Tracker</li></ul>${compareJoin}</article>
        </div>
        <details class="pp-rd-full-compare"><summary>See full Free vs Plus feature comparison <span>⌄</span></summary><div class="pp-rd-compare-matrix">${ppPlusPageTable()}</div></details>
      </section>
      <section class="pp-rd-tracker" id="ppPlusValue"><div><span class="pp-rd-overline">PLUS SAVINGS TRACKER</span><h2>Know when Plus pays for itself.</h2><p>${active?'Open your Wallet to review your confirmed Plus-specific savings and membership value.':'Your Plus Savings Tracker shows the ₹99 membership cost, earned Plus savings, and when you recover that cost.'}</p><button type="button" class="pp-rd-track-link" data-pp-pg-action="savings">${active?'View My Plus Savings':'Explore Savings Tracker'} ${ppRdIcon('arrow')}</button></div><div class="pp-rd-tracker-math" aria-label="Plus savings eligibility and Wallet tracking">
         <div class="pp-rd-track-stat"><small>MEMBERSHIP COST</small><b>₹99</b><span>Annual Plus plan</span></div>
         <span class="pp-rd-track-arrow" aria-hidden="true">→</span>
         <div class="pp-rd-track-stat is-potential"><small>POTENTIAL WELCOME REWARD</small><b>₹100</b><span>First eligible confirmed purchase*</span></div>
         <div class="pp-rd-track-progress" aria-label="Wallet tracks confirmed membership savings; potential rewards are not credited upfront"><span class="pp-rd-track-progress-bar"></span><span class="pp-rd-track-progress-label">CONFIRMED SAVINGS ARE TRACKED IN WALLET</span></div>
         <p>*Reward is conditional and subject to confirmation and return checks. Your real earned savings and ₹99 cost-recovery status appear in Wallet, never estimated here.</p>
       </div></section>
      <section class="pp-rd-faq" id="ppPlusFaq"><div class="pp-rd-section-head is-center"><div><span class="pp-rd-overline">GOOD TO KNOW</span><h2>Questions, answered.</h2></div></div><div class="pp-rd-faq-list">
        <details><summary>When will I receive my ₹100 Welcome Reward?</summary><p>After your first eligible confirmed purchase clears the applicable returns/cancellations window. It is a conditional wallet reward, not an instant checkout discount.</p></details>
        <details><summary>Does the Free Wallet stay free?</summary><p>Yes. PricePulse Wallet, normal rewards and price comparisons remain available to Free users. Plus adds eligible rewards and lower redemption thresholds.</p></details>
        <details><summary>How many Deal Alerts can I set?</summary><p>Free allows 1 active Deal Alert. Plus allows up to 3 active Deal Alerts, subject to the current alert rules.</p></details>
        <details><summary>Do I automatically get every bank offer or coupon?</summary><p>No. Member-only offers are subject to each retailer, bank or campaign's eligibility and availability. Final retailer checkout terms apply.</p></details>
        <details><summary>Can I pay ₹99 on this build?</summary><p>Not yet. Secure online payment checkout is still being connected. The existing checkout screen is a development preview and does not charge you.</p></details>
      </div></section>
      <section class="pp-rd-final"><span class="pp-rd-final-crown">${ppRdIcon('crown')}</span><span class="pp-rd-overline">READY FOR MORE VALUE?</span><h2>Shop smarter. <span>Save beyond the price tag.</span></h2><p>PricePulse Plus — ₹99 per year, with a ₹100 Welcome Reward after your first eligible confirmed purchase.</p>${footerJoin}<small>Purchase eligibility, reward-credit timing, campaign terms and cancellations/returns rules apply.</small></section>
    </div>
  </section>`;
}
async function ppRdRefreshVerifiedWelcomeReward(){
  // Read-only, user-scoped verification; never awards credits or changes membership.
  const holder=ppPlusPageView;
  if(!holder?.querySelector('.pp-rd-welcome')||!currentUser?.id||!supabaseClient)return;
  if(ppNormalizePlusStatus(ppPlusMembership.status)!=='active')return;
  try{
    const q=await supabaseClient.from('pp_wallet_transactions')
      .select('status,amount,unlocked_amount')
      .eq('user_id',currentUser.id).eq('entry_type','plus_welcome_reward')
      .order('created_at',{ascending:false}).limit(1);
    if(q.error||!q.data?.length||ppPlusPageView!==holder)return;
    const reward=q.data[0];
    const status=String(reward.status||'').toLowerCase();
    if(['reversed','cancelled','failed'].includes(status))return;
    const purchased=holder.querySelector('[data-pp-welcome-stage="purchase"]');
    const credit=holder.querySelector('[data-pp-welcome-stage="reward"]');
    if(purchased){purchased.classList.add('is-complete');const small=purchased.querySelector('small');if(small)small.textContent='Eligible purchase confirmed in your Wallet reward history.';}
    if(status==='available'&&Number(reward.unlocked_amount??reward.amount??0)>0&&credit){
      credit.classList.add('is-complete');
      const small=credit.querySelector('small');if(small)small.textContent='Welcome Reward confirmed. View the amount in Wallet.';
    }else if(credit){const small=credit.querySelector('small');if(small)small.textContent='Reward tracked; check Wallet for final availability.';}
  }catch(_){/* Restricted/unfinished Wallet setup: show safe explanatory steps. */}
}
function ppFitPremiumPlusPage(){
  // Keep the approved hero and the entire value strip inside the first desktop view.
  // Allocate spare first-view height to the existing hero (not blank white space below
  // the value strip). On narrow/short screens, preserve natural page scrolling.
  if(!ppPlusPageView)return;
  ppPlusPageView.style.removeProperty('height');
  document.body.style.removeProperty('overflow');
  const heroInner=ppPlusPageView.querySelector('.pp-rd-hero-inner');
  if(!heroInner)return; // Existing active-member screen stays unchanged.
  heroInner.style.removeProperty('min-height');
  const equation=ppPlusPageView.querySelector('.pp-rd-equation');
  const benefits=ppPlusPageView.querySelector('.pp-rd-benefit-section');
  if(!equation||!benefits||window.innerWidth<921)return;
  const baseHeight=heroInner.getBoundingClientRect().height;
  const benefitsTop=benefits.getBoundingClientRect().top+window.scrollY;
  const equationBottom=equation.getBoundingClientRect().bottom+window.scrollY;
  const visibleBottom=window.innerHeight;
  // Never push the value strip below the browser's visible bottom edge.
  // Allow enough flexible hero height on taller desktop monitors too, so the
  // benefits section does not start clipped into the first visible screen.
  const fitExtra=Math.max(0,Math.min(
    visibleBottom+3-benefitsTop,
    visibleBottom-10-equationBottom,
    340
  ));
  if(fitExtra>1)heroInner.style.minHeight=Math.ceil(baseHeight+fitExtra)+'px';
}
function ppBindPremiumPlusPage(){
  if(!ppPlusPageView)return;
  ppPlusPageView.querySelectorAll('[data-pp-pg-action]').forEach(btn=>btn.addEventListener('click',()=>{
    const action=btn.dataset.ppPgAction;
    if(action==='back'){ppClosePremiumPlusPage();window.scrollTo({top:0});document.querySelector('#signInBtn')?.focus();return;}
    if(action==='compare'){
      const box=ppPlusPageView.querySelector('#ppPlusCompareInline');
      if(box){
        // Sticky site header is not part of the target; never cover the compare heading.
        const sticky=document.querySelector('.site-header');
        const headerOffset=sticky?sticky.getBoundingClientRect().height:0;
        const targetY=Math.max(0,window.scrollY+box.getBoundingClientRect().top-headerOffset-14);
        window.scrollTo({top:targetY,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      }
      return;
    }
    if(action==='checkout'){openModal(ppPlusCheckoutHTML(),true);ppBindPlusPanelActions();return;}
    if(action==='members'){ppClosePremiumPlusPage();void ppOpenMemberDeals();return;}
    if(action==='shop'){ppClosePremiumPlusPage();window.scrollTo({top:0});return;}
    if(action==='alerts'){
      ppClosePremiumPlusPage();
      if(!currentUser||!profileComplete(currentProfile)){
        setPendingAuthAction({type:'deal-alerts-open'});
        if(currentUser)renderProfileForm(currentUser.email||'',currentProfile);else renderAuthStart();
      }else{void renderDealAlertsDashboard();}
      return;
    }
    if(action==='savings'){location.href='wallet.html#plus-savings';return;}
  }));
}
function ppRenderPremiumPlusPage(){
  closeModal();closeAccountPopover();
  if(typeof ppCloseMemberDeals==='function')ppCloseMemberDeals();
  ppClosePremiumPlusPage();
  const holder=document.createElement('div');holder.innerHTML=ppPlusPageHTML();ppPlusPageView=holder.firstElementChild;
  document.querySelector('main')?.prepend(ppPlusPageView);
  document.body.classList.add('pp-plus-page-open');
  window.scrollTo({top:0});ppBindPremiumPlusPage();requestAnimationFrame(ppFitPremiumPlusPage);void ppRdRefreshVerifiedWelcomeReward();
}
window.renderPlusPanel=ppRenderPremiumPlusPage;
if(typeof ppSyncPlusUI==='function'){const ppOriginalSyncPlusUI=ppSyncPlusUI;window.ppSyncPlusUI=function(){
  ppOriginalSyncPlusUI();
  if(document.body.classList.contains('pp-plus-page-open')&&ppPlusPageView){
    const alreadyActive=Boolean(ppPlusPageView.querySelector('.pp-rd-welcome'));
    const nextActive=ppPlusIsActive();
    const oldY=window.scrollY;
    ppRenderPremiumPlusPage();
    if(alreadyActive===nextActive&&oldY>0)requestAnimationFrame(()=>window.scrollTo({top:oldY}));
  }
};}
window.addEventListener('resize',()=>{clearTimeout(ppPlusPageResizeTimer);ppPlusPageResizeTimer=setTimeout(ppFitPremiumPlusPage,80)});
document.addEventListener('click',e=>{if(!document.body.classList.contains('pp-plus-page-open'))return;if(e.target.closest('.category-nav button,.brand,[data-scroll],#footerCategoriesLink,[data-account-action="signout"]'))ppClosePremiumPlusPage();},true);
document.querySelector('#siteSearch')?.addEventListener('submit',ppClosePremiumPlusPage,true);
document.querySelector('#searchInput')?.addEventListener('input',ppClosePremiumPlusPage,true);
