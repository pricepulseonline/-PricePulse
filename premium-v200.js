/* =====================================================================
   PricePulse V200 — Premium layer (Batch 1)
   - Page router: Find Best Price opens as a real page (#/product/<id>)
   - Product page with buy verdict, price range bar, store list, history chart
   - Header "Get Plus" chip, Plus tile in account menu, alert-limit nudge
   - Home card insight line ("Lowest in N days")
   - Mobile bottom navigation
   Loaded after script.js. Reuses the existing data helpers; no backend change.
   ===================================================================== */
(function(){
'use strict';
if(window.__ppPremiumV200)return;
window.__ppPremiumV200=true;

const H=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'');
const M=n=>typeof money==='function'?money(n):'₹'+Number(n).toLocaleString('en-IN');
const DAY=86400000;

/* ---------------- Page container ---------------- */
const homeMain=document.querySelector('body > main');
let pageView=document.getElementById('ppPageView');
if(!pageView){
  pageView=document.createElement('main');
  pageView.id='ppPageView';
  pageView.className='pp-page-view';
  pageView.hidden=true;
  pageView.setAttribute('tabindex','-1');
  homeMain?.after(pageView);
}
let lastHomeScroll=0;
const homeTitle=document.title;
let currentRoute=null;

function parseRoute(){
  const h=location.hash||'';
  const m=h.match(/^#\/([a-z-]+)(?:\/([^?]+))?/i);
  if(!m)return null;
  return {name:m[1].toLowerCase(),param:m[2]?decodeURIComponent(m[2]):''};
}
const adopted=[];
let internalClose=false;
function adopt(node,host){
  if(!node||!host)return;
  adopted.push(node);
  node.classList.add('ppx-adopted');
  host.appendChild(node);
}
function releaseAdopted(){
  while(adopted.length){
    const n=adopted.pop();
    n.classList.remove('ppx-adopted');
    n.hidden=true;
    document.body.appendChild(n);
  }
}
function closeAllPanels(){
  internalClose=true;
  try{
    if(typeof closeModal==='function'&&typeof modal!=='undefined'&&modal&&!modal.hidden)closeModal();
    if(typeof closeWishlistPanel==='function')closeWishlistPanel();
    if(typeof closeDealAlertsPanel==='function')closeDealAlertsPanel({silent:true});
    if(typeof closeAccountPopover==='function')closeAccountPopover();
    if(typeof closeCategoriesMenu==='function')closeCategoriesMenu();
  }finally{internalClose=false;}
}
const metaDesc=document.querySelector('meta[name="description"]');
const homeDesc=metaDesc?.getAttribute('content')||'';
function setMetaDescription(t){if(metaDesc)metaDesc.setAttribute('content',t||homeDesc);}
function showHome(opts){
  const restore=!(opts&&opts.restore===false);
  if(window.__ppNavSaved){const keep=window.__ppNavSaved;window.__ppNavSaved=null;document.querySelectorAll('.category-nav [data-cat]').forEach(b=>b.classList.toggle('nav-selected',keep.includes(b.dataset.cat)));}
  if(adopted.length){closeAllPanels();releaseAdopted();}
  if(!pageView.hidden){
    pageView.hidden=true;
    pageView.innerHTML='';
    if(homeMain)homeMain.hidden=false;
    requestAnimationFrame(()=>{try{if(typeof ppHydrateGlobalProductImages==='function')ppHydrateGlobalProductImages(homeMain||document);}catch(_){}});
    document.body.classList.remove('pp-page-mode');
    document.body.removeAttribute('data-pp-page');
    if(restore)requestAnimationFrame(()=>window.scrollTo({top:lastHomeScroll,behavior:'instant'}));
  }
  currentRoute=null;
  document.title=homeTitle;
  setMetaDescription('');
  setBottomNavActive('home');
}
function showPage(name,html){
  if(pageView.hidden)lastHomeScroll=window.scrollY;
  closeAllPanels();
  releaseAdopted();
  closePlusPage();
  pageView.innerHTML=html;
  pageView.hidden=false;
  if(homeMain)homeMain.hidden=true;
  document.body.classList.add('pp-page-mode');
  document.body.dataset.ppPage=name;
  setBottomNavActive(name);
}
const routes={};
function route(){
  const r=parseRoute();
  if(!r||!routes[r.name]){showHome();return;}
  const sameView=currentRoute&&currentRoute.name===r.name&&currentRoute.param===r.param;
  if(!sameView)window.__ppPrevRoute=currentRoute?currentRoute.name:'';
  currentRoute=r;
  routes[r.name](r.param);
  if(!sameView)window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route);
/* V251: other files (compare-v251.js) can add their own pages */
window.ppRegisterRoute=(name,fn)=>{routes[name]=fn;const r=parseRoute();if(r&&r.name===name)route();};
window.ppShowPage=showPage;
window.ppGoPage=(name,param='')=>{
  const target=`#/${name}${param?'/'+encodeURIComponent(param):''}`;
  if(location.hash===target)route();else location.hash=target;
};
window.ppGoHome=(anchor='')=>{
  if(parseRoute()){
    history.pushState(null,'',location.pathname+location.search);
    showHome();
  }
  if(anchor){
    const el=document.querySelector(anchor);
    if(el)setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),60);
  }
};

/* ---------------- Product data ---------------- */
function productCard(id){
  return document.querySelector(`.deal-card .heart[data-id="${CSS.escape(String(id))}"]`)?.closest('.deal-card')||null;
}
function productData(id){
  const card=productCard(id);
  const btn=card?.querySelector('.compare-btn');
  if(btn)return {card,btn,name:btn.dataset.product||'Product',data:{...btn.dataset}};
  if(typeof getWishlistProduct==='function'){
    const p=getWishlistProduct(id);
    if(p)return {card:null,btn:null,name:p.name,data:p.data||{}};
  }
  return null;
}
/* V227: hover / touch details on every price chart (product page + deal cards).
   Each chart carries its points as data; one shared handler draws a guide line, a dot and a tip. */
function ppxTipData(rows){
  try{return `<span class="ppx-tipdata" hidden data-pts="${H(JSON.stringify(rows.map(r=>[+r[0].toFixed(4),+r[1].toFixed(4),r[2],r[3],r[4]||''])))}"></span>`;}catch(_){return '';}
}
function ppxTipHost(el){return el&&el.closest&&el.closest('.ppx-chart-plot,.ppx-pc-chart');}
function ppxTipShow(host,clientX){
  const data=host.querySelector('.ppx-tipdata');if(!data)return;
  let pts;try{pts=host.__pts||(host.__pts=JSON.parse(data.dataset.pts||'[]'));}catch(_){return;}
  if(!pts.length)return;
  const r=host.getBoundingClientRect();const fx=(clientX-r.left)/Math.max(1,r.width);
  let i=0,best=9;pts.forEach((p,k)=>{const dd=Math.abs(p[0]-fx);if(dd<best){best=dd;i=k;}});
  const p=pts[i],prev=pts[i-1];
  let ui=host.querySelector('.ppx-tip-ui');
  if(!ui){ui=document.createElement('span');ui.className='ppx-tip-ui';ui.setAttribute('aria-hidden','true');ui.innerHTML='<i class="ppx-tip-line"></i><i class="ppx-tip-dot"></i><span class="ppx-tip-box"></span>';host.appendChild(ui);}
  const fmt=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short'}).format(new Date(p[2]));
  const diff=prev?p[3]-prev[3]:0;
  const chg=!prev?'First check':diff===0?'No change':`${diff>0?'▲':'▼'} ${M(Math.abs(diff))} vs previous check`;
  const box=ui.querySelector('.ppx-tip-box');
  box.innerHTML=`<b>${M(p[3])}</b><span>${H(fmt)}${p[4]?` · ${H(p[4])}`:''}</span><em class="${diff>0?'is-up':diff<0?'is-down':''}">${H(chg)}</em>`;
  ui.style.setProperty('--tx',(p[0]*100).toFixed(2)+'%');ui.style.setProperty('--ty',(p[1]*100).toFixed(2)+'%');
  ui.classList.add('is-on');
  const bw=box.offsetWidth,px=p[0]*r.width;
  box.style.left=Math.max(0,Math.min(r.width-bw,px-bw/2))+'px';
  box.classList.toggle('is-below',p[1]*r.height<box.offsetHeight+14);
}
function ppxTipHide(host){host?.querySelector('.ppx-tip-ui')?.classList.remove('is-on');}
document.addEventListener('pointermove',e=>{
  const host=ppxTipHost(e.target);
  if(document.__ppxTipHost&&document.__ppxTipHost!==host){ppxTipHide(document.__ppxTipHost);}
  document.__ppxTipHost=host||null;
  if(host)ppxTipShow(host,e.clientX);
},{passive:true});
document.addEventListener('pointerdown',e=>{const host=ppxTipHost(e.target);if(host&&e.pointerType!=='mouse')ppxTipShow(host,e.clientX);},{passive:true});
['pointerleave','pointercancel','pointerup'].forEach(ev=>document.addEventListener(ev,e=>{if(ev==='pointerleave'&&e.target!==document)return;if(e.pointerType!=='mouse'&&document.__ppxTipHost){const h=document.__ppxTipHost;setTimeout(()=>ppxTipHide(h),ev==='pointercancel'?0:1400);}},true));
document.addEventListener('mouseout',e=>{const h=ppxTipHost(e.target);if(h&&!h.contains(e.relatedTarget))ppxTipHide(h);});
function lowestSeries(productId){
  if(typeof ppHistorySnapshots!=='function')return [];
  return ppHistorySnapshots(productId)
    .map(s=>{let price=Infinity,store='';for(const [k,v] of Object.entries(s.prices||{})){if(Number.isFinite(v)&&v<price){price=v;store=k;}}return {time:s.time,price,store};})
    .filter(s=>Number.isFinite(s.price)&&s.price>0)
    .sort((a,b)=>a.time-b.time);
}
function priceInsight(productId,current){
  const series=lowestSeries(productId);
  if(!Number.isFinite(current))return {series,verdict:null};
  const points=[...series.map(s=>s.price),current];
  const min=Math.min(...points),max=Math.max(...points);
  const first=series[0]?.time||Date.now();
  const days=Math.max(1,Math.round((Date.now()-first)/DAY));
  let verdict=null;
  if(series.length>=3){
    if(current<=min&&max>min)verdict={tone:'good',label:'Good time to buy',note:`Lowest verified price in the last ${days} ${days===1?'day':'days'}`,days};
    else if(current<=min)verdict={tone:'good',label:'Stable best price',note:`Steady at this price for ${days} ${days===1?'day':'days'}`,days};
    else if(current>=max)verdict={tone:'high',label:'Price is high right now',note:'Set a price alert and we will tell you when it drops',days};
    else verdict={tone:'fair',label:'Fair price',note:`${M(current-min)} above the ${days}-day low of ${M(min)}`,days};
  }
  const firstPrice=series[0]?.price;
  const dropSinceStart=Number.isFinite(firstPrice)&&firstPrice>current?firstPrice-current:0;
  return {series,verdict,min,max,days,dropSinceStart};
}

/* ---------------- Product page ---------------- */
const TRUST_IC={
  ret:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  match:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.4l2.6 2.6 5-5.4"/></svg>'
};
const ICON={
  ext:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  bell:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 20h4"/></svg>',
  trend:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
  up:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
  heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 10.6 19C5.5 14.4 2.5 11.5 2.5 7.8A5.3 5.3 0 0 1 12 4.5a5.3 5.3 0 0 1 9.5 3.3c0 3.7-3 6.6-8.1 11.2L12 20.3Z"/></svg>',
  back:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  shield:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 18.5 6v5.1c0 4.2-2.7 7.5-6.5 9.4-3.8-1.9-6.5-5.2-6.5-9.4V6L12 3.5Z"/><path d="m9 12 2 2 4-4"/></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.4 2"/></svg>',
  undo:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7.2 8.2H4.5V5.5"/><path d="M5 8a8 8 0 1 1-1 7.1"/></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h3"/></svg>',
  crown:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 18 5 7l5 5 2-7 2 7 5-5 2 11z"/><rect x="4" y="19" width="16" height="2" rx="1"/></svg>',
  tick:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  star:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2.8l2.72 5.51 6.08.88-4.4 4.29 1.04 6.06L12 16.68l-5.44 2.86 1.04-6.06-4.4-4.29 6.08-.88L12 2.8z"/></svg>'
};

/* V277 (P23): product page price chart = the extension's chart - area + step line, dashed average, range tabs
   (1M / 3M / 6M / All), hover = price on that day, drag on the chart = alert target (used by "Set alert").
   Drawn at the real width of its box (text never stretched) by ppxXcMount(); data kept in PPX_XC. */
const PPX_XC=new Map();
const XC_RANGES=[['1M',30],['3M',90],['6M',182],['All',100000]];
function xcAvail(pts){const span=pts.length?(Date.now()-pts[0].time)/DAY:0;return {'1M':true,'3M':span>30,'6M':span>90,'All':span>182};}
function xcRange(pts,key){const days=(XC_RANGES.find(r=>r[0]===key)||XC_RANGES[0])[1];const from=Date.now()-days*DAY;const out=pts.filter(p=>p.time>=from);const before=pts.filter(p=>p.time<from).pop();if(before)out.unshift({...before,time:from});return out.length?out:pts.slice(-1);}
function xcRound(v){return v>=5000?Math.round(v/100)*100:v>=500?Math.round(v/10)*10:Math.round(v);}
function xcK(v){return v>=1000?'₹'+(v/1000).toFixed(v>=100000?0:1).replace(/\.0$/,'')+'k':M(v);}
function xcSVG(st,W){
  const pts=xcRange(st.pts,st.range),H=210,L=52,R=10,T=14,B=26;
  const avg=pts.reduce((a,p)=>a+p.price,0)/pts.length;st.avg=avg;
  const ps=pts.map(p=>p.price).concat([avg,st.target].filter(Number.isFinite));
  let lo=Math.min(...ps),hi=Math.max(...ps);
  if(hi===lo){hi+=Math.max(1,hi*.02);lo-=Math.max(1,lo*.02);}
  const padY=(hi-lo)*.12;lo-=padY;hi+=padY;
  const t0=pts[0].time,t1=Math.max(Date.now(),t0+DAY);
  const X=t=>L+(W-L-R)*((t-t0)/(t1-t0)),Y=p=>T+(H-T-B)*(1-(p-lo)/(hi-lo));
  let d='';pts.forEach((pt,k)=>{const x=X(pt.time),y=Y(pt.price);d+=k?` H${x.toFixed(1)} V${y.toFixed(1)}`:`M${x.toFixed(1)} ${y.toFixed(1)}`;});
  d+=` H${X(t1).toFixed(1)}`;
  const area=`${d} V${(H-B).toFixed(1)} H${L} Z`;
  const ticks=[hi-padY,(hi+lo)/2,lo+padY].map(v=>`<text x="${L-8}" y="${(Y(v)+3.5).toFixed(1)}" text-anchor="end">${xcK(v)}</text><line class="gl" x1="${L}" x2="${W-R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`).join('');
  const months=[],span=t1-t0,step=span>120*DAY?2:1,m=new Date(t0);m.setDate(1);m.setMonth(m.getMonth()+1);
  for(let k=0;m.getTime()<t1&&k<24;k++,m.setMonth(m.getMonth()+step))months.push(m.getTime());
  const dayFmt=t=>new Date(t).toLocaleDateString('en-IN',span<=45*DAY?{day:'numeric',month:'short'}:{month:'short'});
  const xs=span<=45*DAY?[t0,t0+span/2]:months;
  const xl=xs.filter(t=>X(t)<W-R-60).map(t=>`<text x="${X(t).toFixed(1)}" y="${H-7}" text-anchor="middle">${dayFmt(t)}</text>`).join('')+`<text x="${W-R}" y="${H-7}" text-anchor="end">Today</text>`;
  const last=pts[pts.length-1];
  const yTop=Y(hi-padY),yBot=Y(lo+padY),yAvg=Y(avg);
  const off=Math.min(.9,Math.max(.1,(yAvg-yTop)/Math.max(1,yBot-yTop))).toFixed(3);
  st.geo={pts,X,Y,t0,t1,L,R,W,H,T,B,lo,hi};
  const tg=Number.isFinite(st.target)?`<g class="tgt"><line x1="${L}" x2="${W-R}" y1="${Y(st.target).toFixed(1)}" y2="${Y(st.target).toFixed(1)}"/><rect x="${W-R-104}" y="${(Y(st.target)-10).toFixed(1)}" width="104" height="20" rx="6"/><text x="${W-R-52}" y="${(Y(st.target)+4).toFixed(1)}" text-anchor="middle">TARGET ${M(st.target)}</text></g>`:'';
  const uid='xc'+Math.random().toString(36).slice(2,7);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Lowest verified price over time. Average ${H_(M(Math.round(avg)))}, today ${H_(M(last.price))}.">
    <defs><linearGradient id="${uid}l" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${yTop.toFixed(1)}" y2="${yBot.toFixed(1)}"><stop offset="0" stop-color="#E5484D"/><stop offset="${off}" stop-color="#E8B954"/><stop offset="1" stop-color="#1F9D63"/></linearGradient>
      <linearGradient id="${uid}a" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${yTop.toFixed(1)}" y2="${(H-B).toFixed(1)}"><stop offset="0" stop-color="#E5484D" stop-opacity=".14"/><stop offset="${off}" stop-color="#E8B954" stop-opacity=".09"/><stop offset="1" stop-color="#1F9D63" stop-opacity=".02"/></linearGradient></defs>
    ${ticks}
    <path d="${area}" fill="url(#${uid}a)"/>
    <path d="${d}" fill="none" stroke="url(#${uid}l)" stroke-width="2.4" stroke-linejoin="round"/>
    <line class="avg" x1="${L}" x2="${W-R}" y1="${yAvg.toFixed(1)}" y2="${yAvg.toFixed(1)}"/><text class="avgt" x="${L+6}" y="${(yAvg-5).toFixed(1)}">AVG ${M(Math.round(avg))}</text>
    ${tg}
    <circle cx="${X(Date.now()).toFixed(1)}" cy="${Y(last.price).toFixed(1)}" r="4.5" fill="#E8B954" stroke="#fff" stroke-width="2"/>
    ${xl}
    <g class="hv" style="display:none"><line class="hl" y1="${T}" y2="${H-B}"/><circle class="hd" r="4.5"/><g class="hb"><rect rx="7" height="34"/><text class="h1"></text><text class="h2"></text></g></g>
  </svg>`;
}
const H_=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function xcDraw(box){
  const st=PPX_XC.get(box.dataset.xc);if(!st)return;
  const plot=box.querySelector('.ppx-xc-plot');const W=Math.max(300,Math.round(plot.getBoundingClientRect().width||640));
  plot.innerHTML=xcSVG(st,W);
  const av=xcAvail(st.pts);
  box.querySelectorAll('[data-xc-r]').forEach(b=>{const k=b.dataset.xcR;b.classList.toggle('is-on',k===st.range);b.disabled=!av[k];b.title=av[k]?'':'Not enough history yet';});
  const tv=box.querySelector('.ppx-xc-tv');if(tv)tv.textContent=Number.isFinite(st.target)?M(st.target):'';
  box.dataset.ready='1';
}
function ppxXcMount(){document.querySelectorAll('.ppx-xc[data-xc]').forEach(b=>{if(!b.dataset.ready||b.dataset.w!==String(Math.round(b.getBoundingClientRect().width))){b.dataset.w=String(Math.round(b.getBoundingClientRect().width));xcDraw(b);}});}
new MutationObserver(()=>{if(document.querySelector('.ppx-xc[data-xc]:not([data-ready])'))ppxXcMount();}).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',()=>{clearTimeout(ppxXcMount._t);ppxXcMount._t=setTimeout(ppxXcMount,150);});
function xcHover(box,clientX){
  const st=PPX_XC.get(box.dataset.xc),g=box.querySelector('.hv'),svg=box.querySelector('svg');if(!st||!st.geo||!g||!svg)return;
  const c=st.geo,r=svg.getBoundingClientRect();
  const x=Math.max(c.L,Math.min(c.W-c.R,(clientX-r.left)*c.W/r.width));
  const t=c.t0+(x-c.L)/(c.W-c.L-c.R)*(c.t1-c.t0);
  let pt=c.pts[0];for(const q of c.pts){if(q.time<=t)pt=q;else break;}
  const y=c.Y(pt.price);g.style.display='';
  const hl=g.querySelector('.hl');hl.setAttribute('x1',x.toFixed(1));hl.setAttribute('x2',x.toFixed(1));
  const hd=g.querySelector('.hd');hd.setAttribute('cx',x.toFixed(1));hd.setAttribute('cy',y.toFixed(1));
  const now=Date.now(),day=Math.min(t,now);
  const t1=M(pt.price),t2=(now-day<DAY?'Today':new Date(day).toLocaleDateString('en-IN',{day:'numeric',month:'short'}))+(pt.store?' · '+pt.store:'');
  const w=Math.max(t1.length*8,t2.length*6)+18;let bx=x+12;if(bx+w>c.W-c.R)bx=x-12-w;let by=y-44;if(by<c.T)by=y+12;
  const rc=g.querySelector('rect');rc.setAttribute('x',bx.toFixed(1));rc.setAttribute('y',by.toFixed(1));rc.setAttribute('width',w.toFixed(1));
  const a=g.querySelector('.h1'),b=g.querySelector('.h2');a.textContent=t1;a.setAttribute('x',(bx+9).toFixed(1));a.setAttribute('y',(by+15).toFixed(1));b.textContent=t2;b.setAttribute('x',(bx+9).toFixed(1));b.setAttribute('y',(by+28).toFixed(1));
}
function xcSetTarget(box,clientY){
  const st=PPX_XC.get(box.dataset.xc),svg=box.querySelector('svg');if(!st||!st.geo||!svg)return;
  const c=st.geo,r=svg.getBoundingClientRect();
  const y=Math.max(c.T,Math.min(c.H-c.B,(clientY-r.top)*c.H/r.height));
  const v=c.hi-(y-c.T)/(c.H-c.T-c.B)*(c.hi-c.lo);
  st.target=Math.max(1,xcRound(v));xcDraw(box);box.classList.add('has-target');
  const s=document.querySelector('.ppx-alert-suggest');if(s)s.innerHTML=`Your target <b>${M(st.target)}</b>${Number.isFinite(st.cur)?` <span>(${st.cur>st.target?M(st.cur-st.target)+' below':'at or above'} today's best)</span>`:''}`;
}
document.addEventListener('pointerdown',e=>{
  const plot=e.target.closest&&e.target.closest('.ppx-xc-plot');if(!plot)return;
  const box=plot.closest('.ppx-xc');box.__drag=true;try{plot.setPointerCapture(e.pointerId);}catch(_){}
  xcSetTarget(box,e.clientY);e.preventDefault();
});
document.addEventListener('pointermove',e=>{
  const plot=e.target.closest&&e.target.closest('.ppx-xc-plot');
  document.querySelectorAll('.ppx-xc').forEach(b=>{if(b.__drag)xcSetTarget(b,e.clientY);});
  if(plot)xcHover(plot.closest('.ppx-xc'),e.clientX);
},{passive:true});
document.addEventListener('pointerup',()=>{document.querySelectorAll('.ppx-xc').forEach(b=>{b.__drag=false;});});
document.addEventListener('mouseout',e=>{const plot=e.target.closest&&e.target.closest('.ppx-xc-plot');if(plot&&!plot.contains(e.relatedTarget)){const g=plot.querySelector('.hv');if(g)g.style.display='none';}});
document.addEventListener('click',e=>{
  const r=e.target.closest&&e.target.closest('[data-xc-r]');
  if(r){const box=r.closest('.ppx-xc'),st=PPX_XC.get(box.dataset.xc);if(st&&!r.disabled){st.range=r.dataset.xcR;xcDraw(box);}return;}
  const go=e.target.closest&&e.target.closest('[data-xc-alert]');
  if(go){const box=go.closest('.ppx-xc'),st=PPX_XC.get(box.dataset.xc);if(st)pcAlert(box.dataset.xc,st.target);}
});
function ppxChartTarget(id){const st=PPX_XC.get(String(id));return st&&st.touched!==false&&Number.isFinite(st.target)?st.target:null;}
function chartHTML(series,current,productId){
  const pts=[...series];
  const lastT=pts.length?pts[pts.length-1].time:0;
  if(Number.isFinite(current)&&(!pts.length||pts[pts.length-1].price!==current||Date.now()-lastT>3600000))pts.push({time:Date.now(),price:current});
  if(pts.length<2)return `<p class="ppx-fine ppx-xc-none">Not enough history yet. Each verified check adds a point here.</p>`;
  const prices=pts.map(p=>p.price),last=pts[pts.length-1];
  const dMin=Math.min(...prices),dMax=Math.max(...prices),dRng=dMin>0?(dMax-dMin)/dMin:0;
  const avgP=prices.reduce((a,b)=>a+b,0)/prices.length;
  const id=String(productId||'p');
  const prev=PPX_XC.get(id);
  const av=xcAvail(pts);
  const range=prev&&prev.range&&av[prev.range]?prev.range:(av['6M']?'6M':av['3M']?'3M':'1M');
  const sugg=Number.isFinite(current)?Math.floor((current*0.98)/100)*100:null;
  PPX_XC.set(id,{pts,range,cur:current,target:prev&&Number.isFinite(prev.target)?prev.target:(sugg>0?sugg:null)});
  let histHTML='';
  if(dRng>=0.01&&pts.length>=3){
    let hp=prices;
    if(hp.length>40){const k=hp.length/40;hp=Array.from({length:40},(_,i)=>{const a=Math.floor(i*k),b=Math.max(a+1,Math.floor((i+1)*k));const sl=hp.slice(a,b);return sl.reduce((q,r)=>q+r,0)/sl.length;});}
    const devs=hp.map(v=>(v-avgP)/avgP*100);
    const mx=Math.max(...devs.map(Math.abs),0.1);
    const bars=devs.map(d=>{const hh=Math.max(4,Math.abs(d)/mx*100);return `<i class="${d>0.05?'is-up':d<-0.05?'is-down':'is-mid'}" style="--h:${hh.toFixed(0)}%"></i>`;}).join('');
    const nowD=(last.price-avgP)/avgP*100,ad=Math.abs(nowD);
    const tone=nowD<=-1?'is-good':'is-flat';
    const msg=nowD<=-1?'Cheaper than usual · good time to buy':nowD>=1?'Costlier than usual · price was lower earlier':'Close to the usual price';
    histHTML=`<div class="ppx-hist"><div class="ppx-hist-head"><div class="ppx-hist-l"><b>Price vs average</b><span class="ppx-hist-pill ${tone}">${msg}</span></div><span class="ppx-hist-key">green = cheaper · red = costlier</span></div><div class="ppx-hist-bars" aria-hidden="true">${bars}</div></div>`;
  }
  return `<div class="ppx-xc" data-xc="${H(id)}">
    <div class="ppx-xc-top"><div class="ppx-xc-tabs" role="group" aria-label="Chart range">${XC_RANGES.map(([k])=>`<button type="button" data-xc-r="${k}">${k}</button>`).join('')}</div><span class="ppx-xc-hint">Drag on the chart to set your target</span></div>
    <div class="ppx-xc-plot"></div>
    <div class="ppx-xc-foot"><span><i class="k-line" aria-hidden="true"></i>Lowest verified price</span><span><i class="k-avg" aria-hidden="true"></i>Average</span><span><i class="k-tgt" aria-hidden="true"></i>Your target <b class="ppx-xc-tv"></b></span><button type="button" class="ppx-xc-go" data-xc-alert>Set alert at this price</button></div>
  </div>${histHTML}`;
}

/* V243 (W1): Lowest / Highest / Verified checks cards - icon, date line, colour only when the price range is meaningful (>=3%, same rule as the graph) */
function ppxStatsHTML(ins,statMin,statMax,cur){
  const statM=v=>Number.isFinite(v)?M(v):'\u2014';
  const ser=(ins&&ins.series)||[];
  const fmtD=t=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short'}).format(new Date(t));
  const fmtDT=t=>{const d=new Date(t);return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short'}).format(d)+', '+new Intl.DateTimeFormat('en-IN',{hour:'numeric',minute:'2-digit',hour12:true}).format(d).toLowerCase();};
  const ok=Number.isFinite(statMin)&&Number.isFinite(statMax)&&statMin>0;
  const colour=ok&&(statMax-statMin)/statMin>=0.03;
  const lowPt=ok?ser.find(x=>x.price===statMin):null;
  const hiPt=ok?[...ser].reverse().find(x=>x.price===statMax):null;
  const atLow=ok&&Number.isFinite(cur)&&cur<=statMin;
  const below=ok&&Number.isFinite(cur)&&cur<statMax?statMax-cur:0;
  const ic=p=>`<span class="ppx-stat-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${p}</svg></span>`;
  const n=ser.length,shown=Math.min(n,14);
  const dots=Array.from({length:shown},()=>'<i></i>').join('')+(n>shown?`<small>+${n-shown}</small>`:'');
  const lastT=n?ser[n-1].time:0;
  return `<div class="ppx-stats">
        <div class="is-lowc${colour?' is-on':''}"><div class="ppx-stat-top">${ic('<path d="M12 5v14M6 13l6 6 6-6"/>')}<span>Lowest</span>${atLow&&colour?'<em class="ppx-stat-pill">Now at lowest</em>':''}</div><b>${statM(statMin)}</b>${lowPt?`<small>on ${fmtD(lowPt.time)}</small>`:''}</div>
        <div class="is-highc${colour?' is-on':''}"><div class="ppx-stat-top">${ic('<path d="M12 19V5M6 11l6-6 6 6"/>')}<span>Highest</span></div><b>${statM(statMax)}</b>${hiPt?`<small>on ${fmtD(hiPt.time)}${below>0?` · now ${M(below)} lower`:''}</small>`:''}</div>
        <div><div class="ppx-stat-top">${ic('<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>')}<span>Verified checks</span><span class="ppx-stat-dots" aria-hidden="true">${dots}</span></div><b>${n}</b>${lastT?`<small>Last checked ${fmtDT(lastT)}</small>`:''}</div>
      </div>`;
}

function ppxTidyTie(html){
  if(!html)return html;
  const ico='<span class="pp-v71-history-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V11M12 20V5M19 20v-6"/></svg></span>';
  return html
    .replace(/<span class="pp-v71-history-icon"[^>]*>[^<]*<\/span>/,ico)
    .replace(/<strong>Price history \(last (\d+) verified (checks?)\)<\/strong>/,'<strong>Last $1 verified $2</strong>')
    .replace(/<strong>Price history<\/strong>/,'<strong>Store comparison</strong>');
}
function productPageHTML(productId){
  const info=productData(productId);
  if(!info)return notFoundHTML();
  const {card,name,data}=info;
  const catalog=typeof ppCatalogProduct==='function'?ppCatalogProduct(productId):null;
  const brand=typeof ppCatalogBrandForProduct==='function'?ppCatalogBrandForProduct(catalog):null;
  const offers=typeof ppCatalogOffersForProduct==='function'?ppCatalogOffersForProduct(productId,data):ppComparisonOfferLinks(data,productId);
  const photo=card?.querySelector('.product-photo');
  const fallbackImage=photo?.getAttribute('src')||'';
  const gallery=typeof ppResolvedProductGallery==='function'?ppResolvedProductGallery(catalog,productId,fallbackImage):[];
  const mainItem=gallery[0]||(typeof ppImageItem==='function'?ppImageItem(fallbackImage,{bg:'white',fit:'contain',position:'center',scale:'100'}):{url:fallbackImage});
  const displayName=String(catalog?.name||name||'Product');
  const available=offers.filter(o=>o.price!=null&&o.availability!=='out_of_stock');
  const hasComparison=available.length>=2;
  const lowest=hasComparison?Math.min(...available.map(o=>o.price)):(available.length===1?available[0].price:null);
  const sorted=[...offers].sort((a,b)=>{
    if(a.availability==='out_of_stock'&&b.availability!=='out_of_stock')return 1;
    if(b.availability==='out_of_stock'&&a.availability!=='out_of_stock')return -1;
    if(a.price==null&&b.price==null)return a.originalOrder-b.originalOrder;
    if(a.price==null)return 1;if(b.price==null)return -1;
    return a.price-b.price||a.originalOrder-b.originalOrder;
  });
  const bestOffers=hasComparison?available.filter(o=>o.price===lowest):[];
  const allSame=hasComparison&&available.every(o=>o.price===lowest);
  const tie=bestOffers.length>1&&typeof ppTieAnalysis==='function'?ppTieAnalysis(productId,bestOffers):null;
  const selected=bestOffers.length===1?bestOffers[0]:(tie?.offer||bestOffers[0]||(available.length===1?available[0]:null));
  const newest=available.map(o=>o.checkedAt).filter(Boolean).sort().at(-1)||'';
  const saving=selected&&typeof ppOfferSavings==='function'?ppOfferSavings(selected):null;
  const ins=priceInsight(productId,lowest);
  /* V238: stats never show NaN - fall back to the recorded history, or a dash */
  const insPrices=ins.series.map(x=>x.price);
  const statMin=Number.isFinite(ins.min)?ins.min:(insPrices.length?Math.min(...insPrices):NaN);
  const statMax=Number.isFinite(ins.max)?ins.max:(insPrices.length?Math.max(...insPrices):NaN);
  const statM=v=>Number.isFinite(v)?M(v):'\u2014';

  /* brand + details */
  const brandName=String(brand?.name||card?.dataset.brandName||card?.dataset.brand||catalog?.brand_slug||'').trim();
  const staticBrand=card?.querySelector('.product-brand-logo');
  const bs=typeof ppBrandLogoSources==='function'?ppBrandLogoSources(productId,staticBrand?.getAttribute('src')||''):{};
  const brandLogo=typeof ppPopupBrandLogo==='function'?ppPopupBrandLogo(bs.primary,bs.fallback,brandName||bs.name||'Brand'):'';
  const safeVariant=available.find(o=>o.matchStatus==='match'&&o.detailsReviewed===true&&String(o.capturedVariant||'').trim());
  const variant=String(catalog?.variant||safeVariant?.capturedVariant||'').trim();
  const model=String(catalog?.model_code||safeVariant?.capturedModel||'').trim();
  const category=String(catalog?.category||card?.dataset.category||'').trim().replace(/\b\w/g,m=>m.toUpperCase());
  const chips=[category,brandName,model,variant].filter((v,i,a)=>v&&a.indexOf(v)===i);

  const img=item=>`<img class="pp-global-product-image ppx-main-image" src="${H(item.url)}" alt="${H(displayName)}" ${typeof ppGlobalImageDataAttrs==='function'?ppGlobalImageDataAttrs(item):''} style="${H(typeof ppGlobalImageStyle==='function'?ppGlobalImageStyle(item):'')}">`;
  const thumbs=gallery.length>1?`<div class="ppx-thumbs" aria-label="Product pictures">${gallery.map((it,i)=>`<button type="button" class="ppx-thumb ${i===0?'is-active':''}" data-ppx-thumb="${i}" aria-label="View photo ${i+1}" aria-pressed="${i===0}"><img src="${H(it.url)}" alt="" loading="lazy"></button>`).join('')}</div>`:'';
  const isSaved=typeof saved!=='undefined'&&saved.has(String(productId));
  const bgClass=typeof ppGlobalImageBgClass==='function'?ppGlobalImageBgClass(mainItem||{}):'';

  /* verdict hero */
  let hero='';
  if(Number.isFinite(lowest)&&selected){
    const v=ins.verdict;
    const an0=dealAnalysis(productId,lowest,saving,available.filter(o=>o.price!=null&&o.availability!=='out_of_stock').length);
    const vLabel=v?v.label:'';
    const badge=v?`<span class="ppx-verdict is-${v.tone}">${v.tone==='high'?ICON.trend:v.tone==='good'&&v.label!=='Stable best price'?ICON.up:ICON.shield}${H(vLabel)}</span>`:`<span class="ppx-verdict is-plain">${ICON.shield}${hasComparison?'Best verified price':'Verified price'}</span>`;
    const tieNames=bestOffers.map(o=>o.name);
    const whereLine=hasComparison?(bestOffers.length>1?`Same lowest price at ${H(tieNames.slice(0,-1).join(', '))} &amp; ${H(tieNames.at(-1))}.`:`Lowest of ${available.length} stores checked.`):`Only ${H(selected.name)} has a verified price right now.`;
    const extra=v?.tone==='good'&&ins.dropSinceStart>0?` <strong>${M(ins.dropSinceStart)} lower</strong> than ${ins.days} days ago.`:v?` ${H(v.note)}.`:'';
    const range=(ins.series.length>=2&&ins.max>ins.min)?(()=>{const pos=Math.max(0,Math.min(100,((lowest-ins.min)/(ins.max-ins.min))*100));return `<div class="ppx-range" aria-label="Today's price within its ${ins.days}-day range"><div class="ppx-range-track"><i style="left:${pos.toFixed(1)}%"></i></div><div class="ppx-range-labels"><span>Low ${M(ins.min)}</span><span>High ${M(ins.max)}</span></div></div>`})():'';
    const higher=hasComparison?available.filter(o=>o.price>lowest&&o!==selected).sort((a,b)=>a.price-b.price)[0]:null;
    const vsLine=higher?`<p class="ppx-hero-vs">${ICON.tick}<span><b>${M(higher.price-lowest)} cheaper</b> than ${H(higher.name)}</span></p>`:'';
    const microBits=[];
    if(selected.availability==='in_stock')microBits.push('In stock');
    if(selected.freeDelivery||/free/i.test(selected.deliveryText||''))microBits.push('Free delivery');
    const microLine=microBits.length?`<p class="ppx-hero-micro">${microBits.map(t=>`<span>${H(t)}</span>`).join('')}</p>`:'';
    const rating=selected.rating?`<span class="ppx-hero-rating">${ICON.star}${H(selected.rating)}${selected.reviewCount?` · ${H(ppFormatCount(selected.reviewCount))} reviews`:''}</span>`:'';
    hero=`<section class="ppx-hero" aria-label="Best price">
      <div class="ppx-hero-top">${badge}<span class="ppx-checked">${newest?`Checked ${H(ppReadableDate(newest))}`:''}</span></div>
      <div class="ppx-hero-kicker">BEST VERIFIED PRICE</div>
      <div class="ppx-hero-price"><b>${M(lowest)}</b>${saving?`<s>${M(saving.mrp)}</s><span class="ppx-save-tag">You save ${M(saving.saving)} · ${saving.percent}% off</span>`:''}</div>
      <p class="ppx-hero-note">${whereLine}${extra}</p>
      ${cbSpan(selected.name,selected.price,catalog?.category||card?.dataset.category||'','hero',productId)}
      ${vsLine}
      ${range}
      ${dealInsightHTML(dealAnalysis(productId,lowest,saving,available.filter(o=>o.price!=null&&o.availability!=='out_of_stock').length))}
      <div class="ppx-hero-actions">
        <a class="ppx-btn ppx-btn-primary" href="${H(selected.url)}" target="_blank" rel="sponsored noopener noreferrer">Buy at ${M(selected.price)} on ${H(selected.name)} ${ICON.ext}</a>
        <button type="button" class="ppx-btn ppx-btn-ghost" data-ppx-action="alert" data-product-id="${H(productId)}">${ICON.bell}Wait for a lower price</button>
      </div>
      ${microLine}
      ${rating}
    </section>`;
  }else{
    hero=`<section class="ppx-hero is-pending" aria-label="Price status">
      <div class="ppx-hero-top"><span class="ppx-verdict is-plain">${ICON.clock}Price check pending</span></div>
      <h2 class="ppx-pending-title">Compare ${offers.length} store ${offers.length===1?'listing':'listings'}</h2>
      <p class="ppx-hero-note">Verified prices for this product are being checked. Open any store below to see its current price, or set an alert and we'll tell you when a verified price drops.</p>
      <div class="ppx-hero-actions"><button type="button" class="ppx-btn ppx-btn-gold" data-ppx-action="alert" data-product-id="${H(productId)}">${ICON.bell}Set a price alert</button></div>
    </section>`;
  }

  /* store rows */
  const rows=sorted.map(o=>{
    const diff=hasComparison&&o.price!=null&&o.availability!=='out_of_stock'?o.price-lowest:null;
    const isBest=diff===0&&!allSame;
    const isPick=Boolean(selected&&o===selected&&hasComparison&&diff===0);
    const sav=typeof ppOfferSavings==='function'?ppOfferSavings(o):null;
    const tag=isBest?'<span class="ppx-tag is-low">LOWEST</span>':diff>0?`<span class="ppx-tag is-more">+${M(diff)}</span>`:(diff===0&&allSame?'<span class="ppx-tag is-same">SAME PRICE</span>':'');
    const meta=[];
    if(o.availability==='in_stock')meta.push('<span class="is-stock">In stock</span>');
    else if(o.availability==='out_of_stock')meta.push('<span class="is-oos">Out of stock</span>');
    if(o.deliveryText)meta.push(`<span>${H(o.deliveryText)}</span>`);
    if(o.rating)meta.push(`<span class="is-rating">${ICON.star}${H(o.rating)}${o.reviewCount?` (${H(ppFormatCount(o.reviewCount))})`:''}</span>`);
    const logo=typeof ppPopupRetailerRowLogo==='function'?ppPopupRetailerRowLogo(o):H(o.name);
    return `<article class="ppx-store ${isBest?'is-best':''} ${isPick?'is-pick':''} ${o.availability==='out_of_stock'?'is-oos':''}" data-retailer="${H(o.name)}">
      <div class="ppx-store-logo" data-store="${H(ppSafeStoreClass(o.name))}">${logo}</div>
      <div class="ppx-store-copy">
        <div class="ppx-store-price">${o.price!=null?`<b>${M(o.price)}</b>`:'<b class="is-na">Check latest price</b>'}${tag}</div>
        ${sav?`<div class="ppx-store-save">MRP <s>${M(sav.mrp)}</s> · Save ${M(sav.saving)} (${sav.percent}%)</div>`:''}
        ${o.price!=null&&o.availability!=='out_of_stock'?cbSpan(o.name,o.price,catalog?.category||card?.dataset.category||'','row',productId):''}
        ${meta.length?`<div class="ppx-store-meta">${meta.join('<i aria-hidden="true">·</i>')}</div>`:''}
        ${o.offerText?`<div class="ppx-store-offer">${H(o.offerText)}</div>`:''}
      </div>
      <a class="ppx-btn ${isPick||(!hasComparison&&o===sorted[0])?'ppx-btn-primary':'ppx-btn-outline'} ppx-store-cta" href="${H(o.url)}" target="_blank" rel="sponsored noopener noreferrer" aria-label="View ${H(displayName)} on ${H(o.name)}">View deal ${ICON.ext}</a>
    </article>`;
  }).join('');

  /* history */
  const chart=chartHTML(ins.series,lowest,productId);
  const tieBlock=bestOffers.length>1&&typeof ppTieHistoryHTML==='function'?ppxTidyTie(ppTieHistoryHTML(tie)):'';
  /* V245 (Y1): big fall badge instead of the thin line; one percent only, with its reference date */
  let histLine='';
  if(Number.isFinite(lowest)&&ins.series.length>=3){
    const f=ins.series[0].price,t0b=ins.series[0].time;
    const sinceTxt=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short'}).format(new Date(t0b));
    const diff=Math.abs(f-lowest),pc=f>0?diff/f*100:0;
    const tone=pc<1?'is-flat':f>lowest?'is-fall':'is-rise';
    const arrow=f>lowest?'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>':f<lowest?'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>':'';
    histLine=(diff>0&&pc>=1)?`<div class="ppx-fall ${tone}" role="status"><b>${arrow}<span>${M(diff)}</span></b><small>${pc.toFixed(1)}% ${f>lowest?'lower':'higher'} since ${H(sinceTxt)}</small></div>`:`<div class="ppx-fall is-flat" role="status"><b><span>Steady</span></b><small>no change since ${H(sinceTxt)}</small></div>`;
  }
  const history=chart?`<section class="ppx-panel ppx-history" aria-labelledby="ppxHistTitle">
      <div class="ppx-panel-head ppx-hist-top"><div><span class="ppx-eyebrow">PRICE INSIGHTS</span><h2 id="ppxHistTitle">Price history</h2><span class="ppx-soft-chip ppx-chip-sm">Verified retailer checks only</span></div>${histLine}</div>
      ${chart}
      ${ppxStatsHTML(ins,statMin,statMax,lowest)}
      ${tieBlock?`<div class="ppx-tie">${tieBlock}</div>`:''}
      <p class="ppx-fine">Based on recorded verified checks, not guaranteed current offers. Confirm the final price on the retailer's website.</p>
    </section>`:`<section class="ppx-panel ppx-history is-building"><div class="ppx-panel-head"><div><span class="ppx-eyebrow">PRICE INSIGHTS</span><h2>Price history</h2></div></div><p class="ppx-fine">Price history for this product is still building. Each verified check adds a point here.</p></section>`;

  /* alert + plus */
  const plusActive=typeof ppPlusIsActive==='function'&&ppPlusIsActive();
  const atLimit=typeof ppDealAlertAtLimit==='function'&&typeof currentUser!=='undefined'&&currentUser&&ppDealAlertAtLimit();
  const usedLine=typeof currentUser!=='undefined'&&currentUser?`${typeof ppActiveDealAlertCount==='function'?ppActiveDealAlertCount():0} of ${typeof ppDealAlertLimit==='function'?ppDealAlertLimit():1} alerts in use`:'Free plan includes 1 active alert';
  const suggestTarget=Number.isFinite(lowest)?Math.floor((lowest*0.98)/100)*100:0;
  const alertCard=`<section class="ppx-panel ppx-alert">
      <div class="ppx-alert-head"><span class="ppx-icon-tile">${ICON.bell}</span><h2>Price drop alert</h2></div>
      <p>We'll notify you the moment any store drops below your target price.</p>
      <button type="button" class="ppx-btn ppx-btn-primary ppx-block" data-ppx-action="alert" data-product-id="${H(productId)}">Set alert for this product</button>
      ${suggestTarget?`<p class="ppx-alert-suggest">Suggested target <b>${M(suggestTarget)}</b> <span>(${M(Math.max(0,lowest-suggestTarget))} below today's best)</span></p>`:''}
      <small class="${atLimit&&!plusActive?'is-limit':''}">${H(usedLine)}${atLimit&&!plusActive?' · Plus gives 3':''}</small>
    </section>`;
  const plusCard=plusActive?'':`<section class="ppx-plus-card">
      <div class="ppx-plus-inner"><i class="ppx-sheen" aria-hidden="true"></i>
        <div class="ppx-plus-title">Track this + 2 more with <span class="ppx-gold">Plus</span></div>
        <p>3 deal alerts, wallet redemption from ₹25, and a ₹100 Welcome Reward on your first eligible purchase.</p>
        <button type="button" class="ppx-btn ppx-btn-gold ppx-block" data-ppx-action="plus">Get Plus · ₹99/year</button>
      </div>
    </section>`;

  const trust=`<section class="ppx-trust" aria-label="Why trust these prices">
      <div class="is-ok"><i class="ppx-tr-ic">${ICON.shield}</i><span>Verified retailer links</span></div>
      <div><i class="ppx-tr-ic">${ICON.clock}</i><span>${newest?`Prices checked ${H(ppReadableDate(newest))}`:'Prices refresh after each verified check'}</span></div>
      <div><i class="ppx-tr-ic">${TRUST_IC.ret}</i><span>Returns as per retailer policy</span></div>
      <div class="is-ok"><i class="ppx-tr-ic">${TRUST_IC.match}</i><span>Exact model &amp; variant matched</span></div>
    </section>`;

  return `<div class="ppx-product container" data-product-id="${H(productId)}" data-product-name="${H(displayName)}" data-best-price="${Number.isFinite(lowest)?H(M(lowest)):''}" data-best-store="${selected?H(selected.name):''}">
    <nav class="ppx-crumbs" aria-label="Breadcrumb"><a href="#home" class="ppx-back" data-ppx-action="back">${ICON.back}Back</a>${category?`<span>/</span><span>${H(category)}</span>`:''}<span>/</span><span class="is-current">${H(displayName)}</span></nav>
    <div class="ppx-top">
      <section class="ppx-panel ppx-gallery" aria-label="Product details">
        ${brandLogo?`<div class="ppx-brand">${brandLogo}</div>`:''}
        <div class="ppx-stage pp-global-product-surface ${H(bgClass)}">${mainItem?.url?img(mainItem):'<span class="ppx-noimg">No image</span>'}</div>
        ${thumbs}
        <div class="ppx-identity">
          <div class="ppx-badges"><span class="ppx-badge is-green">${ICON.shield}Verified product</span><span class="ppx-badge">${offers.length} ${offers.length===1?'store':'stores'} compared</span></div>
          <h1>${H(displayName)}</h1>
          ${chips.length?`<div class="ppx-chips">${chips.map(c=>`<span>${H(c)}</span>`).join('')}</div>`:''}
          <div class="ppx-id-actions">
            <button type="button" class="ppx-btn ppx-btn-soft ${isSaved?'is-saved':''}" data-ppx-action="wishlist" data-product-id="${H(productId)}" aria-pressed="${isSaved}">${ICON.heart}<span>${isSaved?'Saved':'Save'}</span></button>
            <button type="button" class="ppx-btn ppx-btn-soft" data-ppx-action="share">${ICON.share}<span>Share</span></button>
            ${Number.isFinite(lowest)?(()=>{const on=typeof window.ppCmpHas==='function'&&window.ppCmpHas(productId);return `<button type="button" class="ppx-btn ppx-btn-soft ppx-pp-cmp${on?' is-on':''}" data-pc-cmp="${H(productId)}" data-cmp-style="pp" aria-pressed="${on}">${typeof ppCmpIcon==='string'?ppCmpIcon:''}<span>${on?'Added to compare':'Compare'}</span></button>`;})():''}
          </div>
          <p class="ppx-advice">Verify exact model &amp; variant on the retailer's page.</p>
        </div>
      </section>
      <div class="ppx-right">
        ${hero}
        <section class="ppx-panel ppx-stores" aria-labelledby="ppxStoresTitle">
          <div class="ppx-panel-head"><h2 id="ppxStoresTitle">All ${offers.length} ${offers.length===1?'store':'stores'}</h2><span class="ppx-muted">Sorted by price</span></div>
          ${rows}
        </section>
      </div>
    </div>
    ${trust}
    <div class="ppx-bottom">
      ${history}
      <div class="ppx-side">${alertCard}${plusCard}</div>
    </div>
  </div>`;
}
function notFoundHTML(){
  return `<div class="ppx-product container"><section class="ppx-panel ppx-empty"><h1>Product not found</h1><p>This product may have been removed or the link is incomplete.</p><button type="button" class="ppx-btn ppx-btn-primary" data-ppx-action="back">Go back</button></section></div>`;
}
function renderProduct(id){
  showPage('product',productPageHTML(id));
  const name=pageView.querySelector('.ppx-product')?.dataset.productName;
  document.title=name?`${name} — Best Price | PricePulse`:'PricePulse';
  setMetaDescription(name?`Compare ${name} prices across stores on PricePulse. See the best verified price, price history and set a price-drop alert.`:'');
  if(window.PP_PRICE_PILOT_ENABLED===true&&typeof ppFetchLivePrices==='function')void ppFetchLivePrices(id);
  if(typeof ppRefreshGlobalProductImages==='function')try{ppRefreshGlobalProductImages()}catch(_){}
}
routes.product=renderProduct;

/* ---------------- Plus page as a route (#/plus) ---------------- */
let plusRendering=false;
const plusRenderer=typeof window.renderPlusPanel==='function'?window.renderPlusPanel:null;
function closePlusPage(){if(typeof ppClosePremiumPlusPage==='function'&&document.body.classList.contains('pp-plus-page-open'))ppClosePremiumPlusPage();}
routes.plus=()=>{
  if(!pageView.hidden){pageView.hidden=true;pageView.innerHTML='';if(homeMain)homeMain.hidden=false;document.body.classList.remove('pp-page-mode');document.body.removeAttribute('data-pp-page');}
  else lastHomeScroll=window.scrollY;
  if(plusRenderer){plusRendering=true;try{plusRenderer()}finally{plusRendering=false}}
  document.title='PricePulse Plus — ₹99/year savings membership';
  setBottomNavActive('account');
};
if(plusRenderer){window.renderPlusPanel=()=>window.ppGoPage('plus');}
if(typeof ppClosePremiumPlusPage==='function'){
  const origClose=ppClosePremiumPlusPage;
  window.ppClosePremiumPlusPage=function(){
    const r=origClose.apply(this,arguments);
    const cur=parseRoute();
    if(!plusRendering&&cur&&cur.name==='plus'&&!cur.param){history.replaceState(null,'',location.pathname+location.search);currentRoute=null;document.title=homeTitle;setBottomNavActive('home');}
    return r;
  };
}
window.addEventListener('hashchange',()=>{const r=parseRoute();if(!r||r.name!=='plus')closePlusPage();});

/* re-render open product page when live prices / history arrive */
if(typeof ppRerenderOpenComparison==='function'){
  const original=ppRerenderOpenComparison;
  window.ppRerenderOpenComparison=function(){
    original.apply(this,arguments);
    const r=parseRoute();
    if(r&&r.name==='product'&&!pageView.hidden){
      const y=window.scrollY;
      pageView.innerHTML=productPageHTML(r.param);
      window.scrollTo({top:y,behavior:'instant'});
    }
  };
}

/* page interactions */
pageView.addEventListener('click',async e=>{
  const thumb=e.target.closest('[data-ppx-thumb]');
  if(thumb){
    const shell=thumb.closest('.ppx-product');
    const id=shell?.dataset.productId;
    const info=productData(id);
    const catalog=typeof ppCatalogProduct==='function'?ppCatalogProduct(id):null;
    const fb=info?.card?.querySelector('.product-photo')?.getAttribute('src')||'';
    const gallery=typeof ppResolvedProductGallery==='function'?ppResolvedProductGallery(catalog,id,fb):[];
    const item=gallery[+thumb.dataset.ppxThumb];
    const main=shell.querySelector('.ppx-main-image');
    if(item&&main){main.dataset.ppxSlot=String(+thumb.dataset.ppxThumb||0);main.src=item.url;if(typeof ppApplyGlobalImageToElement==='function')ppApplyGlobalImageToElement(main,item);}
    shell.querySelectorAll('[data-ppx-thumb]').forEach(b=>{const on=b===thumb;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));});
    return;
  }
  const btn=e.target.closest('[data-ppx-action]');
  if(!btn)return;
  const action=btn.dataset.ppxAction;
  if(action==='home'){e.preventDefault();window.ppGoHome('#deals');return;}
  if(action==='back'){e.preventDefault();window.ppGoBack?window.ppGoBack():history.back();return;}
  if(action==='plus'){if(typeof renderPlusPanel==='function')renderPlusPanel();return;}
  if(action==='alert'){
    const id=btn.dataset.productId;
    if(typeof currentUser==='undefined'||!currentUser||(typeof profileComplete==='function'&&!profileComplete(currentProfile))){
      if(typeof setPendingAuthAction==='function')setPendingAuthAction({type:'deal-alert',productId:id});
      if(typeof currentUser!=='undefined'&&currentUser&&typeof renderProfileForm==='function')renderProfileForm(currentUser.email||'',currentProfile);
      else if(typeof renderAuthStart==='function')renderAuthStart();
      return;
    }
    const existing=typeof ppFindDealAlertForProduct==='function'?ppFindDealAlertForProduct(id):null;
    if(!existing&&typeof ppDealAlertAtLimit==='function'&&ppDealAlertAtLimit()){if(typeof ppDealAlertLimitUpsell==='function')ppDealAlertLimitUpsell();return;}
    if(typeof renderDealAlertEditor==='function')await renderDealAlertEditor(id,'product');
    try{
      const best=Number(String(document.querySelector('.ppx-product')?.dataset.bestPrice||'').replace(/[^\d]/g,''));
      const input=document.querySelector('#dealAlertForm input[name="target"]');
      const chartT=ppxChartTarget(id); /* V277: target dragged on the chart wins */
      if(input&&chartT){input.value=String(chartT);input.dispatchEvent(new Event('input',{bubbles:true}));}
      else if(input&&!input.value&&Number.isFinite(best)&&best>0)input.value=String(Math.floor((best*0.98)/100)*100);
    }catch(_){}
    return;
  }
  if(action==='wishlist'){
    const id=String(btn.dataset.productId||'');
    const heart=document.querySelector(`.heart[data-id="${CSS.escape(id)}"]`);
    if(!heart)return;
    heart.click();
    setTimeout(()=>{
      const on=typeof saved!=='undefined'&&saved.has(id);
      btn.classList.toggle('is-saved',on);
      btn.setAttribute('aria-pressed',String(on));
      const label=btn.querySelector('span');if(label)label.textContent=on?'Saved':'Save';
    },60);
    return;
  }
  if(action==='share'){
    const shell=btn.closest('.ppx-product');
    const nm=shell?.dataset.productName||'PricePulse deal';
    const bp=shell?.dataset.bestPrice||'',bs=shell?.dataset.bestStore||'';
    /* V277 (P27): share the product's own share page (p/<id>/) so WhatsApp / Facebook show its picture and name;
       that page sends the visitor on to #/product/<id>. Local file:// testing keeps the plain link. */
    const pid=shell?.dataset.productId||'';
    const url=/^https?:$/.test(location.protocol)&&/^[a-z0-9][a-z0-9-]{1,80}$/.test(pid)?`${location.origin}/p/${pid}/`:location.href;
    const text=bp&&bs?`${nm}: best verified price ${bp} on ${bs} via PricePulse.`:`${nm}: compare verified store prices on PricePulse.`;
    try{
      if(navigator.share)await navigator.share({title:`${nm} | PricePulse`,text,url});
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(`${text} ${url}`);showToast('Link copied');}
      else showToast('Sharing is not supported here');
    }catch(err){if(err?.name!=='AbortError')showToast('Could not share right now');}
  }
});

/* ---------------- Route comparison popups to the page ---------------- */
document.addEventListener('click',e=>{
  const btn=e.target.closest('.compare-btn');
  if(!btn)return;
  const id=btn.closest('.deal-card')?.querySelector('.heart')?.dataset.id;
  if(!id)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();
  window.ppGoPage('product',id);
},true);

if(typeof openModal==='function'){
  const originalOpen=openModal;
  window.openModal=function(html,wide,options){
    if(typeof html==='string'&&html.includes('pp-comparison')&&!(options&&options.forcePopup)){
      const m=html.match(/data-product-id="([^"]+)"/);
      if(m&&m[1]){window.ppGoPage('product',m[1].replace(/&amp;/g,'&'));return;}
    }
    return originalOpen.apply(this,arguments);
  };
}

/* ---------------- Header: Get Plus chip ---------------- */
function ensurePlusChip(){
  const actions=document.querySelector('.header-actions');
  if(!actions)return null;
  let chip=document.getElementById('ppGetPlusChip');
  if(!chip){
    chip=document.createElement('button');
    chip.type='button';
    chip.id='ppGetPlusChip';
    chip.className='ppx-plus-chip';
    chip.innerHTML=`${ICON.crown}<span>Get Plus</span>`;
    chip.setAttribute('aria-label','Get PricePulse Plus for ₹99 a year');
    chip.addEventListener('click',()=>{if(typeof renderPlusPanel==='function')renderPlusPanel();});
    const signIn=document.getElementById('signInBtn');
    actions.insertBefore(chip,signIn||null);
  }
  return chip;
}
function syncPlusChip(){
  const chip=ensurePlusChip();
  if(chip)chip.hidden=typeof ppPlusIsActive==='function'&&ppPlusIsActive();
}
if(typeof updateAccountHeader==='function'){
  const orig=updateAccountHeader;
  window.updateAccountHeader=function(){const r=orig.apply(this,arguments);syncPlusChip();return r;};
}
syncPlusChip();

/* ---------------- Account menu: Plus tile + alert nudge ---------------- */
if(typeof accountPopoverHTML==='function'){
  const orig=accountPopoverHTML;
  window.accountPopoverHTML=function(){
    let html=orig.apply(this,arguments);
    const plusActive=typeof ppPlusIsActive==='function'&&ppPlusIsActive();
    const doc=document.createElement('div');
    doc.innerHTML=html;
    const row=doc.querySelector('[data-account-action="plus"]');
    const summary=doc.querySelector('.pp-account-summary');
    if(row&&summary&&!plusActive){
      const tile=document.createElement('button');
      tile.type='button';
      tile.className='ppx-menu-plus';
      tile.dataset.accountAction='plus';
      tile.setAttribute('role','menuitem');
      tile.innerHTML=`<span class="ppx-menu-plus-inner"><i class="ppx-sheen" aria-hidden="true"></i>
        <span class="ppx-menu-plus-top"><span class="ppx-menu-plus-icon">${ICON.crown}</span><span class="ppx-menu-plus-name"><strong>PricePulse <em>Plus</em></strong><small>Savings membership</small></span><span class="ppx-menu-plus-zero">₹0 EFFECTIVE</span></span>
        <span class="ppx-menu-plus-hook">Pay ₹99. <em>Get ₹100 back</em> on your first purchase.</span>
        <span class="ppx-menu-plus-foot"><small>3 deal alerts · Redeem from ₹25</small><span class="ppx-menu-plus-cta">Join ₹99 →</span></span></span>`;
      summary.after(tile);
      row.remove();
    }else if(row&&plusActive){
      row.classList.add('ppx-menu-plus-active');
    }
    if(!plusActive&&typeof ppDealAlertAtLimit==='function'&&ppDealAlertAtLimit()){
      const small=doc.querySelector('[data-account-action="alerts"] small');
      if(small)small.innerHTML=`${typeof ppActiveDealAlertCount==='function'?ppActiveDealAlertCount():1} of 1 used · <b class="ppx-gold-text">Plus gives 3</b>`;
    }
    return doc.innerHTML;
  };
}

/* ---------------- Home card insight line ---------------- */
function addCardInsights(){
  document.querySelectorAll('.deal-card').forEach(card=>{
    const box=card.querySelector('.pp-card-price');
    card.querySelectorAll('.ppx-card-insight').forEach(n=>n.remove());
    if(!box||!box.classList.contains('is-best'))return;
    const id=card.querySelector('.heart')?.dataset.id;
    const btn=card.querySelector('.compare-btn');
    if(!id||!btn||typeof ppRetailerStripState!=='function')return;
    const state=ppRetailerStripState(btn.dataset,id);
    if(!Number.isFinite(state.lowest))return;
    const ins=priceInsight(id,state.lowest);
    let text='';
    if(ins.verdict?.tone==='good'&&ins.max>ins.min)text=`Lowest in ${ins.days} ${ins.days===1?'day':'days'}`;
    else if(ins.dropSinceStart>0)text=`${M(ins.dropSinceStart)} lower than ${ins.days} days ago`;
    if(!text)return;
    const el=document.createElement('div');
    el.className='ppx-card-insight';
    el.innerHTML=`${ICON.trend}<span>${H(text)}</span>`;
    const media=card.querySelector('.product-media');(media||box).appendChild(el);
  });
}
if(typeof ppUpdateHomeCardPrices==='function'){
  const orig=ppUpdateHomeCardPrices;
  window.ppUpdateHomeCardPrices=function(){const r=orig.apply(this,arguments);try{addCardInsights()}catch(_){}return r;};
}
if(typeof ppApplyHistoryRows==='function'){
  const orig=ppApplyHistoryRows;
  window.ppApplyHistoryRows=function(){const r=orig.apply(this,arguments);try{addCardInsights()}catch(_){}return r;};
}

/* ---------------- Mobile bottom nav ---------------- */
const NAV=[
  {key:'home',label:'Home',icon:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>'},
  {key:'categories',label:'Categories',icon:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>'},
  {key:'wishlist',label:'Wishlist',icon:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20.3 10.6 19C5.5 14.4 2.5 11.5 2.5 7.8A5.3 5.3 0 0 1 12 4.5a5.3 5.3 0 0 1 9.5 3.3c0 3.7-3 6.6-8.1 11.2L12 20.3Z"/></svg>'},
  {key:'alerts',label:'Alerts',icon:ICON.bell},
  {key:'account',label:'Account',icon:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.6-4 3-6 6.5-6s5.9 2 6.5 6"/></svg>'}
];
function buildBottomNav(){
  if(document.getElementById('ppBottomNav'))return;
  const nav=document.createElement('nav');
  nav.id='ppBottomNav';
  nav.className='ppx-bottom-nav';
  nav.setAttribute('aria-label','Quick navigation');
  nav.innerHTML=NAV.map(n=>`<button type="button" data-ppx-nav="${n.key}">${n.icon}<span>${n.label}</span><b class="ppx-nav-count" hidden></b></button>`).join('');
  document.body.appendChild(nav);
  nav.addEventListener('click',e=>{
    const b=e.target.closest('[data-ppx-nav]');
    if(!b)return;
    e.stopPropagation();
    const k=b.dataset.ppxNav;
    if(k==='home'){window.ppGoHome();window.scrollTo({top:0,behavior:'smooth'});return;}
    if(k==='categories'){window.ppGoHome();setTimeout(()=>document.getElementById('allCategoriesBtn')?.click(),30);return;}
    if(k==='wishlist'){document.getElementById('wishlistTop')?.click();return;}
    if(k==='alerts'){document.getElementById('dealTop')?.click();return;}
    if(k==='account'){document.getElementById('signInBtn')?.click();}
  });
  syncNavCounts();
}
function syncNavCounts(){
  const w=document.getElementById('wishCount')?.textContent?.trim();
  const d=document.getElementById('dealUnreadBadge');
  const set=(k,v)=>{const el=document.querySelector(`[data-ppx-nav="${k}"] .ppx-nav-count`);if(!el)return;const n=parseInt(v,10);el.hidden=!(n>0);el.textContent=n>99?'99+':String(n||'');};
  set('wishlist',w);
  set('alerts',d&&!d.hidden?d.textContent:'0');
}
function setBottomNavActive(key){
  document.querySelectorAll('[data-ppx-nav]').forEach(b=>b.classList.toggle('is-active',b.dataset.ppxNav===(key==='product'?'home':key)));
}
buildBottomNav();
['wishCount','dealUnreadBadge'].forEach(id=>{const el=document.getElementById(id);if(el)new MutationObserver(syncNavCounts).observe(el,{childList:true,characterData:true,subtree:true,attributes:true});});

/* =====================================================================
   Batch 2 — Wishlist & Deal Alerts pages, Plus checkout page,
   similar products, recently viewed, sticky buy bar, home Plus band
   ===================================================================== */
function authed(){return typeof currentUser!=='undefined'&&currentUser&&(typeof profileComplete!=='function'||profileComplete(currentProfile));}
function askSignIn(type){
  const r=parseRoute();
  try{if(r&&['account','preferences','wishlist','alerts'].includes(r.name))sessionStorage.setItem('ppx_after_auth',r.name);}catch(_){}
  if(typeof setPendingAuthAction==='function')setPendingAuthAction({type});
  if(typeof currentUser!=='undefined'&&currentUser&&typeof renderProfileForm==='function')renderProfileForm(currentUser.email||'',currentProfile);
  else if(typeof renderAuthStart==='function')renderAuthStart();
}
function alertStats(){const a=typeof ppActiveDealAlertCount==='function'?ppActiveDealAlertCount():0;const l=typeof ppDealAlertLimit==='function'?ppDealAlertLimit():1;return `<span><i class="ppx-dx-dot" aria-hidden="true"></i><b>${a}</b> active</span><span><b>${l}</b> ${l===1?'alert':'alerts'} on your plan</span>`;}
/* V278 (L6): one-line dark bar like Live Deals - title + small stats inline + buttons on the right.
   No gold label and no 2-line text any more (eyebrow / sub are kept as parameters so old calls still work). */
function pageHead({eyebrow,title,sub,icon='',aside='',stats=''}){
  return `<header class="ppx-page-head pp-onebar"><h1>${title}</h1>${stats?`<div class="pp-ob-stats">${stats}</div>`:''}${aside?`<div class="pp-ob-acts">${aside}</div>`:''}</header>`;
}
function crumbs(label){
  return `<nav class="ppx-crumbs" aria-label="Breadcrumb"><a href="#home" class="ppx-back" data-ppx-action="back">${ICON.back}Back</a><span>/</span><span class="is-current">${H(label)}</span></nav>`;
}

/* ---------- Wishlist page ---------- */
routes.wishlist=()=>{
  if(!authed()){askSignIn('wishlist-open');window.ppGoHome();return;}
  const count=typeof saved!=='undefined'?saved.size:0;
  showPage('wishlist',`<div class="ppx-product ppx-list-page container">${crumbs('My Wishlist')}
    ${pageHead({eyebrow:'SAVED PRODUCTS',title:'My Wishlist',stats:`<span><i class="ppx-dx-dot" aria-hidden="true"></i><b>${count}</b> saved</span><span>Re-checked across stores</span>`,aside:`<a class="pp-ob-btn" href="#/alerts">${ICON.bell}Deal Alerts</a>`})}
    <div class="ppx-adopt-host" id="ppxWishHost"></div></div>`);
  document.title=`My Wishlist (${count}) | PricePulse`;
  internalBuild=true;
  try{origOpenWishlist&&origOpenWishlist();}finally{internalBuild=false;}
  adopt(typeof wishlistOverlay!=='undefined'?wishlistOverlay:null,document.getElementById('ppxWishHost'));
  document.body.classList.remove('pp-wishlist-open');
};
let internalBuild=false;
const origOpenWishlist=typeof openWishlistPanel==='function'?openWishlistPanel:null;
if(origOpenWishlist){
  window.openWishlistPanel=function(){
    if(internalBuild)return origOpenWishlist.apply(this,arguments);
    window.ppGoPage('wishlist');
  };
}
if(typeof toggleWishlistPanel==='function'){
  window.toggleWishlistPanel=function(){
    const r=parseRoute();
    if(r&&r.name==='wishlist')return;
    window.ppGoPage('wishlist');
  };
}
if(typeof closeWishlistPanel==='function'){
  const orig=closeWishlistPanel;
  window.closeWishlistPanel=function(){
    const r=parseRoute();
    const res=orig.apply(this,arguments);
    if(!internalClose&&!internalBuild&&r&&r.name==='wishlist'){setTimeout(()=>{const c=parseRoute();if(c&&c.name==='wishlist')window.ppGoHome();},0);}
    return res;
  };
}
if(typeof ppRenderWishlistPanel==='function'){
  const orig=ppRenderWishlistPanel;
  window.ppRenderWishlistPanel=function(){
    const res=orig.apply(this,arguments);
    const r=parseRoute();
    if(r&&r.name==='wishlist'){const n=typeof saved!=='undefined'?saved.size:0;document.title=`My Wishlist (${n}) | PricePulse`;}
    return res;
  };
}

/* ---------- Deal Alerts page ---------- */
routes.alerts=async()=>{
  if(!authed()){askSignIn('deal-alerts-open');window.ppGoHome();return;}
  showPage('alerts',`<div class="ppx-product ppx-list-page container">${crumbs('Deal Alerts')}
    ${pageHead({eyebrow:'SMART SHOPPING',title:'Deal Alerts',stats:alertStats(),aside:`<a class="pp-ob-btn" href="#/wishlist">${ICON.heart}My Wishlist</a>`})}
    <div class="ppx-adopt-host" id="ppxAlertHost"></div></div>`);
  document.title='Deal Alerts | PricePulse';
  internalBuild=true;
  try{if(origRenderAlerts)await origRenderAlerts();}finally{internalBuild=false;}
  const r=parseRoute();
  if(!r||r.name!=='alerts')return;
  adopt(typeof ppDealAlertsOverlay!=='undefined'?ppDealAlertsOverlay:null,document.getElementById('ppxAlertHost'));
  document.body.classList.remove('pp-deal-open');
  const stEl=document.querySelector('.ppx-list-page .pp-onebar .pp-ob-stats');if(stEl)stEl.innerHTML=alertStats();
};
const origRenderAlerts=typeof renderDealAlertsDashboard==='function'?renderDealAlertsDashboard:null;
if(origRenderAlerts){
  window.renderDealAlertsDashboard=async function(){
    if(internalBuild)return origRenderAlerts.apply(this,arguments);
    if(!authed())return origRenderAlerts.apply(this,arguments);
    window.ppGoPage('alerts');
  };
}
if(typeof toggleDealAlertsPanel==='function'){
  window.toggleDealAlertsPanel=function(){
    const r=parseRoute();
    if(r&&r.name==='alerts')return;
    window.ppGoPage('alerts');
  };
}
if(typeof closeDealAlertsPanel==='function'){
  const orig=closeDealAlertsPanel;
  window.closeDealAlertsPanel=function(opts){
    const r=parseRoute();
    const wasOpen=typeof ppDealAlertsIsOpen==='function'&&ppDealAlertsIsOpen();
    const res=orig.apply(this,arguments);
    if(wasOpen&&!internalClose&&!internalBuild&&r&&r.name==='alerts'){setTimeout(()=>{const c=parseRoute();if(c&&c.name==='alerts')window.ppGoHome();},0);}
    return res;
  };
}

/* ---------- Plus checkout page (#/plus/checkout) ---------- */
function checkoutHTML(){
  const signed=authed();
  const name=String((typeof currentProfile!=='undefined'&&currentProfile?.full_name)||'YOUR NAME').trim().toUpperCase().slice(0,26);
  const active=typeof ppPlusIsActive==='function'&&ppPlusIsActive();
  const paused=typeof ppNormalizePlusMaster==='function'&&typeof ppPlusMaster!=='undefined'&&ppNormalizePlusMaster(ppPlusMaster.mode)==='inactive';
  const payReady=window.PP_PLUS_PAYMENT_READY===true;
  let cta;
  if(active)cta=`<button type="button" class="ppx-btn ppx-btn-primary ppx-block ppx-pay" data-ppx-action="plus">You're already a Plus member ${ICON.ext}</button>`;
  else if(paused)cta=`<button type="button" class="ppx-btn ppx-btn-primary ppx-block ppx-pay" disabled>Plus is temporarily paused</button>`;
  else if(!signed)cta=`<button type="button" class="ppx-btn ppx-btn-primary ppx-block ppx-pay" data-ppx-action="signin-plus">Sign in to continue</button>`;
  else if(payReady)cta=`<button type="button" class="ppx-btn ppx-btn-primary ppx-block ppx-pay" data-ppx-action="pay">${ICON.shield}Pay ₹99 securely</button>`;
  else cta=`<button type="button" class="ppx-btn ppx-btn-primary ppx-block ppx-pay" disabled aria-describedby="ppxPayNote">${ICON.shield}Pay ₹99 securely</button><p class="ppx-pay-note" id="ppxPayNote"><b>Secure payment is launching soon.</b> This preview will not charge you.</p>`;
  const methods=[['upi','UPI','GPay, PhonePe, Paytm'],['card','Card','Debit / Credit'],['nb','Netbanking','All major banks']];
  return `<div class="ppx-product ppx-checkout container">
    <nav class="ppx-crumbs" aria-label="Breadcrumb"><a href="#home" class="ppx-back" data-ppx-action="back">${ICON.back}Back</a><span>/</span><span class="is-current">Checkout</span></nav>
    <div class="ppx-co">
      <section class="ppx-co-left">
        <i class="ppx-sheen" aria-hidden="true"></i>
        <span class="ppx-eyebrow is-gold">YOUR MEMBER PASS</span>
        <div class="ppx-pass ${active?'is-active':'is-locked'}">
          <div class="ppx-pass-inner"><i class="ppx-sheen" aria-hidden="true"></i>
            <div class="ppx-pass-top"><span class="ppx-pass-brand"><span>PricePulse <em>Plus</em></span><small>SAVINGS MEMBERSHIP</small></span><span class="ppx-pass-state">${active?'ACTIVE':'LOCKED'}</span></div>
            <div class="ppx-pass-mid"><span class="ppx-pass-chip" aria-hidden="true"></span><span class="ppx-pass-no">PP •••• •••• ${new Date().getFullYear()}</span></div>
            <div class="ppx-pass-foot"><span><small>MEMBER</small><b>${H(name)}</b></span><span><small>VALID</small><b>12 MONTHS</b></span></div>
          </div>
        </div>
        <h2>Unlocks the moment you join</h2>
        <ul class="ppx-unlock">
          <li>${ICON.tick}<span><b>₹100 Welcome Reward</b> after your first eligible confirmed purchase</span></li>
          <li>${ICON.bell}<span><b>3 active deal alerts</b> instead of 1</span></li>
          <li>${ICON.shield}<span>Redeem your Wallet from <b>₹25</b>, not ₹100</span></li>
          <li>${ICON.star}<span><b>Member-only offers</b>, extra campaign rewards &amp; Savings Tracker</span></li>
        </ul>
      </section>
      <section class="ppx-co-right">
        <h1>Join PricePulse Plus</h1>
        <p class="ppx-co-sub">One payment. A full year of bigger savings.</p>
        <div class="ppx-bill">
          <div><span>Plus membership · 12 months</span><b>₹99</b></div>
          <div class="is-green"><span>Welcome Reward after first eligible purchase*</span><b>+₹100</b></div>
          <div class="is-total"><span>Pays for itself with one eligible purchase</span><b>✓</b></div>
        </div>
        <fieldset class="ppx-methods" ${payReady&&signed&&!active?'':'disabled'}>
          <legend>PAY WITH</legend>
          ${methods.map((m,i)=>`<label class="ppx-method"><input type="radio" name="ppxPay" value="${m[0]}" ${i===0?'checked':''}><span><b>${m[1]}</b><small>${m[2]}</small></span></label>`).join('')}
        </fieldset>
        ${cta}
        <ul class="ppx-co-trust"><li>${ICON.shield}Secure checkout</li><li>${ICON.undo}Earned rewards always stay yours</li><li>${ICON.check}UPI, cards &amp; netbanking</li></ul>
        <p class="ppx-fine">*The Welcome Reward is a conditional Wallet reward, not instant cashback. The purchase must be confirmed and clear the return/cancellation window. Campaign terms apply.</p>
      </section>
    </div>
  </div>`;
}
const plusRoute=routes.plus;
routes.plus=(param)=>{
  if(param==='checkout'){
    showPage('plus',checkoutHTML());
    document.title='Checkout · PricePulse Plus';
    setBottomNavActive('account');
    return;
  }
  plusRoute(param);
};
if(typeof openModal==='function'){
  const prevOpen=window.openModal;
  window.openModal=function(html){
    if(typeof html==='string'&&html.includes('pp-plus-checkout-shell')){window.ppGoPage('plus','checkout');return;}
    return prevOpen.apply(this,arguments);
  };
}
pageView.addEventListener('click',e=>{
  const b=e.target.closest('[data-ppx-action="signin-plus"]');
  if(b){askSignIn('plus-open');}
});
/* After a successful membership activation while on checkout, show the welcome screen. */
let plusWasActive=typeof ppPlusIsActive==='function'&&ppPlusIsActive();
if(typeof window.updateAccountHeader==='function'){
  const orig=window.updateAccountHeader;
  window.updateAccountHeader=function(){
    const res=orig.apply(this,arguments);
    const now=typeof ppPlusIsActive==='function'&&ppPlusIsActive();
    const r=parseRoute();
    if(now&&!plusWasActive&&r&&r.name==='plus'&&r.param==='checkout')window.ppGoPage('plus');
    else if(r&&r.name==='plus'&&r.param==='checkout'&&now!==plusWasActive)routes.plus('checkout');
    plusWasActive=now;
    syncHomePlusBand();
    return res;
  };
}

/* ---------- Plus page: personal card + clearer value line ---------- */
if(typeof ppPlusPageHTML==='function'){
  const orig=ppPlusPageHTML;
  window.ppPlusPageHTML=function(){
    let html=orig.apply(this,arguments);
    const name=H(String((typeof currentProfile!=='undefined'&&currentProfile?.full_name)||'YOUR NAME').trim().toUpperCase().slice(0,26));
    html=html.replace('<div class="pp-rd-card-center">PREMIUM<br><strong>SAVINGS MEMBERSHIP</strong></div>',
      `<div class="pp-rd-card-center ppx-rd-card-mid"><span class="ppx-pass-chip" aria-hidden="true"></span><span class="ppx-pass-no">PP •••• •••• ${new Date().getFullYear()}</span></div>`);
    html=html.replace('<span>MORE DEALS · MORE REWARDS</span>',`<span class="ppx-rd-holder"><small>MEMBER</small><b>${name}</b></span>`);
    html=html.replace('<span>YOUR POTENTIAL VALUE</span><strong>₹1 potential extra</strong><small>in Wallet reward value*</small>',
      '<span>THE RESULT</span><strong>Pays for itself</strong><small>₹100 reward ≥ ₹99 cost*</small>');
    return html;
  };
}

/* ---------- Mini product cards (similar + recently viewed) ---------- */
/* V240: ONE global image setting (Admin scale/rotate/x/y/bg) used on every surface, fitted to each surface's own size */
function ppxGlobalImg(id,src,alt){
  try{
    if(typeof ppGlobalPrimaryImageItem==='function'&&typeof ppGlobalImageDataAttrs==='function'&&typeof ppGlobalImageBgClass==='function'&&typeof ppGlobalImageStyle==='function'){
      const item=ppGlobalPrimaryImageItem(String(id||''),src||'');
      if(item&&item.url)return {surface:`pp-global-product-surface ${ppGlobalImageBgClass(item)}`,img:`<img class="pp-global-product-image" src="${H(item.url)}" alt="${H(alt||'')}" loading="lazy" ${ppGlobalImageDataAttrs(item)} style="${H(ppGlobalImageStyle(item))}">`};
    }
  }catch(e){}
  return {surface:'',img:src?`<img src="${H(src)}" alt="${H(alt||'')}" loading="lazy">`:''};
}
function miniCardHTML(id,baseNum){
  const card=productCard(id);
  const btn=card?.querySelector('.compare-btn');
  if(!btn)return '';
  const img=card.querySelector('.product-photo');
  const src=img?.currentSrc||img?.getAttribute('src')||'';
  const st=typeof ppRetailerStripState==='function'?ppRetailerStripState(btn.dataset,id):{offers:[],inStock:[]};
  const price=Number.isFinite(st.lowest)?st.lowest:(st.inStock?.length===1?st.inStock[0].price:null);
  const n=st.offers?.length||0;
  return `<a class="ppx-mini" href="#/product/${encodeURIComponent(id)}"><span class="ppx-mini-img ${ppxGlobalImg(id,src).surface}">${ppxGlobalImg(id,src).img}</span>${card.dataset.brandName?`<span class="ppx-mini-brand">${H(card.dataset.brandName)}</span>`:''}<span class="ppx-mini-name">${H(btn.dataset.product||'')}</span><span class="ppx-mini-price">${Number.isFinite(price)?`<b>${M(price)}</b><small>best of ${n} ${n===1?'store':'stores'}</small>${Number.isFinite(baseNum)&&baseNum>0&&price!==baseNum?`<small class="ppx-mini-diff ${price<baseNum?'is-less':'is-more'}">${M(Math.abs(price-baseNum))} ${price<baseNum?'cheaper':'more'}</small>`:''}`:`<small>Compare ${n} ${n===1?'store':'stores'}</small>`}</span><span class="ppx-mini-go" aria-hidden="true">→</span></a>`;
}
function similarIds(id){
  const card=productCard(id);
  const cat=card?.dataset.category||'';
  const brand=card?.dataset.brand||'';
  const all=[...document.querySelectorAll('.deal-card')].map(c=>({c,id:c.querySelector('.heart')?.dataset.id})).filter(x=>x.id&&x.id!==id);
  const score=x=>(x.c.dataset.category===cat?2:0)+(x.c.dataset.brand===brand?1:0);
  return all.sort((a,b)=>score(b)-score(a)).slice(0,4).map(x=>x.id);
}
const RECENT_KEY='pp_recent_products_v1';
function readRecent(){try{const v=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]}catch(_){return []}}
function pushRecent(id){try{const list=[id,...readRecent().filter(x=>x!==id)].slice(0,8);localStorage.setItem(RECENT_KEY,JSON.stringify(list));}catch(_){}}

/* product page enhancements */
const baseRenderProduct=routes.product;
routes.product=(id)=>{
  baseRenderProduct(id);
  enhanceProduct(id);
};
function enhanceProduct(id){
  const shell=pageView.querySelector('.ppx-product');
  if(!shell||!productCard(id))return;
  pushRecent(id);
  const baseNum=Number(String(shell.dataset.bestPrice||'').replace(/[^\d]/g,''));
  const cat0=productCard(id)?.dataset.category||'';
  /* only compare prices inside the same category (a fryer vs a phone makes no sense) */
  const sims=similarIds(id).map(x=>miniCardHTML(x,productCard(x)?.dataset.category===cat0?baseNum:NaN)).filter(Boolean);
  if(sims.length){
    shell.insertAdjacentHTML('beforeend',`<section class="ppx-panel ppx-similar" aria-labelledby="ppxSimTitle"><div class="ppx-panel-head"><div><span class="ppx-eyebrow">KEEP COMPARING</span><h2 id="ppxSimTitle">You may also like</h2></div><a class="ppx-link" href="#deals" data-ppx-action="home">All deals →</a></div><div class="ppx-mini-row">${sims.join('')}</div></section>`);
  }
  const hero=shell.querySelector('.ppx-hero');
  const buy=hero?.querySelector('.ppx-btn-primary');
  const price=hero?.querySelector('.ppx-hero-price b')?.textContent;
  if(buy&&price){
    const bar=document.createElement('div');
    bar.className='ppx-buybar';
    bar.hidden=true;
    bar.innerHTML=`<div class="ppx-buybar-copy"><small>Best verified price</small><b>${H(price)}</b></div><a class="ppx-btn ppx-btn-primary" href="${H(buy.getAttribute('href'))}" target="_blank" rel="sponsored noopener noreferrer">${H(buy.textContent.trim().replace(/^Buy at .*? on /,'Buy on '))} ${ICON.ext}</a>`;
    shell.appendChild(bar);
    const target=hero.querySelector('.ppx-hero-actions')||hero;
    if('IntersectionObserver' in window){
      const io=new IntersectionObserver(([en])=>{bar.hidden=en.isIntersecting||en.boundingClientRect.top>0;},{threshold:0});
      io.observe(target);
    }
  }
}
/* keep enhancements after live price re-render */
if(typeof window.ppRerenderOpenComparison==='function'){
  const orig=window.ppRerenderOpenComparison;
  window.ppRerenderOpenComparison=function(){
    const res=orig.apply(this,arguments);
    const r=parseRoute();
    if(r&&r.name==='product'&&!pageView.hidden&&!pageView.querySelector('.ppx-similar'))enhanceProduct(r.param);
    return res;
  };
}

/* ---------- Home: recently viewed + Plus band ---------- */
function renderRecent(){
  let sec=document.getElementById('ppxRecent');
  const ids=readRecent().filter(id=>productCard(id));
  if(!ids.length){sec?.remove();return;}
  const html=`<div class="container"><div class="ppx-home-head"><div><span class="ppx-eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Recently viewed</h2></div><button type="button" class="ppx-link" data-ppx-clear-recent>Clear</button></div><div class="ppx-mini-row is-scroll">${ids.map(miniCardHTML).join('')}</div></div>`;
  if(!sec){
    sec=document.createElement('section');
    sec.id='ppxRecent';
    sec.className='ppx-recent';
    sec.setAttribute('aria-label','Recently viewed products');
    const deals=document.getElementById('deals');
    (deals||homeMain)?.insertAdjacentElement(deals?'beforebegin':'afterbegin',sec);
  }
  sec.innerHTML=html;
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-ppx-clear-recent]')){try{localStorage.removeItem(RECENT_KEY)}catch(_){};renderRecent();}
});
function ensureHomePlusBand(){
  if(document.getElementById('ppxPlusBand'))return;
  const cta=document.querySelector('.cta-section');
  if(!cta)return;
  const sec=document.createElement('section');
  sec.id='ppxPlusBand';
  sec.className='ppx-plus-band';
  sec.innerHTML=`<div class="container"><div class="ppx-plus-band-card"><i class="ppx-sheen" aria-hidden="true"></i>
    <div class="ppx-plus-band-copy">
      <span class="ppx-eyebrow is-gold">PRICEPULSE PLUS · ₹99 / YEAR</span>
      <h2>Pay ₹99. <span class="ppx-gold">Get ₹100 back.</span></h2>
      <p>One eligible purchase covers your membership. Then enjoy 3 deal alerts, Wallet redemption from ₹25 and member-only offers all year.</p>
      <div class="ppx-plus-band-actions"><a class="ppx-btn ppx-btn-gold" href="#/plus">See Plus benefits ${ICON.ext}</a><span class="ppx-plus-band-fine">*Reward after the eligible purchase is confirmed.</span></div>
    </div>
    <div class="ppx-plus-band-visual" aria-hidden="true">
      <div class="ppx-pass is-locked"><div class="ppx-pass-inner"><i class="ppx-sheen"></i>
        <div class="ppx-pass-top"><span class="ppx-pass-brand"><span>PricePulse <em>Plus</em></span><small>SAVINGS MEMBERSHIP</small></span></div>
        <div class="ppx-pass-mid"><span class="ppx-pass-chip"></span><span class="ppx-pass-no">PP •••• •••• ${new Date().getFullYear()}</span></div>
        <div class="ppx-pass-foot"><span><small>MEMBER</small><b>YOUR NAME</b></span><span><small>VALID</small><b>12 MONTHS</b></span></div>
      </div></div>
    </div></div></div>`;
  cta.before(sec);
}
function syncHomePlusBand(){
  ensureHomePlusBand();
  const band=document.getElementById('ppxPlusBand');
  if(band)band.hidden=typeof ppPlusIsActive==='function'&&ppPlusIsActive();
  const name=typeof currentProfile!=='undefined'&&currentProfile?.full_name;
  const holder=band?.querySelector('.ppx-pass-foot b');
  if(holder)holder.textContent=name?String(name).toUpperCase().slice(0,26):'YOUR NAME';
}
const baseShowHome=showHome;
showHome=function(opts){baseShowHome(opts);renderRecent();};
syncHomePlusBand();
renderRecent();

/* =====================================================================
   Batch 3 — Account, Preferences, Help, Brands, Stores, Info pages
   ===================================================================== */
let renderingPageKind=null;
const PAGE_KINDS=[
  {route:'brands',match:h=>h.includes('pp-discovery-shell')&&h.includes('SHOP BY BRAND'),eyebrow:'SHOP BY BRAND',title:'All Brands',sub:'Pick a brand to see its products and compare store offers.',icon:ICON.star,build:()=>typeof ppOpenAllBrands==='function'&&ppOpenAllBrands()},
  {route:'stores',match:h=>h.includes('pp-discovery-shell')&&h.includes('SHOP BY STORE'),eyebrow:'SHOP BY STORE',title:'All Stores',sub:'Pick a store to see every product we compare there.',icon:ICON.check,build:()=>typeof ppOpenAllStores==='function'&&ppOpenAllStores()},
  {route:'help',match:h=>h.includes('pp-support-shell'),eyebrow:'HELP & SUPPORT',title:'How can we help?',sub:'Find an answer quickly or contact the PricePulse team.',icon:ICON.shield,build:()=>typeof renderHelpSupportPanel==='function'&&renderHelpSupportPanel()},
  {route:'preferences',match:h=>h.includes('pp-preferences-shell'),eyebrow:'ACCOUNT SETTINGS',title:'Preferences',sub:'Choose your language, alert defaults and notification settings.',icon:ICON.clock,build:()=>typeof renderPreferencesPanel==='function'&&renderPreferencesPanel(),auth:true,back:'account'}
];
PAGE_KINDS.forEach(kind=>{
  routes[kind.route]=()=>{
    if(kind.auth&&!authed()){askSignIn('preferences-open');window.ppGoHome();return;}
    showPage(kind.route,`<div class="ppx-product ppx-list-page ppx-modal-page container" data-kind="${kind.route}">
      <nav class="ppx-crumbs" aria-label="Breadcrumb"><a href="#home" class="ppx-back" data-ppx-action="back">${ICON.back}Back</a><span>/</span><span class="is-current">${H(kind.title)}</span></nav>
      ${pageHead({eyebrow:kind.eyebrow,title:H(kind.title),sub:kind.sub,icon:kind.icon})}
      <section class="ppx-panel ppx-modal-content" id="ppxModalHost"></section></div>`);
    document.title=`${kind.title} | PricePulse`;
    renderingPageKind=kind;
    try{kind.build();}finally{renderingPageKind=null;}
  };
});
{
  const prevOpen=window.openModal;
  window.openModal=function(html){
    if(typeof html==='string'){
      if(renderingPageKind&&renderingPageKind.match(html)){
        const host=document.getElementById('ppxModalHost');
        if(host){host.innerHTML=html;return;}
      }
      const kind=PAGE_KINDS.find(k=>k.match(html));
      if(kind&&!renderingPageKind){window.ppGoPage(kind.route);return;}
      if(html.includes('account-panel')&&html.includes('account-details')){window.ppGoPage('account');return;}
    }
    return prevOpen.apply(this,arguments);
  };
}
/* discovery cards: go back home, then let the original filter run */
document.addEventListener('click',e=>{
  if(!e.target.closest('[data-discovery-brand],[data-discovery-store]'))return;
  const r=parseRoute();
  if(!r||(r.name!=='brands'&&r.name!=='stores'))return;
  window.ppGoHome();
  setTimeout(()=>document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
},true);
/* preferences cancel → back to account */
document.addEventListener('click',e=>{
  if(!e.target.closest('[data-pp-pref="cancel"]'))return;
  const r=parseRoute();
  if(r&&r.name==='preferences'){e.preventDefault();e.stopImmediatePropagation();window.ppGoPage('account');}
},true);

/* ---------- Info / legal pages (#/info/<key>) ---------- */
const INFO_KEYS=['about','contact','privacy','terms','affiliate'];
routes.info=(key)=>{
  const all=typeof infoContent!=='undefined'?infoContent:{};
  const item=all[key];
  if(!item){showPage('info',notFoundHTML());return;}
  const nav=INFO_KEYS.filter(k=>all[k]).map(k=>`<a href="#/info/${k}" class="${k===key?'is-active':''}" ${k===key?'aria-current="page"':''}>${H(all[k].title)}</a>`).join('');
  showPage('info',`<div class="ppx-product ppx-list-page container">${crumbs(item.title)}
    ${pageHead({eyebrow:'PRICEPULSE',title:H(item.title),sub:'',icon:ICON.shield})}
    <div class="ppx-info"><nav class="ppx-panel ppx-info-nav" aria-label="Information pages">${nav}</nav><article class="ppx-panel ppx-info-body legal-copy">${item.body}</article></div></div>`);
  document.title=`${item.title} | PricePulse`;
};
document.addEventListener('click',e=>{
  const b=e.target.closest('.info-link[data-info]');
  if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  window.ppGoPage('info',b.dataset.info);
},true);

/* ---------- Account page (#/account) ---------- */
function accountHTML(){
  const p=(typeof currentProfile!=='undefined'&&currentProfile)||{};
  const email=p.email||(typeof currentUser!=='undefined'&&currentUser?.email)||'';
  const name=p.full_name||'My Account';
  const initials=String(name).trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase()||'P';
  const plus=typeof ppPlusIsActive==='function'&&ppPlusIsActive();
  const alerts=typeof ppActiveDealAlertCount==='function'?ppActiveDealAlertCount():0;
  const limit=typeof ppDealAlertLimit==='function'?ppDealAlertLimit():1;
  const wish=typeof saved!=='undefined'?saved.size:0;
  const loc=[p.city,p.state,p.country].filter(Boolean).join(', ');
  const tile=(href,icon,title,sub,extra='')=>`<a class="ppx-acc-tile" href="${href}" ${extra}><span class="ppx-icon-tile">${icon}</span><span><b>${title}</b><small>${sub}</small></span><i aria-hidden="true">›</i></a>`;
  return `<div class="ppx-product ppx-list-page container">${crumbs('My Account')}
    <section class="ppx-acc-hero pp-onebar">
      <span class="ppx-acc-avatar" aria-hidden="true">${H(initials)}</span>
      <h1>${H(name)}</h1><div class="pp-ob-stats"><span class="pp-ob-tag${plus?' is-gold':''}">${plus?'Plus member':'Free member'}</span><span>${H(email)}</span></div>
      <div class="ppx-acc-hero-actions"><button type="button" class="ppx-btn ppx-btn-ghost" data-ppx-acc="edit">Edit profile</button>${plus?'':`<a class="ppx-btn ppx-btn-gold" href="#/plus">${ICON.crown}Get Plus · ₹99</a>`}</div>
    </section>
    <div class="ppx-acc-stats">
      <a href="#/wishlist"><b>${wish}</b><span>Saved products</span></a>
      <a href="#/alerts"><b>${alerts}<small>/${limit}</small></b><span>Active deal alerts</span></a>
      <a href="#/plus"><b>${plus?'Active':'Free'}</b><span>Membership</span></a>
    </div>
    <section class="pp-refer" aria-label="Invite and earn"><span class="pp-refer-ic" aria-hidden="true">🎁</span>
      <div><span class="ppx-eyebrow">INVITE &amp; EARN</span><h2>You get ₹100. Your friend gets ₹100.</h2>
        <p>Both rewards unlock step by step from your friend's confirmed shopping. On your own shopping, ${Math.round(CB_SHARE*100)}% of what the store pays us comes back to you as cashback (not on Amazon).</p></div>
      <a class="ppx-btn ppx-btn-gold" href="wallet.html#invite">Invite friends →</a></section>
    <div class="ppx-acc-grid">
      <section class="ppx-panel ppx-acc-details"><div class="ppx-panel-head"><h2>Profile details</h2><button type="button" class="ppx-link" data-ppx-acc="edit">Edit</button></div>
        <dl>
          <div><dt>Mobile</dt><dd>${H(p.mobile||'—')}</dd></div>
          <div><dt>Location</dt><dd>${H(loc||'—')}</dd></div>
          <div><dt>PIN code</dt><dd>${H(p.pin_code||'—')}</dd></div>
          <div><dt>Deal alert emails</dt><dd>${p.deal_alerts===false?'Off':'On'}</dd></div>
        </dl>
      </section>
      <section class="ppx-panel ppx-acc-links"><h2 class="ppx-sr">Account shortcuts</h2>
        ${tile('#/wishlist',ICON.heart,'My Wishlist','Saved products &amp; price updates')}
        ${tile('#/alerts',ICON.bell,'Deal Alerts',`${alerts} of ${limit} in use`)}
        ${tile('wallet.html',ICON.check,'Wallet','Rewards, referrals &amp; redemptions')}
        ${tile('#/plus',ICON.crown,'PricePulse Plus',plus?'Membership active':'₹99/year · savings membership')}
        ${tile('#/preferences',ICON.clock,'Preferences','Language, notifications &amp; defaults')}
        ${tile('#/help',ICON.shield,'Help &amp; Support','FAQ &amp; contact')}
        <button type="button" class="ppx-acc-signout" data-ppx-acc="signout">Sign out</button>
      </section>
    </div></div>`;
}
routes.account=()=>{
  if(!authed()){askSignIn('account-open');window.ppGoHome();return;}
  showPage('account',accountHTML());
  document.title='My Account | PricePulse';
};
pageView.addEventListener('click',async e=>{
  const b=e.target.closest('[data-ppx-acc]');
  if(!b)return;
  const a=b.dataset.ppxAcc;
  if(a==='edit'&&typeof renderProfileForm==='function')renderProfileForm(currentProfile?.email||currentUser?.email||'',currentProfile);
  if(a==='signout'&&typeof signOutFromAccountPopover==='function'){await signOutFromAccountPopover(b);window.ppGoHome();}
});
/* account menu "My Profile" opens the account page */
{
  const pop=typeof ensureAccountPopover==='function'?ensureAccountPopover():null;
  pop?.addEventListener('click',e=>{
    const b=e.target.closest('[data-account-action]');
    if(!b)return;
    const map={profile:['account'],preferences:['preferences'],help:['help']};
    const t=map[b.dataset.accountAction];
    if(!t)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(typeof closeAccountPopover==='function')closeAccountPopover();
    window.ppGoPage(...t);
  },true);
}
if(typeof renderAccountPanel==='function'){
  const orig=renderAccountPanel;
  window.renderAccountPanel=function(){if(authed())return window.ppGoPage('account');return orig.apply(this,arguments);};
}
/* refresh the account page after profile edits / Plus changes */
{
  const prev=window.updateAccountHeader;
  window.updateAccountHeader=function(){
    const res=prev.apply(this,arguments);
    const r=parseRoute();
    if(r&&r.name==='account'&&!pageView.hidden){if(authed())pageView.innerHTML=accountHTML();else window.ppGoHome();}
    if(authed()){let next='';try{next=sessionStorage.getItem('ppx_after_auth')||'';sessionStorage.removeItem('ppx_after_auth');}catch(_){}
      if(next&&(!r||r.name!==next))setTimeout(()=>window.ppGoPage(next),50);}
    return res;
  };
}
/* bottom-nav Account goes to the account page when signed in */
document.getElementById('ppBottomNav')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-ppx-nav="account"]');
  if(!b||!authed())return;
  e.stopImmediatePropagation();
  window.ppGoPage('account');
},true);


/* ---------- Home-only controls work from any page ---------- */
function leavePageForHome(){
  const onPage=!pageView.hidden||parseRoute();
  const plusOpen=document.body.classList.contains('pp-plus-page-open');
  if(!onPage&&!plusOpen)return false;
  if(parseRoute())history.pushState(null,'',location.pathname+location.search);
  if(plusOpen)closePlusPage();
  showHome({restore:false});
  return true;
}
const HOME_ONLY='.category-nav button,.menu-category,[data-scroll],#footerCategoriesLink,#startComparingBtn,.brand-card[data-brand],.store-card[data-store]';
document.addEventListener('click',e=>{
  const el=e.target.closest(HOME_ONLY);
  if(!el||el.closest('#ppPageView'))return;
  if(el.id==='allCategoriesBtn')return;
  if(document.body.dataset.ppPage==='deals'&&el.matches('.category-nav [data-cat]')&&!el.classList.contains('deals-nav'))return; // V225: deals page handles its own filter
  if(leavePageForHome()){
    const target=el.dataset.scroll||(el.closest('.category-nav,.all-categories-menu,#footerCategoriesLink')?'#deals':'');
    if(target)setTimeout(()=>document.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'start'}),60);
  }
},true);
document.getElementById('siteSearch')?.addEventListener('submit',()=>{if(leavePageForHome())setTimeout(()=>document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'}),60);},true);

/* V233: picking a category (top bar or All Categories menu) lands just above the
   "LIVE · CHECKED" line, right under the sticky header, so the heading, tabs and cards fit.
   Works whichever code started the scroll: wait until the page settles, then correct. */
let landRun=0;
function dealsLandTop(){
  const eb=document.querySelector('#deals .deals-title .eyebrow')||document.querySelector('#deals .deals-title')||document.getElementById('deals');
  if(!eb||(homeMain&&homeMain.hidden))return null;
  const gap=window.innerWidth<=760?10:14;
  return Math.max(0,Math.round(eb.getBoundingClientRect().top+window.scrollY-stickyTop()-gap));
}
/* One smooth move straight to the right spot (no second correction): while it runs, other scroll
   calls are ignored, and the target is re-read every frame so the shrinking header is followed. */
const _siv=Element.prototype.scrollIntoView,_wst=window.scrollTo,_wsc=window.scroll;
let landLock=false;
function landDeals(){
  const run=++landRun;
  let t0=performance.now(),t1=0,startY=null,moved=false;
  const DUR=520,HOLD=700;
  const mv=()=>{moved=true;};
  const evs=['wheel','touchstart','keydown'];
  evs.forEach(ev=>window.addEventListener(ev,mv,{passive:true}));
  landLock=true;
  Element.prototype.scrollIntoView=function(){if(!landLock)return _siv.apply(this,arguments);};
  window.scrollTo=function(){if(!landLock)return _wst.apply(window,arguments);};
  window.scroll=window.scrollTo;
  const end=()=>{
    evs.forEach(ev=>window.removeEventListener(ev,mv));
    if(run!==landRun)return;
    landLock=false;Element.prototype.scrollIntoView=_siv;window.scrollTo=_wst;window.scroll=_wsc;
  };
  const frame=now=>{
    if(run!==landRun){evs.forEach(ev=>window.removeEventListener(ev,mv));return;}
    if(moved||now-t0>DUR+HOLD+2500){end();return;}
    const target=dealsLandTop();
    if(target!=null){
      if(startY==null){startY=window.scrollY;t1=now;}
      const k=Math.min(1,(now-t1)/DUR),e=1-Math.pow(1-k,3);
      _wst.call(window,{top:startY+(target-startY)*e,behavior:'instant'});
      if(now-t1>DUR+HOLD){end();return;}
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('.category-nav button[data-cat]');
  if(!b||b.id==='homeNavBtn'||b.classList.contains('deals-nav')||b.closest('#ppPageView')||!CAT_LABEL[b.dataset.cat])return;
  if(document.body.dataset.ppPage==='deals')return; /* the Deals page filters itself */
  landDeals();
},true);


/* =====================================================================
   Section 1 — Header + Hero (V205)
   ===================================================================== */
const FLAME='<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2c.6 3.3-1.2 5-2.7 6.6C7.8 10.2 6.5 11.8 6.5 14.3A5.5 5.5 0 0 0 12 20a5.5 5.5 0 0 0 5.5-5.7c0-2.2-1-3.9-2.2-5.2.1 1.6-.4 2.8-1.6 3.4.3-3.5-.7-7.4-1.7-10.5Z"/></svg>';
const SEARCH_ICON='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';

/* 1 + 2: Deals pill, clearer search placeholder */
const dealsNav=document.querySelector('.category-nav .deals-nav');
if(dealsNav){dealsNav.classList.add('ppx-deals-pill');dealsNav.innerHTML=`${FLAME}<span>Deals</span>`;}
const headerInput=document.getElementById('searchInput');
/* V253: the one search box (#siteSearch) lives under the category row in index.html */

/* product index for search + hero */
function productIndex(){
  return [...document.querySelectorAll('.deal-card')].map(card=>{
    const btn=card.querySelector('.compare-btn');
    const id=card.querySelector('.heart')?.dataset.id;
    if(!btn||!id)return null;
    const name=btn.dataset.product||'';
    return {id,card,btn,name,brand:card.dataset.brandName||'',category:card.dataset.category||'',hay:`${name} ${card.dataset.search||''} ${card.dataset.brandName||''} ${card.dataset.category||''}`.toLowerCase()};
  }).filter(Boolean);
}
function bestPrice(p){
  const st=typeof ppRetailerStripState==='function'?ppRetailerStripState(p.btn.dataset,p.id):{offers:[],inStock:[]};
  const price=Number.isFinite(st.lowest)?st.lowest:(st.inStock?.length===1?st.inStock[0].price:null);
  return {price,stores:st.offers?.length||0,state:st};
}
function photoOf(p){const img=p.card.querySelector('.product-photo');return img?.currentSrc||img?.getAttribute('src')||'';}
const CAT_LABEL={mobiles:'Mobiles',laptops:'Laptops',electronics:'Electronics',home:'Home & Kitchen',fashion:'Fashion',appliances:'Appliances',beauty:'Beauty',watches:'Watches'};
const catLabel=c=>CAT_LABEL[c]||String(c||'').replace(/\b\w/g,m=>m.toUpperCase());

/* 9: search suggestions */
function rankMatches(q){
  const query=String(q||'').trim().toLowerCase();
  if(query.length<2)return [];
  const words=query.split(/\s+/).filter(Boolean);
  return productIndex().map(p=>{
    const n=p.name.toLowerCase();
    let score=0;
    if(n.startsWith(query))score=100;
    else if(n.includes(query))score=80;
    else if(words.every(w=>p.hay.includes(w)))score=60;
    else if(typeof ppSmartSearchMatch==='function'&&ppSmartSearchMatch(p.card.dataset.search||'',query))score=40;
    return {p,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,6).map(x=>x.p);
}
function attachSuggest(input,{onSubmitAll}){
  if(!input)return;
  const host=input.closest('form')||input.parentElement;
  host.classList.add('ppx-suggest-host');
  const box=document.createElement('div');
  box.className='ppx-suggest';
  box.id=`ppxSuggest_${Math.random().toString(36).slice(2,8)}`;
  box.setAttribute('role','listbox');
  box.hidden=true;
  host.appendChild(box);
  input.setAttribute('role','combobox');
  input.setAttribute('aria-controls',box.id);
  input.setAttribute('aria-expanded','false');
  input.setAttribute('aria-autocomplete','list');
  let active=-1,items=[];
  const close=()=>{box.hidden=true;input.setAttribute('aria-expanded','false');active=-1;};
  const setActive=i=>{
    const opts=[...box.querySelectorAll('[role="option"]')];
    active=Math.max(-1,Math.min(opts.length-1,i));
    opts.forEach((o,k)=>o.classList.toggle('is-active',k===active));
    if(active>=0)input.setAttribute('aria-activedescendant',opts[active].id);else input.removeAttribute('aria-activedescendant');
  };
  const render=()=>{
    const q=input.value;
    /* V277 (P21): a pasted store link is compared, not searched - no suggestion list for links */
    if(/^\s*(https?:\/\/|www\.)|\.(com|in|co)\/\S/i.test(q)){close();return;}
    items=rankMatches(q);
    if(String(q).trim().length<2){close();return;}
    const rows=items.map((p,i)=>{
      const b=bestPrice(p);
      return `<a role="option" id="${box.id}_${i}" class="ppx-sg-item" href="#/product/${encodeURIComponent(p.id)}"><span class="ppx-sg-img">${photoOf(p)?`<img src="${H(photoOf(p))}" alt="">`:''}</span><span class="ppx-sg-copy"><b>${H(p.name)}</b><small>${H([catLabel(p.category),p.brand].filter(Boolean).join(' · '))}</small></span><span class="ppx-sg-price">${Number.isFinite(b.price)?`<b>${M(b.price)}</b><small>best of ${b.stores}</small>`:`<small>${b.stores} stores</small>`}</span></a>`;
    }).join('');
    box.innerHTML=(rows||`<div class="ppx-sg-empty">No exact match yet. Press Enter to search all deals.</div>`)+`<button type="button" class="ppx-sg-all" data-sg-all>${SEARCH_ICON}<span>See all results for “${H(q.trim())}”</span></button>`;
    box.hidden=false;input.setAttribute('aria-expanded','true');active=-1;
  };
  input.addEventListener('input',render);
  input.addEventListener('focus',()=>{if(input.value.trim().length>=2)render();});
  input.addEventListener('keydown',e=>{
    if(box.hidden)return;
    const n=box.querySelectorAll('[role="option"]').length;
    if(e.key==='ArrowDown'){e.preventDefault();setActive(active+1>=n?0:active+1);}
    else if(e.key==='ArrowUp'){e.preventDefault();setActive(active-1<0?n-1:active-1);}
    else if(e.key==='Escape'){close();}
    else if(e.key==='Enter'&&active>=0){e.preventDefault();const a=box.querySelectorAll('[role="option"]')[active];close();input.blur();location.hash=a.getAttribute('href');}
  });
  box.addEventListener('mousedown',e=>e.preventDefault());
  box.addEventListener('click',e=>{
    if(e.target.closest('[data-sg-all]')){close();onSubmitAll();return;}
    if(e.target.closest('[role="option"]')){close();input.blur();}
  });
  input.addEventListener('blur',()=>setTimeout(close,120));
  host.addEventListener('submit',close,true);
}
attachSuggest(headerInput,{onSubmitAll:()=>document.getElementById('siteSearch')?.requestSubmit()});

/* 4–8 + 10: hero */
const hero=document.querySelector('.hero');
const heroCopy=hero?.querySelector('.hero-copy');
const heroArt=hero?.querySelector('.hero-art');
const originalArt=heroArt?.innerHTML||'';
if(hero&&heroCopy){
  hero.classList.add('ppx-hero-v2');
  /* 8: Plus line */
  const plusLine=document.createElement('a');
  plusLine.className='ppx-hero-plus';
  plusLine.href='#/plus';
  plusLine.id='ppxHeroPlus';
  plusLine.innerHTML=`<span class="ppx-hero-plus-new">NEW</span><span>PricePulse <b>Plus</b> · ₹99/year · Get ₹100 back</span><i aria-hidden="true">→</i>`;
  heroCopy.prepend(plusLine);
  /* 6: benefits as a clean trust strip */
  const benefits=heroCopy.querySelector('.benefits');
  if(benefits){
    benefits.classList.add('ppx-hero-trust');
    /* V217.2: clearer icons — compare (two-way arrows), trusted (shield + tick), save time (stopwatch) */
    const sv=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const icons=[sv('<path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="m17 12 4 4-4 4"/><path d="M21 16H8"/>'),sv('<path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),sv('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.8l2.6 1.6"/><path d="M10 2.5h4"/><path d="M18.4 6.6 20 5"/>')];
    benefits.querySelectorAll(':scope > div').forEach((d,i)=>{const ic=d.querySelector('i');if(ic)ic.outerHTML=`<span class="ppx-ht-icon">${icons[i]||ICON.check}</span>`;});
  }
}
/* 5 + 10: live comparison card / today's best drop */
function pickHeroProduct(){
  let best=null;
  for(const p of productIndex()){
    const b=bestPrice(p);
    if(!Number.isFinite(b.price)||(b.state.inStock?.length||0)<2)continue;
    const ins=priceInsight(p.id,b.price);
    const lowOffer=b.state.uniqueLowest||b.state.bestOffers?.[0];
    const sav=lowOffer&&typeof ppOfferSavings==='function'?ppOfferSavings(lowOffer):null;
    const drop=ins.dropSinceStart||0;
    const score=drop>0?1e7+drop:(sav?.saving||0);
    if(!best||score>best.score)best={p,b,ins,sav,drop,score};
  }
  return best;
}
function renderHeroCard(){
  if(!heroArt)return;
  const pick=pickHeroProduct();
  if(!pick){if(!heroArt.querySelector('img[src*="hero-products"]'))heroArt.innerHTML=originalArt;heroArt.classList.remove('ppx-hero-art-live');return;}
  const {p,b,ins,sav,drop}=pick;
  const offers=[...b.state.offers].filter(o=>o.price!=null).sort((x,y)=>x.price-y.price).slice(0,3);
  const lowest=b.price;
  const rows=offers.map(o=>{
    const isLow=o.price===lowest;
    const logo=typeof ppPopupRetailerRowLogo==='function'?ppPopupRetailerRowLogo(o):H(o.name);
    return `<div class="ppx-hc-row ${isLow?'is-low':''}"><span class="ppx-hc-logo">${logo}</span><b>${M(o.price)}</b>${isLow?'<em>LOWEST</em>':`<small>+${M(o.price-lowest)}</small>`}</div>`;
  }).join('');
  const badge=drop>0?`${ICON.trend}Today's best drop`:`${ICON.shield}Best verified deal`;
  const foot=drop>0?`<span class="ppx-hc-drop">↓ ${M(drop)} in ${ins.days} ${ins.days===1?'day':'days'}</span>`:(sav?`<span class="ppx-hc-drop">Save ${M(sav.saving)} vs MRP</span>`:'<span class="ppx-hc-drop">Compared across stores</span>');
  /* back layers: other products peeking behind the card */
  const others=productIndex().filter(x=>x.id!==p.id&&photoOf(x)).slice(0,2);
  const layer=(x,cls)=>{const bp=bestPrice(x);return `<div class="ppx-hc-layer ${cls}" aria-hidden="true"><span class="ppx-hc-layer-img"><img src="${H(photoOf(x))}" alt=""></span><span class="ppx-hc-layer-copy"><b>${H(x.name.split(/\s+/).slice(0,3).join(' '))}</b><small>${Number.isFinite(bp.price)?M(bp.price):`${bp.stores} stores`}</small></span></div>`;};
  const sig=`${p.id}|${offers.map(o=>o.name+o.price).join(',')}|${drop}|${sav?.saving||0}`;
  if(heroArt.dataset.sig===sig)return;
  heroArt.dataset.sig=sig;
  heroArt.classList.add('ppx-hero-art-live');
  heroArt.innerHTML=`<div class="ppx-hc-wrap"><div class="ppx-hc-stage">
    ${others[1]?layer(others[1],'l2'):''}${others[0]?layer(others[0],'l1'):''}
    <a class="ppx-hero-card" href="#/product/${encodeURIComponent(p.id)}" aria-label="Compare ${H(p.name)} prices">
      <i class="ppx-hc-shine" aria-hidden="true"></i>
      <div class="ppx-hc-top ppx-z1"><span class="ppx-hc-badge">${badge}</span><span class="ppx-hc-live"><i aria-hidden="true"></i>Verified prices</span></div>
      <div class="ppx-hc-product ppx-z2"><span class="ppx-hc-img ${ppxGlobalImg(p.id,photoOf(p)).surface}">${ppxGlobalImg(p.id,photoOf(p)).img}</span><span class="ppx-hc-name"><b>${H(p.name)}</b><small>${H([catLabel(p.category),p.brand].filter(Boolean).join(' · '))}</small></span></div>
      <div class="ppx-hc-rows ppx-z1">${rows}</div>
      <div class="ppx-hc-foot ppx-z1">${foot}<span class="ppx-hc-cta">Compare all ${b.stores} stores →</span></div>
    </a>
  </div>
    <span class="ppx-hc-float f1" aria-hidden="true">${ICON.tick}<b>${M(lowest)}</b> lowest</span>
    <span class="ppx-hc-float f2" aria-hidden="true">${ICON.shield}${b.stores} stores checked</span>
  </div>`;
  animateHeroCard();
}
const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function animateHeroCard(){
  const wrap=heroArt?.querySelector('.ppx-hc-wrap');
  if(!wrap)return;
  /* price count-up */
  if(!reduceMotion){
    wrap.querySelectorAll('.ppx-hc-row b').forEach((el,i)=>{
      const target=Number(String(el.textContent).replace(/[^0-9.]/g,''));
      if(!Number.isFinite(target)||target<=0)return;
      const from=Math.round(target*1.12),t0=performance.now()+i*120,dur=900;
      el.textContent=M(from);
      const step=now=>{const k=Math.min(1,Math.max(0,(now-t0)/dur));const e=1-Math.pow(1-k,3);el.textContent=M(Math.round(from+(target-from)*e));if(k<1)requestAnimationFrame(step);};
      requestAnimationFrame(step);
    });
  }
  /* mouse-follow 3D tilt (desktop, fine pointer) */
  if(reduceMotion||!window.matchMedia?.('(pointer:fine)').matches)return;
  const stage=wrap.querySelector('.ppx-hc-stage');
  let raf=0;
  wrap.addEventListener('pointermove',e=>{
    const r=wrap.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{stage.style.setProperty('--ry',`${(-14+x*16).toFixed(2)}deg`);stage.style.setProperty('--rx',`${(7-y*12).toFixed(2)}deg`);stage.style.setProperty('--gx',`${((x+.5)*100).toFixed(1)}%`);stage.style.setProperty('--gy',`${((y+.5)*100).toFixed(1)}%`);stage.classList.add('is-tilting');});
  });
  wrap.addEventListener('pointerleave',()=>{stage.classList.remove('is-tilting');stage.style.removeProperty('--ry');stage.style.removeProperty('--rx');});
}
function syncHeroPlus(){const el=document.getElementById('ppxHeroPlus');if(el)el.hidden=typeof ppPlusIsActive==='function'&&ppPlusIsActive();}
renderHeroCard();syncHeroPlus();
if(typeof window.ppUpdateHomeCardPrices==='function'){
  const orig=window.ppUpdateHomeCardPrices;
  window.ppUpdateHomeCardPrices=function(){const r=orig.apply(this,arguments);try{renderHeroCard()}catch(_){}return r;};
}
if(typeof window.ppApplyHistoryRows==='function'){
  const orig=window.ppApplyHistoryRows;
  window.ppApplyHistoryRows=function(){const r=orig.apply(this,arguments);try{renderHeroCard()}catch(_){}return r;};
}
{
  const prev=window.updateAccountHeader;
  window.updateAccountHeader=function(){const r=prev.apply(this,arguments);syncHeroPlus();return r;};
}

/* 3: highlight the product's category in the nav on product pages */
function highlightNavCategory(cat){
  if(!window.__ppNavSaved)window.__ppNavSaved=[...document.querySelectorAll('.category-nav .nav-selected[data-cat]')].map(b=>b.dataset.cat);
  document.querySelectorAll('.category-nav [data-cat]').forEach(b=>b.classList.toggle('nav-selected',!!cat&&b.dataset.cat===cat));
}
{
  const prevRoute=routes.product;
  routes.product=(id)=>{prevRoute(id);highlightNavCategory(productCard(id)?.dataset.category||'');};
}

/* 11: header shrinks into glass on scroll (desktop) */
let scrollTick=false;
function onScrollHeader(){
  scrollTick=false;
  document.body.classList.toggle('ppx-scrolled',window.scrollY>80&&window.innerWidth>760);
}
window.addEventListener('scroll',()=>{if(!scrollTick){scrollTick=true;requestAnimationFrame(onScrollHeader);}},{passive:true});
onScrollHeader();

/* =====================================================================
   Section 2 — Shop by Brand / Shop by Store (V207)
   ===================================================================== */
const brandSection=document.getElementById('brands');
const storeSection=document.getElementById('stores');
const oldTrust=document.querySelector('main > .trust-strip');
let discoverTab='brands';
let discoverSeen=false;
function cardsData(){
  return productIndex().map(p=>({...p,slug:p.card.dataset.brand,stores:(p.card.dataset.stores||'').toLowerCase().split(/\s+/).filter(Boolean),best:bestPrice(p)}));
}
function brandTilesHTML(){
  const data=cardsData();
  return [...document.querySelectorAll('#brandGrid .brand-card[data-brand]')].map(b=>{
    const slug=b.dataset.brand,label=b.dataset.label||slug;
    const items=data.filter(d=>d.slug===slug);
    const prices=items.map(d=>d.best.price).filter(Number.isFinite);
    const from=prices.length?Math.min(...prices):null;
    const img=b.querySelector('img');
    const LOGO_FIX={nutripro:'logos/official/nutripro-clean.png',oneplus:'logos/official/oneplus-trim.png',samsung:'logos/official/samsung-trim.png'};
    const src=LOGO_FIX[slug]||img?.currentSrc||img?.getAttribute('src')||'';
    const cat=b.querySelector('.brand-category')?.textContent?.trim()||'';
    const n=items.length;
    const thumbs=items.slice(0,3).map(d=>photoOf(d)).filter(Boolean);
    return `<button type="button" class="ppx-tile" data-ppx-brand="${H(slug)}" data-logo="${H(slug)}" aria-label="Show ${H(label)} products">
      <span class="ppx-tile-logo">${src?`<img src="${H(src)}" alt="${H(label)} logo" loading="lazy">`:`<b>${H(label)}</b>`}</span>
      <span class="ppx-tile-name">${H(label)}</span>
      <span class="ppx-tile-meta">${thumbs.length?`<span class="ppx-tile-thumbs" aria-hidden="true">${thumbs.map(t=>`<i><img src="${H(t)}" alt=""></i>`).join('')}</span>`:''}${n?`${n} ${n===1?'product':'products'}`:H(cat||'Coming soon')}</span>
      ${from?`<span class="ppx-tile-from">from <b>${M(from)}</b></span>`:''}
      <span class="ppx-tile-go" aria-hidden="true">Explore →</span>
    </button>`;
  }).join('');
}
function storeTilesHTML(){
  const data=cardsData();
  const wins={};
  data.forEach(d=>{const st=d.best.state;if((st.inStock?.length||0)<2)return;(st.bestOffers||[]).forEach(o=>{const k=String(o.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');wins[k]=(wins[k]||0)+1;});});
  const top=Object.entries(wins).sort((a,b)=>b[1]-a[1])[0];
  const topKey=top&&top[1]>0?top[0]:'';
  return [...document.querySelectorAll('#storeGrid .store-card[data-store]')].map(s=>{
    const key=s.dataset.store,label=s.dataset.label||key;
    const n=data.filter(d=>d.stores.includes(key)).length;
    const logo=typeof retailerLogo==='function'?retailerLogo(label):H(label);
    const w=wins[key]||0;
    const isTop=key===topKey;
    return `<button type="button" class="ppx-tile is-store ${isTop?'is-top':''}" data-ppx-store="${H(key)}" data-logo="${H(key)}" aria-label="Show products on ${H(label)}">
      ${isTop?`<span class="ppx-tile-badge">${ICON.crown}Most lowest prices</span>`:''}
      <span class="ppx-tile-logo">${logo}</span>
      <span class="ppx-tile-name">${H(label)}</span>
      <span class="ppx-tile-meta">${n?`${n} ${n===1?'product':'products'} compared`:'Coming soon'}</span>
      ${w?`<span class="ppx-tile-from is-win">Lowest on <b>${w}</b> ${w===1?'product':'products'}</span>`:''}
      <span class="ppx-tile-go" aria-hidden="true">Compare →</span>
    </button>`;
  }).join('');
}
function renderDiscover(){
  let sec=document.getElementById('ppxDiscover');
  if(!brandSection||!storeSection)return;
  if(!sec){
    sec=document.createElement('section');
    sec.id='ppxDiscover';
    sec.className='ppx-discover';
    sec.setAttribute('aria-label','Shop by brand or store');
    brandSection.before(sec);
    brandSection.classList.add('ppx-replaced');
    storeSection.classList.add('ppx-replaced');
    oldTrust?.classList.add('ppx-replaced');
    sec.addEventListener('click',e=>{
      const tab=e.target.closest('[data-ppx-tab]');
      if(tab){discoverTab=tab.dataset.ppxTab;renderDiscover();sec.querySelector(`[data-ppx-tab="${discoverTab}"]`)?.focus();return;}
      const bt=e.target.closest('[data-ppx-brand]');
      if(bt){document.querySelector(`#brandGrid .brand-card[data-brand="${CSS.escape(bt.dataset.ppxBrand)}"]`)?.click();return;}
      const st=e.target.closest('[data-ppx-store]');
      if(st){document.querySelector(`#storeGrid .store-card[data-store="${CSS.escape(st.dataset.ppxStore)}"]`)?.click();}
    });
    sec.addEventListener('keydown',e=>{
      if(!e.target.closest('[role="tab"]')||!['ArrowLeft','ArrowRight'].includes(e.key))return;
      discoverTab=discoverTab==='brands'?'stores':'brands';renderDiscover();sec.querySelector(`[data-ppx-tab="${discoverTab}"]`)?.focus();
    });
  }
  const isB=discoverTab==='brands';
  const nB=document.querySelectorAll('#brandGrid .brand-card[data-brand]').length;
  const nS=document.querySelectorAll('#storeGrid .store-card[data-store]').length;
  const live=dxLiveStats(nS);
  sec.innerHTML=`<div class="container">
    <div class="ppx-discover-head">
      <div><span class="ppx-eyebrow">SHOP SMARTER</span><h2>${isB?'Top brands, <span class="ppx-gold-text">lowest verified prices</span>':'Top stores, <span class="ppx-gold-text">compared every day</span>'}</h2>
        <div class="ppx-dx-live">${live.deals?`<span><i class="ppx-dx-dot" aria-hidden="true"></i><b>${live.deals}</b> verified ${live.deals===1?'deal':'deals'} today</span>`:''}<span><b>${nS}</b> stores compared</span>${live.ago?`<span>Updated <b>${live.ago}</b> ago</span>`:''}</div></div>
      <div class="ppx-discover-tools">
        <div class="ppx-tabs" role="tablist" aria-label="Browse by">
          <button type="button" role="tab" id="ppxTabBrands" aria-controls="ppxDiscoverPanel" aria-selected="${isB}" tabindex="${isB?0:-1}" data-ppx-tab="brands">Shop by Brand <small>${nB}</small></button>
          <button type="button" role="tab" id="ppxTabStores" aria-controls="ppxDiscoverPanel" aria-selected="${!isB}" tabindex="${isB?-1:0}" data-ppx-tab="stores">Shop by Store <small>${nS}</small></button>
        </div>
      </div>
    </div>
    <div class="ppx-dx-row ${discoverSeen?'is-in':''}" id="ppxDiscoverPanel" role="tabpanel" aria-labelledby="${isB?'ppxTabBrands':'ppxTabStores'}">${isB?dxBrandsHTML():dxStoresHTML()}</div>
  </div>`;
}
/* ---- V210 Discover: spotlight + colour tiles ---- */
const DX_COLOR={samsung:'#1428A0',boat:'#E21B23',philips:'#0B5ED7',dell:'#007DB8',puma:'#1A1A1A',oneplus:'#EB0028',nutripro:'#2EA06E',dotkey:'#B8862B',amazon:'#FF9900',flipkart:'#2874F0',myntra:'#FF3F6C',ajio:'#314F44',croma:'#12A88A',meesho:'#9F2089',tatacliq:'#C2185B',reliance:'#0F5BA8',reliancedigital:'#0F5BA8',vijaysales:'#E31E24',jiomart:'#37765F',nykaa:'#E80071',purplle:'#7B2CBF',aosmith:'#C8102E',adidas:'#1A1A1A',apple:'#616663',asus:'#326955',atomberg:'#F26A1B',campus:'#E8402A',casio:'#C8102E',cetaphil:'#0072BC',hp:'#0096D6',hawkins:'#C8102E',jbl:'#F36F21',kent:'#1E4D9B',lg:'#A50034',minimalist:'#3B3B3B',noise:'#1A1A1A',nothing:'#1A1A1A',oppo:'#1D8F5A',pigeon:'#E1262C',prestige:'#C8102E',sony:'#1A1A1A',thedermaco:'#346D58',whirlpool:'#D99A00',xiaomi:'#FF6900',realme:'#D4A000',vivo:'#415FFF',shopsy:'#5B3FD9'};
const dxColor=k=>DX_COLOR[k]||DX_COLOR[String(k||'').toLowerCase().replace(/[^a-z0-9]/g,'')]||'';
const DX_LOGO_FIX={nutripro:'logos/official/nutripro-clean.png',oneplus:'logos/official/oneplus-trim.png',samsung:'logos/official/samsung-trim.png'};
function dxLiveStats(){
  let deals=0,last=0;
  for(const p of productIndex()){
    const b=bestPrice(p);
    if(Number.isFinite(b.price))deals++;
    (b.state.offers||[]).forEach(o=>{const t=Date.parse(o.checkedAt||'');if(Number.isFinite(t)&&t>last)last=t;});
  }
  let ago='';
  if(last){const m=Math.max(1,Math.round((Date.now()-last)/60000));ago=m<60?`${m}m`:m<1440?`${Math.round(m/60)}h`:`${Math.round(m/1440)}d`;}
  return {deals,ago};
}
function dxDeal(p){
  const b=bestPrice(p);
  if(!Number.isFinite(b.price))return {p,b,price:null};
  const low=b.state.uniqueLowest||b.state.bestOffers?.[0];
  const sav=low&&typeof ppOfferSavings==='function'?ppOfferSavings(low):null;
  const ins=priceInsight(p.id,b.price);
  return {p,b,price:b.price,sav,ins,store:low?.name||''};
}
function dxSpotHTML(d,{tag,logoHTML,cta,href}){
  const good=d.ins?.verdict?.tone==='good'&&d.ins.days>1;
  const badge=good?`Lowest in ${d.ins.days} days`:(d.sav?.percent?`${d.sav.percent}% off`:'Verified price');
  return `<a class="ppx-dx-spot" href="${href}" aria-label="${H(d.p.name)} best price">
    <span class="ppx-dx-spot-img"><span class="ppx-dx-low">${H(badge)}</span>${photoOf(d.p)?`<img src="${H(photoOf(d.p))}" alt="" loading="lazy">`:''}</span>
    <span class="ppx-dx-spot-info">
      <span class="ppx-dx-tag">★ ${H(tag)}</span>
      <span class="ppx-dx-spot-logo">${logoHTML}</span>
      <span class="ppx-dx-pn">${H(d.p.name)}</span>
      <span class="ppx-dx-pr"><b>${M(d.price)}</b>${d.sav?`<s>${M(d.sav.mrp)}</s>`:''}</span>
      ${d.sav?`<span class="ppx-dx-save">Save ${M(d.sav.saving)}</span>`:''}
      <span class="ppx-dx-btn">${H(cta)} →</span>
    </span></a>`;
}
function dxTileHTML({key,attr,color,logoHTML,count,d,emptyText}){
  if(!color){const m=/#ppc=([0-9a-fA-F]{6})/.exec(String(logoHTML||''));if(m)color='#'+m[1];} /* V241 J1: colour saved from Admin with the logo */
  const price=d&&Number.isFinite(d.price);
  const off=price&&d.sav?.percent?`<span class="ppx-dx-off">-${d.sav.percent}%</span>`:'';
  const img=d&&photoOf(d.p);
  return `<button type="button" class="ppx-dx-tile" ${attr}="${H(key)}" data-logo="${H(key)}" style="--c:${color||'#B8862B'}"${color?'':' data-ppx-autotint="1"'}>
    <span class="ppx-dx-hd"><span class="ppx-dx-pill">${logoHTML}</span><span class="ppx-dx-cnt">${H(count)}</span></span>
    <span class="ppx-dx-pi">${off}${img?`<img src="${H(img)}" alt="" loading="lazy">`:''}</span>
    <span class="ppx-dx-ft">${price?`<span class="ppx-dx-fp"><small>from</small><b>${M(d.price)}</b>${d.sav?`<s>${M(d.sav.mrp)}</s>`:''}</span>`:`<span class="ppx-dx-fp"><small>${H(emptyText||'Price coming soon')}</small><em>${ICON.bell} Track prices</em></span>`}<i class="ppx-dx-go" aria-hidden="true">→</i></span>
  </button>`;
}
function dxAllHTML(href,labels,more,text){
  return `<a class="ppx-dx-all" href="${href}"><span class="ppx-dx-stack" aria-hidden="true">${labels.map(l=>`<i>${H(l)}</i>`).join('')}${more>0?`<i>+${more}</i>`:''}</span><b>${text}</b><span class="ppx-dx-ar" aria-hidden="true">→</span></a>`;
}
function dxBrandList(deals){
  return [...document.querySelectorAll('#brandGrid .brand-card[data-brand]')].map(b=>{
    const slug=b.dataset.brand,label=b.dataset.label||slug;
    const img=b.querySelector('img');
    const src=DX_LOGO_FIX[slug]||img?.currentSrc||img?.getAttribute('src')||'';
    const mine=deals.filter(d=>d.p.card.dataset.brand===slug);
    const priced=mine.filter(d=>d.price!=null).sort((x,y)=>(y.sav?.percent||0)-(x.sav?.percent||0)||x.price-y.price);
    /* V236: tile photo/price/saving all come from the SAME product (the cheapest one) */
    const cheapest=[...priced].sort((x,y)=>x.price-y.price||(y.sav?.percent||0)-(x.sav?.percent||0))[0];
    const top=cheapest||mine.find(d=>photoOf(d.p))||null;
    return {slug,label,src,mine,priced,top};
  });
}
function dxStoreList(deals){
  const wins={};
  deals.forEach(d=>{if((d.b.state.inStock?.length||0)<2)return;(d.b.state.bestOffers||[]).forEach(o=>{const k=String(o.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');wins[k]=(wins[k]||0)+1;});});
  const stores=[...document.querySelectorAll('#storeGrid .store-card[data-store]')].map(s=>{
    const key=s.dataset.store,label=s.dataset.label||key;
    const offers=deals.map(d=>{const o=(d.b.state.offers||[]).find(o=>String(o.name||'').toLowerCase().replace(/[^a-z0-9]/g,'')===key&&Number.isFinite(o.price));return o?{d,o}:null;}).filter(Boolean);
    const n=deals.filter(d=>(d.p.card.dataset.stores||'').toLowerCase().split(/\s+/).includes(key)).length;
    const cheapest=offers.sort((a,b)=>a.o.price-b.o.price)[0];
    const top=cheapest?{...cheapest.d,price:cheapest.o.price,sav:typeof ppOfferSavings==='function'?ppOfferSavings(cheapest.o):null}:deals.find(d=>(d.p.card.dataset.stores||'').toLowerCase().includes(key))||null;
    return {key,label,n,wins:wins[key]||0,top,logo:typeof retailerLogo==='function'?retailerLogo(label):H(label)};
  });
  return {stores,wins};
}
const dxLogoImg=b=>b.src?`<img src="${H(b.src)}" alt="${H(b.label)}">`:`<b>${H(b.label)}</b>`;
function dxBrandTile(b){return dxTileHTML({key:b.slug,attr:'data-ppx-brand',color:dxColor(b.slug),logoHTML:dxLogoImg(b),count:b.mine.length?`${b.mine.length} ${b.mine.length===1?'deal':'deals'}`:'New',d:b.top});}
function dxStoreTile(s,isTop){return dxTileHTML({key:s.key,attr:'data-ppx-store',color:dxColor(s.key),logoHTML:s.logo,count:s.wins?`Lowest on ${s.wins}`:`${s.n} compared`,d:s.top,emptyText:s.n?`${s.n} ${s.n===1?'product':'products'} listed`:'Coming soon'}).replace('class="ppx-dx-tile"',`class="ppx-dx-tile${isTop?' is-top':''}"`).replace('<span class="ppx-dx-hd">',isTop?`<span class="ppx-dx-crown">${ICON.crown}Most lowest prices</span><span class="ppx-dx-hd">`:'<span class="ppx-dx-hd">');}
function dxPageGridHTML(kind){
  const deals=productIndex().map(dxDeal);
  if(kind==='brands'){
    const list=dxBrandList(deals).sort((x,y)=>(y.priced.length>0)-(x.priced.length>0)||y.mine.length-x.mine.length);
    return list.map(dxBrandTile).join('');
  }
  const {stores}=dxStoreList(deals);
  const ranked=[...stores].sort((a,b)=>b.wins-a.wins||b.n-a.n);
  const top=ranked[0]&&ranked[0].wins>0?ranked[0].key:'';
  return ranked.map(s=>dxStoreTile(s,s.key===top)).join('');
}
function dxBrandsHTML(){
  const deals=productIndex().map(dxDeal);
  const brands=dxBrandList(deals);
  /* spotlight: best saving with good verdict, avoid repeating the hero product */
  const heroId=pickHeroProduct()?.p?.id;
  const cands=deals.filter(d=>d.price!=null&&photoOf(d.p)).sort((x,y)=>((y.ins?.verdict?.tone==='good')-(x.ins?.verdict?.tone==='good'))||(y.sav?.saving||0)-(x.sav?.saving||0));
  const spot=cands.find(d=>d.p.id!==heroId)||cands[0];
  const spotBrand=spot&&spot.p.card.dataset.brand;
  const sb=brands.find(b=>b.slug===spotBrand);
  const rest=brands.filter(b=>b.slug!==spotBrand).sort((x,y)=>(y.priced.length>0)-(x.priced.length>0)||y.mine.length-x.mine.length);
  const shown=rest.slice(0,3);
  const hidden=rest.slice(3);
  const logoImg=b=>b.src?`<img src="${H(b.src)}" alt="${H(b.label)}">`:`<b>${H(b.label)}</b>`;
  const spotHTML=spot?dxSpotHTML(spot,{tag:"TODAY'S TOP BRAND",logoHTML:sb?logoImg(sb):H(spot.p.brand),cta:'See best price',href:`#/product/${encodeURIComponent(spot.p.id)}`}):'';
  const tiles=(spot?shown:rest.slice(0,4)).map(b=>dxTileHTML({key:b.slug,attr:'data-ppx-brand',color:dxColor(b.slug),logoHTML:logoImg(b),count:b.mine.length?`${b.mine.length} ${b.mine.length===1?'deal':'deals'}`:'New',d:b.top})).join('');
  const hid=spot?hidden:rest.slice(4);
  return spotHTML+`<div class="ppx-dx-tiles">${tiles}${dxAllHTML('#/brands',hid.slice(0,2).map(b=>b.label.slice(0,4).toUpperCase()),hid.length-2,'View all<br>brands')}</div>`;
}
function dxStoresHTML(){
  const deals=productIndex().map(dxDeal);
  const {stores,wins}=dxStoreList(deals);
  const ranked=[...stores].sort((a,b)=>b.wins-a.wins||b.n-a.n);
  const lead=ranked[0]&&ranked[0].wins>0?ranked[0]:null;
  const leadDeal=lead&&deals.filter(d=>d.price!=null&&String(d.store).toLowerCase()===lead.key&&photoOf(d.p)).sort((x,y)=>(y.sav?.saving||0)-(x.sav?.saving||0))[0];
  const rest=ranked.filter(s=>!leadDeal||s!==lead);
  const shown=leadDeal?rest.slice(0,3):rest.slice(0,4);
  const hid=rest.slice(shown.length);
  const spotHTML=leadDeal?dxSpotHTML(leadDeal,{tag:'MOST LOWEST PRICES',logoHTML:lead.logo,cta:`Compare on ${lead.label}`,href:`#/product/${encodeURIComponent(leadDeal.p.id)}`}):'';
  const tiles=shown.map(s=>dxTileHTML({key:s.key,attr:'data-ppx-store',color:dxColor(s.key),logoHTML:s.logo,count:s.wins?`Lowest on ${s.wins}`:`${s.n} compared`,d:s.top,emptyText:s.n?`${s.n} ${s.n===1?'product':'products'} listed`:'Coming soon'})).join('');
  return spotHTML+`<div class="ppx-dx-tiles">${tiles}${dxAllHTML('#/stores',hid.slice(0,2).map(s=>s.label.slice(0,4).toUpperCase()),hid.length-2,'View all<br>stores')}</div>`;
}
renderDiscover();
setTimeout(renderDiscover,1500);
{
  const sec=document.getElementById('ppxDiscover');
  const reveal=()=>{discoverSeen=true;sec?.querySelector('.ppx-dx-row')?.classList.add('is-in');};
  if(sec&&'IntersectionObserver' in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){reveal();io.disconnect();}},{threshold:.15});io.observe(sec);}else reveal();
} /* brand logos may be swapped by the catalog after load */
if(typeof window.ppUpdateHomeCardPrices==='function'){
  const orig=window.ppUpdateHomeCardPrices;
  window.ppUpdateHomeCardPrices=function(){const r=orig.apply(this,arguments);try{renderDiscover()}catch(_){}return r;};
}


/* All Brands / All Stores pages use the premium tiles */
function discoverPage(kind){
  const isB=kind==='brands';
  const live=dxLiveStats();
  const n=document.querySelectorAll(isB?'#brandGrid .brand-card[data-brand]':'#storeGrid .store-card[data-store]').length;
  const liveHTML=`<div class="ppx-dx-live">${live.deals?`<span><i class="ppx-dx-dot" aria-hidden="true"></i><b>${live.deals}</b> verified ${live.deals===1?'deal':'deals'} today</span>`:''}<span><b>${n}</b> ${isB?'brands':'stores'}</span>${live.ago?`<span>Updated <b>${live.ago}</b> ago</span>`:''}</div>`;
  showPage(kind,`<div class="ppx-product ppx-list-page container ppx-discover-page">${crumbs(isB?'All Brands':'All Stores')}
    <section class="ppx-dx-pagepanel">
      <header class="ppx-dx-pagehead"><span class="ppx-eyebrow">${isB?'SHOP BY BRAND':'SHOP BY STORE'}</span><h1>${isB?'All brands, <span class="ppx-gold-text">lowest verified prices</span>':'All stores, <span class="ppx-gold-text">compared every day</span>'}</h1><p>${isB?'Pick a brand to see its products and their best verified prices.':'Pick a store to see every product we compare there.'}</p>${liveHTML}</header>
      <div class="ppx-dx-grid ${isB?'':'is-stores'}">${dxPageGridHTML(kind)}</div>
    </section></div>`);
  document.title=`${isB?'All Brands':'All Stores'} | PricePulse`;
}
routes.brands=()=>discoverPage('brands');
routes.stores=()=>discoverPage('stores');
pageView.addEventListener('click',e=>{
  const bt=e.target.closest('[data-ppx-brand]'),st=e.target.closest('[data-ppx-store]');
  if(!bt&&!st)return;
  window.ppGoHome();
  setTimeout(()=>{
    if(bt)document.querySelector(`#brandGrid .brand-card[data-brand="${CSS.escape(bt.dataset.ppxBrand)}"]`)?.click();
    else document.querySelector(`#storeGrid .store-card[data-store="${CSS.escape(st.dataset.ppxStore)}"]`)?.click();
  },40);
});

/* =====================================================================
   V211 — Section 1 growth features
   Data source today: Admin panel (Supabase RPCs). When a price API is
   connected later, only PPData below needs a new source; UI stays same.
   ===================================================================== */
const PPData=window.PPData={
  source:'manual-admin',
  rpc(name,args){
    try{
      if(typeof supabaseClient==='undefined'||!supabaseClient)return Promise.resolve({error:{message:'offline'}});
      return supabaseClient.rpc(name,args||{}).then(r=>r,e=>({error:e}));
    }catch(e){return Promise.resolve({error:e});}
  },
  async requestTrack(url,key,store){
    const r=await this.rpc('pp_request_track',{req_url:url,req_key:key,req_store:store});
    if(!r.error)return {ok:true,data:r.data};
    try{const q=JSON.parse(localStorage.getItem('pp_track_queue_v1')||'[]');if(!q.some(x=>x.key===key))q.push({url,key,store,at:Date.now()});localStorage.setItem('pp_track_queue_v1',JSON.stringify(q.slice(-30)));}catch(_){}
    return {ok:false,error:r.error};
  },
  async resolveLink(key){const r=await this.rpc('pp_resolve_track_link',{req_key:key});return r.error?null:(r.data||null);},
  async saleEvents(){
    if(Array.isArray(window.PP_SALE_EVENTS))return window.PP_SALE_EVENTS;
    const r=await this.rpc('pp_public_sale_events');return r.error||!Array.isArray(r.data)?[]:r.data;
  },
  async siteStats(){const r=await this.rpc('pp_public_site_stats');return r.error?null:(r.data||null);}
};
/* retry requests saved while offline / before SQL was installed */
setTimeout(async()=>{
  let q=[];try{q=JSON.parse(localStorage.getItem('pp_track_queue_v1')||'[]')}catch(_){}
  if(!q.length)return;
  const left=[];
  for(const it of q){const r=await PPData.rpc('pp_request_track',{req_url:it.url,req_key:it.key,req_store:it.store});if(r.error)left.push(it);}
  try{localStorage.setItem('pp_track_queue_v1',JSON.stringify(left))}catch(_){}
},4000);

/* ---------- Deal Score + real / inflated discount ---------- */
function dealAnalysis(productId,current,sav,storeCount){
  if(!Number.isFinite(current))return null;
  const series=lowestSeries(productId);
  if(series.length<3)return null;
  const now=Date.now();
  const last30=series.filter(s=>now-s.time<=30*DAY).map(s=>s.price);
  const pts=(last30.length>=2?last30:series.map(s=>s.price));
  const avg=pts.reduce((a,b)=>a+b,0)/pts.length;
  const all=[...series.map(s=>s.price),current];
  const min=Math.min(...all),max=Math.max(...all);
  const pos=max>min?(max-current)/(max-min):.6;
  const vsAvg=Math.max(0,Math.min(1,((avg-current)/avg)*5+.5));
  const storesF=storeCount>=3?1:storeCount===2?.8:.4;
  let score=Math.round(100*(.55*pos+.3*vsAvg+.15*storesF));
  if(current<=min&&max>min)score=Math.max(score,85);
  score=Math.max(5,Math.min(99,score));
  const label=score>=80?'Great time to buy':score>=60?'Good price':score>=40?'Fair, you can wait':'Wait for a drop';
  const tone=score>=60?'good':score>=40?'fair':'high';
  const realPct=Math.round(((avg-current)/avg)*1000)/10;
  const mrpPct=sav?.percent||0;
  let real;
  if(realPct>=2)real={tone:'good',short:'Real drop',text:`${realPct}% below its 30-day average`};
  else if(mrpPct>=30&&realPct<1)real={tone:'warn',short:'Inflated MRP',text:`${mrpPct}% "off" MRP, but this is its usual price`};
  else real={tone:'plain',short:'Usual price',text:'Close to its 30-day average'};
  return {score,label,tone,real,avg:Math.round(avg),realPct,mrpPct,days:Math.max(1,Math.round((now-series[0].time)/DAY))};
}
window.ppDealAnalysis=dealAnalysis;
function scoreRing(score,size=44){
  return `<span class="ppx-score" style="--s:${score};--z:${size}px" role="img" aria-label="Deal score ${score} out of 100"><b>${score}</b></span>`;
}
function dealInsightHTML(a,{compact=false}={}){
  if(!a)return '';
  return `<div class="ppx-deal-insight is-${a.tone}${compact?' is-compact':''}">${scoreRing(a.score,compact?38:48)}<span class="ppx-di-copy"><small>DEAL SCORE</small><b>${H(a.label)}</b><span class="ppx-di-real is-${a.real.tone}">${a.real.tone==='warn'?ICON.up:a.real.tone==='good'?ICON.tick:ICON.clock}<em>${H(a.real.short)}:</em> ${H(a.real.text)}</span></span></div>`;
}

/* ---------- Paste a store link ---------- */
const STORE_HOSTS=[[/(^|\.)amazon\.(in|com)$|(^|\.)amzn\.(in|to)$|(^|\.)link\.amazon$/,'Amazon'],[/(^|\.)flipkart\.com$|(^|\.)fktr\.in$/,'Flipkart'],[/(^|\.)myntra\.com$/,'Myntra'],[/(^|\.)ajio\.com$/,'AJIO'],[/(^|\.)croma\.com$/,'Croma'],[/(^|\.)meesho\.com$/,'Meesho'],[/(^|\.)nykaa\.com$/,'Nykaa'],[/(^|\.)reliancedigital\.in$/,'Reliance Digital'],[/(^|\.)tatacliq\.com$/,'Tata CLiQ'],[/(^|\.)vijaysales\.com$/,'Vijay Sales'],[/(^|\.)nykaafashion\.com$/,'Nykaa Fashion'],[/(^|\.)jiomart\.com$/,'JioMart']];
function parseStoreLink(raw){
  let s=String(raw||'').trim();
  if(!/^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/|$)/i.test(s)||/\s/.test(s))return null;
  if(!/^https?:\/\//i.test(s))s='https://'+s;
  let u;try{u=new URL(s)}catch(_){return null}
  const host=u.hostname.toLowerCase().replace(/^www\.|^m\./,'');
  const st=STORE_HOSTS.find(([re])=>re.test(host));
  const store=st?st[1]:'';
  const path=decodeURIComponent(u.pathname);
  let id='';
  if(store==='Amazon'){const m=path.match(/\/(?:dp|gp\/product|gp\/aw\/d|d)\/([A-Z0-9]{10})/i);if(m)id='amazon:'+m[1].toUpperCase();}
  else if(store==='Flipkart'){const pid=u.searchParams.get('pid');const itm=path.match(/\/p\/(itm[0-9a-z]+)/i);if(pid)id='flipkart:'+pid.toLowerCase();else if(itm)id='flipkart:'+itm[1].toLowerCase();}
  else if(store==='Myntra'){const m=path.match(/\/(\d{5,})(?:\/buy)?\/?$/);if(m)id='myntra:'+m[1];}
  else if(['AJIO','Croma','Meesho','Nykaa','Reliance Digital','Tata CLiQ','JioMart'].includes(store)){const m=path.match(/\/p\/([\w-]+)\/?$/i);if(m)id=store.toLowerCase().replace(/\s/g,'')+':'+m[1].toLowerCase();}
  const key=id||(host+path.replace(/\/+$/,'')).toLowerCase();
  /* V217: list / category / search pages (not one product) */
  const isList=!!store&&!id&&!/^(amzn\.(in|to)|link\.amazon|fktr\.in|dl\.flipkart\.com)$/.test(host)&&(/^\/(collection|collections|search|searchb|s|category|categories|brand|brands|b|offers?|deals?|shop|sale|cl)(\/|$)/i.test(path)||/\/(c|pr|cp|cl)\/?[\w-]*\/?$/i.test(path)&&!/\/p\//i.test(path));
  let pathForWords=store==='Myntra'?path.replace(/^\/[^/]+(?=\/[^/]+\/)/,'').replace(/\/\d+(\/buy)?\/?$/i,''):path;
  if(store==='JioMart'&&/^\/p\//i.test(path))pathForWords=path.replace(/^\/p\/[^/]+/i,'');
  if(isList){const sq=u.searchParams.get('k')||u.searchParams.get('q')||u.searchParams.get('text')||u.searchParams.get('query')||'';pathForWords=(path.replace(/^\/(collection|collections|search|searchb|s|category|categories|brand|brands|b|offers?|deals?|shop|sale|cl)(?=\/|$)/i,'').replace(/\/(c|pr|cp|cl)\/?[\w-]*\/?$/i,'')+' '+sq).replace(/[:]/g,' ');}
  /* name AFTER /product/ (Reliance Digital etc.): keep it; name BEFORE /dp/, /p/: cut the tail */
  let words=pathForWords.replace(/\/(dp|p|gp|buy)\/.*$/i,'').replace(/(.)\/product\/.*$/i,'$1').split(/[\/\-_+\s]+/).filter(w=>w.length>=1&&!/^\d{5,}$/.test(w)&&!/^(dp|itm\w+|ref|s|p|buy|product|html?)$/i.test(w));
  /* store codes at the end of the slug ("...-silver-mm8hqp-8930412") */
  if(store==='Reliance Digital'||store==='Tata CLiQ'||store==='JioMart')while(words.length>2&&/^(?=.*\d)(?=.*[a-z])[a-z0-9]{5,9}$/i.test(words[words.length-1])&&!/^\d+(gb|tb|mah|w|l|kg|ml|cm|inch|hz)$/i.test(words[words.length-1]))words.pop();
  if(store==='Tata CLiQ')words=words.filter(w=>!/^p$|^mp\d+$/i.test(w));
  words=words.slice(0,26);
  const isShort=!isList&&(/^(amzn\.(in|to)|link\.amazon|fktr\.in|dl\.flipkart\.com)$/.test(host)||(!id&&path.split('/').filter(Boolean).length<=2&&!words.length));
  return {url:u.href,host,store,key,id,words,isShort,isList,known:!!store};
}
function linkKeysForProduct(p){
  const keys=new Set();
  const add=v=>{const l=parseStoreLink(v);if(l){keys.add(l.key);keys.add((l.host+new URL(l.url).pathname.replace(/\/+$/,'')).toLowerCase());}};
  const st=bestPrice(p).state;
  (st.offers||[]).forEach(o=>{add(o.url);add(o.listingUrl);});
  ['amazonUrl','flipkartUrl','thirdUrl','fourthUrl'].forEach(k=>add(p.btn.dataset[k]||p.card.dataset[k]));
  return keys;
}
async function matchStoreLink(link){
  const idx=productIndex();
  for(const p of idx){const ks=linkKeysForProduct(p);if(ks.has(link.key)||ks.has((link.host+new URL(link.url).pathname.replace(/\/+$/,'')).toLowerCase()))return {p,exact:true};}
  const mapped=await PPData.resolveLink(link.key);
  if(mapped){const p=idx.find(x=>x.id===mapped);if(p)return {p,exact:true};}
  if(link.words.length>=2){
    const ws=link.words.map(w=>w.toLowerCase());
    let best=null,bestHits=0;
    for(const p of idx){const hay=`${p.name} ${p.brand}`.toLowerCase();const hits=ws.filter(w=>hay.includes(w)).length;if(hits>bestHits){best=p;bestHits=hits;}}
    if(best&&bestHits>=2&&bestHits>=Math.ceil(ws.length*.4))return {p:best,exact:false};
  }
  return null;
}
/* =====================================================================
   V212 — Link Engine: affiliate links + click counts
   - Links that are already affiliate (EarnKaro / short links / tag=) stay as they are
   - Plain amazon.in links get our Associates tag
   - Other stores: Cuelinks wrapper when switched ON in Admin and the store is ticked there (V222), else plain link
   - Only on the shopper's own click; never auto-redirects
   ===================================================================== */
const PP_AFF_DEFAULT={amazon_tag:'pricepulsein-21',cuelinks_enabled:false,cuelinks_cid:'',cuelinks_stores:['Tata CLiQ','Nykaa','Nykaa Fashion','Vijay Sales'],cuelinks_format:'https://linksredirect.com/?cid={cid}&source=linkkit&url={url}'};
let ppAff={...PP_AFF_DEFAULT};
PPData.settings=async function(){const r=await this.rpc('pp_public_settings');return r.error?null:(r.data||null);};
PPData.logClick=function(productId,store,source,affiliate){return this.rpc('pp_log_click',{click_product:productId||null,click_store:store||'Unknown',click_source:source||'site',click_affiliate:!!affiliate});};
const ppSettingsP=PPData.settings().then(s=>{if(s&&s.affiliate&&typeof s.affiliate==='object')ppAff={...PP_AFF_DEFAULT,...s.affiliate};return s;}).catch(()=>null); /* V278: cashback waits for these (share + Cuelinks stores) */
const AFF_SHORT_HOSTS=/(^|\.)(link\.amazon|amzn\.(to|in|eu)|fktr\.in|ekaro\.in|earnkaro\.com|linksredirect\.com|clnk\.in|bitli\.in|dl\.flipkart\.com)$/;
function storeOfHost(host){const st=STORE_HOSTS.find(([re])=>re.test(host));return st?st[1]:'';}
function ppAffiliateUrl(raw){
  let u;try{u=new URL(String(raw||''),location.href)}catch(_){return {url:raw,affiliate:false,store:''}}
  if(!/^https?:$/.test(u.protocol))return {url:raw,affiliate:false,store:''};
  const host=u.hostname.toLowerCase().replace(/^www\.|^m\./,'');
  const store=storeOfHost(host)||(/linksredirect|ekaro|earnkaro|clnk|bitli/.test(host)?'Affiliate':'');
  if(AFF_SHORT_HOSTS.test(host)||u.searchParams.has('affid')||u.searchParams.has('affExtParam1'))return {url:u.href,affiliate:true,store};
  if(/(^|\.)amazon\.in$/.test(host)){
    if(u.searchParams.get('tag'))return {url:u.href,affiliate:true,store:'Amazon'};
    if(ppAff.amazon_tag){u.searchParams.set('tag',ppAff.amazon_tag);return {url:u.href,affiliate:true,store:'Amazon'};}
    return {url:u.href,affiliate:false,store:'Amazon'};
  }
  if(store&&store!=='Amazon'&&ppAff.cuelinks_enabled&&ppAff.cuelinks_cid&&ppAff.cuelinks_format&&(!Array.isArray(ppAff.cuelinks_stores)||ppAff.cuelinks_stores.includes(store))){
    return {url:ppAff.cuelinks_format.replace('{cid}',encodeURIComponent(ppAff.cuelinks_cid)).replace('{url}',encodeURIComponent(u.href)),affiliate:true,store};
  }
  return {url:u.href,affiliate:false,store};
}
window.ppAffiliateUrl=ppAffiliateUrl;
function clickSource(a){
  if(a.closest('.ppx-link-panel'))return 'link_paste';
  const r=parseRoute();
  if(r&&r.name)return r.name;
  if(a.closest('#ppxHero,.hero'))return 'hero';
  return 'home';
}
function clickProductId(a){
  return a.dataset.productId||a.closest('[data-product-id]')?.dataset.productId||a.closest('.deal-card')?.querySelector('.heart')?.dataset.id||(parseRoute()?.name==='product'?parseRoute().param:'')||'';
}
/* V222.2: the store link is turned into the affiliate link before the shopper can
   copy it, open it in a new tab (right-click / long-press) or click it. The original
   link is kept in data-ppx-orig so the click log still names the real store. */
function outboundTarget(e){
  const a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return null;
  const raw=a.dataset.ppxOrig||a.href;
  let host='';try{host=new URL(raw).hostname.toLowerCase().replace(/^www\.|^m\./,'')}catch(_){return null}
  if(host===location.hostname||(!storeOfHost(host)&&!AFF_SHORT_HOSTS.test(host)))return null;
  return {a,raw,host};
}
function prepOutbound(e){
  const t=outboundTarget(e);if(!t)return null;
  const {a,raw}=t;
  if(!a.dataset.ppxOrig)a.dataset.ppxOrig=raw;
  const res=ppAffiliateUrl(raw);
  /* V278 (L5): Cuelinks links carry an anonymous click id as "subid" (never the user id) - the wallet matches orders by it later */
  if(res.affiliate&&/linksredirect\.com/.test(res.url||'')){if(!a.dataset.ppxRef)a.dataset.ppxRef=ppClickRef();try{const u=new URL(res.url);u.searchParams.set('subid',a.dataset.ppxRef);res.url=u.href;}catch(_){}}
  if(res.url&&a.getAttribute('href')!==res.url)a.href=res.url;
  if(!/sponsored/.test(a.rel))a.rel=(a.rel+' sponsored noopener').trim();
  return {...t,res};
}
['pointerdown','touchstart','contextmenu','focusin','dragstart'].forEach(ev=>document.addEventListener(ev,prepOutbound,{capture:true,passive:true}));
function onOutbound(e){
  if(e.type==='auxclick'&&e.button!==1)return;
  const t=prepOutbound(e);if(!t)return;
  const {a,host,res}=t;
  if(a.dataset.ppxLogged&&Date.now()-Number(a.dataset.ppxLogged)<1500)return;
  a.dataset.ppxLogged=String(Date.now());
  let pid=String(clickProductId(a)||'').toLowerCase();if(!/^[a-z0-9-]{1,80}$/.test(pid))pid='';
  PPData.logClick(pid,res.store||storeOfHost(host)||host,clickSource(a),res.affiliate);
  if(a.dataset.ppxRef){try{const r=supabaseClient.rpc('pp_log_click_ref',{p_ref:a.dataset.ppxRef,p_product:pid||null,p_store:res.store||storeOfHost(host)||host,p_source:clickSource(a)});r&&r.then&&r.then(()=>{},()=>{});}catch(_){}
    a.removeAttribute('data-ppx-ref');} /* the next click gets a new id */
}
function ppClickRef(){const b=new Uint8Array(10);try{crypto.getRandomValues(b);}catch(_){for(let i=0;i<10;i++)b[i]=Math.random()*256|0;}return 'pp'+[...b].map(x=>(x%36).toString(36)).join('')+Date.now().toString(36).slice(-4);}
document.addEventListener('click',onOutbound,true);
document.addEventListener('auxclick',onOutbound,true);
/* V223: honest button for store SEARCH links. While Admin has only a store search link
   (no exact product page yet), the button says "Search on <Store>" instead of "Buy". */
const PP_SEARCH_URL=/amazon\.[a-z.]+\/s\?|[?&](q|k|text|searchQuery|search_query)=|\/search(\/|\?|-listing|$)|\/searchB\?/i;
function ppRealStoreUrl(raw){
  try{const u=new URL(raw,location.href);if(/linksredirect\.com$/.test(u.hostname)&&u.searchParams.get('url'))return u.searchParams.get('url');return u.href;}catch(_){return String(raw||'')}
}
function ppIsSearchUrl(raw){const u=ppRealStoreUrl(raw);return !!u&&PP_SEARCH_URL.test(u);}
window.ppIsSearchUrl=ppIsSearchUrl;
const SEARCH_BTN_SEL='a.ppx-pc-buy,a.ppx-store-cta,.ppx-buybar a.ppx-btn,a.ppx-btn-primary[target="_blank"]';
function markSearchButtons(root){
  (root||document).querySelectorAll(SEARCH_BTN_SEL).forEach(a=>{
    if(a.dataset.ppxSearchChecked===a.getAttribute('href'))return;
    a.dataset.ppxSearchChecked=a.getAttribute('href')||'';
    const raw=a.dataset.ppxOrig||a.getAttribute('href')||'';
    if(!ppIsSearchUrl(raw)){a.classList.remove('is-search');return;}
    let host='';try{host=new URL(ppRealStoreUrl(raw)).hostname.toLowerCase().replace(/^www\.|^m\./,'')}catch(_){}
    const store=storeOfHost(host)||'store';
    a.classList.add('is-search');
    a.title='Exact product link not added yet. Opens the store search.';
    const ext=a.querySelector('svg')?.outerHTML||'';
    a.innerHTML=a.classList.contains('ppx-store-cta')?`Search on ${H(store)} ${ext}`:`Search on ${H(store)} <span aria-hidden="true">↗</span>`;
  });
}
let searchMarkT=0;
new MutationObserver(()=>{clearTimeout(searchMarkT);searchMarkT=setTimeout(()=>markSearchButtons(),120);}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>markSearchButtons(),300);
/* other-store search links for products we don't track yet */
const STORE_SEARCH=[['Amazon',q=>`https://www.amazon.in/s?k=${encodeURIComponent(q)}`],['Flipkart',q=>`https://www.flipkart.com/search?q=${encodeURIComponent(q)}`],['Croma',q=>`https://www.croma.com/searchB?q=${encodeURIComponent(q)}`],['Myntra',q=>`https://www.myntra.com/${encodeURIComponent(q.toLowerCase().replace(/\s+/g,'-'))}`],['AJIO',q=>`https://www.ajio.com/search/?text=${encodeURIComponent(q)}`],['Meesho',q=>`https://www.meesho.com/search?q=${encodeURIComponent(q)}`]];
function linkQuery(link){
  const stop=/^(buy|online|india|best|price|with|for|and|the|new|latest|offer|offers|sale|free|delivery)$/i;
  return link.words.map(w=>w.replace(/[^\p{L}\p{N}]/gu,'')).filter(w=>w.length>1&&!stop.test(w)&&!/^[A-Z0-9]{10}$/.test(w)).slice(0,6).join(' ').trim();
}
function otherStoresHTML(link){
  const q=linkQuery(link);
  if(q.split(' ').length<2)return '';
  const chips=STORE_SEARCH.filter(([s])=>s!==link.store).map(([s,fn])=>{const r=ppAffiliateUrl(fn(q));return `<a class="ppx-lp-chip" href="${H(r.url)}" target="_blank" rel="sponsored noopener noreferrer">${storeLogoFor(s)||`<b>${H(s)}</b>`}<span>Search ${H(s)}</span></a>`;}).join('');
  return `<div class="ppx-lp-other"><p class="ppx-lp-sub">Check it on other stores <small>· prices not verified yet</small></p><p class="ppx-lp-q">Searching for: <b>${H(q)}</b></p><div class="ppx-lp-chips">${chips}</div></div>`;
}
function openStoreHTML(link){
  if(!link.known)return '';
  const r=ppAffiliateUrl(link.url);
  return `<a class="ppx-btn ppx-btn-ghost ppx-lp-open" href="${H(r.url)}" target="_blank" rel="sponsored noopener noreferrer">Open on ${H(link.store)} ${ICON.ext}</a>`;
}

let linkPanel=null;
function closeLinkPanel(){linkPanel?.remove();linkPanel=null;}
const EXTRA_STORE_LOGOS={'Reliance Digital':'logos/reliance-digital-logo.png','Tata CLiQ':'logos/tatacliq-logo.png','JioMart':'logos/jiomart-logo.png'};
/* V277 (B2): script.js RETAILER_LOGOS knows only 6 stores, so store rows built by ppPopupRetailerRowLogo showed the NAME for
   Reliance Digital, Vijay Sales, Tata CLiQ, Nykaa... Add the logo files we already ship (script.js itself stays unchanged). */
try{if(typeof RETAILER_LOGOS==='object'&&RETAILER_LOGOS){Object.entries({'Reliance Digital':'reliance-digital-logo.png','Tata CLiQ':'tatacliq-logo.png','JioMart':'jiomart-logo.png','Vijay Sales':'stores/vijay-sales.svg','Nykaa':'stores/nykaa.svg','Nykaa Fashion':'stores/nykaa-fashion.svg','Purplle':'stores/purplle.svg','Shopsy':'stores/shopsy.svg','Adidas':'stores/adidas.svg'}).forEach(([k,v])=>{if(!RETAILER_LOGOS[k])RETAILER_LOGOS[k]=v;});}}catch(_){}
/* ---------- V278 (L1-L5): cashback - DISPLAY ONLY ("up to"). The real wallet / payouts are Step 4. ----------
   Rates come from the daily Cuelinks sync (Edge Function cuelinks-rates) + Admin's own rules (RPC pp_cashback_rates_public):
   store + category + BRAND (+ model rows) + cap per sale. There is NO store-wide rate: no matching rule = no cashback.
   Shopper share = settings "cashback".share (Admin; default 40%) of OUR commission, which is capped by the store's
   "User Max Earn" cap. Synced (Cuelinks) rules only count for stores whose links really go through Cuelinks (Admin > Links).
   Amazon: never (Associates rules). Base = the store's listed price, everywhere (product page, cards, Radar, stack).
   Templates only drop <span class="pp-cb pp-cb-<look>" ...>; cbFill() writes the text once rates + settings are in. */
let CB_SHARE=0.40,CB_MIN=5;
let cbRates=null,cbP=null;
const cbKey=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const cbBlocked=s=>/^amazon/.test(cbKey(s));
const cbNorm=s=>String(s||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
const cbRxC=new Map();
function cbRx(src){if(!src)return null;if(!cbRxC.has(src)){let r=null;try{r=new RegExp(src);}catch(_){r=/$^/;}cbRxC.set(src,r);}return cbRxC.get(src);}
function cbLinked(store){ /* our link for this store goes through Cuelinks (else Cuelinks pays nothing) */
  const a=ppAff||{};if(!a.cuelinks_enabled)return false;
  return !Array.isArray(a.cuelinks_stores)||a.cuelinks_stores.some(x=>cbKey(x)===cbKey(store));
}
function cbLoad(force){
  if(cbP&&!force)return cbP;
  cbP=(async()=>{try{
    if(typeof supabaseClient==='undefined'||!supabaseClient)return [];
    const [r,s]=await Promise.all([supabaseClient.rpc('pp_cashback_rates_public'),ppSettingsP.catch(()=>null)]);
    const c=s&&s.cashback;if(c){const sh=Number(c.share);if(sh>0&&sh<=0.9)CB_SHARE=sh;const mn=Number(c.min);if(mn>=1)CB_MIN=mn;}
    return r.error||!Array.isArray(r.data)?[]:r.data;
  }catch(_){return [];}})().then(l=>{
    /* a V277 database (before supabase-cashback-v278.sql) still sends store-wide rows: never use those */
    cbRates=l.filter(x=>x&&x.store&&!cbBlocked(x.store)&&!(String(x.category||'*')==='*'&&!x.brand_rx&&!x.name_rx)&&(Number(x.commission_pct)>=0));
    cbDecorate();cbFill(true);try{window.dispatchEvent(new Event('pp-cashback'));}catch(_){}return cbRates;});
  return cbP;
}
/* the rule for one product on one store: highest priority wins, a tie takes the smaller rate (never promise more) */
function cbRule(store,cat,prod){
  if(!cbRates||!store||cbBlocked(store))return null;
  const k=cbKey(store),c=String(cat||'').toLowerCase();
  const T=' '+cbNorm(prod&&prod.brand)+' '+cbNorm(prod&&prod.name)+' ';
  let best=null;
  for(const r of cbRates){
    if(cbKey(r.store)!==k)continue;
    if(r.source==='cuelinks'&&!cbLinked(r.store))continue;
    const rc=String(r.category||'*').toLowerCase();if(rc!=='*'&&rc!==c)continue;
    if(r.brand_rx&&!cbRx(r.brand_rx).test(T))continue;
    if(r.name_rx&&!cbRx(r.name_rx).test(T))continue;
    const pr=Number(r.priority)||0,bp=best?Number(best.priority)||0:-1;
    if(!best||pr>bp||(pr===bp&&(Number(r.flat_amount)||0)+Number(r.commission_pct)<(Number(best.flat_amount)||0)+Number(best.commission_pct)))best=r;
  }
  return best;
}
/* our commission on this sale (capped), then the shopper's share */
function cbAmount(store,price,cat,prod){
  const r=cbRule(store,cat,prod);if(!r||!Number.isFinite(price)||price<=0)return 0;
  let com=Number(r.flat_amount)>0?Number(r.flat_amount):price*Number(r.commission_pct)/100;
  if(Number(r.cap_amount)>0)com=Math.min(com,Number(r.cap_amount));
  const a=Math.floor(com*CB_SHARE);return a>=CB_MIN?a:0;
}
function cbHasAny(store,cat){
  if(!cbRates||!store||cbBlocked(store))return false;const k=cbKey(store),c=String(cat||'').toLowerCase();
  return cbRates.some(r=>cbKey(r.store)===k&&(r.source!=='cuelinks'||cbLinked(r.store))&&(Number(r.commission_pct)>0||Number(r.flat_amount)>0)&&(!c||String(r.category||'*')==='*'||String(r.category).toLowerCase()===c));
}
function cbSpan(store,price,cat,v,prod){
  const pid=prod&&typeof prod==='object'?prod.id:prod;
  return `<span class="pp-cb pp-cb-${v||'row'}" data-cb-s="${H(store||'')}" data-cb-p="${Number.isFinite(price)?price:''}" data-cb-c="${H(String(cat||'').toLowerCase())}"${pid?` data-cb-id="${H(pid)}"`:''}${prod&&typeof prod==='object'&&prod.name?` data-cb-n="${H(prod.name)}" data-cb-b="${H(prod.brand||'')}"`:''}></span>`;
}
/* one number, "up to" (the store confirms the final amount; we never promise more than our share) */
function cbUpTo(a){return a>=100?Math.floor(a/10)*10:a>=25?Math.floor(a/5)*5:a;}
const cbMoney=a=>'₹'+cbUpTo(a).toLocaleString('en-IN');
const CB_COIN='<i class="pp-cb-coin" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8.5 7.5h7M8.5 10.5h7M10 7.5c3 0 3.5 6-1 6l4.5 4"/></svg></i>';
function cbText(v,a){
  if(v==='chip')return '+ Cashback';
  if(v==='tag')return `${CB_COIN}<b>Earn up to ${cbMoney(a)}</b>`;
  if(v==='radar')return `+ up to ${cbMoney(a)} cashback`;
  return `${CB_COIN}<b>Earn up to ${cbMoney(a)} cashback</b>`;
}
/* which product a placeholder belongs to: its own data, the card / page around it, or the open product page */
function cbProdOf(e,idx){
  if(e.dataset.cbN)return {name:e.dataset.cbN,brand:e.dataset.cbB||''};
  let id=e.dataset.cbId||e.closest('[data-cb-id],[data-pc-id],[data-product-id],[data-wishlist-id],[data-alert-product]')?.dataset?.cbId;
  if(!id){const h=e.closest('[data-pc-id],[data-product-id],[data-wishlist-id]');id=h&&(h.dataset.pcId||h.dataset.productId||h.dataset.wishlistId);}
  if(!id){try{const r=parseRoute();if(r&&r.name==='product')id=r.param;}catch(_){}}
  if(id){const p=idx.get(String(id));let cp=null;try{cp=typeof ppCatalogProduct==='function'?ppCatalogProduct(id):null;}catch(_){}
    if(p||cp)return {name:(p&&p.name)||cp?.name||'',brand:(p&&p.brand)||cp?.brand||cp?.brand_name||String(cp?.brand_slug||'').replace(/-/g,' ')};}
  const h1=e.closest('.ppf-main,.ppf-card,.ppx-product')?.querySelector('h1');
  return {name:h1?h1.textContent.trim():'',brand:''};
}
function cbFill(reset){
  if(reset)document.querySelectorAll('.pp-cb[data-done]').forEach(e=>e.removeAttribute('data-done'));
  if(!cbRates)return;
  const todo=document.querySelectorAll('.pp-cb:not([data-done])');if(!todo.length)return;
  let idx=null;
  todo.forEach(e=>{
    e.dataset.done='1';const v=(e.className.match(/pp-cb-(\w+)/)||[])[1]||'row';
    let a=0;
    if(v==='chip')a=cbHasAny(e.dataset.cbS,e.dataset.cbC)?1:0;
    else{if(!idx){idx=new Map();try{productIndex().forEach(p=>idx.set(String(p.id),p));}catch(_){}}
      a=cbAmount(e.dataset.cbS,Number(e.dataset.cbP),e.dataset.cbC,cbProdOf(e,idx));}
    e.innerHTML=a?cbText(v,a):'';e.classList.toggle('is-on',!!a);
    if(a&&v!=='chip')e.setAttribute('title','Paid to your PricePulse wallet once the store confirms the order');
  });
}
/* Wishlist cards come from script.js (not changed): add the placeholder under their "Best verified price" box */
function cbDecorate(){
  if(!cbRates||!cbRates.length)return;
  document.querySelectorAll('.pp-wish-track-card[data-wishlist-id] .pp-wish-best-price:not([data-cb])').forEach(box=>{
    box.dataset.cb='1';
    try{const id=box.closest('[data-wishlist-id]').dataset.wishlistId;const p=productIndex().find(x=>String(x.id)===String(id));if(!p)return;
      const b=bestPrice(p);const st=b.state||{};const low=(st.inStock||[]).find(o=>o.price===b.price);if(!low||!Number.isFinite(b.price))return;
      box.insertAdjacentHTML('beforeend',cbSpan(low.name,b.price,p.category,'tag',p.id));}catch(_){}
  });
}
new MutationObserver(()=>{if(!cbRates)return;cbDecorate();if(document.querySelector('.pp-cb:not([data-done])'))cbFill();}).observe(document.documentElement,{childList:true,subtree:true});
window.ppCashback={load:cbLoad,rule:cbRule,amount:cbAmount,hasAny:cbHasAny,upTo:cbUpTo,money:cbMoney,span:cbSpan,fill:cbFill,get share(){return CB_SHARE;},blocked:cbBlocked,linked:cbLinked};
setTimeout(()=>cbLoad(),0);
function storeLogoFor(store){if(store&&EXTRA_STORE_LOGOS[store])return `<img src="${EXTRA_STORE_LOGOS[store]}" alt="${H(store)} logo" data-extra-store="${H(store)}">`;return store&&typeof retailerLogo==='function'?retailerLogo(store):'';}
function showLinkPanel(anchor,html){
  closeLinkPanel();
  linkPanel=document.createElement('div');
  linkPanel.className='ppx-link-panel';
  linkPanel.setAttribute('role','dialog');
  linkPanel.setAttribute('aria-label','Product link result');
  linkPanel.innerHTML=`<button type="button" class="ppx-lp-close" aria-label="Close" data-lp-close>×</button>${html}`;
  anchor.classList.add('ppx-suggest-host');
  anchor.appendChild(linkPanel);
  linkPanel.addEventListener('click',e=>{if(e.target.closest('[data-lp-close]')){closeLinkPanel();return;}if(e.target.closest('a[href^="#/"]'))setTimeout(closeLinkPanel,0);});
  linkPanel.tabIndex=-1;linkPanel.focus({preventScroll:true});
  requestAnimationFrame(()=>requestAnimationFrame(revealLinkPanel));
}
/* V217: show the whole popup after Enter; close it when the shopper scrolls away */
let lpProgScrollAt=0;
function stickyTop(){let b=0;document.querySelectorAll('.site-header,.nav-wrap').forEach(el=>{const cs=getComputedStyle(el);if(cs.position==='sticky'||cs.position==='fixed'){const r=el.getBoundingClientRect();if(r.top<=1)b=Math.max(b,r.bottom);}});return b;}
function panelInPage(){if(!linkPanel)return false;const a=linkPanel.parentElement;return !!a&&!a.closest('.site-header')&&getComputedStyle(linkPanel).position!=='fixed';}
function revealLinkPanel(){
  if(!panelInPage())return;
  const a=linkPanel.parentElement,top=stickyTop()+12,vh=window.innerHeight;
  const ar=a.getBoundingClientRect(),pr=linkPanel.getBoundingClientRect();
  let delta=0;
  if(pr.bottom>vh-16)delta=pr.bottom-(vh-16);
  if(ar.top-delta<top)delta=ar.top-top;
  if(Math.abs(delta)<4)return;
  lpProgScrollAt=Date.now();
  window.scrollBy({top:delta,behavior:'smooth'});
}
window.addEventListener('scroll',()=>{
  if(!panelInPage()||Date.now()-lpProgScrollAt<1200)return;
  const pr=linkPanel.getBoundingClientRect();
  if(pr.bottom<stickyTop()+40||pr.top>window.innerHeight-40)closeLinkPanel();
},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&linkPanel)closeLinkPanel();});
document.addEventListener('click',e=>{if(linkPanel&&!e.target.closest('.ppx-link-panel')&&!e.target.closest('form'))closeLinkPanel();});
/* =====================================================================
   V213 — Detected product card (customer confirms details) + "price I saw"
   Today: details are read from the link text and confirmed by the shopper.
   Later (API): the same card is filled automatically from the store API.
   ===================================================================== */
/* =====================================================================
   V215 — Two-step compare flow (link paste + name search)
   Step 1: verify details only (no store buttons) — store logos preview by category
   Step 2: all category stores together (pasted store = "Your link · exact product"),
           optional "price you saw" + "alert me below ₹X"
   Details are read from the link / search words today; API can fill them later.
   ===================================================================== */
const DET_BRANDS=['Apple','Samsung','OnePlus','Xiaomi','Redmi','Poco','Realme','Oppo','Vivo','iQOO','Motorola','Nothing','CMF','Google','Nokia','Lava','Infinix','Tecno','Honor','Asus','Micromax',
 'boAt','Noise','JBL','Sony','Boult','Mivi','pTron','Fire-Boltt','Fastrack','Titan','Amazfit','Bose','Sennheiser','Marshall','Skullcandy','Portronics','Ambrane','Anker','Kratos','Zebronics','Logitech','HP','Dell','Lenovo','Acer','MSI','Apple','Canon','Nikon','GoPro','Xbox','PlayStation','Mi','Syska','Wipro','Philips',
 'Havells','Bajaj','Prestige','Pigeon','Butterfly','Morphy Richards','Kent','Usha','Crompton','Orient','Agaro','Wonderchef','Milton','Cello','Borosil','Hawkins','Inalsa','Kenstar','Eureka Forbes','Aquaguard','Atomberg','Dyson','Karcher','Nutripro','NutriPro','Sujata','Preethi','Lifelong','iBELL',
 'LG','Whirlpool','Godrej','Haier','Voltas','Panasonic','Daikin','Blue Star','Lloyd','IFB','Bosch','Hisense','TCL','Onida','Vu','Acer TV',
 'Puma','Nike','Adidas','Reebok','Skechers','ASICS','New Balance','Campus','Bata','Red Tape','Woodland','Sparx','Crocs','Levis','Allen Solly','Peter England','Van Heusen','Louis Philippe','Roadster','HRX','U.S. Polo Assn.','US Polo','Jack & Jones','H&M','Zara','Biba','W','Libas','Highlander','Wrogn','Bewakoof','Snitch','Mokobara','Safari','American Tourister','Wildcraft','Fossil','Casio','Ray-Ban',
 'Lakme','Maybelline','L\'Oreal','Loreal','Mamaearth','Dot & Key','Minimalist','The Derma Co','Nivea','Plum','Cetaphil','CeraVe','Neutrogena','Himalaya','WOW','Biotique','Pond\'s','Ponds','Garnier','Dove','Lotus','Lotus Herbals','Re\'equil','Foxtale','Deconstruct','Simple','Bioderma','La Roche-Posay','The Ordinary','Kama Ayurveda','Forest Essentials','Sugar','Swiss Beauty','Nykaa','Pilgrim','mCaffeine','Beardo','Bombay Shaving Company','Park Avenue','Fogg','Engage','Wild Stone','Head & Shoulders','Pantene','TRESemme','Sunsilk','Parachute','Vaseline','Clinic Plus','Colgate','Sensodyne','Gillette','Philips Grooming','Maybelline New York','SanDisk','Kingston','Seagate','WD','Western Digital','Samsung EVO','Symphony','Wakefit','Sleepwell','MuscleBlaze','Optimum Nutrition','Spigen','Nykaa Cosmetics','Mivi','Lenskart','Titan Eye','Boult Audio','Noise','Hammer','Ptron','Redgear','Cosmic Byte','Ant Esports','Ubon'];
DET_BRANDS.push('Good Vibes','Aashirvaad','Reconnect','Fortune','Saffola','Amul','Britannia','Cadbury','Nestle','Dabur','Patanjali','SUGAR Cosmetics','Swiss Beauty','Kay Beauty','Pilgrim','Bombay Shaving Company','Beardo','Ustraa','Park Avenue','Wild Stone','Fogg','Bella Vita','Libas','W','Biba','Aurelia','FabIndia','Manyavar','Mokobara','American Tourister','Safari','VIP','Skybags','Wildcraft','Fossil','Casio','Timex','Sonata','Fire-Boltt','Hammer','Crossbeats','Lifelong','Solimo','Amazon Basics','AmazonBasics','Kodak','Thomson','Blaupunkt','Acer','Infinix','Kreo','Redgear','Cosmic Byte','EvoFox','Zebronics','Wipro','Syska','Philips','Orient','V-Guard','Luminous','Faber','Elica','Glen','Sunflame','Hindware','AO Smith','Racold','Livpure','Pureit');
const DET_BRANDS_SORTED=[...new Set(DET_BRANDS)].sort((a,b)=>b.length-a.length);
const DET_STORES={
  mobiles:['Amazon','Flipkart','Croma','Vijay Sales','Reliance Digital','Tata CLiQ'],
  electronics:['Amazon','Flipkart','Croma','Vijay Sales','Reliance Digital','Tata CLiQ'],
  laptops:['Amazon','Flipkart','Croma','Vijay Sales','Reliance Digital','Tata CLiQ'],
  appliances:['Amazon','Flipkart','Croma','Vijay Sales','Reliance Digital','Tata CLiQ'],
  home:['Amazon','Flipkart','Croma','Vijay Sales','Reliance Digital','JioMart','Meesho'],
  fashion:['Myntra','AJIO','Tata CLiQ','Nykaa Fashion','Amazon','Flipkart','Meesho'],
  beauty:['Nykaa','Purplle','Tata CLiQ','Amazon','Flipkart','Myntra'],
  other:['Amazon','Flipkart','JioMart','Meesho']};
const CAT_LABELS={electronics:'Electronics',mobiles:'Mobiles',laptops:'Laptops',appliances:'Appliances',home:'Home & Kitchen',fashion:'Fashion',beauty:'Beauty',other:'Other'};
STORE_SEARCH.push(
  ['Nykaa',q=>`https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}`],
  ['Purplle',q=>`https://www.purplle.com/search?q=${encodeURIComponent(q)}`],
  ['Reliance Digital',q=>`https://www.reliancedigital.in/search?q=${encodeURIComponent(q)}`],
  ['Tata CLiQ',q=>`https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(q)}`],
  ['JioMart',q=>`https://www.jiomart.com/search/${encodeURIComponent(q)}`],
  ['Vijay Sales',q=>`https://www.vijaysales.com/search-listing?q=${encodeURIComponent(q)}`],
  ['Nykaa Fashion',q=>`https://www.nykaafashion.com/catalogsearch/result/?q=${encodeURIComponent(q)}`]);
STORE_HOSTS.push([/(^|\.)purplle\.com$/,'Purplle']);
/* =====================================================================
   V216 — Product dictionary detection
   One table of product types (most specific first). Each type knows its
   category and which sizes matter. Works on link words and search text.
   ===================================================================== */
const PT=(re,kind,cat)=>({re,kind,cat});
const PRODUCT_TYPES=[
  /* accessories first so "phone cover" is not a phone */
  PT(/\b(back ?cover|phone ?cover|mobile ?cover|phone ?case|mobile ?case|flip ?cover)\b/i,'Phone Cover','electronics'),
  PT(/\b(tempered ?glass|screen ?guard|screen ?protector)\b/i,'Screen Guard','electronics'),
  PT(/\b(power ?bank|powerbank)\b/i,'Power Bank','electronics'),
  PT(/\b(charger|adapter|adaptor|charging brick)\b/i,'Charger','electronics'),
  PT(/\b(cable|data cable|charging cable)\b/i,'Cable','electronics'),
  PT(/\b(earbuds?|tws|true wireless|truly wireless|airpods|buds|airdopes)\b/i,'Earbuds','electronics'),
  PT(/\b(neckband)\b/i,'Neckband','electronics'),
  PT(/\b(headphones?|headset|over[- ]?ear|on[- ]?ear)\b/i,'Headphones','electronics'),
  PT(/\b(earphones?|in[- ]?ear)\b/i,'Earphones','electronics'),
  PT(/\b(soundbar|sound bar|home theat(er|re))\b/i,'Soundbar','electronics'),
  PT(/\b(party speaker|bluetooth speaker|speaker)\b/i,'Speaker','electronics'),
  PT(/\b(smart ?watch|smartwatch|fitness band|smart band|apple watch|galaxy watch|watch series|watch ultra|watch se|watch fit|watch gt)\b/i,'Smartwatch','electronics'),
  PT(/\b(tablet|ipad|galaxy tab|redmi pad|xiaomi pad|tab [a-z]?\d)\b/i,'Tablet','electronics'),
  PT(/\b(trolley|luggage|suitcase|cabin)\b/i,'Luggage','fashion'),
  PT(/\b(backpack|laptop bag|handbag|sling bag|tote|duffle|bag)\b/i,'Bag','fashion'),
  PT(/\b(laptop|notebook|macbook|chromebook|ultrabook|thinkpad|ideapad|vivobook|zenbook|inspiron|pavilion|aspire|victus|omen|legion|tuf gaming|rog)\b/i,'Laptop','laptops'),
  PT(/\b(monitor)\b/i,'Monitor','electronics'),
  PT(/\b(smart ?tv|led tv|qled|oled|uhd tv|4k tv|google tv|android tv|television|\btv\b|fire tv|webos)\b/i,'Smart TV','electronics'),
  PT(/\b(projector)\b/i,'Projector','electronics'),
  PT(/\b(printer)\b/i,'Printer','electronics'),
  PT(/\b(router|wifi|mesh)\b/i,'Router','electronics'),
  PT(/\b(pen ?drive|flash drive|usb drive|dual drive|otg drive|memory card|micro ?sd|sd card)\b/i,'Storage','electronics'),
  PT(/\b(ssd|hard ?disk|hdd|external drive)\b/i,'Hard Drive','electronics'),
  PT(/\b(mouse)\b/i,'Mouse','electronics'),
  PT(/\b(keyboard)\b/i,'Keyboard','electronics'),
  PT(/\b(dslr|mirrorless|action camera|digital camera|camera|gopro|eos|cyber-?shot|instax|point and shoot)\b/i,'Camera','electronics'),
  PT(/\b(gaming console|playstation|ps5|xbox|nintendo)\b/i,'Gaming Console','electronics'),
  PT(/\b(trimmer|shaver|epilator|hair dryer|hair straightener|straightener|curler)\b/i,'Grooming','beauty'),
  /* phones */
  PT(/\b(smartphone|mobile phone|5g phone|phone)\b/i,'Smartphone','mobiles'),
  /* appliances */
  PT(/\b(split ac|window ac|inverter ac|air conditioner|\bac\b)\b/i,'Air Conditioner','appliances'),
  PT(/\b(refrigerator|fridge|double door|single door|side by side)\b/i,'Refrigerator','appliances'),
  PT(/\b(washing machine|front ?load(ing)?|top ?load(ing)?|semi[- ]automatic|fully automatic washer|washer dryer)\b/i,'Washing Machine','appliances'),
  PT(/\b(microwave|otg|oven)\b/i,'Microwave / Oven','appliances'),
  PT(/\b(dishwasher)\b/i,'Dishwasher','appliances'),
  PT(/\b(chimney)\b/i,'Chimney','appliances'),
  PT(/\b(geyser|water heater|storage heater|instant heater|storage water)\b/i,'Water Heater','appliances'),
  PT(/\b(air cooler|desert cooler|cooler)\b/i,'Air Cooler','appliances'),
  PT(/\b(water purifier|ro purifier|ro\+uv|purifier)\b/i,'Water Purifier','home'),
  PT(/\b(air purifier)\b/i,'Air Purifier','home'),
  PT(/\b(vacuum|robot cleaner|wet and dry)\b/i,'Vacuum Cleaner','home'),
  /* kitchen */
  PT(/\b(air ?fryer)\b/i,'Air Fryer','home'),
  PT(/\b(mixer grinder|mixer|grinder|juicer|blender|food processor|hand blender|chopper)\b/i,'Mixer Grinder','home'),
  PT(/\b(electric kettle|kettle)\b/i,'Kettle','home'),
  PT(/\b(induction|cooktop|gas stove|hob)\b/i,'Cooktop','home'),
  PT(/\b(pressure cooker|cooker|rice cooker)\b/i,'Cooker','home'),
  PT(/\b(toaster|sandwich maker|grill)\b/i,'Toaster','home'),
  PT(/\b(steam iron|dry iron|\biron\b)\b/i,'Iron','home'),
  PT(/\b(ceiling fan|table fan|pedestal fan|exhaust fan|\bfan\b)\b/i,'Fan','home'),
  PT(/\b(room heater|heater)\b/i,'Heater','home'),
  PT(/\b(flask|water bottle|bottle|tumbler)\b/i,'Bottle / Flask','home'),
  PT(/\b(lunch ?box|tiffin|casserole|container|storage jar)\b/i,'Kitchen Storage','home'),
  PT(/\b(cookware|kadai|kadhai|tawa|fry ?pan|pan set|saucepan|non[- ]?stick)\b/i,'Cookware','home'),
  PT(/\b(dinner set|plates|mug|cup set)\b/i,'Dinnerware','home'),
  PT(/\b(mattress)\b/i,'Mattress','home'),
  PT(/\b(bedsheet|bed sheet|pillow|comforter|blanket|curtain|towel)\b/i,'Home Furnishing','home'),
  PT(/\b(led bulb|bulb|lamp|light)\b/i,'Lighting','home'),
  /* fashion */
  PT(/\b(running shoes|sports shoes|sneakers?|shoes?|loafers?|boots?)\b/i,'Shoes','fashion'),
  PT(/\b(sandals?|slippers?|flip ?flops?|slides|heels|floaters|clogs?)\b/i,'Footwear','fashion'),
  PT(/\b(t[- ]?shirts?|tshirts?|tees?|polo t[- ]?shirt)\b/i,'T-Shirt','fashion'),
  PT(/\b(shirts?)\b/i,'Shirt','fashion'),
  PT(/\b(kurta|kurti|saree|sari|lehenga|dupatta|salwar)\b/i,'Ethnic Wear','fashion'),
  PT(/\b(jeans|trousers|pants|track ?pants|joggers|shorts|chinos)\b/i,'Bottomwear','fashion'),
  PT(/\b(dress|top|jumpsuit|skirt)\b/i,'Dress / Top','fashion'),
  PT(/\b(jacket|hoodie|sweatshirt|sweater|blazer|coat)\b/i,'Winterwear','fashion'),
  PT(/\b(wallet|belt|sunglasses|cap)\b/i,'Accessory','fashion'),
  PT(/\b(analog watch|wrist ?watch|watch)\b/i,'Watch','fashion'),
  /* beauty & personal care */
  PT(/\b(sunscreen|sunblock|sun screen)\b/i,'Sunscreen','beauty'),
  PT(/\b(serum)\b/i,'Serum','beauty'),
  PT(/\b(face ?wash|facewash|cleanser|cleansing gel|foaming)\b/i,'Face Wash / Cleanser','beauty'),
  PT(/\b(moisturi[sz]er|moisturi[sz]ing cream|face cream|night cream|day cream|cream|lotion|body lotion|gel)\b/i,'Moisturiser / Cream','beauty'),
  PT(/\b(shampoo)\b/i,'Shampoo','beauty'),
  PT(/\b(conditioner|hair mask|hair serum|hair oil)\b/i,'Hair Care','beauty'),
  PT(/\b(lipstick|lip ?balm|lip ?gloss|kajal|eyeliner|mascara|foundation|concealer|compact|primer|blush|nail ?paint)\b/i,'Makeup','beauty'),
  PT(/\b(perfume|eau de|edp|edt|deodorant|deo|body spray|attar)\b/i,'Fragrance','beauty'),
  PT(/\b(toner|face mask|sheet mask|scrub|face pack|exfoliat\w*)\b/i,'Skincare','beauty'),
  PT(/\b(body wash|shower gel|soap)\b/i,'Bath & Body','beauty'),
  PT(/\b(toothpaste|toothbrush|mouthwash)\b/i,'Oral Care','beauty'),
  PT(/\b(razor|shaving)\b/i,'Shaving','beauty'),
  /* health / nutrition */
  PT(/\b(whey|protein powder|protein|creatine|multivitamin|supplement)\b/i,'Nutrition','other')
];
const PHONE_BRANDS=/^(Apple|Samsung|OnePlus|Xiaomi|Redmi|Poco|Realme|Oppo|Vivo|iQOO|Motorola|Nothing|CMF|Google|Nokia|Lava|Infinix|Tecno|Honor|Micromax)$/;
const PHONE_MODELS=/\b(iphone\s?\d{1,2}|galaxy\s?[saozmf]\d{1,3}|galaxy\s?z?\s?(fold|flip)|pixel\s?\d|redmi\s?(note\s?)?\d{1,2}|note\s?\d{1,2}|nord\s?(ce)?\s?\d|narzo\s?\d|reno\s?\d|find\s?x\d|moto\s?[ge]\d|edge\s?\d|poco\s?[xmfc]\d|iqoo\s?(z\d|neo\s?\d|\d{1,2})|phone\s?\(?\d|oneplus\s?\d{1,2})\b/i;
const TV_BRANDS=/^(Samsung|LG|Sony|Xiaomi|Redmi|OnePlus|TCL|Hisense|Vu|Acer|Panasonic|Toshiba|Onida|iFFALCON|Thomson|Kodak|Blaupunkt|Philips|Haier|Infinix|Realme|Motorola|Nokia)$/;
const TV_HINT=/\b(\d{2})\s?(inch|inches|")|\b(4k|uhd|ultra hd|full hd|fhd|hd ready|qled|oled|mini led|google tv|android tv|smart led|dolby vision|webos|tizen)\b/i;
const DET_COLORS=/\b(black|white|blue|red|green|grey|gray|silver|gold|golden|pink|purple|violet|yellow|orange|brown|beige|navy|mint|titanium|midnight|starlight|maroon|olive|teal|graphite|lavender|charcoal|ivory|khaki|rose gold|cream white)\b/i;
const DET_FILLER=/^(with|for|and|the|of|in|on|to|by|from|at|up|upto|buy|online|india|indias|india's|best|price|new|latest|offer|sale|free|delivery|pack|combo|original|official|segments?|segment|most|stable|slimmest|thinnest|lightest|processor|battery|display|amoled|fast|charging|type|usb|wall|edition|series|version|gen|generation|men|women|womens|mens|unisex|boys|girls|kids|casual|sports|formal|wireless|bluetooth|spf|pa|anc|enc|smart|all|skin|types|dry|oily|sensitive|normal|face|body|daily|use|gentle|ml|g|kg|l|pcs|piece|set|x|inch|inches|cm|hd|fhd|uhd|full|ready|ultra-hd|4k|8k|led|lcd|display|screen|star|rating|ton|litre|liter|ltr|watt|w|warranty|year|years|months|with|without|includes?|edition|black|white|model|capacity|hours|playtime|playback|upto|hrs|h|mah|gb|tb|ram|rom|storage|dual|sim|camera|mp|front|rear|nm|ghz|refresh|rate|hz|frameless|bezel-less|bezelless|android|google|ios|wifi|wi-fi|lte|volte|5g|4g|ip67|ip68|water|resistant|proof|waterproof|mic|bass|deep|powerful|premium|stylish|lightweight|portable|compact|durable|comfortable|soft|plus|neo|cancelling|canceling|noise|calling|matte|poreless|instant|personal|loading|new|york|cancellation|woven|design)$/i;
const DET_GENERIC_FIRST=/^(trendy|stylish|fancy|elegant|classy|attractive|beautiful|comfortable|casual|cotton|printed|solid|designer|party|ethnic|handmade|daily|everyday|best|new|latest|buy|original|men|women|mens|womens|kids|unisex|premium|smart|wireless|bluetooth|portable|mini|pro|super|ultra|combo|pack|set|the|a|an|gaming|stainless|steel|electric|automatic|digital|\d.*)$/i;
const MODEL_KEEP=/^(pro|max|plus|ultra|lite|neo|mini|air|fe|prime|turbo|power|edge|fold|flip|note|nord|ce|5g)$/i;
function cap(w){return w?w.replace(/^./,c=>c.toUpperCase()):w;}
function sizeParts(text,type){
  const out=[];const t=text;
  const ramRom=t.match(/\b(\d{1,2})\s?gb(?:\s?ram)?\s?[+/ ]?\s?(\d{2,4})\s?(gb|tb)\b/i);
  if(ramRom)out.push(`${ramRom[1]}GB+${ramRom[2]}${ramRom[3].toUpperCase()}`);
  else{const st=t.match(/\b(\d{2,4})\s?(gb|tb)\b/i);if(st&&type&&/Smartphone|Tablet|Laptop|Storage|Hard Drive/.test(type))out.push(st[1]+st[2].toUpperCase());}
  const inch=t.match(/\b(\d{2,3}(?:\.\d)?)\s?(?:inch|inches|")/i)||t.match(/\b(\d{2,3})\s?cm\b/i)&&null;
  if(inch)out.push(inch[1]+' inch');
  else if(type==='Smart TV'||type==='Monitor'){const cm=t.match(/\b(\d{2,3})\s?cm\b/i);const code=t.match(/\b[a-z]{0,3}(\d{2})[a-z]{1,4}\w*\b/i);
    if(cm&&+cm[1]>=50&&+cm[1]<=260)out.push(Math.round(+cm[1]/2.54)+' inch');else if(code&&+code[1]>=24&&+code[1]<=100)out.push(code[1]+' inch');}
  const ton=t.match(/\b(\d)\s(5)\s?ton\b/i)||t.match(/\b(\d(?:\.\d)?)\s?ton\b/i);if(ton)out.push((ton[2]?ton[1]+'.'+ton[2]:ton[1])+' Ton');
  const star=t.match(/\b(\d)\s?star\b/i);if(star&&/Air Conditioner|Refrigerator|Washing Machine|Water Heater/.test(type||''))out.push(star[1]+' Star');
  const lit=t.match(/\b(\d+(?:\.\d+)?)\s?(l|ltr|litre|liter|litres|liters)\b/i);if(lit)out.push(lit[1]+'L');
  const kg=t.match(/\b(\d+(?:\.\d+)?)\s?kg\b/i);if(kg)out.push(kg[1]+' kg');
  const ml=t.match(/\b(\d+(?:\.\d+)?)\s?ml\b/i);if(ml)out.push(ml[1]+'ml');
  const g=t.match(/\b(\d+(?:\.\d+)?)\s?(g|gm|gms|grams?)\b/i);if(g&&!kg)out.push(g[1]+'g');
  const w=t.match(/\b(\d{2,4})\s?(w|watt|watts)\b/i);if(w)out.push(w[1]+'W');
  const mah=t.match(/\b(\d{3,5})\s?mah\b/i);if(mah&&/Power Bank|Smartphone/.test(type||''))out.push(mah[1]+'mAh');
  const uk=t.match(/\b(?:uk|ind|india)\s?-?\s?(\d{1,2})\b/i);if(uk)out.push('UK '+uk[1]);
  const apparel=t.match(/\b(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl)\b(?=\s|$)/);if(apparel&&/T-Shirt|Shirt|Bottomwear|Ethnic Wear|Dress|Winterwear/.test(type||''))out.push('Size '+apparel[1].toUpperCase());
  const mm=t.match(/\b(\d{3,4})\s?mm\b/i);if(mm&&/Fan/.test(type||''))out.push(mm[1]+'mm');
  const pack=t.match(/\bpack of (\d{1,2})\b/i);if(pack)out.push('Pack of '+pack[1]);
  return [...new Set(out)];
}
function detectProduct(link){
  const empty={brand:'',model:'',kind:'',variant:'',color:'',category:'other',categoryLabel:'Other',empty:true};
  if(link.isShort)return empty;
  let raw=link.words.map(w=>w.replace(/[^\p{L}\p{N}.&+'\-/"]/gu,'').replace(/^[-/]+|[-/]+$/g,'')).filter(Boolean);
  /* list pages use plurals ("laptops", "mobiles", "watches") */
  if(link.isList)raw=raw.map(w=>/^(mobiles|phones|smartphones)$/i.test(w)?'smartphone':/^[a-z]{4,}(ches|shes|xes)$/i.test(w)?w.slice(0,-2):/^[a-z]{4,}[^su]s$/i.test(w)&&!/^(earbuds|headphones|earphones|airpods|buds|glasses|jeans|shorts|trousers|sunglasses|pants)$/i.test(w)?w.slice(0,-1):w);
  if(!raw.length)return empty;
  const text=raw.join(' ');
  const low=' '+text.toLowerCase()+' ';
  /* brand */
  let brand='',brandGuessed=false,brandAt=1e9;
  for(const b of DET_BRANDS_SORTED){const esc=b.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s*&\s*/,'\\s*(?:&|and)?\\s*').replace(/'/g,"'?").replace(/-/g,'[\\s-]?').replace(/ /g,'[\\s-]?');const m=new RegExp(`(^|\\s)${esc}(?=\\s|$)`,'i').exec(low);if(m&&m.index<brandAt){brand=b;brandAt=m.index;}}
  if(brand==='Mi')brand='Xiaomi';
  if(brand==='NutriPro')brand='Nutripro';
  if(!brand&&/\b(iphone|ipad|macbook|airpods|imac|apple watch)\b/i.test(text))brand='Apple';
  /* accessory maker named first ("Spigen ... Samsung Galaxy cover"): use the first word */
  {const first=raw.find(w=>/^[\p{L}]/u.test(w)&&w.length>2);const fl=(first||'').toLowerCase();
   if(first&&brand&&brandAt>0&&!DET_BRANDS_SORTED.some(b=>b.toLowerCase()===fl)&&!DET_GENERIC_FIRST.test(first)&&!DET_FILLER.test(first)&&/\b(cover|case|glass|guard|protector|compatible|for|strap|charger|cable|skin|stand|holder|mount)\b/i.test(text)){brand=cap(first);brandGuessed=true;}}
  /* product type: most specific match in the table */
  let type=null;
  for(const t of PRODUCT_TYPES){if(t.re.test(text)){type=t;break;}}
  /* store slugs often cut words ("Washing" without "Machine", "Fryer" without "Air") */
  if(!type){
    const AC_BRANDS=/^(Daikin|Voltas|Blue Star|Lloyd|Carrier|Hitachi|LG|Samsung|Panasonic|Godrej|Haier|Whirlpool|Mitsubishi|Onida|Cruise|Sansui)$/;
    const CUES=[
      [/\b(cover|case)\b/i,'Phone Cover','electronics',()=>/\b(galaxy|iphone|redmi|samsung|oneplus|nord|vivo|oppo|realme|poco|iqoo|pixel|moto|mobile|phone)\b/i.test(text)],
      [/\bwashing\b|\b(fully|semi)[ -]?automatic\b|\bloading\b/i,'Washing Machine','appliances'],
      [/\b(pedestal|table fan|wall fan|tower fan|bldc)\b/i,'Fan','home'],
      [/\b(frost|double ?door|single ?door|convertible)\b/i,'Refrigerator','appliances'],
      [/\b(split|window)\b/i,'Air Conditioner','appliances',()=>AC_BRANDS.test(brand)||/\bton\b/i.test(text)],
      [/\binverter\b/i,'Air Conditioner','appliances',()=>AC_BRANDS.test(brand)&&/\b(copper|ton|cooling|star)\b/i.test(text)],
      [/\bfryer\b/i,'Air Fryer','home'],
      [/\bceiling\b|\b\d{3,4}\s?mm\b/i,'Fan','home'],
      [/\bwash\b/i,'Face Wash / Cleanser','beauty'],
      [/\b(airdopes|nirvana|enco|galaxy buds|redmi buds|nord buds|truly wireless)\b/i,'Earbuds','electronics'],
      [/\b(rockerz|bassheads)\b/i,'Headphones','electronics'],
      [/\b(colorfit|colourfit|fire-?boltt|amazfit|watch fit|galaxy watch)\b/i,'Smartwatch','electronics'],
      [/\b(inches|inch|crystal|bravia|ultra hd|uhd|4k|qled|oled)\b/i,'Smart TV','electronics',()=>TV_BRANDS.test(brand)]
    ];
    for(const [re,kind,cat,ok] of CUES){if(re.test(text)&&(!ok||ok())){type={kind,cat};break;}}
  }
  /* phone heuristics */
  const isAccessory=type&&/electronics/.test(type.cat)&&/Cover|Screen Guard|Charger|Cable|Earbuds|Smartwatch|Tablet|Power Bank|Neckband|Headphones|Earphones/.test(type.kind);
  const phoneToken=raw.some(w=>/^[a-z]{0,2}\d{1,3}[a-z]{0,3}$/i.test(w)&&!/^\d+$/.test(w)||/^\d{2}[a-z]{1,2}$/i.test(w));
  if(!isAccessory&&PHONE_BRANDS.test(brand)&&(!type||type.cat==='other')&&(phoneToken||(brand==='Google'&&/\bpixel\b/i.test(text)))&&!/\b(buds|watch|tab|tablet|pad|band|tv|inch|laptop|book|charger|cable|cover|case|speaker|ac|fridge)\b/i.test(text))type={kind:'Smartphone',cat:'mobiles'};
  if(!isAccessory&&PHONE_BRANDS.test(brand)&&(PHONE_MODELS.test(text)||/\b\d{1,2}\s?gb\b.*\b\d{2,4}\s?(gb|tb)\b/i.test(text)||(brand==='Samsung'&&/\bgalaxy\b/i.test(text)&&!/\b(buds|watch|tab|book)\b/i.test(text))||/\biphone\b/i.test(text)||(/^(Redmi|Poco|Realme|iQOO|Vivo|Oppo|OnePlus|Motorola|Nothing|Infinix|Tecno|Lava|Honor)$/.test(brand)&&/\b(storage|ram|5g|dual sim|note|pro|plus|ultra)\b/i.test(text)))&&(!type||type.kind==='Smartphone'||type.cat==='other')){type={kind:'Smartphone',cat:'mobiles'};}
  /* TV heuristics: "inch / 4K / QLED / Google TV" with a TV brand */
  if((!type||type.kind==='Smartphone'&&!PHONE_MODELS.test(text))&&TV_HINT.test(text)&&(TV_BRANDS.test(brand)||/\b(tv|television)\b/i.test(text))&&!/\b(monitor|laptop|tablet|phone)\b/i.test(text))type={kind:'Smart TV',cat:'electronics'};
  if(!type&&TV_BRANDS.test(brand)&&/\binch\b/i.test(text))type={kind:'Smart TV',cat:'electronics'};
  if(!type&&/\b(1|1\.5|1 5|2)\s?ton\b/i.test(text))type={kind:'Air Conditioner',cat:'appliances'};
  let kind=type?type.kind:'';
  /* group types: show the exact item ("Lipstick", "Sneakers", "Jeans"); slugs put the item word last */
  if(type&&type.re&&/^(Makeup|Skincare|Shoes|Bottomwear)$/.test(kind)){const ms=[...text.matchAll(new RegExp(type.re.source,'gi'))];const last=ms.length?ms[ms.length-1][0]:'';if(last&&!/^(compact|primer|pants|shorts|boots?|shoes?)$/i.test(last)||/^(running shoes|sports shoes)$/i.test(last))kind=last.replace(/\b\w/g,c=>c.toUpperCase());}
  const cat=type?type.cat:'other';
  /* unknown brand: first meaningful word */
  if(!brand){const first=raw.find(w=>!/^\d/.test(w)&&w.length>2);if(first&&!DET_GENERIC_FIRST.test(first)&&!DET_FILLER.test(first)&&!PRODUCT_TYPES.some(t=>t.re.test(first))&&!DET_COLORS.test(first)){brand=cap(first);brandGuessed=true;}}
  const variant=sizeParts(text,kind).join(' · ');
  const color=cap((text.match(DET_COLORS)||[''])[0]);
  /* model: brand-series words + model codes, without type words, sizes, colours, marketing words */
  const brandWords=new Set((brand||'').toLowerCase().split(/[\s-]+/).concat(['mi','xiaomi']));
  const SERIES_KEEP=/^(ideapad|thinkpad|inspiron|vivobook|zenbook|macbook|chromebook|pavilion|aspire|victus|omen|legion|rog|tuf|galaxy|ipad|airpods|bravia|crystal|airdopes|rockerz|colorfit|nirvana|series|ultra|tab|buds|eos)$/i;
  const typeWords=new Set((kind+' '+(type&&type.re?String(text.match(type.re)?.[0]||''):'')).toLowerCase().split(/[\s/]+/).filter(w=>!SERIES_KEEP.test(w)));
  const unitIdx=new Set();
  raw.forEach((w,i)=>{if(/^\d+(\.\d+)?$/.test(w)&&/^(gb|tb|w|watt|watts|mah|ml|l|ltr|litre|liter|g|gm|gms|kg|inch|inches|cm|ton|star|hz|mp|hours|hrs|h|months|years?|pcs|mm)$/i.test(raw[i+1]||''))unitIdx.add(i);if(/^(spf|pack|uk|of|size)$/i.test(w))unitIdx.add(i+1);});
  const keep=[];
  raw.forEach((w,i)=>{
    const l=w.toLowerCase();
    if(unitIdx.has(i)||brandWords.has(l)||typeWords.has(l))return;
    if(DET_COLORS.test(l))return;
    if(/^\d+(\.\d+)?(gb|tb|w|mah|ml|l|g|gm|kg|ltr|inch|hz|mp|ton|mm)$/i.test(l))return;
    if(/^spf\d+$/i.test(l)||/^[A-Z0-9]{10}$/.test(w)&&/\d/.test(w)&&/[A-Z]/.test(w)&&link.store==='Amazon')return;
    if(MODEL_KEEP.test(l)&&keep.length){keep.push(w);return;}
    if(SERIES_KEEP.test(l)){keep.push(w);return;}
    if(DET_FILLER.test(l))return;
    if(!SERIES_KEEP.test(l)&&PRODUCT_TYPES.some(t=>t.re.test(l)))return;
    if(/^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl)$/i.test(l))return;
    if(l==='fit'&&cat==='beauty'){keep.push(w);return;}
    if(/^(uk|trendy|stylish|fancy|elegant|classy|attractive|beautiful|aluminium|aluminum|stainless|compartment|portable|digital|calling|onyx|awesome|iceblue|pastel|lens|kit|\d+-\d+mm|inverter|split|copper|frost|fully|automatic|semi|front|load|top|technology|remote|ceiling|cordless|storage|phantom|hybrid|slim|fit|regular|printed|solid|analog|dial|cabin|polycarbonate|hard|sided|glow|turbo|chip|wi-fi|wifi)$/i.test(l))return;
    if(/^\d+$/.test(l)&&!keep.length&&l.length<3)return;
    keep.push(w);
  });
  for(let i=keep.length-1;i>0;i--){if(keep.slice(0,i).some(k=>k.toLowerCase()===keep[i].toLowerCase()))keep.splice(i,1);}
  for(let i=0;i<keep.length-1;i++){if(/^\d$/.test(keep[i])&&keep[i+1]==='0'){keep.splice(i,2,keep[i]+'.0');}}
  for(let i=0;i<keep.length-1;i++){if(/^[A-Z]{2,3}$/.test(keep[i])&&/\d/.test(keep[i+1])&&/^[A-Z0-9]+$/i.test(keep[i+1])){keep.splice(i,2,keep[i]+'-'+keep[i+1]);}}
  const model=keep.slice(0,cat==='mobiles'||kind==='Smart TV'?3:4).join(' ');
  if(link.isList)return {brand:brandGuessed?'':brand,brandGuessed:false,model:'',kind,variant:'',color:'',category:cat,categoryLabel:CAT_LABELS[cat]||'Other',empty:false,isList:true};
  return {brand,brandGuessed,model,kind,variant,color,category:cat,categoryLabel:CAT_LABELS[cat]||'Other',empty:false};
}
window.ppDetectProduct=detectProduct;window.ppParseStoreLink=parseStoreLink;
/* V251: helpers for the Find best price page (compare-v251.js) */
window.ppLinkKit={parseStoreLink,detectProduct,matchStoreLink,productIndex,productData,bestPrice,photoOf,storeLogoFor,storesForCat,detQuery,canSearchStores,STORE_SEARCH,catLabel,crumbs,ICON,M,H,
  dealAnalysis,dealInsightHTML:(...a)=>dealInsightHTML(...a),requestTrack:(...a)=>PPData.requestTrack(...a),
  lowestSeries,trackFollowup:(...a)=>PPData.trackFollowup(...a)};
const CAT_QUERY_WORD={mobiles:'smartphone',laptops:'laptop'};
function detQuery(d){return [d.brand,d.model,d.kind||(!d.model&&CAT_QUERY_WORD[d.category])||'',d.variant,d.category==='fashion'?d.color:''].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();}
/* V217: other stores need brand/model + model/type/category word; brand alone mixes printers, laptops, ink… */
function canSearchStores(d){return !!((d.brand||d.model)&&(d.model||d.kind||CAT_QUERY_WORD[d.category])&&detQuery(d).split(' ').length>=2);}
function storeBadge(s){const logo=storeLogoFor(s);return logo&&!/pp-retailer-name/.test(logo)?logo:`<b class="ppx-st-name">${H(s)}</b>`;}
function tileLogo(s){const logo=storeLogoFor(s);if(logo&&!/pp-retailer-name/.test(logo))return logo;const ini=s.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();return `<b class="ppx-st-ini">${H(ini)}</b>`;}
function storesForCat(cat){return DET_STORES[cat]||DET_STORES.other;}
function previewStoresHTML(cat,link){
  const list=storesForCat(cat);
  const all=link&&link.known&&!link.isText&&!list.includes(link.store)?[link.store,...list]:list;
  return `<span class="ppx-flow-preview-l">We'll compare on</span>${all.map(s=>`<span class="ppx-flow-logo">${storeBadge(s)}</span>`).join('')}`;
}
function flowStepsHTML(n){return `<ol class="ppx-flow-steps" aria-label="Steps"><li class="${n===1?'is-on':'is-done'}"><i>${n>1?'✓':'1'}</i>Verify product</li><li class="${n===2?'is-on':''}"><i>2</i>Compare stores</li></ol>`;}
function detCardHTML(d,link,opts={}){
  const opt=Object.entries(CAT_LABELS).map(([k,v])=>`<option value="${k}" ${k===d.category?'selected':''}>${v}</option>`).join('');
  const f=(name,label,val,ph,hint)=>`<label class="ppx-det-f"><span>${label}${hint?` <small class="ppx-det-guess">${hint}</small>`:''}</span><input name="${name}" value="${H(val)}" placeholder="${H(ph)}" autocomplete="off"></label>`;
  const title=opts.title===''?'':opts.title||(d.isList?'This is a product list page':d.empty?'Tell us which product this is':'Is this the product you want?');
  const sub=opts.sub||(d.isList?'This link opens a list of products, not one product. Paste the product page link for an exact match, or add brand and model here.':d.empty?'This link doesn\'t show the product name. Add brand and model.':'Read from your link. Fix anything that\'s wrong.');
  return `<form class="ppx-det" data-det-form novalidate>
    ${flowStepsHTML(1)}
    ${title?`<p class="ppx-det-title">${H(title)} <small>${H(sub)}</small></p>`:''}
    <div class="ppx-det-grid">
      ${f('brand','Brand',d.brand,'e.g. Samsung',d.brandGuessed?'guessed':'')}
      ${f('model','Model / name',d.model,'e.g. Galaxy S25')}
      ${f('kind','Product type',d.kind,'e.g. Smartphone, Cream')}
      ${f('variant','Variant / size',d.variant,'e.g. 8GB+256GB, 100ml, UK 9')}
      ${f('color','Colour',d.color,'Optional')}
      <label class="ppx-det-f ppx-det-cat"><span>Category</span><select name="category">${opt}</select></label>
    </div>
    <div class="ppx-flow-preview" data-flow-preview>${previewStoresHTML(d.category,link)}</div>
    <div class="ppx-lp-actions"><button type="submit" class="ppx-btn ppx-btn-primary">${ICON.tick}${H(opts.cta||'Yes, this is it')} →</button></div>
  </form>`;
}
function readDet(form){
  const g=n=>String(form.elements[n]?.value||'').trim().slice(0,80);
  const cat=g('category')||'other';
  return {brand:g('brand'),model:g('model'),kind:g('kind'),variant:g('variant'),color:g('color'),category:cat,categoryLabel:CAT_LABELS[cat]||'Other',price:null};
}
PPData.requestTrackDetails=async function(link,d){
  const details={brand:d.brand,model:d.model,variant:[d.kind,d.variant].filter(Boolean).join(' · '),color:d.color,category:d.categoryLabel,query:detQuery(d),confirmed:'yes'};
  const r=await this.rpc('pp_request_track_details',{req_url:link.url,req_key:link.key,req_store:link.store||null,req_details:details,req_price:null});
  if(!r.error)return {ok:true,data:r.data};
  return this.requestTrack(link.url,link.key,link.store);
};
PPData.trackFollowup=async function(key,price,target){
  const r=await this.rpc('pp_track_followup',{req_key:key,req_price:price,req_target:target});
  return r.error?{ok:false,error:r.error}:{ok:true,data:r.data};
};
function compareStoresHTML(d,link){
  const q=detQuery(d);
  const own=link.known&&!link.isText?`<a class="ppx-flow-store is-own" href="${H(ppAffiliateUrl(link.url).url)}" target="_blank" rel="sponsored noopener noreferrer"><span class="ppx-flow-store-logo">${tileLogo(link.store)}</span><span class="ppx-flow-store-copy"><b>${H(link.store)}</b><small>Your link · exact product</small></span><i aria-hidden="true">${ICON.ext}</i></a>`:'';
  const ok=canSearchStores(d);
  const others=!ok?[]:storesForCat(d.category).filter(s=>s!==link.store).map(s=>{const fn=STORE_SEARCH.find(([n])=>n===s)?.[1];if(!fn)return '';const r=ppAffiliateUrl(fn(q));return `<a class="ppx-flow-store" href="${H(r.url)}" target="_blank" rel="sponsored noopener noreferrer"><span class="ppx-flow-store-logo">${tileLogo(s)}</span><span class="ppx-flow-store-copy"><b>${H(s)}</b><small>Best match search</small></span><i aria-hidden="true">${ICON.ext}</i></a>`;});
  return `<div class="ppx-flow-stores-head"><b>Compare on ${H(d.categoryLabel==='Other'?'':d.categoryLabel+' ')}stores</b><small>${!ok?(d.brand&&!d.model?'Add the model or product type to search other stores. Brand alone gives mixed results.':'Add brand and model to search other stores.'):`Searching for: ${H(q)} · search results, prices not verified yet`}</small></div><div class="ppx-flow-stores">${own}${others.join('')}</div>`;
}
function followupHTML(link){
  const signed=typeof currentUser!=='undefined'&&!!currentUser;
  const priceF='';/* V217: "price you saw" removed */
  const alertF=signed?`<label class="ppx-det-f"><span>Alert me when it's below <small>(optional)</small></span><span class="ppx-det-rupee"><b>₹</b><input name="target" inputmode="numeric" placeholder="e.g. 799" autocomplete="off"></span></label>`:`<div class="ppx-flow-signin">${ICON.bell}<span><b>Want an alert?</b> Sign in and we'll tell you when verified prices are added.</span><button type="button" class="ppx-lp-alt" data-flow-signin>Sign in</button></div>`;
  return `<form class="ppx-flow-follow" data-flow-follow novalidate><div class="ppx-flow-follow-grid">${priceF}${alertF}</div>${priceF||signed?'<button type="submit" class="ppx-btn ppx-btn-ghost ppx-flow-save">Save</button>':''}<p class="ppx-flow-follow-msg" role="status"></p></form>`;
}
function bindFollowup(root,link){
  root.querySelector('[data-flow-signin]')?.addEventListener('click',()=>document.getElementById('signInBtn')?.click());
  const ff=root.querySelector('[data-flow-follow]');if(!ff)return;
  ff.addEventListener('submit',async e=>{
    e.preventDefault();
    const num=n=>{const v=Number(String(ff.elements[n]?.value||'').replace(/[^\d.]/g,''));return Number.isFinite(v)&&v>0&&v<1e7?Math.round(v):null;};
    const price=num('price'),target=num('target');
    const msg=ff.querySelector('.ppx-flow-follow-msg');
    if(!price&&!target){msg.textContent='Enter the price you want to be alerted at.';return;}
    const btn=ff.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.textContent='Saving…';}
    const r=await PPData.trackFollowup(link.key,price,target);
    if(btn){btn.disabled=false;btn.textContent='Save';}
    msg.textContent=r.ok?[price?`Thanks. ${M(price)} noted (not verified yet).`:'',target?`We'll alert you when it's below ${M(target)} once prices are added.`:''].filter(Boolean).join(' '):'Could not save right now. Please try again.';
  });
}
function step2HTML(det,link,r,head){
  const summary=[det.brand,det.model,det.kind,det.variant,det.color].filter(Boolean).join(' · ');
  const n=r.ok&&r.data?.count>1?` <b>${r.data.count} shoppers</b> have asked for it.`:'';
  return `${head||''}<div class="ppx-flow2">${flowStepsHTML(2)}
    <div class="ppx-lp-done">${ICON.tick}<div><p class="ppx-lp-title">Got it, we're on it</p><p class="ppx-lp-note">${summary?`<b>${H(summary)}</b><br>`:''}${r.ok?'We will check it on every store and add verified prices soon.':'Saved on this device. We will send it as soon as you are back online.'}${n}</p></div></div>
    ${compareStoresHTML(det,link)}
    ${followupHTML(link)}
    <div class="ppx-lp-actions"><button type="button" class="ppx-lp-alt" data-det-edit>Edit details</button></div></div>`;
}
/* one flow, two places (link panel / search results) */
const detDrafts=new Map();
function runCompareFlow(render,link,opts){
  const d=opts.detected||detDrafts.get(link.key)||detectProduct(link);
  render(`${opts.head||''}${opts.title!==undefined?'':'<p class="ppx-lp-title">We don\'t track this product yet</p>'}${detCardHTML(d,link,opts)}`);
  const root=opts.root();
  const form=root.querySelector('[data-det-form]');
  const catHint=()=>{const v=readDet(form);form.querySelector('.ppx-det-cat')?.classList.toggle('is-hint',!!v.brand&&!v.model&&!v.kind&&v.category==='other');};
  form.elements.category.addEventListener('change',()=>{form.querySelector('[data-flow-preview]').innerHTML=previewStoresHTML(form.elements.category.value,link);});
  form.addEventListener('input',()=>{detDrafts.set(link.key,{...readDet(form),isList:d.isList});catHint();});
  form.addEventListener('change',()=>{detDrafts.set(link.key,{...readDet(form),isList:d.isList});catHint();});
  catHint();
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const det=readDet(form);
    if(![det.brand,det.model,det.kind].filter(Boolean).length){form.querySelector('input[name="brand"]').focus();return;}
    const btn=form.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='Saving…';
    detDrafts.set(link.key,det);
    const r=await PPData.requestTrackDetails(link,det);
    render(step2HTML(det,link,r,opts.head));
    const root2=opts.root();
    bindFollowup(root2,link);
    root2.querySelector('[data-det-edit]')?.addEventListener('click',()=>runCompareFlow(render,link,{...opts,detected:det}));
  });
}
async function showDetectedPanel(link,anchor,head){
  runCompareFlow(html=>showLinkPanel(anchor,html),link,{head,root:()=>linkPanel});
}

async function handleStoreLink(link,anchor){
  showLinkPanel(anchor,`<div class="ppx-lp-loading"><span class="ppx-lp-spin" aria-hidden="true"></span>Checking this ${H(link.store||'store')} link…</div>`);
  const m=await matchStoreLink(link);
  const head=`<div class="ppx-lp-head">${link.store?`<span class="ppx-lp-store">${storeLogoFor(link.store)}</span>`:''}<span class="ppx-lp-url">${H(link.host)}</span></div>`;
  if(m){
    const b=bestPrice(m.p);
    const a=dealAnalysis(m.p.id,b.price,b.state.uniqueLowest&&typeof ppOfferSavings==='function'?ppOfferSavings(b.state.uniqueLowest):null,b.state.inStock?.length||0);
    if(m.exact){location.hash=`#/product/${encodeURIComponent(m.p.id)}`;closeLinkPanel();return;}
    showLinkPanel(anchor,`${head}<p class="ppx-lp-title">Is this the product?</p>
      <a class="ppx-lp-product" href="#/product/${encodeURIComponent(m.p.id)}"><span class="ppx-lp-img">${photoOf(m.p)?`<img src="${H(photoOf(m.p))}" alt="">`:''}</span><span class="ppx-lp-copy"><b>${H(m.p.name)}</b><small>${Number.isFinite(b.price)?`Best verified ${M(b.price)} · ${b.stores} stores`:`${b.stores} stores compared`}</small>${a?`<em>Deal Score ${a.score} · ${H(a.label)}</em>`:''}</span><span class="ppx-lp-go">Compare →</span></a>
      <button type="button" class="ppx-lp-alt" data-lp-request>Not this one? Ask us to track my link</button>`);
    linkPanel.querySelector('[data-lp-request]').addEventListener('click',()=>showDetectedPanel(link,anchor,head));
    return;
  }
  if(!link.known){showLinkPanel(anchor,`${head}<p class="ppx-lp-title">We don't compare this store yet</p><p class="ppx-lp-note">We compare Amazon, Flipkart, Croma, Myntra, AJIO, Meesho, Nykaa, Purplle, Reliance Digital, Tata CLiQ and JioMart. Search the product name instead.</p>`);return;}
  showDetectedPanel(link,anchor,head);
}
/* =====================================================================
   V214 — Compare by name (no link needed)
   After a normal search: 0 results -> details card opens directly;
   some results -> small "Can't find it?" strip that opens the same card.
   ===================================================================== */
function textLink(q){
  const clean=String(q||'').trim().replace(/\s+/g,' ').slice(0,120);
  return {url:`https://price-pulse.in/#search=${encodeURIComponent(clean)}`,key:`search:${clean.toLowerCase()}`,host:'',store:'',words:clean.split(' '),isShort:false,known:false,isText:true,query:clean};
}
function assistBox(){
  let box=document.getElementById('ppxSearchAssist');
  const nr=document.getElementById('noResults');
  if(!box&&nr){box=document.createElement('div');box.id='ppxSearchAssist';box.className='ppx-assist';nr.after(box);}
  return box;
}
function renderAssistCard(box,link,head){
  runCompareFlow(html=>{box.innerHTML=`<div class="ppx-assist-card">${html}</div>`;},link,{head,root:()=>box,title:'',cta:'Yes, compare stores'});
}
function alignAssist(box){
  try{
    const first=document.querySelector('.deal-tabs button');const tabs=first?.parentElement;const host=box.parentElement;
    if(!first||!host||window.innerWidth<=700){box.style.removeProperty('--assist-left');box.style.removeProperty('--assist-w');return;}
    const hl=host.getBoundingClientRect().left,fl=first.getBoundingClientRect().left,tr=tabs.getBoundingClientRect().right;
    box.style.removeProperty('--assist-left'); /* V277: centred (was: lined up with the first category chip) */
    box.style.setProperty('--assist-w',Math.round(Math.min(tr-fl,980))+'px');
  }catch(_){}
}
window.addEventListener('resize',()=>{const b=document.getElementById('ppxSearchAssist');if(b&&!b.hidden)alignAssist(b);});
/* V216: search results bar with a way back */
function searchBar(q){
  const grid=document.getElementById('dealGrid');if(!grid)return;
  let bar=document.getElementById('ppxSearchBar');
  const query=String(q||'').trim();
  if(!query||parseStoreLink(query)){bar?.remove();return;}
  if(!bar){bar=document.createElement('div');bar.id='ppxSearchBar';bar.className='ppx-search-bar';grid.before(bar);
    bar.addEventListener('click',e=>{
      if(e.target.closest('[data-sb-clear]'))clearSearchResults(true);
      else if(e.target.closest('[data-sb-home]')){clearSearchResults(false);window.scrollTo({top:0,behavior:'smooth'});}
    });}
  const n=[...document.querySelectorAll('.deal-card')].filter(c=>!c.hidden).length;
  requestAnimationFrame(()=>{try{const vis=[...document.querySelectorAll('.deal-card')].some(c=>!c.hidden);if(vis){bar.style.removeProperty('--assist-left');bar.style.removeProperty('--assist-w');}else alignAssist(bar);}catch(_){}});
  bar.innerHTML=`<div class="ppx-sb-copy">${SEARCH_ICON}<span>${n?`<b>${n}</b> ${n===1?'result':'results'} for`:'No results for'} <b>“${H(query)}”</b></span></div>
    <div class="ppx-sb-actions"><button type="button" class="ppx-sb-btn" data-sb-clear>← Back to all deals</button><button type="button" class="ppx-sb-btn is-ghost" data-sb-home><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 11.2 12 3l9 8.2v9.3a.5.5 0 0 1-.5.5h-5.2v-6.1H8.7V21H3.5a.5.5 0 0 1-.5-.5v-9.3Z"/></svg>Home</button></div>`;
}
function clearSearchResults(scrollToDeals){
  if(headerInput)headerInput.value='';
  try{typeof filterProducts==='function'&&filterProducts('all','');}catch(_){}
  document.querySelectorAll('.deal-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));
  document.getElementById('ppxSearchBar')?.remove();
  const a=document.getElementById('ppxSearchAssist');if(a){a.innerHTML='';a.hidden=true;}
  headerInput?.closest('form')?.classList.remove('is-link');
  if(scrollToDeals)document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'});
}
window.ppClearSearch=clearSearchResults;
document.addEventListener('click',e=>{if(e.target.closest('.category-nav [data-cat],.deal-tabs button,#viewAllCategories,[data-ppx-brand],[data-ppx-store]'))document.getElementById('ppxSearchBar')?.remove();},true);
function runSearchAssist(q){
  searchBar(q);
  const box=assistBox();if(!box)return;
  requestAnimationFrame(()=>alignAssist(box));
  const query=String(q||'').trim();
  if(query.length<3||parseStoreLink(query)){box.innerHTML='';box.hidden=true;return;}
  box.hidden=false;
  const visible=[...document.querySelectorAll('.deal-card')].filter(c=>!c.hidden).length;
  const link=textLink(query);
  if(!visible){
    renderAssistCard(box,link,`<div class="ppx-assist-head"><b>“${H(query)}” isn't on PricePulse yet</b><span>Check the details below and we'll compare it across stores for you.</span></div>`);
  }else{
    box.innerHTML=`<button type="button" class="ppx-assist-strip" data-assist-open><span>${SEARCH_ICON}</span><b>Can't find the exact product?</b><em>Compare “${H(query)}” across stores →</em></button>`;
    box.querySelector('[data-assist-open]').addEventListener('click',()=>renderAssistCard(box,link,`<div class="ppx-assist-head"><b>Compare “${H(query)}” across stores</b><span>Check the details below.</span></div>`));
  }
}
/* Never let the header search reload the page; if the old search handler did not run, filter here. */
document.getElementById('siteSearch')?.addEventListener('submit',e=>{
  e.preventDefault();
  const q=String(headerInput?.value||'');
  setTimeout(()=>{
    if(parseStoreLink(q))return;
    const cardsAll=[...document.querySelectorAll('.deal-card')];
    const anyHidden=cardsAll.some(c=>c.hidden);
    if(q.trim()&&!anyHidden&&typeof filterProducts==='function'&&typeof ppSmartSearchMatch==='function'&&cardsAll.some(c=>!ppSmartSearchMatch(c.dataset.search||'',q))){
      try{filterProducts('all',q);}catch(_){}
      document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
    runSearchAssist(q);
  },30);
},true);
document.addEventListener('click',e=>{if(e.target.closest('.category-nav [data-cat],.deal-tabs button,#viewAllCategories,[data-ppx-brand],[data-ppx-store]')){const b=document.getElementById('ppxSearchAssist');if(b){b.innerHTML='';b.hidden=true;}}},true);

async function requestTrackUI(link,anchor){
  const btn=linkPanel?.querySelector('[data-lp-request]');if(btn){btn.disabled=true;btn.textContent='Sending…';}
  const r=await PPData.requestTrack(link.url,link.key,link.store);
  const n=r.ok&&r.data?.count>1?`<p class="ppx-lp-note"><b>${r.data.count} shoppers</b> have asked for this product. It moves up our list.</p>`:'';
  showLinkPanel(anchor,`<div class="ppx-lp-done">${ICON.tick}<div><p class="ppx-lp-title">Request received</p><p class="ppx-lp-note">${r.ok?'We will add verified prices for this product soon.':'Saved on this device. We will send it as soon as you are back online.'}</p>${n}</div></div>
    <div class="ppx-lp-actions">${openStoreHTML(link)}<a class="ppx-btn ppx-btn-ghost" href="#/alerts">${ICON.bell}My deal alerts</a></div>${otherStoresHTML(link)}`);
}
{
  const siteForm=document.getElementById('siteSearch');
  siteForm?.addEventListener('submit',e=>{
    const link=parseStoreLink(headerInput?.value);
    if(!link)return;
    e.preventDefault();e.stopImmediatePropagation();
    /* V251: a pasted store link opens the Find best price page (old dropdown = fallback) */
    if(typeof window.ppOpenFind==='function'){window.ppOpenFind(link.url);return;}
    handleStoreLink(link,siteForm);
  },true);
  [headerInput].forEach(inp=>inp?.addEventListener('input',()=>{
    const f=inp.closest('form');
    f?.classList.toggle('is-link',!!parseStoreLink(inp.value));
    if(parseStoreLink(inp.value)){const box=f?.querySelector('.ppx-suggest');if(box)box.hidden=true;}
  }));
  [headerInput].forEach(inp=>inp?.addEventListener('paste',()=>setTimeout(()=>{if(parseStoreLink(inp.value))inp.closest('form')?.requestSubmit();},30)));
}

/* ---------- Plus line ---------- */
{
  const pl=document.getElementById('ppxHeroPlus');
  if(pl)pl.innerHTML=`<span class="ppx-hero-plus-new">PLUS</span><span class="ppx-hp-long">Pays for itself: <b>₹99</b> → <b>₹100 back</b> on first eligible purchase</span><span class="ppx-hp-short">Pays for itself: <b>₹99</b> → <b>₹100 back</b></span><i aria-hidden="true">→</i>`;
}

/* ---------- Real stats line ---------- */
async function renderHeroStats(){
  const copy=document.querySelector('.ppx-hero-v2 .hero-copy');if(!copy)return;
  let el=document.getElementById('ppxHeroStats');
  if(!el){el=document.createElement('div');el.id='ppxHeroStats';el.className='ppx-hero-stats';copy.appendChild(el);}
  const idx=productIndex();
  const stores=document.querySelectorAll('#storeGrid .store-card[data-store]').length;
  let checks=0;idx.forEach(p=>{try{checks+=(typeof ppHistorySnapshots==='function'?ppHistorySnapshots(p.id).length:0)}catch(_){}});
  const remote=await PPData.siteStats();
  const c30=Number(remote?.price_checks_30d)||checks;
  const alerts=Number(remote?.active_alerts)||0;
  const items=[[idx.length,idx.length===1?'product tracked':'products tracked'],[stores,'stores covered'],[c30,'price checks this month'],[alerts,alerts===1?'deal alert watching':'deal alerts watching']].filter(([n])=>n>0);
  el.innerHTML=`<span class="ppx-hs-live"><i aria-hidden="true"></i>LIVE</span>`+items.map(([n,l])=>`<span><b>${Number(n).toLocaleString('en-IN')}</b> ${l}</span>`).join('<span class="ppx-hs-sep" aria-hidden="true">·</span>');
}

/* ---------- Sale countdown strip ---------- */
let saleTimer=0;
function fmtLeft(ms){const s=Math.max(0,Math.floor(ms/1000));const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;const z=n=>String(n).padStart(2,'0');return d?`${d}d ${z(h)}h ${z(m)}m`:`${z(h)}h ${z(m)}m ${z(x)}s`;}
function renderSaleStrip(events){
  const heroEl=document.querySelector('.hero');if(!heroEl)return;
  let el=document.getElementById('ppxSaleStrip');
  const now=Date.now();
  const ev=(events||[]).map(e=>({...e,s:Date.parse(e.starts_at),e:Date.parse(e.ends_at)})).filter(e=>Number.isFinite(e.s)&&Number.isFinite(e.e)&&e.e>now).sort((a,b)=>a.s-b.s)[0];
  clearInterval(saleTimer);
  if(!ev){el?.remove();return;}
  if(!el){el=document.createElement('div');el.id='ppxSaleStrip';el.className='ppx-sale-strip';heroEl.before(el);}
  const watching=productIndex().length;
  const tick=()=>{
    const t=Date.now(),live=t>=ev.s;
    if(t>=ev.e){el.remove();clearInterval(saleTimer);return;}
    el.classList.toggle('is-live',live);
    el.innerHTML=`<div class="container ppx-ss-in"><span class="ppx-ss-tag">${live?'<i aria-hidden="true"></i>LIVE NOW':'SALE ALERT'}</span>
      <span class="ppx-ss-title">${ev.store?`${storeLogoFor(ev.store)}`:''}<b>${H(ev.title)}</b>${ev.note?`<small>${H(ev.note)}</small>`:''}</span>
      <span class="ppx-ss-clock" aria-live="off">${live?'Ends in':'Starts in'} <b>${fmtLeft((live?ev.e:ev.s)-t)}</b></span>
      <span class="ppx-ss-watch">We're watching <b>${watching}</b> products</span>
      <a class="ppx-ss-cta" href="#/alerts">${ICON.bell}${live?'Check price drops':'Set alerts before the sale'}</a></div>`;
  };
  tick();saleTimer=setInterval(tick,1000);
}
window.ppRenderSaleStrip=renderSaleStrip;
PPData.saleEvents().then(renderSaleStrip);

/* ---------- Hero card slider: top 3 drops + Deal Score ---------- */
function pickHeroProducts(n=3){
  const out=[];
  for(const p of productIndex()){
    const b=bestPrice(p);
    if(!Number.isFinite(b.price)||(b.state.inStock?.length||0)<2)continue;
    const ins=priceInsight(p.id,b.price);
    const lowOffer=b.state.uniqueLowest||b.state.bestOffers?.[0];
    const sav=lowOffer&&typeof ppOfferSavings==='function'?ppOfferSavings(lowOffer):null;
    const drop=ins.dropSinceStart||0;
    const a=dealAnalysis(p.id,b.price,sav,b.state.inStock?.length||0);
    const score=(drop>0?1e7+drop:0)+(a?a.score*1e3:0)+(sav?.saving||0);
    out.push({p,b,ins,sav,drop,a,score});
  }
  return out.sort((x,y)=>y.score-x.score).slice(0,n);
}
/* V227: Price Meter — where today's price sits between the recent high and low (no graph needed) */
function heroMeterHTML(p,b){return ppMeterHTML(b.price,lowestSeries(p.id),(b.state?.uniqueLowest||b.state?.bestOffers?.[0])?.name||'');}
/* shared one-line Price Meter (hero card + Home deal cards) */
function ppMeterHTML(price,all,store,cls=''){
  try{
    if(!Number.isFinite(price))return '';
    const now=Date.now();if(!all||all.length<3)return '';
    const win=all.filter(s=>now-s.time<=30*DAY);const ser=win.length>=3?win:all;
    const prices=[...ser.map(s=>s.price),price];
    const hi=Math.max(...prices),lo=Math.min(...prices);if(!(hi>lo))return '';
    const span=Math.max(1,Math.min(30,Math.round((now-ser[0].time)/DAY)||1));
    const pos=Math.max(0,Math.min(100,(hi-price)/(hi-lo)*100));
    const avg=prices.reduce((x,y)=>x+y,0)/prices.length;
    const vsAvg=Math.round(Math.abs(price-avg)/avg*1000)/10;
    const head=price<=lo?`Lowest price in ${span} days`:`${M(price-lo)} above the ${span}-day low`;
    const tip=[head,vsAvg>=0.5?`${vsAvg}% ${price<avg?'below':'above'} average`:'Around the average',store?`on ${store}`:''].filter(Boolean).join(' · ');
    const lab=Math.max(14,Math.min(86,pos));
    return `<span class="ppx-hm${cls?' '+cls:''}" role="img" aria-label="${H(`Today ${M(price)}. ${span}-day high ${M(hi)}, ${span}-day low ${M(lo)}. ${tip}`)}"><span class="ppx-hm-hi" title="${span}-day high">High ${M(hi)}</span><span class="ppx-hm-bar"><i style="--p:${(pos/100).toFixed(3)}"></i><span class="ppx-hm-tip" style="left:${lab.toFixed(1)}%"><b>Today ${M(price)}</b><br>${H(tip)}</span></span><span class="ppx-hm-lo" title="${span}-day low">Low ${M(lo)}</span></span>`;
  }catch(_){return '';}
}
let heroSlide=0,heroSlideTimer=0,heroPicks=[];
function heroCardInner(pick){
  const {p,b,ins,sav,drop,a}=pick;
  const offers=[...b.state.offers].filter(o=>o.price!=null).sort((x,y)=>x.price-y.price).slice(0,3);
  const lowest=b.price;
  const rows=offers.map(o=>{const isLow=o.price===lowest;const logo=typeof ppPopupRetailerRowLogo==='function'?ppPopupRetailerRowLogo(o):H(o.name);return `<div class="ppx-hc-row ${isLow?'is-low':''}"><span class="ppx-hc-logo">${logo}</span><b>${M(o.price)}</b>${isLow?'<em>LOWEST</em>':`<small>+${M(o.price-lowest)}</small>`}</div>`;}).join('');
  const badge=drop>0?`${ICON.trend}Today's best drop`:`${ICON.shield}Best verified deal`;
  const foot=drop>0?`<span class="ppx-hc-drop">↓ ${M(drop)} in ${ins.days} ${ins.days===1?'day':'days'}</span>`:(sav?`<span class="ppx-hc-drop">Save ${M(sav.saving)} vs MRP</span>`:'<span class="ppx-hc-drop">Compared across stores</span>');
  return `<i class="ppx-hc-shine" aria-hidden="true"></i>
    <div class="ppx-hc-top ppx-z1"><span class="ppx-hc-badge">${badge}</span><span class="ppx-hc-live"><i aria-hidden="true"></i>Verified prices</span></div>
    <div class="ppx-hc-product ppx-z2"><span class="ppx-hc-img ${ppxGlobalImg(p.id,photoOf(p)).surface}">${ppxGlobalImg(p.id,photoOf(p)).img}</span><span class="ppx-hc-name"><b>${H(p.name)}</b><small>${H([catLabel(p.category),p.brand].filter(Boolean).join(' · '))}</small></span>${a?scoreRing(a.score,46):''}</div>
    ${a?`<div class="ppx-hc-insight ppx-z1 is-${a.tone}"><b>${H(a.label)}</b><span class="is-${a.real.tone}">${H(a.real.short)} · ${H(a.real.text)}</span>${heroMeterHTML(p,b)}</div>`:''}
    <div class="ppx-hc-rows ppx-z1">${rows}</div>
    <div class="ppx-hc-foot ppx-z1">${foot}<span class="ppx-hc-cta">Compare all ${b.stores} stores →</span></div>`;
}
const heroBoot=Date.now();
/* V219.2: wait (max 4s) for verified prices so the hero card never flashes old prices */
function heroWaitLive(){try{return window.PP_PRICE_PILOT_ENABLED===true&&typeof ppLivePricesReady!=='undefined'&&!ppLivePricesReady&&Date.now()-heroBoot<4000;}catch(_){return false;}}
let heroWaitT=0;
function renderHeroSlider(){
  if(!heroArt)return;
  if(heroWaitLive()){
    if(!heroArt.dataset.skel){heroArt.dataset.skel='1';heroArt.__ppOrig=heroArt.innerHTML;heroArt.__ppOrigLive=heroArt.classList.contains('ppx-hero-art-live');heroArt.classList.add('ppx-hero-art-live');
      heroArt.innerHTML=`<div class="ppx-hc-wrap"><div class="ppx-hc-stage"><div class="ppx-hero-card ppx-hc-skel" aria-busy="true" aria-label="Loading verified prices"><div class="ppx-hc-top ppx-z1"><span class="ppx-sk w40"></span><span class="ppx-sk w25"></span></div><div class="ppx-hc-product ppx-z2"><span class="ppx-sk sq"></span><span class="ppx-hc-name"><span class="ppx-sk w70"></span><span class="ppx-sk w40"></span></span></div><div class="ppx-hc-rows ppx-z1">${'<div class="ppx-hc-row"><span class="ppx-sk w30"></span><span class="ppx-sk w25"></span></div>'.repeat(3)}</div><div class="ppx-hc-foot ppx-z1"><span class="ppx-sk w40"></span></div></div></div></div>`;}
    clearTimeout(heroWaitT);heroWaitT=setTimeout(renderHeroSlider,350);return;
  }
  const picks=pickHeroProducts(3);
  if(heroArt.dataset.skel){delete heroArt.dataset.skel;if(!picks.length&&heroArt.__ppOrig!=null){heroArt.innerHTML=heroArt.__ppOrig;if(!heroArt.__ppOrigLive)heroArt.classList.remove('ppx-hero-art-live');heroArt.dataset.sliderSig='';}}
  if(!picks.length)return;
  const sig=picks.map(x=>`${x.p.id}:${x.b.price}:${x.a?.score||0}`).join('|');
  if(heroArt.dataset.sliderSig===sig)return;
  heroArt.dataset.sliderSig=sig;heroArt.dataset.sig=sig;
  heroPicks=picks;heroSlide=Math.min(heroSlide,picks.length-1);
  const others=productIndex().filter(x=>!picks.some(k=>k.p.id===x.id)&&photoOf(x)).slice(0,2);
  const back=[picks[(heroSlide+1)%picks.length],picks[(heroSlide+2)%picks.length]].filter((x,i,arr)=>picks.length>1&&x&&x!==picks[heroSlide]&&arr.indexOf(x)===i).map(x=>x.p);
  const layers=(back.length?back:others).slice(0,2);
  const layer=(x,cls)=>{const bp=bestPrice(x);return `<div class="ppx-hc-layer ${cls}" aria-hidden="true"><span class="ppx-hc-layer-img"><img src="${H(photoOf(x))}" alt=""></span><span class="ppx-hc-layer-copy"><b>${H(x.name.split(/\s+/).slice(0,3).join(' '))}</b><small>${Number.isFinite(bp.price)?M(bp.price):`${bp.stores} stores`}</small></span></div>`;};
  const cur=picks[heroSlide];
  heroArt.classList.add('ppx-hero-art-live');
  heroArt.innerHTML=`<div class="ppx-hc-wrap"><div class="ppx-hc-stage">
    ${layers[1]?layer(layers[1],'l2'):''}${layers[0]?layer(layers[0],'l1'):''}
    <a class="ppx-hero-card is-slide-in" href="#/product/${encodeURIComponent(cur.p.id)}" aria-label="Compare ${H(cur.p.name)} prices">${heroCardInner(cur)}</a>
  </div>
    <span class="ppx-hc-float f1" aria-hidden="true">${ICON.tick}<b>${M(cur.b.price)}</b> lowest</span>
    <span class="ppx-hc-float f2" aria-hidden="true">${ICON.shield}${cur.b.stores} stores checked</span>
    ${picks.length>1?`<div class="ppx-hc-dots" role="tablist" aria-label="Top price drops">${picks.map((x,i)=>`<button type="button" role="tab" aria-selected="${i===heroSlide}" aria-label="${H(x.p.name)}" data-hc-slide="${i}"></button>`).join('')}</div>`:''}
  </div>`;
  animateHeroCard();
  heroArt.querySelectorAll('[data-hc-slide]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();goSlide(+b.dataset.hcSlide);restartSlider();}));
  restartSlider();
}
function goSlide(i){heroSlide=(i+heroPicks.length)%heroPicks.length;heroArt.dataset.sliderSig='';renderHeroSlider();}
function restartSlider(){
  clearInterval(heroSlideTimer);
  if(reduceMotion||heroPicks.length<2)return;
  heroSlideTimer=setInterval(()=>{if(document.hidden||parseRoute()||heroArt.matches(':hover'))return;goSlide(heroSlide+1);},6500);
}
/* replace the single-card renderer */
renderHeroCard=function(){try{renderHeroSlider()}catch(e){console.warn(e)}};
renderHeroSlider();renderHeroStats();
if(typeof window.ppUpdateHomeCardPrices==='function'){
  const orig=window.ppUpdateHomeCardPrices;
  window.ppUpdateHomeCardPrices=function(){const r=orig.apply(this,arguments);try{renderHeroSlider();renderHeroStats();}catch(_){}return r;};
}

/* V234: logo tagline — same width as the "PricePulse" name, brighter and a little bolder.
   Width is matched with letter-spacing (measured), so it stays tidy at any font. Header + footer logo. */
{
  const st=document.createElement('style');st.id='ppxTaglineStyle';
  st.textContent='.brand-copy small{font-weight:700!important;color:rgba(255,255,255,.88)!important;white-space:nowrap!important;line-height:1.1!important}';
  document.head.appendChild(st);
  const wOf=el=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect().width;};
  function fitOne(bc){
    const s=bc.querySelector('strong'),t=bc.querySelector('small');
    if(!s||!t||getComputedStyle(t).display==='none')return;
    const ws0=wOf(s);if(!(ws0>20))return;
    const ws=ws0*0.965;/* match the visible letters, not the glyph side-gaps */
    const n=(t.textContent||'').length;if(n<2)return;
    t.style.setProperty('transition','none','important');/* header CSS animates size changes; measure the real size */
    t.style.setProperty('letter-spacing','0px','important');t.style.setProperty('font-size','10px','important');
    const w0=wOf(t);if(!(w0>0))return;
    const WANT=1.6;/* px of letter-spacing we aim for */
    let fs=10*(ws-(n-1)*WANT)/w0;fs=Math.max(8.5,Math.min(13,fs));
    t.style.setProperty('font-size',fs.toFixed(2)+'px','important');
    const w1=wOf(t);
    const ls=Math.max(0,(ws-w1)/(n-1));
    t.style.setProperty('letter-spacing',ls.toFixed(2)+'px','important');
    t.style.setProperty('margin-right',(-ls).toFixed(2)+'px','important');
    t.style.setProperty('margin-left',(ws0*0.011).toFixed(2)+'px','important');
    void t.offsetWidth;t.style.removeProperty('transition');
  }
  function fitTaglines(){
    document.querySelectorAll('.brand-copy').forEach(bc=>{
      if(bc.closest('.site-header')&&document.body.classList.contains('ppx-scrolled'))return;/* header tagline is hidden while scrolled */
      try{fitOne(bc);}catch(_){}
    });
  }
  window.ppFitTaglines=fitTaglines;
  fitTaglines();setTimeout(fitTaglines,600);setTimeout(fitTaglines,2000);
  window.addEventListener('load',fitTaglines);
  document.fonts?.ready?.then(fitTaglines);
  let fitT=0;window.addEventListener('resize',()=>{clearTimeout(fitT);fitT=setTimeout(fitTaglines,150);});
  new MutationObserver(()=>{if(!document.body.classList.contains('ppx-scrolled')){clearTimeout(fitT);fitT=setTimeout(fitTaglines,340);}}).observe(document.body,{attributes:true,attributeFilter:['class']});
}

/* ---------------- Boot ---------------- */
document.querySelectorAll('.brand').forEach(a=>a.addEventListener('click',e=>{if(parseRoute()){e.preventDefault();window.ppGoHome();window.scrollTo({top:0});}}));
document.getElementById('homeNavBtn')?.addEventListener('click',()=>{if(parseRoute())window.ppGoHome();});
/* =====================================================================
   V218 — Premium "All Categories" menu
   - Main categories (with live deal counts) + "Popular right now" shortcuts
   - Shortcuts run a normal search; if nothing is tracked yet, the
     "Compare across stores" box opens (no empty pages)
   - Search inside the menu, staggered animation, bottom sheet on mobile
   ===================================================================== */
const CM_ART={
  mobiles:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmA1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F443C"/><stop offset="1" stop-color="#0D1915"/></linearGradient><linearGradient id="cmA2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5EF0C0"/><stop offset=".55" stop-color="#2E8FD8"/><stop offset="1" stop-color="#5B3FD0"/></linearGradient></defs><ellipse cx="32" cy="58" rx="15" ry="2.6" fill="#0E1F19" opacity=".18"/><rect x="18" y="5" width="28" height="50" rx="7" fill="url(#cmA1)"/><rect x="20.5" y="9" width="23" height="42" rx="4.5" fill="url(#cmA2)"/><circle cx="32" cy="12.2" r="1.3" fill="#0D1915"/><path d="M20.5 30 43.5 15v12L20.5 42z" fill="#fff" opacity=".16"/><rect x="27" y="47" width="10" height="1.6" rx=".8" fill="#fff" opacity=".7"/></svg>`,
  laptops:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmB1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D399"/><stop offset=".6" stop-color="#2563EB"/><stop offset="1" stop-color="#214538"/></linearGradient><linearGradient id="cmB2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E5E9EE"/><stop offset="1" stop-color="#9FADA5"/></linearGradient></defs><ellipse cx="32" cy="56" rx="26" ry="2.6" fill="#0E1F19" opacity=".16"/><rect x="11" y="12" width="42" height="29" rx="3.5" fill="#22302B"/><rect x="13.5" y="14.5" width="37" height="24" rx="1.8" fill="url(#cmB1)"/><path d="M13.5 30 50.5 18v8l-37 12.5z" fill="#fff" opacity=".14"/><path d="M5 43h54l-4 8H9z" fill="url(#cmB2)"/><rect x="27" y="44" width="10" height="1.8" rx=".9" fill="#7F8F86"/></svg>`,
  electronics:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmC1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3E534B"/><stop offset="1" stop-color="#101C18"/></linearGradient><linearGradient id="cmC2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5EF0C0"/><stop offset="1" stop-color="#15936A"/></linearGradient></defs><ellipse cx="32" cy="58" rx="20" ry="2.6" fill="#0E1F19" opacity=".16"/><path d="M12 36V30a20 20 0 0 1 40 0v6" fill="none" stroke="url(#cmC1)" stroke-width="5" stroke-linecap="round"/><rect x="8" y="33" width="13" height="20" rx="6" fill="url(#cmC1)"/><rect x="43" y="33" width="13" height="20" rx="6" fill="url(#cmC1)"/><rect x="17" y="36" width="5" height="14" rx="2.5" fill="url(#cmC2)"/><rect x="42" y="36" width="5" height="14" rx="2.5" fill="url(#cmC2)"/><path d="M11 37h4v12h-4z" fill="#fff" opacity=".12"/></svg>`,
  home:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmD1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A5B"/><stop offset="1" stop-color="#D9381E"/></linearGradient><linearGradient id="cmD2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3E534B"/><stop offset="1" stop-color="#14221D"/></linearGradient></defs><ellipse cx="32" cy="58" rx="22" ry="2.6" fill="#0E1F19" opacity=".16"/><path d="M27 8c-2 3 2 4 0 7M33 6c-2 3 2 4 0 7M39 8c-2 3 2 4 0 7" fill="none" stroke="#9FADA5" stroke-width="1.8" stroke-linecap="round" opacity=".8"/><path d="M14 27h36v20a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8z" fill="url(#cmD1)"/><rect x="10" y="22" width="44" height="6" rx="3" fill="url(#cmD2)"/><rect x="28" y="17" width="8" height="5" rx="2.5" fill="url(#cmD2)"/><rect x="5" y="31" width="9" height="4" rx="2" fill="url(#cmD2)"/><rect x="50" y="31" width="9" height="4" rx="2" fill="url(#cmD2)"/><path d="M18 31h5v18a4 4 0 0 1-3-3z" fill="#fff" opacity=".22"/></svg>`,
  fashion:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmE1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D6DDE4"/></linearGradient><linearGradient id="cmE2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5EF0C0"/><stop offset="1" stop-color="#1F9D74"/></linearGradient></defs><ellipse cx="32" cy="55" rx="27" ry="2.6" fill="#0E1F19" opacity=".16"/><path d="M6 44c0-6 2-14 6-17 3-2 7 2 11 2 5 0 7-6 10-6 2 0 3 4 7 7 5 4 12 4 16 7 3 2 3 6 2 9z" fill="url(#cmE1)" stroke="#B2BEB7" stroke-width="1"/><path d="M5 44h53c1 2 0 6-2 6H8c-3 0-4-3-3-6z" fill="#22302B"/><path d="M5 47h53" stroke="#E8B954" stroke-width="1.6"/><path d="M19 39c8-1 17-5 24-9" fill="none" stroke="url(#cmE2)" stroke-width="4.5" stroke-linecap="round"/><path d="M27 25l3 4M31 24l3 4M35 24.5l3 4" stroke="#7F8F86" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  appliances:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmF1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F4F6F8"/><stop offset=".5" stop-color="#D3DAE1"/><stop offset="1" stop-color="#ADBBB3"/></linearGradient></defs><ellipse cx="32" cy="59" rx="16" ry="2.4" fill="#0E1F19" opacity=".18"/><rect x="17" y="4" width="30" height="53" rx="5" fill="url(#cmF1)" stroke="#9FADA5"/><path d="M17 23h30" stroke="#92A098" stroke-width="1.4"/><rect x="21" y="10" width="2.6" height="9" rx="1.3" fill="#5B6860"/><rect x="21" y="28" width="2.6" height="14" rx="1.3" fill="#5B6860"/><rect x="36" y="8" width="7" height="4" rx="1.5" fill="#2E8FD8" opacity=".85"/><path d="M41 4h3a3 3 0 0 1 3 3v47a3 3 0 0 1-3 3h-3z" fill="#fff" opacity=".35"/></svg>`,
  beauty:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmG1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD6E0"/><stop offset="1" stop-color="#F28CA8"/></linearGradient><linearGradient id="cmG2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F5D489"/><stop offset=".5" stop-color="#E8B954"/><stop offset="1" stop-color="#B9852A"/></linearGradient><linearGradient id="cmG3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E2365B"/><stop offset="1" stop-color="#A3123A"/></linearGradient></defs><ellipse cx="32" cy="58" rx="24" ry="2.6" fill="#0E1F19" opacity=".16"/><rect x="10" y="22" width="22" height="34" rx="6" fill="url(#cmG1)"/><rect x="15" y="12" width="12" height="11" rx="2" fill="url(#cmG2)"/><rect x="18.5" y="5" width="5" height="8" rx="2.5" fill="#2F443C"/><rect x="14" y="32" width="14" height="10" rx="2" fill="#fff" opacity=".65"/><path d="M13 26h3v26h-3z" fill="#fff" opacity=".35"/><rect x="38" y="34" width="14" height="22" rx="2.5" fill="url(#cmG2)"/><path d="M40 34V20l10-5v19z" fill="url(#cmG3)"/><path d="M42 33V21l2-1v13z" fill="#fff" opacity=".3"/></svg>`,
  watches:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmH1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3E534B"/><stop offset="1" stop-color="#14221D"/></linearGradient></defs><ellipse cx="32" cy="59" rx="12" ry="2.4" fill="#0E1F19" opacity=".16"/><rect x="23" y="3" width="18" height="16" rx="5" fill="url(#cmH1)"/><rect x="23" y="45" width="18" height="13" rx="5" fill="url(#cmH1)"/><rect x="16" y="15" width="32" height="34" rx="9" fill="#22302B"/><rect x="19" y="18" width="26" height="28" rx="6.5" fill="#0D1915"/><circle cx="32" cy="32" r="9" fill="none" stroke="#FF5A7A" stroke-width="2.6" stroke-dasharray="44 60" stroke-linecap="round" transform="rotate(-90 32 32)"/><circle cx="32" cy="32" r="5.5" fill="none" stroke="#5EF0C0" stroke-width="2.4" stroke-dasharray="25 40" stroke-linecap="round" transform="rotate(-90 32 32)"/><rect x="48" y="26" width="3" height="8" rx="1.5" fill="#5B6860"/></svg>`,
  tv:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmI1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A5B"/><stop offset=".45" stop-color="#C13584"/><stop offset="1" stop-color="#2E3192"/></linearGradient></defs><ellipse cx="32" cy="56" rx="20" ry="2.4" fill="#0E1F19" opacity=".16"/><rect x="4" y="10" width="56" height="35" rx="3.5" fill="#131F1B"/><rect x="6.5" y="12.5" width="51" height="30" rx="1.8" fill="url(#cmI1)"/><path d="M6.5 32 57.5 15v9L6.5 42.5z" fill="#fff" opacity=".13"/><path d="M24 45l-4 9h24l-4-9z" fill="#5B6860"/><rect x="18" y="52" width="28" height="3" rx="1.5" fill="#2F443C"/></svg>`,
  earbuds:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmJ1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#CBD3DB"/></linearGradient></defs><ellipse cx="32" cy="57" rx="20" ry="2.4" fill="#0E1F19" opacity=".16"/><rect x="12" y="30" width="40" height="24" rx="11" fill="url(#cmJ1)" stroke="#B2BEB7"/><path d="M12 39h40" stroke="#B2BEB7"/><circle cx="32" cy="46" r="1.4" fill="#22C38E"/><g transform="rotate(-18 22 20)"><ellipse cx="22" cy="18" rx="7" ry="7.5" fill="url(#cmJ1)" stroke="#B2BEB7"/><rect x="19.5" y="22" width="5" height="12" rx="2.5" fill="url(#cmJ1)" stroke="#B2BEB7"/><circle cx="22" cy="17" r="3" fill="#2F443C"/></g><g transform="rotate(18 42 20)"><ellipse cx="42" cy="18" rx="7" ry="7.5" fill="url(#cmJ1)" stroke="#B2BEB7"/><rect x="39.5" y="22" width="5" height="12" rx="2.5" fill="url(#cmJ1)" stroke="#B2BEB7"/><circle cx="42" cy="17" r="3" fill="#2F443C"/></g></svg>`,
  swatch:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmK1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FE7C4"/><stop offset="1" stop-color="#1F9D74"/></linearGradient><linearGradient id="cmK2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5EF0C0"/><stop offset="1" stop-color="#2563EB"/></linearGradient></defs><ellipse cx="32" cy="59" rx="12" ry="2.4" fill="#0E1F19" opacity=".16"/><rect x="23" y="3" width="18" height="16" rx="5" fill="url(#cmK1)"/><rect x="23" y="45" width="18" height="13" rx="5" fill="url(#cmK1)"/><rect x="15" y="14" width="34" height="36" rx="11" fill="#D6DDE4"/><rect x="18" y="17" width="28" height="30" rx="8.5" fill="#0D1915"/><rect x="21" y="20" width="22" height="24" rx="6" fill="url(#cmK2)" opacity=".9"/><text x="32" y="35" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="9" fill="#fff">10:08</text></svg>`,
  ac:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmL1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D6DDE4"/></linearGradient></defs><ellipse cx="32" cy="57" rx="24" ry="2.2" fill="#0E1F19" opacity=".12"/><rect x="4" y="12" width="56" height="20" rx="6" fill="url(#cmL1)" stroke="#B2BEB7"/><path d="M8 27h48" stroke="#B2BEB7" stroke-width="1.4"/><circle cx="52" cy="18" r="1.3" fill="#22C38E"/><rect x="10" y="17" width="10" height="2" rx="1" fill="#C6CFD8"/><path d="M16 37c-2 4 2 6 0 10M26 37c-2 4 2 6 0 10M36 37c-2 4 2 6 0 10M46 37c-2 4 2 6 0 10" fill="none" stroke="#5BC0F8" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  airfryer:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmM1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3E534B"/><stop offset="1" stop-color="#101C18"/></linearGradient></defs><ellipse cx="32" cy="59" rx="20" ry="2.4" fill="#0E1F19" opacity=".18"/><path d="M14 14c0-5 4-9 9-9h18c5 0 9 4 9 9v38a5 5 0 0 1-5 5H19a5 5 0 0 1-5-5z" fill="url(#cmM1)"/><rect x="22" y="9" width="20" height="7" rx="3.5" fill="#0D1915"/><rect x="25" y="11" width="9" height="3" rx="1.5" fill="#5EF0C0"/><rect x="18" y="26" width="28" height="22" rx="5" fill="#1E2E28" stroke="#5B6860"/><rect x="21" y="30" width="22" height="9" rx="3" fill="#FFB547" opacity=".9"/><rect x="26" y="41" width="12" height="4" rx="2" fill="#5B6860"/><path d="M17 16h3v38h-3z" fill="#fff" opacity=".1"/></svg>`,
  tablet:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmN1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDE68A"/><stop offset=".5" stop-color="#F472B6"/><stop offset="1" stop-color="#6366F1"/></linearGradient></defs><ellipse cx="30" cy="58" rx="20" ry="2.4" fill="#0E1F19" opacity=".16"/><rect x="9" y="6" width="40" height="50" rx="5" fill="#22302B"/><rect x="12" y="9" width="34" height="44" rx="2.5" fill="url(#cmN1)"/><path d="M12 34 46 14v10L12 44z" fill="#fff" opacity=".16"/><g transform="rotate(28 52 34)"><rect x="50" y="12" width="4.2" height="40" rx="2.1" fill="#F4F6F8" stroke="#B2BEB7"/><path d="M50 52l2.1 5 2.1-5z" fill="#5B6860"/></g></svg>`,
  trimmer:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmO1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2F443C"/><stop offset=".5" stop-color="#506258"/><stop offset="1" stop-color="#14221D"/></linearGradient></defs><ellipse cx="32" cy="59" rx="10" ry="2.2" fill="#0E1F19" opacity=".18"/><rect x="24" y="4" width="16" height="7" rx="2" fill="#C6CFD8"/><path d="M24 6h16" stroke="#7F8F86" stroke-dasharray="1.5 1.5"/><path d="M22 12h20l-2 42a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z" fill="url(#cmO1)"/><rect x="29" y="22" width="6" height="12" rx="3" fill="#0D1915"/><circle cx="32" cy="26" r="1.6" fill="#5EF0C0"/><path d="M25 14h3l-1 40h-2z" fill="#fff" opacity=".14"/><rect x="27" y="44" width="10" height="1.4" rx=".7" fill="#E8B954"/></svg>`,
  gaming:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmP1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3E534B"/><stop offset="1" stop-color="#101C18"/></linearGradient></defs><ellipse cx="32" cy="53" rx="24" ry="2.4" fill="#0E1F19" opacity=".16"/><path d="M18 18h28c7 0 11 6 12 14l2 12c1 6-6 9-10 4l-5-6H19l-5 6c-4 5-11 2-10-4l2-12c1-8 5-14 12-14z" fill="url(#cmP1)"/><rect x="15" y="27" width="10" height="3.4" rx="1.2" fill="#C6CFD8"/><rect x="18.3" y="23.7" width="3.4" height="10" rx="1.2" fill="#C6CFD8"/><circle cx="44" cy="25" r="2.4" fill="#5EF0C0"/><circle cx="49.5" cy="30" r="2.4" fill="#FF5A7A"/><circle cx="38.5" cy="30" r="2.4" fill="#5BC0F8"/><circle cx="44" cy="35" r="2.4" fill="#FFB547"/><path d="M20 20h24" stroke="#fff" opacity=".12" stroke-width="2" stroke-linecap="round"/></svg>`,
  luggage:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmQ1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5EC4F0"/><stop offset="1" stop-color="#1D5FA8"/></linearGradient></defs><ellipse cx="32" cy="60" rx="15" ry="2.2" fill="#0E1F19" opacity=".18"/><path d="M25 14V5h14v9" fill="none" stroke="#5B6860" stroke-width="3" stroke-linejoin="round"/><rect x="16" y="13" width="32" height="42" rx="6" fill="url(#cmQ1)"/><path d="M24 17v34M32 17v34M40 17v34" stroke="#295847" stroke-width="1.6" opacity=".45"/><path d="M19 15h4v38h-4z" fill="#fff" opacity=".22"/><circle cx="21" cy="57.5" r="2.6" fill="#22302B"/><circle cx="43" cy="57.5" r="2.6" fill="#22302B"/></svg>`,
  fitness:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cmR1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3E534B"/><stop offset="1" stop-color="#101C18"/></linearGradient></defs><ellipse cx="32" cy="50" rx="26" ry="2.4" fill="#0E1F19" opacity=".16"/><rect x="18" y="29" width="28" height="6" rx="3" fill="#B2BEB7"/><rect x="9" y="17" width="9" height="30" rx="3" fill="url(#cmR1)"/><rect x="46" y="17" width="9" height="30" rx="3" fill="url(#cmR1)"/><rect x="3" y="22" width="7" height="20" rx="2.5" fill="#22C38E"/><rect x="54" y="22" width="7" height="20" rx="2.5" fill="#22C38E"/><path d="M11 19h2v26h-2z" fill="#fff" opacity=".15"/></svg>`
};
const CM_MAIN=[
  ['mobiles','Mobiles','5G phones, iPhone, Samsung & more','#E6F7F0'],
  ['laptops','Laptops','Work, student & gaming laptops','#E8F0FE'],
  ['electronics','Electronics','Earbuds, speakers & gadgets','#EEF2F6'],
  ['home','Home & Kitchen','Air fryers, mixers & cookware','#FFF0E8'],
  ['fashion','Fashion','Sneakers, shirts & ethnic wear','#F1F5F3'],
  ['appliances','Appliances','ACs, fridges & washing machines','#EEF3F7'],
  ['beauty','Beauty','Skincare, makeup & grooming','#FDEEF2'],
  ['watches','Smart Watches','Fitness bands & smartwatches','#E9FBF4']
];
const CM_POPULAR=[
  ['tv','Smart TVs','smart tv','hot'],
  ['earbuds','Earbuds','earbuds','hot'],
  ['swatch','Smartwatches','smartwatch',''],
  ['ac','Air Conditioners','air conditioner',''],
  ['airfryer','Air Fryers','air fryer','hot'],
  ['tablet','Tablets','tablet',''],
  ['trimmer','Trimmers & Grooming','trimmer',''],
  ['gaming','Gaming','gaming','new'],
  ['luggage','Bags & Luggage','trolley bag',''],
  ['fitness','Sports & Fitness','dumbbell','new']
];
function cmCount(cat){return document.querySelectorAll(`#dealGrid .deal-card[data-category="${cat}"]`).length;}
function cmMainHTML(){
  return CM_MAIN.map(([k,name,sub,bg],i)=>{const n=cmCount(k);return `<button type="button" class="ppx-cm-cat" data-cm-cat="${k}" data-cm-text="${H((name+' '+sub).toLowerCase())}" style="--i:${i}">
    <span class="ppx-cm-art" style="--bg:${bg}">${CM_ART[k]||''}</span>
    <span class="ppx-cm-copy"><b>${H(name)}</b><small>${H(sub)}</small></span>
    <span class="ppx-cm-count${n?'':' is-zero'}">${n?`${n} ${n===1?'deal':'deals'}`:'Compare'}</span>
    <i class="ppx-cm-go" aria-hidden="true">→</i></button>`;}).join('');
}
function cmPopularHTML(){
  return CM_POPULAR.map(([k,name,q,badge],i)=>`<button type="button" class="ppx-cm-pop" data-cm-q="${H(q)}" data-cm-text="${H((name+' '+q).toLowerCase())}" style="--i:${i+4}">
    <span class="ppx-cm-pop-art">${CM_ART[k]||''}</span><span class="ppx-cm-pop-name">${H(name)}</span>${badge==='hot'?'<em class="ppx-cm-badge is-hot">🔥 Hot</em>':badge==='new'?'<em class="ppx-cm-badge is-new">New</em>':''}</button>`).join('');
}
function cmBuild(menu){
  menu.classList.add('ppx-catmenu');
  menu.setAttribute('role','dialog');menu.setAttribute('aria-label','All categories');
  menu.innerHTML=`<div class="ppx-cm" role="document">
    <span class="ppx-cm-handle" aria-hidden="true"></span>
    <div class="ppx-cm-head">
      <div class="ppx-cm-title"><p>SHOP BY CATEGORY</p><h3>What are you shopping for?</h3></div>
      <label class="ppx-cm-search">${SEARCH_ICON}<input type="search" placeholder="Search categories or products…" autocomplete="off" aria-label="Search categories or products"></label>
      <button type="button" class="ppx-cm-close" id="closeCategoriesMenu" aria-label="Close categories">×</button>
    </div>
    <div class="ppx-cm-body">
      <section class="ppx-cm-main" aria-label="Categories"><div class="ppx-cm-grid">${cmMainHTML()}</div></section>
      <aside class="ppx-cm-side" aria-label="Popular right now">
        <div class="ppx-cm-side-head"><b>Popular right now</b><small>What shoppers are comparing this season</small></div>
        <div class="ppx-cm-pops">${cmPopularHTML()}</div>
      </aside>
    </div>
    <p class="ppx-cm-empty" hidden>No category matches. Press Enter to search “<b></b>” across stores.</p>
    <div class="ppx-cm-foot"><span>${ICON.tick}Prices checked across Amazon, Flipkart, Croma & more</span><button type="button" class="ppx-cm-paste" data-cm-paste>Have a product link? Paste it to compare →</button></div>
  </div>`;
}
{
  const menu=document.getElementById('allCategoriesMenu');
  if(menu){
    cmBuild(menu);
    if(menu.parentElement!==document.body)document.body.appendChild(menu);/* out of the sticky header so it stacks above the backdrop */
    const backdrop=document.createElement('div');backdrop.className='ppx-cm-backdrop';backdrop.hidden=true;document.body.appendChild(backdrop);
    const search=menu.querySelector('.ppx-cm-search input');
    const place=()=>{const nav=document.querySelector('.nav-wrap')||document.querySelector('.site-header');const b=Math.max(0,Math.round(nav?.getBoundingClientRect().bottom||0));menu.style.setProperty('--cm-top',b+'px');backdrop.style.setProperty('--cm-top',b+'px');};
    const refresh=()=>{menu.querySelectorAll('.ppx-cm-cat').forEach(btn=>{const n=cmCount(btn.dataset.cmCat);const c=btn.querySelector('.ppx-cm-count');c.textContent=n?`${n} ${n===1?'deal':'deals'}`:'Compare';c.classList.toggle('is-zero',!n);});};
    const filter=()=>{const q=search.value.trim().toLowerCase();let hits=0;
      menu.querySelectorAll('[data-cm-text]').forEach(el=>{const ok=!q||q.split(/\s+/).every(w=>el.dataset.cmText.includes(w));el.hidden=!ok;if(ok)hits++;});
      const empty=menu.querySelector('.ppx-cm-empty');empty.hidden=!!hits||!q;empty.querySelector('b').textContent=search.value.trim();
      menu.querySelector('.ppx-cm-side').hidden=q&&![...menu.querySelectorAll('.ppx-cm-pop')].some(x=>!x.hidden);
      menu.querySelector('.ppx-cm-main').hidden=q&&![...menu.querySelectorAll('.ppx-cm-cat')].some(x=>!x.hidden);};
    const origOpen=window.openCategoriesMenu,origClose=window.closeCategoriesMenu;
    let closing=0;
    const reduce=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(typeof origOpen==='function'){
      window.openCategoriesMenu=function(){
        clearTimeout(closing);menu.classList.remove('is-closing');backdrop.classList.remove('is-closing');
        origOpen();refresh();place();search.value='';filter();
        backdrop.hidden=false;document.documentElement.classList.add('ppx-cm-lock');
        if(window.matchMedia('(min-width:761px)').matches)setTimeout(()=>search.focus({preventScroll:true}),180);
      };
    }
    if(typeof origClose==='function'){
      window.closeCategoriesMenu=function(){
        if(menu.hidden){origClose();return;}
        if(reduce()){origClose();backdrop.hidden=true;document.documentElement.classList.remove('ppx-cm-lock');return;}
        menu.classList.add('is-closing');backdrop.classList.add('is-closing');
        clearTimeout(closing);
        closing=setTimeout(()=>{menu.classList.remove('is-closing');backdrop.classList.remove('is-closing');origClose();backdrop.hidden=true;document.documentElement.classList.remove('ppx-cm-lock');},190);
      };
    }
    window.positionCategoriesMenu=place;
    window.addEventListener('resize',()=>{if(!menu.hidden)place();});
    backdrop.addEventListener('click',()=>window.closeCategoriesMenu());
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden)window.closeCategoriesMenu();});
    search.addEventListener('input',filter);
    search.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();
      const first=[...menu.querySelectorAll('.ppx-cm-cat,.ppx-cm-pop')].find(x=>!x.hidden);
      const q=search.value.trim();if(!q)return;
      if(first&&first.dataset.cmText.includes(q.toLowerCase()))first.click();else cmRunSearch(q);});
    function cmRunSearch(q){
      window.closeCategoriesMenu();
      const f=document.getElementById('siteSearch');
      if(headerInput&&f){headerInput.value=q;headerInput.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>{f.requestSubmit();setTimeout(()=>document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'}),120);},200);}
    }
    menu.addEventListener('click',e=>{
      if(e.target.closest('.ppx-cm-close')){e.stopPropagation();window.closeCategoriesMenu();return;}
      const cat=e.target.closest('[data-cm-cat]');
      if(cat){
        const k=cat.dataset.cmCat,name=cat.querySelector('b')?.textContent||'category';
        window.closeCategoriesMenu();
        /* V229: on the Deals page the menu filters the Deals page (no jump to Home) */
        if(document.body.dataset.ppPage==='deals'&&typeof window.ppDealsPick==='function'){window.ppDealsPick(k);return;}
        leavePageForHome();
        setTimeout(()=>{
          if(typeof clearSearchResults==='function')clearSearchResults(false);
          if(typeof pickCategory==='function')pickCategory(k,false);else document.querySelector(`.category-nav [data-cat="${k}"]`)?.click();
          landDeals();
          if(typeof showToast==='function')showToast(`Showing ${name}`);
        },200);
        return;
      }
      const pop=e.target.closest('[data-cm-q]');
      if(pop){cmRunSearch(pop.dataset.cmQ);return;}
      if(e.target.closest('[data-cm-paste]')){
        window.closeCategoriesMenu();leavePageForHome();
        setTimeout(()=>{window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>{headerInput?.focus();},350);},200);
      }
    });
  }
}


/* =====================================================================
   V218.1 — Category bar + Popular Deals tabs: icons, counts, active line,
   hover animation, mobile edge fade + auto-centre, Deals shine
   ===================================================================== */
const NAV_ICO=(()=>{const sv=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;return {
  all:sv('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
  mobiles:sv('<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 18.5h3"/>'),
  laptops:sv('<rect x="4.5" y="5" width="15" height="10" rx="1.6"/><path d="M2.5 18.5h19"/>'),
  electronics:sv('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4.5" height="7" rx="2"/><rect x="16.5" y="13.5" width="4.5" height="7" rx="2"/>'),
  home:sv('<path d="M4 10h16v6.5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2.5 10h19"/><path d="M10 6.5c0-1 .8-1.5.8-2.5M14 6.5c0-1 .8-1.5.8-2.5"/>'),
  fashion:sv('<path d="M8.5 3.5 4 6l1.8 4L8 9.2V20.5h8V9.2l2.2.8L20 6l-4.5-2.5a3.5 3.5 0 0 1-7 0z"/>'),
  appliances:sv('<rect x="4.5" y="2.5" width="15" height="19" rx="2.2"/><circle cx="12" cy="13.5" r="4.2"/><path d="M8 6h.01M11 6h5"/>'),
  beauty:sv('<path d="M9 21.5h6V12H9z"/><path d="M9.8 12V6.5L14.2 4v8"/><path d="M18.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>'),
  watches:sv('<rect x="6" y="6.5" width="12" height="11" rx="3"/><path d="M8.5 6.5 9.3 3h5.4l.8 3.5M8.5 17.5l.8 3.5h5.4l.8-3.5"/><path d="M12 9.8V12l1.5 1"/>')
};})();
function navIcons(){
  document.querySelectorAll('.category-nav button[data-cat]').forEach(b=>{if(!b.querySelector('.ppx-nicon')&&NAV_ICO[b.dataset.cat])b.insertAdjacentHTML('afterbegin',`<span class="ppx-nicon">${NAV_ICO[b.dataset.cat]}</span>`);b.classList.add('ppx-navcat');});
  const allBtn=document.getElementById('allCategoriesBtn');if(allBtn&&!allBtn.querySelector('.ppx-nicon'))allBtn.insertAdjacentHTML('afterbegin',`<span class="ppx-nicon">${NAV_ICO.all}</span>`);
  document.querySelectorAll('.deal-tabs button[data-filter]').forEach(b=>{const k=b.dataset.filter;if(!b.querySelector('.ppx-tico')){const label=b.textContent.trim();b.innerHTML=`<span class="ppx-tico">${NAV_ICO[k]||NAV_ICO.all}</span><span class="ppx-tlbl">${H(label)}</span><em class="ppx-tcount"></em>`;}});
  tabCounts();
}
function tabCounts(){
  const cards=[...document.querySelectorAll('#dealGrid .deal-card')];
  document.querySelectorAll('.deal-tabs button[data-filter]').forEach(b=>{const k=b.dataset.filter;const n=k==='all'?cards.length:cards.filter(c=>c.dataset.category===k).length;const em=b.querySelector('.ppx-tcount');if(em)em.textContent=n?String(n):'';b.classList.toggle('is-empty',!n);});
}
function centerInRow(btn){const row=btn?.parentElement;if(!row||row.scrollWidth<=row.clientWidth+2)return;const r=btn.getBoundingClientRect(),rr=row.getBoundingClientRect();row.scrollTo({left:row.scrollLeft+(r.left-rr.left)-(rr.width-r.width)/2,behavior:'smooth'});}
function edgeFade(row){if(!row)return;const upd=()=>{const max=row.scrollWidth-row.clientWidth;row.classList.toggle('ppx-fade-l',row.scrollLeft>4);row.classList.toggle('ppx-fade-r',max>4&&row.scrollLeft<max-4);};row.addEventListener('scroll',upd,{passive:true});window.addEventListener('resize',upd);upd();setTimeout(upd,600);}
navIcons();setTimeout(navIcons,1500);
edgeFade(document.querySelector('.category-nav'));edgeFade(document.querySelector('.deal-tabs'));
document.addEventListener('click',e=>{
  const nb=e.target.closest('.category-nav button[data-cat]');if(nb)setTimeout(()=>centerInRow(nb),50);
  const tb=e.target.closest('.deal-tabs button[data-filter]');if(tb){setTimeout(()=>centerInRow(tb),50);}
  if(e.target.closest('.deal-tabs button,[data-cm-cat],.category-nav button[data-cat]')){setTimeout(()=>{const a=document.querySelector('.category-nav button.nav-selected');if(a)centerInRow(a);const t=document.querySelector('.deal-tabs button.active');if(t)centerInRow(t);},260);}
});
new MutationObserver(()=>tabCounts()).observe(document.getElementById('dealGrid')||document.body,{childList:true});

/* =====================================================================
   V219 — "Today's Deals" page (#/deals)
   Built only from data we already keep (verified store prices + price
   history). When the store API fills prices automatically, every section
   here updates by itself. Admin controls (Growth & Links → Deals page):
   featured picks, Plus early access, hide, headline — saved in
   pp_site_settings key "deals" (no new SQL).
   ===================================================================== */
const PP_DEALS_DEF={featured:[],plus_early:{},hidden:[],headline:'',note:'',insights:{}};
let ppDealsCfg={...PP_DEALS_DEF,...(window.PP_DEALS_SETTINGS||{})};
PPData.settings().then(s=>{if(s&&s.deals&&typeof s.deals==='object'){ppDealsCfg={...PP_DEALS_DEF,...s.deals};updateDealsBadge();try{window.ppRenderDecoded&&(document.querySelectorAll('.ppx-dc').forEach(x=>x.__h=''),window.ppRenderDecoded());}catch(_){}if(parseRoute()?.name==='deals')routes.deals();}}).catch(()=>{});
const DL_SEEN_KEY='pp_deals_seen_v1';
const dlSeen=()=>{try{return Number(localStorage.getItem(DL_SEEN_KEY))||0}catch(_){return 0}};
const dlMarkSeen=()=>{try{localStorage.setItem(DL_SEEN_KEY,String(Date.now()))}catch(_){}};
function dlPlusActive(){try{return typeof ppPlusIsActive==='function'&&ppPlusIsActive()}catch(_){return false}}
function dlOfferUrl(o){return o&&(o.url||o.listingUrl||o.affiliateUrl||o.directUrl)||'';}
/* one row per product with everything the page needs */
function dlRows(){
  const hidden=new Set(ppDealsCfg.hidden||[]);
  const now=Date.now();
  return productIndex().filter(p=>!hidden.has(p.id)).map(p=>{
    const d=dxDeal(p);
    const st=d.b.state||{};
    const inStock=(st.inStock||[]).filter(o=>Number.isFinite(o.price));
    const low=st.uniqueLowest||st.bestOffers?.[0]||null;
    const series=lowestSeries(p.id);
    const price=d.price;
    /* price drop: compare with the previous different verified lowest price */
    let drop=0,dropFrom=null,dropAt=0;
    if(Number.isFinite(price)&&series.length){
      for(let i=series.length-1;i>=0;i--){if(series[i].price>price){drop=series[i].price-price;dropFrom=series[i].price;dropAt=series[i].time;break;}if(series[i].price<price)break;}
    }
    const ins=d.ins||{};
    const atLow=Number.isFinite(price)&&series.length>=3&&price<=ins.min&&(ins.days||0)>=7;
    const an=Number.isFinite(price)?dealAnalysis(p.id,price,d.sav,inStock.length):null;
    const spread=inStock.length>=2?Math.max(...inStock.map(o=>o.price))-Math.min(...inStock.map(o=>o.price)):0;
    const spreadPct=spread&&price?Math.round(spread*100/(price+spread)):0;
    const pctOff=Math.max(d.sav?.percent||0,drop&&dropFrom?Math.round(drop*100/dropFrom):0,spreadPct);
    const lastT=series.length?series[series.length-1].time:0;
    const early=ppDealsCfg.plus_early?.[p.id];
    const earlyUntil=early?Date.parse(early):0;
    const isEarly=Number.isFinite(earlyUntil)&&earlyUntil>now;
    return {p,d,price,low,store:low?.name||d.store||'',url:dlOfferUrl(low),inStock,stores:(st.offers||[]).length,drop,dropFrom,dropAt,atLow,days:ins.days||0,score:an?.score??null,an,spread,pctOff,lastT,isEarly,earlyUntil,featured:(ppDealsCfg.featured||[]).indexOf(p.id),cat:p.category,photo:photoOf(p)};
  });
}
function dlNewCount(rows){const seen=dlSeen();return rows.filter(r=>r.lastT>seen&&(r.drop>0||r.atLow||(r.score||0)>=80)).length;}
function updateDealsBadge(){
  const btn=document.querySelector('.category-nav .deals-nav');if(!btn)return;
  let n=0;try{n=dlNewCount(dlRows())}catch(_){}
  let b=btn.querySelector('.ppx-deals-new');
  if(n>0){if(!b){b=document.createElement('em');b.className='ppx-deals-new';btn.appendChild(b);}b.textContent=`${n} new`;}
  else b?.remove();
}
setTimeout(updateDealsBadge,1600);setTimeout(updateDealsBadge,5000);
/* Deals button opens the page instead of scrolling */
{
  const btn=document.querySelector('.category-nav .deals-nav');
  if(btn){btn.removeAttribute('data-scroll');btn.setAttribute('aria-label','Today\'s deals');}
  document.addEventListener('click',e=>{const b=e.target.closest('.category-nav .deals-nav');if(!b)return;e.preventDefault();e.stopImmediatePropagation();window.ppGoPage('deals');},true);
}
const DL_PRICE=[['all','Any price'],['u1k','Under ₹1,000'],['1k5k','₹1,000 – ₹5,000'],['5k20k','₹5,000 – ₹20,000'],['20k','₹20,000+']];
const DL_OFF=[['0','Any saving'],['10','10%+ cheaper'],['20','20%+ cheaper']];
const DL_SORT=[['score','Best Deal Score'],['drop','Biggest drop'],['save','Biggest discount'],['low','Lowest price']];
let dlState={cat:'all',price:'all',off:'0',sort:'score',spec:{},specCat:'all',store:''};
/* V260: spec filters (RAM, Storage, Processor, Screen...) from the product details the extension read on store
   pages (pp_ext_details_facets, extension SQL v4). Only shown for one category; a product without that detail
   is hidden while that filter is on. */
const DL_SPEC_KEYS=[['ram','RAM'],['storage','Storage'],['processor','Processor'],['screen','Screen'],['os','OS'],['battery','Battery'],['size','Size'],['gender','For'],['material','Material'],['qty','Size / pack'],['color','Colour']];
let dlSpecs=null,dlSpecsLoading=false;
function dlSpecNorm(k,v){
  v=String(v??'').replace(/\s+/g,' ').trim();if(!v)return '';
  if(k==='screen'){const m=v.match(/(\d+(?:\.\d+)?)\s*(cm|centimet|inch|inches|in\b|")/i);if(!m)return '';let n=+m[1];if(/^c/i.test(m[2]))n=n/2.54;return n>=1&&n<=120?`${(Math.round(n*10)/10)}" screen`:'';}
  return v.length>40?'':v;
}
async function dlLoadSpecs(){
  if(dlSpecs||dlSpecsLoading)return;
  if(typeof supabaseClient==='undefined'||!supabaseClient)return;
  dlSpecsLoading=true;
  try{
    const ids=productIndex().map(p=>p.id).filter(Boolean).slice(0,600);
    const r=await supabaseClient.rpc('pp_ext_details_facets',{p_ids:ids});
    const out={};
    if(!r.error&&r.data&&typeof r.data==='object')for(const [id,f] of Object.entries(r.data)){const o={};for(const [k] of DL_SPEC_KEYS){const v=dlSpecNorm(k,f&&f[k]);if(v)o[k]=v;}if(Object.keys(o).length)out[id]=o;}
    dlSpecs=out;
  }catch(_){dlSpecs={};}
  dlSpecsLoading=false;
  if(document.body.dataset.ppPage==='deals'&&dlState.cat!=='all')dlRerender();
}
function dlSpecOk(r){const f=dlState.spec||{};const ks=Object.keys(f);if(!ks.length)return true;const o=(dlSpecs||{})[r.p.id]||{};return ks.every(k=>o[k]===f[k]);}
function dlSpecFacets(rows){
  if(!dlSpecs||dlState.cat==='all')return [];
  const inCat=rows.filter(r=>r.cat===dlState.cat);
  const out=[];
  for(const [k,l] of DL_SPEC_KEYS){
    const cnt=new Map();inCat.forEach(r=>{const v=(dlSpecs[r.p.id]||{})[k];if(v)cnt.set(v,(cnt.get(v)||0)+1);});
    const n=[...cnt.values()].reduce((a,b)=>a+b,0);
    if((cnt.size>=2&&n>=2)||dlState.spec[k])out.push([k,l,[...cnt.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'en',{numeric:true}))]);
    if(out.length>=6)break;
  }
  return out;
}
function dlPriceOk(r,k){const v=r.price;if(k==='all')return true;if(!Number.isFinite(v))return false;return k==='u1k'?v<1000:k==='1k5k'?v>=1000&&v<5000:k==='5k20k'?v>=5000&&v<20000:v>=20000;}
function dlFilter(rows){return rows.filter(r=>(dlState.cat==='all'||r.cat===dlState.cat)&&(!dlState.store||cbKey(r.store)===cbKey(dlState.store))&&dlPriceOk(r,dlState.price)&&r.pctOff>=Number(dlState.off)&&dlSpecOk(r));}
function dlSort(rows){const s=dlState.sort;return [...rows].sort((a,b)=>s==='save'?(b.pctOff-a.pctOff)||((b.score??-1)-(a.score??-1)):s==='drop'?(b.drop-a.drop)||(b.pctOff-a.pctOff):s==='low'?((a.price??1e12)-(b.price??1e12)):((b.score??-1)-(a.score??-1))||(b.pctOff-a.pctOff));}
function dlBadge(r){
  if(r.drop>0)return `<span class="ppx-dl-badge is-drop">▼ ${M(r.drop)} cheaper</span>`;
  if(r.atLow)return `<span class="ppx-dl-badge is-low">Lowest in ${r.days} days</span>`;
  if(r.spread>0)return `<span class="ppx-dl-badge is-save">Save ${M(r.spread)} vs other stores</span>`;
  if(r.pctOff)return `<span class="ppx-dl-badge">${r.pctOff}% off</span>`;
  return '';
}
function dlCard(r,{big=false,locked=false}={}){
  const lockHTML=locked?`<div class="ppx-dc-lock"><span>${ICON.crown}</span><b>Plus early access</b><small>Opens for everyone ${dlLeft(r.earlyUntil)}</small><a class="ppx-btn ppx-btn-gold" href="#/plus">Unlock with Plus · ₹99/yr</a></div>`:'';
  return `<article class="ppx-dc-card${locked?' is-locked':''}" data-product-id="${H(r.p.id)}">${typeof dcInnerHTML==='function'?dcInnerHTML(r.p):''}${lockHTML}</article>`;
}
function dlLeft(t){const ms=t-Date.now();if(ms<=0)return 'now';const h=Math.floor(ms/3600000),m=Math.max(1,Math.floor(ms%3600000/60000));return h?`in ${h}h ${m}m`:`in ${m}m`;}
const DL_ICO=(()=>{const sv=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;return {
  picks:sv('<path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.5l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'),
  drops:sv('<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>'),
  lows:sv('<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.5M17 6h2.5a2.5 2.5 0 0 1-2.6 3.5"/>'),
  top:sv('<path d="M4.5 16a8 8 0 1 1 15 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1.4"/>'),
  saves:sv('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><path d="M9.5 8.5h.01"/><path d="M10 15.5l4-4"/>'),
  all:sv('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
  bell:sv('<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 20h4"/><path d="M19.5 3.5l1.5-1.5M4.5 3.5 3 2"/>')
};})();
function dlSection(key,icon,title,sub,rows,opts={}){
  icon=DL_ICO[key]||icon;
  if(!rows.length)return '';
  return `<section class="ppx-dl-sec" data-dl-sec="${key}"><header class="ppx-dl-sechead"><span class="ppx-dl-secicon">${icon}</span><div><h2>${H(title)}</h2><p>${H(sub)}</p></div><em title="${rows.length} ${rows.length===1?'deal':'deals'} in this section">${rows.length} ${rows.length===1?'deal':'deals'}</em></header><div class="ppx-dl-grid${opts.big?' is-big':''}">${rows.map(r=>dlCard(r,opts)).join('')}</div></section>`;
}
function dlChips(list,key){return list.map(([k,l])=>`<button type="button" class="ppx-dl-chip${dlState[key]===k?' is-on':''}" data-dl-${key}="${k}">${H(l)}</button>`).join('');}
/* V226: categories come from the catalog itself (new admin categories show up on their own) */
function dlCatList(rows){
  const keys=[...new Set(rows.map(r=>r.cat).filter(Boolean))];
  const order=Object.keys(CAT_LABEL);
  keys.sort((a,b)=>{const ia=order.indexOf(a),ib=order.indexOf(b);return (ia<0?999:ia)-(ib<0?999:ib)||String(a).localeCompare(String(b));});
  const lbl=k=>CAT_LABEL[k]||String(k).replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  return [['all','All',rows.length],...keys.map(k=>[k,lbl(k),rows.filter(r=>r.cat===k).length])];
}
function dealsPageHTML(){
  if(dlState.specCat!==dlState.cat){dlState.spec={};dlState.specCat=dlState.cat;}
  if(dlState.cat!=='all')void dlLoadSpecs();
  const all=dlRows().filter(r=>Number.isFinite(r.price)); /* V226: only products with a checked price are deals */
  const plus=dlPlusActive();
  const early=dlFilter(all.filter(r=>r.isEarly));
  const pub=all.filter(r=>!r.isEarly||plus);
  const rows=dlFilter(pub);
  const used=new Set();
  const take=(list,n)=>{const out=list.filter(r=>!used.has(r.p.id)).slice(0,n);out.forEach(r=>used.add(r.p.id));return out;};
  const featured=take(rows.filter(r=>r.featured>=0).sort((a,b)=>a.featured-b.featured),4);
  const drops=take(dlSort(rows.filter(r=>r.drop>0)).sort((a,b)=>b.drop-a.drop),8);
  const lows=take(rows.filter(r=>r.atLow).sort((a,b)=>b.days-a.days),8);
  const top=take(dlSort(rows.filter(r=>(r.score||0)>=80)),8);
  const saves=take(rows.filter(r=>r.spread>0).sort((a,b)=>b.spread-a.spread),8);
  const rest=dlSort(rows.filter(r=>!used.has(r.p.id)));
  const live=dxLiveStats();
  const nDrops=pub.filter(r=>r.drop>0).length,nLow=pub.filter(r=>r.atLow).length;
  const cats=dlCatList(pub);
  if(dlState.cat!=='all'&&!cats.some(c=>c[0]===dlState.cat))cats.push([dlState.cat,CAT_LABEL[dlState.cat]||dlState.cat,0]);
  const curCat=cats.find(c=>c[0]===dlState.cat)||cats[0];
  const headline=ppDealsCfg.headline||"Today's best deals";
  const earlyHTML=early.length?(plus?dlSection('early',ICON.crown,'Plus Early Access','You are seeing these before everyone else',dlSort(early),{}):
    `<section class="ppx-dl-sec ppx-dl-plus" data-dl-sec="early"><header class="ppx-dl-sechead"><span class="ppx-dl-secicon is-gold">${ICON.crown}</span><div><h2>Plus Early Access</h2><p>Plus members see these deals first. Everyone else gets them a little later.</p></div><em>${early.length} ${early.length===1?'deal':'deals'}</em></header><div class="ppx-dl-grid">${dlSort(early).slice(0,4).map(r=>dlCard(r,{locked:true})).join('')}</div></section>`):'';
  const empty=!rows.length?`<div class="ppx-dl-empty"><b>No deals match these filters</b><p>Try another category or price range.</p><button type="button" class="ppx-btn ppx-btn-ghost" data-dl-reset>Clear filters</button></div>`:'';
  return `<div class="ppx-product ppx-list-page container ppx-deals-page">${crumbs('Live Deals')}
    <header class="ppx-dl-head">
      <h1>${H(headline)}</h1>
      <div class="ppx-dl-stats"><span><i class="ppx-dx-dot" aria-hidden="true"></i><b>${pub.length}</b> ${pub.length===1?'deal':'deals'} tracked</span>${nDrops?`<span><b>${nDrops}</b> price ${nDrops===1?'drop':'drops'}</span>`:''}${nLow?`<span><b>${nLow}</b> at lowest price</span>`:''}${live.ago?`<span>Updated <b>${live.ago}</b> ago</span>`:''}</div>
      <div class="ppx-dl-sale" id="ppxDlSale" hidden></div>
    </header>
    <div class="ppx-dl-filters" role="region" aria-label="Filter deals">
      <div class="ppx-dl-selects">
        <div class="ppx-dl-catwrap"><button type="button" class="ppx-dl-catbtn${dlState.cat!=='all'?' is-set':''}" data-dl-catbtn aria-haspopup="listbox" aria-expanded="false"><span>Category:</span> <b>${H(curCat[1])}</b> <em>${curCat[2]}</em><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
          <div class="ppx-dl-catmenu" role="listbox" aria-label="Category" hidden>${cats.map(([k,l,n])=>`<button type="button" role="option" aria-selected="${dlState.cat===k}" class="${dlState.cat===k?'is-on':''}" data-dl-cat="${H(k)}"><span>${H(l)}</span><em>${n}</em></button>`).join('')}</div></div>
        <label><span>Price</span><select data-dl-select="price">${DL_PRICE.map(([k,l])=>`<option value="${k}"${dlState.price===k?' selected':''}>${H(l)}</option>`).join('')}</select></label>
        <label><span>Saving</span><select data-dl-select="off">${DL_OFF.map(([k,l])=>`<option value="${k}"${dlState.off===k?' selected':''}>${H(l)}</option>`).join('')}</select></label>
        ${dlState.store?`<button type="button" class="ppx-dl-storechip" data-dl-store-x aria-label="Show all stores">Lowest on <b>${H(dlState.store)}</b> <span aria-hidden="true">×</span></button>`:''}
        <label><span>Sort</span><select data-dl-select="sort">${DL_SORT.map(([k,l])=>`<option value="${k}"${dlState.sort===k?' selected':''}>${H(l)}</option>`).join('')}</select></label>
      </div>
      ${(()=>{const fs=dlSpecFacets(pub);return fs.length?`<div class="ppx-dl-selects ppx-dl-specs">${fs.map(([k,l,vals])=>`<label class="${dlState.spec[k]?'is-set':''}"><span>${H(l)}</span><select data-dl-spec="${H(k)}"><option value="">Any</option>${vals.map(([v,n])=>`<option value="${H(v)}"${dlState.spec[k]===v?' selected':''}>${H(v)} (${n})</option>`).join('')}</select></label>`).join('')}${Object.keys(dlState.spec).length?'<button type="button" class="ppx-dl-chip" data-dl-specclear>Clear specs</button>':''}</div>`:'';})()}
    </div>
    ${empty}
    ${dlSection('picks',ICON.star,"Today's top picks",'Hand-checked by the PricePulse team',featured,{big:true})}
    ${dlSection('drops',ICON.trend.replace('M3 17l6-6 4 4 8-8M15 7h6v6','M3 7l6 6 4-4 8 8M15 17h6v-6'),'Price dropped','Cheaper than the last verified price',drops)}
    ${dlSection('lows',ICON.tick,'Lowest in 30+ days','At their lowest verified price right now',lows)}
    ${dlSection('top',ICON.star,'Top Deal Score','Score 80+ out of 100, based on price history',top)}
    ${dlSection('saves',ICON.check,'Biggest savings across stores','Same product, big price gap between stores',saves)}
    ${earlyHTML}
    ${dlSection('all',ICON.check,rows.length&&!featured.length&&!drops.length&&!lows.length&&!top.length&&!saves.length?'All tracked deals':'More deals','Every product we compare, sorted by your choice',rest)}
    <aside class="ppx-dl-foot"><span class="ppx-dl-secicon">${DL_ICO.bell}</span><div><b>Want a deal on something specific?</b><p>Set a price alert on any product and we will tell you when it drops.</p></div><a class="ppx-btn ppx-btn-ghost" href="#/alerts">My alerts</a></aside>
  </div>`;
}
let dlSaleTimer=0;
async function dlRenderSale(){
  clearInterval(dlSaleTimer);
  const el=document.getElementById('ppxDlSale');if(!el)return;
  const evs=await PPData.saleEvents();const now=Date.now();
  const ev=(evs||[]).map(e=>({...e,s:Date.parse(e.starts_at),e:Date.parse(e.ends_at)})).filter(e=>Number.isFinite(e.s)&&Number.isFinite(e.e)&&e.e>now).sort((a,b)=>a.s-b.s)[0];
  if(!ev){el.hidden=true;return;}
  el.hidden=false;
  const tick=()=>{const t=Date.now(),live=t>=ev.s;if(t>=ev.e){el.hidden=true;clearInterval(dlSaleTimer);return;}
    el.innerHTML=`<span class="ppx-dl-sale-tag">${live?'<i></i>LIVE NOW':'SALE ALERT'}</span>${ev.store?storeLogoFor(ev.store):''}<b>${H(ev.title)}</b><span class="ppx-dl-clock">${live?'Ends in':'Starts in'} <b>${fmtLeft((live?ev.e:ev.s)-t)}</b></span>`;};
  tick();dlSaleTimer=setInterval(()=>{if(!document.getElementById('ppxDlSale')){clearInterval(dlSaleTimer);return;}tick();},1000);
}
let dlLastHTML='';
routes.deals=()=>{
  dlLastHTML=dealsPageHTML();
  showPage('deals',dlLastHTML);
  document.title="Today's Deals | PricePulse";
  setMetaDescription('Real price drops and lowest prices across Amazon, Flipkart, Croma and more, checked by PricePulse.');
  dlRenderSale();
  dlStickUpdate();
  dlPlacePlusCard();
  dlMarkSeen();setTimeout(updateDealsBadge,50);
  document.querySelectorAll('.category-nav .deals-nav').forEach(b=>b.classList.add('is-current'));
  /* V225: the top category bar mirrors the Deals filter (nothing highlighted for All) */
  try{highlightNavCategory(dlState.cat&&dlState.cat!=='all'?dlState.cat:'');}catch(_){}
};
/* V225: on the Deals page the top category bar filters the Deals page itself (no jump to Home) */
document.addEventListener('click',e=>{
  if(document.body.dataset.ppPage!=='deals')return;
  const b=e.target.closest&&e.target.closest('.category-nav [data-cat]');if(!b)return;
  const cat=b.dataset.cat;if(!cat)return;
  e.preventDefault();e.stopImmediatePropagation();
  dlState.cat=CAT_LABEL[cat]?(dlState.cat===cat?'all':cat):'all';
  routes.deals();
  dlRerender();
},true);
window.addEventListener('hashchange',()=>{const n=parseRoute()?.name;if(n!=='deals')document.querySelectorAll('.category-nav .deals-nav.is-current').forEach(b=>b.classList.remove('is-current'));
  /* V229: a category highlight only belongs to product / deals pages; Brands, Stores, Wishlist… clear it */
  if(n&&n!=='product'&&n!=='deals')setTimeout(()=>{try{highlightNavCategory('');}catch(_){}},0);});
window.ppDealsPick=k=>{dlState.cat=k||'all';dlRerender();};
/* V226: re-render the Deals page after a filter change without landing on an empty screen:
   if the reader was down the page, put the first result right under the sticky filter bar */
function dlRerender(){
  const y=window.scrollY;
  routes.deals();
  const head=document.querySelector('.ppx-dl-head');
  const target=head?Math.max(0,head.getBoundingClientRect().bottom+window.scrollY-dlStickTop()):0;
  window.scrollTo({top:Math.min(y,target),behavior:'instant'});
  dlStickUpdate();
}
function dlCatMenu(open){
  const btn=document.querySelector('[data-dl-catbtn]'),m=document.querySelector('.ppx-dl-catmenu');if(!btn||!m)return;
  const on=open===undefined?m.hidden:open;m.hidden=!on;btn.setAttribute('aria-expanded',String(on));
  if(on){m.__y=scrollY;const r=btn.getBoundingClientRect();m.style.position='fixed';m.style.top=Math.round(r.bottom+8)+'px';m.style.left=Math.round(Math.max(8,Math.min(r.left,innerWidth-m.offsetWidth-8)))+'px';m.style.maxHeight=Math.max(200,innerHeight-r.bottom-24)+'px';}
  if(on)(m.querySelector('.is-on')||m.querySelector('button'))?.focus({preventScroll:true});
}
document.addEventListener('click',e=>{if(document.body.dataset.ppPage==='deals'&&!e.target.closest('.ppx-dl-catwrap'))dlCatMenu(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.dataset.ppPage==='deals'){const m=document.querySelector('.ppx-dl-catmenu');if(m&&!m.hidden){dlCatMenu(false);document.querySelector('[data-dl-catbtn]')?.focus();}}});
pageView.addEventListener('click',e=>{
  if(document.body.dataset.ppPage!=='deals')return;
  if(e.target.closest('[data-dl-catbtn]')){dlCatMenu();return;}
  const c=e.target.closest('[data-dl-cat]');if(c){dlState.cat=c.dataset.dlCat;dlRerender();return;}
  if(e.target.closest('[data-dl-reset]')){dlState={cat:'all',price:'all',off:'0',sort:'score',spec:{},specCat:'all',store:''};dlRerender();return;}
  if(e.target.closest('[data-dl-store-x]')){dlState.store='';dlRerender();return;}
  if(e.target.closest('[data-dl-specclear]')){dlState.spec={};dlRerender();return;}
  if(e.target.closest('.ppx-dl-card.is-locked .ppx-dl-media')){e.preventDefault();}
});
pageView.addEventListener('change',e=>{
  if(document.body.dataset.ppPage!=='deals')return;
  const sp=e.target.closest('[data-dl-spec]');
  if(sp){const k=sp.dataset.dlSpec;if(sp.value)dlState.spec={...dlState.spec,[k]:sp.value};else{const o={...dlState.spec};delete o[k];dlState.spec=o;}dlRerender();return;}
  const s=e.target.closest('[data-dl-select]');if(!s)return;
  dlState[s.dataset.dlSelect]=s.value;
  dlRerender();
});
/* V227: one Plus card in the Deals grid, right after the first row (not on every deal card) */
function dlPlacePlusCard(){
  document.querySelectorAll('.ppx-dl-pluscard').forEach(e=>e.remove());
  try{if(dlPlusActive())return;}catch(_){}
  const grids=[...document.querySelectorAll('.ppx-deals-page .ppx-dl-sec:not([data-dl-sec="early"]) .ppx-dl-grid')];if(!grids.length)return;
  const colsOf=g=>Math.max(1,getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length);
  /* the first full row on the page; if no section fills a row, the end of the first section */
  const grid=grids.find(g=>g.children.length>colsOf(g))||grids[0];
  const cols=colsOf(grid);
  const kids=[...grid.children];
  const a=document.createElement('a');a.className='ppx-dl-pluscard is-story';a.href='#/plus';
  a.innerHTML=plusStoryHTML();
  plusStorySale(a);
  const at=Math.min(cols,kids.length);
  if(at>=kids.length)grid.appendChild(a);else grid.insertBefore(a,kids[at]);
}
/* V228: the Plus card tells a 4-scene story (pure CSS animation, real products and prices):
   1 "Is this the lowest price?"  2 lowest-ever price unlocks  3 price-drop alert  4 sale access */
function plusStoryHTML(){
  let rows=[];try{rows=dlRows().filter(r=>Number.isFinite(r.price));}catch(_){}
  const withLow=rows.map(r=>{const ser=lowestSeries(r.p.id);if(ser.length<3)return null;const m=ser.reduce((x,y)=>y.price<x.price?y:x,ser[0]);return {r,low:Math.min(m.price,r.price),t:m.price<=r.price?m.time:Date.now()};}).filter(Boolean)
    .sort((x,y)=>((y.low<y.r.price)-(x.low<x.r.price))||((y.r.price-y.low)-(x.r.price-x.low))||((y.r.score??0)-(x.r.score??0))); /* best example: lowest-ever below today's price */
  const ex=withLow[0]||null;
  const drop=rows.filter(r=>r.drop>0).sort((x,y)=>y.drop-x.drop)[0]||ex?.r||rows[0]||null;
  const nLow=rows.filter(r=>r.atLow).length;
  const img=r=>r&&r.photo?`<img src="${H(r.photo)}" alt="">`:'<i></i>';
  const short=n=>{const w=String(n||'').split(/\s+/);return w.slice(0,4).join(' ')+(w.length>4?'…':'');};
  const fmtD=t=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short'}).format(new Date(t));
  const s1=ex?`<span class="pcs-prod">${img(ex.r)}<span><em>${H(short(ex.r.p.name))}</em><strong>${M(ex.r.price)}</strong></span></span>`:'';
  const s2=ex?`<span class="pcs-prod">${img(ex.r)}<span><em>${H(short(ex.r.p.name))}</em><span class="pcs-low">Lowest ever <span class="pcs-swap"><span class="pcs-blur">₹•,•••</span><strong class="pcs-reveal">${M(ex.low)} · ${H(fmtD(ex.t))}</strong></span></span></span></span>`:'';
  const s3=drop?`<span class="pcs-notif"><span class="pcs-bell">${ICON.bell||'🔔'}</span><span><strong>Price dropped!</strong><em>${H(short(drop.p.name))} is now ${M(drop.price)}</em></span></span>`:'';
  return `<span class="pcs-prog" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="pcs-top"><span class="pc-crown">${ICON.crown}</span><span class="pcs-brand"><span class="pc-eyebrow">PRICEPULSE PLUS</span><span class="pcs-price">₹99/year · under ₹9/month</span></span></span>
    <span class="pcs-stage" aria-hidden="true">
      <span class="pcs-scene s1"><small>Before you buy</small><b>Is this really the lowest price?</b>${s1}</span>
      <span class="pcs-scene s2"><small>Plus shows you</small><b>See the lowest-ever price</b>${s2}</span>
      <span class="pcs-scene s3"><small>Never miss a drop</small><b>Get 3× more price alerts</b>${s3}</span>
      <span class="pcs-scene s4"><small>Big sales</small><b>Sale deals, before everyone else</b><span class="pcs-sale"><span class="pcs-bolt">⚡</span><span class="pcs-sale-t">Early access to sale deals</span></span></span>
    </span>
    <span class="pcs-list"><span>🔓 Lowest-ever price on every product</span><span>🔔 3× more price alerts</span><span>⚡ Sale deals first</span></span>
    ${nLow?`<span class="pcs-stat"><i></i><b>${nLow}</b> ${nLow===1?'product is at its':'products are at their'} lowest price right now</span>`:''}
    <span class="pc-cta">Get Plus · ₹99/year <span aria-hidden="true">→</span></span>
    <span class="sr-only">PricePulse Plus, ₹99 a year: lowest-ever price on every product, 3 times more price alerts, early access to sale deals.</span>`;
}
async function plusStorySale(card){
  try{
    if(typeof PPData==='undefined'||!PPData.saleEvents)return;
    const evs=await PPData.saleEvents();const now=Date.now();
    const ev=(evs||[]).map(e=>({...e,s:Date.parse(e.starts_at),e:Date.parse(e.ends_at)})).filter(e=>Number.isFinite(e.s)&&Number.isFinite(e.e)&&e.e>now).sort((x,y)=>x.s-y.s)[0];
    const t=card.querySelector('.pcs-sale-t');if(!ev||!t)return;
    const live=now>=ev.s;
    t.innerHTML=`${H(ev.title)} <em>${live?'Ends in':'Starts in'} ${H(typeof fmtLeft==='function'?fmtLeft((live?ev.e:ev.s)-now):'')}</em>`;
  }catch(_){}
}
let dlPlusRz=0;window.addEventListener('resize',()=>{if(document.body.dataset.ppPage!=='deals')return;clearTimeout(dlPlusRz);dlPlusRz=setTimeout(dlPlacePlusCard,200);});
/* V226: prices / history / catalog arrive after the page opens (Supabase, admin edits):
   refresh an open Deals page in place, keeping the reader's spot */
let dlDataT=0;
function dlDataChanged(){
  if(document.body.dataset.ppPage!=='deals')return;
  clearTimeout(dlDataT);
  dlDataT=setTimeout(()=>{
    if(document.body.dataset.ppPage!=='deals')return;
    const m=document.querySelector('.ppx-dl-catmenu');if(m&&!m.hidden)return;
    let html='';try{html=dealsPageHTML();}catch(_){return;}
    if(html===dlLastHTML)return;
    const y=window.scrollY;routes.deals();window.scrollTo({top:y,behavior:'instant'});dlStickUpdate();
  },250);
}
for(const fn of ['ppUpdateHomeCardPrices','ppApplyHistoryRows','ppApplyCatalogData']){
  const o=window[fn];if(typeof o!=='function')continue;
  window[fn]=function(){const r=o.apply(this,arguments);try{dlDataChanged();}catch(_){}return r;};
}
/* V226: the filter bar sticks exactly under the site header (no gap for cards to peek through) */
function dlStickTop(){
  let b=0;
  for(const el of [document.querySelector('.site-header'),document.querySelector('.nav-wrap')]){
    if(!el)continue;const cs=getComputedStyle(el);
    if(cs.position==='sticky'||cs.position==='fixed'){const r=el.getBoundingClientRect();if(r.bottom>b&&r.top<=1)b=r.bottom;}
  }
  return Math.max(0,Math.round(b));
}
let dlStickRaf=0;
function dlStickUpdate(){
  const f=document.querySelector('.ppx-deals-page .ppx-dl-filters');if(!f)return;
  const t=dlStickTop();f.style.setProperty('--ppx-dl-stick',t+'px');
  const head=document.querySelector('.ppx-dl-head');
  const stuck=!!head&&head.getBoundingClientRect().bottom<=t+1;
  f.classList.toggle('is-stuck',stuck);
}
let dlStickT=0;
window.addEventListener('scroll',()=>{if(document.body.dataset.ppPage!=='deals')return;{const m=document.querySelector('.ppx-dl-catmenu');if(m&&!m.hidden&&Math.abs(scrollY-(m.__y||0))>40)dlCatMenu(false);}clearTimeout(dlStickT);dlStickT=setTimeout(dlStickUpdate,320);if(dlStickRaf)return;dlStickRaf=requestAnimationFrame(()=>{dlStickRaf=0;dlStickUpdate();});},{passive:true});
/* the header shrinks with a CSS transition on scroll: follow it while it animates */
document.querySelector('.site-header')?.addEventListener('transitionend',()=>{if(document.body.dataset.ppPage==='deals')dlStickUpdate();});
document.querySelector('.site-header')?.addEventListener('transitionrun',()=>{if(document.body.dataset.ppPage!=='deals')return;const t0=performance.now();const f=()=>{dlStickUpdate();if(performance.now()-t0<600)requestAnimationFrame(f);};requestAnimationFrame(f);});
window.addEventListener('resize',()=>{if(document.body.dataset.ppPage==='deals')dlStickUpdate();});
window.ppDealsRows=dlRows;window.ppDlIcons=DL_ICO;

/* =====================================================================
   V220 — Premium "decoded" deal cards (Home Popular Deals + Deals page)
   The card is a quick decision tool; the product page keeps the full detail.
   Card only:  verdict (buy / wait / fair) · mini 30-day trend · top-3 store ladder
               · one-tap Buy at the cheapest store · one-tap alert at a smart price
               · Plus insight (blurred for free users) · Add to compare (up to 3)
   Product page: full history chart, every store, offers, details.
   Everything comes from verified prices + history, so the store API fills it later.
   ===================================================================== */
const PC_CMP_KEY='pp_compare_v1';
const pcCmpGet=()=>{try{const v=JSON.parse(localStorage.getItem(PC_CMP_KEY)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,3):[]}catch(_){return []}};
const pcCmpSet=v=>{try{localStorage.setItem(PC_CMP_KEY,JSON.stringify(v.slice(0,3)))}catch(_){}};
let pcCmp=pcCmpGet();
const pcRound=(v)=>v>=2000?Math.floor(v/100)*100:Math.floor(v/10)*10;
const pcDate=t=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short'}).format(new Date(t));
function pcSaved(id){return !!document.querySelector(`.deal-card .heart[data-id="${CSS.escape(id)}"]`)?.classList.contains('saved');}
function pcData(p){
  const b=bestPrice(p),st=b.state||{};
  const price=Number.isFinite(b.price)?b.price:null;
  const offers=(st.inStock||[]).filter(o=>Number.isFinite(o.price)).sort((x,y)=>x.price-y.price);
  const low=st.uniqueLowest||st.bestOffers?.[0]||offers[0]||null;
  const sav=low&&typeof ppOfferSavings==='function'?ppOfferSavings(low):null;
  const series=lowestSeries(p.id);
  const ins=priceInsight(p.id,price);
  const an=price!=null?dealAnalysis(p.id,price,sav,offers.length):null;
  const now=Date.now();
  let drop=0;
  if(price!=null)for(let i=series.length-1;i>=0;i--){if(series[i].price>price){drop=series[i].price-price;break;}if(series[i].price<price)break;}
  const s30=series.filter(s=>now-s.time<=30*DAY);
  const pts=(s30.length>=2?s30:series).map(s=>s.price);
  const min=pts.length?Math.min(...pts,price??Infinity):price;
  const max=pts.length?Math.max(...pts,price??-Infinity):price;
  const days=ins.days||0;
  const spread=offers.length>=2?offers[offers.length-1].price-offers[0].price:0;
  let v;
  if(price==null)v={k:'pending',t:'PRICE BEING VERIFIED'};
  else if(series.length>=3){
    if(price<=min&&max>min&&days>=7)v={k:'buy',t:`BUY NOW · LOWEST IN ${days} DAYS`};
    else if(drop>0&&(an?.score??0)>=60)v={k:'buy',t:`BUY NOW · JUST DROPPED ${M(drop)}`};
    else if((an?.score??0)>=75)v={k:'buy',t:'BUY NOW · GREAT PRICE'};
    else if((an?.score??50)<45||ins.verdict?.tone==='high')v={k:'wait',t:`WAIT · USUALLY ${M(Math.max(price-min,0))} LESS`};
    else v={k:'fair',t:`FAIR PRICE · ${M(Math.max(price-min,0))} ABOVE LOW`};
  }else if(spread>=Math.max(200,price*.03))v={k:'buy',t:`BUY HERE · SAVE ${M(spread)}`};
  else if(offers.length===1&&Math.max((st.offers||[]).length,b.stores||0)>1)v={k:'fair',t:`ONLY IN STOCK ON ${String(offers[0].name).toUpperCase()}`};
  else v={k:'fair',t:`BEST OF ${Math.max(offers.length,b.stores)} STORES`};
  let chg=null;
  if(price!=null){
    if(drop>0)chg={c:'down',a:`▼ ${M(drop)}`,b:'since last check'};
    else if(v.k==='wait'&&price>min)chg={c:'up',a:`▲ ${M(price-min)}`,b:`above ${days}-day low`};
    else if(sav?.percent)chg={c:an?.real?.tone==='warn'?'warn':'down',a:`${sav.percent}% off`,b:an?.real?.tone==='warn'?'MRP looks inflated':'vs MRP'};
    else if(spread>0)chg={c:'down',a:`${M(spread)} gap`,b:'between stores'};
  }
  const target=price!=null?(v.k==='wait'&&min<price?min:pcRound(price*.95)):null;
  const tipRaw=String(ppDealsCfg?.tips?.[p.id]||ppDealsCfg?.insights?.[p.id]||'').trim();const tci=tipRaw.indexOf(':');const tip=tci>0?tipRaw.slice(tci+1).trim():tipRaw;const tipLabel=tci>0?tipRaw.slice(0,tci).trim():'PricePulse tip';
  const allMin=series.length>=3?series.reduce((a,s)=>s.price<a.price?s:a,series[0]):null;
  const plus=tip?{l:tipLabel,v:tip}:allMin?{l:'Lowest ever',v:`${M(Math.min(allMin.price,price??Infinity))} · ${pcDate(allMin.time)}`}:null;
  return {p,b,price,offers,low,sav,series:(s30.length>=2?s30:series),an,drop,min,max,days,spread,v,chg,target,plus,store:low?.name||'',url:dlOfferUrl(low),stores:Math.max((st.offers||[]).length,b.stores||0),photo:photoOf(p),variant:pcVariant(p)};
}
function pcVariant(p){
  try{const c=typeof ppCatalogProduct==='function'?ppCatalogProduct(p.id):null;const parts=[c?.variant,c?.model_code].filter(Boolean);if(parts.length)return parts.join(' · ');}catch(_){}
  const v=p.card.querySelector('.pp-card-variant')?.textContent?.trim();return v||'';
}
/* V278 (L9): card chart = the product page chart, small: area + STEP line (red / gold / green by height), dashed AVERAGE
   line, gold end dot, "29-day high" label. No axis, no tabs, no hover. */
function pcSpark(d){
  const ser=d.series.map(s=>({time:s.time,price:s.price}));
  if(d.price!=null&&(!ser.length||ser[ser.length-1].price!==d.price))ser.push({time:Date.now(),price:d.price});
  if(ser.length<3)return '';
  const pts=ser.map(s=>s.price);
  const avg=pts.reduce((a,c)=>a+c,0)/pts.length;
  let lo=Math.min(...pts),hi=Math.max(...pts);
  if(hi===lo){hi+=Math.max(1,hi*.01);lo-=Math.max(1,lo*.01);}
  const W=300,Hh=64,T=7,B=5,t0=ser[0].time,t1=Math.max(Date.now(),ser[ser.length-1].time,t0+1);
  const X=t=>((t-t0)/(t1-t0))*W,Y=v=>T+((hi-v)/(hi-lo))*(Hh-T-B);
  let line='';ser.forEach((q,k)=>{const x=X(q.time).toFixed(1),y=Y(q.price).toFixed(1);line+=k?` H${x} V${y}`:`M${x} ${y}`;});line+=` H${W}`;
  const yTop=Y(hi),yBot=Y(lo),yAvg=Y(avg);
  const off=Math.min(.9,Math.max(.1,(yAvg-yTop)/Math.max(1,yBot-yTop))).toFixed(3);
  const gid='pcg'+d.p.id.replace(/[^a-z0-9]/gi,'');
  const lbl=d.v.k==='wait'?`${d.days||30}-day low ${M(Math.min(...pts))}`:`${d.days||30}-day high ${M(Math.max(...pts))}`;
  const lastY=Y(ser[ser.length-1].price);
  return `<div class="ppx-pc-chart pp-xc-mini" aria-label="Price trend, ${H(lbl)}, average ${H(M(Math.round(avg)))}"><svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true"><defs>
    <linearGradient id="${gid}l" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${yTop.toFixed(1)}" y2="${yBot.toFixed(1)}"><stop offset="0" stop-color="#F06A6E"/><stop offset="${off}" stop-color="#E8B954"/><stop offset="1" stop-color="#3DDC97"/></linearGradient>
    <linearGradient id="${gid}a" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${yTop.toFixed(1)}" y2="${Hh}"><stop offset="0" stop-color="#F06A6E" stop-opacity=".2"/><stop offset="${off}" stop-color="#E8B954" stop-opacity=".12"/><stop offset="1" stop-color="#3DDC97" stop-opacity=".02"/></linearGradient></defs>
    <path d="${line} V${Hh} H0 Z" fill="url(#${gid}a)"/>
    <line x1="0" x2="${W}" y1="${yAvg.toFixed(1)}" y2="${yAvg.toFixed(1)}" class="avg" vector-effect="non-scaling-stroke"/>
    <path d="${line}" fill="none" stroke="url(#${gid}l)" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><i style="left:calc(100% - 5px);top:calc(${(lastY/Hh*100).toFixed(2)}% - 5px)"></i><span>${H(lbl)}</span><em class="pp-xc-avg">avg ${H(M(Math.round(avg)))}</em></div>`;
}
function pcLadder(d){
  if(d.offers.length<2)return '';
  const top=d.offers.slice(0,3),base=top[0].price,worst=top[top.length-1].price;
  return `<div class="ppx-pc-ladder">${top.map((o,i)=>{const w=worst>base?100-((o.price-base)/(worst-base))*45:100;return `<div class="ppx-pc-lr${i?'':' is-lo'}"><span class="s">${H(o.name)}</span><span class="bar"><i style="width:${w.toFixed(0)}%"></i></span><span class="pr">${i?(o.price===base?'Same price':`+${M(o.price-base)}`):M(o.price)}</span></div>`;}).join('')}</div>`;
}
const PC_SVG={bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 20h4"/></svg>',
  heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 10.6 19C5.5 14.4 2.5 11.5 2.5 7.8A5.3 5.3 0 0 1 12 4.5a5.3 5.3 0 0 1 9.5 3.3c0 3.7-3 6.6-8.1 11.2Z"/></svg>',
  crown:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 18 5 7l5 5 2-7 2 7 5-5 2 11z"/></svg>',
  cmp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="4" width="7" height="16" rx="2"/><rect x="13.5" y="4" width="7" height="16" rx="2"/></svg>'};
var ppCmpIcon=PC_SVG.cmp;
/* V224: on narrow cards (4 per row) the 'BUY NOW · ' prefix hides via a container query, the rest stays */
function pcVerdictHTML(t){const m=/^(BUY NOW|BUY HERE) · (.+)$/.exec(String(t||''));return m?`<span class="ppx-v-pre">${H(m[1])} · </span>${H(m[2])}`:H(t);}
function pcHTML(d,opts={}){
  const id=d.p.id,eid=encodeURIComponent(id),saved=pcSaved(id),inCmp=pcCmp.includes(id);
  const cat=[catLabel(d.p.category),d.p.brand].filter(Boolean).join(' · ');
  const score=d.an?`<span class="ppx-pc-score" style="--s:${d.an.score}" role="img" aria-label="Deal score ${d.an.score} of 100"><b>${d.an.score}</b><small>SCORE</small></span>`:'';
  const plusOn=dlPlusActive();
  const plus=d.plus?`<a class="ppx-pc-plus${plusOn?' is-open':''}" href="${plusOn?`#/product/${eid}`:'#/plus'}"><span class="c">${PC_SVG.crown}</span><span class="t">${H(d.plus.l)}: <b${plusOn?'':' class="is-lock" aria-hidden="true"'}>${plusOn?H(d.plus.v):'₹••,••• · ••••'}</b></span><span class="u">${plusOn?'Plus':'Unlock · Plus'}</span></a>`:
    (d.price!=null?`<a class="ppx-pc-plus is-pitch" href="#/plus"><span class="c">${PC_SVG.crown}</span><span class="t"><span class="ppx-pc-long">Plus: 3× more price alerts + early sale deals</span><span class="ppx-pc-short">Plus: 3× alerts + early deals</span></span><span class="u">₹99/yr</span></a>`:'');
  const buy=d.url&&d.price!=null&&d.v.k!=='wait'?ppAffiliateUrl(d.url).url:'';
  const main=buy?`<a class="ppx-pc-buy" href="${H(buy)}" target="_blank" rel="sponsored noopener noreferrer" data-product-id="${H(id)}">Buy on ${H(d.store)} <span aria-hidden="true">↗</span></a>`:
    d.target?`<button type="button" class="ppx-pc-buy is-alert" data-pc-alert="${H(id)}" data-pc-target="${d.target}">${PC_SVG.bell}Alert me at ${M(d.target)}</button>`:
    `<a class="ppx-pc-buy is-alert" href="#/product/${eid}">Compare prices →</a>`;
  const lock=opts.locked?`<div class="ppx-pc-lock"><span>${PC_SVG.crown}</span><b>Plus early access</b><small>Opens for everyone ${dlLeft(opts.earlyUntil||0)}</small><a class="ppx-pc-buy" href="#/plus">Unlock with Plus · ₹99/yr</a></div>`:'';
  return `<div class="ppx-pc is-${d.v.k}${opts.locked?' is-locked':''}" data-pc-id="${H(id)}"><div class="ppx-pc-in">
    <div class="ppx-pc-top"><span class="ppx-pc-verdict"><i></i>${pcVerdictHTML(d.v.t)}</span><span class="ppx-pc-icons"><button type="button" class="ppx-pc-ib" data-pc-alert="${H(id)}" ${d.target?`data-pc-target="${d.target}"`:''} aria-label="Price alert for ${H(d.p.name)}">${PC_SVG.bell}</button><button type="button" class="ppx-pc-ib is-heart${saved?' is-on':''}" data-pc-heart="${H(id)}" aria-pressed="${saved}" aria-label="${saved?'Remove from':'Add to'} wishlist">${PC_SVG.heart}</button></span></div>
    <a class="ppx-pc-prod" href="#/product/${eid}"><span class="ph ${ppxGlobalImg(d.p.id,d.photo).surface}">${ppxGlobalImg(d.p.id,d.photo).img}</span><span class="nm"><small>${H(cat)}</small><b>${H(d.p.name)}</b>${d.variant?`<em>${H(d.variant)}</em>`:''}</span>${score}</a>
    ${d.price!=null?`<div class="ppx-pc-price"><div><b>${M(d.price)}</b>${d.sav?.mrp?`<s>${M(d.sav.mrp)}</s>`:''}${cbSpan(d.store,d.price,d.p.category,'tag',d.p.id)}</div>${d.chg?`<div class="chg is-${d.chg.c}">${H(d.chg.a)}<small>${H(d.chg.b)}</small></div>`:''}</div>`:`<div class="ppx-pc-pending"><i></i>We are checking ${d.stores} ${d.stores===1?'store':'stores'} for this product</div>`}
    ${opts.meter?(()=>{const m=ppMeterHTML(d.price,lowestSeries(d.p.id),d.store,'is-card');return m?`<div class="ppx-pc-meter">${m}</div>`:'';})():pcSpark(d)}${pcLadder(d)}${opts.withPlus?plus:''}
    <div class="ppx-pc-btns">${main}<a class="ppx-pc-cmp" href="#/product/${eid}">Details</a></div>
    <div class="ppx-pc-meta"><span><i></i>${d.price!=null?(d.stores>d.offers.length&&d.offers.length?`${d.stores} stores · ${d.stores-d.offers.length} out of stock`:`${d.offers.length||d.stores} ${(d.offers.length||d.stores)===1?'store':'stores'} verified`):`${d.stores} ${d.stores===1?'store':'stores'} listed`}${d.offers.length>3?` · <b class="ppx-pc-more">+${d.offers.length-3} more</b>`:''}</span>${d.price!=null?`<button type="button" class="ppx-pc-add${inCmp?' is-on':''}" data-pc-cmp="${H(id)}" aria-pressed="${inCmp}">${PC_SVG.cmp}${inCmp?'Added to compare':'Add to compare'}</button>`:''}</div>
  </div>${lock}</div>`;
}
window.ppPremiumCardHTML=p=>pcHTML(pcData(p));
/* Home: render inside each existing .deal-card (filters, search and wishlist keep working) */
function pcMountHome(){
  const grid=document.getElementById('dealGrid');if(!grid)return;
  productIndex().forEach(p=>{
    const card=p.card;if(!card||!grid.contains(card))return;
    card.classList.add('ppx-pc-host');
    let slot=card.querySelector(':scope > .ppx-pc-slot');
    if(!slot){slot=document.createElement('div');slot.className='ppx-pc-slot';card.appendChild(slot);}
    const d=pcData(p);
    const sig=[d.price,d.v.t,d.an?.score,d.offers.map(o=>o.name+o.price).join(','),pcSaved(p.id),pcCmp.includes(p.id),d.plus?.v,dlPlusActive(),d.photo].join('|');
    if(slot.dataset.sig===sig)return;
    slot.dataset.sig=sig;slot.innerHTML=pcHTML(d,{}); /* V276 (P9): same card as the Deals page, no High/Low slider (it stays on the product page) */
  });
}
function pcDecorateSection(){
  const sec=document.getElementById('deals');if(!sec||sec.dataset.pcDone)return;sec.dataset.pcDone='1';
  sec.classList.add('ppx-pc-section');
  const t=sec.querySelector('.deals-title');
  const h2=t?.querySelector('h2'),eb=t?.querySelector('.eyebrow');
  if(h2)h2.innerHTML='Popular deals, <span class="ppx-gold-text">decoded</span>';
  if(eb)eb.innerHTML='<i class="ppx-pc-live" aria-hidden="true"></i>LIVE PRICE CHECK';
  if(h2&&!t.querySelector('.ppx-pc-sub')){const s=document.createElement('p');s.className='ppx-pc-sub';s.textContent='Every card tells you: buy now or wait, and which store is really cheapest.';h2.after(s);}
}
function pcRefreshLive(){const live=dxLiveStats();const eb=document.querySelector('#deals .deals-title .eyebrow');if(eb)eb.innerHTML=`<i class="ppx-pc-live" aria-hidden="true"></i>LIVE${live.ago?` · CHECKED ${live.ago.toUpperCase()} AGO`:' PRICE CHECK'}`;}
function pcRender(){try{pcDecorateSection();pcMountHome();pcRefreshLive();pcTray();}catch(e){console.warn('PricePulse cards',e);}}
pcRender();setTimeout(pcRender,1500);setTimeout(pcRender,4500);
if(typeof window.ppUpdateHomeCardPrices==='function'){const o=window.ppUpdateHomeCardPrices;window.ppUpdateHomeCardPrices=function(){const r=o.apply(this,arguments);pcRender();return r;};}
document.querySelectorAll('#dealGrid .heart').forEach(h=>new MutationObserver(()=>{pcMountHome();document.querySelectorAll(`.ppx-pc [data-pc-heart="${CSS.escape(h.dataset.id||'')}"]`).forEach(b=>{const on=h.classList.contains('saved');b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));});}).observe(h,{attributes:true,attributeFilter:['class']}));
/* actions (home + pages) */
async function pcAlert(id,target){
  if(typeof currentUser==='undefined'||!currentUser||(typeof profileComplete==='function'&&!profileComplete(currentProfile))){
    if(typeof setPendingAuthAction==='function')setPendingAuthAction({type:'deal-alert',productId:id});
    if(typeof currentUser!=='undefined'&&currentUser&&typeof renderProfileForm==='function')renderProfileForm(currentUser.email||'',currentProfile);
    else if(typeof renderAuthStart==='function')renderAuthStart();
    return;
  }
  const existing=typeof ppFindDealAlertForProduct==='function'?ppFindDealAlertForProduct(id):null;
  if(!existing&&typeof ppDealAlertAtLimit==='function'&&ppDealAlertAtLimit()){if(typeof ppDealAlertLimitUpsell==='function')ppDealAlertLimitUpsell();return;}
  if(typeof renderDealAlertEditor==='function')await renderDealAlertEditor(id,'card');
  const inp=document.querySelector('#dealAlertForm input[name="target"]');
  if(inp&&!inp.value&&target){inp.value=String(target);inp.dispatchEvent(new Event('input',{bubbles:true}));}
}
function pcToggleCmp(id){
  const i=pcCmp.indexOf(id);
  if(i>=0)pcCmp.splice(i,1);
  else{
    if(pcCmp.length>=3){if(typeof showToast==='function')showToast('You can compare up to 3 products');return;}
    {const pp=productIndex().find(x=>x.id===id);let ok=false;try{ok=!!pp&&Number.isFinite(bestPrice(pp).price);}catch(_){}
     if(!ok){if(typeof showToast==='function')showToast('Compare opens once this product has a verified price');return;}}
    /* V228: compare within one category (a laptop next to a sunscreen tells nobody anything) */
    const me=productIndex().find(p=>p.id===id),first=pcCmp.length?productIndex().find(p=>p.id===pcCmp[0]):null;
    if(me&&first&&me.category&&first.category&&me.category!==first.category){
      if(typeof showToast==='function')showToast(`Compare one category at a time. Close the compare bar (×) to switch to ${catLabel(me.category)}.`);
      document.getElementById('ppxCmpTray')?.classList.remove('is-shake');void document.getElementById('ppxCmpTray')?.offsetWidth;document.getElementById('ppxCmpTray')?.classList.add('is-shake');
      return;
    }
    pcCmp.push(id);
  }
  pcCmpSet(pcCmp);
  document.querySelectorAll(`[data-pc-cmp="${CSS.escape(id)}"]`).forEach(b=>{const on=pcCmp.includes(id);b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));
    const st=b.dataset.cmpStyle;
    if(st==='mini'){b.setAttribute('aria-label',`${on?'Remove from':'Add to'} compare`);b.title=on?'Added to compare':'Add to compare';}
    else if(st==='pp'){b.innerHTML=`${PC_SVG.cmp}<span>${on?'Added to compare':'Compare'}</span>`;}
    else b.innerHTML=`${PC_SVG.cmp}${on?'Added to compare':'Add to compare'}`;});
  document.querySelectorAll('.ppx-pc-slot').forEach(s=>s.dataset.sig='');
  if(document.body.dataset.ppPage==='compare'){location.hash=pcCmp.length?`#/compare/${encodeURIComponent(pcCmp.join(','))}`:'#/compare/';return;}
  pcTray();
}
window.ppCmpHas=id=>pcCmp.includes(id);
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.ppx-mini-cmp')){e.preventDefault();e.stopPropagation();pcToggleCmp(e.target.dataset.pcCmp);}},true);
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-pc-alert]');if(a){e.preventDefault();e.stopPropagation();pcAlert(a.dataset.pcAlert,Number(a.dataset.pcTarget)||null);return;}
  const h=e.target.closest('[data-pc-heart]');if(h){e.preventDefault();e.stopPropagation();const orig=document.querySelector(`.deal-card .heart[data-id="${CSS.escape(h.dataset.pcHeart)}"]`);if(orig)orig.click();return;}
  const c=e.target.closest('[data-pc-cmp]');if(c){e.preventDefault();e.stopPropagation();pcToggleCmp(c.dataset.pcCmp);return;}
  if(e.target.closest('[data-pc-tray-clear]')){pcCmp=[];pcCmpSet(pcCmp);document.querySelectorAll('.ppx-pc-slot').forEach(s=>s.dataset.sig='');
    document.querySelectorAll('[data-pc-cmp].is-on').forEach(b=>{b.classList.remove('is-on');b.setAttribute('aria-pressed','false');const st=b.dataset.cmpStyle;if(st==='mini'){b.title='Add to compare';}else if(st==='pp'){b.innerHTML=`${PC_SVG.cmp}<span>Compare</span>`;}else b.innerHTML=`${PC_SVG.cmp}Add to compare`;});
    pcRender();if(document.body.dataset.ppPage==='deals'){const y=window.scrollY;routes.deals();window.scrollTo({top:y,behavior:'instant'});}pcTray();return;}
  const x=e.target.closest('[data-pc-tray-x]');if(x){pcToggleCmp(x.dataset.pcTrayX);return;}
},true);
/* compare tray + side-by-side page */
function pcTray(){
  let tray=document.getElementById('ppxCmpTray');
  const items=pcCmp.map(id=>productIndex().find(p=>p.id===id)).filter(Boolean);
  if(items.length!==pcCmp.length){pcCmp=items.map(p=>p.id);pcCmpSet(pcCmp);}
  const showTray=!!items.length&&document.body.dataset.ppPage!=='compare';
  document.body.classList.toggle('has-cmp-tray',showTray);
  if(!showTray){tray?.remove();return;}
  if(!tray){tray=document.createElement('div');tray.id='ppxCmpTray';tray.className='ppx-cmp-tray';tray.setAttribute('role','region');tray.setAttribute('aria-label','Compare tray');document.body.appendChild(tray);}
  tray.innerHTML=`<div class="ppx-cmp-in"><span class="ppx-cmp-l">${PC_SVG.cmp}<b>Compare</b><small>${items.length}/3</small></span><div class="ppx-cmp-items">${items.map(p=>`<span class="ppx-cmp-it">${photoOf(p)?`<img src="${H(photoOf(p))}" alt="">`:''}<em>${H(p.name)}</em><button type="button" data-pc-tray-x="${H(p.id)}" aria-label="Remove ${H(p.name)}">×</button></span>`).join('')}${items.length<3?`<span class="ppx-cmp-slot" title="${items[0].category?`Add one more from ${H(catLabel(items[0].category))}`:'Add one more'}">+ Add one</span>`:''}</div><a class="ppx-cmp-go${items.length<2?' is-off':''}" href="${items.length<2?'#deals':`#/compare/${encodeURIComponent(items.map(p=>p.id).join(','))}`}" ${items.length<2?'aria-disabled="true"':''}>${items.length<2?'Pick 1 more':'Compare side by side →'}</a><button type="button" class="ppx-cmp-close" data-pc-tray-clear aria-label="Close compare and remove all">×</button></div>`;
  /* V228: a little bounce + count flash when something is added */
  const prevN=Number(tray.dataset.n||0);tray.dataset.n=String(items.length);
  if(items.length>prevN){tray.classList.remove('is-bump');void tray.offsetWidth;tray.classList.add('is-bump');}
}
window.addEventListener('hashchange',()=>setTimeout(pcTray,30));
/* V277 (P18): Compare page panel buttons */
document.addEventListener('click',e=>{
  if(e.target.closest&&e.target.closest('[data-pp-cmp-clear]')){setTimeout(()=>{location.hash='#/compare/';},0);return;}
  if(e.target.closest&&e.target.closest('[data-pp-cmp-add]')){document.getElementById('ppSearchTop')?.click();}
});
routes.compare=(param)=>{
  const ids=String(param||'').split(',').map(s=>s.trim()).filter(Boolean).slice(0,3);
  const ps=ids.map(id=>productIndex().find(p=>p.id===id)).filter(Boolean);
  const ds=ps.map(pcData);
  const best=(f,lowWins=true)=>{const vals=ds.map(f).filter(Number.isFinite);if(vals.length<2)return null;return lowWins?Math.min(...vals):Math.max(...vals);};
  const bp=best(d=>d.price),bs=best(d=>d.an?.score,false),bl=best(d=>d.series.length>=3?d.min:NaN);
  const row=(label,cells)=>`<div class="ppx-cmpx-row"><span class="ppx-cmpx-h">${label}</span>${cells.join('')}</div>`;
  const cell=(html,win)=>`<span class="ppx-cmpx-c${win?' is-win':''}">${html}${win?'<em>Best</em>':''}</span>`;
  const body=ds.length<2?`<div class="ppx-dl-empty"><b>Pick at least 2 products</b><p>Use "Add to compare" on any deal card.</p><a class="ppx-btn ppx-btn-primary" href="#deals" data-ppx-action="home">Back to deals</a></div>`:
  `<div class="ppx-cmpx" style="--n:${ds.length}">
    ${row('',ds.map(d=>`<span class="ppx-cmpx-c ppx-cmpx-prod"><a href="#/product/${encodeURIComponent(d.p.id)}"><span class="ph">${d.photo?`<img src="${H(d.photo)}" alt="">`:''}</span><b>${H(d.p.name)}</b></a><button type="button" class="ppx-cmpx-x" data-pc-tray-x="${H(d.p.id)}">Remove</button></span>`))}
    ${row('Best price',ds.map(d=>cell(d.price!=null?`<b class="big">${M(d.price)}</b>`:'<span class="mut">Being verified</span>',bp!=null&&d.price===bp)))}
    ${row('Cheapest at',ds.map(d=>cell(d.store?H(d.store):'<span class="mut">—</span>')))}
    ${cbRates&&ds.some(d=>cbAmount(d.store,d.price,d.p.category,d.p))?row('Cashback',ds.map(d=>{const a=cbAmount(d.store,d.price,d.p.category,d.p);return cell(a?`<span class="pp-cb pp-cb-tag is-on" data-done="1">${CB_COIN}<b>Earn up to ${cbMoney(a)}</b></span>`:'<span class="mut">—</span>');})):''}
    ${row('Verdict',ds.map(d=>cell(`<span class="ppx-cmpx-v is-${d.v.k}">${H(d.v.t)}</span>`)))}
    ${row('Deal Score',ds.map(d=>cell(d.an?`<b>${d.an.score}</b>/100`:'<span class="mut">Needs more history</span>',bs!=null&&d.an?.score===bs)))}
    ${row('30-day low',ds.map(d=>cell(d.series.length>=3?M(d.min):'<span class="mut">—</span>',bl!=null&&d.series.length>=3&&d.min===bl)))}
    ${row('Stores checked',ds.map(d=>cell(String(d.stores))))}
    ${row('Price gap',ds.map(d=>cell(d.spread?`${M(d.spread)} between stores`:'<span class="mut">—</span>')))}
    ${row('',ds.map(d=>{const u=d.url&&d.price!=null?ppAffiliateUrl(d.url).url:'';return `<span class="ppx-cmpx-c">${u?`<a class="ppx-pc-buy" href="${H(u)}" target="_blank" rel="sponsored noopener noreferrer" data-product-id="${H(d.p.id)}">Buy on ${H(d.store)} ↗</a>`:`<a class="ppx-pc-buy is-alert" href="#/product/${encodeURIComponent(d.p.id)}">See details</a>`}</span>`;}))}
  </div>`;
  showPage('compare',`<div class="ppx-product ppx-list-page container ppx-compare-page">${crumbs('Compare')}<header class="ppx-cmpx-hero pp-onebar"><h1>Which one should you buy?</h1><div class="pp-ob-stats"><span><i class="ppx-dx-dot" aria-hidden="true"></i><b>${ds.length}</b> of 3 products</span><span>Verified prices · Deal Score · price history</span></div></header><div class="pp-panel pp-cmp-panel"><span class="pp-panel-note"><b>${ds.length}</b> of 3 products</span><span class="pp-panel-acts">${ds.length<3?`<button type="button" class="pp-pbtn is-go" data-pp-cmp-add>+ Add product</button>`:''}<a class="pp-pbtn" href="#/deals">Browse deals</a>${ds.length?`<button type="button" class="pp-pbtn" data-pc-tray-clear data-pp-cmp-clear>Clear all</button>`:''}</span></div>${body}</div>`);
  document.title='Compare | PricePulse';
  pcTray();
};
/* Deals page uses the same premium card */
dlCard=function(r,{locked=false}={}){return pcHTML(pcData(r.p),{locked,earlyUntil:r.earlyUntil});};

/* =====================================================================
   V221 — Products from Admin show on the site by themselves
   - Every active product in Admin (pp_catalog_products + store listings)
     gets a Home card, product page, filters, search and wishlist,
     without editing index.html. Same for new brands and stores.
   - Home "Popular deals": top 6 only (+ "See all" to Today's Deals);
     below it: "Price dropped" row and "Best in <category>" rows.
   ===================================================================== */
const PP_STORE_ORDER=['amazon','flipkart','croma','reliance-digital','vijay-sales','tata-cliq','myntra','ajio','nykaa','purplle','jiomart','meesho'];
const ppKey=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function ccPlaceholder(cat){
  const svg=(typeof CM_ART!=='undefined'&&(CM_ART[cat]||CM_ART.electronics))||'';
  return svg?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ')):'';
}
function ccCard(p,brand,listings){
  const ls=[...listings].sort((a,b)=>{const ia=PP_STORE_ORDER.indexOf(a.store_slug),ib=PP_STORE_ORDER.indexOf(b.store_slug);return (ia<0?99:ia)-(ib<0?99:ib);});
  const url=l=>String(l.affiliate_url||l.direct_url||'').trim();
  const nm=l=>String(l.store?.name||l.store_slug||'').trim();
  const amz=ls.find(l=>l.store_slug==='amazon'&&url(l)),fk=ls.find(l=>l.store_slug==='flipkart'&&url(l));
  const rest=ls.filter(l=>l!==amz&&l!==fk&&url(l)).slice(0,2);
  const cat=String(p.category||'electronics').toLowerCase();
  const art=document.createElement('article');
  art.className='deal-card';art.dataset.ppAuto='1';
  art.dataset.brand=String(p.brand_slug||'');art.dataset.category=cat;
  art.dataset.stores=ls.map(l=>ppKey(l.store?.name||l.store_slug)).join(' ');
  art.dataset.search=[p.name,brand?.name,p.model_code,p.variant,cat,catLabel(cat),...ls.map(nm)].filter(Boolean).join(' ').toLowerCase();
  const img=p.image_url||p.live_image_url||'';
  art.innerHTML=`<div class="card-top"><img alt="${H(brand?.name||'')} logo" class="product-brand-logo pp-card-brand-box" src="${H(brand?.logo_url||'')}"${brand?.logo_url?'':' hidden'}/><span class="discount amazon-badge">COMPARE &amp; SAVE</span><button class="heart" data-id="${H(p.product_id)}" type="button">♡</button></div>
    <div class="product-media product-media-real"><img alt="${H(p.name)}" class="product-photo" decoding="async" loading="lazy" src="${H(img||ccPlaceholder(cat))}"${img?'':' data-pp-placeholder="1"'}/></div>
    <h3>${H(p.name)}</h3><div class="pp-card-rating"></div><div class="pp-card-meta"></div><div class="pp-card-variant">${H([p.variant,p.model_code].filter(Boolean).join(' · '))}</div>
    <p class="store-count">${H(ls.map(nm).slice(0,4).join(' + '))} offers</p><div class="pp-card-price is-pending"></div><p class="price live-price-label">Check latest price</p><p class="demo-label">Check latest price and availability on the retailer site.</p>`;
  const btn=document.createElement('button');btn.className='compare-btn';btn.type='button';btn.textContent='Compare Offers';
  const ds=btn.dataset;ds.product=p.name;ds.price='Check latest price';
  if(amz)ds.amazonUrl=url(amz);if(fk)ds.flipkartUrl=url(fk);
  if(rest[0]){ds.thirdStore=nm(rest[0]);ds.thirdUrl=url(rest[0]);}
  if(rest[1]){ds.fourthStore=nm(rest[1]);ds.fourthUrl=url(rest[1]);}
  art.appendChild(btn);
  return art;
}
function ccBindCard(card){
  const heart=card.querySelector('.heart');
  heart?.addEventListener('click',()=>{
    const id=heart.dataset.id;if(!id)return;
    if(typeof currentUser==='undefined'||!currentUser||(typeof profileComplete==='function'&&!profileComplete(currentProfile))){
      if(typeof setPendingAuthAction==='function')setPendingAuthAction({type:'wishlist-toggle',id});
      if(typeof currentUser!=='undefined'&&currentUser&&typeof renderProfileForm==='function')renderProfileForm(currentUser.email||'',currentProfile);
      else if(typeof renderAuthStart==='function')renderAuthStart();
      return;
    }
    if(typeof toggleWishlistItem==='function')void toggleWishlistItem(heart);
  });
  card.querySelector('.compare-btn')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(typeof ppOpenComparisonFromFindBestPrice==='function')void ppOpenComparisonFromFindBestPrice(e.currentTarget);});
}
function ccFilterTo(kind,value,label){
  if(kind==='brand'){if(typeof resetStoreFilter==='function')resetStoreFilter();try{activeBrand=value;}catch(_){}if(typeof setBrandActive==='function')setBrandActive(value);}
  else{if(typeof resetBrandFilter==='function')resetBrandFilter();try{activeStore=value;}catch(_){}if(typeof setStoreActive==='function')setStoreActive(value);}
  if(headerInput)headerInput.value='';
  if(typeof setTopCategoryActive==='function')setTopCategoryActive('');
  document.querySelectorAll('.deal-tabs button').forEach(t=>t.classList.toggle('active',t.dataset.filter==='all'));
  if(typeof filterProducts==='function')filterProducts('all');
  document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'});
  if(typeof showToast==='function')showToast(kind==='brand'?`Showing ${label} deals`:`Showing products available on ${label}`);
}
function ccBrandCard(b,cat){
  const el=document.createElement('button');el.type='button';el.className='brand-card discovery-card';el.dataset.brand=b.slug;el.dataset.label=b.name;el.dataset.ppAuto='1';
  el.setAttribute('aria-label',`Explore ${b.name} deals`);
  el.innerHTML=`<span class="brand-logo-panel discovery-logo">${b.logo_url?`<img alt="${H(b.name)} logo" class="brand-real-logo" src="${H(b.logo_url)}"/>`:`<b class="pp-brand-text">${H(b.name)}</b>`}</span><span class="brand-category">${H(catLabel(cat||''))}</span><span class="card-action">Explore Deals <span>→</span></span>`;
  el.addEventListener('click',()=>ccFilterTo('brand',b.slug,b.name));
  return el;
}
function ccStoreCard(s){
  const key=ppKey(s.name);
  const el=document.createElement('button');el.type='button';el.className='store-card discovery-card store-discovery-card';el.dataset.store=key;el.dataset.label=s.name;el.dataset.ppAuto='1';
  el.setAttribute('aria-label',`Compare products available on ${s.name}`);
  const logo=(typeof EXTRA_STORE_LOGOS!=='undefined'&&EXTRA_STORE_LOGOS[s.name])||s.logo_url||'';
  el.innerHTML=`<span class="store-logo-panel discovery-logo">${logo?`<img alt="${H(s.name)} logo" class="store-real-logo" src="${H(logo)}"/>`:`<b class="pp-brand-text">${H(s.name)}</b>`}</span><span class="card-action">Compare Prices <span>→</span></span>`;
  el.addEventListener('click',()=>ccFilterTo('store',key,s.name));
  return el;
}
function ccCreate({products=[],brands=[],stores=[],listings=[]}={}){
  const grid=document.getElementById('dealGrid');if(!grid)return 0;
  const brandMap={},storeMap={},lmap={};
  (brands||[]).forEach(b=>{if(b?.slug)brandMap[b.slug]=b;});(stores||[]).forEach(s=>{if(s?.slug)storeMap[s.slug]=s;});
  (listings||[]).forEach(l=>{if(!l?.product_id||l.active===false)return;if(!['active','out_of_stock'].includes(String(l.listing_status||'active')))return;(lmap[l.product_id]=lmap[l.product_id]||[]).push({...l,store:storeMap[l.store_slug]||null});});
  let added=0;
  (products||[]).forEach(p=>{
    if(!p?.product_id||!['active','tracking'].includes(String(p.status||'active')))return;
    if(document.querySelector(`.deal-card .heart[data-id="${CSS.escape(p.product_id)}"]`))return;
    const ls=lmap[p.product_id]||[];if(!ls.length)return;
    const card=ccCard(p,brandMap[p.brand_slug],ls);
    grid.appendChild(card);ccBindCard(card);
    try{if(Array.isArray(cards))cards.push(card);}catch(_){}
    added++;
  });
  const bg=document.getElementById('brandGrid');
  if(bg){const used=new Set([...document.querySelectorAll('#dealGrid .deal-card')].map(c=>c.dataset.brand));
    (brands||[]).forEach(b=>{if(!b?.slug||b.active===false||!used.has(b.slug)||bg.querySelector(`[data-brand="${CSS.escape(b.slug)}"]`))return;const cat=document.querySelector(`#dealGrid .deal-card[data-brand="${CSS.escape(b.slug)}"]`)?.dataset.category||'';bg.appendChild(ccBrandCard(b,cat));});}
  const sg=document.getElementById('storeGrid');
  if(sg){(stores||[]).forEach(s=>{if(!s?.slug||s.active===false)return;const key=ppKey(s.name);if(sg.querySelector(`[data-store="${CSS.escape(key)}"]`))return;if(!document.querySelector(`#dealGrid .deal-card[data-stores~="${CSS.escape(key)}"]`))return;sg.appendChild(ccStoreCard(s));});}
  if(added){
    try{typeof syncWishlist==='function'&&syncWishlist();}catch(_){}
    try{if(typeof tabCounts==='function')tabCounts();}catch(_){}
  }
  return added;
}
window.ppCatalogCardsCreate=ccCreate;
if(typeof ppApplyCatalogData==='function'){
  const origApply=ppApplyCatalogData;
  /* V235: local logos for brands/stores (tiles, product cards, product-page badge all read logo_url from this data) */
  const PP_BRAND_LOGOS={'a-o-smith':'a-o-smith.png','adidas':'adidas.svg','apple':'apple.svg','asus':'asus.svg','atomberg':'atomberg.svg','campus':'campus.svg','casio':'casio.svg','cetaphil':'cetaphil.png','hp':'hp.svg','hawkins':'hawkins.png','jbl':'jbl.svg','kent':'kent.svg','lg':'lg.svg','minimalist':'minimalist.png','noise':'noise.png','nothing':'nothing.svg','oppo':'oppo.svg','pigeon':'pigeon.svg','prestige':'prestige.svg','sony':'sony.svg','the-derma-co':'the-derma-co.png','whirlpool':'whirlpool.svg','xiaomi':'xiaomi.svg','realme':'realme.svg','vivo':'vivo.svg'};
  const PP_STORE_LOGOS={'vijay-sales':'vijay-sales.svg','nykaa':'nykaa.svg','purplle':'purplle.svg','shopsy':'shopsy.svg','adidas':'adidas.svg'};
  const ppLocalLogos=data=>{
    if(!data)return data;
    const fix=(rows,map,dir)=>(rows||[]).map(r=>{const f=r&&map[String(r.slug||'')];return f?{...r,logo_url:`logos/${dir}/${f}`}:r;});
    return {...data,brands:fix(data.brands,PP_BRAND_LOGOS,'brands'),stores:fix(data.stores,PP_STORE_LOGOS,'stores')};
  };
  ppApplyCatalogData=function(data){
    data=ppLocalLogos(data);arguments[0]=data;
    let n=0;try{n=ccCreate(data||{});}catch(e){console.warn('PricePulse catalog cards',e);}
    const r=origApply.apply(this,arguments);
    if(n){try{typeof ppUpdateHomeCardPrices==='function'&&ppUpdateHomeCardPrices();}catch(_){}try{renderDiscover();}catch(_){}try{homeLayout();}catch(_){}}
    return r;
  };
}

/* ---------- Home: top deals + "See all" + Deal Radar (V224: 8 on laptop/desktop = 4+4, else 6) ---------- */
function homeTop(){return window.innerWidth>=1200?8:6;}
function hlRank(p){
  const cfg=(typeof ppDealsCfg!=='undefined'&&ppDealsCfg)||{};
  const fi=(cfg.featured||[]).indexOf(p.id);
  let d=null;try{d=pcData(p);}catch(_){}
  const k=d?.v?.k;
  return (fi>=0?1e7-fi*1e5:0)+(d?.price!=null?1e6:0)+(k==='buy'?5e5:k==='fair'?2e5:0)+((d?.an?.score)||0)*1e3+(d?.drop||0)/10+(p.card.querySelector('[data-pp-placeholder]')?0:100);
}
function hlFiltersQuiet(){
  let q='';try{q=String((headerInput&&headerInput.value)||'').trim();}catch(_){}
  let b='all',s='all';try{b=activeBrand;s=activeStore;}catch(_){}
  return !q&&b==='all'&&s==='all';
}
let hlCat='all';
function hlApplyCap(){
  const grid=document.getElementById('dealGrid');if(!grid)return;
  const ranked=productIndex().map(p=>({p,r:hlRank(p)})).sort((a,b)=>b.r-a.r);
  const ordBefore=[...grid.children].map(c=>c.querySelector('.heart')?.dataset.id||'').join('|');
  ranked.forEach(({p})=>{if(p.card.parentElement===grid)grid.appendChild(p.card);});
  const reordered=ordBefore!==[...grid.children].map(c=>c.querySelector('.heart')?.dataset.id||'').join('|');
  const quiet=hlFiltersQuiet();
  let shown=0;
  const TOP=homeTop();
  ranked.forEach(({p})=>{const c=p.card;if(!c.hidden&&quiet){shown++;c.toggleAttribute('data-pp-cap',shown>TOP);}else c.removeAttribute('data-pp-cap');});
  const visible=ranked.filter(({p})=>!p.card.hidden).length;
  let more=document.getElementById('ppxSeeAll');
  if(quiet&&visible>TOP){
    if(!more){more=document.createElement('div');more.id='ppxSeeAll';more.className='ppx-seeall';grid.after(more);}
    const cat=hlCat||'all';
    let nDl=visible;try{nDl=dlRows().filter(r=>Number.isFinite(r.price)&&(cat==='all'||r.cat===cat)).length;}catch(_){} /* V226: Deals page shows priced products only */
    const label=cat==='all'?(nDl?`See all ${nDl} deals, filters & price drops`:`See all deals, filters & price drops`):(nDl?`See all ${nDl} ${catLabel(cat)} deals`:`See all deals`);
    more.innerHTML=`<a href="#/deals" data-see-cat="${H(cat)}">${H(label)} <span aria-hidden="true">→</span></a><small>Showing the top ${TOP} by Deal Score and price drop</small>`;
  }else more?.remove();
  /* V224: phone swipe — only while the home list is capped (no search / brand / store filter) */
  const swipe=quiet&&visible>1;grid.toggleAttribute('data-pp-swipe',swipe);
  if(swipe&&reordered)requestAnimationFrame(()=>{grid.scrollLeft=0;});
  hlDots(grid,swipe);requestAnimationFrame(()=>document.getElementById('ppxSwipeDots')?.__paint?.());
}
function hlDots(grid,on){
  let dots=document.getElementById('ppxSwipeDots');
  const cards=[...grid.children].filter(c=>c.classList.contains('deal-card')&&!c.hidden&&!c.hasAttribute('data-pp-cap'));
  if(!on||cards.length<2){dots?.remove();return;}
  if(!dots){dots=document.createElement('div');dots.id='ppxSwipeDots';dots.className='ppx-swipe-dots';dots.setAttribute('aria-hidden','true');grid.after(dots);}
  const paint=()=>{const w=cards[0].getBoundingClientRect().width+12;const i=Math.min(cards.length-1,Math.max(0,Math.round(grid.scrollLeft/(w||1))));dots.innerHTML=cards.map((_,k)=>`<i class="${k===i?'is-on':''}"></i>`).join('')+`<small>${i+1} / ${cards.length}</small>`;};
  paint();if(!grid.__ppDots){grid.__ppDots=1;grid.addEventListener('scroll',()=>{cancelAnimationFrame(grid.__ppRaf);grid.__ppRaf=requestAnimationFrame(()=>{const d=document.getElementById('ppxSwipeDots');if(d&&d.__paint)d.__paint();});},{passive:true});}
  dots.__paint=paint;
}
document.addEventListener('click',e=>{const a=e.target.closest('[data-see-cat]');if(!a)return;try{dlState.cat=a.dataset.seeCat||'all';}catch(_){}},true);
/* V277 (P26): "View all" of a Deal Radar lens opens Live Deals with that lens */
document.addEventListener('click',e=>{const a=e.target.closest('[data-see-lens]');if(!a)return;try{const l=a.dataset.seeLens;dlState.cat='all';dlState.store=l==='store'?(a.dataset.seeStore||''):'';dlState.sort=l==='store'?'score':'save';}catch(_){}},true);
if(typeof filterProducts==='function'){
  const origFilter=filterProducts;
  filterProducts=function(category){hlCat=category||'all';const r=origFilter.apply(this,arguments);try{const g=document.getElementById('dealGrid');if(g)g.scrollLeft=0;}catch(_){}try{hlApplyCap();hlRows();}catch(_){}return r;};
}
function hlMini(p,d,o={}){
  const k=d?.v?.k||'pending';
  const lbl=k==='buy'?'Buy now':k==='wait'?'Wait':k==='fair'?'Fair price':'Verifying';
  const sub=o.sub||(d?.price!=null?(d.drop>0?`▼ ${M(d.drop)}`:d.sav?.percent?`${d.sav.percent}% off`:`${d.offers.length} stores`):`${d?.stores||0} stores`);
  return `<a class="ppx-mini" href="#/product/${encodeURIComponent(p.id)}"><span class="ph ${ppxGlobalImg(p.id,d?.photo).surface}">${ppxGlobalImg(p.id,d?.photo).img}</span>${p.brand?`<span class="br">${H(p.brand)}</span>`:''}<span class="nm">${H(p.name)}</span><span class="pr${d?.price!=null?'':' is-soon'}">${d?.price!=null?M(Number.isFinite(o.price)?o.price:d.price):'Price soon'}${o.at?`<small class="at">at ${H(o.at)}</small>`:''}</span><span class="ft"><i class="is-${k}"></i>${lbl}<em>${H(sub)}</em></span>${d?.price!=null?(()=>{const on=pcCmp.includes(p.id);return `<span class="ppx-mini-cmp${on?' is-on':''}" role="button" tabindex="0" data-pc-cmp="${H(p.id)}" data-cmp-style="mini" aria-pressed="${on}" aria-label="${on?'Remove from':'Add to'} compare" title="${on?'Added to compare':'Add to compare'}">${PC_SVG.cmp}</span>`;})():''}<span class="ppx-mini-go" aria-hidden="true">→</span></a>`;
}
function hlRows(){
  const deals=document.getElementById('deals');if(!deals)return;
  let host=document.getElementById('ppxRows');
  if(!host){host=document.createElement('section');host.id='ppxRows';host.className='ppx-rows';deals.after(host);}
  const quiet=hlFiltersQuiet();
  const top=new Set([...document.querySelectorAll('#dealGrid .deal-card:not([data-pp-cap])')].filter(c=>!c.hidden).map(c=>c.querySelector('.heart')?.dataset.id));
  const all=productIndex().map(p=>{let d=null;try{d=pcData(p);}catch(_){}return {p,d};});
  const rows=[];let grid=null;
  if(quiet&&hlCat==='all'){
    /* V277 (P26): Deal Radar = "lens" sections instead of one row per category. One line of the same small cards each,
       "View all" opens Live Deals with that lens. A section shows only with 3+ VERIFIED products, so the list grows
       by itself as the catalog grows. Max 5 sections. Biggest total saving gets the featured box. */
    const ver=all.filter(x=>x.d&&x.d.price!=null&&!x.p.card.hidden);
    const pref=(a,b)=>(top.has(a.p.id)-top.has(b.p.id)); /* products not already in Popular deals first */
    const kit=window.ppOffersKit;
    /* V278 (L3): ONE store for price + offers + cashback. For every in-stock store: discount from MRP at that store's price,
       that store's coupons / bank offers / card rewards, that store's cashback (base = its listed price). The store where you
       pay the least wins (= the biggest total saving, because MRP is the same). */
    const tot=x=>{
      const mrp=Number(x.d.sav?.mrp)||0;let best=null;
      for(const o of (x.d.offers||[])){
        const price=o.price;if(!Number.isFinite(price))continue;
        let off=0;try{const n=kit&&kit.netAt?kit.netAt(x.p,o.name,price):null;if(n&&n.save>0)off=n.save;}catch(_){}
        const cb=cbAmount(o.name,price,x.p.category,x.p),disc=mrp>price?mrp-price:0,pay=price-off-cb;
        if(!best||pay<best.pay)best={store:o.name,price,disc,off,cb,pay,sum:disc+off+cb};
      }
      return best||{store:x.d.store,price:x.d.price,disc:0,off:0,cb:0,pay:x.d.price,sum:0};
    };
    ver.forEach(x=>{x.t=tot(x);});
    const totals=ver.filter(x=>x.t.sum>0&&(x.t.off>0||x.t.cb>0)).sort((a,b)=>b.t.sum-a.t.sum||pref(a,b)).slice(0,10);
    if(totals.length>=3)rows.push({key:'total',lens:'total',feature:true,title:'Biggest total saving',sub:'Discount + coupons and bank offers + cashback, added up',items:totals});
    const disc=ver.filter(x=>x.d.sav?.percent>0).sort((a,b)=>b.d.sav.percent-a.d.sav.percent||pref(a,b)).slice(0,10);
    if(disc.length>=3)rows.push({key:'disc',lens:'disc',title:'Highest discount',sub:'Biggest cut from MRP, verified price',items:disc});
    const byStore=new Map();ver.forEach(x=>{const st=x.d.store;if(!st)return;if(!byStore.has(st))byStore.set(st,[]);byStore.get(st).push(x);});
    [...byStore.entries()].filter(([,l])=>l.length>=3).sort((a,b)=>b[1].length-a[1].length).forEach(([st,l])=>{
      if(rows.length>=5)return;
      const items=l.sort((a,b)=>(b.d.spread||0)-(a.d.spread||0)||pref(a,b)).slice(0,10);
      rows.push({key:'store-'+cbKey(st),lens:'store',store:st,title:`Lowest price on ${st}`,sub:`${l.length} products cheapest on ${st} right now`,items});
    });
    rows.splice(5);
  }else if(quiet&&hlCat&&hlCat!=='all'){
    /* V224: category picked in the deals section -> the rest of that category as small cards */
    const items=all.filter(x=>x.p.category===hlCat&&!x.p.card.hidden&&!top.has(x.p.id)).sort((a,b)=>hlRank(b.p)-hlRank(a.p));
    if(items.length)grid={title:`More ${catLabel(hlCat)} deals`,sub:`${items.length} more, ranked by Deal Score and price drop`,items,cat:hlCat};
  }
  if(!rows.length&&!grid){host.hidden=true;host.innerHTML='';host.__h='';return;}
  host.hidden=false;
  const head=`<div class="ppx-radar-head"><span class="ppx-radar-eyebrow"><i aria-hidden="true"></i>DEAL RADAR${grid?` · ${H(catLabel(hlCat).toUpperCase())}`:''}</span><h2>${grid?H(grid.title):'Deal Radar'}</h2><p>${grid?H(grid.sub):'Biggest price drops and best discounts, checked across stores.'}</p></div>`;
  const body=grid?`<div class="ppx-row" data-row="cat-${H(grid.cat)}"><div class="ppx-row-grid">${grid.items.map(x=>hlMini(x.p,x.d)).join('')}</div><div class="ppx-row-more"><a href="#/deals" data-see-cat="${H(grid.cat)}">Filter &amp; sort all ${H(catLabel(grid.cat))} deals <span aria-hidden="true">→</span></a></div></div>`
    :rows.map(r=>{
      const see=`<a href="#/deals" data-see-lens="${H(r.lens)}" data-see-store="${H(r.store||'')}">View all <span aria-hidden="true">→</span></a>`;
      const subOf=x=>r.lens==='total'?`Save ${M(x.t.sum)}`:r.lens==='disc'?`${x.d.sav.percent}% off MRP`:'';
      const optOf=x=>r.lens==='total'?{sub:subOf(x),price:x.t.price,at:x.t.store}:{sub:subOf(x)};
      if(r.feature){
        const f=r.items[0],t=f.t,img=ppxGlobalImg(f.p.id,f.d.photo);
        const parts=[t.disc?`<em>${M(t.disc)} discount</em>`:'',t.off?`<em>${M(t.off)} offers</em>`:'',t.cb?`<em class="is-cb">${CB_COIN}${cbText('radar',t.cb)}</em>`:''].join('');
        return `<div class="ppx-row pp-lens-feature" data-row="total"><div class="ppx-row-head"><div><h3>${H(r.title)}</h3><small>${H(r.sub)}</small></div>${see}</div>
          <div class="pp-lf-body"><a class="pp-lf-top" href="#/product/${encodeURIComponent(f.p.id)}"><span class="ph ${img.surface}">${img.img}</span><span class="pp-lf-c">${f.p.brand?`<small>${H(f.p.brand)}</small>`:''}<b>${H(f.p.name)}</b><span class="pp-lf-pr">${M(t.price)}${f.d.sav?.mrp>t.price?` <s>${M(f.d.sav.mrp)}</s>`:''} <i>at ${H(t.store||'')}</i></span><span class="pp-lf-save">Save ${t.cb?'up to ':''}${M(t.sum)} in total</span><span class="pp-lf-parts">${parts}</span></span></a>
          <div class="ppx-row-track">${r.items.slice(1).map(x=>hlMini(x.p,x.d,optOf(x))).join('')}</div></div></div>`;
      }
      return `<div class="ppx-row" data-row="${H(r.key)}"><div class="ppx-row-head"><div><h3>${H(r.title)}</h3><small>${H(r.sub)}</small></div>${see}</div><div class="ppx-row-track">${r.items.map(x=>hlMini(x.p,x.d,optOf(x))).join('')}</div></div>`;
    }).join('');
  const html=`<div class="container">${head}${body}</div>`;
  if(host.__h!==html){host.innerHTML=html;host.__h=html;}
}
function homeLayout(){try{hlApplyCap();}catch(e){console.warn(e);}try{hlRows();}catch(e){console.warn(e);}}
window.ppHomeLayout=homeLayout;
homeLayout();setTimeout(homeLayout,1600);setTimeout(homeLayout,5000);
let hlResizeT=0,hlLastTop=homeTop();window.addEventListener('resize',()=>{clearTimeout(hlResizeT);hlResizeT=setTimeout(()=>{if(homeTop()!==hlLastTop){hlLastTop=homeTop();homeLayout();}},200);});
if(typeof window.ppUpdateHomeCardPrices==='function'){
  const origU2=window.ppUpdateHomeCardPrices;
  window.ppUpdateHomeCardPrices=function(){const r=origU2.apply(this,arguments);try{homeLayout();}catch(_){}return r;};
}

/* =====================================================================
   V224 — Navigation system
   - Back / Forward: same scroll position, same search, same category /
     brand / store filter, and the card you opened gets a short highlight.
   - Home (logo, Home button, bottom-nav Home): always a fresh top page.
   - New pages open at the top (router), refresh keeps the page + position.
   Each history entry gets a small key (history.state.ppk); a snapshot of
   the view is kept per key in sessionStorage.
   ===================================================================== */
try{history.scrollRestoration='manual';}catch(_){}
const NAV_KEY='pp_nav_v1';
let navSnaps={};try{navSnaps=JSON.parse(sessionStorage.getItem(NAV_KEY)||'{}')||{};}catch(_){navSnaps={};}
let navRestoring=0,navUserMoved=false,navSaveT=0,navCur='';
const navNewKey=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const navKey=()=>history.state&&history.state.ppk||'';
function navEnsureKey(){
  if(!navKey()){const k=navNewKey();try{history.replaceState({...(history.state||{}),ppk:k},'');}catch(_){}
    if(navKey()===k){navSnaps[k]={...(navSnaps[k]||{}),prev:navCur&&navCur!==k?navCur:'',t:Date.now()};}}
  navCur=navKey();return navCur;}
function navView(){const r=parseRoute();return r&&routes[r.name]?`${r.name}/${r.param||''}`:'home';}
function navPersist(){try{const keys=Object.keys(navSnaps);if(keys.length>60)keys.sort((a,b)=>(navSnaps[a].t||0)-(navSnaps[b].t||0)).slice(0,keys.length-60).forEach(k=>delete navSnaps[k]);sessionStorage.setItem(NAV_KEY,JSON.stringify(navSnaps));}catch(_){}}
function navSave(extra){
  if(navRestoring&&!navUserMoved&&!extra)return; /* a click (extra) is the reader's own action: always save it */
  const k=navEnsureKey();if(!k)return;
  const s=navSnaps[k]||{};
  s.view=navView();s.y=Math.round(window.scrollY);s.t=Date.now();
  if(s.view==='home'){s.q=String(headerInput?.value||'');try{s.cat=hlCat||'all';}catch(_){s.cat='all';}try{s.brand=activeBrand;s.store=activeStore;}catch(_){}}
  if(extra)Object.assign(s,extra);
  navSnaps[k]=s;clearTimeout(navSaveT);navSaveT=setTimeout(navPersist,250);
}
window.addEventListener('scroll',()=>{if(!navRestoring){clearTimeout(navSave.__t);navSave.__t=setTimeout(()=>navSave(),120);}},{passive:true});
window.addEventListener('pagehide',()=>{navSave();navPersist();});
/* remember which product was opened from this view */
window.addEventListener('click',e=>{ // window capture: runs before handlers that reset the scroll
  const a=e.target.closest&&e.target.closest('a[href^="#/product/"],[data-product-id]');if(!a)return;
  const id=a.dataset?.productId||decodeURIComponent((a.getAttribute('href')||'').replace(/^#\/product\//,'').split(/[?#]/)[0]);
  if(id)navSave({last:id});
},true);
['wheel','touchstart','keydown','mousedown'].forEach(ev=>window.addEventListener(ev,()=>{if(navRestoring)navUserMoved=true;},{passive:true,capture:true}));
function navApplyHomeFilters(s){
  let changed=false;
  try{if((s.brand||'all')!==activeBrand){if(s.brand&&s.brand!=='all'){activeBrand=s.brand;setBrandActive?.(s.brand);}else resetBrandFilter?.();changed=true;}}catch(_){}
  try{if((s.store||'all')!==activeStore){if(s.store&&s.store!=='all'){activeStore=s.store;setStoreActive?.(s.store);}else resetStoreFilter?.();changed=true;}}catch(_){}
  const q=String(s.q||''),cat=s.cat||'all';
  let curCat='all';try{curCat=hlCat||'all';}catch(_){}
  if(q!==String(headerInput?.value||'')||cat!==curCat||changed){
    if(headerInput)headerInput.value=q;
    document.querySelectorAll('.deal-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.filter===cat));
    try{filterProducts(cat,q);}catch(_){}
    try{if(q)searchBar(q);else document.getElementById('ppxSearchBar')?.remove();}catch(_){}
  }
}
function navHighlight(id){
  if(!id)return;
  const sel=`a[href="#/product/${CSS.escape(encodeURIComponent(id))}"],a[href="#/product/${CSS.escape(id)}"]`;
  let el=null;
  if(navView()==='home'){
    const card=document.querySelector(`#dealGrid .deal-card .heart[data-id="${CSS.escape(id)}"]`)?.closest('.deal-card');
    if(card&&!card.hidden&&!card.hasAttribute('data-pp-cap'))el=card.querySelector('.ppx-pc')||card;
    if(!el)el=document.querySelector(`#ppxRows ${sel.split(',')[0]},#ppxRows ${sel.split(',')[1]}`);
  }else{
    const a=document.querySelector(`.pp-page-view ${sel.split(',')[0]},.pp-page-view ${sel.split(',')[1]}`);
    el=a?(a.closest('.ppx-pc,.ppx-mini,.ppx-dl-card,article,li')||a):null;
  }
  if(!el)return;
  const sc=el.closest('[data-pp-swipe],.ppx-row-track');
  if(sc){const card=el.closest('.deal-card,.ppx-mini')||el;sc.scrollLeft=Math.max(0,card.offsetLeft-sc.offsetLeft-16);}
  el.classList.remove('ppx-nav-hl');void el.offsetWidth;el.classList.add('ppx-nav-hl');
  setTimeout(()=>el.classList.remove('ppx-nav-hl'),2600);
}
function navRestore(s){
  if(!s)return;
  navRestoring++;navUserMoved=false;
  if(s.view==='home'){navApplyHomeFilters(s);lastHomeScroll=s.y||0;}
  const y=s.y||0;
  const step=()=>{if(navUserMoved)return;if(Math.abs(window.scrollY-y)>3)window.scrollTo({top:y,behavior:'instant'});};
  requestAnimationFrame(step);[90,260,600,1200,2200].forEach(t=>setTimeout(step,t));
  setTimeout(()=>navHighlight(s.last),280);
  setTimeout(()=>{navRestoring=Math.max(0,navRestoring-1);},2400);
}
/* back / forward: popstate fires before hashchange; take the snapshot now, apply after the router ran */
window.addEventListener('popstate',e=>{
  const k=e.state&&e.state.ppk;if(k)navCur=k; /* a plain #link click also fires popstate (no state): keep the page we came from */
  const snap=k&&navSnaps[k]?{...navSnaps[k]}:null;
  navRestoring++;
  setTimeout(()=>{
    if(!navKey())navEnsureKey();
    const r=parseRoute(),v=navView();
    if(!r&&!pageView.hidden)showHome();
    if(snap&&snap.view===v)navRestore(snap);
    else if(!snap&&v!=='home')window.scrollTo({top:0,behavior:'instant'});
    navRestoring=Math.max(0,navRestoring-1);
  },0);
});
/* a brand-new entry (link click) gets its own key */
window.addEventListener('hashchange',()=>{setTimeout(()=>{if(!navKey())navEnsureKey();},0);});
/* Home = fresh start */
function goHomeFresh(){
  closeAllPanels();
  const k=navNewKey();
  try{history.pushState({ppk:k},'',location.pathname+location.search);}catch(_){}
  showHome({restore:false});
  try{clearSearchResults(false);}catch(_){}
  try{resetBrandFilter?.();resetStoreFilter?.();}catch(_){}
  document.querySelectorAll('.deal-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));
  try{setTopCategoryActive?.('all');}catch(_){}
  try{filterProducts('all','');}catch(_){}
  const g=document.getElementById('dealGrid');if(g)g.scrollLeft=0;
  document.querySelectorAll('#ppxRows .ppx-row-track').forEach(t=>t.scrollLeft=0);
  lastHomeScroll=0;window.scrollTo({top:0,behavior:'instant'});
  navSnaps[k]={view:'home',y:0,q:'',cat:'all',brand:'all',store:'all',t:Date.now(),prev:navCur&&navCur!==k?navCur:''};navCur=k;navPersist();
}
/* V226: one Back rule for the whole site — return to the page (and spot) you came from;
   nothing to go back to (opened from a link) → Home */
function navCanBack(){const s=navSnaps[navKey()];return !!(s&&s.prev&&navSnaps[s.prev]);}
function goBack(){closeAllPanels();if(navCanBack())history.back();else goHomeFresh();}
window.ppGoBack=goBack;
window.ppGoHomeFresh=goHomeFresh;
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('a.brand,#homeNavBtn,[data-ppx-nav="home"],.footer [data-scroll="#home"]');
  if(!t)return;
  e.preventDefault();e.stopImmediatePropagation();
  goHomeFresh();
},true);
navEnsureKey();
/* refresh: put the reader back where they were */
{const s=navSnaps[navKey()];if(s&&s.view===navView()&&(s.y||0)>0){setTimeout(()=>navRestore({...s,last:''}),60);}}

/* V240: product-page image box behaves like the old "hero" surface on desktop, so every Admin
   setting (scale / rotate / X / Y / position) is applied exactly as previewed. Other surfaces use the original fit. */
(function(){
  const orig=window.ppFitGlobalImageInHost;
  if(typeof orig!=='function'||typeof ppNormalizeSiteImageSlot!=='function'||typeof ppImagePositionCSS!=='function')return;
  window.ppFitGlobalImageInHost=function(img,item){
    const host=img&&img.parentElement;
    if(!host||!host.classList.contains('ppx-stage')||!item||!item.url)return orig.apply(this,arguments);
    const run=()=>{
      const nw=Number(img.naturalWidth)||0,nh=Number(img.naturalHeight)||0;if(!nw||!nh)return;
      if(!host.clientWidth||!host.clientHeight){img.dataset.ppFitPending='1';return;}
      delete img.dataset.ppFitPending;
      const cs=getComputedStyle(host);
      const availW=Math.max(20,host.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0));
      const availH=Math.max(20,host.clientHeight-(parseFloat(cs.paddingTop)||0)-(parseFloat(cs.paddingBottom)||0));
      const c=ppNormalizeSiteImageSlot(item),fitMode=c.fit==='cover'?'cover':'contain';
      const base=(fitMode==='cover'?Math.max(availW/nw,availH/nh):Math.min(availW/nw,availH/nh));
      const baseW=nw*base,baseH=nh*base;
      const rad=(Number(c.rotate)||0)*Math.PI/180,ca=Math.abs(Math.cos(rad)),sa=Math.abs(Math.sin(rad));
      const rotW=baseW*ca+baseH*sa,rotH=baseW*sa+baseH*ca;
      const desired=Math.max(.7,Math.min(2.6,(Number(c.scale)||100)/100));
      const xRate=Math.abs(Number(c.x)||0)/100,yRate=Math.abs(Number(c.y)||0)/100;
      const free=window.innerWidth>1020||fitMode==='cover'||(Number(img.dataset.ppxSlot)||0)>0;/* V247: Image 2 and 3 behave the same on every screen; Image 1 keeps the fit-inside rule on small screens */
      const gutter=.96;
      const applied=free?Math.max(.2,desired):Math.max(.2,Math.min(desired,(availW*gutter)/(rotW+2*xRate*baseW),(availH*gutter)/(rotH+2*yRate*baseH)));
      const freeX=Math.max(0,(availW-rotW*applied)/2),freeY=Math.max(0,(availH-rotH*applied)/2);
      const preset=String(c.position||'center');
      const presetX=preset==='left'?(free?-availW*.12:-freeX):preset==='right'?(free?availW*.12:freeX):0;
      const presetY=preset==='top'?(free?-availH*.12:-freeY):preset==='bottom'?(free?availH*.12:freeY):0;
      const rawX=(Number(c.x)||0)/100*(free?availW:baseW*applied),rawY=(Number(c.y)||0)/100*(free?availH:baseH*applied);
      const tx=free?(presetX+rawX):Math.max(-freeX,Math.min(freeX,presetX+rawX));
      const ty=free?(presetY+rawY):Math.max(-freeY,Math.min(freeY,presetY+rawY));
      img.style.setProperty('width',`${baseW.toFixed(2)}px`,'important');
      img.style.setProperty('height',`${baseH.toFixed(2)}px`,'important');
      img.style.setProperty('max-width','none','important');img.style.setProperty('max-height','none','important');
      img.style.setProperty('object-fit',fitMode,'important');img.style.setProperty('object-position',ppImagePositionCSS(c.position||'center'),'important');
      img.style.setProperty('transform',`translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${Number(c.rotate)||0}deg) scale(${applied.toFixed(4)})`,'important');
      img.style.setProperty('transform-origin','center center','important');
      img.dataset.ppGlobalFitted='1';
    };
    if(img.complete&&img.naturalWidth)requestAnimationFrame(run);else img.addEventListener('load',()=>requestAnimationFrame(run),{once:true});
  };
})();
/* V240 (E1): brands/stores that are not in the fixed colour list get their tile colour from their own logo */
(function(){
  const cache=new Map();
  const toHex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
  function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);h*=60;}return [h,s,l];}
  function hsl2rgb(h,s,l){h/=360;const f=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};if(!s){const v=l*255;return [v,v,v];}const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;return [f(p,q,h+1/3)*255,f(p,q,h)*255,f(p,q,h-1/3)*255];}
  function dominant(img){
    const w=48,h=48,c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,w,h);
    const d=x.getImageData(0,0,w,h).data,bins=new Array(12).fill(0).map(()=>({n:0,r:0,g:0,b:0}));
    let dark={n:0,r:0,g:0,b:0};
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];if(a<128)continue;
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
      if(mn>225)continue;                       /* white / paper */
      if(mx-mn<28){dark.n++;dark.r+=r;dark.g+=g;dark.b+=b;continue;} /* grey / black ink */
      const [hh,ss]=rgb2hsl(r,g,b),k=Math.floor(hh/30)%12,wgt=0.4+ss;
      const bin=bins[k];bin.n+=wgt;bin.r+=r*wgt;bin.g+=g*wgt;bin.b+=b*wgt;
    }
    let best=null;for(const b of bins)if(b.n>0&&(!best||b.n>best.n))best=b;
    if(best&&best.n>=3){const r=best.r/best.n,g=best.g/best.n,b=best.b/best.n;let [hh,ss,ll]=rgb2hsl(r,g,b);ss=Math.max(ss,.45);ll=Math.max(.32,Math.min(.52,ll));const o=hsl2rgb(hh,ss,ll);return toHex(...o);}
    if(dark.n>=3)return toHex(dark.r/dark.n*.6,dark.g/dark.n*.6,dark.b/dark.n*.6);
    return '';
  }
  function colorFor(src){
    if(cache.has(src))return cache.get(src);
    const pr=new Promise(res=>{
      const im=new Image();im.crossOrigin='anonymous';
      im.onload=()=>{try{res(dominant(im));}catch(e){res('');}};
      im.onerror=()=>res('');im.src=src;
    });
    cache.set(src,pr);return pr;
  }
  async function tintTile(tile){
    if(!tile||tile.dataset.ppxAutotint!=='1')return;
    const im=tile.querySelector('.ppx-dx-pill img');const src=im&&(im.currentSrc||im.getAttribute('src'));
    if(!src){tile.dataset.ppxAutotint='x';return;}
    tile.dataset.ppxAutotint='p';
    const col=await colorFor(src);
    if(col){tile.style.setProperty('--c',col);tile.dataset.ppxAutotint='done';}else tile.dataset.ppxAutotint='x';
  }
  window.ppxAutoTint=function(root){(root||document).querySelectorAll('[data-ppx-autotint="1"]').forEach(tintTile);};
  if(typeof MutationObserver!=='undefined'){
    let raf=0;new MutationObserver(()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;window.ppxAutoTint();});}).observe(document.body||document.documentElement,{childList:true,subtree:true});
  }
  setTimeout(()=>window.ppxAutoTint(),300);
})();
/* V241 (G1): a third product image (Image 3) saved by Admin in metadata.site_images.tertiary */
(function(){
  if(typeof window.ppResolvedProductGallery!=='function')return;
  const orig=window.ppResolvedProductGallery;
  window.ppResolvedProductGallery=function(catalog,productId,fallbackImage){
    const out=orig.apply(this,arguments)||[];
    try{
      const raw=catalog&&catalog.metadata&&catalog.metadata.site_images;
      if(raw&&raw.mode==='curated'&&raw.tertiary&&raw.tertiary.url&&typeof window.ppNormalizeSiteImageSlot==='function'){
        const it=window.ppNormalizeSiteImageSlot(raw.tertiary);
        if(it&&it.url&&!out.some(x=>x.url===it.url))out.push(it);
      }
    }catch(e){}
    return out.slice(0,4);
  };
})();
window.ppPremiumRoutes=routes;
window.ppPremiumRoute=route;
window.ppProductPageHTML=productPageHTML;
route();
})();

/* V248: PricePulse extension "Alert me at ₹X" opens #/product/<id>?alert=<price>.
   Opens this product's deal-alert editor (after sign-in if needed) with that target filled in. */
(function(){
  const KEY='ppx_ext_alert_v248';
  const read=()=>{try{const v=JSON.parse(sessionStorage.getItem(KEY)||'null');return v&&Date.now()-v.t<15*60*1000?v:null;}catch(_){return null;}};
  function check(){
    const m=(location.hash||'').match(/^#\/product\/([^?]+)\?(?:.*&)?alert=(\d{2,8})(?:&|$)/i);
    if(!m)return;
    const id=decodeURIComponent(m[1]),price=Number(m[2]);
    try{sessionStorage.setItem(KEY,JSON.stringify({id,price,t:Date.now()}));}catch(_){}
    try{history.replaceState(null,'',location.pathname+location.search+'#/product/'+encodeURIComponent(id));}catch(_){}
    let n=0;
    const iv=setInterval(()=>{
      const b=document.querySelector(`.ppx-product [data-ppx-action="alert"][data-product-id="${CSS.escape(id)}"]`);
      if(b){clearInterval(iv);b.click();}else if(++n>60)clearInterval(iv);
    },250);
  }
  // Fill the target as soon as the alert editor for that product is open (also after sign-in).
  setInterval(()=>{
    const v=read();if(!v)return;
    const ed=document.getElementById('dealAlertEditor');
    if(!ed||ed.dataset.productId!==v.id)return;
    const inp=ed.querySelector('#dealAlertForm input[name="target"]');
    if(!inp||inp.dataset.ppxExt==='1')return;
    inp.value=String(v.price);inp.dataset.ppxExt='1';
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    try{sessionStorage.removeItem(KEY);}catch(_){}
  },300);
  window.addEventListener('hashchange',check);
  check();
})();

/* V249: PricePulse extension "View" for a store that is NOT cheaper opens #/product/<id>?from=<store>.
   The product page highlights that store and its button reads "Continue to <Store>". No automatic redirect
   or click: the shopper decides here (Chrome Web Store affiliate policy + store affiliate rules). */
(function(){
  const KEY='ppx_ext_from_v249';
  const read=()=>{try{const v=JSON.parse(sessionStorage.getItem(KEY)||'null');return v&&Date.now()-v.t<15*60*1000?v:null;}catch(_){return null;}};
  if(!document.getElementById('ppxFromStyle')){const st=document.createElement('style');st.id='ppxFromStyle';st.textContent=`.ppx-store.ppx-from{outline:2px solid #E8B954;outline-offset:2px;box-shadow:0 0 0 6px rgba(232,185,84,.18)}.ppx-from-note{display:block;margin:0 0 10px;padding:8px 12px;border-radius:10px;background:#FFF7E2;color:#5B4612;font-size:13px;font-weight:600}`;document.head.appendChild(st);}
  function check(){
    const m=(location.hash||'').match(/^#\/product\/([^?]+)\?(?:.*&)?from=([a-z ]{2,30})(?:&|$)/i);
    if(!m)return;
    const id=decodeURIComponent(m[1]),store=decodeURIComponent(m[2]).toLowerCase().trim();
    try{sessionStorage.setItem(KEY,JSON.stringify({id,store,t:Date.now()}));}catch(_){}
    try{history.replaceState(null,'',location.pathname+location.search+'#/product/'+encodeURIComponent(id));}catch(_){}
  }
  setInterval(()=>{
    const v=read();if(!v)return;
    if(!(location.hash||'').startsWith('#/product/'+encodeURIComponent(v.id))&&!(location.hash||'').startsWith('#/product/'+v.id))return;
    const row=[...document.querySelectorAll('.ppx-product .ppx-store[data-retailer]')].find(r=>r.dataset.retailer.toLowerCase().trim()===v.store);
    if(!row||row.classList.contains('ppx-from'))return;
    row.classList.add('ppx-from');
    const cta=row.querySelector('.ppx-store-cta');
    if(cta){cta.classList.remove('ppx-btn-outline');cta.classList.add('ppx-btn-primary');cta.innerHTML=`Continue to ${row.dataset.retailer.replace(/[<>&]/g,'')} <span aria-hidden="true">↗</span>`;}
    const note=document.createElement('span');note.className='ppx-from-note';note.textContent=`You chose ${row.dataset.retailer} in the PricePulse extension. Compare all stores here, then continue.`;
    row.parentNode.insertBefore(note,row);
    row.scrollIntoView({block:'center',behavior:'smooth'});
    try{sessionStorage.removeItem(KEY);}catch(_){}
  },400);
  window.addEventListener('hashchange',check);
  check();
})();
