/* PricePulse V78.8.141 Admin Catalog & Price Dashboard
 * - Existing V68 manual price verification stays compatible.
 * - Adds catalog management (products, brands, stores, retailer links).
 * - Adds browser-helper capture, product/variant match checks and enrichment fields.
 * - Manual helper data NEVER publishes until the admin explicitly confirms it.
 * - Future authorized APIs/feeds can write the same fields without a public UI redesign.
 * NEVER place a Supabase service_role key in browser code.
 */
const SUPABASE_URL="https://akdrydxbvdtadmcphhxj.supabase.co";
const SUPABASE_KEY="sb_publishable_RZAK4TwpJO6fi3Y306EGaA_PpZdiqHG";
const api=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);
const byId=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
const money=n=>Number.isFinite(Number(n))&&Number(n)>0?`₹${Number(n).toLocaleString('en-IN',{maximumFractionDigits:2})}`:'';
const cleanNumber=v=>{const n=Number(String(v??'').replace(/[^0-9.]/g,''));return Number.isFinite(n)?n:null;};
const CATALOG_LOGO_BUCKET='pp-catalog-logos';
const MAX_LOGO_BYTES=2*1024*1024;
const LOGO_MIME_TYPES=new Set(['image/png','image/jpeg','image/webp','image/svg+xml']);
function logoExt(file){const byMime={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg'};return byMime[file?.type]||String(file?.name||'').split('.').pop()?.toLowerCase()||'bin';}
function logoMime(file){if(LOGO_MIME_TYPES.has(file?.type))return file.type;const ext=logoExt(file);return ({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'})[ext]||'';}
function logoUploadError(error){const t=String(error?.message||error||'Logo upload failed.');return /bucket|not found|row-level|policy|permission|403|404/i.test(t)?'Logo storage is not enabled yet. Run supabase-catalog-logo-storage-v78.5.sql once in Supabase, then retry.':t;}
async function uploadCatalogLogo(kind,slug,file){if(!file)return'';const mime=logoMime(file);if(!mime)throw new Error('Use an SVG, PNG, JPG or WebP logo file.');if(file.size>MAX_LOGO_BYTES)throw new Error('Logo file is larger than 2 MB. Please use a smaller official logo.');const ext=logoExt(file),stamp=Date.now(),path=`${kind}/${slug}/${stamp}-${slug}.${ext}`;const {error}=await api.storage.from(CATALOG_LOGO_BUCKET).upload(path,file,{cacheControl:'31536000',upsert:false,contentType:mime});if(error)throw error;const {data}=api.storage.from(CATALOG_LOGO_BUCKET).getPublicUrl(path);if(!data?.publicUrl)throw new Error('Logo uploaded, but its public URL could not be created.');return data.publicUrl;}
function setLogoPreview(formId,previewId){const f=byId(formId),img=byId(previewId);if(!f||!img)return;const file=f.elements.logo_file?.files?.[0],url=f.elements.logo_url?.value?.trim();if(file){const objectUrl=URL.createObjectURL(file);img.src=objectUrl;img.hidden=false;img.onload=()=>URL.revokeObjectURL(objectUrl);img.onerror=()=>{img.hidden=true;URL.revokeObjectURL(objectUrl);};return;}if(url){img.src=url;img.hidden=false;img.onerror=()=>img.hidden=true;}else{img.removeAttribute('src');img.hidden=true;}}

function ppAdminBrandText(value){return String(value||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function ppAdminBrandScore(product,brand){
  const hay=` ${ppAdminBrandText([product?.name,product?.identity_key,product?.identityKey,product?.model_code,product?.modelCode].filter(Boolean).join(' '))} `;
  if(!hay.trim())return 0;
  const probes=[brand?.name,brand?.slug,...(Array.isArray(brand?.aliases)?brand.aliases:[])].map(ppAdminBrandText).filter(x=>x.length>=2);
  let best=0;
  for(const probe of probes){const padded=` ${probe} `;if(hay.startsWith(padded))best=Math.max(best,1000+probe.length);else if(hay.includes(padded))best=Math.max(best,500+probe.length);}
  return best;
}
function ppAdminResolveBrandSlug(product,brandList=brands){
  const current=String(product?.brand_slug||product?.brandSlug||'').trim();
  const currentBrand=(brandList||[]).find(b=>b.slug===current)||null;
  const currentScore=currentBrand?ppAdminBrandScore(product,currentBrand):0;
  let bestSlug=currentBrand?current:'',bestScore=currentScore;
  for(const brand of brandList||[]){const score=ppAdminBrandScore(product,brand);if(score>bestScore){bestScore=score;bestSlug=brand.slug;}}
  if(currentBrand&&currentScore>=500)return current;
  return bestScore>=500?bestSlug:(currentBrand?current:'');
}

const PRODUCT_IMAGE_BUCKET='pp-product-images';
const MAX_PRODUCT_IMAGE_BYTES=5*1024*1024;
function productImageUploadError(error){const t=String(error?.message||error||'Product image upload failed.');return /bucket|not found|row-level|policy|permission|403|404/i.test(t)?'Product image storage is not enabled yet. Run supabase-product-image-storage-v78.8.sql once in Supabase, then retry.':t;}
async function uploadProductImage(productId,slot,file){
  if(!file)return'';
  const mime=logoMime(file);
  if(!mime)throw new Error('Use an SVG, PNG, JPG or WebP image file.');
  if(file.size>MAX_PRODUCT_IMAGE_BYTES)throw new Error('Product image is larger than 5 MB. Please use a smaller image.');
  const ext=logoExt(file),stamp=Date.now(),path=`products/${slugify(productId)}/${slot}/${stamp}-${slot}.${ext}`;
  const {error}=await api.storage.from(PRODUCT_IMAGE_BUCKET).upload(path,file,{cacheControl:'31536000',upsert:false,contentType:mime});
  if(error)throw error;
  const {data}=api.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  if(!data?.publicUrl)throw new Error('Image uploaded, but its public URL could not be created.');
  return data.publicUrl;
}
function ppClampNumber(value,min,max,fallback=0){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
function siteImageConfig(product){
  const raw=product?.metadata?.site_images||{};
  const cleanSlot=(slot={})=>({
    url:String(slot.url||'').trim(),
    bg:['soft','white','transparent','original'].includes(slot.bg)?slot.bg:'soft',
    fit:['contain','cover'].includes(slot.fit)?slot.fit:'contain',
    position:['center','top','bottom','left','right'].includes(slot.position)?slot.position:'center',
    scale:String(ppClampNumber(slot.scale,70,260,100)),
    rotate:String(ppClampNumber(slot.rotate,-30,30,0)),
    x:String(ppClampNumber(slot.x,-30,30,0)),
    y:String(ppClampNumber(slot.y,-30,30,0)),
    source:String(slot.source||'').trim()
  });
  return {mode:raw.mode==='curated'?'curated':'auto',primary:cleanSlot(raw.primary),secondary:cleanSlot(raw.secondary),tertiary:cleanSlot(raw.tertiary)};
}
function verifiedImageCandidates(product){
  const out=[],seen=new Set();
  const add=(url,label,source)=>{url=String(url||'').trim();if(!url||seen.has(url))return;seen.add(url);out.push({url,label,source});};
  if(product?.liveImageUrl)add(product.liveImageUrl,`Current verified live${product.liveImageStore?` · ${product.liveImageStore}`:''}`,'verified-live');
  if(product?.imageUrl)add(product.imageUrl,'Current fallback image','fallback');
  for(const st of product?.stores||[]){
    const row=rowFor(product.id,st.name);
    const url=String(row?.image_url||st.capturedImage||'').trim();
    const verified=row?.image_verified===true;
    const exact=(row?.match_status==='match'||st.matchStatus==='match');
    if(url&&verified&&exact)add(url,`${st.name} · verified exact match`,'verified-retailer');
  }
  return out;
}
function populateSiteImageSources(product){
  const f=byId('productForm');if(!f)return;
  const candidates=verifiedImageCandidates(product);
  const html=['<option value="">Choose source…</option>',...candidates.map(c=>`<option value="${esc(c.url)}" data-source="${esc(c.source)}">${esc(c.label)}</option>`)].join('');
  f.elements.site_primary_source.innerHTML=html;
  f.elements.site_secondary_source.innerHTML=html;
  if(f.elements.site_tertiary_source)f.elements.site_tertiary_source.innerHTML=html;
  const cards=byId('siteImageSourceCards');
  if(cards){
    cards.innerHTML=candidates.length?candidates.map((c,i)=>`<article class="site-source-card"><img src="${esc(c.url)}" alt="" loading="lazy"><b>${esc(c.label)}</b><small>${esc(c.source)}</small><div class="site-source-actions"><button type="button" class="subtle" data-use-site-image="primary" data-site-image-index="${i}">Use as 1</button><button type="button" class="ghost" data-use-site-image="secondary" data-site-image-index="${i}">Use as 2</button><button type="button" class="ghost" data-use-site-image="tertiary" data-site-image-index="${i}">Use as 3</button></div></article>`).join(''):'<p class="fine">No verified retailer image is available yet. You can still paste an image URL or upload a local image.</p>';
    cards.querySelectorAll('[data-use-site-image]').forEach(btn=>btn.addEventListener('click',()=>{
      const item=candidates[Number(btn.dataset.siteImageIndex)];if(!item)return;
      const slot=btn.dataset.useSiteImage;
      f.elements[`site_${slot}_url`].value=item.url;
      f.elements[`site_${slot}_source`].value=item.url;
      if(f.elements[`site_${slot}_file`])f.elements[`site_${slot}_file`].value='';
      updateSiteImagePreview(slot);
    }));
  }
}
function sitePositionValue(v){return ({center:'center center',top:'center top',bottom:'center bottom',left:'left center',right:'right center'})[v]||'center center';}
const sitePreviewObjectUrls={primary:{file:null,url:''},secondary:{file:null,url:''},tertiary:{file:null,url:''}};
function previewSlotState(slot){
  const f=byId('productForm');if(!f)return null;
  const file=f.elements[`site_${slot}_file`]?.files?.[0];
  let src=f.elements[`site_${slot}_url`]?.value?.trim()||'';
  if(file){
    const cache=sitePreviewObjectUrls[slot];
    if(cache.file!==file){if(cache.url)URL.revokeObjectURL(cache.url);cache.file=file;cache.url=URL.createObjectURL(file);}src=cache.url;
  }else{
    const cache=sitePreviewObjectUrls[slot];if(cache.url){URL.revokeObjectURL(cache.url);cache.file=null;cache.url='';}
  }
  return {
    src,
    bg:f.elements[`site_${slot}_bg`]?.value||'soft',
    fit:f.elements[`site_${slot}_fit`]?.value||'contain',
    position:f.elements[`site_${slot}_position`]?.value||'center',
    scale:ppClampNumber(f.elements[`site_${slot}_scale`]?.value,70,260,100),
    rotate:ppClampNumber(f.elements[`site_${slot}_rotate`]?.value,-30,30,0),
    x:ppClampNumber(f.elements[`site_${slot}_x`]?.value,-30,30,0),
    y:ppClampNumber(f.elements[`site_${slot}_y`]?.value,-30,30,0)
  };
}
function siteImageTransformCSS(state){return `translate(${state.x}%, ${state.y}%) rotate(${state.rotate}deg) scale(${state.scale/100})`;}

function siteImageSafePercent(state={}){
  const rotate=Math.abs(Number(state.rotate)||0)*Math.PI/180;
  const rotation=Math.abs(Math.cos(rotate))+Math.abs(Math.sin(rotate));
  const scale=Math.max(.7,(Number(state.scale)||100)/100);
  const movePenalty=Math.min(22,(Math.abs(Number(state.x)||0)+Math.abs(Number(state.y)||0))*.28);
  return Math.max(42,Math.min(92,(92-movePenalty)/(scale*Math.max(1,rotation))));
}
function fitPreviewImageInsideHost(img,state){
  if(!img||!state?.src)return;
  const host=img.parentElement;if(!host)return;
  const run=()=>{
    const nw=Number(img.naturalWidth)||0,nh=Number(img.naturalHeight)||0;if(!nw||!nh)return;
    const cs=getComputedStyle(host);
    const availW=Math.max(24,host.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0));
    const availH=Math.max(24,host.clientHeight-(parseFloat(cs.paddingTop)||0)-(parseFloat(cs.paddingBottom)||0));
    const fitMode=state.fit==='cover'?'cover':'contain';
    const base=(fitMode==='cover'?Math.max(availW/nw,availH/nh):Math.min(availW/nw,availH/nh));
    const baseW=nw*base,baseH=nh*base;
    const angle=(Number(state.rotate)||0)*Math.PI/180,ca=Math.abs(Math.cos(angle)),sa=Math.abs(Math.sin(angle));
    const rotW=baseW*ca+baseH*sa,rotH=baseW*sa+baseH*ca;
    const desired=Math.max(.7,Math.min(2.6,(Number(state.scale)||100)/100));
    const xRate=Math.abs(Number(state.x)||0)/100,yRate=Math.abs(Number(state.y)||0)/100;
    const isEditorPreview=host.classList.contains('site-image-preview')||host.id==='websitePreviewStage';
    const allowManualOverflow=isEditorPreview||fitMode==='cover';
    const applied=allowManualOverflow
      ? Math.max(.2,desired)
      : Math.max(.2,Math.min(desired,(availW*.96)/(rotW+2*xRate*baseW),(availH*.96)/(rotH+2*yRate*baseH)));
    const freeX=Math.max(0,(availW-rotW*applied)/2),freeY=Math.max(0,(availH-rotH*applied)/2);
    const preset=String(state.position||'center');
    const presetX=preset==='left'?(allowManualOverflow?-availW*.12:-freeX):preset==='right'?(allowManualOverflow?availW*.12:freeX):0;
    const presetY=preset==='top'?(allowManualOverflow?-availH*.12:-freeY):preset==='bottom'?(allowManualOverflow?availH*.12:freeY):0;
    const rawX=(Number(state.x)||0)/100*(allowManualOverflow?availW:baseW*applied);
    const rawY=(Number(state.y)||0)/100*(allowManualOverflow?availH:baseH*applied);
    const tx=allowManualOverflow?(presetX+rawX):Math.max(-freeX,Math.min(freeX,presetX+rawX));
    const ty=allowManualOverflow?(presetY+rawY):Math.max(-freeY,Math.min(freeY,presetY+rawY));
    img.style.setProperty('width',`${baseW.toFixed(2)}px`,'important');
    img.style.setProperty('height',`${baseH.toFixed(2)}px`,'important');
    img.style.setProperty('max-width','none','important');
    img.style.setProperty('max-height','none','important');
    img.style.setProperty('object-fit',fitMode,'important');
    img.style.setProperty('object-position',sitePositionValue(state.position||'center'),'important');
    img.style.setProperty('transform',`translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${Number(state.rotate)||0}deg) scale(${applied.toFixed(4)})`,'important');
    img.style.setProperty('transform-origin','center center','important');
  };
  img.src=state.src;img.hidden=false;
  if(img.complete&&img.naturalWidth)requestAnimationFrame(run);else img.addEventListener('load',()=>requestAnimationFrame(run),{once:true});
}
function ppAdminMarkCut(stage,img){
  if(!stage)return;
  if(!img||img.hidden){stage.classList.remove('is-cut');return;}
  const sr=stage.getBoundingClientRect(),ir=img.getBoundingClientRect();
  stage.classList.toggle('is-cut',ir.left<sr.left-2||ir.right>sr.right+2||ir.top<sr.top-2||ir.bottom>sr.bottom+2);
}
function applyGlobalPreviewImage(img,state){
  if(!img||!state?.src)return;
  fitPreviewImageInsideHost(img,state);
}
function currentPreviewBrand(){
  const f=byId('productForm');if(!f)return null;
  return brands.find(b=>b.slug===f.elements.brand_slug?.value)||null;
}
function updateGlobalSurfacePreviews(primary){
  const f=byId('productForm');if(!f)return;
  const name=f.elements.name?.value?.trim()||'Product';
  const brand=currentPreviewBrand();
  const brandName=String(brand?.name||f.elements.brand_slug?.value||'').trim();
  const category=String(f.elements.category?.value||'').trim().replace(/\b\w/g,m=>m.toUpperCase());
  const model=String(f.elements.model_code?.value||'').trim();
  const variant=String(f.elements.variant?.value||'').trim();
  const details=[category,brandName,model,variant].filter((v,i,a)=>v&&a.indexOf(v)===i);
  const editingId=String(f.elements.editing_id?.value||'').trim();
  const currentProduct=editingId?productById(editingId):null;
  const listingCount=Array.isArray(currentProduct?.stores)?currentProduct.stores.length:0;
  document.querySelectorAll('[data-global-preview-name]').forEach(el=>el.textContent=name);
  document.querySelectorAll('[data-popup-preview-title]').forEach(el=>el.textContent=name);
  document.querySelectorAll('[data-popup-preview-details]').forEach(el=>{el.innerHTML=details.map(v=>`<span>${esc(v)}</span>`).join('');});
  document.querySelectorAll('[data-popup-preview-listings]').forEach(el=>{el.textContent=`${listingCount||'—'} retailer ${listingCount===1?'listing':'listings'} available`;});
  document.querySelectorAll('[data-global-preview-brand]').forEach(img=>{
    const src=String(brand?.logoUrl||'').trim();
    if(!src){img.hidden=true;img.removeAttribute('src');return;}
    img.src=src;img.hidden=false;img.alt=`${brand?.name||'Brand'} logo`;img.onerror=()=>img.hidden=true;
  });
  document.querySelectorAll('[data-global-preview-stage]').forEach(stage=>{
    stage.classList.remove('soft','white','transparent','original');stage.classList.add(primary?.bg||'original');
    const img=stage.querySelector('[data-global-preview-image]');
    if(!img)return;
    if(!primary?.src){img.hidden=true;img.removeAttribute('src');return;}
    applyGlobalPreviewImage(img,primary);
    setTimeout(()=>ppAdminMarkCut(stage,img),160);
  });
}

let ppAdminMirrorActiveSlot='primary';
function ppAdminExactMirrorState(preferSlot='primary'){
  const f=byId('productForm');if(!f)return null;
  const brand=currentPreviewBrand();
  const brandName=String(brand?.name||f.elements.brand_slug?.value||'').trim();
  const category=String(f.elements.category?.value||'').trim().replace(/\b\w/g,m=>m.toUpperCase());
  const model=String(f.elements.model_code?.value||'').trim();
  const variant=String(f.elements.variant?.value||'').trim();
  const details=[category,brandName,model,variant].filter((v,i,a)=>v&&a.indexOf(v)===i);
  const editingId=String(f.elements.editing_id?.value||'').trim();
  const currentProduct=editingId?productById(editingId):null;
  const listingCount=Array.isArray(currentProduct?.stores)?currentProduct.stores.length:0;
  const items=websitePreviewItems();
  ppAdminMirrorActiveSlot=items.some(x=>x.slot===preferSlot)?preferSlot:(items.some(x=>x.slot===ppAdminMirrorActiveSlot)?ppAdminMirrorActiveSlot:(items.find(x=>x.slot==='primary')?.slot||items[0]?.slot||'primary'));
  return {name:f.elements.name?.value?.trim()||'Product',brandLogo:String(brand?.logoUrl||'').trim(),brandName,details,listingCount,items,activeSlot:ppAdminMirrorActiveSlot};
}
const ppBlobDataCache=new Map();
function ppBlobToDataUrl(blobUrl){
  if(ppBlobDataCache.has(blobUrl))return ppBlobDataCache.get(blobUrl);
  const pr=new Promise(resolve=>{
    const im=new Image();
    im.onload=()=>{try{const m=1000,w0=im.naturalWidth||im.width,h0=im.naturalHeight||im.height;const k=Math.min(1,m/Math.max(w0,h0,1));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w0*k));c.height=Math.max(1,Math.round(h0*k));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/png'));}catch(e){resolve(blobUrl);}};
    im.onerror=()=>resolve(blobUrl);
    im.src=blobUrl;
  });
  ppBlobDataCache.set(blobUrl,pr);
  return pr;
}
let ppMirrorSeq=0;
function ppSendExactLiveMirror(preferSlot='primary'){
  const frame=byId('liveExactPreviewFrame');if(!frame?.contentWindow)return;
  const state=ppAdminExactMirrorState(preferSlot);if(!state)return;
  const seq=++ppMirrorSeq;
  const post=()=>{if(seq!==ppMirrorSeq)return;frame.contentWindow?.postMessage({type:'pp-admin-live-preview-state',state},'*');};
  const blobs=(state.items||[]).filter(it=>/^blob:/.test(String(it.src||'')));
  if(!blobs.length){post();return;}
  Promise.all(blobs.map(async it=>{it.src=await ppBlobToDataUrl(it.src);})).then(post,post);
}
window.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='pp-admin-live-preview-ready')ppSendExactLiveMirror(ppAdminMirrorActiveSlot);
  if(data.type==='pp-admin-live-preview-slot'&&data.slot){ppAdminMirrorActiveSlot=String(data.slot);}
  if(data.type==='pp-admin-live-preview-cut'){const b=byId('previewCutBadge');if(b)b.hidden=!data.cut;}
  if(data.type==='pp-admin-live-preview-height'){
    const frame=byId('liveExactPreviewFrame');const h=Math.max(620,Math.min(860,Number(data.height)||690));if(frame)frame.style.height=h+'px';
  }
});

function updateRangeReadouts(slot){
  const f=byId('productForm');if(!f)return;
  const values={scale:`${f.elements[`site_${slot}_scale`]?.value||100}%`,rotate:`${f.elements[`site_${slot}_rotate`]?.value||0}°`,x:`${f.elements[`site_${slot}_x`]?.value||0}`,y:`${f.elements[`site_${slot}_y`]?.value||0}`};
  for(const [key,value] of Object.entries(values)){const el=document.querySelector(`[data-range-value="site_${slot}_${key}"]`);if(el)el.textContent=value;}
}
function updateSiteImagePreview(slot){
  const state=previewSlotState(slot),cap=slot[0].toUpperCase()+slot.slice(1),img=byId(`site${cap}Preview`),box=byId(`site${cap}PreviewBox`);if(!state||!img||!box)return;
  updateRangeReadouts(slot);
  box.className=`site-image-preview ${state.bg}`;
  const empty=box.querySelector('.preview-empty');
  if(!state.src){img.hidden=true;img.removeAttribute('src');if(empty)empty.hidden=false;updateWebsitePreview(slot);return;}
  if(empty)empty.hidden=true;
  applyGlobalPreviewImage(img,state);
  img.onerror=()=>{img.hidden=true;if(empty)empty.hidden=false;};
  updateWebsitePreview(slot);
}
function websitePreviewItems(){
  const primary=previewSlotState('primary'),secondary=previewSlotState('secondary'),tertiary=previewSlotState('tertiary'),f=byId('productForm');
  const fallback=String(f?.elements.image_url?.value||'').trim();
  const selected=[];
  if(primary?.src)selected.push({slot:'primary',...primary});
  if(secondary?.src&&secondary.src!==primary?.src)selected.push({slot:'secondary',...secondary});
  if(tertiary?.src&&tertiary.src!==primary?.src&&tertiary.src!==secondary?.src)selected.push({slot:'tertiary',...tertiary});
  if(!selected.length&&fallback)selected.push({slot:'fallback',src:fallback,bg:'original',fit:'contain',position:'center',scale:100,rotate:0,x:0,y:0});
  return selected;
}
function showWebsitePreviewItem(item){
  const stage=byId('websitePreviewStage'),img=byId('productImagePreview'),empty=byId('websitePreviewEmpty');if(!stage||!img||!empty)return;
  stage.className=`website-preview-stage ${item?.bg||'original'}`;
  if(!item?.src){img.hidden=true;img.removeAttribute('src');empty.hidden=false;return;}
  empty.hidden=true;applyGlobalPreviewImage(img,item);
  img.onerror=()=>{img.hidden=true;empty.hidden=false;};
}
function updateWebsitePreview(preferSlot='primary'){
  const f=byId('productForm'),mode=byId('websitePreviewMode');if(!f)return;
  const items=websitePreviewItems();
  const primary=items.find(x=>x.slot==='primary')||items.find(x=>x.slot==='fallback')||items[0]||null;
  const active=items.find(x=>x.slot===preferSlot)||items.find(x=>x.slot===ppAdminMirrorActiveSlot)||primary;
  if(mode)mode.textContent=f.elements.site_image_mode?.value==='curated'?'Global · curated customer view':'Global · automatic/fallback preview';
  if(active?.slot)ppAdminMirrorActiveSlot=active.slot;
  updateGlobalSurfacePreviews(primary);
  ppSendExactLiveMirror(ppAdminMirrorActiveSlot);
}
function loadSiteImageFields(product){
  const f=byId('productForm');if(!f)return;
  const cfg=siteImageConfig(product);
  f.elements.site_image_mode.value=cfg.mode;
  for(const slot of ['primary','secondary','tertiary']){
    const c=cfg[slot];
    if(!f.elements[`site_${slot}_url`])continue;
    f.elements[`site_${slot}_url`].value=c.url;
    f.elements[`site_${slot}_bg`].value=c.bg;
    f.elements[`site_${slot}_fit`].value=c.fit;
    f.elements[`site_${slot}_position`].value=c.position;
    f.elements[`site_${slot}_scale`].value=c.scale;
    f.elements[`site_${slot}_rotate`].value=c.rotate;
    f.elements[`site_${slot}_x`].value=c.x;
    f.elements[`site_${slot}_y`].value=c.y;
    f.elements[`site_${slot}_source`].value=[...f.elements[`site_${slot}_source`].options].some(o=>o.value===c.url)?c.url:'';
    updateSiteImagePreview(slot);
  }
  updateWebsitePreview();
}
function bindSiteImageSource(slot){
  const f=byId('productForm'),sel=f?.elements[`site_${slot}_source`];if(!sel)return;
  sel.addEventListener('change',()=>{if(sel.value){f.elements[`site_${slot}_url`].value=sel.value;if(f.elements[`site_${slot}_file`])f.elements[`site_${slot}_file`].value='';updateSiteImagePreview(slot);}});
  for(const key of ['url','file','bg','fit','position','scale','rotate','x','y']){
    const el=f.elements[`site_${slot}_${key}`];if(!el)continue;
    el.addEventListener(['url','scale','rotate','x','y'].includes(key)?'input':'change',()=>{
      if(key==='url'&&sel.value&&el.value.trim()!==sel.value)sel.value='';
      if(key==='file'&&el.files?.[0])sel.value='';
      updateSiteImagePreview(slot);
    });
  }
}
function bindPopupIdentityPreview(){
  const f=byId('productForm');if(!f||f.dataset.popupIdentityPreviewBound==='1')return;
  f.dataset.popupIdentityPreviewBound='1';
  for(const name of ['name','brand_slug','category','model_code','variant']){
    const el=f.elements[name];if(!el)continue;
    el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>updateWebsitePreview());
  }
}

// Safe fallback so the existing dashboard still works before the V77 catalog migration is run.
const FALLBACK_PRODUCTS=[
  {id:'headphones',name:'boAt Rockerz Plus 450 ANC',brandSlug:'boat',brand:'boAt',category:'electronics',identityKey:'Rockerz Plus 450 ANC PA0056',modelCode:'PA0056',variant:'',imageUrl:'images/products/boat-rockerz-plus-450-anc.svg',status:'active',stores:[
    {slug:'amazon',name:'Amazon',url:'https://link.amazon/B09rE8I28',listingStatus:'active'},
    {slug:'flipkart',name:'Flipkart',url:'https://fktr.in/sqmj28f',listingStatus:'active'},
    {slug:'croma',name:'Croma',url:'https://www.croma.com/boat-rockerz-plus-450-pa0056-bluetooth-headphone-with-mic-hybrid-active-noise-cancellation-over-ear-black-sabre-/p/323337',listingStatus:'active'}]},
  {id:'airfryer',name:'PHILIPS Air Fryer NA120/00 4.2L',brandSlug:'philips',brand:'Philips',category:'appliances',identityKey:'NA120/00 4.2L',modelCode:'NA120/00',variant:'4.2L',imageUrl:'images/products/philips-na120-00.svg',status:'active',stores:[
    {slug:'amazon',name:'Amazon',url:'https://link.amazon/B02kj7cPY',listingStatus:'active'},
    {slug:'flipkart',name:'Flipkart',url:'https://fktr.in/Ea7E8ah',listingStatus:'active'},
    {slug:'croma',name:'Croma',url:'https://www.croma.com/philips-1000-4-2l-1500-watt-air-fryer-with-rapid-air-technology-black-/p/311802',listingStatus:'active'}]},
  {id:'oneplus-nord6',name:'OnePlus Nord 6',brandSlug:'oneplus',brand:'OnePlus',category:'mobiles',identityKey:'OnePlus Nord 6',modelCode:'Nord 6',variant:'',imageUrl:'images/products/oneplus-nord-6-v49.webp',status:'active',stores:[
    {slug:'amazon',name:'Amazon',url:'https://link.amazon/B0dnbxghN',listingStatus:'active'},
    {slug:'flipkart',name:'Flipkart',url:'https://fktr.in/DByRHI6',listingStatus:'active'},
    {slug:'croma',name:'Croma',url:'https://www.croma.com/oneplus-nord-6-5g-8gb-ram-256gb-fresh-mint-/p/322986',listingStatus:'active'}]},
  {id:'samsung-buds-core',name:'Samsung Galaxy Buds Core (White)',brandSlug:'samsung',brand:'Samsung',category:'electronics',identityKey:'Galaxy Buds Core White',modelCode:'Galaxy Buds Core',variant:'White',imageUrl:'images/products/samsung-buds-core-white-v49.webp',status:'active',stores:[
    {slug:'amazon',name:'Amazon',url:'https://link.amazon/B07c5Wf8K',listingStatus:'active'},
    {slug:'flipkart',name:'Flipkart',url:'https://fktr.in/sk5tIKQ',listingStatus:'active'}]},
  {id:'dell15',name:'Dell 15 Laptop',brandSlug:'dell',brand:'Dell',category:'laptops',identityKey:'Dell DC15250',modelCode:'DC15250',variant:'',imageUrl:'images/products/dell-dc15250.svg',status:'active',stores:[
    {slug:'amazon',name:'Amazon',url:'https://link.amazon/B09t594Ee',listingStatus:'active'},
    {slug:'flipkart',name:'Flipkart',url:'https://fktr.in/8hJBEP1',listingStatus:'active'},
    {slug:'croma',name:'Croma',url:'https://www.croma.com/dell-dc-15250-intel-core-3-thin-light-laptop-16gb-512gb-ssd-windows-11-15-6-inch-full-hd-display-ms-office-home-2024-carbon-black-1-66-kg-/p/317370',listingStatus:'active'}]},
  {id:'puma-smashic',name:'PUMA Smashic Comfort Sneakers',brandSlug:'puma',brand:'PUMA',category:'fashion',identityKey:'PUMA Smashic Comfort',modelCode:'Smashic Comfort',variant:'',imageUrl:'images/products/puma-smashic-white.svg',status:'active',stores:[
    {slug:'amazon',name:'Amazon',url:'https://link.amazon/B00WHXXe7',listingStatus:'active'},
    {slug:'flipkart',name:'Flipkart',url:'https://fktr.in/2a4k3yQ',listingStatus:'active'},
    {slug:'myntra',name:'Myntra',url:'https://myntr.it/I7bGbBg',listingStatus:'active'},
    {slug:'ajio',name:'AJIO',url:'https://ajiio.in/mz3X1gO',listingStatus:'active'}]},
  {id:'nutripro-500w',name:'NutriPro 500W Juicer Mixer',brandSlug:'nutripro',brand:'NutriPro',category:'appliances',identityKey:'NutriPro 500W Juicer Mixer',modelCode:'500W',variant:'',imageUrl:'images/products/nutripro-500w.svg',status:'active',stores:[
    {slug:'amazon',name:'Amazon',url:'https://link.amazon/B0i7Hj34t',listingStatus:'active'},
    {slug:'flipkart',name:'Flipkart',url:'https://fktr.in/WUocyOo',listingStatus:'active'},
    {slug:'myntra',name:'Myntra',url:'https://myntr.it/aykyjoe',listingStatus:'active'}]},
  {id:'dotkey-sunscreen',name:'Dot & Key Vitamin C+E Sunscreen',brandSlug:'dotkey',brand:'Dot & Key',category:'beauty',identityKey:'Vitamin C+E Sunscreen 50g',modelCode:'',variant:'50g',imageUrl:'images/products/dotkey-vitamin-ce-50g.svg',status:'active',stores:[
    {slug:'amazon',name:'Amazon',url:'https://link.amazon/B010WA6gz',listingStatus:'active'},
    {slug:'flipkart',name:'Flipkart',url:'https://fktr.in/o3QMuoP',listingStatus:'active'},
    {slug:'myntra',name:'Myntra',url:'https://myntr.it/Sjls3oF',listingStatus:'active'}]},
  {id:'dotkey-barrier-50g',name:'Dot & Key Barrier Repair Moisturizer 50g',brandSlug:'dotkey',brand:'Dot & Key',category:'beauty',identityKey:'Ceramides Hyaluronic Barrier Repair Moisturizer 50g',modelCode:'',variant:'50g',imageUrl:'images/products/dotkey-barrier-repair-50g.svg',status:'active',stores:[
    {slug:'amazon',name:'Amazon',url:'https://link.amazon/B00n4SgCn',listingStatus:'active'},
    {slug:'flipkart',name:'Flipkart',url:'https://fktr.in/vmPHyy1',listingStatus:'active'},
    {slug:'meesho',name:'Meesho',url:'https://www.meesho.com/af_invite/523430960:youtube_long_form:12035248?p_id=682268393&ext_id=ba7dnt&utm_source=youtube_long_form',listingStatus:'active'}]},
  {id:'boat-storm-call3',name:'boAt Storm Call 3',brandSlug:'boat',brand:'boAt',category:'watches',identityKey:'boAt Storm Call 3',modelCode:'Storm Call 3',variant:'',imageUrl:'images/products/boat-storm-call-3-v49.webp',status:'active',stores:[
    {slug:'amazon',name:'Amazon',url:'https://link.amazon/B0iRaCp4h',listingStatus:'active'},
    {slug:'flipkart',name:'Flipkart',url:'https://fktr.in/NXIHS6t',listingStatus:'active'},
    {slug:'myntra',name:'Myntra',url:'https://myntr.it/g0DjG3O',listingStatus:'active'}]}
];
const FALLBACK_BRANDS=[
  ['boat','boAt','logos/official/boat.svg'],['philips','Philips','logos/official/philips.svg'],['oneplus','OnePlus','logos/official/oneplus.png'],['samsung','Samsung','logos/samsung-wordmark.png'],['dell','Dell','logos/official/dell.svg'],['puma','PUMA','logos/official/puma-original.png'],['nutripro','NutriPro','logos/official/nutripro-clean.png'],['dotkey','Dot & Key','logos/official/dotkey.svg']
].map(([slug,name,logoUrl])=>({slug,name,logoUrl,websiteUrl:'',aliases:[],active:true}));
const FALLBACK_STORES=[
  ['amazon','Amazon','amazon.in','logos/amazon-logo.png'],['flipkart','Flipkart','flipkart.com','logos/flipkart-logo.png'],['croma','Croma','croma.com','logos/croma-wordmark.svg'],['myntra','Myntra','myntra.com','logos/myntra-logo.png'],['ajio','AJIO','ajio.com','logos/ajio-logo.png'],['meesho','Meesho','meesho.com','logos/meesho-wordmark.png']
].map(([slug,name,domain,logoUrl])=>({slug,name,domain,logoUrl,active:true}));

let user=null,permitted=false,rows=[],products=[],brands=[],stores=[],catalogListings=[],catalogReady=false,selectedId='oneplus-nord6';
const captures=new Map();
function msg(id,text,error=false){const el=byId(id);if(!el)return;el.textContent=text;el.className=error?'bad':'muted';}

// PricePulse V78.8.134 — Plus master override preserves individual membership state; adds explicit Individual Mode.
// Until the final Plus SQL is installed, this safely falls back to same-origin localStorage for UI testing.
function ppAdminPlusLocalKey(uid){return uid?`pp-plus-membership-v2:${uid}`:'';}
const PP_PLUS_MASTER_KEY='pp-plus-master-v1';
function ppAdminMasterReadLocal(){try{const raw=localStorage.getItem(PP_PLUS_MASTER_KEY);return raw?JSON.parse(raw):null}catch{return null}}
function ppAdminMasterWriteLocal(value){try{localStorage.setItem(PP_PLUS_MASTER_KEY,JSON.stringify(value));return true}catch{return false}}
function ppAdminMasterNormalize(v){v=String(v||'individual').toLowerCase();return ['active','inactive','individual'].includes(v)?v:'individual'}
function ppAdminPlusReadLocal(uid){try{const raw=localStorage.getItem(ppAdminPlusLocalKey(uid));return raw?JSON.parse(raw):null}catch{return null}}
function ppAdminPlusWriteLocal(uid,value){try{localStorage.setItem(ppAdminPlusLocalKey(uid),JSON.stringify(value));return true}catch{return false}}
// V78.8.132 local-file test bridge: file:// pages do not reliably share localStorage.
// Push the chosen test state into the PricePulse tab through a short-lived URL transfer.
function ppAdminPlusPushLocalTestToSite(uid,value){
  try{
    const url=new URL('index.html',location.href);
    url.searchParams.set('pp_plus_test',ppAdminPlusNormalize(value?.status));
    url.searchParams.set('pp_plus_uid',uid);
    if(value?.claimed_at)url.searchParams.set('pp_plus_claimed',value.claimed_at);
    if(value?.activated_at)url.searchParams.set('pp_plus_activated',value.activated_at);
    if(value?.expires_at)url.searchParams.set('pp_plus_expires',value.expires_at);
    const w=window.open(url.href,'pricepulse-main');
    try{w?.focus()}catch(_){}
    return Boolean(w);
  }catch(err){console.warn('Plus local test bridge failed',err);return false}
}
function ppAdminMasterPushLocalTestToSite(value){
  try{
    const url=new URL('index.html',location.href);
    url.searchParams.set('pp_plus_master',ppAdminMasterNormalize(value?.mode));
    if(value?.activated_at)url.searchParams.set('pp_plus_master_activated',value.activated_at);
    if(value?.expires_at)url.searchParams.set('pp_plus_master_expires',value.expires_at);
    const w=window.open(url.href,'pricepulse-main');
    try{w?.focus()}catch(_){}
    return Boolean(w);
  }catch(err){console.warn('Plus master local test bridge failed',err);return false}
}
function ppAdminPlusNormalize(v){v=String(v||'available').toLowerCase();return ['available','pending','active','expired'].includes(v)?v:'available'}
let ppAdminPlusCurrentRecord=null;
let ppAdminMasterCurrentRecord={mode:'individual'};
function ppAdminPlusRenderEffectiveState(){
  const box=byId('plusAdminState');if(!box||!ppAdminPlusCurrentRecord)return;
  const r=ppAdminPlusCurrentRecord||{status:'available'};const st=ppAdminPlusNormalize(r.status);const master=ppAdminMasterCurrentRecord||{mode:'individual'};const masterMode=ppAdminMasterNormalize(master.mode);
  const ownDetail=st==='active'?(r.expires_at?`Individual membership active until ${ppAdminPlusFmt(r.expires_at)}`:'Individual membership is active'):
    st==='pending'?(r.claimed_at?`Claimed ${ppAdminPlusFmt(r.claimed_at)} · waiting for eligible confirmed purchase`:'Claim reserved · waiting for eligible confirmed purchase'):
    st==='expired'?'Individual membership period completed':'Plus not claimed yet';
  if(masterMode==='inactive'){
    const detail=st==='active'?`${ownDetail}. Master OFF is temporarily pausing Plus system-wide; this individual status is preserved.`:`Master OFF is temporarily pausing Plus system-wide. Individual status remains ${st}.`;
    box.innerHTML=`<div><strong>${st==='active'?'PricePulse Plus active · paused by Master':'PricePulse Plus paused by Master'}</strong><small>${esc(detail)}</small></div><span class="plus-state-pill master-paused">PAUSED BY MASTER</span>`;
    return;
  }
  if(masterMode==='active'){
    const masterDetail=master.expires_at?`Master Plus is active until ${ppAdminPlusFmt(master.expires_at)}. Individual status (${st}) is preserved underneath.`:`Master Plus is active system-wide. Individual status (${st}) is preserved underneath.`;
    box.innerHTML=`<div><strong>PricePulse Plus active via Master</strong><small>${esc(masterDetail)}</small></div><span class="plus-state-pill master-active">ACTIVE VIA MASTER</span>`;
    return;
  }
  const detail=st==='active'?(r.expires_at?`Active until ${ppAdminPlusFmt(r.expires_at)}`:'Active membership'):
    st==='pending'?(r.claimed_at?`Claimed ${ppAdminPlusFmt(r.claimed_at)} · waiting for eligible confirmed purchase`:'Claim reserved · waiting for eligible confirmed purchase'):
    st==='expired'?'Membership period completed':'Plus not claimed yet';
  box.innerHTML=`<div><strong>${st==='active'?'PricePulse Plus active':st==='pending'?'Activation pending':st==='expired'?'Plus expired':'Plus available'}</strong><small>${esc(detail)}</small></div><span class="plus-state-pill ${esc(st)}">${esc(st)}</span>`;
}
function ppAdminPlusMissing(error){return Boolean(error&&(error.code==='PGRST202'||error.code==='PGRST205'||error.code==='42P01'||/function .* does not exist|schema cache|could not find the (function|table)|relation .* does not exist/i.test(String(error.message||''))))}
function ppAdminPlusExpiryFrom(start){const d=new Date(start||Date.now());d.setFullYear(d.getFullYear()+1);return d.toISOString()}
function ppAdminPlusFmt(v){if(!v)return'';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):''}
function ppAdminPlusRenderIdentity({uid='',name='',email=''}={}){
  const n=byId('plusSelectedName'),e=byId('plusSelectedEmail'),u=byId('plusSelectedUid');
  if(n)n.textContent=name||'Selected user';
  if(e)e.textContent=email||'Email unavailable for this target';
  if(u)u.textContent=uid||'—';
}
async function ppAdminPlusLoadIdentity(uid){
  uid=String(uid||'').trim();
  if(!uid){ppAdminPlusRenderIdentity({});return null}
  let identity={uid,name:'Selected user',email:''};
  if(user?.id===uid){identity.email=user.email||'';identity.name=(user.user_metadata?.full_name||user.user_metadata?.name||'My admin account').trim()||'My admin account'}
  if(api&&permitted){
    try{
      const rpc=await api.rpc('pp_admin_get_plus_user_identity',{target_user:uid});
      if(!rpc.error&&rpc.data){const row=Array.isArray(rpc.data)?rpc.data[0]:rpc.data;if(row){identity.name=row.full_name||identity.name;identity.email=row.email||identity.email;ppAdminPlusRenderIdentity(identity);return identity}}
    }catch(_){ }
    try{
      const q=await api.from('profiles').select('full_name,email').eq('id',uid).maybeSingle();
      if(!q.error&&q.data){identity.name=q.data.full_name||identity.name;identity.email=q.data.email||identity.email}
    }catch(_){ }
  }
  ppAdminPlusRenderIdentity(identity);return identity;
}
function ppAdminMasterRender(record=null,mode='local'){
  const r=record||{mode:'individual'};ppAdminMasterCurrentRecord=r;const state=ppAdminMasterNormalize(r.mode);const pill=byId('plusMasterPill');
  if(pill){pill.textContent=state==='active'?'ACTIVE ALL':state==='inactive'?'OFF ALL':'INDIVIDUAL';pill.className=`plus-master-pill ${state}`}
  ppAdminPlusRenderEffectiveState();
  const detail=state==='active'?(r.expires_at?`Master Plus is ON for all signed-in users until ${ppAdminPlusFmt(r.expires_at)}.`:'Master Plus is ON for all signed-in users.'):
    state==='inactive'?'Master Plus is OFF system-wide. Individual active records are temporarily overridden.':'No master override is set; individual purchase/admin membership rules apply.';
  msg('plusMasterMsg',`${detail} ${mode==='database'?'Database mode.':'Local test mode.'}`);
}
async function ppAdminMasterLoad(){
  if(api&&permitted){
    try{
      const q=await api.rpc('pp_admin_get_plus_master_control');
      if(!q.error){const row=Array.isArray(q.data)?q.data[0]:q.data;ppAdminMasterRender(row||{mode:'individual'},'database');return}
      if(!ppAdminPlusMissing(q.error))console.warn('Plus master status load failed',q.error);
    }catch(err){if(!ppAdminPlusMissing(err))console.warn('Plus master status load failed',err)}
  }
  let local=ppAdminMasterReadLocal()||{mode:'individual'};
  if(ppAdminMasterNormalize(local.mode)==='active'&&local.expires_at&&new Date(local.expires_at).getTime()<=Date.now()){local={mode:'individual',activated_at:null,expires_at:null,updated_at:new Date().toISOString()};ppAdminMasterWriteLocal(local)}
  ppAdminMasterRender(local,'local');
}
async function ppAdminMasterSetMode(targetMode){
  const mode=ppAdminMasterNormalize(targetMode);
  const btn=mode==='active'?byId('plusMasterActivate'):mode==='inactive'?byId('plusMasterDeactivate'):byId('plusMasterIndividual');const old=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent=mode==='active'?'Activating all…':mode==='inactive'?'Deactivating all…':'Restoring individual…'}
  if(api&&permitted){
    try{
      let q=await api.rpc('pp_admin_set_plus_master_mode',{target_mode:mode});
      if(q.error&&ppAdminPlusMissing(q.error)&&mode!=='individual')q=await api.rpc('pp_admin_set_plus_master_control',{make_active:mode==='active'});
      if(!q.error){const row=Array.isArray(q.data)?q.data[0]:q.data;ppAdminMasterRender(row||{mode},'database');msg('plusMasterMsg',mode==='active'?'Master Plus activated for all users for 1 year.':mode==='inactive'?'Master Plus paused system-wide. Individual memberships are preserved.':'Individual Mode restored. Each user now follows their own Plus membership state.');if(btn){btn.textContent=old;btn.disabled=false}return}
      if(!ppAdminPlusMissing(q.error)){msg('plusMasterMsg',q.error.message||'Could not update Master Plus.',true);if(btn){btn.textContent=old;btn.disabled=false}return}
    }catch(err){if(!ppAdminPlusMissing(err))console.warn('Plus master update failed',err)}
  }
  const now=new Date().toISOString();
  const next=mode==='active'?{mode:'active',activated_at:now,expires_at:ppAdminPlusExpiryFrom(now),updated_at:now}:mode==='inactive'?{mode:'inactive',activated_at:null,expires_at:null,updated_at:now}:{mode:'individual',activated_at:null,expires_at:null,updated_at:now};
  ppAdminMasterWriteLocal(next);const bridged=ppAdminMasterPushLocalTestToSite(next);ppAdminMasterRender(next,'local');
  const text=mode==='active'?'Master Plus ON for all users for exactly 1 year.':mode==='inactive'?'Master Plus OFF system-wide; individual membership records are preserved.':'Individual Mode restored; every user follows their own membership state.';
  msg('plusMasterMsg',`Local test: ${text}${bridged?' Synced to the PricePulse test tab.':''}`);
  if(btn){btn.textContent=old;btn.disabled=false}
}
function ppAdminPlusRender(record=null,mode='local'){
  const box=byId('plusAdminState'),modeEl=byId('plusAdminMode');if(!box)return;
  const r=record||{status:'available'};ppAdminPlusCurrentRecord=r;ppAdminPlusRenderEffectiveState();
  if(modeEl){modeEl.textContent=mode==='database'?'Database mode · protected admin control.':'Local test mode · final Plus SQL not installed yet.';modeEl.className=`plus-admin-mode ${mode==='database'?'database':'local'}`;}
  byId('plusActivate').disabled=false;byId('plusDeactivate').disabled=false;
}
async function ppAdminPlusLoad(){
  const uid=String(byId('plusUserId')?.value||'').trim();
  if(!uid){ppAdminPlusRenderIdentity({});msg('plusAdminMsg','Enter a user UUID or click “Use my admin account”.',true);return}
  await ppAdminPlusLoadIdentity(uid);
  msg('plusAdminMsg','Checking Plus status…');
  if(api&&permitted){
    try{
      const q=await api.rpc('pp_admin_get_plus_membership',{target_user:uid});
      if(!q.error){const row=Array.isArray(q.data)?q.data[0]:q.data;ppAdminPlusRender(row||{status:'available'},'database');msg('plusAdminMsg','Plus status loaded.');return}
      if(!ppAdminPlusMissing(q.error)){msg('plusAdminMsg',q.error.message||'Could not load Plus status.',true);return}
    }catch(err){if(!ppAdminPlusMissing(err)){console.warn('Plus admin status load failed',err)}}
  }
  ppAdminPlusRender(ppAdminPlusReadLocal(uid)||{status:'available'},'local');
  msg('plusAdminMsg','Local test status loaded. Open PricePulse in another tab with the same user to verify the account UI live.');
}
async function ppAdminPlusSet(makeActive){
  const uid=String(byId('plusUserId')?.value||'').trim();if(!uid){msg('plusAdminMsg','Select a user first.',true);return}
  const btn=makeActive?byId('plusActivate'):byId('plusDeactivate');const old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent=makeActive?'Activating…':'Deactivating…'}
  if(api&&permitted){
    try{
      const q=await api.rpc('pp_admin_set_plus_membership',{target_user:uid,make_active:makeActive});
      if(!q.error){const row=Array.isArray(q.data)?q.data[0]:q.data;ppAdminPlusRender(row||{},'database');msg('plusAdminMsg',makeActive?'Plus activated for 1 year.':'Plus deactivated and returned to pending.');if(btn){btn.textContent=old;btn.disabled=false}return}
      if(!ppAdminPlusMissing(q.error)){msg('plusAdminMsg',q.error.message||'Could not update Plus membership.',true);if(btn){btn.textContent=old;btn.disabled=false}return}
    }catch(err){if(!ppAdminPlusMissing(err))console.warn('Plus admin update failed',err)}
  }
  const prev=ppAdminPlusReadLocal(uid)||{};const now=new Date().toISOString();
  const next=makeActive
    ?{status:'active',claimed_at:prev.claimed_at||now,activated_at:now,expires_at:ppAdminPlusExpiryFrom(now),activation_source:'admin_local_test'}
    :{status:'pending',claimed_at:prev.claimed_at||now,activated_at:null,expires_at:null,activation_source:'admin_local_test'};
  ppAdminPlusWriteLocal(uid,next);
  const bridged=ppAdminPlusPushLocalTestToSite(uid,next);
  ppAdminPlusRender(next,'local');
  msg('plusAdminMsg',makeActive
    ?(bridged?'Local test: Plus activated for exactly 1 year and synced to the PricePulse test tab.':'Local test: Plus activated for exactly 1 year. Open index.html to verify.')
    :(bridged?'Local test: Plus deactivated to pending and synced to the PricePulse test tab.':'Local test: Plus deactivated and returned to pending. Open index.html to verify.'));
  if(btn){btn.textContent=old;btn.disabled=false}
}

