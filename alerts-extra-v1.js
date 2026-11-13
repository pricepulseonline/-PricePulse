/* PricePulse AI-PLAN Q10 + M + P8 — site side (needs supabase-alerts-extra-v1.sql + Edge Function alerts-extra).
   - Product page without an in-stock verified price: "Tell me when it's back in stock" (sign-in needed).
   - My Alerts page: "Get alerts on Telegram" (links your Telegram, once) + "Weekly price email" on/off. */
(function(){
  'use strict';
  if(window.__ppAlertsExtraV1)return;window.__ppAlertsExtraV1=true;
  const sb=()=>typeof supabaseClient!=='undefined'?supabaseClient:null;
  const signed=()=>{try{return typeof currentUser!=='undefined'&&!!currentUser;}catch(_){return false;}};
  const signIn=()=>document.getElementById('signInBtn')?.click();
  function css(){if(document.getElementById('ppAeCss'))return;const st=document.createElement('style');st.id='ppAeCss';
    st.textContent='.ppae-btn{display:inline-flex;align-items:center;gap:6px;margin:10px 0;border:1px solid #1f7a55;color:#1f7a55;background:#fff;border-radius:10px;padding:8px 14px;font:inherit;font-weight:700;cursor:pointer}.ppae-btn.on{background:#1f7a55;color:#fff}.ppae-card{margin:12px 0 16px;padding:14px 16px;border:1px solid #e3ebe7;border-radius:16px;background:#fff;display:flex;flex-wrap:wrap;gap:10px;align-items:center}.ppae-card b{flex-basis:100%;font-size:15px}.ppae-card small{flex-basis:100%;color:#64756e;font-size:12px}.ppae-card button{border:1px solid #cfe0d7;background:#f6fbf8;border-radius:10px;padding:8px 12px;font:inherit;font-weight:700;cursor:pointer}.ppae-card button.on{background:#1f7a55;color:#fff;border-color:#1f7a55}';document.head.appendChild(st);}
  async function rpc(n,a){const c=sb();if(!c)return null;try{const r=await c.rpc(n,a||{});return r.error?null:r.data;}catch(_){return null;}}
  // Q10
  async function stockBtn(){
    const m=/^#\/product\/([^?/]+)/.exec(location.hash);if(!m)return;const id=decodeURIComponent(m[1]);
    const page=document.querySelector('.ppx-product');if(!page||page.dataset.ppaeFor===id)return;
    const h1=page.querySelector('h1');if(!h1)return;
    const priced=page.querySelector('.ppx-hero-price b');
    if(priced&&/\d/.test(priced.textContent||''))return;          // has an in-stock verified price: nothing to do
    page.dataset.ppaeFor=id;css();
    const b=document.createElement('button');b.type='button';b.className='ppae-btn';b.textContent='🔔 Tell me when it\'s back in stock';
    const paint=on=>{b.classList.toggle('on',!!on);b.textContent=on?'✓ We\'ll tell you when it\'s back':'🔔 Tell me when it\'s back in stock';};
    if(signed()){const s=await rpc('pp_stock_alert_status',{p_product:id});if(s)paint(s.on);}
    b.addEventListener('click',async()=>{if(!signed()){signIn();return;}b.disabled=true;const r=await rpc('pp_stock_alert_toggle',{p_product:id,p_name:h1.textContent.trim()});b.disabled=false;if(r&&r.ok)paint(r.on);else b.textContent=r&&r.error==='max 20'?'You can watch 20 products at a time':'Could not save. Try again.';});
    h1.insertAdjacentElement('afterend',b);
  }
  // M + P8
  async function alertsCard(){
    if(!/^#\/alerts/.test(location.hash))return;
    const page=document.querySelector('.ppx-list-page')||document.querySelector('.ppx-product');if(!page||page.querySelector('.ppae-card'))return;
    css();const c=document.createElement('section');c.className='ppae-card';
    c.innerHTML=`<b>More ways to get your alerts</b><button type="button" data-ae="tg">Get alerts on Telegram</button><button type="button" data-ae="dg">Weekly price email: Off</button><small>Telegram: your price and back-in-stock alerts as a message. Weekly email: every Sunday, the prices of your wishlist and alert products. Switch off any time.</small>`;
    const host=page.querySelector('.ppx-adopt-host');if(host)host.insertAdjacentElement('afterend',c);else{const head=page.querySelector('h1');(head&&head.closest('header')||head||page.firstElementChild||page).insertAdjacentElement('afterend',c);}
    const tg=c.querySelector('[data-ae=tg]'),dg=c.querySelector('[data-ae=dg]');
    const paintTg=on=>{tg.classList.toggle('on',!!on);tg.textContent=on?'✓ Telegram alerts on (turn off)':'Get alerts on Telegram';tg.dataset.on=on?'1':'';};
    const paintDg=on=>{dg.classList.toggle('on',!!on);dg.textContent='Weekly price email: '+(on?'On':'Off');dg.dataset.on=on?'1':'';};
    if(signed()){const [a,b]=await Promise.all([rpc('pp_tg_link_status'),rpc('pp_digest_get')]);if(a)paintTg(a.linked);if(b)paintDg(b.on);}
    tg.addEventListener('click',async()=>{if(!signed()){signIn();return;}
      if(tg.dataset.on){const r=await rpc('pp_tg_unlink');if(r)paintTg(false);return;}
      const w=window.open('about:blank','_blank');const r=await rpc('pp_tg_link_code');
      if(r&&r.ok&&r.url){if(w)w.location=r.url;else location.href=r.url;tg.textContent='Press START in Telegram, then come back';setTimeout(async()=>{const s=await rpc('pp_tg_link_status');if(s)paintTg(s.linked);},20000);}
      else{if(w)w.close();tg.textContent=r&&r.error==='bot not set'?'Telegram alerts are coming soon':'Could not start. Try again.';}});
    dg.addEventListener('click',async()=>{if(!signed()){signIn();return;}const r=await rpc('pp_digest_set',{p_on:!dg.dataset.on});if(r&&r.ok)paintDg(r.on);});
  }
  let t=0;const later=()=>{clearTimeout(t);t=setTimeout(()=>{stockBtn().catch(()=>{});alertsCard().catch(()=>{});},400);};
  new MutationObserver(later).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',later);later();
})();
