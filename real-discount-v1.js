/* PricePulse AI-PLAN J — "real discount" badge on deal cards (useful on sale days, when "% off MRP" is everywhere).
   Uses the same Deal Score data (our verified price history): "Real drop X%" when the price is X% below its 30-day
   average, "Usual price" when a big "% off MRP" is really the normal price. No badge when we have < 3 checks. No AI. */
(function(){
  'use strict';
  if(window.__ppRealV1)return;window.__ppRealV1=true;
  const K=()=>window.ppLinkKit;
  function css(){if(document.getElementById('ppRealCss'))return;const st=document.createElement('style');st.id='ppRealCss';
    st.textContent='.ppr-tag{display:inline-block;margin:4px 0 0;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:800;letter-spacing:.02em}.ppr-tag.is-good{background:rgba(61,220,151,.16);color:#16774d}.ppr-tag.is-warn{background:rgba(240,180,41,.18);color:#8a5a00}';document.head.appendChild(st);}
  function paint(){
    const k=K();if(!k||typeof k.dealAnalysis!=='function')return;
    let did=false;
    for(const x of k.productIndex()){
      const card=x.card;if(!card||card.hidden||card.querySelector('.ppr-tag'))continue;
      const b=k.bestPrice(x);if(!Number.isFinite(b.price))continue;
      let sav=null;try{sav=b.state&&b.state.uniqueLowest&&typeof window.ppOfferSavings==='function'?window.ppOfferSavings(b.state.uniqueLowest):null;}catch(_){}
      let a=null;try{a=k.dealAnalysis(x.id,b.price,sav,b.stores);}catch(_){}
      if(!a||!a.real||a.real.tone==='plain')continue;
      css();did=true;
      const t=document.createElement('span');t.className='ppr-tag is-'+(a.real.tone==='good'?'good':'warn');
      t.textContent=a.real.tone==='good'?`Real drop ${a.realPct}%`:'Usual price';
      t.title=a.real.text+' (from our verified price history)';
      const spot=card.querySelector('.price, .deal-price, .ppx-pc-price, .product-price')||card.querySelector('h3, h4')||card;
      spot.insertAdjacentElement(spot===card?'beforeend':'afterend',t);
    }
    return did;
  }
  let t=0;const later=()=>{clearTimeout(t);t=setTimeout(paint,400);};
  new MutationObserver(later).observe(document.documentElement,{childList:true,subtree:true});later();
})();