// PricePulse V78.8.136 — Wallet + referral reward engine test console.
// Final production writes use protected RPCs. Until that SQL is installed, this mirrors the same
// state in localStorage so the complete ₹100 + ₹100 progression can be verified safely.
const PP_WALLET_REF_CODE_MAP='pp_wallet_referral_code_map_v1';
const PP_WALLET_REFERRALS='pp_wallet_referrals_local_v1';
const PP_WALLET_TX='pp_wallet_transactions_local_v1';
const PP_WALLET_EVENTS='pp_wallet_referral_events_local_v1';
const PP_WALLET_REDEMPTIONS='pp_wallet_redemptions_local_v1';
function ppWalletReadJson(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function ppWalletWriteJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function ppWalletId(){try{return crypto.randomUUID()}catch{return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`}}
function ppWalletMoney(v){return `₹${Math.max(0,Number(v||0)).toLocaleString('en-IN',{maximumFractionDigits:2})}`}
function ppWalletCodeFor(uid){return uid?`PULSE${String(uid).replace(/-/g,'').slice(0,8).toUpperCase()}`:''}
function ppWalletInputs(){
  return {
    referrer:String(byId('walletReferrerId')?.value||'').trim(),
    friend:String(byId('walletFriendId')?.value||'').trim(),
    orderRef:String(byId('walletOrderRef')?.value||'').trim()||'TEST-ORDER-001',
    commission:Math.max(0,Number(byId('walletCommission')?.value||0))
  };
}
function ppWalletValidatePair(){
  const x=ppWalletInputs();
  if(!x.referrer||!x.friend){msg('walletAdminMsg','Enter both Referrer UUID and Friend UUID.',true);return null}
  if(x.referrer===x.friend){msg('walletAdminMsg','Self-referral blocked: Referrer and Friend must be different users.',true);return null}
  return x;
}
function ppWalletSlabFromCommission(totalCommission){
  const pool=Math.max(0,Number(totalCommission||0))*.5,ratio=pool/200;
  const slab=ratio>=1?1:ratio>=.75?.75:ratio>=.5?.5:ratio>=.25?.25:ratio>=.1?.1:0;
  return {pool,slab,each:100*slab};
}
function ppWalletLocalReferral(referrer,friend){return ppWalletReadJson(PP_WALLET_REFERRALS,[]).find(r=>String(r.referrer_user_id)===String(referrer)&&String(r.referred_user_id)===String(friend))||null}
function ppWalletPayloadForUser(uid){
  uid=String(uid||'').trim();
  const refs=ppWalletReadJson(PP_WALLET_REFERRALS,[]).filter(r=>String(r.referrer_user_id)===uid||String(r.referred_user_id)===uid);
  const refIds=new Set(refs.map(r=>String(r.id)));
  const transactions=ppWalletReadJson(PP_WALLET_TX,[]).filter(r=>String(r.user_id)===uid);
  const redemptions=ppWalletReadJson(PP_WALLET_REDEMPTIONS,[]).filter(r=>String(r.user_id)===uid);
  const events=ppWalletReadJson(PP_WALLET_EVENTS,[]).filter(e=>refIds.has(String(e.referral_id)));
  const allMap=ppWalletReadJson(PP_WALLET_REF_CODE_MAP,{}),codeMap={};
  Object.entries(allMap).forEach(([k,v])=>{if(String(v?.user_id||'')===uid)codeMap[k]=v});
  return {referrals:refs,transactions,events,redemptions,codeMap};
}
function ppWalletResetLocalUser(uid){
  uid=String(uid||'').trim();if(!uid)throw new Error('Enter User UUID.');
  const refsAll=ppWalletReadJson(PP_WALLET_REFERRALS,[]);
  const removed=refsAll.filter(r=>String(r.referrer_user_id)===uid||String(r.referred_user_id)===uid);
  const removedIds=new Set(removed.map(r=>String(r.id)));
  ppWalletWriteJson(PP_WALLET_REFERRALS,refsAll.filter(r=>!removedIds.has(String(r.id))));
  ppWalletWriteJson(PP_WALLET_EVENTS,ppWalletReadJson(PP_WALLET_EVENTS,[]).filter(e=>!removedIds.has(String(e.referral_id))));
  ppWalletWriteJson(PP_WALLET_TX,ppWalletReadJson(PP_WALLET_TX,[]).filter(t=>String(t.user_id)!==uid&&!removedIds.has(String(t.source_ref||'').split(':')[1]||'')));
  ppWalletWriteJson(PP_WALLET_REDEMPTIONS,ppWalletReadJson(PP_WALLET_REDEMPTIONS,[]).filter(r=>String(r.user_id)!==uid));
  const map=ppWalletReadJson(PP_WALLET_REF_CODE_MAP,{});Object.keys(map).forEach(k=>{if(String(map[k]?.user_id||'')===uid)delete map[k]});ppWalletWriteJson(PP_WALLET_REF_CODE_MAP,map);
}

function ppWalletLocalEnsureReferral(referrer,friend){
  if(!referrer||!friend||referrer===friend)throw new Error('Self-referral is not allowed.');
  const refs=ppWalletReadJson(PP_WALLET_REFERRALS,[]);
  const other=refs.find(r=>String(r.referred_user_id)===String(friend)&&String(r.referrer_user_id)!==String(referrer));
  if(other)throw new Error('This friend is already linked to another referrer.');
  let r=refs.find(r=>String(r.referrer_user_id)===String(referrer)&&String(r.referred_user_id)===String(friend));
  const now=new Date().toISOString();
  if(!r){r={id:ppWalletId(),referrer_user_id:referrer,referred_user_id:friend,referral_code:ppWalletCodeFor(referrer),status:'joined',referrer_target:100,referrer_unlocked:0,friend_target:100,friend_unlocked:0,shopping_started:false,created_at:now,updated_at:now};refs.push(r);ppWalletWriteJson(PP_WALLET_REFERRALS,refs)}
  const map=ppWalletReadJson(PP_WALLET_REF_CODE_MAP,{});if(!map[r.referral_code])map[r.referral_code]={user_id:referrer,name:'PricePulse user',email:'',updated_at:now};ppWalletWriteJson(PP_WALLET_REF_CODE_MAP,map);
  const tx=ppWalletReadJson(PP_WALLET_TX,[]);
  if(!tx.some(t=>String(t.source_ref)===`ref:${r.id}:referrer`))tx.push({id:ppWalletId(),user_id:referrer,entry_type:'referral_reward',title:'Referral Reward',amount:0,status:'pending',target_amount:100,unlocked_amount:0,source_ref:`ref:${r.id}:referrer`,note:'₹100 target · waiting for eligible confirmed shopping.',created_at:now,updated_at:now});
  if(!tx.some(t=>String(t.source_ref)===`ref:${r.id}:friend`))tx.push({id:ppWalletId(),user_id:friend,entry_type:'welcome_referral_reward',title:'Welcome Reward',amount:0,status:'pending',target_amount:100,unlocked_amount:0,source_ref:`ref:${r.id}:friend`,note:'₹100 welcome target · waiting for eligible confirmed shopping.',created_at:now,updated_at:now});
  ppWalletWriteJson(PP_WALLET_TX,tx);return r;
}
function ppWalletLocalEvent(referralId,orderRef,create=true){
  const events=ppWalletReadJson(PP_WALLET_EVENTS,[]);let ev=events.find(e=>String(e.referral_id)===String(referralId)&&String(e.order_ref)===String(orderRef));
  if(!ev&&create){const now=new Date().toISOString();ev={id:ppWalletId(),referral_id:referralId,order_ref:orderRef,commission_amount:0,purchase_confirmed:false,return_window_clear:false,commission_confirmed:false,reversed:false,created_at:now,updated_at:now};events.push(ev);ppWalletWriteJson(PP_WALLET_EVENTS,events)}
  return ev||null;
}
function ppWalletLocalRecalculate(referralId){
  const refs=ppWalletReadJson(PP_WALLET_REFERRALS,[]),r=refs.find(x=>String(x.id)===String(referralId));if(!r)return null;
  const events=ppWalletReadJson(PP_WALLET_EVENTS,[]).filter(e=>String(e.referral_id)===String(referralId));
  const eligible=events.filter(e=>e.purchase_confirmed&&e.return_window_clear&&e.commission_confirmed&&!e.reversed);
  const totalCommission=eligible.reduce((sum,e)=>sum+Math.max(0,Number(e.commission_amount||0)),0);
  const reward=ppWalletSlabFromCommission(totalCommission),started=events.some(e=>e.purchase_confirmed&&!e.reversed);
  r.shopping_started=started;r.referrer_unlocked=reward.each;r.friend_unlocked=reward.each;r.status=reward.each>=100?'reward_unlocked':started?'shopping_started':'joined';r.updated_at=new Date().toISOString();ppWalletWriteJson(PP_WALLET_REFERRALS,refs);
  const tx=ppWalletReadJson(PP_WALLET_TX,[]),now=new Date().toISOString();
  for(const t of tx){
    if(String(t.source_ref)!==`ref:${r.id}:referrer`&&String(t.source_ref)!==`ref:${r.id}:friend`)continue;
    t.unlocked_amount=reward.each;t.amount=reward.each;t.status=reward.each>0?'available':'pending';
    t.note=reward.each>=100?'₹100 reward fully unlocked.':reward.each>0?`${ppWalletMoney(reward.each)} unlocked · ${ppWalletMoney(100-reward.each)} still pending.`:'Waiting for purchase + return-clear + confirmed commission.';
    t.updated_at=now;
  }
  ppWalletWriteJson(PP_WALLET_TX,tx);return {referral:r,events,totalCommission,pool:reward.pool,each:reward.each};
}
function ppWalletLocalSetStage(stage){
  const x=ppWalletValidatePair();if(!x)return null;
  const r=ppWalletLocalEnsureReferral(x.referrer,x.friend),events=ppWalletReadJson(PP_WALLET_EVENTS,[]);
  let ev=events.find(e=>String(e.referral_id)===String(r.id)&&String(e.order_ref)===String(x.orderRef));
  const now=new Date().toISOString();
  if(!ev){ev={id:ppWalletId(),referral_id:r.id,order_ref:x.orderRef,commission_amount:0,purchase_confirmed:false,return_window_clear:false,commission_confirmed:false,reversed:false,created_at:now,updated_at:now};events.push(ev)}
  if(stage==='purchase'){ev.purchase_confirmed=true;ev.reversed=false}
  if(stage==='return_clear'){ev.return_window_clear=true;ev.reversed=false}
  if(stage==='commission'){ev.commission_amount=x.commission;ev.commission_confirmed=true;ev.reversed=false}
  if(stage==='reverse'){ev.reversed=true}
  ev.updated_at=now;ppWalletWriteJson(PP_WALLET_EVENTS,events);return ppWalletLocalRecalculate(r.id);
}
function ppWalletRenderTestState(state=null,mode='local'){
  const x=ppWalletInputs(),box=byId('walletAdminState'),pill=byId('walletAdminModePill');if(!box)return;
  const r=state?.referral||null,events=Array.isArray(state?.events)?state.events:[],ev=events.find(e=>String(e.order_ref)===String(x.orderRef))||events[events.length-1]||null;
  const unlockedRef=Number(r?.referrer_unlocked||state?.referrer_unlocked||0),unlockedFriend=Number(r?.friend_unlocked||state?.friend_unlocked||0);
  const totalCommission=Number(state?.totalCommission??state?.total_commission??events.filter(e=>e.purchase_confirmed&&e.return_window_clear&&e.commission_confirmed&&!e.reversed).reduce((a,e)=>a+Number(e.commission_amount||0),0));
  const pool=Math.max(0,totalCommission*.5);
  const title=state?.error?'Referral test unavailable':r?'₹100 + ₹100 referral linked':'No referral created yet';
  const detail=state?.error?state.error:r?`Referrer ${String(r.referrer_user_id||x.referrer).slice(0,8)}… → Friend ${String(r.referred_user_id||x.friend).slice(0,8)}… · current order ${x.orderRef}`:'Create the referral first, then move through the three confirmation stages.';
  box.querySelector('.wallet-test-state-top strong').textContent=title;box.querySelector('.wallet-test-state-top small').textContent=detail;
  const set=(id,on,warn=false)=>{const el=byId(id);if(el)el.className=`wallet-test-pill${on?' done':warn?' warn':''}`};
  set('walletJoinedPill',Boolean(r));set('walletPurchasePill',Boolean(ev?.purchase_confirmed));set('walletReturnPill',Boolean(ev?.return_window_clear));set('walletCommissionPill',Boolean(ev?.commission_confirmed));
  byId('walletReferrerUnlocked').textContent=ppWalletMoney(unlockedRef);byId('walletFriendUnlocked').textContent=ppWalletMoney(unlockedFriend);byId('walletRewardPool').textContent=ppWalletMoney(pool);
  if(pill){pill.textContent=mode==='database'?'DATABASE':'LOCAL TEST';pill.className=`plus-state-pill ${mode==='database'?'active':'available'}`}
}
async function ppWalletAdminLoadState(){
  const x=ppWalletValidatePair();if(!x){ppWalletRenderTestState();return}
  if(api&&permitted){
    try{
      const q=await api.rpc('pp_admin_wallet_get_test_state',{referrer_user:x.referrer,referred_user:x.friend});
      if(!q.error){const out=Array.isArray(q.data)?q.data[0]:q.data;ppWalletRenderTestState(out||null,'database');msg('walletAdminMsg','Wallet/referral state loaded from database.');return}
      if(!ppAdminPlusMissing(q.error)){msg('walletAdminMsg',q.error.message||'Could not load Wallet test state.',true);return}
    }catch(err){if(!ppAdminPlusMissing(err))console.warn('Wallet test state load failed',err)}
  }
  const r=ppWalletLocalReferral(x.referrer,x.friend),state=r?ppWalletLocalRecalculate(r.id):null;ppWalletRenderTestState(state,'local');msg('walletAdminMsg','Local Wallet test state loaded. Final SQL is not installed yet.');
}
async function ppWalletAdminCreate(){
  const x=ppWalletValidatePair();if(!x)return;
  if(api&&permitted){
    try{
      const q=await api.rpc('pp_admin_wallet_create_test_referral',{referrer_user:x.referrer,referred_user:x.friend});
      if(!q.error){await ppWalletAdminLoadState();msg('walletAdminMsg','₹100 + ₹100 test referral created.');return}
      if(!ppAdminPlusMissing(q.error)){msg('walletAdminMsg',q.error.message||'Could not create test referral.',true);return}
    }catch(err){if(!ppAdminPlusMissing(err))console.warn('Wallet referral create failed',err)}
  }
  try{const r=ppWalletLocalEnsureReferral(x.referrer,x.friend);ppWalletRenderTestState(ppWalletLocalRecalculate(r.id),'local');msg('walletAdminMsg','Local test: ₹100 referrer + ₹100 friend reward created as Pending.')}catch(err){msg('walletAdminMsg',err.message||String(err),true)}
}
async function ppWalletAdminStage(stage){
  const x=ppWalletValidatePair();if(!x)return;
  if(api&&permitted){
    try{
      const q=await api.rpc('pp_admin_wallet_update_test_purchase',{referrer_user:x.referrer,referred_user:x.friend,order_reference:x.orderRef,stage_name:stage,commission_value:x.commission});
      if(!q.error){await ppWalletAdminLoadState();const labels={purchase:'Purchase confirmed.',return_clear:'Return/cancellation window cleared.',commission:'Commission confirmed and reward recalculated.',reverse:'Order reversed/cancelled; related reward progress recalculated.'};msg('walletAdminMsg',labels[stage]||'Wallet test updated.');return}
      if(!ppAdminPlusMissing(q.error)){msg('walletAdminMsg',q.error.message||'Could not update Wallet test.',true);return}
    }catch(err){if(!ppAdminPlusMissing(err))console.warn('Wallet test stage failed',err)}
  }
  try{const state=ppWalletLocalSetStage(stage);ppWalletRenderTestState(state,'local');const labels={purchase:'Local test: purchase confirmed.',return_clear:'Local test: return/cancellation window cleared.',commission:'Local test: commission confirmed and rewards recalculated.',reverse:'Local test: order returned/cancelled and related reward progress reversed.'};msg('walletAdminMsg',labels[stage]||'Local Wallet test updated.')}catch(err){msg('walletAdminMsg',err.message||String(err),true)}
}
function ppWalletOpenTestWallet(which){
  const x=ppWalletValidatePair();if(!x)return;const uid=which==='referrer'?x.referrer:x.friend;
  try{
    const payload=ppWalletPayloadForUser(uid);
    const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const url=new URL('wallet.html',location.href);url.searchParams.set('pp_wallet_test','1');url.searchParams.set('pp_wallet_uid',uid);url.searchParams.set('pp_wallet_payload',encoded);
    const w=window.open(url.href,'pricepulse-wallet');try{w?.focus()}catch(_){ }
    msg('walletAdminMsg',`Opened Wallet test for the ${which}. The Wallet must be signed in as that same user UUID to display the transferred local state.`);
  }catch(err){msg('walletAdminMsg','Could not open Wallet test: '+(err.message||err),true)}
}


// V78.8.138 — Manual voucher issuance test console.
function ppVoucherInputs(){return {userId:String(byId('voucherUserId')?.value||'').trim(),retailer:String(byId('voucherRetailer')?.value||'').trim()||'Croma',amount:Math.max(0,Number(byId('voucherAmount')?.value||0)),code:String(byId('voucherCode')?.value||'').trim(),expiry:String(byId('voucherExpiry')?.value||'').trim(),redemptionId:String(byId('voucherRedemptionId')?.value||'').trim()}}
function ppVoucherRender(row=null,mode='local'){const box=byId('voucherAdminState'),pill=byId('voucherAdminModePill');if(!box)return;const strong=box.querySelector('strong'),small=box.querySelector('small');if(!row){strong.textContent='No voucher issued yet';small.textContent='Enter the target user and voucher details. Production issuance should reference the user\'s locked redemption.'}else{const used=Boolean(row.voucher_used_at),exp=row.voucher_expires_at?new Date(row.voucher_expires_at):null,expired=exp&&Number.isFinite(exp.getTime())&&exp.getTime()<Date.now();strong.textContent=`${row.retailer||'Retailer'} · ₹${Number(row.amount||0).toLocaleString('en-IN')} · ${used?'USED':expired?'EXPIRED':'ACTIVE'}`;small.textContent=`Code ${row.voucher_ref||'—'} · User ${String(row.user_id||'').slice(0,8)}…${exp?' · expires '+exp.toLocaleDateString('en-IN'):''}`}if(pill){pill.textContent=mode==='database'?'DATABASE':'LOCAL TEST';pill.className=`plus-state-pill ${mode==='database'?'active':'available'}`}}
function ppVoucherLocalIssue(x){if(!x.userId)throw new Error('Enter User UUID.');if(!x.code)throw new Error('Enter the voucher code.');if(!(x.amount>0))throw new Error('Enter a valid voucher amount.');const rows=ppWalletReadJson(PP_WALLET_REDEMPTIONS,[]),now=new Date().toISOString();let r=x.redemptionId?rows.find(v=>String(v.id)===String(x.redemptionId)):null;if(!r&&!x.redemptionId){const candidates=rows.filter(v=>String(v.user_id)===String(x.userId)&&String(v.retailer||'').toLowerCase()===String(x.retailer||'').toLowerCase()&&Math.abs(Number(v.amount||0)-Number(x.amount||0))<.001&&['locked','requested','issued'].includes(String(v.status||''))).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));r=candidates[0]||null;if(r&&byId('voucherRedemptionId'))byId('voucherRedemptionId').value=r.id}if(!r)throw new Error('No matching locked redemption found. Start Redeem & Shop first, or paste its Redemption ID. Manual voucher issuance must fulfill an existing wallet redemption and never debit the Wallet twice.');if(String(r.user_id)!==String(x.userId))throw new Error('Redemption belongs to a different user.');if(!['locked','requested','issued'].includes(String(r.status||'')))throw new Error('Redemption is not eligible for voucher issuance.');r.retailer=x.retailer||r.retailer;r.amount=Number(r.amount||x.amount);r.status='issued';r.updated_at=now;r.voucher_ref=x.code;r.voucher_source='manual';r.voucher_issued_at=now;r.voucher_expires_at=x.expiry?new Date(x.expiry+'T23:59:59').toISOString():null;r.voucher_used_at=null;ppWalletWriteJson(PP_WALLET_REDEMPTIONS,rows);const tx=ppWalletReadJson(PP_WALLET_TX,[]);const t=tx.find(v=>String(v.source_ref)===`redeem:${r.id}`);if(t){t.status='used';t.note=`${x.retailer} voucher fulfilled • ${x.code}`;t.updated_at=now;ppWalletWriteJson(PP_WALLET_TX,tx)}return r}
async function ppVoucherIssue(){const x=ppVoucherInputs(),btn=byId('voucherIssueBtn'),old=btn?.textContent;try{if(!x.userId)throw new Error('Enter User UUID.');if(!x.code)throw new Error('Enter the voucher code.');if(!(x.amount>0))throw new Error('Enter a valid voucher amount.');if(btn){btn.disabled=true;btn.textContent='Issuing…'}if(api&&permitted){try{let q=await api.rpc('pp_admin_wallet_issue_voucher_v141',{target_user:x.userId,target_retailer:x.retailer,target_amount:x.amount,voucher_reference:x.code,voucher_expiry:x.expiry?new Date(x.expiry+'T23:59:59').toISOString():null,voucher_source_value:'manual',redemption_id:x.redemptionId||null});if(q.error&&ppAdminPlusMissing(q.error)&&x.redemptionId)q=await api.rpc('pp_admin_wallet_issue_voucher_v138',{redemption_id:x.redemptionId,voucher_reference:x.code,voucher_expiry:x.expiry?new Date(x.expiry+'T23:59:59').toISOString():null,voucher_source_value:'manual'});if(!q.error&&q.data){const row=Array.isArray(q.data)?q.data[0]:q.data;if(byId('voucherRedemptionId')&&row?.id)byId('voucherRedemptionId').value=row.id;ppVoucherRender(row,'database');msg('voucherAdminMsg','Voucher fulfilled against the existing Wallet redemption. No second debit was created.');return}if(q.error&&!ppAdminPlusMissing(q.error))throw q.error}catch(err){if(!ppAdminPlusMissing(err))throw err}}const row=ppVoucherLocalIssue(x);ppVoucherRender(row,'local');msg('voucherAdminMsg','Local test: voucher attached to the existing redemption. No second Wallet debit was created. Open the user Wallet to verify My Vouchers.')}catch(err){msg('voucherAdminMsg',err.message||String(err),true)}finally{if(btn){btn.disabled=false;btn.textContent=old}}}
function ppVoucherLastForUser(uid){return ppWalletReadJson(PP_WALLET_REDEMPTIONS,[]).filter(r=>String(r.user_id)===String(uid)&&String(r.status)==='issued'&&r.voucher_ref).sort((a,b)=>String(b.voucher_issued_at||b.updated_at||'').localeCompare(String(a.voucher_issued_at||a.updated_at||'')))[0]||null}
async function ppVoucherMarkUsed(){const x=ppVoucherInputs();if(!x.userId){msg('voucherAdminMsg','Enter User UUID.',true);return}if(api&&permitted){try{let q=await api.rpc('pp_admin_wallet_mark_voucher_used_v141',{target_user:x.userId,redemption_id:x.redemptionId||null});if(q.error&&ppAdminPlusMissing(q.error)&&x.redemptionId)q=await api.rpc('pp_admin_wallet_mark_voucher_used_v138',{redemption_id:x.redemptionId});if(!q.error&&q.data){const r=Array.isArray(q.data)?q.data[0]:q.data;if(byId('voucherRedemptionId')&&r?.id)byId('voucherRedemptionId').value=r.id;ppVoucherRender(r,'database');msg('voucherAdminMsg','Voucher marked used in database.');return}if(q.error&&!ppAdminPlusMissing(q.error)){msg('voucherAdminMsg',q.error.message||'Could not mark voucher used.',true);return}}catch(err){if(!ppAdminPlusMissing(err)){msg('voucherAdminMsg',err.message||String(err),true);return}}}let r=ppVoucherLastForUser(x.userId);if(!r){msg('voucherAdminMsg','No issued voucher found for this user.',true);return}const rows=ppWalletReadJson(PP_WALLET_REDEMPTIONS,[]),row=rows.find(v=>String(v.id)===String(r.id));row.voucher_used_at=new Date().toISOString();row.updated_at=row.voucher_used_at;ppWalletWriteJson(PP_WALLET_REDEMPTIONS,rows);ppVoucherRender(row,'local');msg('voucherAdminMsg','Local test: voucher marked USED.')}
function ppVoucherOpenWallet(){const x=ppVoucherInputs();if(!x.userId){msg('voucherAdminMsg','Enter User UUID.',true);return}try{const payload=ppWalletPayloadForUser(x.userId);const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));const url=new URL('wallet.html',location.href);url.searchParams.set('pp_wallet_test','1');url.searchParams.set('pp_wallet_uid',x.userId);url.searchParams.set('pp_wallet_payload',encoded);url.hash='vouchers';const w=window.open(url.href,'pricepulse-wallet');try{w?.focus()}catch(_){}msg('voucherAdminMsg','Opened Wallet with the latest local voucher state.')}catch(err){msg('voucherAdminMsg','Could not open Wallet: '+(err.message||err),true)}}

function ppVoucherResetTestUser(){const x=ppVoucherInputs();if(!x.userId){msg('voucherAdminMsg','Enter User UUID.',true);return}if(!confirm('Reset local test Wallet data for this UUID? This only clears local test data, not Supabase.'))return;try{ppWalletResetLocalUser(x.userId);ppVoucherRender(null,'local');msg('voucherAdminMsg','Local test Wallet reset for this user. Open User Wallet to verify a clean ₹0 state.');const wid=byId('walletFriendId');if(wid&&String(wid.value||'').trim()===String(x.userId))ppWalletRenderTestState(null,'local')}catch(err){msg('voucherAdminMsg',err.message||String(err),true)}}
function productById(id){return products.find(p=>p.id===id);}
function storeBySlug(slug){return stores.find(s=>s.slug===slug);}
function brandBySlug(slug){return brands.find(b=>b.slug===slug);}
function rowFor(productId,retailer){return rows.find(r=>r.product_id===productId&&String(r.retailer).toLowerCase()===String(retailer).toLowerCase());}
function isFresh(row){return Boolean(row?.published&&row?.display_permitted&&new Date(row.expires_at)>new Date()&&new Date(row.checked_at)<=new Date());}
function liveStores(product){return (product.stores||[]).filter(s=>['active','out_of_stock'].includes(s.listingStatus||'active'));}
function productStats(product){
  const live=liveStores(product);const checked=live.map(s=>rowFor(product.id,s.name));
  const fresh=checked.filter(isFresh).length;const freshInStock=checked.filter(r=>isFresh(r)&&r.availability==='in_stock').length;
  const never=checked.filter(r=>!r).length;const due=checked.filter(r=>r&&!isFresh(r)).length;
  return {fresh,freshInStock,never,due,total:live.length,ready:freshInStock>=2,tracking:(product.stores||[]).filter(s=>['not_listed','track_only'].includes(s.listingStatus)).length};
}
function fmtDate(v){if(!v)return'';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('en-IN'):'';}
function statusLabel(product){const s=productStats(product);if(product.status==='draft')return {text:'Archived',cls:'partial'};if(product.status==='tracking'||(!s.total&&s.tracking))return {text:'Tracking / unavailable',cls:'partial'};if(s.ready&&s.fresh===s.total)return {text:`Ready · ${s.fresh}/${s.total} fresh`,cls:'ready'};if(s.ready)return {text:`Best Price ready · ${s.fresh}/${s.total} fresh`,cls:'partial'};if(s.fresh)return {text:`Needs review · ${s.fresh}/${s.total} fresh`,cls:'due'};return {text:s.total&&s.never===s.total?'Never checked':s.total?'Expired / due':'No live retailers',cls:'due'};}
function summary(){const stats=products.map(productStats);const ready=stats.filter(s=>s.ready).length;const fresh=stats.reduce((a,s)=>a+s.fresh,0);const total=stats.reduce((a,s)=>a+s.total,0);const due=stats.reduce((a,s)=>a+s.due+s.never,0);byId('sumReady').textContent=`${ready}/${products.length}`;byId('sumFresh').textContent=`${fresh}/${total}`;byId('sumDue').textContent=String(due);byId('sumCatalog').textContent=String(products.length);}

function normalizeText(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9.+/ ]+/g,' ').replace(/\s+/g,' ').trim();}
const STOP=new Set(['the','with','and','for','of','in','on','a','an','new','latest','buy','online','india','price','product']);
function tokenSet(s){return new Set(normalizeText(s).split(' ').filter(t=>t.length>1&&!STOP.has(t)));}
function compact(s){return normalizeText(s).replace(/[^a-z0-9]/g,'');}
function extractVariantTokens(s){const text=normalizeText(s);const out=[];const re=/(\d+(?:\.\d+)?)\s*(tb|gb|mb|kg|g|ml|l|mm|cm|inch|inches|w|mah)\b/g;let m;while((m=re.exec(text)))out.push(`${m[1]}${m[2]}`);return [...new Set(out)];}
function productMatch(product,capture={}){
  const brand=brandBySlug(product.brandSlug)?.name||product.brand||'';
  const canonical=[brand,product.name,product.identityKey,product.modelCode,product.variant].filter(Boolean).join(' ');
  const observed=[capture.title,capture.brand,capture.model,capture.variant,capture.sku].filter(Boolean).join(' ');
  if(!normalizeText(observed))return {status:'unverified',score:0,detail:'No captured retailer title yet. Paste capture or enter the retailer title manually.'};
  const ct=tokenSet(canonical),ot=tokenSet(observed);let hit=0;ct.forEach(t=>{if(ot.has(t)||compact(observed).includes(compact(t)))hit++;});
  const score=ct.size?hit/ct.size:0;
  const model=compact(product.modelCode||'');const capturedModel=compact(capture.model||'');const hay=compact(observed);
  // Retailer SKU/ASIN is an external listing identifier, not necessarily the manufacturer's model name.
  // Only an explicitly captured model may hard-fail the canonical model check.
  if(model&&capturedModel&&capturedModel!==model&&!capturedModel.includes(model)&&!model.includes(capturedModel)&&!hay.includes(model))return {status:'mismatch',score,detail:`Captured model (${capture.model}) does not match canonical model (${product.modelCode}).`};
  const canonVariants=extractVariantTokens(`${product.identityKey||''} ${product.variant||''}`);const seenVariants=extractVariantTokens(observed);
  if(canonVariants.length&&seenVariants.length){const same=canonVariants.some(v=>seenVariants.includes(v));if(!same)return {status:'mismatch',score,detail:`Variant appears different. Expected ${canonVariants.join(', ')}; captured ${seenVariants.join(', ')}.`};}
  if(model&&hay.includes(model)&&score>=.45)return {status:'match',score:Math.max(score,.8),detail:'Model and product identity align with the canonical PricePulse product.'};
  if(score>=.7)return {status:'match',score,detail:'Captured title strongly matches the canonical PricePulse product.'};
  if(score>=.4)return {status:'needs_review',score,detail:'Partial match. Confirm the exact model/variant manually before publishing.'};
  return {status:'mismatch',score,detail:'Captured listing is too different from the canonical PricePulse product. Check the link/variant.'};
}
function matchLabel(s){return s==='match'?'Match':s==='needs_review'?'Needs Review':s==='mismatch'?'Mismatch':'Unverified';}

function renderProducts(){
  const filter=byId('filter')?.value||'attention';let list=products.map(p=>({p,s:productStats(p)}));
  if(filter==='attention')list=list.filter(x=>x.p.status!=='draft'&&(!x.s.ready||x.s.fresh<x.s.total));
  if(filter==='ready')list=list.filter(x=>x.p.status!=='draft'&&x.s.ready);
  if(filter==='tracking')list=list.filter(x=>x.p.status!=='draft'&&(x.p.status==='tracking'||x.s.tracking||!x.s.total));
  if(filter==='archived')list=list.filter(x=>x.p.status==='draft');
  /* V241 (H1): search by name / brand / category / model / variant / store - spaces, hyphens and case are ignored */
  const ppqRaw=String(byId('productSearch')?.value||'').trim();
  if(ppqRaw){const toks=ppqRaw.toLowerCase().split(/\s+/).map(t=>t.replace(/[^a-z0-9]/g,'')).filter(Boolean);
    list=list.filter(({p})=>{const hay=[p.name,p.id,p.brand,p.brandSlug,p.category,p.modelCode,p.variant,p.identityKey,...(p.stores||[]).map(st=>st.name)].map(v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'')).join('|');return toks.every(t=>hay.includes(t));});}
  const ppqClear=byId('productSearchClear');if(ppqClear)ppqClear.hidden=!ppqRaw;
  list.sort((a,b)=>Number(a.s.ready)-Number(b.s.ready)||(b.s.never+b.s.due)-(a.s.never+a.s.due)||a.p.name.localeCompare(b.p.name));
  byId('productList').innerHTML=list.map(({p})=>{const st=statusLabel(p);const active=p.id===selectedId?' active':'';const live=liveStores(p);return `<button class="product-item${active}" type="button" data-product="${esc(p.id)}"><span><b>${esc(p.name)}</b><small>${esc(live.map(x=>x.name).join(' · ')||'No live retailer')}</small></span><span class="badge ${st.cls}">${esc(st.text)}</span></button>`;}).join('')||(ppqRaw?'<p class="muted empty">No product found for "'+esc(ppqRaw)+'".</p>':'<p class="muted empty">No products in this filter.</p>');
  byId('productList').querySelectorAll('.product-item').forEach(btn=>btn.addEventListener('click',()=>selectProduct(btn.dataset.product)));
}
function optionalMissing(form){return ['.mrp','.rating','.reviews','.delivery','.offer'].filter(sel=>!String(form.querySelector(sel)?.value||'').trim()).map(sel=>sel.slice(1));}
function captureKey(productId,storeSlug){return `${productId}::${storeSlug}`;}
function captureFor(productId,storeSlug){return captures.get(captureKey(productId,storeSlug))||{};}
function hasValue(v){return v!==undefined&&v!==null&&String(v).trim()!=='';}
function captureHas(capture,key){if(!capture)return false;if(Array.isArray(capture.capturedFields))return capture.capturedFields.includes(key);return hasValue(capture[key]);}
function existingSourceLabel(row){const src=String(row?.capture_source||'manual').toLowerCase();if(src==='api')return 'Existing API';if(src==='feed')return 'Existing feed';if(src==='browser-helper')return 'Existing helper';return 'Existing manual';}
function sourceState(field,capture,row,rowKey){if(captureHas(capture,field))return {cls:'captured',text:'Captured now'};if(row&&rowKey&&hasValue(row[rowKey]))return {cls:'existing',text:existingSourceLabel(row)};return {cls:'manual',text:'Manual required'};}
function sourceBadge(field,capture,row,rowKey){const st=sourceState(field,capture,row,rowKey);return `<div class="field-source ${st.cls}" data-source-for="${esc(field)}">${esc(st.text)}</div>`;}
function setSourceBadge(form,field,cls,text){const el=form.querySelector(`.field-source[data-source-for="${field}"]`);if(el){el.className=`field-source ${cls}`;el.textContent=text;}}
function refreshSourceBadges(form,capture){const row=rowFor(form.dataset.product,form.dataset.store);const map={title:['captured_title'],brand:[null],model:['captured_model'],variant:['captured_variant'],image:['image_url'],price:['price'],mrp:['mrp'],availability:['availability'],delivery:['delivery_text'],rating:['rating'],reviewCount:['review_count'],offer:['offer_text']};for(const [field,[rowKey]] of Object.entries(map)){const st=sourceState(field,capture,row,rowKey);setSourceBadge(form,field,st.cls,st.text);}}

function currentCaptureFromForm(form){return {title:form.querySelector('.capturedTitle')?.value||'',brand:form.querySelector('.capturedBrand')?.value||'',model:form.querySelector('.capturedModel')?.value||'',variant:form.querySelector('.capturedVariant')?.value||'',sku:form.querySelector('.capturedSku')?.value||'',image:form.querySelector('.capturedImage')?.value||''};}
function updateVerifyState(form){
  const p=productById(form.dataset.product);if(!p)return;const match=productMatch(p,currentCaptureFromForm(form));
  const pill=form.querySelector('.match-pill');if(pill){pill.className=`match-pill ${match.status}`;pill.textContent=matchLabel(match.status);}
  const detail=form.querySelector('.match-detail');if(detail)detail.textContent=`${match.detail} Match score: ${Math.round(match.score*100)}%.`;
  form.dataset.matchStatus=match.status;form.dataset.matchScore=String(match.score);
  const override=form.querySelector('.override');if(override)override.classList.toggle('hidden',match.status!=='mismatch');
  const missing=optionalMissing(form);const missingText=form.querySelector('.missingText');if(missingText)missingText.textContent=missing.length?`Not auto-filled: ${missing.join(', ')}. Fill them if shown on the retailer page, or tick “Reviewed missing details”.`:'All enrichment fields are filled.';
  const price=Number(form.querySelector('.price')?.value);const title=String(form.querySelector('.capturedTitle')?.value||'').trim();const availability=String(form.querySelector('.availability')?.value||'');const exact=form.querySelector('.verified')?.checked;const reviewed=!missing.length||form.querySelector('.detailsReviewed')?.checked;const mismatchOK=match.status!=='mismatch'||(form.querySelector('.overrideCheck')?.checked&&String(form.querySelector('.overrideReason')?.value||'').trim().length>=8);
  const btn=form.querySelector('.saveStore');if(btn)btn.disabled=!(Number.isFinite(price)&&price>0&&title&&availability&&exact&&reviewed&&mismatchOK);
}
function capturePreviewHTML(capture){if(!capture?.image&&!capture?.title)return'';return `<div class="capture-preview"><img src="${esc(capture.image||'logo-icon.png')}" alt="Captured product image" onerror="this.src='logo-icon.png'"><div><b>${esc(capture.title||'Captured product')}</b><span class="fine">${esc([capture.brand,capture.model,capture.variant,capture.sku].filter(Boolean).join(' · '))}</span><span class="fine">Captured from ${esc(capture.domain||'retailer page')} · ${esc(capture.capturedAt?fmtDate(capture.capturedAt):'just now')}</span></div></div>`;}
function storeCard(product,o){
  const row=rowFor(product.id,o.name),fresh=isFresh(row),state=row?(fresh?'fresh':'expired'):'never';const capture=captureFor(product.id,o.slug)||{};const listingStatus=o.listingStatus||'active';
  if(['not_listed','track_only'].includes(listingStatus))return `<section class="box" data-store="${esc(o.name)}" data-store-slug="${esc(o.slug)}" data-product="${esc(product.id)}"><div class="box-head"><div><h3>${esc(o.name)}</h3><span class="mini never">${listingStatus==='not_listed'?'Not listed yet':'Track only'}</span></div></div><small>This retailer is stored for tracking but is not counted as a live offer or Best Price.</small>${o.url?`<a href="${esc(o.url)}" target="_blank" rel="sponsored noopener noreferrer">Open ${esc(o.name)} page ↗</a>`:''}<label>Listing status</label><select class="listingStatus"><option value="active">Active listing</option><option value="out_of_stock">Out of stock</option><option value="not_listed"${listingStatus==='not_listed'?' selected':''}>Not listed yet</option><option value="track_only"${listingStatus==='track_only'?' selected':''}>Track only</option></select><button class="saveListingState subtle" type="button">Save listing status</button><p class="fine status"></p></section>`;
  const status=row?(fresh?`Fresh until ${fmtDate(row.expires_at)}`:`Expired at ${fmtDate(row.expires_at)}`):'No published price yet';
  const captured={title:capture.title||row?.captured_title||'',brand:capture.brand||'',model:capture.model||row?.captured_model||'',variant:capture.variant||row?.captured_variant||'',sku:capture.sku||'',image:capture.image||row?.image_url||'',domain:capture.domain||'',capturedAt:capture.capturedAt||row?.updated_at||''};
  const initialMatch=productMatch(product,captured);
  const missing=['mrp','rating','reviews','delivery','offer'].filter(k=>!row?.[k==='reviews'?'review_count':k==='delivery'?'delivery_text':k==='offer'?'offer_text':k]);
  return `<section class="box ${state}" data-store="${esc(o.name)}" data-store-slug="${esc(o.slug)}" data-product="${esc(product.id)}" data-match-status="${initialMatch.status}" data-match-score="${initialMatch.score}">
    <div class="box-head"><div><h3>${esc(o.name)}</h3><div class="listing-state"><span class="mini ${state}">${fresh?'Fresh':row?'Due':'Never checked'}</span><span class="source-pill">${esc(row?.capture_source||'manual')}</span></div></div>${row?`<strong class="saved-price">${money(row.price)}</strong>`:''}</div>
    <small>Canonical check: <b>${esc(product.identityKey||product.name)}</b>${product.variant?` · ${esc(product.variant)}`:''}</small>
    <div class="verify-actions">${o.url?`<a class="button-link" href="${esc(o.url)}" target="_blank" rel="sponsored noopener noreferrer">Open & Verify ↗</a>`:''}<button class="pasteCapture ghost" type="button">Paste Capture</button></div>
    <div class="capture-slot">${capturePreviewHTML(captured)}</div>
    <p class="fine">Live product image is automatic: the lowest fresh verified in-stock store supplies the website image when its captured image is an exact Match. After price expiry, the last verified live image stays until a newer verification/API sync changes the best store.</p>
    <div class="field-grid">
      <div class="wide"><label>Captured / retailer product title *</label><input class="capturedTitle" data-source-field="title" value="${esc(captured.title)}" placeholder="Exact title shown on retailer page">${sourceBadge('title',capture,row,'captured_title')}<div class="field-note required-hint">Required for product-match protection.</div></div>
      <div><label>Captured brand</label><input class="capturedBrand" data-source-field="brand" value="${esc(captured.brand)}" placeholder="Brand">${sourceBadge('brand',capture,row,null)}</div><div><label>Model / SKU</label><input class="capturedModel" data-source-field="model" value="${esc(captured.model)}" placeholder="Model"><input class="capturedSku hidden" value="${esc(captured.sku)}">${sourceBadge('model',capture,row,'captured_model')}</div>
      <div><label>Variant</label><input class="capturedVariant" data-source-field="variant" value="${esc(captured.variant)}" placeholder="Size / storage / color">${sourceBadge('variant',capture,row,'captured_variant')}</div><div><label>Captured image URL</label><input class="capturedImage" data-source-field="image" value="${esc(captured.image)}" placeholder="https://...">${sourceBadge('image',capture,row,'image_url')}</div>
      <div><label>Verified price (₹) *</label><input class="price" data-source-field="price" inputmode="decimal" type="number" min="1" max="99999999" step="0.01" value="${capture.price??row?.price??''}" placeholder="Exact current price">${sourceBadge('price',capture,row,'price')}</div><div><label>MRP / list price</label><input class="mrp" data-source-field="mrp" inputmode="decimal" type="number" min="1" max="99999999" step="0.01" value="${capture.mrp??row?.mrp??''}" placeholder="If retailer shows it">${sourceBadge('mrp',capture,row,'mrp')}</div>
      <div><label>Availability *</label><select class="availability" data-source-field="availability"><option value=""${!(capture.availability||row?.availability)?' selected':''}>Select / verify stock</option><option value="in_stock"${(capture.availability||row?.availability)==='in_stock'?' selected':''}>In stock</option><option value="out_of_stock"${(capture.availability||row?.availability)==='out_of_stock'||listingStatus==='out_of_stock'?' selected':''}>Out of stock</option></select>${sourceBadge('availability',capture,row,'availability')}</div><div><label>Delivery estimate</label><input class="delivery" data-source-field="delivery" value="${esc(capture.delivery??row?.delivery_text??'')}" placeholder="e.g. 2–4 days">${sourceBadge('delivery',capture,row,'delivery_text')}</div>
      <div><label>Rating</label><input class="rating" data-source-field="rating" type="number" min="0" max="5" step="0.1" value="${capture.rating??row?.rating??''}" placeholder="e.g. 4.4">${sourceBadge('rating',capture,row,'rating')}</div><div><label>Review count</label><input class="reviews" data-source-field="reviewCount" type="number" min="0" step="1" value="${capture.reviewCount??row?.review_count??''}" placeholder="e.g. 8100">${sourceBadge('reviewCount',capture,row,'review_count')}</div>
      <div class="wide"><label>Offer / coupon text</label><input class="offer" data-source-field="offer" value="${esc(capture.offer??row?.offer_text??'')}" placeholder="e.g. 10% bank offer (only if shown)">${sourceBadge('offer',capture,row,'offer_text')}</div>
    </div>
    <div class="check-panel"><div class="row"><span class="match-pill ${initialMatch.status}">${matchLabel(initialMatch.status)}</span><b>Product comparison check</b></div><div class="match-detail">${esc(initialMatch.detail)} Match score: ${Math.round(initialMatch.score*100)}%.</div></div>
    <div class="override ${initialMatch.status==='mismatch'?'':'hidden'}"><label class="row verify"><input class="overrideCheck" type="checkbox"> Override mismatch only after manually confirming the listing is correct.</label><label>Override reason</label><input class="overrideReason" placeholder="Required reason (min 8 characters)"></div>
    <label class="row verify"><input class="verified" type="checkbox"> I verified this is the exact product/model/variant on the retailer website.</label>
    <label class="row verify"><input class="detailsReviewed" type="checkbox"${missing.length?'':' checked'}> I reviewed enrichment details; any blank field is genuinely not shown / not reliably available.</label>
    <p class="fine missingText">${missing.length?`Not auto-filled: ${missing.join(', ')}. Fill them if shown on the retailer page, or tick “Reviewed missing details”.`:'All enrichment fields are filled.'}</p>
    ${captured.image?`<label class="row verify"><input class="useProductImage" type="checkbox"> Also replace the permanent canonical fallback image with this verified retailer image (optional).</label>`:''}
    <div class="actions"><button class="saveStore" type="button" disabled>Confirm & Publish 24h</button><select class="listingStatus" style="max-width:170px"><option value="active"${listingStatus==='active'?' selected':''}>Active listing</option><option value="out_of_stock"${listingStatus==='out_of_stock'?' selected':''}>Out of stock</option><option value="not_listed">Not listed yet</option><option value="track_only">Track only</option></select><button class="saveListingState ghost" type="button">Save status</button></div>
    <p class="fine status">${esc(status)}</p>
  </section>`;
}
function wireStoreCard(form){
  form.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',e=>{if(e.isTrusted&&el.dataset.sourceField)setSourceBadge(form,el.dataset.sourceField,'edited',hasValue(el.value)?'Edited manually':'Manual required');updateVerifyState(form);}));
  form.querySelector('.pasteCapture')?.addEventListener('click',()=>pasteCapture(form));
  form.querySelector('.saveStore')?.addEventListener('click',saveRow);
  form.querySelector('.saveListingState')?.addEventListener('click',saveListingState);
  updateVerifyState(form);
}
function renderSelected(){
  const p=productById(selectedId)||products[0];if(!p){byId('selectedTitle').textContent='No products yet';byId('selectedMeta').textContent='Add your first product.';byId('stores').innerHTML='';updateProductManagementButtons();return;}selectedId=p.id;
  const stats=productStats(p),st=statusLabel(p),brand=brandBySlug(p.brandSlug)?.name||p.brand||'';
  byId('selectedTitle').textContent=p.name;byId('selectedMeta').textContent=`${brand?brand+' · ':''}${p.category||'Uncategorized'} · ${(p.stores||[]).length} retailer link${(p.stores||[]).length===1?'':'s'} · ${st.text}`;
  byId('stores').innerHTML=(p.stores||[]).map(o=>storeCard(p,o)).join('')||'<p class="muted empty">No retailer links yet. Use “+ Add Retailer Link”.</p>';
  byId('stores').querySelectorAll('.box').forEach(wireStoreCard);
  byId('selectedStatus').textContent=p.status==='draft'?'Archived product: hidden from active catalog. Restore it before new live publishing.':(stats.ready?'Best Price has at least 2 fresh in-stock prices. Tracking/unavailable listings are excluded.':'Best Price needs at least 2 fresh in-stock retailer prices. Tracking/unavailable listings are excluded.');updateProductManagementButtons();
}
function selectProduct(id){selectedId=id;renderProducts();renderSelected();document.getElementById('editor')?.scrollIntoView({behavior:'smooth',block:'start'});}

function tableMissing(error){return Boolean(error&&(error.code==='PGRST205'||error.code==='42P01'||/schema cache|could not find the table|relation .* does not exist/i.test(String(error.message||''))));}
async function loadCatalog(){
  catalogReady=false;let pRows,bRows,sRows,lRows;
  const [bp,sp,pp,lp]=await Promise.all([
    api.from('pp_catalog_brands').select('*').order('name'),
    api.from('pp_catalog_stores').select('*').order('name'),
    api.from('pp_catalog_products').select('*').order('name'),
    api.from('pp_product_store_listings').select('*').order('store_slug')
  ]);
  const err=[bp.error,sp.error,pp.error,lp.error].find(Boolean);
  if(err){
    if(!tableMissing(err))console.warn('PricePulse catalog load:',err);
    brands=[...FALLBACK_BRANDS];stores=[...FALLBACK_STORES];catalogListings=[];products=JSON.parse(JSON.stringify(FALLBACK_PRODUCTS));byId('catalogSetupWarning').classList.remove('hidden');return;
  }
  catalogReady=true;byId('catalogSetupWarning').classList.add('hidden');bRows=bp.data||[];sRows=sp.data||[];pRows=pp.data||[];lRows=lp.data||[];
  brands=bRows.map(b=>({slug:b.slug,name:b.name,logoUrl:b.logo_url||'',websiteUrl:b.website_url||'',aliases:b.aliases||[],active:b.active!==false}));
  stores=sRows.map(s=>({slug:s.slug,name:s.name,domain:s.domain||'',logoUrl:s.logo_url||'',active:s.active!==false,notes:s.notes||''}));
  catalogListings=lRows;
  products=pRows.map(p=>{const resolvedBrand=ppAdminResolveBrandSlug(p,brands)||p.brand_slug||'';return {id:p.product_id,name:p.name,brandSlug:resolvedBrand,brand:brands.find(b=>b.slug===resolvedBrand)?.name||'',category:p.category||'',identityKey:p.identity_key||p.name,modelCode:p.model_code||'',variant:p.variant||'',imageUrl:p.image_url||'',liveImageUrl:p.live_image_url||'',liveImageStore:p.live_image_store||'',metadata:p.metadata&&typeof p.metadata==='object'?p.metadata:{},status:p.status||'active',stores:lRows.filter(l=>l.product_id===p.product_id).map(l=>{const s=stores.find(x=>x.slug===l.store_slug);return {slug:l.store_slug,name:s?.name||l.store_slug,url:l.affiliate_url||l.direct_url||'',affiliateUrl:l.affiliate_url||'',directUrl:l.direct_url||'',listingStatus:l.listing_status||'active',matchStatus:l.match_status||'unverified',capturedImage:l.captured_image_url||'',active:l.active!==false};})};});
  if(!products.length){products=JSON.parse(JSON.stringify(FALLBACK_PRODUCTS));}
}
async function loadRows(){if(!api||!permitted)return;msg('saveMsg','Loading latest records…');const {data,error}=await api.from('pp_retailer_prices').select('*').order('updated_at',{ascending:false});if(error){msg('saveMsg','Could not load records: '+error.message,true);return;}rows=data||[];summary();renderProducts();renderSelected();msg('saveMsg','');}
async function refreshAll(){await loadCatalog();if(!selectedId||!productById(selectedId))selectedId=products[0]?.id||'';await loadRows();populateDialogs();}
async function checkAccess(){if(!api)return;const result=await api.auth.getUser();user=result.data.user;byId('authCard').hidden=Boolean(user);byId('dashboard').hidden=!user;if(!user)return;byId('uid').textContent=user.id;if(byId('plusUserId')&&!byId('plusUserId').value)byId('plusUserId').value=user.id;const {data,error}=await api.from('pp_price_admins').select('user_id').eq('user_id',user.id).maybeSingle();permitted=Boolean(!error&&data?.user_id===user.id);byId('editZone').hidden=!permitted;msg('adminStatus',error?'Database setup could not be read.':permitted?'Admin access confirmed. Catalog management + guarded verification are ready.':'This account is not on the PricePulse price-admin allowlist.',Boolean(error));if(permitted){await refreshAll();await ppAdminPlusLoadIdentity(byId('plusUserId')?.value||user.id);await ppAdminMasterLoad();}}

async function saveListingState(event){
  const form=event.target.closest('.box'),p=productById(form.dataset.product),storeSlug=form.dataset.storeSlug,listing=p?.stores?.find(s=>s.slug===storeSlug);if(!catalogReady||!listing){form.querySelector('.status').textContent='Run the V77 catalog SQL first to manage listing states.';return;}
  const listingStatus=form.querySelector('.listingStatus').value;event.target.disabled=true;const {error}=await api.from('pp_product_store_listings').update({listing_status:listingStatus,updated_at:new Date().toISOString(),updated_by:user.id}).eq('product_id',p.id).eq('store_slug',storeSlug);event.target.disabled=false;if(error){form.querySelector('.status').textContent='Status save failed: '+error.message;return;}await refreshAll();msg('saveMsg',`${listing.name} status updated to ${listingStatus.replaceAll('_',' ')}.`);
}
async function saveRow(event){
  if(!api||!permitted||!user)return;const form=event.target.closest('.box'),productId=form.dataset.product,retailer=form.dataset.store,storeSlug=form.dataset.storeSlug,p=productById(productId);const price=Number(form.querySelector('.price').value),available=form.querySelector('.availability').value,title=form.querySelector('.capturedTitle').value.trim();const matchStatus=form.dataset.matchStatus||'unverified',matchScore=Number(form.dataset.matchScore||0),missing=optionalMissing(form);
  if(!Number.isFinite(price)||price<=0){form.querySelector('.status').textContent='Enter a verified numeric price first.';return;}if(!available){form.querySelector('.status').textContent='Verify stock status first.';return;}if(!title){form.querySelector('.status').textContent='Enter/capture the exact retailer product title first.';return;}if(!form.querySelector('.verified').checked){form.querySelector('.status').textContent='Confirm the exact product/model/variant first.';return;}if(missing.length&&!form.querySelector('.detailsReviewed').checked){form.querySelector('.status').textContent='Review the missing enrichment fields first.';return;}if(matchStatus==='mismatch'&&!(form.querySelector('.overrideCheck').checked&&form.querySelector('.overrideReason').value.trim().length>=8)){form.querySelector('.status').textContent='Mismatch is blocked. Correct the listing or provide a deliberate override reason.';return;}
  event.target.disabled=true;form.querySelector('.status').textContent='Saving verified data…';const now=Date.now()-30000;const checkedAt=new Date(now).toISOString();const cap=currentCaptureFromForm(form);const capKey=captureKey(productId,storeSlug),helperCapture=captures.get(capKey)||null;const mrp=cleanNumber(form.querySelector('.mrp').value),rating=cleanNumber(form.querySelector('.rating').value),reviews=cleanNumber(form.querySelector('.reviews').value),delivery=form.querySelector('.delivery').value.trim(),offer=form.querySelector('.offer').value.trim(),overrideReason=matchStatus==='mismatch'?form.querySelector('.overrideReason').value.trim():'';
  // V78.1 image safety: a retailer image is eligible for automatic live-card switching only
  // when it came from the current PricePulse Capture payload, was not edited afterwards,
  // and the exact canonical product/variant resolved to Match. Manual image text, Needs Review
  // and mismatch overrides can still be saved for admin reference, but never become live images.
  const helperImage=String(helperCapture?.image||'').trim(),formImage=String(cap.image||'').trim();
  const existingRow=rowFor(productId,retailer),existingImage=String(existingRow?.image_url||'').trim();
  const imageVerifiedNow=Boolean(helperCapture&&captureHas(helperCapture,'image')&&helperImage&&helperImage===formImage&&matchStatus==='match');
  const preserveVerifiedImage=Boolean(!imageVerifiedNow&&matchStatus==='match'&&formImage&&formImage===existingImage&&existingRow?.image_verified===true);
  const imageVerified=imageVerifiedNow||preserveVerifiedImage;
  const imageVerifiedAt=imageVerifiedNow?checkedAt:(preserveVerifiedImage?existingRow.image_verified_at||existingRow.checked_at||checkedAt:null);
  const imageVerificationSource=imageVerifiedNow?'browser-helper':(preserveVerifiedImage?existingRow.image_verification_source||existingRow.capture_source||'browser-helper':null);
  const value={product_id:productId,retailer,price,checked_at:checkedAt,expires_at:new Date(now+24*60*60*1000).toISOString(),source:'user-manual-check',availability:available,display_permitted:true,published:true,updated_at:new Date().toISOString(),updated_by:user.id};
  if(catalogReady)Object.assign(value,{mrp:mrp||null,rating:rating||null,review_count:reviews==null?null:Math.round(reviews),delivery_text:delivery||null,offer_text:offer||null,captured_title:title,captured_model:cap.model||null,captured_variant:cap.variant||null,image_url:cap.image||null,match_status:matchStatus,match_score:Math.round(matchScore*100),verification_notes:overrideReason||null,capture_source:helperCapture?'browser-helper':'manual',details_reviewed:true,listing_url:p?.stores?.find(s=>s.slug===storeSlug)?.url||null,image_verified:imageVerified,image_verified_at:imageVerifiedAt,image_verification_source:imageVerificationSource});
  let imageMigrationMissing=false;
  let {error}=await api.from('pp_retailer_prices').upsert(value,{onConflict:'product_id,retailer'});
  if(error&&catalogReady&&['42703','PGRST204'].includes(error.code)){
    // Keep the proven V77.9 capture/publish workflow usable if the new migration has not
    // been run yet. Live-image safety/sync will activate after V78.1 SQL is installed.
    const legacyValue={...value};delete legacyValue.image_verified;delete legacyValue.image_verified_at;delete legacyValue.image_verification_source;
    ({error}=await api.from('pp_retailer_prices').upsert(legacyValue,{onConflict:'product_id,retailer'}));
    if(!error)imageMigrationMissing=true;
  }
  if(error){event.target.disabled=false;form.querySelector('.status').textContent='Save failed: '+error.message;return;}
  if(catalogReady){
    // V224: you confirmed the exact product/variant before publishing, so this store link now counts as checked ('match').
    const listingUpdate={listing_status:available==='out_of_stock'?'out_of_stock':'active',captured_title:title,captured_model:cap.model||null,captured_variant:cap.variant||null,captured_image_url:cap.image||null,match_status:matchStatus==='mismatch'?'mismatch':'match',active:true,match_score:Math.round(matchScore*100),override_reason:overrideReason||null,last_capture:helperCapture||{},last_captured_at:new Date().toISOString(),updated_at:new Date().toISOString(),updated_by:user.id};
    await api.from('pp_product_store_listings').update(listingUpdate).eq('product_id',productId).eq('store_slug',storeSlug);
    if(form.querySelector('.useProductImage')?.checked&&cap.image)await api.from('pp_catalog_products').update({image_url:cap.image,updated_at:new Date().toISOString(),updated_by:user.id}).eq('product_id',productId);
  }
  captures.delete(capKey);await refreshAll();msg('saveMsg',imageMigrationMissing?`${retailer} · ${p?.name||productId} published. Run supabase-live-product-images-v78.1.sql to enable safe live-image sync.`:`${retailer} · ${p?.name||productId} published. Fresh for 24 hours. ${imageVerifiedNow?'New verified captured image is eligible for best-store live sync.':imageVerified?'Previously verified retailer image remains eligible.':'Price saved; live image stays unchanged unless an exact-match Capture image is verified.'}`);
}

async function readClipboard(){try{return await navigator.clipboard.readText();}catch{return prompt('Paste the PricePulse Capture JSON here:')||'';}}
async function pasteCapture(form){const status=form.querySelector('.status');status.textContent='Reading captured data…';const raw=await readClipboard();if(!raw){status.textContent='Nothing pasted.';return;}let data;try{data=JSON.parse(raw);}catch{status.textContent='Clipboard is not valid PricePulse Capture JSON.';return;}if(data?.ppCapture!==1){status.textContent='This does not look like PricePulse Capture data.';return;}const key=captureKey(form.dataset.product,form.dataset.storeSlug);captures.set(key,data);const set=(sel,val)=>{if(val!==undefined&&val!==null&&String(val)!==''){const el=form.querySelector(sel);if(el)el.value=val;}};set('.capturedTitle',data.title);set('.capturedBrand',data.brand);set('.capturedModel',data.model);set('.capturedVariant',data.variant);set('.capturedSku',data.sku);set('.capturedImage',data.image);set('.price',data.price);set('.mrp',data.mrp);set('.rating',data.rating);set('.reviews',data.reviewCount);if(data.availability)form.querySelector('.availability').value=data.availability;set('.delivery',data.delivery);set('.offer',data.offer);form.querySelector('.capture-slot').innerHTML=capturePreviewHTML(data);if(data.image&&!form.querySelector('.useProductImage'))form.querySelector('.capture-slot').insertAdjacentHTML('afterend','<label class="row verify"><input class="useProductImage" type="checkbox"> Also replace the permanent canonical fallback image with this verified retailer image (optional).</label>');refreshSourceBadges(form,data);status.textContent='Capture imported. Green = captured now, blue = existing saved data, orange = manual required. Review before publishing.';updateVerifyState(form);}

const PP_ADMIN_BASE_CATEGORIES=[
  ['mobiles','Mobiles'],
  ['laptops','Laptops'],
  ['electronics','Electronics'],
  ['home','Home & Kitchen'],
  ['fashion','Fashion'],
  ['appliances','Appliances'],
  ['beauty','Beauty'],
  ['watches','Watches']
];
function ppAdminCategoryOptions(selected=''){
  const current=String(selected||'').trim().toLowerCase();
  const seen=new Set();
  const options=[];
  const add=(value,label)=>{value=String(value||'').trim().toLowerCase();if(!value||seen.has(value))return;seen.add(value);options.push([value,label||value.replace(/\b\w/g,m=>m.toUpperCase())]);};
  PP_ADMIN_BASE_CATEGORIES.forEach(([value,label])=>add(value,label));
  (products||[]).forEach(product=>add(product?.category));
  if(current)add(current);
  return options.map(([value,label])=>`<option value="${esc(value)}"${value===current?' selected':''}>${esc(label)}</option>`).join('');
}
function ppPopulateProductCategory(form,selected=''){
  const select=form?.elements?.category;if(!select)return;
  select.innerHTML=ppAdminCategoryOptions(selected);
  const value=String(selected||'').trim().toLowerCase();
  if(value)select.value=value;
}
function populateDialogs(){
  const productForm=byId('productForm');
  const brandSel=productForm?.elements.brand_slug;if(brandSel)brandSel.innerHTML=brands.filter(b=>b.active!==false||b.slug===productById(selectedId)?.brandSlug).map(b=>`<option value="${esc(b.slug)}">${esc(b.name)}${b.active===false?' (inactive)':''}</option>`).join('');
  if(productForm)ppPopulateProductCategory(productForm,productForm.elements.category?.value||productById(selectedId)?.category||'');
  const storeSel=byId('listingForm')?.elements.store_slug;if(storeSel)storeSel.innerHTML=stores.filter(s=>s.active!==false).map(s=>`<option value="${esc(s.slug)}">${esc(s.name)}</option>`).join('');
}
function openDialog(id){if(!catalogReady){byId('catalogSetupWarning').classList.remove('hidden');msg('saveMsg','Run supabase-admin-catalog-v77.sql once before adding catalog records.',true);return;}byId(id).showModal();}
function productFormPreview(){updateWebsitePreview();}
function newBrand(){if(!catalogReady)return openDialog('brandDialog');const f=byId('brandForm');f.reset();f.elements.editing_slug.value='';f.elements.slug.disabled=false;byId('brandDialogTitle').textContent='Add Brand';byId('brandMsg').textContent='Upload the official logo once, or keep using a URL/local path. Website binding can reuse the saved logo later.';setLogoPreview('brandForm','brandLogoPreview');byId('brandDialog').showModal();}
function editBrand(slug){const b=brandBySlug(slug);if(!b)return;byId('brandsManageDialog')?.close();const f=byId('brandForm');f.reset();f.elements.editing_slug.value=b.slug;f.elements.name.value=b.name||'';f.elements.slug.value=b.slug;f.elements.slug.disabled=true;f.elements.logo_url.value=b.logoUrl||'';f.elements.website_url.value=b.websiteUrl||'';f.elements.aliases.value=(b.aliases||[]).join(', ');byId('brandDialogTitle').textContent='Edit Brand';byId('brandMsg').textContent='Slug is locked. Uploading a new official logo replaces only the central logo URL; existing website layout/CSS is not changed.';setLogoPreview('brandForm','brandLogoPreview');byId('brandDialog').showModal();}
function newStore(){if(!catalogReady)return openDialog('storeDialog');const f=byId('storeForm');f.reset();f.elements.editing_slug.value='';f.elements.slug.disabled=false;byId('storeDialogTitle').textContent='Add Store';byId('storeMsg').textContent='Upload the official store logo once, or keep using a URL/local path.';setLogoPreview('storeForm','storeLogoPreview');byId('storeDialog').showModal();}
function editStore(slug){const st=storeBySlug(slug);if(!st)return;byId('storesManageDialog')?.close();const f=byId('storeForm');f.reset();f.elements.editing_slug.value=st.slug;f.elements.name.value=st.name||'';f.elements.slug.value=st.slug;f.elements.slug.disabled=true;f.elements.domain.value=st.domain||'';f.elements.logo_url.value=st.logoUrl||'';f.elements.notes.value=st.notes||'';byId('storeDialogTitle').textContent='Edit Store';byId('storeMsg').textContent='Slug is locked. Uploading a new official logo replaces only the central logo URL; existing website layout/CSS is not changed.';setLogoPreview('storeForm','storeLogoPreview');byId('storeDialog').showModal();}
async function saveBrand(e){e.preventDefault();const f=e.currentTarget;if(e.submitter?.value==='cancel'){byId('brandDialog').close();return;}const editing=f.elements.editing_slug.value.trim(),name=f.elements.name.value.trim(),slug=slugify(editing||f.elements.slug.value||name);if(!name||!slug)return;const current=editing?brandBySlug(editing):null,button=e.submitter;button&&(button.disabled=true);try{let logoUrl=f.elements.logo_url.value.trim();const file=f.elements.logo_file?.files?.[0];if(file){byId('brandMsg').textContent='Uploading official brand logo…';logoUrl=await uploadCatalogLogo('brands',slug,file);f.elements.logo_url.value=logoUrl;}const value={name,logo_url:logoUrl||null,website_url:f.elements.website_url.value.trim()||null,aliases:f.elements.aliases.value.split(',').map(x=>x.trim()).filter(Boolean),active:current?current.active!==false:true,updated_at:new Date().toISOString(),updated_by:user.id};let error;if(editing){({error}=await api.from('pp_catalog_brands').update(value).eq('slug',editing));}else{({error}=await api.from('pp_catalog_brands').upsert({...value,slug},{onConflict:'slug'}));}if(error){byId('brandMsg').textContent=error.message;return;}byId('brandDialog').close();f.reset();f.elements.slug.disabled=false;setLogoPreview('brandForm','brandLogoPreview');await refreshAll();msg('saveMsg',`${name} brand ${editing?'updated':'added'} successfully${logoUrl?' with central logo source':''}.`);}catch(error){byId('brandMsg').textContent=logoUploadError(error);}finally{button&&(button.disabled=false);}}
async function saveStoreForm(e){e.preventDefault();const f=e.currentTarget;if(e.submitter?.value==='cancel'){byId('storeDialog').close();return;}const editing=f.elements.editing_slug.value.trim(),name=f.elements.name.value.trim(),slug=slugify(editing||f.elements.slug.value||name),domain=f.elements.domain.value.trim().toLowerCase();if(!name||!slug||!domain)return;const current=editing?storeBySlug(editing):null,button=e.submitter;button&&(button.disabled=true);try{let logoUrl=f.elements.logo_url.value.trim();const file=f.elements.logo_file?.files?.[0];if(file){byId('storeMsg').textContent='Uploading official store logo…';logoUrl=await uploadCatalogLogo('stores',slug,file);f.elements.logo_url.value=logoUrl;}const value={name,domain,logo_url:logoUrl||null,notes:f.elements.notes.value.trim()||null,active:current?current.active!==false:true,updated_at:new Date().toISOString(),updated_by:user.id};let error;if(editing){({error}=await api.from('pp_catalog_stores').update(value).eq('slug',editing));}else{({error}=await api.from('pp_catalog_stores').upsert({...value,slug},{onConflict:'slug'}));}if(error){byId('storeMsg').textContent=error.message;return;}byId('storeDialog').close();f.reset();f.elements.slug.disabled=false;setLogoPreview('storeForm','storeLogoPreview');await refreshAll();msg('saveMsg',`${name} store ${editing?'updated':'added'} successfully${logoUrl?' with central logo source':''}.`);}catch(error){byId('storeMsg').textContent=logoUploadError(error);}finally{button&&(button.disabled=false);}}
async function saveProductForm(e){
  e.preventDefault();
  const f=e.currentTarget;
  if(e.submitter?.value==='cancel'){byId('productDialog').close();return;}
  const editing=f.elements.editing_id.value.trim(),name=f.elements.name.value.trim(),id=slugify(f.elements.product_id.value||editing||name),identity=f.elements.identity_key.value.trim();
  if(!name||!id||!identity){byId('productMsg').textContent='Product name, ID and Identity key are required.';return;}
  const current=editing?productById(editing):null,button=e.submitter;button&&(button.disabled=true);
  try{
    const slots={};
    for(const slot of ['primary','secondary','tertiary']){
      if(!f.elements[`site_${slot}_url`])continue;
      let url=f.elements[`site_${slot}_url`].value.trim();
      const file=f.elements[`site_${slot}_file`]?.files?.[0];
      if(file){
        byId('productMsg').textContent=`Uploading ${slot} product image…`;
        url=await uploadProductImage(id,slot,file);
        f.elements[`site_${slot}_url`].value=url;
      }
      slots[slot]={
        url,
        bg:['soft','white','transparent','original'].includes(f.elements[`site_${slot}_bg`].value)?f.elements[`site_${slot}_bg`].value:'soft',
        fit:f.elements[`site_${slot}_fit`].value||'contain',
        position:f.elements[`site_${slot}_position`].value||'center',
        scale:String(ppClampNumber(f.elements[`site_${slot}_scale`].value,70,260,100)),
        rotate:String(ppClampNumber(f.elements[`site_${slot}_rotate`].value,-30,30,0)),
        x:String(ppClampNumber(f.elements[`site_${slot}_x`].value,-30,30,0)),
        y:String(ppClampNumber(f.elements[`site_${slot}_y`].value,-30,30,0)),
        source:f.elements[`site_${slot}_source`].selectedOptions?.[0]?.dataset?.source||''
      };
    }
    const existingMetadata=current?.metadata&&typeof current.metadata==='object'?current.metadata:{};
    const metadata={...existingMetadata,site_images:{version:2,mode:f.elements.site_image_mode.value==='curated'?'curated':'auto',primary:slots.primary,secondary:slots.secondary,...(slots.tertiary?{tertiary:slots.tertiary}:{})}};
    const mutableValue={name,brand_slug:f.elements.brand_slug.value,category:slugify(f.elements.category.value)||f.elements.category.value.trim().toLowerCase(),identity_key:identity,model_code:f.elements.model_code.value.trim()||null,variant:f.elements.variant.value.trim()||null,image_url:f.elements.image_url.value.trim()||null,metadata,status:f.elements.status.value,updated_at:new Date().toISOString(),updated_by:user.id};
    let saved=null,error=null;
    if(editing){
      // Product ID is intentionally immutable during Edit Product. Updating only mutable canonical
      // fields avoids accidental PK/FK side effects and makes text edits persist predictably.
      const result=await api.from('pp_catalog_products').update(mutableValue).eq('product_id',editing).select('product_id,name,brand_slug,category,identity_key,model_code,variant,image_url,status').maybeSingle();
      saved=result.data;error=result.error;
      if(!error&&!saved){byId('productMsg').textContent='No product row was updated. Refresh Admin and try again.';return;}
    }else{
      const value={...mutableValue,product_id:id,created_by:user.id};
      const result=await api.from('pp_catalog_products').insert(value).select('product_id,name').single();
      saved=result.data;error=result.error;
    }
    if(error){byId('productMsg').textContent=error.message;return;}
    byId('productDialog').close();f.reset();f.elements.product_id.disabled=false;selectedId=String(saved?.product_id||editing||id);await refreshAll();
    msg('saveMsg',`${name} ${editing?'updated':'added'} successfully. ${metadata.site_images.mode==='curated'?'Curated 3-image gallery is active.':'Automatic verified-image mode remains active.'}`);
  }catch(error){byId('productMsg').textContent=productImageUploadError(error);}
  finally{button&&(button.disabled=false);}
}
async function saveListingForm(e){e.preventDefault();const f=e.currentTarget;if(e.submitter?.value==='cancel'){byId('listingDialog').close();return;}const productId=selectedId,storeSlug=f.elements.store_slug.value,status=f.elements.listing_status.value,affiliate=f.elements.affiliate_url.value.trim(),direct=f.elements.direct_url.value.trim();if(['active','out_of_stock'].includes(status)&&!affiliate&&!direct){byId('listingMsg').textContent='Active/out-of-stock listings need a retailer or affiliate URL.';return;}const value={product_id:productId,store_slug:storeSlug,affiliate_url:affiliate||null,direct_url:direct||null,listing_status:status,match_status:'unverified',active:true,updated_at:new Date().toISOString(),updated_by:user.id};const {error}=await api.from('pp_product_store_listings').upsert(value,{onConflict:'product_id,store_slug'});if(error){byId('listingMsg').textContent=error.message;return;}byId('listingDialog').close();f.reset();await refreshAll();}
function editSelectedProduct(){
  if(!catalogReady)return openDialog('productDialog');
  const p=productById(selectedId);if(!p)return;
  const f=byId('productForm');f.reset();
  byId('productDialogTitle').textContent='Edit Product';
  f.elements.brand_slug.innerHTML=brands.filter(b=>b.active!==false||b.slug===p.brandSlug).map(b=>`<option value="${esc(b.slug)}">${esc(b.name)}${b.active===false?' (inactive)':''}</option>`).join('');
  ppPopulateProductCategory(f,p.category||'');
  f.elements.editing_id.value=p.id;f.elements.name.value=p.name;f.elements.product_id.value=p.id;f.elements.product_id.disabled=true;f.elements.brand_slug.value=p.brandSlug||'';f.elements.category.value=p.category||'';f.elements.identity_key.value=p.identityKey||'';f.elements.model_code.value=p.modelCode||'';f.elements.variant.value=p.variant||'';f.elements.image_url.value=p.imageUrl||'';f.elements.status.value=p.status||'active';
  populateSiteImageSources(p);loadSiteImageFields(p);productFormPreview();byId('productMsg').textContent='';byId('productDialog').showModal();
}
function newProduct(){
  if(!catalogReady)return openDialog('productDialog');
  const f=byId('productForm');f.reset();f.elements.product_id.disabled=false;f.elements.editing_id.value='';f.elements.brand_slug.innerHTML=brands.filter(b=>b.active!==false).map(b=>`<option value="${esc(b.slug)}">${esc(b.name)}</option>`).join('');ppPopulateProductCategory(f,'');
  byId('productDialogTitle').textContent='Add Product';populateSiteImageSources(null);f.elements.site_image_mode.value='auto';updateSiteImagePreview('primary');updateSiteImagePreview('secondary');updateSiteImagePreview('tertiary');productFormPreview();byId('productMsg').textContent='';byId('productDialog').showModal();
}
function newListing(){if(!catalogReady)return openDialog('listingDialog');const p=productById(selectedId);if(!p)return;byId('listingProductName').textContent=p.name;byId('listingForm').reset();byId('listingDialog').showModal();}
function renderBrandManagement(){const list=byId('brandsManageList');if(!list)return;list.innerHTML=brands.map(b=>{const n=products.filter(p=>p.brandSlug===b.slug).length;const logo=b.logoUrl?`<img class="manage-logo" src="${esc(b.logoUrl)}" alt="">`:'';return `<div class="manage-item"><div class="manage-item-main${b.logoUrl?' has-logo':''}">${logo}<div><b>${esc(b.name)}</b><small>${esc(b.slug)} · ${n} product${n===1?'':'s'} · ${b.logoUrl?'logo saved':'no logo'}</small><span class="manage-state ${b.active===false?'inactive':'active'}">${b.active===false?'Inactive':'Active'}</span></div></div><div class="manage-item-actions"><button class="ghost manageEditBrand" type="button" data-slug="${esc(b.slug)}">Edit</button><button class="subtle manageToggleBrand" type="button" data-slug="${esc(b.slug)}">${b.active===false?'Activate':'Deactivate'}</button><button class="danger manageDeleteBrand" type="button" data-slug="${esc(b.slug)}">Delete</button></div></div>`;}).join('')||'<p class="muted">No brands found.</p>';list.querySelectorAll('.manageEditBrand').forEach(x=>x.addEventListener('click',()=>editBrand(x.dataset.slug)));list.querySelectorAll('.manageToggleBrand').forEach(x=>x.addEventListener('click',()=>toggleBrand(x.dataset.slug)));list.querySelectorAll('.manageDeleteBrand').forEach(x=>x.addEventListener('click',()=>deleteBrand(x.dataset.slug)));}
function renderStoreManagement(){const list=byId('storesManageList');if(!list)return;list.innerHTML=stores.map(st=>{const n=catalogListings.filter(l=>l.store_slug===st.slug).length;const logo=st.logoUrl?`<img class="manage-logo" src="${esc(st.logoUrl)}" alt="">`:'';return `<div class="manage-item"><div class="manage-item-main${st.logoUrl?' has-logo':''}">${logo}<div><b>${esc(st.name)}</b><small>${esc(st.domain||st.slug)} · ${n} retailer link${n===1?'':'s'} · ${st.logoUrl?'logo saved':'no logo'}</small><span class="manage-state ${st.active===false?'inactive':'active'}">${st.active===false?'Inactive':'Active'}</span></div></div><div class="manage-item-actions"><button class="ghost manageEditStore" type="button" data-slug="${esc(st.slug)}">Edit</button><button class="subtle manageToggleStore" type="button" data-slug="${esc(st.slug)}">${st.active===false?'Activate':'Deactivate'}</button><button class="danger manageDeleteStore" type="button" data-slug="${esc(st.slug)}">Delete</button></div></div>`;}).join('')||'<p class="muted">No stores found.</p>';list.querySelectorAll('.manageEditStore').forEach(x=>x.addEventListener('click',()=>editStore(x.dataset.slug)));list.querySelectorAll('.manageToggleStore').forEach(x=>x.addEventListener('click',()=>toggleStore(x.dataset.slug)));list.querySelectorAll('.manageDeleteStore').forEach(x=>x.addEventListener('click',()=>deleteStore(x.dataset.slug)));}
function openBrandsManagement(){if(!catalogReady)return openDialog('brandsManageDialog');byId('brandsManageMsg').textContent='';renderBrandManagement();byId('brandsManageDialog').showModal();}
function openStoresManagement(){if(!catalogReady)return openDialog('storesManageDialog');byId('storesManageMsg').textContent='';renderStoreManagement();byId('storesManageDialog').showModal();}
async function toggleBrand(slug){const b=brandBySlug(slug);if(!b)return;const next=b.active===false;if(!next){const deps=products.filter(p=>p.brandSlug===slug&&p.status!=='draft');if(deps.length){byId('brandsManageMsg').textContent=`Cannot deactivate ${b.name}: ${deps.length} active/tracking product${deps.length===1?'':'s'} still use this brand. Archive those products first.`;return;}}const {error}=await api.from('pp_catalog_brands').update({active:next,updated_at:new Date().toISOString(),updated_by:user.id}).eq('slug',slug);if(error){byId('brandsManageMsg').textContent=error.message;return;}await refreshAll();renderBrandManagement();byId('brandsManageMsg').textContent=`${b.name} ${next?'activated':'deactivated'}.`;}
async function deleteBrand(slug){const b=brandBySlug(slug);if(!b)return;const deps=products.filter(p=>p.brandSlug===slug);if(deps.length){byId('brandsManageMsg').textContent=`Delete blocked: ${deps.length} product${deps.length===1?'':'s'} still reference ${b.name}. Archive is reversible, but hard delete requires zero dependent products.`;return;}if(!confirm(`Permanently delete brand “${b.name}”? This cannot be undone.`))return;const {error}=await api.from('pp_catalog_brands').delete().eq('slug',slug);if(error){byId('brandsManageMsg').textContent=deletePermissionMessage(error);return;}await refreshAll();renderBrandManagement();byId('brandsManageMsg').textContent=`${b.name} permanently deleted.`;}
async function toggleStore(slug){const st=storeBySlug(slug);if(!st)return;const next=st.active===false;if(!next){const deps=catalogListings.filter(l=>l.store_slug===slug&&l.active!==false);if(deps.length){byId('storesManageMsg').textContent=`Cannot deactivate ${st.name}: ${deps.length} retailer link${deps.length===1?'':'s'} still depend on this store. Keep it active until those links are retired.`;return;}}const {error}=await api.from('pp_catalog_stores').update({active:next,updated_at:new Date().toISOString(),updated_by:user.id}).eq('slug',slug);if(error){byId('storesManageMsg').textContent=error.message;return;}await refreshAll();renderStoreManagement();byId('storesManageMsg').textContent=`${st.name} ${next?'activated':'deactivated'}.`;}
async function deleteStore(slug){const st=storeBySlug(slug);if(!st)return;const deps=catalogListings.filter(l=>l.store_slug===slug);if(deps.length){byId('storesManageMsg').textContent=`Delete blocked: ${deps.length} retailer link${deps.length===1?'':'s'} still reference ${st.name}. Hard delete is allowed only after all dependent links are removed.`;return;}if(!confirm(`Permanently delete store “${st.name}”? This cannot be undone.`))return;const {error}=await api.from('pp_catalog_stores').delete().eq('slug',slug);if(error){byId('storesManageMsg').textContent=deletePermissionMessage(error);return;}await refreshAll();renderStoreManagement();byId('storesManageMsg').textContent=`${st.name} permanently deleted.`;}
function deletePermissionMessage(error){const t=String(error?.message||'Delete failed.');return /permission|policy|42501/i.test(t)?'Delete permission is not installed yet. Run supabase-admin-management-v78.4.sql once, then retry.':t;}
async function toggleSelectedProductArchive(){const p=productById(selectedId);if(!catalogReady||!p)return;const restoring=p.status==='draft';if(!restoring&&!confirm(`Archive “${p.name}”? It will be hidden from the active catalog and its current live prices will be unpublished until re-verified.`))return;const next=restoring?'active':'draft';const {error}=await api.from('pp_catalog_products').update({status:next,updated_at:new Date().toISOString(),updated_by:user.id}).eq('product_id',p.id);if(error){msg('saveMsg',error.message,true);return;}if(!restoring){const r=await api.from('pp_retailer_prices').update({published:false,updated_at:new Date().toISOString(),updated_by:user.id}).eq('product_id',p.id);if(r.error)console.warn('PricePulse archive: could not unpublish current prices',r.error);}await refreshAll();msg('saveMsg',restoring?`${p.name} restored to Active. Re-verify retailer prices before publishing them again.`:`${p.name} archived safely. Existing catalog/history data was retained.`);}
async function deleteSelectedProduct(){const p=productById(selectedId);if(!catalogReady||!p)return;const listingDeps=catalogListings.filter(l=>l.product_id===p.id).length;const priceDeps=rows.filter(r=>r.product_id===p.id).length;let historyDeps=0;try{const h=await api.from('pp_retailer_price_history').select('product_id',{count:'exact',head:true}).eq('product_id',p.id);if(h.error&&!tableMissing(h.error)){msg('saveMsg','Delete blocked because price-history dependencies could not be verified safely: '+h.error.message,true);return;}if(!h.error)historyDeps=h.count||0;}catch(e){msg('saveMsg','Delete blocked because price-history dependencies could not be verified safely.',true);return;}if(listingDeps||priceDeps||historyDeps){msg('saveMsg',`Delete blocked for ${p.name}: ${listingDeps} retailer link(s), ${priceDeps} current price row(s), ${historyDeps} history row(s) still depend on it. Use Archive Product to preserve data safely.`,true);return;}if(!confirm(`Permanently delete product “${p.name}”? This cannot be undone.`))return;const {error}=await api.from('pp_catalog_products').delete().eq('product_id',p.id);if(error){msg('saveMsg',deletePermissionMessage(error),true);return;}selectedId='';await refreshAll();msg('saveMsg',`${p.name} permanently deleted.`);}
function updateProductManagementButtons(){const p=productById(selectedId),archive=byId('archiveProduct'),del=byId('deleteProduct');if(!archive||!del)return;archive.disabled=!p;del.disabled=!p;if(p)archive.textContent=p.status==='draft'?'Restore Product':'Archive Product';}
// Generic, best-effort helper. It prefers retailer-exposed JSON-LD/meta data and never publishes by itself.
const BOOKMARKLET_RAW=String.raw`javascript:(()=>{try{
const txt=x=>x==null?'':String(x).replace(/\s+/g,' ').trim();
const q=s=>{try{return document.querySelector(s)}catch{return null}};
const qa=s=>{try{return Array.from(document.querySelectorAll(s))}catch{return[]}};
const qt=s=>txt(q(s)?.textContent||q(s)?.innerText||'');
const attr=(s,a)=>q(s)?.getAttribute(a)||'';
const visible=el=>!!(el&&(el.offsetWidth||el.offsetHeight||el.getClientRects?.().length));
const num=x=>{const m=txt(x).replace(/,/g,'').match(/(?:₹|Rs\.?|INR)?\s*([0-9]+(?:\.[0-9]+)?)/i);return m?Number(m[1]):null};
const first=arr=>{for(const v of arr){let z='';try{z=typeof v==='function'?v():v}catch{}if(txt(z))return z}return''};
const firstNum=arr=>{for(const v of arr){let z=null;try{z=typeof v==='function'?v():v}catch{}const n=typeof z==='number'?z:num(z);if(Number.isFinite(n)&&n>0)return n}return null};
const meta=(s,a='content')=>q(s)?.getAttribute(a)||'';
const fields=new Set();
const mark=(k,v)=>{if(v!==undefined&&v!==null&&String(v).trim()!=='')fields.add(k);return v};
const largestImage=(selectors,hostHint='')=>{for(const sel of selectors){for(const el of qa(sel)){const src=el.currentSrc||el.src||el.getAttribute('data-src')||el.getAttribute('data-original')||'';if(src&&(!hostHint||src.includes(hostHint))&&!/logo|sprite|icon/i.test(src))return src}}return''};
const bestDisplayedImage=(selectors,hostHint='')=>{const seen=new Set(),items=[];for(const sel of selectors){for(const el of qa(sel)){if(seen.has(el))continue;seen.add(el);const raw=[el.currentSrc,el.src,el.getAttribute('data-src'),el.getAttribute('data-original')].filter(Boolean);const srcset=el.getAttribute('srcset')||el.getAttribute('data-srcset')||'';if(srcset){const picks=srcset.split(',').map(x=>x.trim().split(/\s+/)).filter(x=>x[0]).map(x=>({u:x[0],w:Number((x[1]||'').replace(/w$/,''))||0})).sort((a,b)=>b.w-a.w);if(picks[0]?.u)raw.unshift(picks[0].u)}const src=raw.find(u=>(!hostHint||u.includes(hostHint))&&!/logo|sprite|icon|avatar|profile|rating|seller/i.test(u))||'';if(!src)continue;let r={width:0,height:0,top:99999};try{r=el.getBoundingClientRect()}catch{}const display=Math.max(0,r.width||0)*Math.max(0,r.height||0);const natural=Math.max(0,el.naturalWidth||0)*Math.max(0,el.naturalHeight||0);const top=Math.max(0,r.top||0);const score=display*12+natural-Math.min(top,5000)*30;if((display>2500||natural>40000)&&visible(el))items.push({src,score})}}return items.sort((a,b)=>b.score-a.score)[0]?.src||''};
const json=[];qa('script[type="application/ld+json"]').forEach(el=>{try{const v=JSON.parse(el.textContent||'');const walk=o=>{if(!o)return;if(Array.isArray(o)){o.forEach(walk);return}if(typeof o==='object'){json.push(o);Object.values(o).forEach(walk)}};walk(v)}catch{}});
const product=json.find(o=>{const t=o['@type'];return t==='Product'||(Array.isArray(t)&&t.includes('Product'))})||{};
const offers=Array.isArray(product.offers)?product.offers[0]:(product.offers||{});
const agg=product.aggregateRating||{};
const host=location.hostname.replace(/^www\./,'').toLowerCase();
let title=txt(product.name||meta('meta[property="og:title"]')||qt('h1')||document.title);
let brand=txt(typeof product.brand==='object'?product.brand?.name:product.brand);
let model=txt(product.model||product.mpn);
let sku=txt(product.sku||product.gtin13||product.gtin);
let variant=txt(product.color||product.size);
let image=txt(Array.isArray(product.image)?product.image[0]:(typeof product.image==='object'?product.image?.url:product.image)||meta('meta[property="og:image"]'));
let price=firstNum([offers.price,offers.lowPrice,meta('meta[itemprop="price"]'),attr('[itemprop="price"]','content')]);
let mrp=firstNum([offers.listPrice,product.listPrice]);
let rating=firstNum([agg.ratingValue]);
let reviewCount=firstNum([agg.reviewCount]);
let availability='';let delivery='';let offer='';
const rawBody=document.body?.innerText||'';
const body=txt(rawBody);
const inferBrand=t=>{const names=['OnePlus','Samsung','Dell','boAt','Philips','PUMA','NutriPro','Dot & Key','Apple','Motorola','realme','OPPO','vivo','Nothing','Google','Xiaomi','Redmi'];const z=txt(t).toLowerCase();return names.find(b=>z===b.toLowerCase()||z.startsWith(b.toLowerCase()+' '))||''};
const inferModel=(t,b)=>{let z=txt(t);if(b&&z.toLowerCase().startsWith(b.toLowerCase()))z=txt(z.slice(b.length));z=z.replace(/\s+Online at Best Price.*$/i,'').replace(/\s*\([^)]*(?:GB|RAM|Storage|ROM|Color|Colour)[^)]*\).*$/i,'').trim();const m=z.match(/^([A-Za-z]+\s*\d+[A-Za-z0-9+ -]*)/);return txt(m?m[1]:z).slice(0,60)};
const exactMoneyEls=()=>qa('div,span,p,s,del').filter(visible).map(el=>({el,t:txt(el.textContent)})).filter(o=>/^(?:₹\s*)?[0-9]{1,3}(?:,[0-9]{3})+(?:\.\d+)?$/.test(o.t));
const crossed=el=>{let d='';try{d=getComputedStyle(el).textDecorationLine||''}catch{}return el.matches?.('s,del')||/line-through/i.test(d)||!!el.closest?.('s,del')};
const moneyNearTitle=isMrp=>{const h=q('h1');if(!h)return null;const hy=h.getBoundingClientRect().top+scrollY;const vals=exactMoneyEls().map(o=>({n:num(o.t),d:Math.abs((o.el.getBoundingClientRect().top+scrollY)-hy),mrp:crossed(o.el)})).filter(o=>o.n>0&&o.mrp===isMrp).sort((a,b)=>a.d-b.d);return vals[0]?.n||null};
const stockFromButtons=()=>{const ts=qa('button').filter(visible).map(b=>txt(b.textContent));if(ts.some(t=>/add to cart|buy now|add to bag/i.test(t)))return'in_stock';if(ts.some(t=>/sold out|out of stock|notify me|currently unavailable/i.test(t)))return'out_of_stock';return''};
const findSpec=label=>{const re=new RegExp('(?:^|\\n)'+label+'\\s*(?:\\n|:)\\s*([^\\n]{1,100})','i');const m=rawBody.match(re);return m?txt(m[1]):''};
const deliveryFromBody=()=>{let m=rawBody.match(/Delivery by\s*([^\n]{1,60})/i);if(m)return 'Delivery by '+txt(m[1]);m=rawBody.match(/Delivery\s*:\s*\n?\s*([^\n]{1,60})/i);if(m)return txt(m[1]);return''};
const reviewFromText=t=>{t=String(t||'');let m=t.match(/([\d,]+)\s*Ratings?\s*(?:&|and)\s*([\d,]+)\s*Reviews?/i);if(m)return Number(m[2].replace(/,/g,''));m=t.match(/Customer\s+Reviews?\s*\(?([\d,]+)\)?/i);if(m)return Number(m[1].replace(/,/g,''));m=t.match(/View\s+all\s+([\d,]+)\s+reviews?/i);return m?Number(m[1].replace(/,/g,'')):null};
const reviewFromBody=()=>reviewFromText(document.body?.innerText||rawBody);
const scriptReview=()=>{const all=qa('script').map(x=>x.textContent||'').join(' ');const m=all.match(/"(?:reviewCount|reviewsCount|review_count)"\s*:\s*"?([\d,]+)"?/i);return m?Number(m[1].replace(/,/g,'')):null};
const flipkartReviewDom=()=>{for(const el of qa('div,span,a,p')){const t=txt(el.textContent);if(!t||t.length>260)continue;let m=t.match(/([\d,]+)\s*Ratings?\b[\s\S]{0,80}?([\d,]+)\s*Reviews?\b/i);if(m)return Number(m[2].replace(/,/g,''));m=t.match(/([\d,]+)\s*Reviews?\b/i);if(m&&/Reviews?/i.test(t))return Number(m[1].replace(/,/g,''));}const metaCount=firstNum([attr('[itemprop="reviewCount"]','content'),qt('[itemprop="reviewCount"]')]);if(metaCount)return metaCount;const all=qa('script').map(x=>x.textContent||'').join(' ');const normalized=all.replace(/\\"/g,'"').replace(/&quot;/g,'"').replace(/\\u0026/gi,'&');let m=normalized.match(/"(?:reviewCount|reviewsCount|totalReviewCount|review_count|numberOfReviews|totalReviews)"\s*:\s*"?([\d,]+)"?/i);if(m)return Number(m[1].replace(/,/g,''));const html=(document.documentElement?.innerHTML||'').replace(/\\"/g,'"').replace(/&quot;/g,'"').replace(/\\u0026/gi,'&');m=html.match(/([\d,]+)\s*Ratings?\b[\s\S]{0,120}?([\d,]+)\s*Reviews?\b/i);if(m)return Number(m[2].replace(/,/g,''));m=html.match(/"(?:reviewCount|reviewsCount|totalReviewCount|review_count|numberOfReviews|totalReviews)"\s*:\s*"?([\d,]+)"?/i);return m?Number(m[1].replace(/,/g,'')):null};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const flipkartFetchReviews=async()=>{const parse=h=>{if(!h)return null;let v=reviewFromText(h);if(v)return v;let m=h.match(/"(?:reviewCount|reviewsCount|totalReviewCount|review_count|numberOfReviews|totalReviews)"\s*:\s*"?([\d,]+)"?/i);if(m)return Number(m[1].replace(/,/g,''));try{const d=new DOMParser().parseFromString(h,'text/html');return reviewFromText(d.body?.innerText||'')}catch{return null}};const links=[];for(const el of qa('a[href*="product-reviews"]')){try{const u=new URL(el.getAttribute('href'),location.href).href;if(u.startsWith(location.origin)&&!links.includes(u))links.push(u)}catch{}}for(const u of links.slice(0,3)){try{const r=await fetch(u,{credentials:'include'});if(r.ok){const v=parse(await r.text());if(v)return v}}catch{}}try{const key=txt([brand,model].filter(Boolean).join(' '))||txt(title).replace(/\([^)]*\)/g,' ').split(/\s+/).slice(0,5).join(' ');if(key){const r=await fetch(location.origin+'/search?q='+encodeURIComponent(key),{credentials:'include'});if(r.ok){const html=await r.text();const d=new DOMParser().parseFromString(html,'text/html');const t=d.body?.innerText||'';const i=t.toLowerCase().indexOf(key.toLowerCase());const v=reviewFromText(i>=0?t.slice(Math.max(0,i-250),i+1800):t);if(v)return v}}}catch{}return null};
const flipkartDeepReviews=async()=>{let v=reviewFromBody()||flipkartReviewDom()||scriptReview();if(v)return v;const oldY=window.scrollY;try{const h=Math.max(document.body?.scrollHeight||0,document.documentElement?.scrollHeight||0);for(const f of [.55,.78,.93]){window.scrollTo(0,Math.max(0,h*f-innerHeight));await sleep(300)}v=reviewFromBody()||flipkartReviewDom()||scriptReview()}catch{}finally{try{window.scrollTo(0,oldY)}catch{}}return v||await flipkartFetchReviews()};
if(/amazon\./.test(host)){
 title=first([()=>qt('#productTitle'),title]);
 const by=first([()=>qt('#bylineInfo'),()=>qt('#brand'),brand]);brand=txt(by.replace(/^Visit the\s+/i,'').replace(/\s+Store$/i,'').replace(/^Brand:\s*/i,''))||inferBrand(title);
 model=model||findSpec('Model Name')||findSpec('Item model number')||inferModel(title,brand);
 sku=sku||(location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)||[])[1]||'';
 // V78.8.35 Amazon price hardening:
 // Never let the generic Amazon price selector treat the struck/list MRP (a-text-price) as the selling price.
 // Prefer the selected product's visible Price-to-Pay / non-MRP price; structured Offer price is fallback only.
 const amazonSelling=firstNum([
  ()=>qt('#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen'),
  ()=>qt('#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen'),
  ()=>qt('#corePrice_feature_div .priceToPay .a-offscreen'),
  ()=>qt('#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen'),
  ()=>qt('#apex_desktop .priceToPay .a-offscreen'),
  ()=>qt('#apex_desktop .a-price:not(.a-text-price) .a-offscreen'),
  ()=>qt('.reinventPricePriceToPayMargin .a-price:not(.a-text-price) .a-offscreen'),
  ()=>qt('#priceblock_dealprice'),()=>qt('#priceblock_saleprice'),()=>qt('#priceblock_ourprice'),
  ()=>qt('#corePriceDisplay_desktop_feature_div .priceToPay .a-price-whole'),
  ()=>qt('#corePrice_feature_div .priceToPay .a-price-whole'),
  ()=>qt('#apex_desktop .priceToPay .a-price-whole'),
  ()=>moneyNearTitle(false)
 ]);
 const amazonMrp=firstNum([
  ()=>qt('#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen'),
  ()=>qt('#corePriceDisplay_desktop_feature_div .a-price.a-text-price .a-offscreen'),
  ()=>qt('#corePrice_feature_div .basisPrice .a-offscreen'),
  ()=>qt('#corePrice_feature_div .a-price.a-text-price .a-offscreen'),
  ()=>qt('#apex_desktop .a-price.a-text-price .a-offscreen'),
  ()=>moneyNearTitle(true)
 ]);
 price=amazonSelling||price;
 mrp=amazonMrp||mrp;
 // If structured data echoed the MRP into price, prefer any visible lower non-struck product price.
 if(mrp&&price&&price>=mrp){const alt=moneyNearTitle(false);if(alt&&alt<mrp)price=alt;}
 if(mrp&&price&&mrp<price)mrp=null;
 const rt=first([()=>attr('#acrPopover','title'),()=>qt('[data-hook="rating-out-of-text"]'),()=>qt('#averageCustomerReviews .a-icon-alt')]);rating=firstNum([rt,rating]);
 reviewCount=firstNum([()=>qt('#acrCustomerReviewText'),()=>qt('[data-hook="total-review-count"]'),reviewCount]);
 image=first([()=>attr('#landingImage','data-old-hires'),()=>attr('#landingImage','src'),image]);
 const av=first([()=>qt('#availability'),()=>qt('#outOfStock'),()=>qt('#availabilityInsideBuyBox_feature_div')]).toLowerCase();availability=/currently unavailable|out of stock|unavailable/.test(av)?'out_of_stock':(q('#add-to-cart-button')||q('#buy-now-button')||/in stock|available/.test(av))?'in_stock':'';
 delivery=first([()=>{const s=qt('#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE');return /^free delivery$/i.test(s)?'':s},()=>qt('#deliveryBlockMessage')]);
 offer=first([()=>qt('#promoPriceBlockMessage_feature_div'),()=>qt('#quickPromoBucketContent'),()=>qt('#itembox-InstantBankDiscount')]);
 const amazonColor=first([()=>qt('#variation_color_name .selection'),()=>qt('#variation_color_name .a-button-selected .a-button-text'),()=>qt('#variation_color_name .a-dropdown-prompt')]);
 const amazonRam=first([()=>qt('#variation_ram_size .selection'),()=>qt('#variation_ram_size .a-button-selected .a-button-text'),()=>qt('#variation_ram_size .a-dropdown-prompt')]);
 const amazonStorage=first([()=>qt('#variation_storage_size .selection'),()=>qt('#variation_storage_size .a-button-selected .a-button-text'),()=>qt('#variation_storage_size .a-dropdown-prompt')]);
 let ram='',storage='';
 const memScan=[amazonRam,amazonStorage,title].filter(Boolean).join(' | ');
 let mm=memScan.match(/\b(\d+)\s*GB\s*\+\s*(\d+)\s*GB\b/i);
 if(mm){ram=mm[1]+'GB RAM';storage=mm[2]+'GB Storage'}
 if(!ram){mm=memScan.match(/\b(\d+)\s*GB\s*RAM\b/i);if(mm)ram=mm[1]+'GB RAM'}
 if(!storage){mm=memScan.match(/\b(\d+)\s*GB\s*(?:Storage|ROM)\b/i);if(mm)storage=mm[1]+'GB Storage'}
 let color=txt(amazonColor);
 if(!color){const parts=txt(title).split('|').map(txt).filter(Boolean);const mi=parts.findIndex(p=>/\b\d+\s*GB\s*\+\s*\d+\s*GB\b/i.test(p));if(mi>=0){const c=parts[mi+1]||'';if(c&&c.length<=40&&!/\b(?:snapdragon|processor|battery|gaming|camera|display|gen|fps|rating|personalized|ai|ip)\b/i.test(c))color=c}}
 const normalized=[ram,storage,color].filter(Boolean).join(' | ');
 const sels=qa('#variation_color_name .a-button-selected .a-button-text,#variation_color_name .selection,#variation_size_name .a-button-selected .a-button-text,#variation_size_name .selection,#variation_style_name .a-button-selected .a-button-text,#variation_style_name .selection,#variation_ram_size .a-button-selected .a-button-text,#variation_ram_size .selection,#variation_storage_size .a-button-selected .a-button-text,#variation_storage_size .selection').map(x=>txt(x.textContent)).filter(Boolean);
 if(normalized)variant=normalized;else if(sels.length)variant=Array.from(new Set(sels)).join(' | ');
}
else if(/flipkart\./.test(host)){
 title=first([()=>qt('h1 span.VU-ZEz'),()=>qt('span.VU-ZEz'),()=>qt('span.B_NuCI'),()=>qt('h1.yhB1nd'),()=>qt('h1'),title]);
 brand=findSpec('Brand')||inferBrand(title)||brand;
 model=findSpec('Model Name')||inferModel(title,brand)||model;
 const color=(rawBody.match(/Selected Color:\s*([^\n]+)/i)||[])[1]||'';
 const storage=(title.match(/\((?:[^,]+),\s*(\d+\s*GB)\)/i)||[])[1]||'';
 const ram=(title.match(/\((\d+\s*GB)\s*RAM\)/i)||[])[1]||'';
 if(storage||ram||color)variant=[ram?ram+' RAM':'',storage?storage+' Storage':'',color?'Color: '+txt(color):''].filter(Boolean).join(' | ');

 // V78.8.31 Flipkart price hardening:
 // Never choose the smallest number on the page. Flipkart pages can contain EMI/monthly amounts,
 // protection fees, coupon values and recommendation-card prices near the selected product.
 const h1=q('h1');
 const h1Y=h1?(h1.getBoundingClientRect().top+scrollY):null;
 const localText=el=>{const own=txt(el?.textContent);const parent=el?.parentElement;const pt=parent?txt(parent.textContent):'';return pt&&pt.length<=180?pt:own};
 const badSellingContext=el=>/\b(?:emi|per\s*month|\/m|month|protect(?:ion)?|promise\s*fee|fee|coupon|cashback|bank\s*offer|exchange|wow\s*deal)\b/i.test(localText(el));
 const moneyFromEl=el=>{if(!el||!visible(el))return null;const t=txt(el.textContent);const m=t.match(/₹\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.\d+)?)/)||t.match(/^([0-9]{1,3}(?:,[0-9]{3})+(?:\.\d+)?)$/);if(!m)return null;const n=Number(m[1].replace(/,/g,''));return Number.isFinite(n)&&n>0?n:null};
 const nearTitle=(el,max=1100)=>{if(h1Y==null)return true;try{return Math.abs((el.getBoundingClientRect().top+scrollY)-h1Y)<=max}catch{return true}};
 const bestSelectorMoney=(selectors,{mrpMode=false}={})=>{const found=[];for(const sel of selectors){for(const el of qa(sel)){if(!visible(el)||!nearTitle(el))continue;const n=moneyFromEl(el);if(!n)continue;if(mrpMode){if(!crossed(el)&&!/\bM\.?R\.?P\.?\b/i.test(localText(el)))continue}else{if(crossed(el)||badSellingContext(el))continue}let d=0;try{d=h1Y==null?0:Math.abs((el.getBoundingClientRect().top+scrollY)-h1Y)}catch{}found.push({n,d,exact:/^₹\s*[\d,]+(?:\.\d+)?$/.test(txt(el.textContent))?0:40})}}return found.sort((a,b)=>(a.d+a.exact)-(b.d+b.exact))[0]?.n||null};
 const flipkartSelling=bestSelectorMoney(['div.Nx9bqj.CxhGGd','div.Nx9bqj','div._30jeq3._16Jk6d','div._30jeq3','[class*="sellingPrice"]','[class*="selling-price"]']);
 const flipkartMrp=bestSelectorMoney(['div.yRaY8j','div._3I9_wc','s','del'],{mrpMode:true});
 const cleanNearTitleMoney=(wantMrp=false)=>{if(h1Y==null)return null;const vals=exactMoneyEls().map(o=>({el:o.el,n:num(o.t),d:Math.abs((o.el.getBoundingClientRect().top+scrollY)-h1Y),mrp:crossed(o.el)})).filter(o=>o.n>0&&o.d<=650&&o.mrp===wantMrp&&(wantMrp||!badSellingContext(o.el))).sort((a,b)=>a.d-b.d);return vals[0]?.n||null};
 const mrpTextMatch=rawBody.match(/\bM\.?R\.?P\.?\s*[:.]?\s*₹\s*([0-9]{1,3}(?:,[0-9]{3})+)/i);
 // V78.8.36 Flipkart selected-product price hardening:
 // Flipkart frequently changes the CSS class of the main selling price. When a visible MRP exists,
 // the current product's real selling price is the largest nearby, non-struck rupee amount below that MRP.
 // This naturally rejects EMI/monthly, Buy-at-after-offer and exchange values without falling back to MRP.
 const flipkartVisibleMrp=flipkartMrp||cleanNearTitleMoney(true)||(mrpTextMatch?Number(mrpTextMatch[1].replace(/,/g,'')):null);
 const narrowMoneyContext=el=>{const parts=[txt(el?.textContent)];const pt=txt(el?.parentElement?.textContent);const moneyHits=(pt.match(/₹\s*[\d,]+/g)||[]).length;if(pt&&pt.length<=110&&moneyHits<=1)parts.push(pt);return parts.join(' ')};
 const badNearbyAmount=el=>/\b(?:emi|per\s*month|month|buy\s*at|protect(?:ion)?|promise\s*fee|fee|coupon|cashback|bank\s*offer|exchange|pay\s*later)\b/i.test(narrowMoneyContext(el));
 const nearbyAmounts=()=>{if(h1Y==null)return[];const seen=new Map();for(const el of qa('div,span,p,strong')){if(!visible(el)||crossed(el)||!nearTitle(el,650))continue;const n=moneyFromEl(el);if(!n||badNearbyAmount(el))continue;let d=99999;try{d=Math.abs((el.getBoundingClientRect().top+scrollY)-h1Y)}catch{}const prev=seen.get(n);if(!prev||d<prev.d)seen.set(n,{n,d})}return Array.from(seen.values())};
 const underMrp=flipkartVisibleMrp?nearbyAmounts().filter(o=>o.n<flipkartVisibleMrp).sort((a,b)=>(b.n-a.n)||(a.d-b.d)):[];
 const sellingFromMrp=underMrp[0]?.n||null;
 const directSelling=(flipkartSelling&&(!flipkartVisibleMrp||flipkartSelling<flipkartVisibleMrp))?flipkartSelling:null;
 const flipkartVisibleSelling=directSelling||sellingFromMrp||cleanNearTitleMoney(false);
 price=flipkartVisibleSelling||price;
 mrp=flipkartVisibleMrp||mrp;
 if(mrp&&price&&price>mrp)price=null;
 if(mrp&&price&&price===mrp&&sellingFromMrp)price=sellingFromMrp;
 if(mrp&&price&&mrp<price)mrp=null;

 const h=q('h1');if(h){const hy=h.getBoundingClientRect().top+scrollY;const nearby=qa('div,span').filter(visible).map(el=>({t:txt(el.textContent),d:Math.abs((el.getBoundingClientRect().top+scrollY)-hy)})).filter(o=>o.t.length>0&&o.t.length<100).sort((a,b)=>a.d-b.d);for(const o of nearby.slice(0,80)){let m=o.t.match(/\b([0-5](?:\.\d)?)\s*(?:★|\|)\s*([\d,]+)/);if(m){rating=Number(m[1]);break}m=o.t.match(/^([0-5](?:\.\d)?)$/);if(m&&o.d<220){rating=Number(m[1]);break}}}
 reviewCount=reviewFromBody()||flipkartReviewDom()||scriptReview()||reviewCount;

 image=first([()=>largestImage(['img.DByuf4','img._396cs4','img._0DkuPH','img[src*="rukminim"]'],'rukminim'),image]);
 availability=availability||stockFromButtons();
 delivery=deliveryFromBody();
 offer=first([()=>{const m=rawBody.match(/(?:Bank offers|Special Price|Coupon|Cashback)\s*([^\n]{1,140})/i);return m?txt(m[0]):''}]);
}
else if(/croma\./.test(host)){
 title=first([()=>qt('h1.product-title'),()=>qt('.product-title'),()=>qt('h1'),title]);brand=findSpec('Brand')||inferBrand(title)||brand;model=findSpec('Model Name')||inferModel(title,brand)||model;
 price=firstNum([()=>qt('.new-price'),()=>qt('.pdp-price'),()=>qt('[class*="new-price"]'),()=>qt('[class*="selling-price"]'),price]);mrp=firstNum([()=>qt('.old-price'),()=>qt('.pdp-mrp'),()=>qt('[class*="mrp"] s'),()=>qt('s'),mrp]);rating=firstNum([()=>qt('[class*="rating-value"]'),()=>qt('[class*="rating"]'),rating]);reviewCount=reviewFromBody()||scriptReview()||reviewCount;
 image=first([()=>largestImage(['img.product-image','.product-gallery img','img[src*="media.croma"]'],'media'),image]);availability=stockFromButtons()||availability;delivery=deliveryFromBody();
}
else if(/myntra\./.test(host)){
 const b=qt('h1.pdp-title');const n=qt('h1.pdp-name');brand=b||brand||inferBrand(title);title=txt([b,n].filter(Boolean).join(' '))||title;model=model||inferModel(title,brand);price=firstNum([()=>qt('.pdp-price strong'),()=>qt('.pdp-price'),price]);mrp=firstNum([()=>qt('.pdp-mrp s'),()=>qt('.pdp-mrp'),mrp]);rating=firstNum([()=>qt('.index-overallRating'),rating]);reviewCount=reviewFromBody()||scriptReview()||reviewCount;image=first([()=>largestImage(['.image-grid-image img','img[src*="myntra"]']),image]);availability=/sold out|out of stock/i.test(body)?'out_of_stock':(q('.pdp-add-to-bag')?'in_stock':availability);delivery=deliveryFromBody();
 const sizeToken=t=>{t=txt(t);const m=t.match(/(?:^|\s)(XXXL|XXL|XL|XS|S|M|L|(?:1[0-5]|[2-9])(?:\.5)?)(?=\s|$)/i);return m?m[1].toUpperCase():''};
 const isPicked=el=>{const nodes=[el,el.closest?.('button,[role="button"],li,div')].filter(Boolean);for(const n of nodes){const cls=String(n.className||'');if(n.getAttribute?.('aria-selected')==='true'||n.getAttribute?.('aria-pressed')==='true'||n.getAttribute?.('data-selected')==='true'||/selected|active|checked/i.test(cls))return true;try{const st=getComputedStyle(n);const c=(st.borderColor+' '+st.color+' '+st.backgroundColor).toLowerCase();if(/rgb\(255,\s*63,\s*108\)|#ff3f6c/.test(c))return true}catch{}}return false};
 let selectedSize='';
 const sizeEls=qa('button.size-buttons-size-button,button[class*="size-buttons-size-button"],[role="button"][class*="size"],[class*="sizeButton"]');
 for(const el of sizeEls){if(!visible(el)||!isPicked(el))continue;const child=el.querySelector('p,span');const token=first([()=>sizeToken(el.getAttribute('data-size')),()=>sizeToken(el.getAttribute('aria-label')),()=>sizeToken(child?.textContent),()=>sizeToken(el.textContent)]);if(token){selectedSize=token;break}}
 if(!selectedSize){const checked=q('input[type="radio"]:checked');if(checked){selectedSize=first([()=>sizeToken(checked.value),()=>sizeToken(checked.getAttribute('aria-label')),()=>{const lab=checked.id?q('label[for="'+checked.id+'"]'):null;return sizeToken(lab?.textContent)}])}}
 if(!selectedSize){const liveBody=document.body?.innerText||rawBody;const m=liveBody.match(/(?:Selected\s+Size|Size)\s*[:\-]\s*(XXXL|XXL|XL|XS|S|M|L|(?:1[0-5]|[2-9])(?:\.5)?)\b/i);if(m)selectedSize=txt(m[1])}
 if(selectedSize)variant='Size: '+selectedSize;
}
else if(/ajio\./.test(host)){
 title=first([()=>qt('.prod-name'),()=>qt('.prod-title'),()=>qt('h1'),title]);brand=first([()=>qt('.brand-name'),()=>inferBrand(title),brand]);model=model||inferModel(title,brand);price=firstNum([()=>qt('.prod-sp'),()=>qt('[class*="selling-price"]'),price]);mrp=firstNum([()=>qt('.prod-cp'),()=>qt('[class*="mrp"]'),mrp]);rating=firstNum([()=>qt('[class*="rating"]'),rating]);reviewCount=reviewFromBody()||scriptReview()||reviewCount;image=first([()=>largestImage(['img.rilrtl-lazy-img','.prod-image img','img[src*="ajio"]']),image]);availability=stockFromButtons()||availability;delivery=deliveryFromBody();
}
else if(/meesho\./.test(host)){
 title=first([()=>qt('h1'),title]);
 if(/dot\s*(?:&|and)\s*key/i.test(title+' '+brand))brand='Dot & Key';else brand=brand||inferBrand(title);
 const pathId=(location.pathname.match(/\/p\/([a-z0-9]+)/i)||[])[1]||new URLSearchParams(location.search).get('ext_id')||'';
 model=model||inferModel(title,brand);if(pathId&&txt(model).toLowerCase()===txt(pathId).toLowerCase())model='';if(model&&/^[a-z0-9]{5,10}$/i.test(model)&&!txt(title).toLowerCase().includes(txt(model).toLowerCase()))model='';if(!sku&&pathId)sku=pathId;
 const sizeMatch=title.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|gm|ml|l)\b/i);if(sizeMatch)variant=sizeMatch[1]+(sizeMatch[2].toLowerCase()==='gm'?'g':sizeMatch[2]);
 price=firstNum([()=>qt('h4'),()=>qt('[class*="Price"]'),price]);mrp=firstNum([()=>qt('s'),mrp]);rating=firstNum([()=>qt('[class*="Rating"]'),()=>qt('[class*="rating"]'),rating]);reviewCount=reviewFromBody()||scriptReview()||reviewCount;
 image=first([()=>bestDisplayedImage(['main img[src*="images.meesho.com"]','[class*="Product"] img[src*="images.meesho.com"]','img[src*="images.meesho.com"]'],'images.meesho.com'),()=>largestImage(['img[src*="images.meesho.com"]'],'images.meesho.com'),image]);
 availability=stockFromButtons()||availability;delivery=deliveryFromBody();
}
const av=txt(offers.availability||meta('[itemprop="availability"]','href')).toLowerCase();if(!availability)availability=av.includes('outofstock')?'out_of_stock':av.includes('instock')?'in_stock':'';
const data={ppCapture:1,captureVersion:'2.7',capturedAt:new Date().toISOString(),url:location.href,domain:location.hostname,title:mark('title',title),brand:mark('brand',brand),model:mark('model',model),sku:mark('sku',sku),variant:mark('variant',variant),image:mark('image',image),price:mark('price',price),mrp:mark('mrp',mrp),rating:mark('rating',rating),reviewCount:mark('reviewCount',reviewCount),availability:mark('availability',availability),delivery:mark('delivery',delivery),offer:mark('offer',offer),capturedFields:Array.from(fields)};
const out=JSON.stringify(data);
const copyNow=text=>{
 let ta=null,active=null;
 try{
   active=document.activeElement;
   ta=document.createElement('textarea');
   ta.value=text;
   ta.setAttribute('readonly','');
   ta.setAttribute('aria-hidden','true');
   ta.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
   (document.body||document.documentElement).appendChild(ta);
   ta.focus();
   ta.select();
   ta.setSelectionRange(0,ta.value.length);
   return !!(document.execCommand&&document.execCommand('copy'));
 }catch(e){return false}
 finally{
   try{ta&&ta.remove()}catch{}
   try{active&&typeof active.focus==='function'&&active.focus()}catch{}
 }
};
const copied=copyNow(out);
if(copied){
 alert('PricePulse Capture v2.7 copied. Return to Admin Dashboard and click Paste Capture.');
}else{
 try{prompt('Automatic copy was blocked. Copy this PricePulse Capture JSON:',out)}catch{}
}
}catch(e){alert('PricePulse Capture error: '+(e&&e.message?e.message:e));}})();`;


const BOOKMARKLET='javascript:'+encodeURIComponent(BOOKMARKLET_RAW.slice('javascript:'.length));
function installBookmarklet(){const a=byId('captureBookmarklet');if(!a)return;a.href=BOOKMARKLET;a.textContent='PricePulse Capture v2.7';a.dataset.captureVersion='2.7';}
function copyBookmarkletNow(value){let ta=null;const active=document.activeElement;try{ta=document.createElement('textarea');ta.value=value;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';ta.style.top='0';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);return !!(document.execCommand&&document.execCommand('copy'));}catch{return false}finally{try{ta&&ta.remove()}catch{}try{active&&typeof active.focus==='function'&&active.focus()}catch{}}}
function copyHelper(){const ok=copyBookmarkletNow(BOOKMARKLET);if(ok){msg('saveMsg','PricePulse Capture v2.7 helper copied. Create or update the Chrome bookmark URL with this full helper.');return;}try{prompt('Automatic copy was blocked. Copy this full PricePulse Capture v2.7 bookmark URL:',BOOKMARKLET)}catch{}}

byId('loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!api){msg('authMsg','Supabase client did not load. Use an internet-connected browser.',true);return;}const email=byId('email').value.trim();const {error}=await api.auth.signInWithOtp({email,options:{shouldCreateUser:false}});if(error){msg('authMsg',error.message,true);return;}byId('otpForm').hidden=false;msg('authMsg','Check your email for the one-time code.');});
byId('otpForm').addEventListener('submit',async e=>{e.preventDefault();const email=byId('email').value.trim(),token=byId('otp').value.trim();const {error}=await api.auth.verifyOtp({email,token,type:'email'});if(error){msg('authMsg',error.message,true);return;}await checkAccess();});
byId('logout').addEventListener('click',async()=>{await api?.auth.signOut();user=null;permitted=false;rows=[];await checkAccess();});
byId('plusUseMe')?.addEventListener('click',()=>{if(!user?.id){msg('plusAdminMsg','Sign in as an admin first.',true);return}byId('plusUserId').value=user.id;ppAdminPlusRenderIdentity({uid:user.id,name:user.user_metadata?.full_name||user.user_metadata?.name||'My admin account',email:user.email||''});ppAdminPlusLoad();});
byId('plusUserId')?.addEventListener('input',()=>{const uid=String(byId('plusUserId')?.value||'').trim();ppAdminPlusRenderIdentity(uid?{uid,name:'Selected user',email:'Click Check status to verify this account.'}:{});});
byId('plusLoad')?.addEventListener('click',ppAdminPlusLoad);
byId('plusActivate')?.addEventListener('click',()=>ppAdminPlusSet(true));
byId('plusDeactivate')?.addEventListener('click',()=>ppAdminPlusSet(false));
byId('plusMasterActivate')?.addEventListener('click',()=>ppAdminMasterSetMode('active'));
byId('plusMasterDeactivate')?.addEventListener('click',()=>ppAdminMasterSetMode('inactive'));
byId('plusMasterIndividual')?.addEventListener('click',()=>ppAdminMasterSetMode('individual'));

byId('walletUseMeReferrer')?.addEventListener('click',()=>{if(!user?.id){msg('walletAdminMsg','Sign in as an admin first.',true);return}byId('walletReferrerId').value=user.id;ppWalletAdminLoadState();});
byId('walletUseMeFriend')?.addEventListener('click',()=>{if(!user?.id){msg('walletAdminMsg','Sign in as an admin first.',true);return}byId('walletFriendId').value=user.id;ppWalletAdminLoadState();});
byId('walletCreateReferral')?.addEventListener('click',ppWalletAdminCreate);
byId('walletPurchaseConfirmed')?.addEventListener('click',()=>ppWalletAdminStage('purchase'));
byId('walletReturnClear')?.addEventListener('click',()=>ppWalletAdminStage('return_clear'));
byId('walletCommissionConfirmed')?.addEventListener('click',()=>ppWalletAdminStage('commission'));
byId('walletReverseOrder')?.addEventListener('click',()=>ppWalletAdminStage('reverse'));
byId('walletOpenReferrer')?.addEventListener('click',()=>ppWalletOpenTestWallet('referrer'));
byId('walletOpenFriend')?.addEventListener('click',()=>ppWalletOpenTestWallet('friend'));
byId('walletOrderRef')?.addEventListener('change',ppWalletAdminLoadState);
byId('walletCommission')?.addEventListener('input',()=>{const x=ppWalletInputs(),r=ppWalletSlabFromCommission(x.commission);byId('walletRewardPool').textContent=ppWalletMoney(r.pool);});
byId('voucherUseMe')?.addEventListener('click',()=>{if(!user?.id){msg('voucherAdminMsg','Sign in as an admin first.',true);return}byId('voucherUserId').value=user.id;});
byId('voucherIssueBtn')?.addEventListener('click',ppVoucherIssue);
byId('voucherMarkUsedBtn')?.addEventListener('click',ppVoucherMarkUsed);
byId('voucherResetUserBtn')?.addEventListener('click',ppVoucherResetTestUser);
byId('voucherOpenWalletBtn')?.addEventListener('click',ppVoucherOpenWallet);

byId('load').addEventListener('click',refreshAll);byId('filter').addEventListener('change',renderProducts);byId('nextDue').addEventListener('click',()=>{const p=products.find(p=>{if(p.status==='draft')return false;const s=productStats(p);return !s.ready||s.fresh<s.total;});if(p)selectProduct(p.id);else msg('saveMsg','All current retailer checks are fresh.');});
let ppAdminPreviewResizeTimer=0;window.addEventListener('resize',()=>{clearTimeout(ppAdminPreviewResizeTimer);ppAdminPreviewResizeTimer=setTimeout(()=>updateWebsitePreview(),90);});byId('liveExactPreviewFrame')?.addEventListener('load',()=>ppSendExactLiveMirror(ppAdminMirrorActiveSlot));
byId('addProduct').addEventListener('click',newProduct);byId('addBrand').addEventListener('click',newBrand);byId('manageBrands').addEventListener('click',openBrandsManagement);byId('addStore').addEventListener('click',newStore);byId('manageStores').addEventListener('click',openStoresManagement);byId('brandForm').elements.logo_file.addEventListener('change',()=>setLogoPreview('brandForm','brandLogoPreview'));byId('brandForm').elements.logo_url.addEventListener('input',()=>setLogoPreview('brandForm','brandLogoPreview'));byId('storeForm').elements.logo_file.addEventListener('change',()=>setLogoPreview('storeForm','storeLogoPreview'));byId('storeForm').elements.logo_url.addEventListener('input',()=>setLogoPreview('storeForm','storeLogoPreview'));byId('editProduct').addEventListener('click',editSelectedProduct);byId('archiveProduct').addEventListener('click',toggleSelectedProductArchive);byId('deleteProduct').addEventListener('click',deleteSelectedProduct);byId('addListing').addEventListener('click',newListing);byId('productForm').elements.image_url.addEventListener('input',productFormPreview);byId('productForm').elements.name.addEventListener('input',()=>updateWebsitePreview());byId('productForm').elements.brand_slug.addEventListener('change',()=>updateWebsitePreview());byId('productForm').elements.site_image_mode.addEventListener('change',()=>updateWebsitePreview());bindSiteImageSource('primary');bindSiteImageSource('secondary');
bindSiteImageSource('tertiary');bindPopupIdentityPreview();byId('brandForm').addEventListener('submit',saveBrand);byId('storeForm').addEventListener('submit',saveStoreForm);byId('productForm').addEventListener('submit',saveProductForm);byId('listingForm').addEventListener('submit',saveListingForm);byId('copyHelper').addEventListener('click',copyHelper);document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>byId(b.dataset.closeDialog)?.close()));installBookmarklet();
if(!api){msg('authMsg','Supabase library did not load. Try an internet-connected browser.',true);}else{api.auth.onAuthStateChange(()=>setTimeout(checkAccess,0));checkAccess();}

/* ===== V240 · Remove background (runs in the browser, nothing is sent anywhere) =====
   Works best on product photos with a plain / white studio background.
   Flood-fills from the image border, so white parts INSIDE the product are kept. */
(function(){
  const MAXW=1600,PREVIEW=720;
  const css=document.createElement('style');
  css.textContent=`
