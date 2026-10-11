/* PricePulse V78.8.147-chat — Plus membership full-page view, built on V78.8.146. */
let ppPlusPageView=null;
let ppPlusPageResizeTimer=null;

function ppClosePremiumPlusPage(){
  clearTimeout(ppPlusPageResizeTimer);
  ppPlusPageView?.remove();
  ppPlusPageView=null;
  document.body.classList.remove('pp-plus-page-open');
  document.body.style.removeProperty('overflow');
}

function ppPlusPageRows(){
  return [
    ['Price comparison, Wallet & normal rewards','Included','Included','yes'],
    ['Referral ₹100 + ₹100','Included','Included','yes'],
    ['Active Deal Alerts','1','Up to 3','plus'],
    ['Minimum Wallet redemption','₹100','₹25','plus'],
    ['₹100 Welcome Reward','—','Eligible first purchase','plus'],
    ['Extra Plus Reward Boost','—','Eligible campaigns','plus'],
    ['Member-only savings','Public offers','Exclusive offers','plus'],
    ['Plus Savings Tracker','—','Included','plus']
  ];
}
function ppPlusPageTable(){
  const rows=ppPlusPageRows();
  return `<div class="pp-pg-table">
    <div class="pp-pg-cell pp-pg-th">Feature</div><div class="pp-pg-cell pp-pg-th">Free</div><div class="pp-pg-cell pp-pg-th pp-pg-plus">PricePulse Plus</div>
    ${rows.map(([f,free,plus,type])=>`<div class="pp-pg-cell">${escapeHTML(f)}</div><div class="pp-pg-cell ${free==='—'?'is-no':''}">${escapeHTML(free)}</div><div class="pp-pg-cell pp-pg-plus ${type==='yes'||type==='plus'?'is-yes':''}">${escapeHTML(plus)}</div>`).join('')}
  </div>`;
}
function ppPlusCrownSVG(){
  return `<svg viewBox="0 0 120 80" aria-hidden="true"><defs><linearGradient id="ppPgGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a6"/><stop offset=".45" stop-color="#efc04f"/><stop offset="1" stop-color="#b8781d"/></linearGradient></defs><path d="M13 61 7 25l26 17L50 9l15 34 30-25-7 43z" fill="url(#ppPgGold)" stroke="#ffe8a0" stroke-width="2"/><rect x="15" y="60" width="75" height="11" rx="4" fill="#d99b2d" stroke="#ffe8a0" stroke-width="2"/></svg>`;
}
function ppPlusPageHTML(){
  const active=ppPlusIsActive();
  const masterMode=ppNormalizePlusMaster(ppPlusMaster.mode);
  const state=ppNormalizePlusStatus(ppPlusMembership.status);
  const effectiveExpiry=masterMode==='active'?ppPlusMaster.expires_at:ppPlusMembership.expires_at;
  const expiry=ppFormatPlusDate(effectiveExpiry);
  const paused=masterMode==='inactive';
  const activeLine=active?`<div class="pp-pg-active-line"><i></i>Premium membership active${expiry?` · until ${escapeHTML(expiry)}`:''}</div>`:'';
  const primary=active?'Explore Member Deals →':paused?'Plus temporarily paused':'Get PricePulse Plus — ₹99/year →';
  const primaryAction=active?'members':paused?'paused':'checkout';
  const priceBlock=active?`<div class="pp-pg-price"><strong>₹99</strong><span>/year membership</span></div>`:`<div class="pp-pg-price"><strong>₹99</strong><span>/year</span></div>`;
  const panelButton=active?'View Plus Savings':'See Plus Benefits';
  const panelAction=active?'savings':'compare';
  const statusNote=state==='pending'&&!active?'Membership setup is pending. Your benefits activate under the eligible purchase rule.':state==='expired'&&!active?'Previous membership period completed. Renewal billing will be connected with checkout.':'';
  return `<section id="ppPlusPage" aria-labelledby="ppPlusPageTitle">
    <div class="pp-pg-hero">
      <button type="button" class="pp-pg-back" data-pp-pg-action="back">Back to shopping ↗</button>
      <div class="pp-pg-copy">
        <p class="pp-pg-kicker">Savings Membership</p>
        <h1 class="pp-pg-title" id="ppPlusPageTitle">Price<span>Pulse</span> <em>Plus</em></h1>
        <p class="pp-pg-tagline">A small membership. Bigger savings.</p>
        ${priceBlock}${activeLine}
        <div class="pp-pg-actions"><button type="button" class="pp-pg-primary" data-pp-pg-action="${primaryAction}" ${paused?'disabled':''}>${primary}</button><button type="button" class="pp-pg-link" data-pp-pg-action="compare">Compare Free vs Plus</button></div>
        ${statusNote?`<p style="margin:8px 0 0;color:#e6c773;font-size:10px">${escapeHTML(statusNote)}</p>`:''}
      </div>
      <div class="pp-pg-stage" aria-hidden="true">
        <div class="pp-pg-halo"></div><div class="pp-pg-orbit"></div><div class="pp-pg-pedestal"></div>
        <div class="pp-pg-crown">${ppPlusCrownSVG()}</div>
        <div class="pp-pg-member-card"><img src="logo-icon.png" alt=""><strong>Price<span>Pulse</span> <em>Plus</em></strong><small>SAVINGS MEMBERSHIP • ₹99 / YEAR</small></div>
      </div>
    </div>
    <div class="pp-pg-content">
      <div class="pp-pg-benefits">
        <article class="pp-pg-benefit"><span class="pp-pg-benefit-icon">₹</span><div><b>₹100 Welcome Reward</b><p>After your first eligible confirmed purchase clears returns and cancellations.</p></div></article>
        <article class="pp-pg-benefit"><span class="pp-pg-benefit-icon">♢</span><div><b>Deal Alerts+</b><p>1 active alert on Free. Up to 3 with Plus plus priority alert experiences.</p></div></article>
        <article class="pp-pg-benefit"><span class="pp-pg-benefit-icon">★</span><div><b>Extra Plus Rewards</b><p>Extra eligible rewards, Plus-only campaigns and special vouchers.</p></div></article>
        <article class="pp-pg-benefit"><span class="pp-pg-benefit-icon">◇</span><div><b>Member-only Savings</b><p>Exclusive offers, eligible coupons/bank offers and early-access campaigns.</p></div></article>
      </div>
      <div class="pp-pg-lower">
        <section class="pp-pg-compare" id="ppPlusCompareInline"><div class="pp-pg-compare-head"><h2>More value with Plus</h2><span>Free vs PricePulse Plus</span></div>${ppPlusPageTable()}</section>
        <aside class="pp-pg-value-panel"><small>PLUS SAVINGS TRACKER</small><h2>${active?'Your Plus value':'Why upgrade?'}</h2><div class="pp-pg-value-math"><div><span>Membership cost</span><strong>₹99 <i>/ year</i></strong></div><div class="is-green"><span>${active?'Savings status':'Welcome value'}</span><strong>${active?'Wallet':'₹100'}</strong></div></div><p>${active?'Confirmed Plus-specific value is tracked in your Wallet so you can see when the membership pays for itself.':'One eligible confirmed purchase can recover your ₹99 membership cost through the ₹100 Plus Welcome Reward.'}</p><p><b>More rewards. Smaller redemptions. Member-only value.</b></p><button type="button" class="pp-pg-panel-action" data-pp-pg-action="${panelAction}">${panelButton} →</button></aside>
      </div>
      <div class="pp-pg-reassure"><div><strong>✓ Your earned rewards stay yours</strong><span>Wallet remains open to everyone. Plus adds more value — it does not lock your existing rewards.</span></div><span>Campaign eligibility, purchase confirmation and return rules apply.</span></div>
    </div>
  </section>`;
}

