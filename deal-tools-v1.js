/* PricePulse AI-PLAN Q3 (no-cost EMI truth) + R1 (share-my-deal card) — product page, under the best-price box.
   Q3: a small calculator. "No-cost" EMI: the bank still charges interest; the store gives it back as a discount, but you
       pay the processing fee + 18% GST on that interest. Clearly an ESTIMATE from the numbers the shopper enters.
   R1: "Share this deal" makes a picture (1080x1080) with the price, store and only TRUE facts from our verified history,
       shared through the phone's share sheet or downloaded. No AI, no cost. */
(function(){
  'use strict';
  if(window.__ppDealToolsV1)return;window.__ppDealToolsV1=true;
  const M=n=>'₹'+Math.round(n).toLocaleString('en-IN');
  const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function css(){if(document.getElementById('ppDtCss'))return;const st=document.createElement('style');st.id='ppDtCss';
    st.textContent='.ppdt{margin:10px 0 0;display:flex;flex-wrap:wrap;gap:8px}.ppdt>button{border:1px solid #d5e2db;background:#fff;border-radius:99px;padding:6px 12px;font:inherit;font-size:12.5px;cursor:pointer}.ppdt-emi{flex-basis:100%;padding:10px;border:1px solid #e3ebe7;border-radius:12px;background:#fff;font-size:13px;line-height:1.5}.ppdt-emi .row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}.ppdt-emi label{display:flex;flex-direction:column;font-size:11.5px;color:#64756e;flex:1;min-width:110px}.ppdt-emi input,.ppdt-emi select{font:inherit;padding:6px 8px;border:1px solid #d5e2db;border-radius:8px;color:#10211b}.ppdt-out b{color:#c2410c}.ppdt-emi small{color:#64756e}';document.head.appendChild(st);}
  // interest of a reducing-balance loan: EMI*n - P
  function emiCost(P,ratePa,n,fee){const r=ratePa/1200;const emi=r?P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):P/n;const interest=Math.max(0,emi*n-P);const gst=interest*0.18;return {interest,gst,fee,extra:gst+fee,emi:P/n};}
  function emiBox(price){
    const d=document.createElement('div');d.className='ppdt-emi';
    d.innerHTML=`<b>No-cost EMI: what it really costs</b><div class="row"><label>Months<select name="n"><option>3</option><option selected>6</option><option>9</option><option>12</option></select></label><label>Bank interest % a year<input name="r" inputmode="decimal" value="16"></label><label>Processing fee ₹<input name="f" inputmode="numeric" value="199"></label></div><p class="ppdt-out"></p><small>Estimate. The interest is given back as a discount, but banks add 18% GST on that interest and a processing fee. Check your bank's exact numbers. Paying in full may also get a bigger instant discount.</small>`;
    const run=()=>{const n=Number(d.querySelector('[name=n]').value)||6,r=Number(String(d.querySelector('[name=r]').value).replace(/[^\d.]/g,''))||0,f=Number(String(d.querySelector('[name=f]').value).replace(/[^\d.]/g,''))||0;const c=emiCost(price,r,n,f);
      d.querySelector('.ppdt-out').innerHTML=`${n} × ${M(c.emi)} a month. Extra you pay: <b>${M(c.extra)}</b> (GST ${M(c.gst)} on ${M(c.interest)} interest + fee ${M(c.fee)}). Real cost: <b>${M(price+c.extra)}</b>.`;};
    d.addEventListener('input',run);d.addEventListener('change',run);run();return d;
  }
  function shareCard(x){
    const cv=document.createElement('canvas');cv.width=1080;cv.height=1080;const c=cv.getContext('2d');
    const g=c.createLinearGradient(0,0,1080,1080);g.addColorStop(0,'#0E2231');g.addColorStop(1,'#0A2A26');c.fillStyle=g;c.fillRect(0,0,1080,1080);
    c.fillStyle='#fff';c.font='800 50px Manrope,system-ui,sans-serif';c.fillText('Price',80,130);const w=c.measureText('Price').width;c.fillStyle='#3DDC97';c.fillText('Pulse',80+w,130);
    c.fillStyle='#C7D6D0';c.font='700 40px Manrope,system-ui,sans-serif';c.fillText('Found a real deal 🎉',80,260);
    c.fillStyle='#fff';c.font='800 52px Manrope,system-ui,sans-serif';
    const words=String(x.name).split(' ');let line='',y=360,lines=0;for(const t of words){const tr=line?line+' '+t:t;if(c.measureText(tr).width>920&&line){c.fillText(line,80,y);y+=64;line=t;if(++lines===3){line+='…';break;}}else line=tr;}if(lines<3)c.fillText(line,80,y);
    y+=150;c.fillStyle='#3DDC97';c.font='800 130px Sora,Manrope,system-ui,sans-serif';c.fillText(M(x.price),80,y);
    c.fillStyle='#E8B954';c.font='700 44px Manrope,system-ui,sans-serif';c.fillText(x.store?'on '+x.store:'',80,y+70);
    if(x.fact){c.fillStyle='#F0B429';c.font='800 46px Manrope,system-ui,sans-serif';c.fillText('📉 '+x.fact,80,y+170);}
    c.fillStyle='#C7D6D0';c.font='600 30px Manrope,system-ui,sans-serif';c.fillText(`Checked on PricePulse${x.date?' · '+x.date:''} · price-pulse.in`,80,1000);
    return cv;
  }
  function paint(){
    const m=/^#\/product\/([^?/]+)/.exec(location.hash);if(!m)return;const id=decodeURIComponent(m[1]);
    document.querySelectorAll('.ppx-hero').forEach(hero=>{
      if(hero.querySelector('.ppdt'))return;
      const price=Number(String((hero.querySelector('.ppx-hero-price b')||{}).textContent||'').replace(/[^\d.]/g,''));if(!(price>0))return;
      css();
      const bar=document.createElement('div');bar.className='ppdt';
      bar.innerHTML=`<button type="button" data-dt="emi">No-cost EMI real cost</button><button type="button" data-dt="share">Share this deal</button>`;
      bar.addEventListener('click',async e=>{const b=e.target.closest('[data-dt]');if(!b)return;
        if(b.dataset.dt==='emi'){const o=bar.querySelector('.ppdt-emi');if(o){o.remove();return;}bar.appendChild(emiBox(price));return;}
        const name=(document.querySelector('.ppx-product h1')||{}).textContent||document.title.replace(/\s*\|.*$/,'');
        const where=(hero.querySelector('.ppx-hero-actions .ppx-btn-primary')||{}).textContent||'';const store=(where.match(/ on (.+?)\s*[↗]?$/)||[])[1]||'';
        let fact='';try{const f=window.ppAdvice&&window.ppAdvice.facts(id,price);if(f){if(price<=f.low.price)fact=`Lowest price in ${f.days} days`;else if(f.pct>=3)fact=`${f.pct}% below its 30-day average`;}}catch(_){}
        const cv=shareCard({name:name.trim().slice(0,120),price,store:store.trim(),fact,date:new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short'})});
        cv.toBlob(async blob=>{if(!blob)return;const file=new File([blob],`pricepulse-${id}.png`,{type:'image/png'});const url=location.origin+'/p/'+encodeURIComponent(id)+'/';
          try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text:`${name.trim()} at ${M(price)} ${store?'on '+store:''} - checked on PricePulse ${url}`});return;}}catch(_){return;}
          const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);},'image/png');
      });
      const after=hero.querySelector('.ppt-rep')||hero.querySelector('.ppa-adv')||hero.querySelector('.ppx-hero-actions');
      if(after&&after.parentNode===hero)after.insertAdjacentElement('afterend',bar);else hero.appendChild(bar);
    });
  }
  let t=0;const later=()=>{clearTimeout(t);t=setTimeout(paint,260);};
  new MutationObserver(later).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',later);later();
  window.ppDealTools={emiCost};
})();