.v241-bgnote{margin:6px 0;padding:9px 11px;border-radius:10px;font-size:12px;line-height:1.45}.v241-bgnote.warn{background:#fdecec;color:#8f1d22;border:1px solid #f3c1c3}.v241-bgnote.info{background:#eef5fb;color:#27506e;border:1px solid #cfe1ef}.v241-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:7px}.v241-acts button{border:1px solid currentColor;background:#fff;color:inherit;font:800 12px/1 inherit;padding:7px 10px;border-radius:8px;cursor:pointer}.v241-acts label{font-weight:700;display:flex;align-items:center;gap:5px}
.bgr-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0 4px}.bgr-row button{border:1px solid #bcd9cd;background:#f1faf6;color:#08734d;font:800 12px/1 inherit;padding:8px 12px;border-radius:9px;cursor:pointer}.bgr-row button:disabled{opacity:.5;cursor:default}.bgr-row small{color:#587080;font-size:11.5px}.bgr-panel{margin:6px 0 8px;padding:10px;border:1px solid #d9e8e2;border-radius:12px;background:#fbfdfc}.bgr-panel[hidden]{display:none}.bgr-view{display:grid;place-items:center;min-height:150px;border-radius:10px;background:repeating-conic-gradient(#eef3f1 0 25%,#fff 0 50%) 50%/16px 16px;overflow:hidden}.bgr-view canvas{max-width:100%;max-height:230px}.bgr-ctl{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:12px;font-weight:700;color:#35505f}.bgr-ctl input{flex:1}.bgr-act{display:flex;gap:8px;margin-top:8px}.bgr-act button{border:0;border-radius:9px;padding:9px 14px;font:800 12.5px/1 inherit;cursor:pointer}.bgr-act .use{background:#0a9d67;color:#fff}.bgr-act .cancel{background:#eef3f1;color:#35505f}.bgr-msg{margin-top:6px;font-size:12px;font-weight:700;color:#35505f}.bgr-msg.bad{color:#b3262c}`;
  document.head.appendChild(css);

  function loadSource(slot,f){
    return new Promise((resolve,reject)=>{
      const file=f.elements[`site_${slot}_file`]?.files?.[0];
      const url=(f.elements[`site_${slot}_url`]?.value||'').trim();
      if(!file&&!url){reject(new Error('Choose an image first (upload a file or paste an image link).'));return;}
      const im=new Image();
      let obj='';
      if(file){obj=URL.createObjectURL(file);im.src=obj;}else{im.crossOrigin='anonymous';im.src=url;}
      im.onload=()=>resolve({im,name:(file?.name||url.split('/').pop()||'image').replace(/\.[a-z0-9]+(\?.*)?$/i,''),obj});
      im.onerror=()=>reject(new Error(file?'This image file could not be read.':'This image link cannot be read from here (the website blocks it). Download the image and use "Or upload local image" instead.'));
    });
  }
  function process(im,tol,maxSide){
    const r=Math.min(1,maxSide/Math.max(im.naturalWidth,im.naturalHeight));
    const w=Math.max(1,Math.round(im.naturalWidth*r)),h=Math.max(1,Math.round(im.naturalHeight*r));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,w,h);
    let img;try{img=x.getImageData(0,0,w,h);}catch(e){throw new Error('This image cannot be processed (blocked by the website). Download it and upload the file instead.');}
    const d=img.data,N=w*h;
    /* background colour = most common colour on the border */
    const cnt=new Map();const addB=(i)=>{if(d[i+3]<200)return;const k=((d[i]>>4)<<8)|((d[i+1]>>4)<<4)|(d[i+2]>>4);cnt.set(k,(cnt.get(k)||0)+1);};
    for(let xx=0;xx<w;xx++){addB(xx*4);addB(((h-1)*w+xx)*4);}for(let yy=0;yy<h;yy++){addB(yy*w*4);addB((yy*w+w-1)*4);}
    if(!cnt.size)return {canvas:c,removedPct:0,note:'This image already has a transparent border.'};
    let bk=0,bn=0;cnt.forEach((n,k)=>{if(n>bn){bn=n;bk=k;}});
    /* average the actual pixels in that bucket */
    let sr=0,sg=0,sb=0,sn=0;const acc=(i)=>{if(d[i+3]<200)return;const k=((d[i]>>4)<<8)|((d[i+1]>>4)<<4)|(d[i+2]>>4);if(k===bk){sr+=d[i];sg+=d[i+1];sb+=d[i+2];sn++;}};
    for(let xx=0;xx<w;xx++){acc(xx*4);acc(((h-1)*w+xx)*4);}for(let yy=0;yy<h;yy++){acc(yy*w*4);acc((yy*w+w-1)*4);}
    const br=sr/sn,bg=sg/sn,bb=sb/sn,T=tol*2.4;
    const diff=(i)=>{const a=d[i]-br,b=d[i+1]-bg,e=d[i+2]-bb;return Math.sqrt(a*a+b*b+e*e);};
    const seen=new Uint8Array(N),stack=new Int32Array(N);let sp=0;
    const push=(p)=>{if(!seen[p]&&diff(p*4)<=T){seen[p]=1;stack[sp++]=p;}};
    for(let xx=0;xx<w;xx++){push(xx);push((h-1)*w+xx);}for(let yy=0;yy<h;yy++){push(yy*w);push(yy*w+w-1);}
    let removed=0;
    while(sp){const p=stack[--sp];removed++;const px=p%w,py=(p-px)/w;
      if(px>0)push(p-1);if(px<w-1)push(p+1);if(py>0)push(p-w);if(py<h-1)push(p+w);}
    for(let p=0;p<N;p++){if(seen[p])d[p*4+3]=0;}
    /* soft edge: pixels touching the removed area that are close to the background colour fade out */
    for(let p=0;p<N;p++){
      if(seen[p])continue;const px=p%w,py=(p-px)/w;
      const near=(px>0&&seen[p-1])||(px<w-1&&seen[p+1])||(py>0&&seen[p-w])||(py<h-1&&seen[p+w]);
      if(!near)continue;const dv=diff(p*4);
      if(dv<T*1.7)d[p*4+3]=Math.max(0,Math.min(255,Math.round(255*((dv-T)/(T*0.7+1)))));
    }
    x.putImageData(img,0,0);
    return {canvas:c,removedPct:Math.round(removed/N*100)};
  }
  function build(slot){
    const art=document.querySelector(`.site-image-slot[data-site-slot="${slot}"]`);if(!art||art.querySelector('.bgr-row'))return;
    const fileInput=art.querySelector('.site-image-file');if(!fileInput)return;
    const row=document.createElement('div');row.className='bgr-row';
    row.innerHTML='<button type="button" class="bgr-go">Remove background</button><small>Works best on plain / white backgrounds. Runs in your browser.</small>';
    const panel=document.createElement('div');panel.className='bgr-panel';panel.hidden=true;
    panel.innerHTML='<div class="bgr-view"></div><div class="bgr-ctl"><span>Tolerance</span><input type="range" class="bgr-tol" min="4" max="40" step="1" value="14"><b class="bgr-tv">14</b></div><div class="bgr-msg"></div><div class="bgr-act"><button type="button" class="use">Use this image</button><button type="button" class="cancel">Cancel</button></div>';
    fileInput.insertAdjacentElement('afterend',panel);fileInput.insertAdjacentElement('afterend',row);
    const f=byId('productForm'),view=panel.querySelector('.bgr-view'),msgEl=panel.querySelector('.bgr-msg'),tol=panel.querySelector('.bgr-tol'),tv=panel.querySelector('.bgr-tv');
    let src=null,timer=0;
    const say=(t,bad)=>{msgEl.textContent=t||'';msgEl.classList.toggle('bad',!!bad);};
    const preview=()=>{
      try{
        const res=process(src.im,Number(tol.value),PREVIEW);
        view.innerHTML='';view.appendChild(res.canvas);
        if(res.note)say(res.note,false);
        else if(res.removedPct>85)say(`Removed ${res.removedPct}% of the picture — tolerance is too high, lower it.`,true);
        else if(res.removedPct<2)say('Almost nothing was removed — raise the tolerance, or this background is not plain.',true);
        else say(`Background removed (${res.removedPct}% of the picture). Check the edges, then use it.`,false);
      }catch(e){say(e.message,true);}
    };
    row.querySelector('.bgr-go').addEventListener('click',async()=>{
      const btn=row.querySelector('.bgr-go');btn.disabled=true;say('Loading image…');panel.hidden=false;
      try{src=await loadSource(slot,f);preview();}catch(e){say(e.message,true);}
      btn.disabled=false;
    });
    tol.addEventListener('input',()=>{tv.textContent=tol.value;if(!src)return;clearTimeout(timer);timer=setTimeout(preview,120);});
    panel.querySelector('.cancel').addEventListener('click',()=>{panel.hidden=true;src=null;view.innerHTML='';});
    panel.querySelector('.use').addEventListener('click',()=>{
      if(!src)return;
      try{
        let max=MAXW,res=process(src.im,Number(tol.value),max);
        const toBlob=(cv)=>new Promise(r=>cv.toBlob(r,'image/png'));
        (async()=>{
          let blob=await toBlob(res.canvas);
          while(blob&&blob.size>4.6*1024*1024&&max>600){max=Math.round(max*0.8);res=process(src.im,Number(tol.value),max);blob=await toBlob(res.canvas);}
          if(!blob||blob.size>MAX_PRODUCT_IMAGE_BYTES){say('Result is larger than 5 MB. Try a smaller source image.',true);return;}
          const file=new File([blob],`${src.name||'product'}-nobg.png`,{type:'image/png'});
          const dt=new DataTransfer();dt.items.add(file);fileInput.files=dt.files;
          f.elements[`site_${slot}_url`].value=f.elements[`site_${slot}_url`].value;
          fileInput.dispatchEvent(new Event('input',{bubbles:true}));fileInput.dispatchEvent(new Event('change',{bubbles:true}));
          try{updateSiteImagePreview(slot);}catch(e){}
          panel.hidden=true;view.innerHTML='';src=null;
          const note=row.querySelector('small');note.textContent='Background-free image is ready. It uploads when you save the product.';
        })();
      }catch(e){say(e.message,true);}
    });
  }
  build('primary');build('secondary');build('tertiary');
  /* ===== V241 · Auto-fit (G2) · near-white to pure white (M1) · background notice (K1) ===== */
  const AF_MARGIN=0.08;
  function sampleRing(im){
    const r=Math.min(1,200/Math.max(im.naturalWidth,im.naturalHeight));
    const w=Math.max(2,Math.round(im.naturalWidth*r)),h=Math.max(2,Math.round(im.naturalHeight*r));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,w,h);
    let d;try{d=x.getImageData(0,0,w,h).data;}catch(e){return null;}
    let n=0,tr=0,sr=0,sg=0,sb=0,s2=0;const px=[];
    const take=(xx,yy)=>{const i=(yy*w+xx)*4;n++;if(d[i+3]<200){tr++;return;}px.push(d[i],d[i+1],d[i+2]);};
    for(let t=0;t<2;t++){for(let xx=0;xx<w;xx++){take(xx,t);take(xx,h-1-t);}for(let yy=0;yy<h;yy++){take(t,yy);take(w-1-t,yy);}}
    const m=px.length/3;
    if(!n)return null;
    if(tr/n>0.9||!m)return {kind:'transparent',rgb:null};
    for(let i=0;i<px.length;i+=3){sr+=px[i];sg+=px[i+1];sb+=px[i+2];}
    const mr=sr/m,mg=sg/m,mb=sb/m;let v=0;
    for(let i=0;i<px.length;i+=3){v+=Math.abs(px[i]-mr)+Math.abs(px[i+1]-mg)+Math.abs(px[i+2]-mb);}
    const dev=v/m/3,mn=Math.min(mr,mg,mb),mx=Math.max(mr,mg,mb);
    let kind='colour';
    if(dev<10&&mn>=247)kind='white';
    else if(dev<12&&mn>=215&&(mx-mn)<=24)kind='offwhite';
    return {kind,rgb:[mr,mg,mb]};
  }
  function autoFit(im){
    const r=Math.min(1,MAXW/Math.max(im.naturalWidth,im.naturalHeight));
    const w=Math.max(1,Math.round(im.naturalWidth*r)),h=Math.max(1,Math.round(im.naturalHeight*r));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,w,h);
    let img;try{img=x.getImageData(0,0,w,h);}catch(e){throw new Error('This image cannot be processed (blocked by the website). Download it and upload the file instead.');}
    const d=img.data,N=w*h;
    const ring=sampleRing(im);
    const kind=ring?ring.kind:'colour';
    const bgc=ring&&ring.rgb?ring.rgb:[255,255,255];
    const T=kind==='colour'?34:26;
    const isBg=(p)=>{const i=p*4;if(kind==='transparent')return d[i+3]<24;if(d[i+3]<24)return true;const a=d[i]-bgc[0],b=d[i+1]-bgc[1],e=d[i+2]-bgc[2];return Math.sqrt(a*a+b*b+e*e)<=T;};
    const seen=new Uint8Array(N),stack=new Int32Array(N);let sp=0;
    const push=(p)=>{if(!seen[p]&&isBg(p)){seen[p]=1;stack[sp++]=p;}};
    for(let xx=0;xx<w;xx++){push(xx);push((h-1)*w+xx);}for(let yy=0;yy<h;yy++){push(yy*w);push(yy*w+w-1);}
    while(sp){const p=stack[--sp];const px=p%w,py=(p-px)/w;if(px>0)push(p-1);if(px<w-1)push(p+1);if(py>0)push(p-w);if(py<h-1)push(p+w);}
    let minX=w,minY=h,maxX=-1,maxY=-1,keep=0;
    for(let p=0;p<N;p++){if(seen[p])continue;keep++;const px=p%w,py=(p-px)/w;if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py;}
    if(maxX<0||keep<N*0.002)throw new Error('Could not find the product in this picture.');
    if(kind==='white'||kind==='offwhite'){for(let p=0;p<N;p++){if(seen[p]){const i=p*4;d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255;}}x.putImageData(img,0,0);}
    const bw=maxX-minX+1,bh=maxY-minY+1;
    const side=Math.ceil(Math.max(bw,bh)/(1-2*AF_MARGIN));
    const out=document.createElement('canvas');out.width=side;out.height=side;
    const ox=out.getContext('2d');
    if(kind==='white'||kind==='offwhite'){ox.fillStyle='#fff';ox.fillRect(0,0,side,side);}
    else if(kind==='colour'){ox.fillStyle=`rgb(${bgc.map(v=>Math.round(v)).join(',')})`;ox.fillRect(0,0,side,side);}
    ox.drawImage(c,minX,minY,bw,bh,Math.round((side-bw)/2),Math.round((side-bh)/2),bw,bh);
    const trimPct=Math.max(0,Math.round((1-(bw*bh)/N)*100));
    return {canvas:out,kind,trimPct,box:[bw,bh]};
  }
  const KIND_TEXT={
    transparent:'',white:'',
    offwhite:'This image has an off-white background (not pure white). It can show as a faint box. Make it pure white first.',
    colour:'This image has its own background. Remove the background first so every picture looks the same.'
  };
  const bgCache=new Map();
  async function analyzeSlot(slot){
    const f=byId('productForm');if(!f)return null;
    const file=f.elements[`site_${slot}_file`]?.files?.[0];
    const url=(f.elements[`site_${slot}_url`]?.value||'').trim();
    if(!file&&!url)return {kind:'none'};
    const key=file?`f:${file.name}:${file.size}:${file.lastModified}`:`u:${url}`;
    if(bgCache.has(key))return bgCache.get(key);
    let res;
    try{const s=await loadSource(slot,f);const ring=sampleRing(s.im);res=ring?{kind:ring.kind}:{kind:'unknown'};if(s.obj)URL.revokeObjectURL(s.obj);}catch(e){res={kind:'unknown'};}
    bgCache.set(key,res);return res;
  }
  function buildV241(slot){
    const art=document.querySelector(`.site-image-slot[data-site-slot="${slot}"]`);if(!art||art.querySelector('.af-row'))return;
    const fileInput=art.querySelector('.site-image-file');const bgrRow=art.querySelector('.bgr-row');if(!fileInput||!bgrRow)return;
    const f=byId('productForm');
    const row=document.createElement('div');row.className='bgr-row af-row';
    row.innerHTML='<button type="button" class="af-go">Auto-fit</button><small>Trims empty margin, centres the product, keeps an equal border and turns an off-white background pure white.</small>';
    const panel=document.createElement('div');panel.className='bgr-panel af-panel';panel.hidden=true;
    panel.innerHTML='<div class="bgr-view"></div><div class="bgr-msg"></div><div class="bgr-act"><button type="button" class="use">Use this image</button><button type="button" class="cancel">Cancel</button></div>';
    const note=document.createElement('div');note.className='v241-bgnote';note.hidden=true;
    bgrRow.insertAdjacentElement('afterend',note);
    note.insertAdjacentElement('afterend',row);row.insertAdjacentElement('afterend',panel);
    const view=panel.querySelector('.bgr-view'),msgEl=panel.querySelector('.bgr-msg');
    let src=null,result=null;
    const say=(t,bad)=>{msgEl.textContent=t||'';msgEl.classList.toggle('bad',!!bad);};
    row.querySelector('.af-go').addEventListener('click',async()=>{
      const btn=row.querySelector('.af-go');btn.disabled=true;panel.hidden=false;say('Loading image…');
      try{src=await loadSource(slot,f);result=autoFit(src.im);view.innerHTML='';
        const prev=document.createElement('canvas');const sc=Math.min(1,PREVIEW/result.canvas.width);prev.width=Math.round(result.canvas.width*sc);prev.height=Math.round(result.canvas.height*sc);prev.getContext('2d').drawImage(result.canvas,0,0,prev.width,prev.height);view.appendChild(prev);
        say(result.kind==='colour'?'Centred with an equal border. This picture still has its own background; use Remove background first for the best result.':`Done: empty margin trimmed (${result.trimPct}%), product centred with an equal border${result.kind==='offwhite'?', background made pure white':''}.`,result.kind==='colour');
      }catch(e){say(e.message,true);}
      btn.disabled=false;
    });
    panel.querySelector('.cancel').addEventListener('click',()=>{panel.hidden=true;src=null;result=null;view.innerHTML='';});
    panel.querySelector('.use').addEventListener('click',async()=>{
      if(!result)return;
      try{
        let cv=result.canvas;const toBlob=(c2)=>new Promise(r=>c2.toBlob(r,'image/png'));
        let blob=await toBlob(cv);
        while(blob&&blob.size>4.6*1024*1024&&cv.width>600){const nc=document.createElement('canvas');nc.width=Math.round(cv.width*0.8);nc.height=Math.round(cv.height*0.8);nc.getContext('2d').drawImage(cv,0,0,nc.width,nc.height);cv=nc;blob=await toBlob(cv);}
        if(!blob||blob.size>MAX_PRODUCT_IMAGE_BYTES){say('Result is larger than 5 MB. Try a smaller source image.',true);return;}
        const file=new File([blob],`${(src&&src.name)||'product'}-fit.png`,{type:'image/png'});
        const dt=new DataTransfer();dt.items.add(file);fileInput.files=dt.files;
        fileInput.dispatchEvent(new Event('input',{bubbles:true}));fileInput.dispatchEvent(new Event('change',{bubbles:true}));
        try{updateSiteImagePreview(slot);}catch(e){}
        panel.hidden=true;view.innerHTML='';src=null;result=null;
        row.querySelector('small').textContent='Auto-fitted image is ready. It uploads when you save the product.';
      }catch(e){say(e.message,true);}
    });
  }
  async function checkSlot(slot){
    const art=document.querySelector(`.site-image-slot[data-site-slot="${slot}"]`);if(!art)return;
    const note=art.querySelector('.v241-bgnote');if(!note)return;
    const res=await analyzeSlot(slot);const kind=res?res.kind:'unknown';
    art.dataset.v241Kind=kind;
    const primary=slot==='primary';
    if(kind==='none'||kind==='transparent'||kind==='white'){note.hidden=true;note.innerHTML='';return;}
    note.hidden=false;
    if(kind==='unknown'){
      note.className='v241-bgnote info';
      note.innerHTML=primary?'<b>Could not check this image here.</b> If it is a link from another website, download it and use “Or upload local image” so the background can be checked.':'';
      note.hidden=!primary;return;
    }
    const strict=primary;
    note.className='v241-bgnote '+(strict?'warn':'info');
    note.innerHTML=`<b>${strict?'Background found':'Note'}</b> ${KIND_TEXT[kind]}<div class="v241-acts">${kind==='colour'?'<button type="button" data-v241="rm">Remove background</button>':''}<button type="button" data-v241="af">${kind==='offwhite'?'Make pure white (Auto-fit)':'Auto-fit'}</button>${strict?'<label><input type="checkbox" class="v241-keep"> Keep as is</label>':''}</div>`;
    note.querySelector('[data-v241="rm"]')?.addEventListener('click',()=>art.querySelector('.bgr-go')?.click());
    note.querySelector('[data-v241="af"]')?.addEventListener('click',()=>art.querySelector('.af-go')?.click());
  }
  const checkTimers={};
  function scheduleCheck(slot){clearTimeout(checkTimers[slot]);checkTimers[slot]=setTimeout(()=>checkSlot(slot),350);}
  ['primary','secondary','tertiary'].forEach(slot=>{
    buildV241(slot);
    const f=byId('productForm');if(!f)return;
    for(const k of ['url','file'])f.elements[`site_${slot}_${k}`]?.addEventListener(k==='url'?'input':'change',()=>scheduleCheck(slot));
  });
  const _usip=window.updateSiteImagePreview;
  if(typeof _usip==='function')window.updateSiteImagePreview=function(slot){const r=_usip.apply(this,arguments);try{scheduleCheck(slot);}catch(e){}return r;};
  /* K1: Image 1 (the only one the whole site uses) cannot be saved with its own background unless "Keep as is" is ticked */
  const pf=byId('productForm');
  pf&&pf.addEventListener('submit',e=>{
    if(e.submitter&&e.submitter.value==='cancel')return;
    const art=document.querySelector('.site-image-slot[data-site-slot="primary"]');if(!art)return;
    const k=art.dataset.v241Kind;
    if((k==='colour'||k==='offwhite')&&!art.querySelector('.v241-keep')?.checked){
      e.preventDefault();e.stopImmediatePropagation();
      const m=byId('productMsg');if(m)m.textContent='Image 1 has its own background. Remove it first (or tick “Keep as is”) so every picture on the site looks the same.';
      art.scrollIntoView({behavior:'smooth',block:'center'});
    }
  },true);
  window.ppImgTools={analyze:sampleRing,autoFit};
})();

