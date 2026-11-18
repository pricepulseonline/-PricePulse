/* PricePulse Admin — private devotional mark (golden Trishul + mantra).
   Admin-only: the text is NOT in any file; it is read from Supabase (RLS: price admins only)
   after admin access is confirmed. Needs supabase-admin-om-v1.sql once. Shows nothing otherwise. */
(function(){
  if(window.__ppOm)return;window.__ppOm=1;
  const css=[
    '.pp-om{flex:1 1 auto;display:flex;align-items:center;justify-content:center;gap:10px;min-width:0;padding:0 8px}',
    '.pp-om-ln{height:1px;width:56px;flex:none;background:linear-gradient(90deg,transparent,#E6C36A)}',
    '.pp-om-ln.r{transform:scaleX(-1)}',
    '.pp-om-dia{width:7px;height:7px;flex:none;background:#E6C36A;transform:rotate(45deg)}',
    '.pp-om-tr{position:relative;width:36px;height:46px;flex:none}',
    '.pp-om-gl{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:radial-gradient(circle,rgba(246,222,154,.5),rgba(230,195,106,0) 68%);animation:ppOmBr 4s ease-in-out infinite}',
    '@keyframes ppOmBr{0%,100%{opacity:.35;transform:scale(.9)}50%{opacity:.9;transform:scale(1.08)}}',
    '.pp-om-tr svg{position:relative;width:100%;height:100%;display:block}',
    '.pp-om-tx{font:500 21px/1.25 "Noto Sans Devanagari","Kohinoor Devanagari","Devanagari Sangam MN",system-ui,sans-serif;letter-spacing:0;color:#EBC96E;white-space:nowrap;text-shadow:0 0 8px rgba(230,195,106,.12)}',
    '@media(max-width:650px){.pp-om{flex:none;width:100%;order:2;padding:2px 0}.brand-head-card>div:last-child{order:3}.pp-om-ln{width:34px}.pp-om-dia{display:none}.pp-om-tr{width:30px;height:39px}.pp-om-gl{width:54px;height:54px;margin:-27px 0 0 -27px}.pp-om-tx{font-size:18px}}',
    '@media(prefers-reduced-motion:reduce){.pp-om-gl{animation:none;opacity:.6}}'
  ].join('\n');
  const svg='<svg viewBox="0 0 24 32" aria-hidden="true"><defs><linearGradient id="ppOmG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBE9B0"/><stop offset="1" stop-color="#C9A24A"/></linearGradient></defs><g fill="url(#ppOmG)" stroke="url(#ppOmG)" stroke-linecap="round" stroke-linejoin="round"><path d="M12 .8 9.6 6.2h4.8z" stroke-width=".6"/><path d="M5 2 3.2 6.4h3.6zM19 2l-1.8 4.4h3.6z" stroke-width=".6"/><path d="M12 6v25M5 6.4V11q0 5 7 5t7-5V6.4" fill="none" stroke-width="1.9"/><path d="M9.2 18.2h5.6L12 21zM9.2 23.8h5.6L12 21z" stroke-width=".4"/></g></svg>';
  const ready=()=>typeof api!=='undefined'&&api&&typeof permitted!=='undefined'&&permitted;
  let tries=0,busy=false;
  function build(txt){
    const head=document.querySelector('.brand-head-card');
    if(!txt||!head||head.querySelector('.pp-om'))return;
    if(!document.getElementById('ppOmFont')){const lk=document.createElement('link');lk.id='ppOmFont';lk.rel='stylesheet';lk.href='https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@500&display=swap';document.head.appendChild(lk);}
    if(!document.getElementById('ppOmCss')){const st=document.createElement('style');st.id='ppOmCss';st.textContent=css;document.head.appendChild(st);}
    const box=document.createElement('div');box.className='pp-om';
    box.innerHTML='<div class="pp-om-ln"></div><div class="pp-om-dia"></div><div class="pp-om-tr"><div class="pp-om-gl"></div>'+svg+'</div><div class="pp-om-tx"></div><div class="pp-om-dia"></div><div class="pp-om-ln r"></div>';
    box.querySelector('.pp-om-tx').textContent=txt;
    head.insertBefore(box,head.children[1]||null);
  }
  window.__ppOmBuild=build;
  async function show(){
    if(busy||document.querySelector('.pp-om'))return;busy=true;
    try{
      const {data,error}=await api.from('pp_admin_private').select('value').eq('key','om').maybeSingle();
      build(!error&&data&&String(data.value||'').trim());
    }catch(e){}finally{busy=false;}
  }
  const timer=setInterval(()=>{tries++;if(ready()){clearInterval(timer);show();}else if(tries>240)clearInterval(timer);},500);
})();
