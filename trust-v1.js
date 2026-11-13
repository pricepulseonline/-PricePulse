/* PricePulse AI-PLAN P5 (trust) + P7 (price-drop protection info) — site side.
   - Product page: "Report a wrong price" link under the best-price box (small form; needs supabase-trust-v1.sql).
   - New page #/how-we-check : how PricePulse checks prices (plain, true statements only). Linked from the footer and the form.
   - Product page: one info line about the store's return / price-protection window (general, no promises). */
(function(){
  'use strict';
  if(window.__ppTrustV1)return;window.__ppTrustV1=true;
  const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function css(){if(document.getElementById('ppTrustCss'))return;const st=document.createElement('style');st.id='ppTrustCss';
    st.textContent='.ppt-rep{margin:8px 0 0;font-size:12.5px}.ppt-rep>button{background:none;border:0;padding:0;color:#64756e;text-decoration:underline;cursor:pointer;font:inherit}.ppt-form{margin-top:8px;padding:10px;border:1px solid #e3ebe7;border-radius:12px;background:#fff;display:grid;gap:6px}.ppt-form input,.ppt-form select{font:inherit;padding:7px 9px;border:1px solid #d5e2db;border-radius:8px}.ppt-form .row{display:flex;gap:6px;flex-wrap:wrap}.ppt-form .row>*{flex:1;min-width:120px}.ppt-form button[type=submit]{background:#1f7a55;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer}.ppt-ok{color:#1f7a55;font-weight:700}.ppt-prot{margin:8px 0 0;font-size:12px;color:#64756e;line-height:1.45}.ppt-page{max-width:820px;margin:0 auto;padding:24px 16px 60px;line-height:1.65}.ppt-page h1{font-size:28px;margin:0 0 12px}.ppt-page h2{font-size:18px;margin:22px 0 6px}.ppt-page li{margin:4px 0}';document.head.appendChild(st);}
  function paint(){
    const m=/^#\/product\/([^?/]+)/.exec(location.hash);if(!m)return;
    const id=decodeURIComponent(m[1]);
    document.querySelectorAll('.ppx-hero').forEach(hero=>{
      if(hero.querySelector('.ppt-rep'))return;css();
      const stores=[...new Set([...document.querySelectorAll('[data-ppx-store],.ppx-offer-row [data-store],.ppx-store-name')].map(e=>e.dataset.ppxStore||e.dataset.store||e.textContent).map(s=>String(s||'').trim()).filter(s=>s&&s.length<40))].slice(0,12);
      const prot=document.createElement('p');prot.className='ppt-prot';
      prot.textContent='Bought already and the price fell? Many stores allow a return or cancellation in their return window - check the store\'s own return and price-protection rules.';
      const box=document.createElement('div');box.className='ppt-rep';
      box.innerHTML=`<button type="button">Price wrong? Report it</button>`;
      box.querySelector('button').addEventListener('click',()=>{
        if(box.querySelector('form'))return;
        const f=document.createElement('form');f.className='ppt-form';
        f.innerHTML=`<div class="row">${stores.length?`<select name="store"><option value="">Which store?</option>${stores.map(s=>`<option>${H(s)}</option>`).join('')}</select>`:`<input name="store" maxlength="60" placeholder="Store">`}<input name="price" inputmode="numeric" placeholder="Price you see (₹)"></div><input name="note" maxlength="300" placeholder="What is wrong? (optional)"><div class="row"><button type="submit">Send report</button></div><small>We check reports by hand. <a href="#/how-we-check">How we check prices</a></small>`;
        f.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f).entries());const b=f.querySelector('[type=submit]');b.disabled=true;b.textContent='Sending…';
          let ok=false;try{if(typeof supabaseClient!=='undefined'&&supabaseClient){const r=await supabaseClient.rpc('pp_price_report_add',{p_product:id,p_store:d.store||'',p_price:Number(String(d.price||'').replace(/[^\d.]/g,''))||null,p_note:d.note||'',p_url:location.href});ok=!r.error&&r.data&&r.data.ok;}}catch(_){}
          f.innerHTML=ok?'<p class="ppt-ok">Thanks! We will re-check this price.</p>':'<p>Could not send right now. Please try again later.</p>';});
        box.appendChild(f);
      });
      const anchor=hero.querySelector('.ppa-adv')||hero.querySelector('.ppx-hero-actions')||hero.lastElementChild;
      (anchor&&anchor.parentNode===hero?anchor:hero.lastElementChild).insertAdjacentElement('afterend',box);
      box.insertAdjacentElement('beforebegin',prot);
    });
  }
  const PAGE=`<div class="ppx-product ppx-list-page container"><article class="ppt-page">
    <h1>How PricePulse checks prices</h1>
    <p>We want you to trust every number you see here. This is exactly what each label means.</p>
    <h2>Verified</h2><ul><li>A PricePulse team member opened the store's own product page and checked the price, stock and variant.</li><li>Every verified price shows when it was checked. After 24 hours it is hidden until it is checked again.</li></ul>
    <h2>Seen</h2><ul><li>Prices seen by shoppers who use the PricePulse browser extension, on the store's page. They are never shown as "Verified".</li></ul>
    <h2>From the web</h2><ul><li>On Price Check, our system searches for the same product on other stores and reads the price from each store's page. We never use a price written by AI.</li><li>If a page cannot be read, we show "Check price on store" without a number. Prices in your area (quick-commerce apps) can be different.</li></ul>
    <h2>Deal Score and price history</h2><ul><li>Made only from our verified price checks. "Lowest in 30 days" is shown only when it is true. We do not show "% off MRP" as a real discount when the price is the usual one.</li><li>"Buy now or wait?" uses past prices only. We do not forecast sales.</li></ul>
    <h2>Money</h2><ul><li>Some store links earn us a commission at no extra cost to you. It never changes the order of prices: the cheapest store is shown first even when we earn nothing from it.</li></ul>
    <h2>Found a wrong price?</h2><p>Use "Price wrong? Report it" on the product page. We check every report by hand.</p>
  </article></div>`;
  function route(){if(typeof window.ppShowPage==='function'){window.ppShowPage('how-we-check',PAGE);document.title='How we check prices | PricePulse';}}
  function footer(){const info=document.querySelector('.footer .info-link[data-info="affiliate"]');if(info&&!document.getElementById('pptFootLink')){const a=document.createElement('a');a.id='pptFootLink';a.href='#/how-we-check';a.className='info-link';a.textContent='How we check prices';info.after(a);}}
  if(typeof window.ppRegisterRoute==='function')window.ppRegisterRoute('how-we-check',route);
  let t=0;const later=()=>{clearTimeout(t);t=setTimeout(()=>{paint();footer();},150);};
  new MutationObserver(later).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',later);later();
})();