/* V241 (H1): product search box wiring */
(function(){
  const inp=byId('productSearch'),clr=byId('productSearchClear');if(!inp)return;
  let t=0;inp.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(renderProducts,80);});
  inp.addEventListener('keydown',e=>{if(e.key==='Escape'){inp.value='';renderProducts();}});
  clr&&clr.addEventListener('click',()=>{inp.value='';renderProducts();inp.focus();});
})();

/* ===== V241 · J1: Brand / Store tile colour saved with the logo ===== */
(function(){
  const HEXRE=/#ppc=([0-9a-fA-F]{6})/;
  const toHex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
  function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);h*=60;}return [h,s,l];}
  function hsl2rgb(h,s,l){h/=360;const f=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};if(!s){const v=l*255;return [v,v,v];}const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;return [f(p,q,h+1/3)*255,f(p,q,h)*255,f(p,q,h-1/3)*255];}
  function dominant(img){
    const w=48,h=48,c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,w,h);
    const d=x.getImageData(0,0,w,h).data,bins=new Array(12).fill(0).map(()=>({n:0,r:0,g:0,b:0}));let dark={n:0,r:0,g:0,b:0};
    for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];if(a<128)continue;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mn>225)continue;if(mx-mn<28){dark.n++;dark.r+=r;dark.g+=g;dark.b+=b;continue;}const [hh,ss]=rgb2hsl(r,g,b),k=Math.floor(hh/30)%12,wgt=0.4+ss,bin=bins[k];bin.n+=wgt;bin.r+=r*wgt;bin.g+=g*wgt;bin.b+=b*wgt;}
    let best=null;for(const b of bins)if(b.n>0&&(!best||b.n>best.n))best=b;
    if(best&&best.n>=3){const r=best.r/best.n,g=best.g/best.n,b=best.b/best.n;let [hh,ss,ll]=rgb2hsl(r,g,b);ss=Math.max(ss,.45);ll=Math.max(.32,Math.min(.52,ll));return toHex(...hsl2rgb(hh,ss,ll));}
    if(dark.n>=3)return toHex(dark.r/dark.n*.6,dark.g/dark.n*.6,dark.b/dark.n*.6);
    return '';
  }
  function colourFromSrc(src,cors){return new Promise(res=>{const im=new Image();if(cors)im.crossOrigin='anonymous';im.onload=()=>{try{res(dominant(im));}catch(e){res('');}};im.onerror=()=>res('');im.src=src;});}
  async function colourFromFile(file){const u=URL.createObjectURL(file);try{return await colourFromSrc(u,false);}finally{URL.revokeObjectURL(u);}}
  const strip=u=>String(u||'').replace(HEXRE,'');
  const state={brands:{touched:false},stores:{touched:false}};
  function setup(formId,kind){
    const f=byId(formId);if(!f||!f.elements.logo_url||f.querySelector('.ppc-row'))return;
    const box=f.elements.logo_url.closest('div')||f.elements.logo_url.parentElement;
    const row=document.createElement('div');row.className='ppc-row';
    row.innerHTML='<label>Tile colour <small>(Home Shop by Brand / Store)</small></label><div class="ppc-line"><input type="color" name="logo_color" value="#b8862b"><button type="button" class="ppc-auto">Auto from logo</button><small class="ppc-note">Picked automatically from the logo when you upload it. You can change it.</small></div>';
    box.insertAdjacentElement('afterend',row);
    const col=f.elements.logo_color,note=row.querySelector('.ppc-note');
    const mark=()=>{state[kind].touched=true;};
    col.addEventListener('input',mark);
    const auto=async()=>{
      const file=f.elements.logo_file?.files?.[0];const url=strip(f.elements.logo_url.value).trim();
      let c='';note.textContent='Reading the logo…';
      try{c=file?await colourFromFile(file):(url?await colourFromSrc(url,true):'');}catch(e){c='';}
      if(c){col.value=c;state[kind].touched=true;note.textContent='Colour picked from the logo. You can change it.';}
      else note.textContent=file||url?'Could not read this logo here, so pick a colour yourself.':'Add a logo first.';
    };
    row.querySelector('.ppc-auto').addEventListener('click',auto);
    f.elements.logo_file?.addEventListener('change',()=>{if(f.elements.logo_file.files?.[0])auto();});
    /* open for edit: take the saved colour out of the URL box */
    const sync=()=>{const m=HEXRE.exec(f.elements.logo_url.value||'');if(m){col.value='#'+m[1];state[kind].touched=true;f.elements.logo_url.value=strip(f.elements.logo_url.value);}else{state[kind].touched=false;}};
    new MutationObserver(()=>{}).observe(f,{childList:true});
    const dlg=f.closest('dialog');
    if(dlg)new MutationObserver(()=>{if(dlg.open)setTimeout(sync,0);}).observe(dlg,{attributes:true,attributeFilter:['open']});
    /* URL typed by hand: add the colour on save */
    f.addEventListener('submit',()=>{
      if(f.elements.logo_file?.files?.[0])return;
      if(state[kind].touched&&f.elements.logo_url.value.trim()){f.elements.logo_url.value=strip(f.elements.logo_url.value).trim()+'#ppc='+f.elements.logo_color.value.replace('#','');}
    },true);
  }
  setup('brandForm','brands');setup('storeForm','stores');
  /* uploads: the colour goes into the saved logo address */
  const origUp=window.uploadCatalogLogo;
  if(typeof origUp==='function')window.uploadCatalogLogo=async function(kind,slug,file){
    const url=await origUp.apply(this,arguments);
    const f=byId(kind==='stores'?'storeForm':'brandForm');const c=f&&f.elements.logo_color&&state[kind==='stores'?'stores':'brands'].touched?f.elements.logo_color.value.replace('#',''):'';
    return c&&url?strip(url)+'#ppc='+c:url;
  };
  const st=document.createElement('style');st.textContent='.ppc-row{grid-column:1/-1;margin:2px 0}.ppc-row label{display:block;font-weight:800;margin-bottom:5px}.ppc-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ppc-line input[type=color]{width:46px;height:34px;padding:2px;border:1px solid #cfe0d8;border-radius:8px;background:#fff}.ppc-auto{border:1px solid #bcd9cd;background:#f1faf6;color:#08734d;font:800 12px/1 inherit;padding:9px 12px;border-radius:9px;cursor:pointer}.ppc-note{color:#587080}';
  document.head.appendChild(st);
})();

/* ===== V241 · N1: Brand / Store tile + Deal Radar previews ===== */
(function(){
  const HEXRE=/#ppc=([0-9a-fA-F]{6})/;
  function tileColor(brand){
    const m=HEXRE.exec(String(brand&&brand.logoUrl||''));return m?'#'+m[1]:'#B8862B';
  }
  function update(primary){
    const tile=byId('tilePrev'),img=byId('tilePrevImg');if(!tile||!img)return;
    const f=byId('productForm');const brand=f&&brands.find(b=>b.slug===f.elements.brand_slug?.value)||null;
    tile.style.setProperty('--c',tileColor(brand));
    const bl=tile.querySelector('[data-tile-brand]');
    if(bl){const src=String(brand&&brand.logoUrl||'').replace(HEXRE,'');if(src){bl.src=src;bl.hidden=false;}else bl.hidden=true;}
    if(primary&&primary.src){img.src=primary.src;img.hidden=false;}else{img.hidden=true;img.removeAttribute('src');}
  }
  const orig=window.updateGlobalSurfacePreviews;
  if(typeof orig==='function')window.updateGlobalSurfacePreviews=function(primary){const r=orig.apply(this,arguments);try{update(primary);}catch(e){}return r;};
})();
