/* PricePulse AI-PLAN C — "Buy now or wait?" on the product page (2 short lines under the Deal Score).
   Built ONLY from our own verified price history (the same data as the chart and the Deal Score). No AI call, no cost,
   nothing guessed: no sale predictions, no future prices. Shown when the product has at least 3 verified checks. */
(function(){
  'use strict';
  if(window.__ppAdviceV1)return;window.__ppAdviceV1=true;
  const DAY=864e5;
  const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const M=n=>'₹'+Math.round(n).toLocaleString('en-IN');
  const day=t=>new Date(t).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  const K=()=>window.ppLinkKit;

  function facts(id,price){
    const k=K();if(!k||typeof k.lowestSeries!=='function')return null;
    const s=(k.lowestSeries(id)||[]).filter(x=>Number.isFinite(x.price)&&x.price>0);
    if(s.length<3)return null;
    const now=Date.now(),last30=s.filter(x=>now-x.time<=30*DAY);
    const pts=last30.length>=2?last30:s;
    const avg=pts.reduce((a,x)=>a+x.price,0)/pts.length;
    const low=s.reduce((a,x)=>x.price<a.price?x:a,s[0]);
    const high=Math.max(...s.map(x=>x.price));
    const days=Math.max(1,Math.round((now-s[0].time)/DAY));
    return {n:s.length,days,avg,low,high,price,pct:Math.round((avg-price)/avg*1000)/10};
  }
  // the verdict follows the Deal Score already on the page, so the two never disagree
  // P9: Hinglish option (shopper's choice, remembered on this device)
  const getLang=()=>{try{return localStorage.getItem('ppLang')==='hi'?'hi':'en';}catch(_){return 'en';}};
  const setLang=l=>{try{localStorage.setItem('ppLang',l);}catch(_){}};
  function lines(f,score,lang){
    const hi=lang==='hi';
    const below=hi?(f.pct>=1?`apne 30-din ke average ${M(f.avg)} se ${f.pct}% kam`:f.pct<=-1?`apne 30-din ke average ${M(f.avg)} se ${Math.abs(f.pct)}% zyada`:`apne 30-din ke average ${M(f.avg)} ke aas-paas`)
      :(f.pct>=1?`${f.pct}% below its 30-day average of ${M(f.avg)}`:f.pct<=-1?`${Math.abs(f.pct)}% above its 30-day average of ${M(f.avg)}`:`about its 30-day average of ${M(f.avg)}`);
    const atLow=f.price<=f.low.price;
    const lowDays=hi?`${M(f.price)} pichhle ${f.days} din me hamara check kiya sabse kam price hai.`:`${M(f.price)} is the lowest price we have verified in ${f.days} days.`;
    const wasLow=hi?` Ye ${day(f.low.time)} ko ${M(f.low.price)} tha.`:` It was ${M(f.low.price)} on ${day(f.low.time)}.`;
    let head,tone,why;
    if(score>=80){head=hi?'Abhi le lo':'Buy now';tone='good';why=atLow?lowDays:(hi?`${M(f.price)} hamare sabse kam verified price (${M(f.low.price)}, ${day(f.low.time)}) ke paas hai.`:`${M(f.price)} is close to the lowest we verified (${M(f.low.price)} on ${day(f.low.time)}).`);}
    else if(score>=60){head=hi?'Lene ka accha time':'Good time to buy';tone='good';why=hi?`${M(f.price)} ${below} hai.`:`${M(f.price)} is ${below}.`;}
    else if(score>=40){head=hi?'Ruk sakte ho':'You can wait';tone='fair';why=(hi?`${M(f.price)} ${below} hai.`:`${M(f.price)} is ${below}.`)+wasLow;}
    else{head=hi?'Rukna behtar hai':'Better to wait';tone='high';why=(hi?`${M(f.price)} ${below} hai.`:`${M(f.price)} is ${below}.`)+wasLow;}
    if(atLow&&score<80)why=lowDays;
    const base=hi?`${f.days} din me ${f.n} verified price checks par based. Sirf pichhle prices, koi forecast nahi.`:`Based on ${f.n} verified price checks over ${f.days} day${f.days>1?'s':''}. Past prices only, not a forecast.`;
    return {head,tone,why,base,title:hi?'ABHI LEIN YA RUKEIN?':'BUY NOW OR WAIT?',sw:hi?'Read in English':'Hinglish me padho'};
  }
  function css(){
    if(document.getElementById('ppAdviceCss'))return;
    const st=document.createElement('style');st.id='ppAdviceCss';
    st.textContent='.ppa-adv{margin:10px 0 2px;padding:10px 12px;border-radius:12px;border:1px solid rgba(31,122,85,.18);background:rgba(61,220,151,.07);font-size:13.5px;line-height:1.45}.ppa-adv.is-fair{border-color:rgba(232,185,84,.35);background:rgba(232,185,84,.09)}.ppa-adv.is-high{border-color:rgba(194,65,12,.25);background:rgba(194,65,12,.06)}.ppa-adv small{display:block;font-size:11px;font-weight:800;letter-spacing:.06em;opacity:.7}.ppa-adv b{font-size:14.5px}.ppa-adv p{margin:2px 0 0}.ppa-adv .ppa-base{font-size:11.5px;opacity:.72;margin-top:4px}.ppa-lang{background:none;border:0;padding:0;margin-left:6px;color:#1f7a55;text-decoration:underline;cursor:pointer;font:inherit;font-weight:700}';
    document.head.appendChild(st);
  }
  function paint(){
    const m=/^#\/product\/([^?/]+)/.exec(location.hash);if(!m)return;
    const id=decodeURIComponent(m[1]);
    document.querySelectorAll('.ppx-hero').forEach(hero=>{
      const ins=hero.querySelector('.ppx-deal-insight');if(!ins)return;
      const score=Number((ins.querySelector('.ppx-score b')||{}).textContent);
      const price=Number(String((hero.querySelector('.ppx-hero-price b')||{}).textContent||'').replace(/[^\d.]/g,''));
      if(!Number.isFinite(score)||!(price>0))return;
      const lang=getLang();const sig=id+'|'+price+'|'+score+'|'+lang;
      const old=hero.querySelector('.ppa-adv');
      if(old&&old.dataset.sig===sig)return;
      const f=facts(id,price);
      if(!f){old?.remove();return;}
      const l=lines(f,score,lang);
      css();
      const box=old||document.createElement('div');
      box.className='ppa-adv is-'+l.tone;box.dataset.sig=sig;
      box.innerHTML=`<small>${H(l.title)}</small><b>${H(l.head)}.</b><p>${H(l.why)}</p><p class="ppa-base">${H(l.base)} <button type="button" class="ppa-lang">${H(l.sw)}</button></p>`;
      box.querySelector('.ppa-lang').onclick=()=>{setLang(lang==='hi'?'en':'hi');paint();};
      if(!old)ins.insertAdjacentElement('afterend',box);
    });
  }
  let t=0;const later=()=>{clearTimeout(t);t=setTimeout(paint,120);};
  new MutationObserver(later).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',later);
  later();
  window.ppAdvice={facts,lines};
})();
