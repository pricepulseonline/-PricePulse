/* PricePulse AI-PLAN P10 — photo search. A camera button in the header search: take / pick a photo of a product or its box,
   our server asks the AI only "which product is this?" (name, never a price), then the normal search + Smart picks run with
   that name, and "Compare on other stores" opens Price Check search. Photo is made small in the phone first (max 768 px). */
(function(){
  'use strict';
  if(window.__ppPhotoV1)return;window.__ppPhotoV1=true;
  const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ICON='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  function css(){if(document.getElementById('ppPhCss'))return;const st=document.createElement('style');st.id='ppPhCss';
    st.textContent='.pph-btn{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border:0;border-radius:10px;background:transparent;color:inherit;cursor:pointer;flex:none}.pph-btn:hover{background:rgba(31,122,85,.08)}.pph-tip{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;background:#10211b;color:#fff;padding:10px 14px;border-radius:12px;font-size:13.5px;max-width:92vw;box-shadow:0 8px 30px rgba(0,0,0,.3)}.pph-tip a,.pph-tip button{color:#3DDC97;background:none;border:0;font:inherit;font-weight:700;cursor:pointer;text-decoration:underline;margin-left:6px}';document.head.appendChild(st);}
  let tipT=0;function tip(html,ms){let t=document.getElementById('pphTip');if(!t){t=document.createElement('div');t.id='pphTip';t.className='pph-tip';t.setAttribute('role','status');document.body.appendChild(t);}t.innerHTML=html;clearTimeout(tipT);if(ms)tipT=setTimeout(()=>t.remove(),ms);return t;}
  function shrink(file){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const s=Math.min(1,768/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);res(c.toDataURL('image/jpeg',0.8).split(',')[1]);};img.onerror=rej;img.src=URL.createObjectURL(file);});}
  async function run(file){
    if(!file)return;if(typeof supabaseClient==='undefined'||!supabaseClient){tip('Photo search needs the internet connection.',3000);return;}
    tip('Looking at your photo…');
    let b64='';try{b64=await shrink(file);}catch(_){tip('Could not read this photo. Try another one.',3500);return;}
    let r;try{r=await supabaseClient.functions.invoke('ai-link-compare',{body:{mode:'photo',image:b64,media:'image/jpeg'}});}catch(e){r={error:e};}
    const d=r&&r.data||{};
    if(r.error||!d.ok||!d.product||!d.product.query){tip(d.error==='limit'?'You used photo search a lot today. Try tomorrow or type the name.':'We could not tell the product from this photo. Try a clear photo of the front or the box.',4500);return;}
    const q=d.product.query;
    const inp=document.querySelector('#siteSearch input');
    if(inp){inp.value=q;inp.dispatchEvent(new Event('input',{bubbles:true}));const f=document.getElementById('siteSearch');f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event('submit',{cancelable:true}));}
    tip(`${d.product.sure?'Looks like':'Maybe'}: <b>${H(q)}</b><button type="button" data-pph-x>OK</button>`,9000).querySelector('[data-pph-x]')?.addEventListener('click',()=>document.getElementById('pphTip')?.remove());
  }
  function install(){
    const form=document.getElementById('siteSearch');if(!form||form.querySelector('.pph-btn'))return !!form;
    css();
    const b=document.createElement('button');b.type='button';b.className='pph-btn';b.setAttribute('aria-label','Search with a photo');b.title='Search with a photo';b.innerHTML=ICON;
    const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.setAttribute('capture','environment');inp.hidden=true;
    b.addEventListener('click',()=>inp.click());inp.addEventListener('change',()=>{run(inp.files&&inp.files[0]);inp.value='';});
    const text=form.querySelector('input');(text&&text.parentNode?text:form).insertAdjacentElement('afterend',b);form.appendChild(inp);
    return true;
  }
  let n=0;const iv=setInterval(()=>{if(install()||++n>40)clearInterval(iv);},500);
})();