function ppFitPremiumPlusPage(){
  if(!ppPlusPageView)return;
  if(window.innerWidth<900){document.body.style.removeProperty('overflow');ppPlusPageView.style.removeProperty('height');return;}
  const top=ppPlusPageView.getBoundingClientRect().top;
  const available=Math.floor(window.innerHeight-top);
  if(available>=620){ppPlusPageView.style.height=`${available}px`;document.body.style.overflow='hidden';}
  else{ppPlusPageView.style.removeProperty('height');document.body.style.removeProperty('overflow');}
}
function ppBindPremiumPlusPage(){
  if(!ppPlusPageView)return;
  ppPlusPageView.querySelectorAll('[data-pp-pg-action]').forEach(btn=>btn.addEventListener('click',()=>{
    const action=btn.dataset.ppPgAction;
    if(action==='back'){ppClosePremiumPlusPage();window.scrollTo({top:0});document.querySelector('#signInBtn')?.focus();return;}
    if(action==='compare'){const box=ppPlusPageView.querySelector('#ppPlusCompareInline');box?.classList.remove('pp-pg-flash');void box?.offsetWidth;box?.classList.add('pp-pg-flash');box?.focus?.({preventScroll:true});return;}
    if(action==='checkout'){openModal(ppPlusCheckoutHTML(),true);ppBindPlusPanelActions();return;}
    if(action==='members'){ppClosePremiumPlusPage();void ppOpenMemberDeals();return;}
    if(action==='savings'){location.href='wallet.html#plus-savings';return;}
  }));
}
function ppRenderPremiumPlusPage(){
  closeModal();closeAccountPopover();
  if(typeof ppCloseMemberDeals==='function')ppCloseMemberDeals();
  ppClosePremiumPlusPage();
  ppPlusPageView=document.createElement('section');
  ppPlusPageView.innerHTML=ppPlusPageHTML();
  const shell=ppPlusPageView.firstElementChild;ppPlusPageView=shell;
  document.querySelector('main')?.prepend(ppPlusPageView);
  document.body.classList.add('pp-plus-page-open');
  window.scrollTo({top:0});
  ppBindPremiumPlusPage();
  requestAnimationFrame(ppFitPremiumPlusPage);
  ppPlusPageView.querySelector('h1')?.focus?.({preventScroll:true});
}

/* Override only the Plus membership presentation. Existing state/backend functions stay untouched. */
window.renderPlusPanel=ppRenderPremiumPlusPage;

/* Repaint the inline page when a live Plus state refresh occurs. */
if(typeof ppSyncPlusUI==='function'){
  const ppOriginalSyncPlusUI=ppSyncPlusUI;
  window.ppSyncPlusUI=function(){ppOriginalSyncPlusUI();if(document.body.classList.contains('pp-plus-page-open')&&ppPlusPageView)ppRenderPremiumPlusPage();};
}
window.addEventListener('resize',()=>{clearTimeout(ppPlusPageResizeTimer);ppPlusPageResizeTimer=setTimeout(ppFitPremiumPlusPage,80)});
document.addEventListener('click',e=>{if(!document.body.classList.contains('pp-plus-page-open'))return;if(e.target.closest('.category-nav button,.brand,[data-scroll],#footerCategoriesLink,[data-account-action="signout"]'))ppClosePremiumPlusPage();},true);
document.querySelector('#siteSearch')?.addEventListener('submit',ppClosePremiumPlusPage,true);
document.querySelector('#searchInput')?.addEventListener('input',ppClosePremiumPlusPage,true);
