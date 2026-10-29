/* PricePulse V78.8.20 — GLOBAL outline brand-logo box system.
 * Scope: brand logos only.
 *
 * Audited surfaces:
 * - Shop by Brand carousel
 * - All Brands modal
 * - Home / Category product cards
 * - Compare Popup
 * - Wishlist
 * - Admin Global Live Preview
 * - Admin exact Compare Popup mirror
 *
 * The All Brands appearance is the visual reference.
 * Every brand now uses the same subtle fixed box per UI context.
 * No brand-specific sizing is used. Future brands automatically inherit the same box + whitespace trimming.
 * Source files and Admin logo_url values are never modified.
 */
(()=>{
  const SELECTOR=[
    'img.product-brand-logo',
    'img.pp-global-brand-logo',
    'img.pp-v78-product-brand',
    'img.pp-wish-brand-logo',
    '.brand-logo-panel img',
    '.pp-discovery-brand-logo img',
    'img[data-global-preview-brand]'
  ].join(',');

  const cache=new Map();
  const pending=new WeakMap();
  const GENERATED_PREFIX='data:image/png;base64,';

  /* One global box contract. No per-brand width/height tuning.
     The box is intentionally very light so it organizes logos without looking like a badge. */
  const BOXES={
    master:{w:140,h:58,px:12,py:8,r:12},
    home:{w:108,h:36,px:10,py:6,r:10},
    popup:{w:130,h:40,px:11,py:7,r:10},
    wishlist:{w:86,h:29,px:8,py:5,r:9},
    product:{w:112,h:40,px:10,py:6,r:10} /* V277: product page gallery - smaller, thin grey border */
  };

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const isHttp=s=>/^https?:\/\//i.test(String(s||''));

  function canonicalFor(img){
    if(!img)return'';
    const attr=String(img.getAttribute('src')||'').trim();
    const saved=String(img.dataset.ppLogoCanonical||'').trim();
    if(attr && !attr.startsWith('data:image/')){
      if(saved!==attr){
        img.dataset.ppLogoCanonical=attr;
        img.dataset.ppLogoNormalizedFor='';
      }
      return attr;
    }
    return saved||attr;
  }

  function textKey(s){
    return String(s||'').toLowerCase()
      .replace(/&/g,' and ')
      .replace(/[^a-z0-9]+/g,' ')
      .trim()
      .replace(/\s+/g,' ');
  }

  function brandSlugFor(img){
    const explicit=String(img?.dataset?.ppBrand||'').trim();
    if(explicit)return explicit;

    const host=img?.closest?.('[data-brand],[data-discovery-brand]');
    const hostSlug=String(host?.dataset?.brand||host?.dataset?.discoveryBrand||'').trim();
    if(hostSlug)return hostSlug;

    const hay=textKey([
      img?.alt,
      img?.className,
      img?.dataset?.fallback,
      img?.dataset?.ppBrandFallback,
      canonicalFor(img)
    ].filter(Boolean).join(' '));

    const probes=[
      ['oneplus',['oneplus','one plus']],
      ['dell',['dell']],
      ['boat',['boat','bo at']],
      ['philips',['philips']],
      ['puma',['puma']],
      ['nutripro',['nutripro','nutri pro']],
      ['dotkey',['dotkey','dot key','dot and key']],
      ['samsung',['samsung']]
    ];
    for(const [slug,names] of probes){
      if(names.some(n=>hay.includes(n)))return slug;
    }
    return 'default';
  }

  function surfaceFor(img){
    if(img?.closest?.('.ppx-gallery .ppx-brand'))return'product';
    if(img?.closest?.('.pp-wish-product-main') || img?.matches?.('.pp-wish-brand-logo'))return'wishlist';

    if(img?.matches?.('[data-global-preview-brand]')){
      if(img.closest('.global-preview-surface.is-home'))return'home';
      if(img.closest('.global-preview-surface.is-wishlist'))return'wishlist';
      return'popup';
    }

    if(img?.closest?.('.deal-card .product-media,.deal-card .card-top') || img?.matches?.('.pp-card-brand-box'))return'home';
    if(img?.closest?.('.pp-v787-brand-logo'))return'popup';

    if(img?.closest?.('.brand-logo-panel,.pp-discovery-brand-logo'))return'master';

    return'master';
  }

  function applyVisualContract(img){
    if(!img)return;
    const slug=brandSlugFor(img);
    const surface=surfaceFor(img);
    const box=BOXES[surface]||BOXES.master;
    img.dataset.ppBrand=slug;
    img.dataset.ppBrandSurface=surface;
    img.dataset.ppLogoBox='1';

    /* Fixed outer box + contain-fit artwork. The transparent/white-space trimmer below
       handles source files with excess canvas, so future brands need no manual CSS. */
    img.style.setProperty('display','block','important');
    img.style.setProperty('box-sizing','border-box','important');
    img.style.setProperty('width',`${box.w}px`,'important');
    img.style.setProperty('height',`${box.h}px`,'important');
    img.style.setProperty('max-width',`${box.w}px`,'important');
    img.style.setProperty('max-height',`${box.h}px`,'important');
    img.style.setProperty('padding',`${box.py}px ${box.px}px`,'important');
    img.style.setProperty('object-fit','contain','important');
    img.style.setProperty('object-position','center center','important');
    img.style.setProperty('background','#fff','important');
    img.style.setProperty('border',surface==='product'?'1px solid #E1E6E3':'1px solid rgba(5,191,135,.52)','important');
    img.style.setProperty('border-radius',`${box.r}px`,'important');
    img.style.setProperty('box-shadow',surface==='product'?'none':'0 2px 8px rgba(16,35,49,.055)','important');
    img.style.setProperty('margin','0','important');
    img.style.setProperty('transform','none','important');
    img.style.setProperty('filter','none','important');
  }

  function cornerBackground(data,w,h){
    const pts=[[1,1],[w-2,1],[1,h-2],[w-2,h-2],[Math.floor(w/2),1],[Math.floor(w/2),h-2]];
    const samples=[];
    for(const [x0,y0] of pts){
      const x=clamp(x0,0,w-1),y=clamp(y0,0,h-1),i=(y*w+x)*4;
      samples.push([data[i],data[i+1],data[i+2],data[i+3]]);
    }
    const transparent=samples.filter(p=>p[3]<28).length>=Math.ceil(samples.length*.6);
    if(transparent)return {transparent:true,r:255,g:255,b:255,a:0};
    const opaque=samples.filter(p=>p[3]>180);
    if(!opaque.length)return {transparent:true,r:255,g:255,b:255,a:0};
    const avg=k=>opaque.reduce((s,p)=>s+p[k],0)/opaque.length;
    return {transparent:false,r:avg(0),g:avg(1),b:avg(2),a:avg(3)};
  }

  function trimFromCanvas(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)return'';
    const w=canvas.width,h=canvas.height;
    if(w<2||h<2)return'';

    const pixels=ctx.getImageData(0,0,w,h).data;
    const bg=cornerBackground(pixels,w,h);
    let minX=w,minY=h,maxX=-1,maxY=-1,count=0;
    const threshold=22,thresholdSq=threshold*threshold*3;

    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i=(y*w+x)*4,a=pixels[i+3];
        if(a<20)continue;
        let visible=true;
        if(!bg.transparent){
          const dr=pixels[i]-bg.r,dg=pixels[i+1]-bg.g,db=pixels[i+2]-bg.b;
          visible=(dr*dr+dg*dg+db*db)>thresholdSq || a<210;
        }
        if(!visible)continue;
        count++;
        if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      }
    }

    if(!count||maxX<minX||maxY<minY)return'';
    let bw=maxX-minX+1,bh=maxY-minY+1;
    if(bw<Math.max(4,w*.03)||bh<Math.max(4,h*.08))return'';

    const padX=Math.max(2,Math.round(bw*.025));
    const padY=Math.max(2,Math.round(bh*.06));
    minX=Math.max(0,minX-padX);maxX=Math.min(w-1,maxX+padX);
    minY=Math.max(0,minY-padY);maxY=Math.min(h-1,maxY+padY);
    bw=maxX-minX+1;bh=maxY-minY+1;

    if(bw/w>.965 && bh/h>.94)return'';

    const out=document.createElement('canvas');
    out.width=bw;out.height=bh;
    const outCtx=out.getContext('2d');
    if(!outCtx)return'';
    outCtx.drawImage(canvas,minX,minY,bw,bh,0,0,bw,bh);
    return out.toDataURL('image/png');
  }

  function canvasFromDrawable(drawable,nw,nh){
    const maxDim=960,scale=Math.min(1,maxDim/Math.max(nw,nh));
    const w=Math.max(2,Math.round(nw*scale)),h=Math.max(2,Math.round(nh*scale));
    const canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');
    if(!ctx)return null;
    ctx.clearRect(0,0,w,h);
    ctx.drawImage(drawable,0,0,w,h);
    return canvas;
  }

  async function computeFromLoadedImage(img){
    if(!img?.naturalWidth||!img?.naturalHeight)return'';
    const canvas=canvasFromDrawable(img,img.naturalWidth,img.naturalHeight);
    return canvas?trimFromCanvas(canvas):'';
  }

  async function computeFromFetch(src){
    if(!isHttp(src)||typeof fetch!=='function')return'';
    const res=await fetch(src,{mode:'cors',cache:'force-cache'});
    if(!res.ok)throw new Error('logo fetch failed');
    const blob=await res.blob();

    if(typeof createImageBitmap==='function'){
      const bmp=await createImageBitmap(blob);
      try{
        const canvas=canvasFromDrawable(bmp,bmp.width,bmp.height);
        return canvas?trimFromCanvas(canvas):'';
      }finally{try{bmp.close?.();}catch(_){}}
    }

    return await new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(blob),im=new Image();
      im.onload=()=>{
        try{
          const c=canvasFromDrawable(im,im.naturalWidth,im.naturalHeight);
          resolve(c?trimFromCanvas(c):'');
        }catch(e){reject(e);}
        finally{URL.revokeObjectURL(url);}
      };
      im.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('logo blob load failed'));};
      im.src=url;
    });
  }

  async function normalize(img){
    if(!img||!img.matches?.(SELECTOR))return;

    applyVisualContract(img);
    const canonical=canonicalFor(img);
    if(!canonical)return;

    const cached=cache.get(canonical);
    if(cached!==undefined){
      img.dataset.ppLogoNormalizedFor=canonical;
      if(cached && img.getAttribute('src')!==cached)img.src=cached;
      applyVisualContract(img);
      return;
    }

    if(pending.has(img))return pending.get(img);

    const task=(async()=>{
      try{
        let trimmed='';
        if(img.complete&&img.naturalWidth){
          try{trimmed=await computeFromLoadedImage(img);}catch(_){trimmed='';}
        }
        if(!trimmed && isHttp(canonical)){
          try{trimmed=await computeFromFetch(canonical);}catch(_){trimmed='';}
        }

        cache.set(canonical,trimmed||'');
        img.dataset.ppLogoNormalizedFor=canonical;

        if(trimmed && canonicalFor(img)===canonical && img.getAttribute('src')!==trimmed){
          img.src=trimmed;
        }
        applyVisualContract(img);
      }catch(_){
        cache.set(canonical,'');
        img.dataset.ppLogoNormalizedFor=canonical;
        applyVisualContract(img);
      }finally{
        pending.delete(img);
      }
    })();

    pending.set(img,task);
    return task;
  }

  function schedule(img){
    if(!img?.matches?.(SELECTOR))return;
    applyVisualContract(img);

    const raw=String(img.getAttribute('src')||'');
    const canonical=canonicalFor(img);
    if(!canonical)return;

    if(raw.startsWith(GENERATED_PREFIX) && img.dataset.ppLogoNormalizedFor===canonical){
      applyVisualContract(img);
      return;
    }

    if(img.complete&&img.naturalWidth)normalize(img);
    else img.addEventListener('load',()=>normalize(img),{once:true});
  }

  function hydrate(root=document){
    const list=[];
    if(root?.matches?.(SELECTOR))list.push(root);
    root?.querySelectorAll?.(SELECTOR).forEach(x=>list.push(x));
    list.forEach(schedule);
  }

  function start(){
    hydrate(document);
    if(typeof MutationObserver==='undefined'||!document.documentElement)return;

    const obs=new MutationObserver(records=>{
      for(const rec of records){
        if(rec.type==='attributes'){
          schedule(rec.target);
          continue;
        }
        for(const n of rec.addedNodes){
          if(n?.nodeType===1)hydrate(n);
        }
      }
    });

    obs.observe(document.documentElement,{
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['src','alt','data-brand','data-discovery-brand']
    });
  }

  window.PricePulseBrandLogo={normalize,hydrate,applyVisualContract};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
