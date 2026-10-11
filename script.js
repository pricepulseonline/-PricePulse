const SUPABASE_URL="https://akdrydxbvdtadmcphhxj.supabase.co";
const SUPABASE_KEY="sb_publishable_RZAK4TwpJO6fi3Y306EGaA_PpZdiqHG";
const supabaseClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);
// Future Wallet referral bridge: remember a valid referral code until the rewards backend is enabled.
try{const ppReferralCode=new URLSearchParams(location.search).get('ref');if(/^PULSE[A-Z0-9-]{6,20}$/i.test(ppReferralCode||''))localStorage.setItem('pp_pending_referral_code',String(ppReferralCode).toUpperCase())}catch{}

const PP_PENDING_REFERRAL_KEY='pp_pending_referral_code';
const PP_WALLET_REF_CODE_MAP='pp_wallet_referral_code_map_v1';
const PP_WALLET_REFERRALS='pp_wallet_referrals_local_v1';
const PP_WALLET_TX='pp_wallet_transactions_local_v1';
function ppWalletReadJson(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function ppWalletWriteJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function ppWalletReferralCodeFor(user){return user?.id?`PULSE${user.id.replace(/-/g,'').slice(0,8).toUpperCase()}`:''}
function ppWalletBackendMissing(error){return Boolean(error&&(error.code==='42P01'||error.code==='PGRST202'||error.code==='PGRST205'||/does not exist|schema cache|could not find the (function|table)|relation .* does not exist/i.test(String(error.message||''))))}
function ppWalletLocalId(){try{return crypto.randomUUID()}catch{return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`}}
function ppWalletLocalClaimReferral(user,profile,code){
  const clean=String(code||'').trim().toUpperCase();if(!user?.id||!clean)return {status:'invalid'};
  if(clean===ppWalletReferralCodeFor(user)){localStorage.removeItem(PP_PENDING_REFERRAL_KEY);return {status:'self_referral_blocked'};}
  const map=ppWalletReadJson(PP_WALLET_REF_CODE_MAP,{}),owner=map[clean];
  if(!owner?.user_id)return {status:'waiting_for_backend'};
  if(String(owner.user_id)===String(user.id)){localStorage.removeItem(PP_PENDING_REFERRAL_KEY);return {status:'self_referral_blocked'};}
  const refs=ppWalletReadJson(PP_WALLET_REFERRALS,[]);
  const existing=refs.find(r=>String(r.referred_user_id||'')===String(user.id));
  if(existing){localStorage.removeItem(PP_PENDING_REFERRAL_KEY);return {status:'already_referred',referral:existing};}
  const now=new Date().toISOString(),id=ppWalletLocalId();
  const referral={id,referrer_user_id:owner.user_id,referred_user_id:user.id,referral_code:clean,status:'joined',referrer_target:100,referrer_unlocked:0,friend_target:100,friend_unlocked:0,shopping_started:false,created_at:now,updated_at:now};
  refs.push(referral);ppWalletWriteJson(PP_WALLET_REFERRALS,refs);
  const tx=ppWalletReadJson(PP_WALLET_TX,[]);
  tx.push({id:ppWalletLocalId(),user_id:owner.user_id,entry_type:'referral_reward',title:'Referral Reward',amount:0,status:'pending',target_amount:100,unlocked_amount:0,source_ref:`ref:${id}:referrer`,note:'₹100 target · unlocks after your friend’s eligible confirmed shopping.',created_at:now,updated_at:now});
  tx.push({id:ppWalletLocalId(),user_id:user.id,entry_type:'welcome_referral_reward',title:'Welcome Reward',amount:0,status:'pending',target_amount:100,unlocked_amount:0,source_ref:`ref:${id}:friend`,note:'₹100 welcome target · unlocks after your eligible confirmed shopping.',created_at:now,updated_at:now});
  ppWalletWriteJson(PP_WALLET_TX,tx);localStorage.removeItem(PP_PENDING_REFERRAL_KEY);
  return {status:'joined',referral};
}
async function ppAttachPendingReferral(){
  if(!currentUser||!profileComplete(currentProfile))return null;
  let code='';try{code=String(localStorage.getItem(PP_PENDING_REFERRAL_KEY)||'').trim().toUpperCase()}catch{}
  if(!/^PULSE[A-Z0-9-]{6,20}$/.test(code))return null;
  if(code===ppWalletReferralCodeFor(currentUser)){try{localStorage.removeItem(PP_PENDING_REFERRAL_KEY)}catch{};showToast('Your own referral code cannot be used on your account.');return {status:'self_referral_blocked'};}
  if(supabaseClient){
    try{
      const q=await supabaseClient.rpc('pp_claim_referral',{input_code:code});
      if(!q.error){
        const out=Array.isArray(q.data)?q.data[0]:q.data;try{localStorage.removeItem(PP_PENDING_REFERRAL_KEY)}catch{}
        if(out?.status==='joined')showToast('Referral linked · ₹100 + ₹100 reward pending');
        return out||{status:'processed'};
      }
      if(!ppWalletBackendMissing(q.error)){console.warn('Referral claim failed',q.error);return null}
    }catch(err){if(!ppWalletBackendMissing(err)){console.warn('Referral claim failed',err);return null}}
  }
  const local=ppWalletLocalClaimReferral(currentUser,currentProfile,code);
  if(local?.status==='joined')showToast('Referral linked · ₹100 + ₹100 reward pending');
  else if(local?.status==='self_referral_blocked')showToast('Self-referral blocked');
  return local;
}

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const SUPPORT_EMAIL="pricepulseonline@gmail.com";

const toast=$("#toast");
let tt;
let currentUser=null;
let currentProfile=null;
let otpResendTimer=null;
const OAUTH_PENDING_KEY="pp_google_oauth_pending";
const AUTH_PENDING_ACTION_KEY="pp_auth_pending_action_v1";

function showToast(message){
  if(!toast) return;
  toast.textContent=message;
  toast.classList.add("show");
  clearTimeout(tt);
  tt=setTimeout(()=>toast.classList.remove("show"),1800);
}

function go(selector){
  $(selector)?.scrollIntoView({behavior:"smooth",block:"start"});
}

function escapeHTML(value=""){
  return String(value).replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

const cards=$$(".deal-card");
const noResults=$("#noResults");
const search=$("#searchInput");
let activeBrand="all";
let activeStore="all";

// V76.8: typo-tolerant + related-word product discovery.
// Keep aliases conservative so a broad term helps discovery without flooding results.
const PP_SEARCH_ALIASES={
  cream:["moisturizer","moisturiser","lotion"],
  moisturizer:["cream","moisturiser","lotion"],
  moisturiser:["cream","moisturizer","lotion"],
  lotion:["cream","moisturizer","moisturiser"],
  mobile:["phone","smartphone"], mobiles:["phone","smartphone"],
  phone:["mobile","smartphone"], phones:["mobile","smartphone"],
  smartphone:["mobile","phone"], smartphones:["mobile","phone"],
  headphone:["headphones","headset","earphone","earphones"],
  headphones:["headphone","headset","earphone","earphones"],
  headset:["headphone","headphones","earphone","earphones"],
  earphone:["headphone","headphones","earphones"], earphones:["headphone","headphones","earphone"],
  earbud:["earbuds","buds","tws"], earbuds:["earbud","buds","tws"], buds:["earbud","earbuds","tws"], tws:["earbud","earbuds","buds"],
  shoe:["shoes","sneaker","sneakers","footwear"], shoes:["shoe","sneaker","sneakers","footwear"],
  sneaker:["shoe","shoes","sneakers","footwear"], sneakers:["shoe","shoes","sneaker","footwear"], footwear:["shoe","shoes","sneaker","sneakers"],
  watch:["watches","smartwatch"], watches:["watch","smartwatch"], smartwatch:["watch","watches"],
  juicer:["mixer","grinder","blender"], mixer:["juicer","grinder","blender"], grinder:["juicer","mixer","blender"], blender:["juicer","mixer","grinder"],
  laptop:["laptops","notebook"], laptops:["laptop","notebook"], notebook:["laptop","laptops"],
  sunscreen:["sunblock","spf"], sunblock:["sunscreen","spf"], spf:["sunscreen","sunblock"],
  skincare:["beauty","cosmetic","cosmetics"], beauty:["skincare","cosmetic","cosmetics"],
  cosmetic:["beauty","skincare","cosmetics"], cosmetics:["beauty","skincare","cosmetic"]
};
const PP_SEARCH_STOPWORDS=new Set(["a","an","the","and","or","for","with","of","in","ka","ki","ke","wala","wali"]);

function ppNormalizeSearch(value=""){
  return String(value).toLowerCase()
    .replace(/&/g," and ")
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

// Damerau-Levenshtein distance with an early cut-off. A transposed letter such as
// "moblie" for "mobile" counts as one typo.
function ppSearchDistance(a,b,maxDistance=2){
  if(a===b)return 0;
  if(Math.abs(a.length-b.length)>maxDistance)return maxDistance+1;
  const prevPrev=new Array(b.length+1).fill(0);
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const curr=[i];
    let rowMin=curr[0];
    for(let j=1;j<=b.length;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      let value=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+cost);
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) value=Math.min(value,prevPrev[j-2]+1);
      curr[j]=value;
      rowMin=Math.min(rowMin,value);
    }
    if(rowMin>maxDistance)return maxDistance+1;
    for(let j=0;j<prev.length;j++)prevPrev[j]=prev[j];
    prev=curr;
  }
  return prev[b.length];
}

function ppSearchWordMatches(queryWord,searchWords,searchText){
  const variants=[queryWord,...(PP_SEARCH_ALIASES[queryWord]||[])];
  for(const variant of variants){
    if(searchText.includes(variant))return true;
    for(const word of searchWords){
      if(word===variant)return true;
      // Partial typing remains useful ("moist" -> moisturizer), but only from 3 chars.
      if(Math.min(variant.length,word.length)>=3 && (word.startsWith(variant)||variant.startsWith(word)))return true;
      const maxTypos=Math.max(variant.length,word.length)>=7?2:1;
      if(Math.min(variant.length,word.length)>=4 && ppSearchDistance(variant,word,maxTypos)<=maxTypos)return true;
    }
  }
  // If the typed word itself is a small typo of an alias key (e.g. "crem" -> cream),
  // try that alias group too.
  if(queryWord.length>=4){
    for(const [aliasKey,aliasValues] of Object.entries(PP_SEARCH_ALIASES)){
      const maxTypos=Math.max(queryWord.length,aliasKey.length)>=7?2:1;
      if(ppSearchDistance(queryWord,aliasKey,maxTypos)<=maxTypos){
        for(const variant of [aliasKey,...aliasValues]){
          if(searchText.includes(variant))return true;
          if(searchWords.some(word=>word===variant||(Math.min(variant.length,word.length)>=3&&(word.startsWith(variant)||variant.startsWith(word)))))return true;
        }
      }
    }
  }
  return false;
}

function ppSmartSearchMatch(searchText,query){
  const normalizedQuery=ppNormalizeSearch(query);
  if(!normalizedQuery)return true;
  const normalizedText=ppNormalizeSearch(searchText);
  if(normalizedText.includes(normalizedQuery))return true;
  const searchWords=normalizedText.split(" ").filter(Boolean);
  const queryWords=normalizedQuery.split(" ").filter(word=>word.length>1&&!PP_SEARCH_STOPWORDS.has(word));
  if(!queryWords.length)return true;
  return queryWords.every(word=>ppSearchWordMatches(word,searchWords,normalizedText));
}

function filterProducts(category="all", query=""){
  let visible=0;
  cards.forEach(card=>{
    const categoryMatch=category==="all" || card.dataset.category===category;
    const brandMatch=activeBrand==="all" || card.dataset.brand===activeBrand;
    const stores=(card.dataset.stores||"").toLowerCase().split(/\s+/).filter(Boolean);
    const storeMatch=activeStore==="all" || stores.includes(activeStore);
    const searchMatch=ppSmartSearchMatch(card.dataset.search||"",query);
    const show=categoryMatch && brandMatch && storeMatch && searchMatch;
    card.hidden=!show;
    if(show) visible++;
  });
  noResults.hidden=visible>0;
  $("#dealGrid")?.classList.toggle("single-result", visible===1);
}

function setBrandActive(brand="all"){
  $$(".brand-card[data-brand]").forEach(btn=>{
    btn.classList.toggle("active",brand!=="all" && btn.dataset.brand===brand);
  });
}

function resetBrandFilter(){
  activeBrand="all";
  setBrandActive("all");
}

function setStoreActive(store="all"){
  $$(".store-card[data-store]").forEach(btn=>{
    btn.classList.toggle("active",store!=="all" && btn.dataset.store===store);
  });
  $("#viewAllStores")?.classList.toggle("active",store==="all");
}

function resetStoreFilter(){
  activeStore="all";
  setStoreActive("all");
}

function setTopCategoryActive(category){
  $$(".category-nav [data-cat]").forEach(btn=>{
    btn.classList.toggle("nav-selected",btn.dataset.cat===category);
  });
}

function pickCategory(category,shouldScroll=true){
  resetBrandFilter();
  resetStoreFilter();
  filterProducts(category);
  setTopCategoryActive(category);
  $$(".deal-tabs button").forEach(btn=>{
    btn.classList.toggle("active",btn.dataset.filter===category);
  });
  if(shouldScroll) go("#deals");
}

$$("[data-scroll]").forEach(btn=>{
  btn.addEventListener("click",()=>go(btn.dataset.scroll));
});

$("#siteSearch")?.addEventListener("submit",e=>{
  e.preventDefault();
  resetBrandFilter();
  resetStoreFilter();
  setTopCategoryActive("");
  filterProducts("all",search.value);
  go("#deals");
  showToast(search.value?`Showing matches for "${search.value}"`:"Showing all products");
});

$$(".category-nav [data-cat]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    closeCategoriesMenu();
    pickCategory(btn.dataset.cat,true);
  });
});

$$(".category-card[data-cat]").forEach(btn=>{
  btn.addEventListener("click",()=>pickCategory(btn.dataset.cat,true));
});

$("#viewAllCategories")?.addEventListener("click",()=>{
  resetBrandFilter();
  resetStoreFilter();
  setTopCategoryActive("");
  filterProducts("all");
  $$(".deal-tabs button").forEach(btn=>btn.classList.toggle("active",btn.dataset.filter==="all"));
  go("#deals");
});

$$(".deal-tabs button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const category=btn.dataset.filter;
    resetBrandFilter();
    resetStoreFilter();
    if(search) search.value="";
    filterProducts(category);
    setTopCategoryActive(category==="all"?"":category);
    $$(".deal-tabs button").forEach(x=>x.classList.toggle("active",x===btn));
  });
});


$$(".brand-card[data-brand]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    resetStoreFilter();
    activeBrand=btn.dataset.brand;
    setBrandActive(activeBrand);
    if(search) search.value="";
    setTopCategoryActive("");
    $$(".deal-tabs button").forEach(tab=>tab.classList.toggle("active",tab.dataset.filter==="all"));
    filterProducts("all");
    go("#deals");
    const label=btn.dataset.label || btn.querySelector(".brand-meta b")?.textContent || "Selected brand";
    showToast(`Showing ${label} products`);
  });
});

function ppDiscoveryCountByBrand(brand){
  return cards.filter(card=>card.dataset.brand===brand).length;
}
function ppDiscoveryCountByStore(store){
  return cards.filter(card=>(card.dataset.stores||"").toLowerCase().split(/\s+/).includes(store)).length;
}
function ppDiscoveryCardLogoHTML(card,selector){
  const logo=card.querySelector(selector);
  return logo?logo.innerHTML:"";
}
function ppOpenAllBrands(){
  const items=$$(".brand-card[data-brand]").map(card=>{
    const brand=card.dataset.brand;
    const label=card.dataset.label||brand;
    const category=card.querySelector(".brand-category")?.textContent?.trim()||"Shop brand";
    const count=ppDiscoveryCountByBrand(brand);
    return `<button type="button" class="pp-discovery-card" data-discovery-brand="${escapeHTML(brand)}" aria-label="View ${escapeHTML(label)} products"><span class="pp-discovery-logo pp-discovery-brand-logo">${ppDiscoveryCardLogoHTML(card,".brand-logo-panel")}</span><strong>${escapeHTML(label)}</strong><small>${escapeHTML(category)}</small><em>${count} ${count===1?"product":"products"}</em></button>`;
  }).join("");
  openModal(`<div class="pp-discovery-shell"><div class="pp-discovery-head"><span>SHOP BY BRAND</span><h2>All Brands</h2><p>Choose a brand to view its products and compare available store offers.</p></div><div class="pp-discovery-all-grid pp-discovery-brand-grid">${items}</div></div>`,true);
}
function ppOpenAllStores(){
  const items=$$(".store-card[data-store]").map(card=>{
    const store=card.dataset.store;
    const label=card.dataset.label||store;
    const count=ppDiscoveryCountByStore(store);
    return `<button type="button" class="pp-discovery-card" data-discovery-store="${escapeHTML(store)}" aria-label="View products available on ${escapeHTML(label)}"><span class="pp-discovery-logo pp-discovery-store-logo">${ppDiscoveryCardLogoHTML(card,".store-logo-panel")}</span><strong>${escapeHTML(label)}</strong><small>Compare store offers</small><em>${count} ${count===1?"product":"products"}</em></button>`;
  }).join("");
  openModal(`<div class="pp-discovery-shell"><div class="pp-discovery-head"><span>SHOP BY STORE</span><h2>All Stores</h2><p>Choose a store to see products currently mapped for price comparison.</p></div><div class="pp-discovery-all-grid pp-discovery-store-grid">${items}</div></div>`,true);
}

$("#viewAllBrands")?.addEventListener("click",ppOpenAllBrands);


$$('.store-card[data-store]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    resetBrandFilter();
    activeStore=btn.dataset.store;
    setStoreActive(activeStore);
    if(search) search.value='';
    setTopCategoryActive('');
    $$('.deal-tabs button').forEach(tab=>tab.classList.toggle('active',tab.dataset.filter==='all'));
    filterProducts('all');
    go('#deals');
    const label=btn.dataset.label || btn.querySelector('.store-meta b')?.textContent || 'Selected store';
    showToast(`Showing products available on ${label}`);
  });
});


/* V41: Samsung is displayed as a future brand until products are mapped. */
$$('.brand-preview-card[data-brand-preview]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const label=btn.dataset.label || 'This brand';
    showToast(`${label} deals are coming soon`);
  });
});

/* V37: AJIO is displayed as a future store until product links are mapped. */
$$('.store-preview-card[data-store-preview]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const label=btn.dataset.label || 'This store';
    showToast(`${label} product comparison is coming soon`);
  });
});
$('#viewAllStores')?.addEventListener('click',ppOpenAllStores);

document.addEventListener('click',event=>{
  const brandButton=event.target.closest('[data-discovery-brand]');
  if(brandButton){
    const brand=brandButton.dataset.discoveryBrand;
    resetStoreFilter();
    activeBrand=brand;
    setBrandActive(activeBrand);
    if(search) search.value='';
    setTopCategoryActive('');
    $$('.deal-tabs button').forEach(tab=>tab.classList.toggle('active',tab.dataset.filter==='all'));
    filterProducts('all');
    const source=$(`.brand-card[data-brand="${CSS.escape(brand)}"]`);
    const label=source?.dataset.label||'Selected brand';
    closeModal();
    go('#deals');
    showToast(`Showing ${label} products`);
    return;
  }
  const storeButton=event.target.closest('[data-discovery-store]');
  if(storeButton){
    const store=storeButton.dataset.discoveryStore;
    resetBrandFilter();
    activeStore=store;
    setStoreActive(activeStore);
    if(search) search.value='';
    setTopCategoryActive('');
    $$('.deal-tabs button').forEach(tab=>tab.classList.toggle('active',tab.dataset.filter==='all'));
    filterProducts('all');
    const source=$(`.store-card[data-store="${CSS.escape(store)}"]`);
    const label=source?.dataset.label||'Selected store';
    closeModal();
    go('#deals');
    showToast(`Showing products available on ${label}`);
  }
});

/* Wishlist: guest local storage + authenticated Supabase sync. */
const LEGACY_WISHLIST_KEY="pp_wish";
const GUEST_WISHLIST_KEY="pp_wish_guest";
const WISHLIST_TABLE="wishlist_items";

function readWishlistKey(key){
  try{return new Set(JSON.parse(localStorage.getItem(key)||"[]"));}
  catch{return new Set();}
}

if(localStorage.getItem(LEGACY_WISHLIST_KEY) && !localStorage.getItem(GUEST_WISHLIST_KEY)){
  localStorage.setItem(GUEST_WISHLIST_KEY,localStorage.getItem(LEGACY_WISHLIST_KEY));
  localStorage.removeItem(LEGACY_WISHLIST_KEY);
}

const saved=readWishlistKey(GUEST_WISHLIST_KEY);

/* V72: wishlist tracking metadata lives beside the existing wishlist IDs.
   Product IDs still sync through Supabase; this lightweight browser metadata
   remembers the saved-time price/store so the panel can truthfully show changes. */
const WISHLIST_META_GUEST_KEY="pp_wish_meta_guest_v72";
function wishlistMetaKey(userId=currentUser?.id){
  return userId?`pp_wish_meta_user_${userId}_v72`:WISHLIST_META_GUEST_KEY;
}
function readWishlistMeta(key=wishlistMetaKey()){
  try{
    const value=JSON.parse(localStorage.getItem(key)||"{}");
    return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  }catch{return {};}
}
function writeWishlistMeta(meta,key=wishlistMetaKey()){
  try{localStorage.setItem(key,JSON.stringify(meta||{}));}catch{}
}
function ppWishlistMetaEntry(id,key=wishlistMetaKey()){
  return readWishlistMeta(key)[String(id)]||null;
}
function ppSetWishlistMetaEntry(id,value,key=wishlistMetaKey()){
  const meta=readWishlistMeta(key);
  if(value==null) delete meta[String(id)]; else meta[String(id)]=value;
  writeWishlistMeta(meta,key);
}
function ppMigrateGuestWishlistMetaToUser(user){
  if(!user?.id)return;
  const guest=readWishlistMeta(WISHLIST_META_GUEST_KEY);
  const userKey=wishlistMetaKey(user.id);
  const existing=readWishlistMeta(userKey);
  writeWishlistMeta({...guest,...existing},userKey);
  if(Object.keys(guest).length) localStorage.removeItem(WISHLIST_META_GUEST_KEY);
}

function accountWishlistCacheKey(userId){
  return `pp_wish_user_${userId}`;
}

function setSavedItems(items){
  saved.clear();
  for(const id of items||[]) if(id) saved.add(String(id));
  syncWishlist();
}

function persistCurrentWishlist(){
  const key=currentUser?accountWishlistCacheKey(currentUser.id):GUEST_WISHLIST_KEY;
  localStorage.setItem(key,JSON.stringify([...saved]));
}

function syncWishlist(){
  $$(".heart").forEach(btn=>{
    const on=saved.has(btn.dataset.id);
    btn.classList.toggle("saved",on);
    btn.setAttribute("aria-pressed",String(on));
    btn.setAttribute("aria-label",on?"Remove from wishlist":"Add to wishlist");
    btn.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.35 10.55 19.03C5.4 14.36 2 11.27 2 7.5 2 4.42 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 4.42 22 7.5c0 3.77-3.4 6.86-8.55 11.54L12 20.35Z"/></svg>`;
  });
  if($("#wishCount")) $("#wishCount").textContent=saved.size;
  $("#wishlistTop")?.classList.toggle("has-items",saved.size>0);
}

async function syncWishlistForUser(user){
  if(!user || !supabaseClient){
    setSavedItems(readWishlistKey(GUEST_WISHLIST_KEY));
    return;
  }

  const guestItems=[...readWishlistKey(GUEST_WISHLIST_KEY)];
  const cachedItems=[...readWishlistKey(accountWishlistCacheKey(user.id))];
  const {data,error}=await supabaseClient
    .from(WISHLIST_TABLE)
    .select("product_id,created_at")
    .eq("user_id",user.id);

  if(error){
    console.warn("Wishlist sync unavailable",error);
    setSavedItems(cachedItems.length?cachedItems:guestItems);
    return;
  }

  ppMigrateGuestWishlistMetaToUser(user);
  const userMetaKey=wishlistMetaKey(user.id);
  const userMeta=readWishlistMeta(userMetaKey);
  for(const row of data||[]){
    const id=String(row.product_id||"");
    if(!id)continue;
    userMeta[id]={...(userMeta[id]||{}),savedAt:userMeta[id]?.savedAt||row.created_at||new Date().toISOString()};
  }
  writeWishlistMeta(userMeta,userMetaKey);

  const merged=new Set([...(data||[]).map(row=>row.product_id),...guestItems]);
  if(guestItems.length){
    const rows=guestItems.map(product_id=>({user_id:user.id,product_id}));
    const {error:mergeError}=await supabaseClient
      .from(WISHLIST_TABLE)
      .upsert(rows,{onConflict:"user_id,product_id"});
    if(mergeError) console.warn("Guest wishlist merge failed",mergeError);
    else localStorage.removeItem(GUEST_WISHLIST_KEY);
  }

  setSavedItems(merged);
  persistCurrentWishlist();
}

function activateGuestWishlist(){
  setSavedItems(readWishlistKey(GUEST_WISHLIST_KEY));
}

async function toggleWishlistItem(btn){
  const id=btn?.dataset.id;
  if(!id) return;
  const wasSaved=saved.has(id);
  const willSave=!wasSaved;
  const previousMeta=ppWishlistMetaEntry(id);

  if(willSave){
    saved.add(id);
    ppRememberWishlistSave(id);
  }else{
    saved.delete(id);
    ppSetWishlistMetaEntry(id,null);
  }
  persistCurrentWishlist();
  syncWishlist();
  btn.classList.add("heart-pop","syncing");
  setTimeout(()=>btn.classList.remove("heart-pop"),280);

  if(currentUser && supabaseClient){
    let error=null;
    if(willSave){
      ({error}=await supabaseClient
        .from(WISHLIST_TABLE)
        .upsert({user_id:currentUser.id,product_id:id},{onConflict:"user_id,product_id"}));
    }else{
      ({error}=await supabaseClient
        .from(WISHLIST_TABLE)
        .delete()
        .eq("user_id",currentUser.id)
        .eq("product_id",id));
    }

    if(error){
      console.error("Wishlist update failed",error);
      if(wasSaved){saved.add(id);ppSetWishlistMetaEntry(id,previousMeta);}else{saved.delete(id);ppSetWishlistMetaEntry(id,null);}
      persistCurrentWishlist();
      syncWishlist();
      showToast("Wishlist could not sync. Please try again.");
      btn.classList.remove("syncing");
      return;
    }
  }

  btn.classList.remove("syncing");
  showToast(willSave?"Added to wishlist":"Removed from wishlist");
}

$$(".heart").forEach(btn=>btn.addEventListener("click",()=>{
  const id=btn?.dataset.id;
  if(!id) return;
  if(!currentUser || !profileComplete(currentProfile)){
    setPendingAuthAction({type:"wishlist-toggle",id});
    if(currentUser) renderProfileForm(currentUser.email||"",currentProfile);
    else renderAuthStart();
    return;
  }
  void toggleWishlistItem(btn);
}));
syncWishlist();
setStoreActive("all");

/* V36 discovery carousels: future-ready for more brands/stores. */
function updateCarouselProgress(grid){
  if(!grid) return;
  const progress=document.querySelector(`[data-carousel-progress="${grid.id}"]`);
  if(!progress) return;
  const maxScroll=Math.max(0,grid.scrollWidth-grid.clientWidth);
  const viewportRatio=grid.scrollWidth?Math.min(1,grid.clientWidth/grid.scrollWidth):1;
  const thumbPct=Math.max(18,viewportRatio*100);
  const travelPct=100-thumbPct;
  const ratio=maxScroll?grid.scrollLeft/maxScroll:0;
  progress.style.width=`${thumbPct}%`;
  progress.style.transform=`translateX(${ratio*travelPct/Math.max(thumbPct,1)*100}%)`;
}

$$('[data-carousel-target]').forEach(btn=>{
  const grid=document.getElementById(btn.dataset.carouselTarget||'');
  if(!grid) return;
  btn.addEventListener('click',()=>{
    const dir=Number(btn.dataset.carouselDir||1);
    const amount=Math.max(240,Math.round(grid.clientWidth*.72));
    grid.scrollBy({left:dir*amount,behavior:'smooth'});
  });
});

['brandGrid','storeGrid'].forEach(id=>{
  const grid=document.getElementById(id);
  if(!grid) return;
  const sync=()=>updateCarouselProgress(grid);
  grid.addEventListener('scroll',sync,{passive:true});
  window.addEventListener('resize',sync);
  requestAnimationFrame(sync);
});

/* Modal */
const modal=$("#modal");
const modalBody=$("#modalBody");
const modalPanel=modal?.querySelector(".modal-panel");
let ppComparisonSourceCard=null;
let ppComparisonCloseTimer=null;
function ppResetComparisonMotion(){
  if(ppComparisonCloseTimer){clearTimeout(ppComparisonCloseTimer);ppComparisonCloseTimer=null;}
  modal?.classList.remove("pp-comparison-active","pp-comparison-open","pp-comparison-closing","pp-comparison-source-left","pp-comparison-source-right");
  modalPanel?.style.removeProperty("--pp-origin-x");
  modalPanel?.style.removeProperty("--pp-origin-y");
  modalPanel?.style.removeProperty("--pp-popup-shift-x");
  modal?.style.removeProperty("--pp-content-top");
  ppComparisonSourceCard?.classList.remove("pp-comparison-source");
  ppComparisonSourceCard=null;
}
function ppGetComparisonRowCards(sourceCard){
  const allCards=$$("#dealGrid .deal-card:not([hidden])");
  if(!sourceCard||!allCards.length)return[];
  const sourceTop=Math.round(sourceCard.getBoundingClientRect().top);
  return allCards.filter(card=>Math.abs(Math.round(card.getBoundingClientRect().top)-sourceTop)<=18);
}
function ppComputeComparisonShift(panelRect,sourceCard){
  const sourceRect=sourceCard?.getBoundingClientRect?.();
  if(!sourceRect)return{shiftX:0,originX:panelRect.width/2,originY:panelRect.height/2};

  const sourceX=sourceRect.left+sourceRect.width/2;
  const sourceY=sourceRect.top+sourceRect.height/2;
  let desiredLeft=panelRect.left;

  if(window.innerWidth>=981){
    const dealGrid=document.getElementById("dealGrid");
    const shellRect=(dealGrid?.closest?.(".container")||dealGrid||document.body).getBoundingClientRect();
    const rowCards=ppGetComparisonRowCards(sourceCard);
    const index=rowCards.indexOf(sourceCard);
    const hasFourPattern=rowCards.length>=4 && index!==-1;

    if(hasFourPattern){
      const secondCardRect=rowCards[1]?.getBoundingClientRect?.();
      const thirdCardRect=rowCards[2]?.getBoundingClientRect?.();
      const innerPeek=14;
      if(index===0 && secondCardRect){
        desiredLeft=secondCardRect.left+innerPeek;
      }else if(index===1){
        desiredLeft=shellRect.right-panelRect.width;
      }else if(index===2){
        desiredLeft=shellRect.left;
      }else if(index===3 && thirdCardRect){
        desiredLeft=thirdCardRect.right-panelRect.width-innerPeek;
      }else if(index<rowCards.length/2 && secondCardRect){
        desiredLeft=secondCardRect.left+innerPeek;
      }else if(thirdCardRect){
        desiredLeft=thirdCardRect.right-panelRect.width-innerPeek;
      }

      const minLeft=shellRect.left;
      const maxLeft=shellRect.right-panelRect.width;
      if(Number.isFinite(minLeft)&&Number.isFinite(maxLeft)&&maxLeft>=minLeft){
        desiredLeft=Math.max(minLeft,Math.min(maxLeft,desiredLeft));
      }
    }else{
      const viewportCenter=window.innerWidth/2;
      const safeEdge=22;
      const sourcePeek=64;
      const maxSmartShift=190;
      const legacyShift=Math.min(72,window.innerWidth*.055);
      const roomRight=Math.max(0,window.innerWidth-safeEdge-panelRect.right);
      const roomLeft=Math.max(0,panelRect.left-safeEdge);
      let fallbackShift=0;

      if(sourceX<=viewportCenter){
        const revealNeed=Math.max(0,(sourceRect.left+sourcePeek)-panelRect.left);
        const sideBias=sourceX<window.innerWidth*.42?legacyShift:0;
        fallbackShift=Math.min(Math.max(revealNeed,sideBias),roomRight,maxSmartShift);
      }else{
        const revealNeed=Math.min(0,(sourceRect.right-sourcePeek)-panelRect.right);
        const sideBias=sourceX>window.innerWidth*.58?-legacyShift:0;
        fallbackShift=Math.max(Math.min(revealNeed,sideBias),-roomLeft,-maxSmartShift);
      }
      desiredLeft=panelRect.left+fallbackShift;
    }
  }

  const shiftX=desiredLeft-panelRect.left;
  const shiftedPanelLeft=panelRect.left+shiftX;
  const originX=Math.max(24,Math.min(panelRect.width-24,sourceX-shiftedPanelLeft));
  const originY=Math.max(24,Math.min(panelRect.height-24,sourceY-panelRect.top));
  return{shiftX,originX,originY};
}
function ppGetComparisonConnectionSide(sourceCard){
  if(!sourceCard)return null;
  const rowCards=ppGetComparisonRowCards(sourceCard);
  const index=rowCards.indexOf(sourceCard);
  if(rowCards.length>=4 && index!==-1){
    return index<=1?"left":"right";
  }
  const rect=sourceCard.getBoundingClientRect?.();
  if(!rect)return null;
  return (rect.left+rect.width/2)<=window.innerWidth/2?"left":"right";
}
function ppPrepareComparisonMotion(originEl){
  ppComparisonSourceCard=originEl?.closest?.('.deal-card')||null;
  ppComparisonSourceCard?.classList.add("pp-comparison-source");
  const connectionSide=ppGetComparisonConnectionSide(ppComparisonSourceCard);
  modal?.classList.toggle("pp-comparison-source-left",connectionSide==="left");
  modal?.classList.toggle("pp-comparison-source-right",connectionSide==="right");
  const siteHeader=document.querySelector('.site-header');
  const headerBottom=Math.max(0,Math.round(siteHeader?.getBoundingClientRect?.().bottom||0));
  modal?.style.setProperty("--pp-content-top",`${headerBottom}px`);
  modal?.classList.add("pp-comparison-active");
  if(!modalPanel||modal?.hidden)return;

  const panelRect=modalPanel.getBoundingClientRect();
  const motion=ppComputeComparisonShift(panelRect,ppComparisonSourceCard);
  modalPanel.style.setProperty("--pp-origin-x",`${motion.originX}px`);
  modalPanel.style.setProperty("--pp-origin-y",`${motion.originY}px`);
  modalPanel.style.setProperty("--pp-popup-shift-x",`${motion.shiftX}px`);
  modal?.classList.add("pp-comparison-open");
}
function openModal(html,wide=false,options={}){
  ppResetComparisonMotion();
  modalBody.innerHTML=html;
  modalPanel?.classList.toggle("modal-wide",Boolean(wide));
  const isComparison=Boolean(modalBody.querySelector(".pp-comparison"));
  modalPanel?.classList.toggle("pp-comparison-panel",isComparison);
  modalPanel?.classList.toggle("pp-wishlist-panel",Boolean(modalBody.querySelector(".wishlist-modal-head")));
  modalPanel?.classList.toggle("pp-deal-alerts-panel",Boolean(modalBody.querySelector(".pp-alerts-shell")));
  modalPanel?.classList.toggle("pp-deal-alert-editor-panel",Boolean(modalBody.querySelector(".pp-alert-editor")));
  modalPanel?.classList.toggle("pp-preferences-panel",Boolean(modalBody.querySelector(".pp-preferences-shell")));
  modalPanel?.classList.toggle("pp-support-panel",Boolean(modalBody.querySelector(".pp-support-shell")));
  modalPanel?.classList.toggle("pp-discovery-panel",Boolean(modalBody.querySelector(".pp-discovery-shell")));
  const isPlus=Boolean(modalBody.querySelector(".pp-plus-shell"));
  modalPanel?.classList.toggle("pp-subscription-panel",Boolean(modalBody.querySelector(".pp-subscription-shell,.pp-plus-shell")));
  modal?.classList.toggle("pp-plus-modal-active",isPlus);
  if(isPlus){
    const siteHeader=document.querySelector('.site-header');
    const headerBottom=Math.max(0,Math.round(siteHeader?.getBoundingClientRect?.().bottom||0));
    modal?.style.setProperty("--pp-plus-content-top",`${headerBottom}px`);
  }else{
    modal?.style.removeProperty("--pp-plus-content-top");
  }
  modal.hidden=false;
  document.body.style.overflow="hidden";
  if(isComparison)ppPrepareComparisonMotion(options.originEl||null);
}
function ppFinalizeCloseModal(){
  clearOtpResendTimer();
  modal.hidden=true;
  modalPanel?.classList.remove("modal-wide","pp-comparison-panel","pp-wishlist-panel","pp-deal-alerts-panel","pp-deal-alert-editor-panel","pp-preferences-panel","pp-support-panel","pp-discovery-panel","pp-subscription-panel");
  modal?.classList.remove("pp-plus-modal-active");
  modal?.style.removeProperty("--pp-plus-content-top");
  document.body.style.overflow="";
  ppResetComparisonMotion();
}
function closeModal(){
  if(modal?.classList.contains("pp-comparison-active")&&!modal.classList.contains("pp-comparison-closing")){
    modal.classList.remove("pp-comparison-open");
    modal.classList.add("pp-comparison-closing");
    ppComparisonCloseTimer=setTimeout(ppFinalizeCloseModal,190);
    return;
  }
  ppFinalizeCloseModal();
}
$$("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModal));
/* Close comparison popup when clicking anywhere outside the popup,
   including the site header/top area. */
document.addEventListener("click",e=>{
  if(!modal || modal.hidden || !modal.classList.contains("pp-comparison-active")) return;

  /* Anything inside the popup remains fully interactive */
  if(modalPanel?.contains(e.target)) return;

  /* Existing backdrop already has its own close handler */
  if(e.target.closest?.(".modal-backdrop")) return;

  /* Top/header outside click: close only, don't trigger underlying site action */
  e.preventDefault();
  e.stopPropagation();
  closeModal();
},true);

document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && modal && !modal.hidden) closeModal();
});

// V51: one API-ready offer model powers cards, comparison and wishlist.
// Prices stay null until an approved retailer/API/feed supplies them.
const PP_OFFICIAL_STORE_LOGOS=new Set(['Amazon','Flipkart','Myntra','AJIO']);
const RETAILER_LOGOS={Amazon:"amazon-logo.png",Flipkart:"flipkart-logo.png",Croma:"croma-wordmark.svg",Myntra:"myntra-logo.png",AJIO:"ajio-logo.png",Meesho:"meesho-wordmark.png"};
function parseMoney(value){
  if(value==null || value==="") return null;
  const n=Number(String(value).replace(/[^0-9.]/g,""));
  return Number.isFinite(n)&&n>0?n:null;
}
function retailerOffers(data){
  const raw=[
    {name:"Amazon",url:data.amazonUrl,price:parseMoney(data.amazonPrice),updatedAt:data.amazonUpdatedAt||""},
    {name:"Flipkart",url:data.flipkartUrl,price:parseMoney(data.flipkartPrice),updatedAt:data.flipkartUpdatedAt||""},
    {name:data.thirdStore,url:data.thirdUrl,price:parseMoney(data.thirdPrice),updatedAt:data.thirdUpdatedAt||""},
    {name:data.fourthStore,url:data.fourthUrl,price:parseMoney(data.fourthPrice),updatedAt:data.fourthUpdatedAt||""}
  ];
  return raw.filter(o=>o.name&&o.url);
}
// V60 logo-only correction: use the existing local Compare Across Stores fallback assets
// for Home, comparison rows and Best Price. Remote primary files can load with enormous
// embedded whitespace even when CSS dimensions are correct. Keeping the same local source
// across these three placements removes that unpredictable optical shrinkage. No store
// discovery card, retailer URL, price, button or other business logic is modified.
const RETAILER_FALLBACK_CROP={
  Amazon:"#svgView(viewBox(46,26,238,82))",
  Flipkart:"",
  Croma:"#svgView(viewBox(54,20,212,60))",
  Myntra:"#svgView(viewBox(12,2,280,87))",
  AJIO:"#svgView(viewBox(60,17,180,61))"
};
function ppCatalogStoreByName(name){
  const needle=String(name||'').trim().toLowerCase();
  if(!needle)return null;
  const slugNeedle=needle.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return Object.values(window.PRICEPULSE_CATALOG_STORES||{}).find(store=>{
    const label=String(store?.name||'').trim().toLowerCase();
    const slug=String(store?.slug||'').trim().toLowerCase();
    return label===needle||slug===needle||slug===slugNeedle;
  })||null;
}
function ppSmallRetailerLogoSources(name){
  const file=RETAILER_LOGOS[name];
  const fallback=file?`logos/${file}${name==="Flipkart"?"?v=63":RETAILER_FALLBACK_CROP[name]||""}`:"";
  const store=ppCatalogStoreByName(name);
  const adminLogo=PP_OFFICIAL_STORE_LOGOS.has(name)?'':String(store?.logo_url||'').trim();
  const primary=adminLogo?ppNormalizeRowLogoUrl(name,adminLogo):fallback;
  return {primary,fallback};
}
function retailerLogo(name){
  const {primary,fallback}=ppSmallRetailerLogoSources(name);
  if(!primary) return `<span class="pp-retailer-name" data-pp-store-text="${escapeHTML(name)}">${escapeHTML(name)}</span>`;
  return `<img src="${escapeHTML(primary)}" alt="${escapeHTML(name)} logo" data-pp-small-store="${escapeHTML(name)}" data-fallback="${escapeHTML(fallback)}" onerror="if(this.dataset.fallback&&this.src!==this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback='';}else{this.hidden=true;}">`;
}
function ppRefreshSmallRetailerLogos(){
  document.querySelectorAll('img[data-pp-small-store]').forEach(img=>{
    const name=String(img.dataset.ppSmallStore||'');
    const {primary,fallback}=ppSmallRetailerLogoSources(name);
    if(!primary)return;
    img.dataset.fallback=fallback||'';
    if(img.getAttribute('src')!==primary){
      img.hidden=false;
      img.setAttribute('src',primary);
    }
  });
}

function ppPopupRetailerLogo(offer){
  const name=String(offer?.name||'Store');
  const file=RETAILER_LOGOS[name];
  const fallback=file?`logos/${file}${name==="Flipkart"?"?v=63":RETAILER_FALLBACK_CROP[name]||""}`:"";
  const primary=String((PP_OFFICIAL_STORE_LOGOS.has(name)?'':offer?.logoUrl)||fallback||'');
  if(!primary)return `<span class="pp-v787-logo-text">${escapeHTML(name)}</span>`;
  return `<span class="pp-v787-logo-wrap"><img src="${escapeHTML(primary)}" alt="${escapeHTML(name)} logo" data-fallback="${escapeHTML(fallback)}" onerror="if(this.dataset.fallback&&this.src!==this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback='';}else{this.hidden=true;this.nextElementSibling.hidden=false;}"><span class="pp-v787-logo-text" hidden>${escapeHTML(name)}</span></span>`;
}

// V78.7.9.4: upper comparison rows keep the Admin Panel logo_url as their
// primary source, but apply the same SVG viewBox crop normalization that made
// the V78.5 Central Logo Management rows look optically correct. Best Price
// continues to use ppPopupRetailerLogo() unchanged.
function ppNormalizeRowLogoUrl(name,url){
  let src=String(url||'');
  if(!src)return src;
  // Do not touch bitmap uploads. SVG viewBox fragments are safe and preserve
  // the exact Admin-saved asset while removing built-in transparent canvas.
  if(!/\.svg(?:[?#]|$)/i.test(src))return src;
  // Remove an existing svgView fragment before applying our canonical crop.
  src=src.replace(/#svgView\([^)]*\)$/i,'');
  const crop=RETAILER_FALLBACK_CROP[name]||'';
  if(name==='Flipkart'){
    if(!/[?&]v=63(?:&|$)/.test(src))src+=src.includes('?')?'&v=63':'?v=63';
    return src;
  }
  if(crop && !src.includes('#svgView('))src+=crop;
  return src;
}
function ppPopupRetailerRowLogo(offer){
  const name=String(offer?.name||'Store');
  const file=RETAILER_LOGOS[name];
  const fallbackRaw=file?`logos/${file}${name==="Flipkart"?"?v=63":RETAILER_FALLBACK_CROP[name]||""}`:'';
  const primaryRaw=String((PP_OFFICIAL_STORE_LOGOS.has(name)?'':offer?.logoUrl)||fallbackRaw||'');
  const primary=ppNormalizeRowLogoUrl(name,primaryRaw);
  const fallback=ppNormalizeRowLogoUrl(name,fallbackRaw);
  if(!primary)return `<span class="pp-v787-logo-text">${escapeHTML(name)}</span>`;
  return `<span class="pp-v787-logo-wrap"><img src="${escapeHTML(primary)}" alt="${escapeHTML(name)} logo" data-fallback="${escapeHTML(fallback)}" onerror="if(this.dataset.fallback&&this.src!==this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback='';}else{this.hidden=true;this.nextElementSibling.hidden=false;}"><span class="pp-v787-logo-text" hidden>${escapeHTML(name)}</span></span>`;
}
function ppPopupBrandLogo(primary,fallback,name){
  const src=String(primary||fallback||'');
  if(!src)return '';
  const fb=String(fallback||'');
  return `<img class="pp-v78-product-brand pp-global-brand-logo" src="${escapeHTML(src)}" alt="${escapeHTML(name||'Brand')} logo" data-fallback="${escapeHTML(fb)}" onerror="if(this.dataset.fallback&&this.src!==this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback='';}else{this.hidden=true;}">`;
}
function ppSafeStoreClass(name){return String(name||'store').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'store'}
function ppFormatCount(n){return new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(Number(n)||0)}
function ppOfferSavings(offer){
  const price=Number(offer?.price),mrp=Number(offer?.mrp);
  if(!Number.isFinite(price)||!Number.isFinite(mrp)||price<=0||mrp<=price)return null;
  const saving=mrp-price;
  const percent=Math.max(1,Math.round((saving/mrp)*100));
  return {mrp,saving,percent};
}

function ppRetailerStripState(data,productId=""){
  const offers=retailerOffers(data).map((offer,i)=>({...offer,...(productId?(ppVerifiedOffer(productId,offer.name)||{}):{}),originalOrder:i}));
  const inStock=offers.filter(o=>o.price!=null&&o.availability==="in_stock");
  if(inStock.length<2)return {offers,ordered:offers,inStock,lowest:null,bestOffers:[],uniqueLowest:null,isTie:false,allSame:false};
  const lowest=Math.min(...inStock.map(o=>o.price));
  const bestOffers=inStock.filter(o=>o.price===lowest);
  const allSame=inStock.every(o=>o.price===lowest);
  const uniqueLowest=bestOffers.length===1?bestOffers[0]:null;
  const isTie=bestOffers.length>1&&!allSame;
  const priority=new Set((uniqueLowest?[uniqueLowest]:isTie?bestOffers:[]).map(o=>o.name));
  const ordered=[...offers].sort((a,b)=>{
    const ap=priority.has(a.name)?0:1,bp=priority.has(b.name)?0:1;
    if(ap!==bp)return ap-bp;
    return a.originalOrder-b.originalOrder;
  });
  return {offers,ordered,inStock,lowest,bestOffers,uniqueLowest,isTie,allSame};
}
function retailerStrip(data,productId=""){
  const state=ppRetailerStripState(data,productId);
  const tieNames=new Set(state.isTie?state.bestOffers.map(o=>o.name):[]);
  const visible=state.ordered.slice(0,3).map(o=>{
    const isLowest=Boolean(state.uniqueLowest&&o.name===state.uniqueLowest.name);
    const isTied=tieNames.has(o.name);
    const cls=isLowest?' is-lowest':isTied?' is-tied':'';
    const status=isLowest?'<em class="pp-retailer-status">Lowest</em>':isTied?'<em class="pp-retailer-status">Tie</em>':'';
    return `<span class="pp-retailer-chip${cls}" data-retailer="${escapeHTML(o.name)}">${retailerLogo(o.name)}${status}</span>`;
  }).join("");
  return `<div class="pp-retailers" aria-label="Available retailers">${visible}${state.offers.length>3?`<small>+${state.offers.length-3} More</small>`:""}</div>`;
}
function ppCardRatingHTML(offer){
  if(!offer||(offer.rating==null&&offer.reviewCount==null))return '';
  const rating=offer.rating!=null?`<span class="pp-card-rating-score"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2.8l2.72 5.51 6.08.88-4.4 4.29 1.04 6.06L12 16.68l-5.44 2.86 1.04-6.06-4.4-4.29 6.08-.88L12 2.8z"/></svg>${escapeHTML(String(offer.rating))}</span>`:'';
  const reviews=offer.reviewCount!=null?`<span>${escapeHTML(ppFormatCount(offer.reviewCount))} reviews</span>`:'';
  return `<div class="pp-card-rating" aria-label="Product rating and reviews">${rating}${rating&&reviews?'<i aria-hidden="true">•</i>':''}${reviews}</div>`;
}
function ppCardCtaHTML(storeCount){
  const count=Math.max(0,Number(storeCount)||0);
  return `<svg class="pp-card-cta-bars" aria-hidden="true" viewBox="0 0 30 30"><rect x="2" y="17" width="6" height="11" rx="2" fill="currentColor"/><rect x="12" y="10" width="6" height="18" rx="2" fill="currentColor"/><rect x="22" y="2" width="6" height="26" rx="2" fill="currentColor"/></svg><span class="pp-card-cta-copy"><span class="pp-card-cta-title"><strong>Find Best Price</strong><span class="pp-card-cta-arrow" aria-hidden="true">→</span></span><small>Compare across ${count} ${count===1?'store':'stores'}</small></span>`;
}
function ppCardTitleCase(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  const mapped={home:'Home & Kitchen',mobiles:'Mobiles',laptops:'Laptops',electronics:'Electronics',appliances:'Appliances',fashion:'Fashion',beauty:'Beauty',watches:'Watches'}[raw.toLowerCase()];
  return mapped||raw.replace(/\b\w/g,m=>m.toUpperCase());
}
function ppCardIdentityValues(card,productId,data){
  const catalog=ppCatalogProduct(productId);
  const brand=ppCatalogBrandForProduct(catalog);
  const state=ppRetailerStripState(data,productId);
  const safeOffer=state.inStock.find(o=>o.matchStatus==='match'&&o.detailsReviewed===true&&(String(o.capturedModel||'').trim()||String(o.capturedVariant||'').trim()))||null;
  const staticBrand=String(card?.querySelector('.product-brand-logo')?.alt||'').replace(/\s+logo$/i,'').trim();
  const category=ppCardTitleCase(catalog?.category||card?.dataset.category||'');
  const brandName=String(brand?.name||staticBrand||catalog?.brand_slug||card?.dataset.brand||'').trim();
  const model=String(catalog?.model_code||safeOffer?.capturedModel||'').trim();
  const variant=String(catalog?.variant||safeOffer?.capturedVariant||'').trim();
  return {category,brandName,model,variant};
}
function ppUpdateHomeCardIdentity(card,productId,data){
  const title=card?.querySelector('h3');
  const rating=card?.querySelector('.pp-card-rating');
  const storeCount=card?.querySelector('.store-count');
  if(!title||!storeCount)return;
  const catalog=ppCatalogProduct(productId);
  const values=ppCardIdentityValues(card,productId,data);
  // Admin canonical text edits are live catalog data. Keep the static HTML only as fallback.
  const liveName=String(catalog?.name||'').trim();
  if(liveName)title.textContent=liveName;
  if(typeof ppRefreshHomeTitleOverflow==='function')ppRefreshHomeTitleOverflow(card);
  if(catalog?.category)card.dataset.category=String(catalog.category).trim().toLowerCase();
  if(values.brandName)card.dataset.brandName=values.brandName;
  let meta=card.querySelector('.pp-card-meta');
  const metaValues=[values.category,values.brandName,values.model].filter((v,i,a)=>v&&a.indexOf(v)===i);
  if(metaValues.length){
    if(!meta){meta=document.createElement('div');meta.className='pp-card-meta';(rating||title).insertAdjacentElement('afterend',meta);}
    meta.innerHTML=metaValues.map(v=>`<span>${escapeHTML(v)}</span>`).join('');
    meta.hidden=false;
  }else if(meta){meta.hidden=true;}
  let variant=card.querySelector('.pp-card-variant');
  if(values.variant){
    if(!variant){variant=document.createElement('div');variant.className='pp-card-variant';(meta&&!meta.hidden?meta:(rating||title)).insertAdjacentElement('afterend',variant);}
    variant.textContent=values.variant;variant.hidden=false;
  }else if(variant){variant.hidden=true;}
}
function ppHomeGalleryItems(card,productId){
  const catalog=ppCatalogProduct(productId);
  const img=card?.querySelector('.product-photo');
  const fallback=img?.dataset.ppFallbackSrc||img?.getAttribute('src')||'';
  return ppResolvedProductGallery(catalog,productId,fallback);
}
function ppUpdateHomeCardGallery(card,productId){
  const main=card?.querySelector('.product-photo');
  if(!main)return;
  const rail=card.querySelector('.pp-card-gallery');
  if(rail)rail.remove();
  if(!main.dataset.ppFallbackSrc)main.dataset.ppFallbackSrc=main.getAttribute('src')||'';
  const primary=ppGlobalPrimaryImageItem(productId,main.dataset.ppFallbackSrc);
  if(!primary?.url)return;
  main.onerror=()=>{const fb=main.dataset.ppFallbackSrc;if(fb&&main.getAttribute('src')!==fb){main.onerror=null;main.src=fb;}};
  main.src=primary.url;
  ppApplyGlobalImageToElement(main,primary);
}
function ppUpdateHomeMediaDiscount(card,offer){
  const media=card?.querySelector('.product-media');if(!media)return;
  let badge=media.querySelector('.pp-card-media-discount');
  const savings=offer?ppOfferSavings(offer):null;
  if(!savings){if(badge)badge.remove();return;}
  if(!badge){badge=document.createElement('span');badge.className='pp-card-media-discount';media.appendChild(badge);}
  badge.textContent=`${savings.percent}% OFF`;
}
function money(n){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n)}
// V52: Comparison-only presentation and authorized-price adapter.
// Later an approved backend or a permission-checked static feed can populate
// window.PRICEPULSE_APPROVED_PRICES; no credentials or unverified prices in the page.
const PP_PRODUCT_GALLERIES={
  "oneplus-nord6":["images/products/oneplus-nord-6.svg"],
  "samsung-buds-core":["images/products/samsung-buds-core-white.svg"],
  "boat-storm-call3":["images/products/boat-storm-call-3.svg"]
};

function ppClampSiteImageNumber(value,min,max,fallback=0){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
function ppNormalizeSiteImageSlot(slot={}){
  return {
    url:String(slot?.url||'').trim(),
    bg:['soft','white','transparent','original'].includes(slot?.bg)?slot.bg:'soft',
    fit:['contain','cover'].includes(slot?.fit)?slot.fit:'contain',
    position:['center','top','bottom','left','right'].includes(slot?.position)?slot.position:'center',
    scale:String(ppClampSiteImageNumber(slot?.scale,70,260,100)),
    rotate:String(ppClampSiteImageNumber(slot?.rotate,-30,30,0)),
    x:String(ppClampSiteImageNumber(slot?.x,-30,30,0)),
    y:String(ppClampSiteImageNumber(slot?.y,-30,30,0))
  };
}
function ppSiteImageConfig(product){
  const raw=product?.metadata?.site_images||{};
  return {mode:raw.mode==='curated'?'curated':'auto',primary:ppNormalizeSiteImageSlot(raw.primary),secondary:ppNormalizeSiteImageSlot(raw.secondary)};
}
function ppImagePositionCSS(position){return ({center:'center center',top:'center top',bottom:'center bottom',left:'left center',right:'right center'})[position]||'center center';}
function ppImageTransformCSS(item={}){const c=ppNormalizeSiteImageSlot(item);return `translate(${Number(c.x)}%, ${Number(c.y)}%) rotate(${Number(c.rotate)}deg) scale(${Number(c.scale)/100})`; }

function ppImageSafePercent(item={}){
  const c=ppNormalizeSiteImageSlot(item);
  const rad=Math.abs(Number(c.rotate))*Math.PI/180;
  const rotation=Math.abs(Math.cos(rad))+Math.abs(Math.sin(rad));
  const scale=Math.max(.7,Number(c.scale)/100||1);
  const movePenalty=Math.min(22,(Math.abs(Number(c.x))+Math.abs(Number(c.y)))*.28);
  return Math.max(42,Math.min(92,(92-movePenalty)/(scale*Math.max(1,rotation))));
}
function ppGlobalImageStyle(item={}){
  const c=ppNormalizeSiteImageSlot(item);
  return `--pp-img-fit:${c.fit};--pp-img-position:${ppImagePositionCSS(c.position)};--pp-img-transform:none;--pp-img-safe:92%;`;
}
function ppGlobalImageDataAttrs(item={}){
  const c=ppNormalizeSiteImageSlot(item);
  return `data-pp-img-bg="${escapeHTML(c.bg)}" data-pp-img-fit="${escapeHTML(c.fit)}" data-pp-img-position="${escapeHTML(c.position)}" data-pp-img-scale="${escapeHTML(c.scale)}" data-pp-img-rotate="${escapeHTML(c.rotate)}" data-pp-img-x="${escapeHTML(c.x)}" data-pp-img-y="${escapeHTML(c.y)}"`;
}
function ppGlobalImageBgClass(item={}){return `pp-img-bg-${ppNormalizeSiteImageSlot(item).bg}`;}
function ppReadGlobalImageData(img){
  if(!img)return ppNormalizeSiteImageSlot({});
  return ppNormalizeSiteImageSlot({url:img.currentSrc||img.src||'',bg:img.dataset.ppImgBg,fit:img.dataset.ppImgFit,position:img.dataset.ppImgPosition,scale:img.dataset.ppImgScale,rotate:img.dataset.ppImgRotate,x:img.dataset.ppImgX,y:img.dataset.ppImgY});
}
function ppStoreGlobalImageData(img,item){
  const c=ppNormalizeSiteImageSlot(item);
  img.dataset.ppImgBg=c.bg;img.dataset.ppImgFit=c.fit;img.dataset.ppImgPosition=c.position;img.dataset.ppImgScale=c.scale;img.dataset.ppImgRotate=c.rotate;img.dataset.ppImgX=c.x;img.dataset.ppImgY=c.y;
}
function ppFitGlobalImageInHost(img,item){
  if(!img||!item?.url)return;const host=img.parentElement;if(!host)return;
  const run=()=>{
    const nw=Number(img.naturalWidth)||0,nh=Number(img.naturalHeight)||0;if(!nw||!nh)return;
    if(!host.clientWidth||!host.clientHeight){img.dataset.ppFitPending='1';return;}/* hidden right now (another page is open): fit again when shown */
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
    const isHero=host.matches('.pp-v78-product-visual,.pp-v787-product-visual');
    const isCompact=host.matches('.pp-v78-gallery-thumb,.pp-v52-gallery-thumb,.pp-da-product-image,.pp-wap-product-image,.pp-dae-product>div,.pp-wish-product-media,.product-media-real');
    const gutter=isCompact?.90:.96;
    const allowManualOverflow=isHero||fitMode==='cover';
    const applied=allowManualOverflow
      ? Math.max(.2,desired)
      : Math.max(.2,Math.min(desired,(availW*gutter)/(rotW+2*xRate*baseW),(availH*gutter)/(rotH+2*yRate*baseH)));
    const freeX=Math.max(0,(availW-rotW*applied)/2),freeY=Math.max(0,(availH-rotH*applied)/2);
    const preset=String(c.position||'center');
    const presetX=preset==='left'?(allowManualOverflow?-availW*.12:-freeX):preset==='right'?(allowManualOverflow?availW*.12:freeX):0;
    const presetY=preset==='top'?(allowManualOverflow?-availH*.12:-freeY):preset==='bottom'?(allowManualOverflow?availH*.12:freeY):0;
    const rawX=(Number(c.x)||0)/100*(allowManualOverflow?availW:baseW*applied),rawY=(Number(c.y)||0)/100*(allowManualOverflow?availH:baseH*applied);
    const tx=allowManualOverflow?(presetX+rawX):Math.max(-freeX,Math.min(freeX,presetX+rawX));
    const ty=allowManualOverflow?(presetY+rawY):Math.max(-freeY,Math.min(freeY,presetY+rawY));
    img.style.setProperty('width',`${baseW.toFixed(2)}px`,'important');
    img.style.setProperty('height',`${baseH.toFixed(2)}px`,'important');
    img.style.setProperty('max-width','none','important');img.style.setProperty('max-height','none','important');
    img.style.setProperty('object-fit',fitMode,'important');img.style.setProperty('object-position',ppImagePositionCSS(c.position||'center'),'important');
    img.style.setProperty('transform',`translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${Number(c.rotate)||0}deg) scale(${applied.toFixed(4)})`,'important');
    img.style.setProperty('transform-origin','center center','important');
    img.dataset.ppGlobalFitted='1';
  };
  if(img.complete&&img.naturalWidth)requestAnimationFrame(run);else img.addEventListener('load',()=>requestAnimationFrame(run),{once:true});
}
function ppHydrateGlobalProductImages(root=document){
  const list=[];if(root?.matches?.('img.pp-global-product-image'))list.push(root);root?.querySelectorAll?.('img.pp-global-product-image').forEach(x=>list.push(x));
  for(const img of list){const item=ppReadGlobalImageData(img);if(item.url)ppFitGlobalImageInHost(img,item);}
}
function ppGlobalPrimaryImageItem(productId,fallbackImage=''){
  const catalog=ppCatalogProduct(productId);
  const cfg=ppSiteImageConfig(catalog);
  if(cfg.mode==='curated'&&cfg.primary.url)return cfg.primary;
  return ppImageItem(catalog?.live_image_url||catalog?.image_url||fallbackImage,{bg:'soft',fit:'contain',position:'center',scale:'100',rotate:'0',x:'0',y:'0'});
}
function ppApplyGlobalImageToElement(img,item){
  if(!img||!item?.url)return;
  img.classList.add('pp-global-product-image');ppStoreGlobalImageData(img,item);
  img.style.setProperty('--pp-img-fit',item.fit||'contain');img.style.setProperty('--pp-img-position',ppImagePositionCSS(item.position||'center'));img.style.setProperty('--pp-img-transform','none');img.style.setProperty('--pp-img-safe','92%');
  const host=img.parentElement;
  if(host){host.classList.remove('pp-img-bg-soft','pp-img-bg-white','pp-img-bg-transparent','pp-img-bg-original');host.classList.add(ppGlobalImageBgClass(item),'pp-global-product-surface');}
  ppFitGlobalImageInHost(img,item);
}
function ppBrandLogoSources(productId,fallback=''){
  const product=ppCatalogProduct(productId);
  const brand=ppCatalogBrandForProduct(product);
  const primary=String(brand?.logo_url||'').trim();
  return {primary:primary||String(fallback||''),fallback:String(fallback||''),name:String(brand?.name||product?.brand_slug||'Brand')};
}
function ppRefreshGlobalBrandLogos(){
  document.querySelectorAll('.deal-card').forEach(card=>{
    const productId=card.querySelector('.heart')?.dataset.id||'';const img=card.querySelector('.product-brand-logo');if(!img||!productId)return;
    if(!img.dataset.ppBrandFallback)img.dataset.ppBrandFallback=img.getAttribute('src')||'';if(!ppCatalogProduct(productId))return;const src=ppBrandLogoSources(productId,img.dataset.ppBrandFallback);if(!src.primary)return;
    img.hidden=false;img.dataset.fallback=src.fallback||'';img.onerror=()=>{const fb=img.dataset.fallback;if(fb&&img.getAttribute('src')!==fb){img.onerror=null;img.src=fb;}else{img.hidden=true;}};img.src=src.primary;img.alt=`${src.name} logo`;img.classList.add('pp-global-brand-logo');
  });
  document.querySelectorAll('.brand-card[data-brand]').forEach(card=>{
    const slug=String(card.dataset.brand||''),brand=window.PRICEPULSE_CATALOG_BRANDS?.[slug],img=card.querySelector('.brand-logo-panel img');if(!brand||!img)return;
    if(!img.dataset.ppBrandFallback)img.dataset.ppBrandFallback=img.getAttribute('src')||'';const central=String(brand.logo_url||'').trim();if(!central)return;
    img.hidden=false;img.dataset.fallback=img.dataset.ppBrandFallback||'';img.onerror=()=>{const fb=img.dataset.fallback;if(fb&&img.getAttribute('src')!==fb){img.onerror=null;img.src=fb;}else{img.hidden=true;}};img.src=central;img.alt=`${brand.name||card.dataset.label||slug} logo`;img.classList.add('pp-global-brand-logo');
  });
}
function ppRefreshGlobalProductImages(){
  document.querySelectorAll('.deal-card').forEach(card=>{
    const productId=card.querySelector('.heart')?.dataset.id||'';
    const img=card.querySelector('.product-photo');
    if(!img||!productId)return;
    if(!img.dataset.ppFallbackSrc)img.dataset.ppFallbackSrc=img.getAttribute('src')||'';
    const item=ppGlobalPrimaryImageItem(productId,img.dataset.ppFallbackSrc);
    if(!item?.url)return;
    img.onerror=()=>{const fb=img.dataset.ppFallbackSrc;if(fb&&img.getAttribute('src')!==fb){img.onerror=null;img.src=fb;}};
    img.src=item.url;
    ppApplyGlobalImageToElement(img,item);
  });
}
function ppImageItem(url,settings={}){
  const clean=ppNormalizeSiteImageSlot({...settings,url});
  return clean.url?clean:null;
}
function ppResolvedProductGallery(catalog,productId,fallbackImage=''){
  const cfg=ppSiteImageConfig(catalog);
  const out=[];
  const push=item=>{if(!item?.url||out.some(x=>x.url===item.url))return;out.push(item);};
  if(cfg.mode==='curated'){
    if(cfg.primary.url)push(ppImageItem(cfg.primary.url,cfg.primary));
    else push(ppImageItem(catalog?.live_image_url||catalog?.image_url||fallbackImage,{bg:'white',fit:'contain',position:'center',scale:'100'}));
    push(ppImageItem(cfg.secondary.url,cfg.secondary));
    return out.slice(0,2);
  }
  push(ppImageItem(catalog?.live_image_url||catalog?.image_url||fallbackImage,{bg:'white',fit:'contain',position:'center',scale:'100'}));
  for(const url of PP_PRODUCT_GALLERIES[productId]||[])push(ppImageItem(url,{bg:'white',fit:'contain',position:'center',scale:'100'}));
  return out;
}
function ppMainSiteImageUrl(row){
  const cfg=ppSiteImageConfig(row);
  if(cfg.mode==='curated'&&cfg.primary.url)return cfg.primary.url;
  return String(row?.live_image_url||row?.image_url||'');
}
// Product facts below come only from product names/model references already
// present in the supplied V51 site; never invent RAM, ratings or shipping.
const PP_SOURCE_FACTS={
  "headphones":["Rockerz Plus 450 ANC","Model PA0056"],
  "airfryer":["Model NA120/00","4.2 L capacity"],
  "oneplus-nord6":["Model Nord 6"],
  "samsung-buds-core":["Buds Core · White variant"],
  "dell15":["Dell 15 · Model DC15250"],
  "puma-smashic":["Smashic Comfort Sneakers"],
  "nutripro-500w":["500 W juicer mixer"],
  "dotkey-sunscreen":["Vitamin C + E sunscreen"],
  "dotkey-barrier-50g":["Ceramides & Hyaluronic Barrier Repair Moisturizer · 50 g"],
  "boat-storm-call3":["Storm Call 3 smartwatch"]
};
// V76.7: keep discovery filters/search metadata derived from the same retailer mappings
// that power Compare Offers. This prevents future store-count/filter drift when a link
// is added or removed from a product card. Existing affiliate URLs remain untouched.
function ppSyncCatalogMappings(){
  cards.forEach(card=>{
    const btn=card.querySelector('.compare-btn');
    if(!btn)return;
    const productId=card.querySelector('.heart')?.dataset.id||'';
    const offers=retailerOffers(btn.dataset);
    const mappedStores=[...new Set(offers.map(o=>String(o.name||'').trim().toLowerCase()).filter(Boolean))];
    if(mappedStores.length)card.dataset.stores=mappedStores.join(' ');
    const facts=PP_SOURCE_FACTS[productId]||[];
    const raw=[card.dataset.search||'',btn.dataset.product||'',card.dataset.brand||'',card.dataset.category||'',...mappedStores,...offers.map(o=>o.name||''),...facts].join(' ').toLowerCase();
    card.dataset.search=[...new Set(raw.split(/\s+/).filter(Boolean))].join(' ');
  });
}
ppSyncCatalogMappings();

const PP_APPROVED_SOURCES=new Set(["authorized-retailer-api","authorized-affiliate-feed","approved-manual-check","user-manual-check","amazon-creators-api","amazon-pa-api","amazon-approved-feed"]);
const PP_AUTOMATED_SOURCES=new Set(["authorized-retailer-api","authorized-affiliate-feed","amazon-creators-api","amazon-pa-api","amazon-approved-feed"]);
const PP_AMAZON_SOURCES=new Set(["amazon-creators-api","amazon-pa-api","amazon-approved-feed"]);
function ppVerifiedOffer(productId,store){
  const byProduct=window.PRICEPULSE_APPROVED_PRICES?.[productId];
  const item=byProduct && byProduct[store];
  if(!item || !PP_APPROVED_SOURCES.has(item.source))return null;
  if(item.source==="approved-manual-check" && item.displayPermitted!==true)return null;
  const amount=typeof item.price==="number"?item.price:NaN;
  const stamp=Date.parse(item.checkedAt||"");
  if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(stamp))return null;
  if(stamp>Date.now()+600000)return null; // reject accidental future timestamps
  // Suppress potentially misleading old prices; reconnect or recheck data to restore.
  const maxAgeMs=(["approved-manual-check","user-manual-check"].includes(item.source)?24:48)*60*60*1000;
  if(Date.now()-stamp>maxAgeMs)return null;
  return {price:amount,checkedAt:item.checkedAt,source:item.source,
    availability:["in_stock","out_of_stock"].includes(item.availability)?item.availability:null,
    freeDelivery:item.deliveryVerified===true && item.delivery==="free",
    mrp:Number.isFinite(Number(item.mrp))&&Number(item.mrp)>0?Number(item.mrp):null,
    rating:Number.isFinite(Number(item.rating))&&Number(item.rating)>0&&Number(item.rating)<=5?Number(item.rating):null,
    reviewCount:Number.isFinite(Number(item.reviewCount))&&Number(item.reviewCount)>0?Number(item.reviewCount):null,
    deliveryText:String(item.deliveryText||'').trim(),offerText:String(item.offerText||'').trim(),
    matchStatus:String(item.matchStatus||''),detailsReviewed:item.detailsReviewed===true,
    capturedTitle:String(item.capturedTitle||'').trim(),capturedModel:String(item.capturedModel||'').trim(),capturedVariant:String(item.capturedVariant||'').trim(),
    listingUrl:String(item.listingUrl||'').trim()
  };
}
// V70 FINAL: preload fresh verified prices and recent verified history once.
// Current pricing stays source-agnostic: today it uses manual verification; authorized
// retailer APIs/affiliate feeds can write the same verified model later without a UI rewrite.
let ppLivePricesReady=false;
let ppLivePricesPromise=null;
let ppCatalogImagesReady=false;
let ppCatalogImagesPromise=null;
window.PRICEPULSE_CATALOG_IMAGES=window.PRICEPULSE_CATALOG_IMAGES||{};

window.PRICEPULSE_CATALOG_PRODUCTS=window.PRICEPULSE_CATALOG_PRODUCTS||{};
window.PRICEPULSE_CATALOG_BRANDS=window.PRICEPULSE_CATALOG_BRANDS||{};
window.PRICEPULSE_CATALOG_STORES=window.PRICEPULSE_CATALOG_STORES||{};
window.PRICEPULSE_CATALOG_LISTINGS=window.PRICEPULSE_CATALOG_LISTINGS||{};
let ppCatalogDataReady=false;
let ppCatalogDataPromise=null;
function ppBrandText(value){return String(value||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function ppCatalogBrandMatchScore(product,brand){
  const hay=` ${ppBrandText([product?.name,product?.identity_key,product?.model_code].filter(Boolean).join(' '))} `;
  if(!hay.trim())return 0;
  const probes=[brand?.name,brand?.slug,...(Array.isArray(brand?.aliases)?brand.aliases:[])].map(ppBrandText).filter(x=>x.length>=2);
  let best=0;
  for(const probe of probes){
    const padded=` ${probe} `;
    if(hay.startsWith(padded))best=Math.max(best,1000+probe.length);
    else if(hay.includes(padded))best=Math.max(best,500+probe.length);
  }
  return best;
}
function ppResolveCatalogBrandSlug(product,brandMap=window.PRICEPULSE_CATALOG_BRANDS||{}){
  const current=String(product?.brand_slug||'').trim();
  const currentBrand=brandMap[current]||null;
  const currentScore=currentBrand?ppCatalogBrandMatchScore(product,currentBrand):0;
  let bestSlug=currentBrand?current:'',bestScore=currentScore;
  for(const [slug,brand] of Object.entries(brandMap||{})){
    const score=ppCatalogBrandMatchScore(product,brand);
    if(score>bestScore){bestScore=score;bestSlug=slug;}
  }
  // Only override a valid saved brand when another brand is strongly present in
  // the product identity/name and the saved brand itself is not.
  if(currentBrand&&currentScore>=500)return current;
  return bestScore>=500?bestSlug:(currentBrand?current:'');
}
function ppApplyCatalogData({products=[],brands=[],stores=[],listings=[]}={}){
  const brandMap={},storeMap={},productMap={},listingMap={};
  for(const b of brands||[]){if(b?.slug)brandMap[String(b.slug)]={...b};}
  for(const s of stores||[]){if(s?.slug)storeMap[String(s.slug)]={...s};}
  for(const p of products||[]){
    if(!p?.product_id)continue;
    const resolvedBrand=ppResolveCatalogBrandSlug(p,brandMap);
    productMap[String(p.product_id)]={...p,brand_slug:resolvedBrand||String(p.brand_slug||'')};
  }
  for(const l of listings||[]){
    const pid=String(l?.product_id||'');if(!pid||l?.active===false)continue;
    if(!['active','out_of_stock'].includes(String(l?.listing_status||'active')))continue;
    listingMap[pid]=listingMap[pid]||[];
    listingMap[pid].push({...l,store:storeMap[String(l.store_slug||'')]||null});
  }
  window.PRICEPULSE_CATALOG_BRANDS=brandMap;
  window.PRICEPULSE_CATALOG_STORES=storeMap;
  window.PRICEPULSE_CATALOG_PRODUCTS=productMap;
  window.PRICEPULSE_CATALOG_LISTINGS=listingMap;
  ppRefreshSmallRetailerLogos();
  ppRefreshGlobalBrandLogos();
  ppRefreshGlobalProductImages();
  cards.forEach(card=>{
    const btn=card.querySelector('.compare-btn');
    const productId=card.querySelector('.heart')?.dataset.id||'';
    if(btn&&productId){ppUpdateHomeCardIdentity(card,productId,btn.dataset);ppUpdateHomeCardGallery(card,productId);}
  });
}
async function ppPreloadCatalogData(force=false){
  if(window.PP_PRICE_PILOT_ENABLED!==true||!supabaseClient)return;
  if(ppCatalogDataPromise&&!force)return ppCatalogDataPromise;
  ppCatalogDataPromise=(async()=>{
    try{
      const [productsRes,brandsRes,storesRes,listingsRes]=await Promise.all([
        supabaseClient.from('pp_catalog_products').select('product_id,name,brand_slug,category,identity_key,model_code,variant,image_url,live_image_url,live_image_store,live_image_verified_at,live_image_source,metadata,status').in('status',['active','tracking']),
        supabaseClient.from('pp_catalog_brands').select('slug,name,logo_url,website_url,aliases,active').eq('active',true),
        supabaseClient.from('pp_catalog_stores').select('slug,name,domain,logo_url,active').eq('active',true),
        supabaseClient.from('pp_product_store_listings').select('product_id,store_slug,affiliate_url,direct_url,listing_status,match_status,active').eq('active',true)
      ]);
      const errs=[productsRes.error,brandsRes.error,storesRes.error,listingsRes.error].filter(Boolean);
      if(errs.length){
        const first=errs[0];
        if(!['42P01','42703','PGRST204'].includes(first?.code))console.warn('PricePulse: catalog data unavailable',first?.code||first?.message);
        return;
      }
      ppApplyCatalogData({products:productsRes.data,brands:brandsRes.data,stores:storesRes.data,listings:listingsRes.data});
      ppCatalogDataReady=true;
      ppRerenderOpenComparison();
    }catch(e){console.warn('PricePulse: catalog data unavailable',e?.message);}
    finally{ppCatalogDataPromise=null;}
  })();
  return ppCatalogDataPromise;
}
function ppCatalogProduct(productId){return window.PRICEPULSE_CATALOG_PRODUCTS?.[String(productId)]||null;}
function ppCatalogBrandForProduct(product){
  if(!product)return null;
  const slug=ppResolveCatalogBrandSlug(product,window.PRICEPULSE_CATALOG_BRANDS||{});
  return window.PRICEPULSE_CATALOG_BRANDS?.[String(slug||'')]||null;
}
function ppCatalogOffersForProduct(productId,data){
  const rows=window.PRICEPULSE_CATALOG_LISTINGS?.[String(productId)]||[];
  const mapped=rows.map((row,i)=>{
    const store=row.store||window.PRICEPULSE_CATALOG_STORES?.[String(row.store_slug||'')]||null;
    const name=String(store?.name||row.store_slug||'').trim();
    const url=String(row.affiliate_url||row.direct_url||'').trim();
    if(!name||!url)return null;
    return {name,url,logoUrl:store?.logo_url||'',storeSlug:row.store_slug||'',listingStatus:row.listing_status||'active',originalOrder:i,...(ppVerifiedOffer(productId,name)||{price:null,checkedAt:''})};
  }).filter(Boolean);
  return mapped.length?mapped:ppComparisonOfferLinks(data,productId);
}

function ppApplyCatalogImageRows(rows){
  const mapped={};
  for(const row of rows||[]){
    const productId=String(row.product_id||'');
    if(!productId)continue;
    const displayImageUrl=ppMainSiteImageUrl(row);
    mapped[productId]={
      imageUrl:displayImageUrl,
      liveImageUrl:row.live_image_url||'',
      fallbackImageUrl:row.image_url||'',
      store:row.live_image_store||'',
      verifiedAt:row.live_image_verified_at||'',
      source:ppSiteImageConfig(row).mode==='curated'?'curated-gallery':(row.live_image_source||''),
      metadata:row.metadata&&typeof row.metadata==='object'?row.metadata:{}
    };
    const card=document.querySelector(`.deal-card .heart[data-id="${CSS.escape(productId)}"]`)?.closest('.deal-card');
    const img=card?.querySelector('.product-photo');
    if(!img||!mapped[productId].imageUrl)continue;
    if(!img.dataset.ppFallbackSrc)img.dataset.ppFallbackSrc=img.getAttribute('src')||'';
    const item=ppGlobalPrimaryImageItem(productId,img.dataset.ppFallbackSrc)||ppImageItem(mapped[productId].imageUrl,{bg:'soft',fit:'contain',position:'center',scale:'100'});
    img.onerror=()=>{const fallback=img.dataset.ppFallbackSrc;if(fallback&&img.getAttribute('src')!==fallback){img.onerror=null;img.src=fallback;}};
    img.src=item?.url||mapped[productId].imageUrl;
    if(item)ppApplyGlobalImageToElement(img,item);
    if(mapped[productId].store)img.dataset.ppImageStore=mapped[productId].store;
  }
  window.PRICEPULSE_CATALOG_IMAGES=mapped;
}
async function ppPreloadCatalogImages(force=false){
  if(window.PP_PRICE_PILOT_ENABLED!==true || !supabaseClient)return;
  if(ppCatalogImagesPromise && !force)return ppCatalogImagesPromise;
  ppCatalogImagesPromise=(async()=>{
    try{
      const {data,error}=await supabaseClient.from('pp_catalog_products')
        .select('product_id,image_url,live_image_url,live_image_store,live_image_verified_at,live_image_source,metadata')
        .in('status',['active','tracking']);
      if(error){
        // V78 migration is optional until deployed; preserve existing static product images.
        if(!['42P01','42703','PGRST204'].includes(error.code))console.warn('PricePulse: catalog images unavailable',error.code);
        return;
      }
      ppApplyCatalogImageRows(data);
      ppCatalogImagesReady=true;
    }catch(e){console.warn('PricePulse: catalog images unavailable',e?.message);}
    finally{ppCatalogImagesPromise=null;}
  })();
  return ppCatalogImagesPromise;
}
let ppHistoryReady=false;
let ppHistoryPromise=null;
window.PRICEPULSE_PRICE_HISTORY=window.PRICEPULSE_PRICE_HISTORY||{};
function ppProductIdForName(productName){
  const card=cards.find(c=>c.querySelector(".compare-btn")?.dataset.product===productName);
  return card?.querySelector(".heart")?.dataset.id||"";
}
function ppButtonForProductId(productId){
  return $(`.deal-card .heart[data-id="${CSS.escape(String(productId))}"]`)?.closest('.deal-card')?.querySelector('.compare-btn')||null;
}
function ppApplyLivePriceRows(rows){
  window.PRICEPULSE_APPROVED_PRICES=window.PRICEPULSE_APPROVED_PRICES||{};
  const grouped={};
  for(const row of rows||[]){
    const productId=String(row.product_id||"");
    if(!productId || !String(row.retailer||'').trim() || !Number.isFinite(Number(row.price)) || Number(row.price)<=0)continue;
    grouped[productId]=grouped[productId]||{};
    grouped[productId][row.retailer]={price:Number(row.price),checkedAt:row.checked_at,
      source:row.source,availability:row.availability,displayPermitted:row.display_permitted,
      mrp:Number.isFinite(Number(row.mrp))&&Number(row.mrp)>0?Number(row.mrp):null,
      rating:Number.isFinite(Number(row.rating))&&Number(row.rating)>0&&Number(row.rating)<=5?Number(row.rating):null,
      reviewCount:Number.isFinite(Number(row.review_count))&&Number(row.review_count)>0?Number(row.review_count):null,
      deliveryText:String(row.delivery_text||'').trim(),offerText:String(row.offer_text||'').trim(),
      capturedTitle:String(row.captured_title||'').trim(),capturedModel:String(row.captured_model||'').trim(),capturedVariant:String(row.captured_variant||'').trim(),
      matchStatus:String(row.match_status||''),detailsReviewed:row.details_reviewed===true,
      listingUrl:String(row.listing_url||'').trim()};
  }
  window.PRICEPULSE_APPROVED_PRICES=grouped;
  ppUpdateHomeCardPrices();
}
function ppApplyHistoryRows(rows){
  const grouped={};
  for(const row of rows||[]){
    const productId=String(row.product_id||"");
    if(!productId || !String(row.retailer||'').trim() || !Number.isFinite(Number(row.price)) || Number(row.price)<=0)continue;
    grouped[productId]=grouped[productId]||[];
    grouped[productId].push({retailer:row.retailer,price:Number(row.price),availability:row.availability,
      checkedAt:row.checked_at,source:row.source,displayPermitted:row.display_permitted});
  }
  window.PRICEPULSE_PRICE_HISTORY=grouped;
}
function ppRerenderOpenComparison(){
  if(!modal || modal.hidden)return;
  const openComparison=modalBody?.querySelector('.pp-v52-comparison[data-product-id]');
  const productId=openComparison?.dataset.productId||"";
  if(!productId)return;
  const btn=ppButtonForProductId(productId);
  if(btn)modalBody.innerHTML=comparisonModalHTML(btn.dataset.product,datasetForButton(btn));
}
async function ppPreloadLivePrices(force=false){
  if(window.PP_PRICE_PILOT_ENABLED!==true || !supabaseClient)return;
  if(ppLivePricesPromise && !force)return ppLivePricesPromise;
  ppLivePricesPromise=(async()=>{
    try{
      const {data,error}=await supabaseClient.from("pp_retailer_prices")
        .select("product_id,retailer,price,mrp,rating,review_count,delivery_text,offer_text,captured_title,captured_model,captured_variant,match_status,details_reviewed,listing_url,checked_at,source,availability,display_permitted")
        .eq("published",true).eq("display_permitted",true)
        .gt("expires_at",new Date().toISOString());
      if(error){console.warn("PricePulse: no verified price data available",error.code);return;}
      ppApplyLivePriceRows(data);
      ppLivePricesReady=true;
      // Best-store image is persisted by the V78 database trigger. Refresh the image map
      // whenever current verified prices are refreshed so an open session follows the latest best store.
      await ppPreloadCatalogImages(true);
      ppRerenderOpenComparison();
    }catch(e){console.warn("PricePulse: current prices unavailable",e?.message);}
    finally{ppLivePricesPromise=null;}
  })();
  return ppLivePricesPromise;
}
async function ppPreloadHistory(force=false){
  if(window.PP_PRICE_PILOT_ENABLED!==true || !supabaseClient)return;
  if(ppHistoryPromise && !force)return ppHistoryPromise;
  ppHistoryPromise=(async()=>{
    try{
      const since=new Date(Date.now()-30*24*60*60*1000).toISOString();
      const {data,error}=await supabaseClient.from("pp_retailer_price_history")
        .select("product_id,retailer,price,availability,checked_at,source,display_permitted")
        .eq("display_permitted",true).gte("checked_at",since)
        .order("checked_at",{ascending:false}).limit(2000);
      if(error){
        // History is an optional V70 migration. Current prices continue to work even
        // before the one-time SQL is run. Avoid repeated missing-table reads until reload.
        if(error.code==="42P01")ppHistoryReady=true;
        else console.warn("PricePulse: price history unavailable",error.code);
        return;
      }
      ppApplyHistoryRows(data);
      ppHistoryReady=true;
      ppRerenderOpenComparison();
    }catch(e){console.warn("PricePulse: price history unavailable",e?.message);}
    finally{ppHistoryPromise=null;}
  })();
  return ppHistoryPromise;
}
async function ppFetchLivePrices(productId){
  if(window.PP_PRICE_PILOT_ENABLED!==true || !productId)return;
  const pending=[];
  if(!ppCatalogDataReady)pending.push(ppPreloadCatalogData(false));
  if(!ppLivePricesReady)pending.push(ppPreloadLivePrices(false));
  if(!ppHistoryReady)pending.push(ppPreloadHistory(false));
  if(pending.length)await Promise.all(pending);
}
function ppHistorySnapshots(productId){
  const rows=[...(window.PRICEPULSE_PRICE_HISTORY?.[productId]||[])]
    .filter(r=>Number.isFinite(Date.parse(r.checkedAt||"")))
    .sort((a,b)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt));
  if(!rows.length)return [];
  const clusters=[];
  let cluster=[];
  let clusterStart=0;
  let lastTime=0;
  for(const row of rows){
    const t=Date.parse(row.checkedAt);
    if(!cluster.length || (t-lastTime<=45*60*1000 && t-clusterStart<=60*60*1000)){
      if(!cluster.length)clusterStart=t;
      cluster.push(row);
    }else{
      clusters.push(cluster);
      cluster=[row];clusterStart=t;
    }
    lastTime=t;
  }
  if(cluster.length)clusters.push(cluster);
  return clusters.map(group=>{
    const latest={};
    for(const row of group)latest[row.retailer]=row;
    const comparable=Object.values(latest).filter(r=>r.availability==="in_stock"&&Number.isFinite(r.price)&&r.price>0);
    if(comparable.length<2)return null;
    const lowest=Math.min(...comparable.map(r=>r.price));
    const winners=comparable.filter(r=>r.price===lowest).map(r=>r.retailer);
    const prices={};
    const checkedAt={};
    for(const row of comparable){prices[row.retailer]=row.price;checkedAt[row.retailer]=row.checkedAt;}
    const fullyAutomated=comparable.every(r=>PP_AUTOMATED_SOURCES.has(r.source));
    return {time:Math.max(...comparable.map(r=>Date.parse(r.checkedAt))),winners,prices,checkedAt,fullyAutomated};
  }).filter(Boolean).sort((a,b)=>b.time-a.time);
}
function ppTieAnalysis(productId,bestOffers){
  if(bestOffers.length<2)return null;
  const names=bestOffers.map(o=>o.name);
  const nameSet=new Set(names);
  const snapshots=ppHistorySnapshots(productId).filter(s=>names.every(name=>Number.isFinite(s.prices?.[name])&&s.prices[name]>0));
  // Compare tied stores only on snapshots where every currently tied store had a verified in-stock price.
  // Once enough official API/feed snapshots exist, prefer them over manual history.
  const automated=snapshots.filter(s=>s.fullyAutomated);
  const considered=(automated.length>=3?automated:snapshots).slice(0,10);
  const stats={};
  names.forEach((name,index)=>stats[name]={name,index,lowerWins:0,sum:0,count:0,inStockChecks:0,lastLower:0,lastSeen:0,currentCheckedAt:Date.parse(bestOffers[index]?.checkedAt||"")||0});
  for(const snap of considered){
    for(const name of names){
      const price=snap.prices?.[name];
      if(Number.isFinite(price)&&price>0){
        const st=stats[name];
        st.sum+=price;st.count++;st.inStockChecks++;st.lastSeen=Math.max(st.lastSeen,Date.parse(snap.checkedAt?.[name]||"")||snap.time||0);
      }
    }
    const decisive=snap.winners.filter(w=>nameSet.has(w));
    if(decisive.length===1){
      const st=stats[decisive[0]];
      st.lowerWins++;
      st.lastLower=Math.max(st.lastLower,snap.time||0);
    }
  }
  const ranked=names.map(name=>{
    const st=stats[name];
    return {...st,avg:st.count?st.sum/st.count:Number.POSITIVE_INFINITY};
  }).sort((a,b)=>
    b.lowerWins-a.lowerWins ||
    a.avg-b.avg ||
    b.inStockChecks-a.inStockChecks ||
    b.lastLower-a.lastLower ||
    b.lastSeen-a.lastSeen ||
    b.currentCheckedAt-a.currentCheckedAt ||
    a.index-b.index
  );
  const selected=ranked[0];
  const runner=ranked[1];
  const offer=bestOffers.find(o=>o.name===selected?.name)||bestOffers[0];
  let reason="Most recently verified at the current best price while price history builds.";
  if(selected&&runner){
    if(selected.lowerWins!==runner.lowerWins && selected.lowerWins>0)reason=`${selected.name} was lower more often in recent verified checks.`;
    else if(Number.isFinite(selected.avg)&&Number.isFinite(runner.avg)&&Math.abs(selected.avg-runner.avg)>=0.01)reason=`${selected.name} had the lower average verified price.`;
    else if(selected.inStockChecks!==runner.inStockChecks)reason=`${selected.name} had more consistent verified in-stock availability.`;
    else if(selected.lastLower!==runner.lastLower && selected.lastLower>0)reason=`${selected.name} was the more recent lower-price retailer.`;
  }
  const decisiveTotal=Object.values(stats).reduce((sum,st)=>sum+st.lowerWins,0);
  return {offer,total:considered.length,automated:automated.length>=3,stats,ranked,decisiveTotal,reason};
}
function ppTieHistoryHTML(analysis){
  if(!analysis)return "";
  if(!analysis.total || !analysis.decisiveTotal){
    return `<div class="pp-v71-history is-building"><div class="pp-v71-history-head"><span class="pp-v71-history-icon" aria-hidden="true">▥</span><strong>Price history</strong></div><p>Verified history is still building. Best Deal uses the most recently verified tied listing for now.</p></div>`;
  }
  const ordered=[...analysis.ranked];
  const rows=ordered.map(st=>{
    const pct=analysis.total?Math.round((st.lowerWins/analysis.total)*100):0;
    return `<div class="pp-v71-history-row"><span>${escapeHTML(st.name)} was lower</span><span class="pp-v71-history-track"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></span><b>${st.lowerWins} ${st.lowerWins===1?'time':'times'} (${pct}%)</b></div>`;
  }).join("");
  return `<div class="pp-v71-history"><div class="pp-v71-history-head"><span class="pp-v71-history-icon" aria-hidden="true">▥</span><strong>Price history (last ${analysis.total} verified ${analysis.total===1?'check':'checks'})</strong></div>${rows}</div>`;
}
function ppUpdateHomeCardPrices(){
  cards.forEach(card=>{
    const btn=card.querySelector('.compare-btn');
    const productId=card.querySelector('.heart')?.dataset.id||'';
    const box=card.querySelector('.pp-card-price');
    if(!btn||!productId||!box)return;
    const verified=ppComparisonOfferLinks(btn.dataset,productId).filter(o=>o.price!=null);
    const state=ppRetailerStripState(btn.dataset,productId);
    const inStock=state.inStock;
    const storeCount=card.querySelector('.store-count');
    if(storeCount)storeCount.innerHTML=retailerStrip(btn.dataset,productId);
    ppUpdateHomeCardIdentity(card,productId,btn.dataset);
    ppUpdateHomeCardGallery(card,productId);
    const ratingBox=card.querySelector('.pp-card-rating');
    const uniqueRatingOffer=state.uniqueLowest||(inStock.length===1?inStock[0]:null);
    const ratingHTML=ppCardRatingHTML(uniqueRatingOffer);
    if(ratingBox){
      if(ratingHTML){
        const wrap=document.createElement('div');wrap.innerHTML=ratingHTML;ratingBox.replaceWith(wrap.firstElementChild);
      }else{ratingBox.replaceChildren();ratingBox.hidden=true;}
    }
    box.className='pp-card-price';
    if(inStock.length>=2){
      const lowest=state.lowest;
      const unique=state.uniqueLowest;
      const tied=state.isTie?state.bestOffers:[];
      const storeLabel=unique?unique.name:(state.allSame?'All checked stores':tied.length?`${tied.slice(0,2).map(o=>o.name).join(' & ')}${tied.length>2?' + more':''}`:'');
      const storeKicker=unique?'Lowest Price at':state.allSame?'Same Verified Price at':'Lowest Price tied at';
      const savings=unique?ppOfferSavings(unique):null;
      ppUpdateHomeMediaDiscount(card,unique);
      const discount=savings?`<span class="pp-card-discount">↓ ${savings.percent}% OFF</span>`:'';
      const savingLine=savings?`<div class="pp-card-saving"><span>MRP <s>${money(savings.mrp)}</s></span><strong>Save ${money(savings.saving)}</strong></div>`:'';
      box.classList.add('is-best');
      box.innerHTML=`<div class="pp-card-price-head"><div class="pp-card-price-main"><strong>Best Verified Price</strong><b>${money(lowest)}</b></div><div class="pp-card-lowest-group"><div class="pp-card-lowest-store"><span>${escapeHTML(storeKicker)}</span><strong>${escapeHTML(storeLabel)}</strong></div>${savingLine}</div>${discount}</div>`;
    }else if(inStock.length===1){
      const only=inStock[0];
      const savings=ppOfferSavings(only);
      ppUpdateHomeMediaDiscount(card,only);
      const discount=savings?`<span class="pp-card-discount">↓ ${savings.percent}% OFF</span>`:'';
      const savingLine=savings?`<div class="pp-card-saving"><span>MRP <s>${money(savings.mrp)}</s></span><strong>Save ${money(savings.saving)}</strong></div>`:'';
      box.classList.add('is-single');
      box.innerHTML=`<div class="pp-card-price-head"><div class="pp-card-price-main"><strong>Verified Price</strong><b>${money(only.price)}</b></div><div class="pp-card-lowest-group"><div class="pp-card-lowest-store"><span>Available at</span><strong>${escapeHTML(only.name)}</strong></div>${savingLine}</div>${discount}</div>`;
    }else if(verified.length){
      ppUpdateHomeMediaDiscount(card,null);
      box.classList.add('is-unavailable');
      box.innerHTML=`<strong>No in-stock verified price</strong><span>${verified.length} retailer ${verified.length===1?'price':'prices'} checked</span>`;
    }else{
      ppUpdateHomeMediaDiscount(card,null);
      box.classList.add('is-pending');
      box.innerHTML='<strong>Check latest prices →</strong><span>Verified prices update after review</span>';
    }
  });
}
if(window.PP_PRICE_PILOT_ENABLED===true){
  window.PRICEPULSE_APPROVED_PRICES=window.PRICEPULSE_APPROVED_PRICES||{};
  void ppPreloadCatalogImages(false);
  void ppPreloadCatalogData(false);
  void ppPreloadLivePrices(false);
}
function ppReadableDate(iso){
  const dt=new Date(iso);
  return Number.isFinite(dt.getTime())?new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true}).format(dt):"";
}
function ppComparisonOfferLinks(data,productId){
  return retailerOffers(data).map((offer,i)=>({...offer,...(ppVerifiedOffer(productId,offer.name)||{price:null,checkedAt:""}),originalOrder:i}));
}
function comparisonModalHTML(product,data={}){
  const card=cards.find(c=>c.querySelector(".compare-btn")?.dataset.product===product);
  const productId=card?.querySelector(".heart")?.dataset.id||"";
  const catalog=ppCatalogProduct(productId);
  const brand=ppCatalogBrandForProduct(catalog);
  const offers=ppCatalogOffersForProduct(productId,data);
  const photo=card?.querySelector(".product-photo"),staticBrandLogo=card?.querySelector(".product-brand-logo");
  const fallbackImage=photo?.getAttribute("src")||"";
  const gallery=ppResolvedProductGallery(catalog,productId,fallbackImage);
  const mainImageItem=gallery[0]||ppImageItem(fallbackImage,{bg:'white',fit:'contain',position:'center',scale:'100'});
  const mainImage=mainImageItem?.url||"";
  const available=offers.filter(o=>o.price!=null && o.availability!=="out_of_stock");
  const hasComparison=available.length>=2;
  const lowest=hasComparison?Math.min(...available.map(o=>o.price)):null;
  const sorted=[...offers].sort((a,b)=>{
    if(a.availability==="out_of_stock" && b.availability!=="out_of_stock")return 1;
    if(b.availability==="out_of_stock" && a.availability!=="out_of_stock")return -1;
    if(a.price==null && b.price==null)return a.originalOrder-b.originalOrder;
    if(a.price==null)return 1;
    if(b.price==null)return -1;
    return a.price-b.price||a.originalOrder-b.originalOrder;
  });
  const newest=available.length?available.map(o=>o.checkedAt).filter(Boolean).sort().at(-1):"";
  const displayName=String(catalog?.name||product||'Product');
  const escapedProduct=escapeHTML(displayName);
  const bestOffers=hasComparison?available.filter(o=>o.price===lowest):[];
  const pricedOffers=offers.filter(o=>o.price!=null);
  const priceDataPending=pricedOffers.length===0;
  const allAvailableSamePrice=hasComparison&&pricedOffers.length>=2&&pricedOffers.every(o=>o.price===pricedOffers[0].price);
  const bestOffer=bestOffers[0]||null;
  const tieAnalysis=bestOffers.length>1?ppTieAnalysis(productId,bestOffers):null;
  const selectedOffer=bestOffers.length===1?bestOffer:(tieAnalysis?.offer||bestOffer);
  const selectedStoreLogo=selectedOffer?`<span class="pp-v56-best-store pp-v71-selected-store" title="${escapeHTML(selectedOffer.name)}">${retailerLogo(selectedOffer.name)}</span>`:"";
  const bestCheckedText=bestOffers.length>1?`Available at multiple stores with same price`:`Lowest among ${available.length} retailer prices checked`;
  const historyBlock=bestOffers.length>1?ppTieHistoryHTML(tieAnalysis):"";
  const summaryCta=selectedOffer?`<a class="pp-v54-best-deal pp-v78-best-deal" href="${escapeHTML(selectedOffer.url)}" target="_blank" rel="sponsored noopener noreferrer" aria-label="View best deal on ${escapeHTML(selectedOffer.name)}">View Best Deal <span aria-hidden="true">↗</span></a>`:"";
  const bestSaving=selectedOffer?ppOfferSavings(selectedOffer):null;
  const bestSavingHTML=bestSaving?`<div class="pp-v787-best-saving"><span>MRP <s>${money(bestSaving.mrp)}</s></span><strong>Save ${money(bestSaving.saving)} (${bestSaving.percent}% OFF)</strong></div>`:'';
  const bestRatingHTML=selectedOffer&&(selectedOffer.rating||selectedOffer.reviewCount)?`<div class="pp-v787-best-rating">${selectedOffer.rating?`<span class="is-rating"><svg class="pp-rating-star" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2.8l2.72 5.51 6.08.88-4.4 4.29 1.04 6.06L12 16.68l-5.44 2.86 1.04-6.06-4.4-4.29 6.08-.88L12 2.8z"/></svg> ${escapeHTML(String(selectedOffer.rating))}</span>`:''}${selectedOffer.reviewCount?`<span>${escapeHTML(ppFormatCount(selectedOffer.reviewCount))} reviews</span>`:''}</div>`:'';
  const pricesSummary=hasComparison?`<div class="pp-v52-summary pp-v78-summary pp-v787-summary has-prices ${bestOffers.length>1?'has-tie pp-v71-has-history':''}"><img class="pp-v54-summary-logo" src="pricepulse-best-logo.png" alt="PricePulse"><div class="pp-v54-summary-copy"><strong>Best Price Found by PricePulse</strong><div class="pp-v56-best-price-line"><b>${money(lowest)}</b>${selectedStoreLogo}</div>${bestSavingHTML}${bestRatingHTML}<span>${bestCheckedText}</span></div>${summaryCta}${historyBlock}</div>`:
    available.length===1?'<div class="pp-v52-summary pp-v78-summary pp-v70-status-summary"><img class="pp-v54-summary-logo" src="pricepulse-best-logo.png" alt="PricePulse"><div><strong>One verified price available</strong><span>At least two checked in-stock retailer prices are needed to identify the lowest among them.</span></div></div>':
    `<div class="pp-v52-summary pp-v78-summary pp-v70-status-summary${priceDataPending?' is-price-pending':''}"><img class="pp-v54-summary-logo" src="pricepulse-best-logo.png" alt="PricePulse"><div><strong>Compare retailer listings</strong><span>Verified prices are not connected yet. View Deal opens each retailer’s current listing.</span></div></div>`;

  const galleryThumbs=gallery.length>1?`<div class="pp-v52-gallery-rail pp-v78-gallery-rail" aria-label="Product pictures">${gallery.map((item,i)=>`<button type="button" class="pp-v52-gallery-thumb pp-v78-gallery-thumb ${ppGlobalImageBgClass(item)} ${i===0?'is-active':''}" data-pp-gallery-src="${escapeHTML(item.url)}" data-pp-gallery-bg="${escapeHTML(item.bg)}" data-pp-gallery-fit="${escapeHTML(item.fit)}" data-pp-gallery-position="${escapeHTML(item.position)}" data-pp-gallery-scale="${escapeHTML(item.scale)}" data-pp-gallery-rotate="${escapeHTML(item.rotate)}" data-pp-gallery-x="${escapeHTML(item.x)}" data-pp-gallery-y="${escapeHTML(item.y)}" aria-label="View product photo ${i+1}" aria-pressed="${i===0?'true':'false'}"><img class="pp-global-product-image" src="${escapeHTML(item.url)}" alt="" loading="lazy" ${ppGlobalImageDataAttrs(item)} style="${escapeHTML(ppGlobalImageStyle(item))}"></button>`).join("")}</div>`:"";
  const brandName=String(brand?.name||card?.dataset.brandName||card?.dataset.brand||catalog?.brand_slug||'').trim();
  const brandSources=ppBrandLogoSources(productId,staticBrandLogo?.getAttribute('src')||'');
  const brandLogoHTML=ppPopupBrandLogo(brandSources.primary,brandSources.fallback,brandName||brandSources.name||'Brand');
  const safeVariantOffer=available.find(o=>o.matchStatus==='match'&&o.detailsReviewed===true&&String(o.capturedVariant||'').trim());
  const variantValue=String(catalog?.variant||safeVariantOffer?.capturedVariant||'').trim();
  const modelValue=String(catalog?.model_code||safeVariantOffer?.capturedModel||'').trim();
  const categoryValue=String(catalog?.category||'').trim().replace(/\b\w/g,m=>m.toUpperCase());
  const directValues=[categoryValue,brandName,modelValue,variantValue].filter((v,i,a)=>v&&a.indexOf(v)===i);
  const detailsHTML=directValues.length?`<div class="pp-v787-direct-values">${directValues.map(v=>`<span>${escapeHTML(v)}</span>`).join('')}</div>`:'';

  const rows=sorted.map(o=>{
    const diff=hasComparison&&o.price!=null&&o.availability!=="out_of_stock"?o.price-lowest:null;
    const isLowest=diff===0;
    const showLowestBadge=isLowest&&!allAvailableSamePrice;
    const badge=showLowestBadge?'<span class="pp-price-badge lowest">Lowest Price</span>':diff>0?`<span class="pp-price-badge more">${money(diff)} more</span>`:(isLowest&&allAvailableSamePrice?'<span class="pp-price-badge neutral">Same price</span>':'');
    const price=o.price!=null?`<strong class="pp-v52-amount">${money(o.price)}</strong>`:'<strong class="pp-v52-unavailable">Check latest price</strong>';
    const savings=ppOfferSavings(o);
    const savingHTML=savings?`<div class="pp-v787-saving-line"><span>MRP <s>${money(savings.mrp)}</s></span><strong>Save ${money(savings.saving)} (${savings.percent}% OFF)</strong></div>`:'';
    const meta=[];
    if(o.availability==="in_stock")meta.push('<span class="is-stock">In stock</span>');
    else if(o.availability==="out_of_stock")meta.push('<span class="is-oos">Out of stock</span>');
    if(o.deliveryText)meta.push(`<span class="is-delivery">${escapeHTML(o.deliveryText)}</span>`);
    const ratingHTML=(o.rating||o.reviewCount)?`<div class="pp-v787-rating-line">${o.rating?`<span class="is-rating"><svg class="pp-rating-star" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2.8l2.72 5.51 6.08.88-4.4 4.29 1.04 6.06L12 16.68l-5.44 2.86 1.04-6.06-4.4-4.29 6.08-.88L12 2.8z"/></svg> ${escapeHTML(String(o.rating))}</span>`:''}${o.reviewCount?`<span>${escapeHTML(ppFormatCount(o.reviewCount))} reviews</span>`:''}</div>`:'';
    const offerText=o.offerText?`<div class="pp-v787-offer-text">${escapeHTML(o.offerText)}</div>`:'';
    return `<article class="pp-v78-offer-row pp-v787-offer-row ${showLowestBadge?'is-best':''} ${o.availability==='out_of_stock'?'is-unavailable':''}" data-retailer="${escapeHTML(o.name)}">
      <div class="pp-v78-offer-main pp-v787-offer-main">
        <div class="pp-v78-offer-logo pp-v787-store-logo pp-store-${escapeHTML(ppSafeStoreClass(o.name))}">${ppPopupRetailerRowLogo(o)}</div>
        <div class="pp-v78-offer-copy">
          <div class="pp-v78-price-head">${price}${badge}</div>
          ${savingHTML}
          ${meta.length?`<div class="pp-v78-meta pp-v787-meta">${meta.join('')}</div>`:''}
          ${ratingHTML}
          ${offerText}
        </div>
      </div>
      <a class="pp-view-deal pp-v52-view-deal pp-v78-view-deal pp-store-${escapeHTML(ppSafeStoreClass(o.name))}" href="${escapeHTML(o.url)}" target="_blank" rel="sponsored noopener noreferrer" aria-label="View ${escapedProduct} on ${escapeHTML(o.name)}">View Deal <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5h6v6"/><path d="m19 5-9 9"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg></a>
    </article>`;
  }).join("");

  const wishlistSaved=saved.has(String(productId));
  const wishlistButton=productId?`<button type="button" class="pp-v78-secondary-action pp-v787-wishlist ${wishlistSaved?'is-saved':''}" data-pp-action="wishlist" data-product-id="${escapeHTML(productId)}"><span aria-hidden="true">${wishlistSaved?'♥':'♡'}</span><span>${wishlistSaved?'Saved in Wishlist':'Add to Wishlist'}</span></button>`:'';
  const shareButton=`<button type="button" class="pp-v78-share-btn pp-v787-share" data-pp-action="share" data-product-id="${escapeHTML(productId)}" aria-label="Share ${escapedProduct}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a3 3 0 1 0-2.82-4H15a3 3 0 0 0 .15.95L8.91 8.09a3 3 0 1 0 1.83 5.39l6.18 3.11A3 3 0 0 0 15 17a3 3 0 1 0 .91-2.16l-6.18-3.11a3.03 3.03 0 0 0 0-1.46l6.24-3.13A3 3 0 0 0 18 8Z" fill="currentColor"/></svg><span>Share</span></button>`;
  const verifiedBadge=!priceDataPending?'<span class="pp-v78-verified-badge pp-v787-verified-badge">Verified Product</span>':'<span class="pp-v78-verified-badge pp-v787-verified-badge is-price-pending">Price Check Pending</span>';
  return `<div class="pp-comparison pp-v52-comparison pp-v78-comparison pp-v787-comparison" data-product-id="${escapeHTML(productId)}" data-product-name="${escapedProduct}" data-best-price="${selectedOffer&&selectedOffer.price!=null?escapeHTML(money(selectedOffer.price)):''}" data-best-store="${selectedOffer?escapeHTML(selectedOffer.name):''}">
    <div class="pp-v78-body pp-v787-body">
      <section class="pp-v78-product pp-v787-product" aria-label="Product details">
        ${brandLogoHTML?`<div class="pp-v787-brand-logo">${brandLogoHTML}</div>`:''}
        <div class="pp-v78-product-stage pp-v787-product-stage"><div class="pp-v78-product-visual pp-v787-product-visual pp-global-product-surface ${ppGlobalImageBgClass(mainImageItem||{})}">${mainImage?`<img class="pp-v52-main-image pp-v78-main-image pp-global-product-image" src="${escapeHTML(mainImage)}" alt="${escapedProduct}" ${ppGlobalImageDataAttrs(mainImageItem||{})} style="${escapeHTML(ppGlobalImageStyle(mainImageItem||{}))}">`:''}</div></div>
        ${galleryThumbs}
        <div class="pp-v78-product-copy pp-v787-product-copy">
          <h2 class="pp-v78-product-title pp-v787-product-title">${escapedProduct}</h2>
          ${detailsHTML}
          <p class="pp-v78-product-subtitle">${offers.length} retailer ${offers.length===1?'listing':'listings'} available</p>
          <div class="pp-v78-product-advice pp-v787-product-advice"><span aria-hidden="true">✓</span><span>Compare the exact model and variant on the retailer’s website before buying.</span></div>
          ${wishlistButton?`<div class="pp-v78-product-actions pp-v787-product-actions">${wishlistButton}</div>`:''}
        </div>
      </section>
      <section class="pp-v78-market pp-v787-market" aria-label="Retailer price comparison">
        <div class="pp-v78-market-head pp-v787-market-head">
          <div class="pp-v78-market-copy">${verifiedBadge}<h2>Compare prices across stores</h2><p>Find the best available deal for ${escapedProduct}</p></div>
          <div class="pp-v78-market-actions pp-v787-market-actions">${shareButton}</div>
        </div>
        <div class="pp-v78-offer-list pp-v787-offer-list">${rows}</div>
        ${pricesSummary}
      </section>
    </div>
    <div class="pp-v78-footer pp-v787-footer" aria-label="Price and retailer information">
      <div class="pp-v78-price-note"><span class="pp-v78-tag-icon pp-v70-clock-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v5l3.4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><div><strong>${newest?`Prices checked on ${escapeHTML(ppReadableDate(newest))}`:'Price updates pending verified data'}</strong><span>Prices may change. Final price &amp; availability are confirmed on the retailer’s website.</span></div></div>
      <div class="pp-v78-footer-trust">
        <div><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 18.5 6v5.1c0 4.2-2.7 7.5-6.5 9.4-3.8-1.9-6.5-5.2-6.5-9.4V6L12 3.5Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span><strong>Secure<br>External Links</strong></div>
        <div><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7.2 8.2H4.5V5.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 8a8 8 0 1 1-1 7.1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></span><strong>Returns as per<br>Retailer Policy</strong></div>
        <div><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.9"/><path d="m8.5 12.1 2.2 2.2 4.8-4.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span><strong>Mapped Retailer<br>Listings</strong></div>
      </div>
    </div>
  </div>`;
}
modalBody?.addEventListener('click',event=>{
  const thumb=event.target.closest('[data-pp-gallery-src]');
  if(!thumb)return;
  const main=modalBody.querySelector('.pp-v78-main-image, .pp-v52-main-image');
  const visual=modalBody.querySelector('.pp-v78-product-visual, .pp-v787-product-visual');
  if(!main)return;
  const nextItem=ppNormalizeSiteImageSlot({url:thumb.dataset.ppGallerySrc,bg:thumb.dataset.ppGalleryBg,fit:thumb.dataset.ppGalleryFit,position:thumb.dataset.ppGalleryPosition,scale:thumb.dataset.ppGalleryScale,rotate:thumb.dataset.ppGalleryRotate,x:thumb.dataset.ppGalleryX,y:thumb.dataset.ppGalleryY});
  main.src=nextItem.url;
  ppApplyGlobalImageToElement(main,nextItem);
  if(visual){
    visual.classList.remove('pp-img-bg-soft','pp-img-bg-white','pp-img-bg-transparent','pp-img-bg-original');
    visual.classList.add(ppGlobalImageBgClass(nextItem),'pp-global-product-surface');
  }
  modalBody.querySelectorAll('[data-pp-gallery-src]').forEach(button=>{
    const active=button===thumb;
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',String(active));
  });
});

modalBody?.addEventListener('click',async event=>{
  const actionButton=event.target.closest('[data-pp-action]');
  if(!actionButton)return;
  const action=actionButton.dataset.ppAction;
  if(action==='wishlist'){
    const productId=String(actionButton.dataset.productId||'');
    const heart=productId?document.querySelector(`.heart[data-id="${CSS.escape(productId)}"]`):null;
    if(!heart)return;
    heart.click();
    setTimeout(()=>{
      const isSaved=saved.has(productId);
      actionButton.classList.toggle('is-saved',isSaved);
      const labels=actionButton.querySelectorAll('span');
      if(labels[0])labels[0].textContent=isSaved?'♥':'♡';
      if(labels[1])labels[1].textContent=isSaved?'Saved in Wishlist':'Add to Wishlist';
    },40);
  }else if(action==='share'){
    const shell=actionButton.closest('.pp-v78-comparison,.pp-v52-comparison');
    const productName=shell?.dataset.productName||'PricePulse deal';
    const bestPrice=shell?.dataset.bestPrice||'';
    const bestStore=shell?.dataset.bestStore||'';
    const text=bestPrice&&bestStore?`${productName} — best verified price ${bestPrice} on ${bestStore} via PricePulse.`:`${productName} — compare verified retailer offers on PricePulse.`;
    try{
      if(navigator.share)await navigator.share({title:`${productName} | PricePulse`,text});
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);showToast('Deal details copied');}
      else showToast('Sharing is not supported here');
    }catch(err){if(err?.name!=='AbortError')showToast('Could not share right now');}
  }
});

function datasetForButton(btn){return {...btn.dataset}}

// Apply the locked premium card system while preserving all original product/link data.
cards.forEach(card=>{
  const btn=card.querySelector('.compare-btn');
  const cardTop=card.querySelector('.card-top');
  const badge=card.querySelector('.card-top .discount');
  const brandLogo=card.querySelector('.product-brand-logo');
  if(cardTop&&brandLogo&&!cardTop.contains(brandLogo)){
    brandLogo.classList.add('pp-card-brand-box');
    cardTop.insertBefore(brandLogo,badge||cardTop.firstChild);
  }
  if(badge) badge.textContent='COMPARE & SAVE';
  const productId=card.querySelector('.heart')?.dataset.id||'';
  const storeCount=card.querySelector('.store-count');
  const title=card.querySelector('h3');
  if(title&&!card.querySelector('.pp-card-rating'))title.insertAdjacentHTML('afterend','<div class="pp-card-rating" hidden></div>');
  ppUpdateHomeCardIdentity(card,productId,btn.dataset);
  ppUpdateHomeCardGallery(card,productId);
  if(storeCount) storeCount.innerHTML=retailerStrip(btn.dataset,productId);
  card.querySelector('.price')?.remove();
  card.querySelector('.demo-label')?.remove();
  card.querySelector('.pp-prompt')?.remove();
  if(storeCount && !card.querySelector('.pp-card-price')) storeCount.insertAdjacentHTML('afterend','<div class="pp-card-price is-pending"><strong>Check latest prices →</strong><span>Verified prices update after review</span></div>');
  btn.innerHTML=ppCardCtaHTML(retailerOffers(btn.dataset).length);
});
ppUpdateHomeCardPrices();

/* V78.8.122 — selective no-blank refresh boot.
   The static HTML now starts with the brand logo in its final top-row position
   and reserves the premium identity/price rows. Keep the grid visible from the
   first paint, then expose only the JS-replaced pieces after their first pass. */
cards.forEach(card=>card.classList.add('pp-card-ready'));
if(window.__ppHomeBootFallback){clearTimeout(window.__ppHomeBootFallback);window.__ppHomeBootFallback=null;}
document.documentElement.classList.remove('pp-home-boot-fallback');

document.addEventListener('click',event=>{
  const thumb=event.target.closest('[data-pp-home-gallery-src]');
  if(!thumb)return;
  const card=thumb.closest('.deal-card');
  const img=card?.querySelector('.product-photo');
  if(!card||!img)return;
  const item=ppNormalizeSiteImageSlot({url:thumb.dataset.ppHomeGallerySrc,bg:thumb.dataset.ppGalleryBg,fit:thumb.dataset.ppGalleryFit,position:thumb.dataset.ppGalleryPosition,scale:thumb.dataset.ppGalleryScale,rotate:thumb.dataset.ppGalleryRotate,x:thumb.dataset.ppGalleryX,y:thumb.dataset.ppGalleryY});
  if(!item.url)return;
  img.src=item.url;ppApplyGlobalImageToElement(img,item);
  card.querySelectorAll('[data-pp-home-gallery-src]').forEach(button=>button.classList.toggle('is-active',button===thumb));
});

let ppComparisonOpenPending=false;
function ppGetComparisonPreAlignTargetY(card){
  if(!card||window.innerWidth<981)return null;
  const siteHeader=document.querySelector('.site-header');
  const headerBottom=Math.max(0,Math.round(siteHeader?.getBoundingClientRect?.().bottom||0));
  const rect=card.getBoundingClientRect();
  const sourceCenter=rect.top+rect.height/2;
  const targetCenter=headerBottom+(window.innerHeight-headerBottom)/2;
  const delta=sourceCenter-targetCenter;

  /* Already visually connected: keep the current page position untouched. */
  if(Math.abs(delta)<=34)return null;

  const maxScroll=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  const targetY=Math.max(0,Math.min(maxScroll,window.scrollY+delta));
  if(Math.abs(targetY-window.scrollY)<=2)return null;
  return targetY;
}
function ppWaitForCoveredPreAlignFrame(){
  return new Promise(resolve=>{
    /* Let the premium popup/backdrop visibly begin first. The actual background
       alignment then happens underneath that already-painted modal layer, so
       the customer does not see the page jump into position. */
    requestAnimationFrame(()=>setTimeout(resolve,72));
  });
}
function ppInstantAlignSourceCardBehindPopup(targetY){
  if(targetY==null)return;
  const root=document.documentElement;
  const previousScrollBehavior=root.style.scrollBehavior;

  /* Temporarily release the page lock only for the programmatic reposition.
     Force non-animated scrolling so there is no visible travel under the popup. */
  document.body.style.overflow='';
  root.style.scrollBehavior='auto';
  window.scrollTo({top:targetY,left:0,behavior:'auto'});
  root.style.scrollBehavior=previousScrollBehavior;

  if(modal && !modal.hidden && modal.classList.contains('pp-comparison-active')){
    document.body.style.overflow='hidden';
  }
}
async function ppOpenComparisonFromFindBestPrice(btn){
  if(ppComparisonOpenPending)return;
  const card=btn.closest('.deal-card');
  if(!card)return;
  ppComparisonOpenPending=true;
  try{
    const productId=card.querySelector('.heart')?.dataset.id||'';
    const live=window.PP_PRICE_PILOT_ENABLED===true && Boolean(productId);
    if(live)window.PRICEPULSE_APPROVED_PRICES=window.PRICEPULSE_APPROVED_PRICES||{};

    /* Calculate the connection target first, but do not move the page yet.
       Open immediately with the approved premium animation. If alignment is
       needed, reposition the background only after the modal layer has already
       begun painting, hiding that one-frame adjustment behind the popup. */
    const targetY=ppGetComparisonPreAlignTargetY(card);
    openModal(comparisonModalHTML(btn.dataset.product||'Product',datasetForButton(btn)),false,{originEl:card});
    if(live)void ppFetchLivePrices(productId);

    if(targetY!=null){
      await ppWaitForCoveredPreAlignFrame();
      if(modal && !modal.hidden && modal.classList.contains('pp-comparison-active')){
        ppInstantAlignSourceCardBehindPopup(targetY);
      }
    }
  }finally{
    ppComparisonOpenPending=false;
  }
}
$$('.compare-btn').forEach(btn=>btn.addEventListener('click',event=>{
  event.preventDefault();
  event.stopPropagation();
  void ppOpenComparisonFromFindBestPrice(btn);
}));

function getWishlistProduct(id){
  const heart=$(`.heart[data-id="${CSS.escape(String(id))}"]`);
  const card=heart?.closest('.deal-card');
  if(!card)return null;
  const btn=card.querySelector('.compare-btn');
  const photo=card.querySelector('.product-photo');
  const brand=card.querySelector('.product-brand-logo');
  const imageState=ppGlobalPrimaryImageItem(String(id),photo?.dataset.ppFallbackSrc||photo?.getAttribute('src')||'');
  const brandSources=ppBrandLogoSources(String(id),brand?.dataset.ppBrandFallback||brand?.getAttribute('src')||'');
  return {
    id:String(id),
    name:card.querySelector('h3')?.textContent?.trim()||'Saved product',
    image:imageState?.url||photo?.getAttribute('src')||'',
    imageState:imageState||null,
    brandLogo:brandSources.primary||'',
    brandFallback:brandSources.fallback||'',
    brandAlt:`${brandSources.name||'Brand'} logo`,
    facts:PP_SOURCE_FACTS[String(id)]||[],
    data:datasetForButton(btn)
  };
}

/* ================= V72 PREMIUM WISHLIST TRACKER =================
   A floating panel stays connected to the existing PricePulse home page.
   It reuses the exact verified-price adapter that powers Home + Compare. */
function ppWishlistProductState(productId){
  const p=getWishlistProduct(productId);
  if(!p)return {bestPrice:null,bestStore:'',availability:'unknown',checkedAt:'',inStockCount:0,verifiedCount:0};
  const offers=ppComparisonOfferLinks(p.data,productId);
  const verified=offers.filter(o=>o.price!=null);
  const inStock=verified.filter(o=>o.availability==='in_stock');
  const newest=verified.map(o=>o.checkedAt).filter(Boolean).sort().at(-1)||'';
  if(!inStock.length){
    const availability=verified.some(o=>o.availability==='out_of_stock')?'out_of_stock':'unknown';
    return {bestPrice:null,bestStore:'',availability,checkedAt:newest,inStockCount:0,verifiedCount:verified.length};
  }
  const lowest=Math.min(...inStock.map(o=>o.price));
  const bestOffers=inStock.filter(o=>o.price===lowest);
  const tieAnalysis=bestOffers.length>1?ppTieAnalysis(productId,bestOffers):null;
  const selected=bestOffers.length===1?bestOffers[0]:(tieAnalysis?.offer||bestOffers[0]);
  return {bestPrice:lowest,bestStore:selected?.name||bestOffers[0]?.name||'',availability:'in_stock',checkedAt:newest,inStockCount:inStock.length,verifiedCount:verified.length};
}
function ppRememberWishlistSave(productId,savedAt=new Date().toISOString()){
  const id=String(productId||'');
  if(!id)return;
  const existing=ppWishlistMetaEntry(id);
  if(existing?.savedAt){
    ppFillWishlistBaselineIfMissing(id);
    return;
  }
  const state=ppWishlistProductState(id);
  const entry={
    savedAt,
    savedPrice:Number.isFinite(state.bestPrice)?state.bestPrice:null,
    savedStore:state.bestStore||'',
    savedAvailability:state.availability||'unknown',
    lastSeenPrice:Number.isFinite(state.bestPrice)?state.bestPrice:null,
    lastSeenStore:state.bestStore||'',
    lastSeenAvailability:state.availability||'unknown',
    lastSeenVerifiedCount:Number(state.verifiedCount||0),
    lastSeenInStockCount:Number(state.inStockCount||0),
    lastSeenAt:state.checkedAt||savedAt
  };
  ppSetWishlistMetaEntry(id,entry);
  if(window.PP_PRICE_PILOT_ENABLED===true && !Number.isFinite(state.bestPrice)){
    void ppFetchLivePrices(id).then(()=>ppFillWishlistBaselineIfMissing(id));
  }
}
function ppFillWishlistBaselineIfMissing(productId){
  const id=String(productId||'');
  const existing=ppWishlistMetaEntry(id)||{savedAt:new Date().toISOString()};
  const state=ppWishlistProductState(id);
  let changed=false;
  const next={...existing};
  if(!Number.isFinite(Number(next.savedPrice)) && Number.isFinite(state.bestPrice)){
    next.savedPrice=state.bestPrice;
    next.savedStore=state.bestStore||'';
    next.savedAvailability=state.availability||'unknown';
    changed=true;
  }
  if(!('lastSeenPrice' in next) && Number.isFinite(state.bestPrice)){next.lastSeenPrice=state.bestPrice;changed=true;}
  if(!next.lastSeenStore && state.bestStore){next.lastSeenStore=state.bestStore;changed=true;}
  if(!next.lastSeenAvailability){next.lastSeenAvailability=state.availability||'unknown';changed=true;}
  if(!Number.isFinite(Number(next.lastSeenVerifiedCount))){next.lastSeenVerifiedCount=Number(state.verifiedCount||0);changed=true;}
  if(!Number.isFinite(Number(next.lastSeenInStockCount))){next.lastSeenInStockCount=Number(state.inStockCount||0);changed=true;}
  if(!next.lastSeenAt){next.lastSeenAt=state.checkedAt||next.savedAt||new Date().toISOString();changed=true;}
  if(changed)ppSetWishlistMetaEntry(id,next);
  return next;
}
function ppWishlistHistoryEvent(productId,meta,state){
  const id=String(productId||'');
  const seenStamp=Date.parse(meta.lastSeenAt||meta.savedAt||'')||0;
  const now=Date.now();
  const rows=[...(window.PRICEPULSE_PRICE_HISTORY?.[id]||[])]
    .map((row,index)=>({...row,stamp:Date.parse(row.checkedAt||'')||0,_index:index}))
    .filter(row=>row.stamp>0 && row.stamp<=now+600000 && PP_APPROVED_SOURCES.has(row.source))
    .sort((a,b)=>a.stamp-b.stamp || a._index-b._index);
  const fresh=rows.filter(row=>row.stamp>seenStamp);
  if(!fresh.length)return null;

  const newestFresh=Math.max(...fresh.map(r=>r.stamp));
  const events=[];
  const previousFor=row=>{
    for(let i=rows.length-1;i>=0;i--){
      const old=rows[i];
      if(old.stamp<row.stamp && old.retailer===row.retailer)return old;
    }
    return null;
  };
  const push=(priority,row,statusTone,statusLabel,statusSub,label=statusLabel,detail=statusSub)=>{
    events.push({priority,stamp:row?.stamp||newestFresh,statusTone,statusLabel,statusSub:statusSub||'',tone:statusTone,label,detail:detail||''});
  };

  const lastSeenPrice=Number(meta.lastSeenPrice);
  const currentPrice=Number(state.bestPrice);
  const hasSeenPrice=Number.isFinite(lastSeenPrice)&&lastSeenPrice>0;
  const hasCurrentPrice=Number.isFinite(currentPrice)&&currentPrice>0;

  // Product-level best-price movement. This is shown only when a fresh verified
  // history row exists after the customer last saw the Wishlist.
  if(hasSeenPrice&&hasCurrentPrice&&Math.round(lastSeenPrice)!==Math.round(currentPrice)){
    const diff=Math.round(Math.abs(currentPrice-lastSeenPrice));
    if(currentPrice<lastSeenPrice){
      push(100,null,'drop',`↓ ${money(diff)}`,`Best price: ${money(lastSeenPrice)} → ${money(currentPrice)}`,
        `Price dropped ${money(diff)}`,`Best verified price ${money(lastSeenPrice)} → ${money(currentPrice)}`);
    }else{
      push(100,null,'increase',`↑ ${money(diff)}`,`Best price: ${money(lastSeenPrice)} → ${money(currentPrice)}`,
        `Price increased ${money(diff)}`,`Best verified price ${money(lastSeenPrice)} → ${money(currentPrice)}`);
    }
  }

  // Product-level stock state only counts when there is explicit fresh history
  // supporting the new state, so simple 24h expiry cannot create a fake update.
  const oldAvailability=String(meta.lastSeenAvailability||'unknown');
  const newAvailability=String(state.availability||'unknown');
  if(oldAvailability!==newAvailability){
    if(oldAvailability==='out_of_stock'&&newAvailability==='in_stock'&&fresh.some(r=>r.availability==='in_stock')){
      const row=[...fresh].reverse().find(r=>r.availability==='in_stock');
      push(95,row,'positive','Back in stock',row?.retailer?`${row.retailer} is available again`:'' );
    }else if(oldAvailability==='in_stock'&&newAvailability==='out_of_stock'&&fresh.some(r=>r.availability==='out_of_stock')){
      const row=[...fresh].reverse().find(r=>r.availability==='out_of_stock');
      push(95,row,'warning','Out of stock',row?.retailer?`${row.retailer} availability changed`:'' );
    }
  }

  // Retailer-level verified events come straight from pp_retailer_price_history.
  // Re-verifying the same price/stock does NOT count as a New Update.
  for(const row of fresh){
    const older=previousFor(row);
    if(!older)continue;
    const oldAvail=String(older.availability||'');
    const avail=String(row.availability||'');
    const oldPrice=Number(older.price);
    const price=Number(row.price);
    if(oldAvail==='out_of_stock'&&avail==='in_stock'){
      push(90,row,'positive','Back in stock',`${row.retailer} is available again`);
      continue;
    }
    if(oldAvail==='in_stock'&&avail==='out_of_stock'){
      push(90,row,'warning','Out of stock',`${row.retailer} availability changed`);
      continue;
    }
    if(oldAvail&&avail&&oldAvail!==avail){
      push(80,row,'update','Retailer stock updated',`${row.retailer}: ${oldAvail.replaceAll('_',' ')} → ${avail.replaceAll('_',' ')}`);
      continue;
    }
    if(Number.isFinite(oldPrice)&&oldPrice>0&&Number.isFinite(price)&&price>0&&Math.round(oldPrice)!==Math.round(price)){
      const diff=Math.round(Math.abs(price-oldPrice));
      if(price<oldPrice){
        push(70,row,'drop',`↓ ${money(diff)}`,`${row.retailer}: ${money(oldPrice)} → ${money(price)}`,
          `Price dropped ${money(diff)}`,`${row.retailer}: ${money(oldPrice)} → ${money(price)}`);
      }else{
        push(70,row,'increase',`↑ ${money(diff)}`,`${row.retailer}: ${money(oldPrice)} → ${money(price)}`,
          `Price increased ${money(diff)}`,`${row.retailer}: ${money(oldPrice)} → ${money(price)}`);
      }
    }
  }

  const lastSeenVerifiedCount=Number(meta.lastSeenVerifiedCount);
  const lastSeenInStockCount=Number(meta.lastSeenInStockCount);
  const verifiedIncreased=Number.isFinite(lastSeenVerifiedCount)&&Number(state.verifiedCount||0)>lastSeenVerifiedCount;
  const inStockIncreased=Number.isFinite(lastSeenInStockCount)&&Number(state.inStockCount||0)>lastSeenInStockCount;
  if(verifiedIncreased||inStockIncreased){
    const newRow=[...fresh].reverse().find(row=>!previousFor(row));
    if(newRow){
      push(60,newRow,'update',newRow.availability==='in_stock'?'New retailer available':'New retailer verified',
        `${newRow.retailer} verified at ${money(Number(newRow.price))}`);
    }else if(inStockIncreased){
      const row=[...fresh].reverse().find(r=>r.availability==='in_stock');
      if(row)push(55,row,'update','New retailer available',`${row.retailer} is now verified in stock`);
    }
  }

  // Best-store change is accepted only when fresh history contains an actual
  // price/stock change for the old or new best store. A same-price tie re-check
  // cannot create this status.
  const oldStore=String(meta.lastSeenStore||'');
  const newStore=String(state.bestStore||'');
  if(oldStore&&newStore&&oldStore!==newStore){
    const evidence=[...fresh].reverse().find(row=>{
      if(row.retailer!==oldStore&&row.retailer!==newStore)return false;
      const older=previousFor(row);
      if(!older)return false;
      const priceChanged=Number.isFinite(Number(older.price))&&Number.isFinite(Number(row.price))&&Math.round(Number(older.price))!==Math.round(Number(row.price));
      const availabilityChanged=String(older.availability||'')!==String(row.availability||'');
      return priceChanged||availabilityChanged;
    });
    if(evidence){
      push(50,evidence,'update','Best store changed',`${oldStore} → ${newStore}`);
    }
  }

  if(!events.length)return null;
  events.sort((a,b)=>b.priority-a.priority || b.stamp-a.stamp);
  const event=events[0];
  event.checkedAt=new Date(event.stamp||newestFresh).toISOString();
  return event;
}
function ppWishlistStatus(productId){
  const id=String(productId||'');
  const meta=ppFillWishlistBaselineIfMissing(id)||{};
  const state=ppWishlistProductState(id);
  const savedPrice=Number(meta.savedPrice);
  const currentPrice=Number(state.bestPrice);
  const hasSavedPrice=Number.isFinite(savedPrice)&&savedPrice>0;
  const hasCurrentPrice=Number.isFinite(currentPrice)&&currentPrice>0;
  const delta=hasSavedPrice&&hasCurrentPrice?savedPrice-currentPrice:0;
  const dropAmount=delta>0.5?Math.round(delta):0;
  const increaseAmount=delta<-.5?Math.round(Math.abs(delta)):0;
  const historyEvent=ppWishlistHistoryEvent(id,meta,state);
  const isNewUpdate=Boolean(historyEvent);

  let tone='neutral',label='No price change',detail='';
  if(historyEvent){
    tone=historyEvent.tone;label=historyEvent.label;detail=historyEvent.detail;
  }else if(dropAmount){
    tone='positive';label=`${money(dropAmount)} lower than when you saved`;detail=`Saved at ${money(savedPrice)}`;
  }else if(increaseAmount){
    tone='warning';label=`${money(increaseAmount)} higher than when you saved`;detail=`Saved at ${money(savedPrice)}`;
  }else if(state.availability==='out_of_stock'&&!hasCurrentPrice){
    tone='warning';label='No in-stock price right now';
  }else if(!hasSavedPrice&&hasCurrentPrice){
    tone='update';label='Latest verified price ready';
  }

  let statusTone='neutral',statusLabel='↔ No Change',statusSub='';
  if(historyEvent){
    statusTone=historyEvent.statusTone;
    statusLabel=historyEvent.statusLabel;
    statusSub=historyEvent.statusSub||'';
  }else if(dropAmount){
    statusTone='drop';statusLabel=`↓ ${money(dropAmount)}`;statusSub=`Saved at ${money(savedPrice)}`;
  }else if(increaseAmount){
    statusTone='increase';statusLabel=`↑ ${money(increaseAmount)}`;statusSub=`Saved at ${money(savedPrice)}`;
  }else if(!hasSavedPrice&&hasCurrentPrice){
    statusTone='update';statusLabel='Latest verified price';
  }else if(state.availability==='out_of_stock'&&!hasCurrentPrice){
    statusTone='warning';statusLabel='Out of stock';
  }

  return {meta,state,tone,label,detail,dropAmount,increaseAmount,isNewUpdate,historyEvent,statusTone,statusLabel,statusSub};
}
function ppRelativeTime(iso){
  const stamp=Date.parse(iso||'');
  if(!Number.isFinite(stamp))return 'Update pending';
  const mins=Math.max(0,Math.floor((Date.now()-stamp)/60000));
  if(mins<1)return 'Just now';
  if(mins<60)return `${mins} min ago`;
  const hours=Math.floor(mins/60);
  if(hours<24)return `${hours} ${hours===1?'hour':'hours'} ago`;
  const days=Math.floor(hours/24);
  return `${days} ${days===1?'day':'days'} ago`;
}
function ppWishlistDealAlertInfo(productId){
  const alert=ppFindDealAlertForProduct(productId);
  if(!alert)return null;
  const state=ppDealAlertStatus(alert);
  const current=ppDealAlertCurrentState(alert);
  const currentPrice=Number.isFinite(current.price)?current.price:(Number.isFinite(Number(alert.last_seen_price))?Number(alert.last_seen_price):null);
  return {alert,state,current,currentPrice};
}
function ppWishlistAlertStateHTML(productId){
  const info=ppWishlistDealAlertInfo(productId);
  if(!info){
    return `<div class="pp-wish-alert-box is-empty"><div class="pp-wish-alert-head"><span class="pp-wish-alert-icon">♧</span><div><strong>Set Deal Alert</strong><small>Set your target price</small></div></div><button class="pp-wish-alert" data-wishlist-action="set-alert" data-id="${escapeHTML(productId)}">＋ Set Deal Alert</button></div>`;
  }
  const {alert,state,currentPrice}=info;
  const target=money(Number(alert.target_price));
  const current=Number.isFinite(currentPrice)?money(currentPrice):'Checking latest price';
  if(state.tone==='triggered'){
    return `<div class="pp-wish-alert-box is-reached"><div class="pp-wish-alert-head"><span class="pp-wish-alert-icon">✓</span><div><strong>Target Reached</strong><small>Deal available now</small></div></div><div class="pp-wish-alert-meta"><span>Target <b>${target}</b></span><span>Current <b>${current}</b></span></div><div class="pp-wish-alert-buttons"><button class="pp-wish-view-deal" data-wishlist-action="view-deal" data-id="${escapeHTML(productId)}">View Deal</button><button class="pp-wish-edit-alert" data-wishlist-action="set-alert" data-id="${escapeHTML(productId)}">Edit Alert</button></div></div>`;
  }
  return `<div class="pp-wish-alert-box is-active"><div class="pp-wish-alert-head"><span class="pp-wish-alert-icon">♧</span><div><strong>Deal Alert Active</strong><small><i></i> Watching</small></div></div><div class="pp-wish-alert-meta"><span>Target <b>${target} or below</b></span></div><button class="pp-wish-edit-alert" data-wishlist-action="set-alert" data-id="${escapeHTML(productId)}">Edit Alert</button></div>`;
}
function ppWishlistCardHTML(product,status,view='all'){
  const {state}=status;
  let displayStatusTone=status.statusTone;
  let displayStatusLabel=status.statusLabel;
  let displayStatusSub=status.statusSub;
  if(view==='drops'&&status.dropAmount){
    displayStatusTone='drop';
    displayStatusLabel=`↓ ${money(status.dropAmount)}`;
    displayStatusSub=Number.isFinite(Number(status.meta?.savedPrice))?`Saved at ${money(Number(status.meta.savedPrice))}`:'';
  }
  const bestPrice=Number.isFinite(state.bestPrice)?money(state.bestPrice):'Check latest price';
  const priceTag=Number.isFinite(state.bestPrice)?`<span class="pp-wish-price-tag">${state.inStockCount>=2?'Lowest Price':'Verified'}</span>`:'';
  const facts=product.facts?.length?`<div class="pp-wish-facts">${product.facts.slice(0,3).map(f=>`<span>${escapeHTML(f)}</span>`).join('')}</div>`:'';
  const brand=product.brandLogo?`<img class="pp-wish-brand-logo pp-global-brand-logo" src="${escapeHTML(product.brandLogo)}" alt="${escapeHTML(product.brandAlt||'Brand logo')}" data-fallback="${escapeHTML(product.brandFallback||'')}" onerror="if(this.dataset.fallback&&this.src!==this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback='';}else{this.hidden=true;}">`:'';
  const statusSub=displayStatusSub?`<small>${escapeHTML(displayStatusSub)}</small>`:'';
  const imageState=product.imageState||ppImageItem(product.image,{bg:'soft',fit:'contain',position:'center',scale:'100'});
  return `<article class="pp-wish-track-card" data-wishlist-id="${escapeHTML(product.id)}">
    <div class="pp-wish-status is-${escapeHTML(displayStatusTone)}"><strong>${escapeHTML(displayStatusLabel)}</strong>${statusSub}</div>
    <button class="pp-wish-remove" data-wishlist-action="remove" data-id="${escapeHTML(product.id)}" aria-label="Remove ${escapeHTML(product.name)} from wishlist" title="Remove from Wishlist">♥</button>
    <div class="pp-wish-product-media pp-global-product-surface ${ppGlobalImageBgClass(imageState||{})}"><img class="pp-global-product-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" ${ppGlobalImageDataAttrs(imageState||{})} style="${escapeHTML(ppGlobalImageStyle(imageState||{}))}"></div>
    <div class="pp-wish-product-main">
      ${brand}<h3>${escapeHTML(product.name)}</h3>${facts}
      ${retailerStrip(product.data,product.id)}
      <div class="pp-wish-best-price"><span>Best verified price</span><div><strong>${bestPrice}</strong>${priceTag}</div><small>${state.inStockCount?`Across ${state.inStockCount} in-stock ${state.inStockCount===1?'retailer':'retailers'}`:'Verified price availability pending'}</small></div>
    </div>
    <div class="pp-wish-card-actions">${ppWishlistAlertStateHTML(product.id)}<button class="pp-wish-compare" data-wishlist-action="compare" data-id="${escapeHTML(product.id)}">Find Best Price →</button></div>
  </article>`;
}
function ppWishlistUpdatesReadKey(){return `pp_wishlist_updates_read_v1_${currentUser?.id||'guest'}`}
function ppWishlistUpdatesLastRead(){
  try{return Number(localStorage.getItem(ppWishlistUpdatesReadKey())||0)||0}catch{return 0}
}
function ppMarkWishlistUpdatesRead(){
  try{localStorage.setItem(ppWishlistUpdatesReadKey(),String(Date.now()))}catch{}
}
function ppWishlistAlertActivityEvents(products){
  const allowed=new Set(products.map(p=>String(p.id)));
  const now=Date.now();
  const cutoff=now-30*24*60*60*1000;
  const events=[];
  for(const alert of ppDealAlerts){
    if(!allowed.has(String(alert.product_id)))continue;
    const product=products.find(p=>String(p.id)===String(alert.product_id))||ppDealAlertProduct(alert.product_id,alert);
    const created=Date.parse(alert.created_at||'')||0;
    const updated=Date.parse(alert.updated_at||'')||0;
    const triggered=Date.parse(alert.triggered_at||'')||0;
    if(created>=cutoff)events.push({kind:'alert-created',stamp:created,product,alert,headline:`Deal alert created · Target ${money(Number(alert.target_price))}`,detail:`Watching ${ppDealAlertStoreLabel(alert.retailer_scope)}`,tone:'update',icon:'♧'});
    if(updated>=cutoff && updated>created+5000 && Math.abs(updated-triggered)>5000)events.push({kind:'alert-updated',stamp:updated,product,alert,headline:`Deal alert updated · Target ${money(Number(alert.target_price))}`,detail:`Tracking ${ppDealAlertStoreLabel(alert.retailer_scope)}`,tone:'update',icon:'✎'});
    if(triggered>=cutoff)events.push({kind:'alert-triggered',stamp:triggered,product,alert,headline:`Target reached · ${money(Number(alert.triggered_price||alert.last_seen_price||alert.target_price))}`,detail:`Target was ${money(Number(alert.target_price))} or below`,tone:'positive',icon:'✓'});
    else if(ppDealAlertStatus(alert).tone==='triggered'){
      const stateStamp=Date.parse(ppWishlistProductState(alert.product_id)?.checkedAt||'')||0;
      if(stateStamp>=cutoff)events.push({kind:'alert-triggered-live',stamp:stateStamp,product,alert,headline:`Target reached · ${money(Number(ppDealAlertCurrentState(alert).price||alert.last_seen_price||alert.target_price))}`,detail:`Target was ${money(Number(alert.target_price))} or below`,tone:'positive',icon:'✓'});
    }
  }
  return events;
}
function ppWishlistAlertActivityRowHTML(event){
  const when=new Date(event.stamp).toISOString();
  return `<div class="pp-wish-admin-activity is-${escapeHTML(event.tone)}"><span class="pp-wish-admin-icon" aria-hidden="true">${escapeHTML(event.icon)}</span><div class="pp-wish-admin-copy"><strong>${escapeHTML(event.product?.name||'Saved product')}</strong><span>${escapeHTML(event.headline)} · ${escapeHTML(event.detail||'')}</span></div><time datetime="${escapeHTML(when)}">${escapeHTML(ppRelativeTime(when))}</time></div>`;
}
function ppWishlistCustomerActivityEvents(products){
  const now=Date.now();
  const cutoff=now-30*24*60*60*1000;
  const events=[];

  for(const product of products){
    const meta=ppWishlistMetaEntry(product.id)||{};
    const savedStamp=Date.parse(meta.savedAt||'')||0;

    if(savedStamp>=cutoff && savedStamp<=now+600000){
      events.push({
        kind:'wishlist-saved',
        stamp:savedStamp,
        product,
        headline:'Added to Wishlist',
        detail:'Saved for price and deal tracking',
        tone:'update',
        icon:'♥'
      });
    }

    const status=ppWishlistStatus(product.id);
    const event=status?.historyEvent;

    if(
      event &&
      Number.isFinite(Number(event.stamp)) &&
      Number(event.stamp)>=cutoff
    ){
      const label=String(event.label||'');

      // Customer-facing activity only. Keep internal verification/admin events
      // out of New Updates even though they can still power the price engine.
      const customerVisible=
        /^Price dropped/i.test(label) ||
        /^Price increased/i.test(label) ||
        /^Back in stock/i.test(label) ||
        /^Out of stock/i.test(label) ||
        /^Best store changed/i.test(label) ||
        /^↓\s*₹?/i.test(label) ||
        /^↑\s*₹?/i.test(label);

      if(customerVisible){
        let headline=label||'Wishlist item updated';
        let detail=String(event.detail||'');

        if(/best store changed/i.test(headline)){
          headline='Better store option found';
          detail='A better verified store is now available for this saved product';
        }

        events.push({
          kind:'wishlist-price',
          stamp:Number(event.stamp),
          product,
          headline,
          detail,
          tone:event.tone||'update',
          icon:
            event.tone==='drop' ? '↓' :
            event.tone==='increase' ? '↑' :
            event.tone==='positive' ? '✓' :
            event.tone==='warning' ? '!' : '↗'
        });
      }
    }
  }

  return events;
}

function ppWishlistCustomerActivityRowHTML(event){
  const when=new Date(event.stamp).toISOString();

  return `<div class="pp-wish-admin-activity is-${escapeHTML(event.tone)}"><span class="pp-wish-admin-icon" aria-hidden="true">${escapeHTML(event.icon)}</span><div class="pp-wish-admin-copy"><strong>${escapeHTML(event.product?.name||'Saved product')}</strong><span>${escapeHTML(event.headline)}${event.detail ? ` · ${escapeHTML(event.detail)}` : ''}</span></div><time datetime="${escapeHTML(when)}">${escapeHTML(ppRelativeTime(when))}</time></div>`;
}

function ppWishlistActivityFeed(products){
  const customerEvents=ppWishlistCustomerActivityEvents(products).map(item=>({...item,html:ppWishlistCustomerActivityRowHTML(item)}));
  const alertEvents=ppWishlistAlertActivityEvents(products).map(item=>({...item,html:ppWishlistAlertActivityRowHTML(item)}));
  const seen=new Set();

  return [...customerEvents,...alertEvents]
    .filter(x=>Number.isFinite(x.stamp))
    .sort((a,b)=>b.stamp-a.stamp)
    .filter(x=>{
      const key=`${x.kind}|${x.product?.id||''}|${Math.round(x.stamp/1000)}|${x.headline||''}`;
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
}
let ppWishlistFilter='all';

// V73.3: New Updates = genuine PricePulse/admin verification activity.
// One recent admin verification session is counted once per saved product,
// so customer wishlist add/remove actions and multiple retailer rows cannot
// inflate the New Updates counter.
function ppWishlistAdminActivities(products){
  const cutoff=Date.now()-24*60*60*1000;
  const now=Date.now();
  const activities=[];

  for(const product of products){
    const productId=String(product.id||'');
    const history=[...(window.PRICEPULSE_PRICE_HISTORY?.[productId]||[])]
      .map(row=>({...row,stamp:Date.parse(row.checkedAt||'')||0}))
      .filter(row=>row.stamp>=cutoff && row.stamp<=now+600000 && PP_APPROVED_SOURCES.has(row.source))
      .sort((a,b)=>a.stamp-b.stamp);
    if(!history.length)continue;

    // Build verification sessions using the same one-hour window used by
    // PricePulse history. The latest session becomes this product's one update.
    const sessions=[];
    let session=[];
    let sessionStart=0;
    let lastStamp=0;
    for(const row of history){
      if(!session.length || (row.stamp-lastStamp<=45*60*1000 && row.stamp-sessionStart<=60*60*1000)){
        if(!session.length)sessionStart=row.stamp;
        session.push(row);
      }else{
        sessions.push(session);
        session=[row];
        sessionStart=row.stamp;
      }
      lastStamp=row.stamp;
    }
    if(session.length)sessions.push(session);

    const latestSession=sessions.at(-1)||[];
    const latestStamp=Math.max(...latestSession.map(r=>r.stamp));
    const previousRows=history.filter(r=>r.stamp<Math.min(...latestSession.map(x=>x.stamp)));
    activities.push({productId,product,rows:latestSession,previousRows,stamp:latestStamp,checkedAt:new Date(latestStamp).toISOString()});
  }

  return activities.sort((a,b)=>b.stamp-a.stamp);
}
function ppWishlistActivityRowHTML(item){
  const {product,rows,previousRows}=item;
  let icon='↻',tone='neutral',headline='Prices re-verified';
  let detail=rows.length===1
    ? `${rows[0].retailer} verified at ${money(Number(rows[0].price))}`
    : `${rows.length} retailer prices verified`;

  const changes=[];
  let newRetailer=null;
  for(const row of rows){
    const older=[...previousRows].reverse().find(x=>x.retailer===row.retailer);
    if(!older){newRetailer=newRetailer||row;continue;}
    const oldPrice=Number(older.price),price=Number(row.price);
    const oldAvail=String(older.availability||''),avail=String(row.availability||'');
    if(oldAvail==='out_of_stock' && avail==='in_stock'){
      changes.push({priority:4,icon:'✓',tone:'positive',headline:'Back in stock',detail:`${row.retailer} is available again`});
    }else if(oldAvail==='in_stock' && avail==='out_of_stock'){
      changes.push({priority:4,icon:'!',tone:'warning',headline:'Out of stock',detail:`${row.retailer} availability updated`});
    }else if(Number.isFinite(oldPrice)&&oldPrice>0&&Number.isFinite(price)&&price>0&&Math.round(oldPrice)!==Math.round(price)){
      const diff=Math.round(Math.abs(price-oldPrice));
      changes.push(price<oldPrice
        ? {priority:3,icon:'↓',tone:'drop',headline:`Price dropped ${money(diff)}`,detail:`${row.retailer}: ${money(oldPrice)} → ${money(price)}`}
        : {priority:3,icon:'↑',tone:'increase',headline:`Price increased ${money(diff)}`,detail:`${row.retailer}: ${money(oldPrice)} → ${money(price)}`});
    }
  }
  if(changes.length){
    changes.sort((a,b)=>b.priority-a.priority);
    ({icon,tone,headline,detail}=changes[0]);
  }else if(newRetailer){
    icon='＋';tone='update';headline='New retailer verified';
    detail=`${newRetailer.retailer} verified at ${money(Number(newRetailer.price))}`;
  }

  return `<div class="pp-wish-admin-activity is-${escapeHTML(tone)}">
    <span class="pp-wish-admin-icon" aria-hidden="true">${escapeHTML(icon)}</span>
    <div class="pp-wish-admin-copy"><strong>${escapeHTML(product.name)}</strong><span>${escapeHTML(headline)} · ${escapeHTML(detail)}</span></div>
    <time datetime="${escapeHTML(item.checkedAt||'')}">${escapeHTML(ppRelativeTime(item.checkedAt))}</time>
  </div>`;
}
function wishlistPanelHTML(){
  const products=[...saved].map(getWishlistProduct).filter(Boolean);
  const statuses=products.map(p=>[p,ppWishlistStatus(p.id)]);
  const drops=statuses.filter(([,s])=>s.dropAmount>0).length;
  const dealStatuses=statuses.filter(([p])=>ppWishlistDealAlertInfo(p.id)?.state?.tone==='triggered');
  const deals=dealStatuses.length;
  const updateStatuses=statuses.filter(([,s])=>s.isNewUpdate);
  const updates=updateStatuses.length;
  const newest=statuses.map(([,s])=>s.state.checkedAt).filter(Boolean).sort().at(-1)||'';

  if(!products.length){
    ppWishlistFilter='all';
    return `<div class="pp-wishlist-fly-head"><div><div class="pp-wishlist-title-row"><h2>My Wishlist</h2><span>0 products</span></div><p>Track saved products for verified price updates.</p></div><button class="pp-wishlist-x" data-wishlist-action="close" aria-label="Close wishlist">×</button></div><div class="pp-wishlist-empty-v72"><div>♡</div><h3>Your wishlist is empty</h3><p>Tap the heart on any product and it will appear here for tracking.</p><button class="pp-wish-browse" data-wishlist-action="browse">Browse Deals →</button></div>`;
  }

  if(ppWishlistFilter==='drops'&&!drops)ppWishlistFilter='all';
  if(ppWishlistFilter==='deals'&&!deals)ppWishlistFilter='all';
  if(ppWishlistFilter==='updates'&&!updates)ppWishlistFilter='all';

  const filteredStatuses=ppWishlistFilter==='drops'
    ? statuses.filter(([,s])=>s.dropAmount>0)
    : ppWishlistFilter==='deals'
      ? dealStatuses
      : ppWishlistFilter==='updates'
        ? updateStatuses
        : statuses;

  const mainContent=filteredStatuses.map(([p,s])=>ppWishlistCardHTML(p,s,ppWishlistFilter)).join('');

  return `<div class="pp-wishlist-fly-head"><div><div class="pp-wishlist-title-row"><h2>My Wishlist</h2><span>${products.length} ${products.length===1?'product':'products'}</span></div><p>Track your saved products for the best deals and latest updates.</p></div><button class="pp-wishlist-x" data-wishlist-action="close" aria-label="Close wishlist">×</button></div>
    <div class="pp-wishlist-summary">
      <button type="button" class="pp-wish-summary-stat pp-wish-summary-filter ${ppWishlistFilter==='all'?'is-active':''}" data-wishlist-action="filter" data-filter="all" aria-pressed="${ppWishlistFilter==='all'}"><b class="is-all">♥</b><span>All</span></button>
      <button type="button" class="pp-wish-summary-stat pp-wish-summary-filter ${ppWishlistFilter==='drops'?'is-active':''}" data-wishlist-action="filter" data-filter="drops" aria-pressed="${ppWishlistFilter==='drops'}" ${drops?'':'disabled'}><b class="is-drop">↓ ${drops}</b><span>Price Drops</span></button>
      <button type="button" class="pp-wish-summary-stat pp-wish-summary-filter ${ppWishlistFilter==='deals'?'is-active':''}" data-wishlist-action="filter" data-filter="deals" aria-pressed="${ppWishlistFilter==='deals'}" ${deals?'':'disabled'}><b class="is-deal"><svg class="pp-wish-deal-bell" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"></path><path d="M10 19h4"></path></svg><span>${deals}</span></b><span>Deals</span></button>
      <button type="button" class="pp-wish-summary-stat pp-wish-summary-filter ${ppWishlistFilter==='updates'?'is-active':''}" data-wishlist-action="filter" data-filter="updates" aria-pressed="${ppWishlistFilter==='updates'}" ${updates?'':'disabled'}><b class="is-update">↗ ${updates}</b><span>New Updates</span></button>
      <div class="pp-wish-last"><b>◷</b><span>Last Checked<strong>${escapeHTML(ppRelativeTime(newest))}</strong></span></div>
      <button class="pp-wish-refresh" data-wishlist-action="refresh">↻&nbsp; Check for Updates</button>
    </div>
    <div class="pp-wishlist-track-list">${mainContent}</div>
    <div class="pp-wishlist-foot"><button data-wishlist-action="clear">♲&nbsp; Clear All</button><span>Verified prices refresh from PricePulse checks.</span></div>`;
}
let wishlistOverlay=null;
function ensureWishlistOverlay(){
  if(wishlistOverlay)return wishlistOverlay;
  wishlistOverlay=document.createElement('div');
  wishlistOverlay.id='wishlistOverlay';
  wishlistOverlay.className='pp-wishlist-overlay';
  wishlistOverlay.hidden=true;
  wishlistOverlay.innerHTML='<button class="pp-wishlist-scrim" data-wishlist-action="close" aria-label="Close wishlist"></button><section class="pp-wishlist-flyout" role="dialog" aria-modal="true" aria-label="My Wishlist"><div id="wishlistPanelBody"></div></section>';
  document.body.appendChild(wishlistOverlay);
  return wishlistOverlay;
}
function ppWishlistIsOpen(){return Boolean(wishlistOverlay&&!wishlistOverlay.hidden);}
function ppPositionWishlistPanel(){
  if(!wishlistOverlay||wishlistOverlay.hidden)return;
  const header=document.querySelector('.site-header');
  const wishlistButton=document.querySelector('#wishlistTop');
  const bottom=Math.max(0,Math.round(header?.getBoundingClientRect().bottom||0));
  wishlistOverlay.style.setProperty('--pp-wishlist-top',`${bottom+12}px`);
  wishlistOverlay.style.setProperty('--pp-wishlist-scrim-top',`${bottom}px`);
  if(window.innerWidth>760&&wishlistButton){
    const r=wishlistButton.getBoundingClientRect();
    const right=Math.max(16,Math.round(window.innerWidth-r.right));
    wishlistOverlay.style.setProperty('--pp-wishlist-right',`${right}px`);
  }else{
    wishlistOverlay.style.removeProperty('--pp-wishlist-right');
  }
}
function ppFitWishlistThreeCards(){
  if(window.innerWidth<=760)return;
  const list=wishlistOverlay?.querySelector('.pp-wishlist-track-list');
  if(!list||list.classList.contains('is-updates'))return;
  const cards=[...list.children].filter(el=>el.classList.contains('pp-wish-track-card')).slice(0,3);
  if(!cards.length)return;
  const styles=getComputedStyle(list);
  const gap=parseFloat(styles.rowGap||styles.gap||'0')||0;
  const height=Math.ceil(cards.reduce((sum,card)=>sum+card.getBoundingClientRect().height,0)+gap*Math.max(0,cards.length-1)+4);
  list.style.setProperty('--pp-wishlist-three-height',`${height}px`);
}
function ppRenderWishlistPanel(){
  ppCloseWishlistDealAlertPopover();
  const overlay=ensureWishlistOverlay();
  const body=$('#wishlistPanelBody',overlay);
  if(body)body.innerHTML=wishlistPanelHTML();
  requestAnimationFrame(()=>requestAnimationFrame(ppFitWishlistThreeCards));
}
function ppAcknowledgeWishlistUpdates(){
  for(const id of saved){
    const existing=ppFillWishlistBaselineIfMissing(id)||{};
    const state=ppWishlistProductState(id);
    ppSetWishlistMetaEntry(id,{...existing,
      lastSeenPrice:Number.isFinite(state.bestPrice)?state.bestPrice:null,
      lastSeenStore:state.bestStore||'',
      lastSeenAvailability:state.availability||'unknown',
      lastSeenVerifiedCount:Number(state.verifiedCount||0),
      lastSeenInStockCount:Number(state.inStockCount||0),
      lastSeenAt:state.checkedAt||new Date().toISOString()
    });
  }
}
function openWishlistPanel(){
  closeDealAlertsPanel({silent:true});
  closeCategoriesMenu();
  const overlay=ensureWishlistOverlay();
  for(const id of saved)ppFillWishlistBaselineIfMissing(id);
  ppRenderWishlistPanel();
  overlay.hidden=false;
  document.body.classList.add('pp-wishlist-open');
  $('#wishlistTop')?.classList.add('is-active');
  $('#wishlistTop')?.setAttribute('aria-expanded','true');
  requestAnimationFrame(ppPositionWishlistPanel);
  if(window.PP_PRICE_PILOT_ENABLED===true && (!ppLivePricesReady||!ppHistoryReady)){
    void Promise.all([ppPreloadLivePrices(false),ppPreloadHistory(false)]).then(()=>{if(ppWishlistIsOpen())ppRenderWishlistPanel();});
  }
}
function closeWishlistPanel({acknowledge=true}={}){
  if(!wishlistOverlay||wishlistOverlay.hidden)return;
  ppCloseWishlistDealAlertPopover();
  if(acknowledge)ppAcknowledgeWishlistUpdates();
  wishlistOverlay.hidden=true;
  ppWishlistFilter='all';
  document.body.classList.remove('pp-wishlist-open');
  $('#wishlistTop')?.classList.remove('is-active');
  $('#wishlistTop')?.setAttribute('aria-expanded','false');
}
function toggleWishlistPanel(){ppWishlistIsOpen()?closeWishlistPanel():openWishlistPanel();}
$('#wishlistTop')?.setAttribute('aria-expanded','false');
$('#wishlistTop')?.addEventListener('click',e=>{
  e.preventDefault();
  if(!currentUser || !profileComplete(currentProfile)){
    setPendingAuthAction({type:"wishlist-open"});
    if(currentUser) renderProfileForm(currentUser.email||"",currentProfile);
    else renderAuthStart();
    return;
  }
  toggleWishlistPanel();
});
window.addEventListener('resize',()=>{ppPositionWishlistPanel();requestAnimationFrame(ppFitWishlistThreeCards);});
window.addEventListener('scroll',ppPositionWishlistPanel,{passive:true});
document.querySelector('.site-header')?.addEventListener('click',e=>{
  if(!ppWishlistIsOpen()||e.target.closest('#wishlistTop'))return;
  closeWishlistPanel();
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ppWishlistIsOpen())closeWishlistPanel();});

document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-wishlist-action]');
  if(!b)return;
  const action=b.dataset.wishlistAction;
  if(action==='close'){closeWishlistPanel();return;}
  if(action==='browse'){closeWishlistPanel();go('#deals');return;}
  if(action==='filter'){
    const filter=String(b.dataset.filter||'');
    if(!['all','drops','deals','updates'].includes(filter))return;
    ppWishlistFilter=filter==='all'?'all':(ppWishlistFilter===filter?'all':filter);
    if(ppWishlistFilter==='updates')ppMarkWishlistUpdatesRead();
    ppRenderWishlistPanel();
    return;
  }
  if(action==='refresh'){
    b.disabled=true;b.textContent='Checking…';
    await Promise.all([ppPreloadLivePrices(true),ppPreloadHistory(true)]);
    for(const id of saved)ppFillWishlistBaselineIfMissing(id);
    ppRenderWishlistPanel();
    showToast('Wishlist prices updated');
    return;
  }
  if(action==='clear'){
    for(const id of [...saved]){
      const h=$(`.heart[data-id="${CSS.escape(String(id))}"]`);
      if(h)await toggleWishlistItem(h);
    }
    ppRenderWishlistPanel();
    return;
  }
  if(action==='remove'){
    const id=String(b.dataset.id||'');
    const h=$(`.heart[data-id="${CSS.escape(id)}"]`);
    if(h)await toggleWishlistItem(h);
    ppRenderWishlistPanel();
    return;
  }
  if(action==='set-alert'){
    const id=String(b.dataset.id||'');
    if(!id)return;
    await ppOpenWishlistDealAlertPopover(id,b);
    return;
  }
  if(action==='view-deal'){
    const id=String(b.dataset.id||'');
    const product=getWishlistProduct(id);
    if(!product)return;
    ppCloseWishlistDealAlertPopover();
    closeWishlistPanel();
    openModal(comparisonModalHTML(product.name,product.data));
    if(window.PP_PRICE_PILOT_ENABLED===true)void ppFetchLivePrices(id);
    return;
  }
  if(action==='compare'){
    const id=String(b.dataset.id||'');
    const product=getWishlistProduct(id);
    if(!product)return;
    closeWishlistPanel();
    const live=window.PP_PRICE_PILOT_ENABLED===true&&Boolean(id);
    if(live)window.PRICEPULSE_APPROVED_PRICES=window.PRICEPULSE_APPROVED_PRICES||{};
    openModal(comparisonModalHTML(product.name,product.data));
    if(live)void ppFetchLivePrices(id);
  }
});

/* ---------- Authentication ---------- */
function setPendingAuthAction(action){
  try{
    if(action) sessionStorage.setItem(AUTH_PENDING_ACTION_KEY,JSON.stringify(action));
    else sessionStorage.removeItem(AUTH_PENDING_ACTION_KEY);
  }catch(_){}
}

function takePendingAuthAction(){
  try{
    const raw=sessionStorage.getItem(AUTH_PENDING_ACTION_KEY);
    sessionStorage.removeItem(AUTH_PENDING_ACTION_KEY);
    return raw?JSON.parse(raw):null;
  }catch(_){
    try{sessionStorage.removeItem(AUTH_PENDING_ACTION_KEY);}catch(__){}
    return null;
  }
}

async function continuePendingAuthAction(){
  if(!currentUser || !profileComplete(currentProfile)) return;
  const action=takePendingAuthAction();
  if(!action?.type) return;
  if(action.type==="wishlist-toggle" && action.id){
    const btn=document.querySelector(`.heart[data-id="${CSS.escape(String(action.id))}"]`);
    if(btn) await toggleWishlistItem(btn);
    return;
  }
  if(action.type==="wishlist-open"){
    openWishlistPanel();
    return;
  }
  if(action.type==="deal-alerts-open"){
    await renderDealAlertsDashboard();
    return;
  }
  if(action.type==="plus-open"){
    renderPlusPanel();
  }
}

/* PricePulse Plus membership UI state. The protected Supabase table is optional in this build;
   when it is not installed, a local pending claim is retained only for visual continuity. */
let ppPlusMembership={status:'available',claimed_at:null,activated_at:null,expires_at:null};
let ppPlusMaster={mode:'individual',activated_at:null,expires_at:null};
const PP_PLUS_MASTER_KEY='pp-plus-master-v1';
try{window.name='pricepulse-main'}catch(_){}
function ppPlusLocalKey(){return currentUser?.id?`pp-plus-membership-v2:${currentUser.id}`:''}
function ppNormalizePlusStatus(value){const v=String(value||'available').toLowerCase();return ['available','pending','active','expired'].includes(v)?v:'available'}
function ppNormalizePlusMaster(value){const v=String(value||'individual').toLowerCase();return ['active','inactive','individual'].includes(v)?v:'individual'}
function ppIndividualPlusExpired(){
  if(ppNormalizePlusStatus(ppPlusMembership.status)!=='active')return false;
  const exp=ppPlusMembership.expires_at?new Date(ppPlusMembership.expires_at).getTime():0;
  return Boolean(exp&&exp<=Date.now());
}
function ppMasterIsActive(){
  if(ppNormalizePlusMaster(ppPlusMaster.mode)!=='active')return false;
  const exp=ppPlusMaster.expires_at?new Date(ppPlusMaster.expires_at).getTime():0;
  return !exp||exp>Date.now();
}
function ppPlusIsActive(){
  const master=ppNormalizePlusMaster(ppPlusMaster.mode);
  if(master==='inactive')return false;
  if(master==='active')return ppMasterIsActive();
  if(ppNormalizePlusStatus(ppPlusMembership.status)!=='active')return false;
  const exp=ppPlusMembership.expires_at?new Date(ppPlusMembership.expires_at).getTime():0;
  return !exp||exp>Date.now();
}
function ppReadLocalPlus(){
  const key=ppPlusLocalKey();if(!key)return null;
  try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch(_){return null}
}
function ppWriteLocalPlus(value){
  const key=ppPlusLocalKey();if(!key)return;
  try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}
}
function ppReadLocalPlusMaster(){try{const raw=localStorage.getItem(PP_PLUS_MASTER_KEY);return raw?JSON.parse(raw):null}catch(_){return null}}
function ppWriteLocalPlusMaster(value){try{localStorage.setItem(PP_PLUS_MASTER_KEY,JSON.stringify(value))}catch(_){}}
function ppReadPlusMasterAdminTestTransfer(){
  try{
    const p=new URLSearchParams(location.search);const mode=ppNormalizePlusMaster(p.get('pp_plus_master'));
    if(!p.has('pp_plus_master')||!['active','inactive','individual'].includes(mode))return null;
    const record={mode,activated_at:p.get('pp_plus_master_activated')||null,expires_at:p.get('pp_plus_master_expires')||null};
    ['pp_plus_master','pp_plus_master_activated','pp_plus_master_expires'].forEach(k=>p.delete(k));
    const clean=`${location.pathname}${p.toString()?`?${p.toString()}`:''}${location.hash||''}`;try{history.replaceState(history.state,'',clean)}catch(_){}
    return record;
  }catch(_){return null}
}
async function ppLoadPlusMasterControl(){
  ppPlusMaster={mode:'individual',activated_at:null,expires_at:null};let loaded=false;
  if(supabaseClient&&currentUser){
    try{
      const q=await supabaseClient.rpc('pp_get_plus_master_control');
      if(!q.error&&q.data){const row=Array.isArray(q.data)?q.data[0]:q.data;if(row){ppPlusMaster={...ppPlusMaster,...row,mode:ppNormalizePlusMaster(row.mode)};loaded=true}}
      else if(q.error&&!ppBackendTableMissing(q.error,'pp_plus_master_control'))console.warn('PricePulse Plus master load failed',q.error);
    }catch(err){console.warn('PricePulse Plus master load failed',err)}
  }
  if(!loaded){const transferred=ppReadPlusMasterAdminTestTransfer();if(transferred){ppPlusMaster={...ppPlusMaster,...transferred,mode:ppNormalizePlusMaster(transferred.mode)};ppWriteLocalPlusMaster(ppPlusMaster);loaded=true}}
  if(!loaded){const local=ppReadLocalPlusMaster();if(local)ppPlusMaster={...ppPlusMaster,...local,mode:ppNormalizePlusMaster(local.mode)}}
  // A finished Master-Activate window returns control to each user's individual membership.
  // It must never become a permanent global OFF state automatically.
  if(ppPlusMaster.mode==='active'&&!ppMasterIsActive()){ppPlusMaster={...ppPlusMaster,mode:'individual',activated_at:null,expires_at:null};ppWriteLocalPlusMaster(ppPlusMaster)}
  return ppPlusMaster;
}
// V78.8.132: receive manual Admin Plus test state when running directly from file://.
// Browsers may isolate localStorage per local HTML file, so the Admin page hands the state
// to index.html once via URL parameters; index.html stores it in its own local state and cleans the URL.
function ppReadPlusAdminTestTransfer(){
  try{
    const p=new URLSearchParams(location.search);
    const state=ppNormalizePlusStatus(p.get('pp_plus_test'));
    const uid=String(p.get('pp_plus_uid')||'').trim();
    if(!uid||uid!==String(currentUser?.id||'')||!['active','pending','expired'].includes(state))return null;
    const record={
      status:state,
      claimed_at:p.get('pp_plus_claimed')||new Date().toISOString(),
      activated_at:p.get('pp_plus_activated')||null,
      expires_at:p.get('pp_plus_expires')||null
    };
    ['pp_plus_test','pp_plus_uid','pp_plus_claimed','pp_plus_activated','pp_plus_expires'].forEach(k=>p.delete(k));
    const clean=`${location.pathname}${p.toString()?`?${p.toString()}`:''}${location.hash||''}`;
    try{history.replaceState(history.state,'',clean)}catch(_){}
    return record;
  }catch(_){return null}
}
async function ppLoadPlusMembership(){
  ppPlusMembership={status:'available',claimed_at:null,activated_at:null,expires_at:null};
  ppPlusMaster={mode:'individual',activated_at:null,expires_at:null};
  if(!currentUser)return ppPlusMembership;

  // V78.8.142 — always reconcile against the authenticated Supabase user before
  // reading membership. This prevents an old local/test state from winning after
  // the production backend has been installed.
  let authUser=currentUser;
  if(supabaseClient){
    try{
      const fresh=await supabaseClient.auth.getUser();
      if(!fresh?.error&&fresh?.data?.user){
        authUser=fresh.data.user;
        currentUser=fresh.data.user;
      }
    }catch(err){console.warn('PricePulse Plus auth refresh failed',err)}
  }

  await ppLoadPlusMasterControl();
  let loaded=false;
  let backendAvailable=false;
  if(supabaseClient&&authUser?.id){
    try{
      // V78.8.143 — production reads use an auth.uid()-scoped SECURITY DEFINER RPC.
      // This avoids browser-side table permission/RLS edge cases while still making
      // it impossible for a customer to request another user's Plus membership.
      const own=await supabaseClient.rpc('pp_get_my_plus_membership');
      if(!own.error){
        backendAvailable=true;
        loaded=true;
        const row=Array.isArray(own.data)?own.data[0]:own.data;
        if(row)ppPlusMembership={...ppPlusMembership,...row,status:ppNormalizePlusStatus(row.status)};
        try{const key=ppPlusLocalKey();if(key)localStorage.removeItem(key)}catch(_){}
      }else{
        // Backward-compatible fallback for installations that have not yet run the
        // tiny V143 RPC patch. A successful direct read remains authoritative.
        const q=await supabaseClient.from('pp_plus_memberships')
          .select('status,claimed_at,activated_at,expires_at')
          .eq('user_id',authUser.id)
          .maybeSingle();
        if(!q.error){
          backendAvailable=true;
          loaded=true;
          if(q.data)ppPlusMembership={...ppPlusMembership,...q.data,status:ppNormalizePlusStatus(q.data.status)};
          try{const key=ppPlusLocalKey();if(key)localStorage.removeItem(key)}catch(_){}
        }else if(!ppBackendTableMissing(q.error,'pp_plus_memberships')){
          backendAvailable=true;
          console.warn('PricePulse Plus load failed',q.error);
        }
      }
    }catch(err){console.warn('PricePulse Plus load failed',err)}
  }

  // URL/local test transfer is now strictly a fallback for builds where the
  // production Plus table is not available. It can never override DB state.
  if(!backendAvailable&&!loaded){
    const transferred=ppReadPlusAdminTestTransfer();
    if(transferred){
      ppPlusMembership={...ppPlusMembership,...transferred,status:ppNormalizePlusStatus(transferred.status)};
      ppWriteLocalPlus(ppPlusMembership);
      loaded=true;
    }
  }
  if(!backendAvailable&&!loaded){
    const local=ppReadLocalPlus();
    if(local)ppPlusMembership={...ppPlusMembership,...local,status:ppNormalizePlusStatus(local.status)};
  }

  // Expired is based ONLY on the selected user's own expires_at. Master OFF is only
  // a temporary global override and must not mutate an individual active record.
  if(ppIndividualPlusExpired()){
    ppPlusMembership.status='expired';
    if(!backendAvailable&&!loaded)ppWriteLocalPlus(ppPlusMembership);
  }
  return ppPlusMembership;
}

let ppPlusBackendRefreshBusy=false;
async function ppRefreshPlusFromBackend(){
  if(ppPlusBackendRefreshBusy||!currentUser||!supabaseClient)return;
  ppPlusBackendRefreshBusy=true;
  try{
    await ppLoadPlusMembership();
    ppSyncPlusUI();
  }finally{ppPlusBackendRefreshBusy=false}
}
window.addEventListener('focus',()=>{ppRefreshPlusFromBackend()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ppRefreshPlusFromBackend()});
async function ppClaimPlusMembership(){
  if(!currentUser||!profileComplete(currentProfile)){
    setPendingAuthAction({type:'plus-open'});
    if(currentUser)renderProfileForm(currentUser.email||'',currentProfile);else renderAuthStart();
    return false;
  }
  if(ppNormalizePlusStatus(ppPlusMembership.status)!=='available')return true;
  const claimed={status:'pending',claimed_at:new Date().toISOString(),activated_at:null,expires_at:null};
  let saved=false;
  if(supabaseClient){
    try{
      const q=await supabaseClient.from('pp_plus_memberships').upsert({user_id:currentUser.id,...claimed},{onConflict:'user_id'}).select('status,claimed_at,activated_at,expires_at').maybeSingle();
      if(!q.error){ppPlusMembership={...ppPlusMembership,...(q.data||claimed)};saved=true}
      else if(!ppBackendTableMissing(q.error,'pp_plus_memberships')){showToast(q.error.message||'Could not activate PricePulse Plus');return false}
    }catch(err){console.warn('PricePulse Plus claim failed',err)}
  }
  if(!saved){ppPlusMembership={...ppPlusMembership,...claimed};ppWriteLocalPlus(ppPlusMembership)}
  updateAccountHeader();
  if(accountPopover&&!accountPopover.hidden)accountPopover.innerHTML=accountPopoverHTML();
  return true;
}
function ppFormatPlusDate(value){
  if(!value)return '';
  try{return new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}catch(_){return ''}
}
function ppSyncPlusUI(){
  updateAccountHeader();
  if(accountPopover&&!accountPopover.hidden)accountPopover.innerHTML=accountPopoverHTML();
  if(modal&&!modal.hidden&&modal.classList.contains('pp-plus-modal-active'))renderPlusPanel();
}
window.addEventListener('storage',e=>{
  if(e.key===PP_PLUS_MASTER_KEY){const master=ppReadLocalPlusMaster();if(master){ppPlusMaster={...ppPlusMaster,...master,mode:ppNormalizePlusMaster(master.mode)};ppSyncPlusUI()}return}
  const key=ppPlusLocalKey();
  if(!currentUser||!key||e.key!==key)return;
  const local=ppReadLocalPlus();
  if(!local)return;
  ppPlusMembership={...ppPlusMembership,...local,status:ppNormalizePlusStatus(local.status)};
  if(ppIndividualPlusExpired())ppPlusMembership.status='expired';
  ppSyncPlusUI();
});

/* Future account-only features can reuse the same pending-action auth flow. */
function profileComplete(profile){
  return Boolean(profile?.full_name && profile?.mobile && profile?.city && profile?.state && profile?.country && profile?.pin_code);
}

function updateAccountHeader(){
  const label=$("#signInBtn span:last-child");
  if(!label) return;
  /* Logged-out/incomplete accounts keep Sign In. Completed profiles get a friendly first-name greeting. */
  const accountButton=$("#signInBtn");
  const authenticated=Boolean(currentUser && profileComplete(currentProfile));
  accountButton?.classList.toggle("is-authenticated",authenticated);
  if(authenticated){
    const firstName=String(currentProfile.full_name||"").trim().split(/\s+/)[0]||"Account";
    label.textContent=`Hi, ${firstName}${ppPlusIsActive()?' ⭐':''}`;
    accountButton?.classList.toggle('is-plus-active',ppPlusIsActive());
  }else{
    label.textContent="Sign In";
    accountButton?.classList.remove('is-plus-active');
  }
}

async function loadProfile(userId){
  if(!supabaseClient || !userId) return null;
  const {data,error}=await supabaseClient
    .from("profiles")
    .select("id,full_name,email,mobile,city,state,country,pin_code,deal_alerts")
    .eq("id",userId)
    .maybeSingle();
  if(error){
    console.error("Profile load failed",error);
    return null;
  }
  return data||null;
}

function authFrame(inner){
  return `
    <div class="auth-shell">
      <div class="auth-heading">
        <img class="auth-brand-logo" src="logo-icon.png" alt="PricePulse logo">
        <div><h2>Welcome to PricePulse</h2><p>Save wishlists, comparisons and future price alerts.</p></div>
      </div>
      ${inner}
    </div>`;
}

function setAuthStatus(message,isError=false){
  const el=$("#authStatus");
  if(!el) return;
  el.textContent=message||"";
  el.classList.toggle("error",Boolean(isError));
}

function setBusy(button,busy,busyText="Please wait…"){
  if(!button) return;
  if(!button.dataset.originalText) button.dataset.originalText=button.textContent;
  button.disabled=busy;
  button.textContent=busy?busyText:button.dataset.originalText;
}

function clearOtpResendTimer(){
  if(otpResendTimer){
    clearInterval(otpResendTimer);
    otpResendTimer=null;
  }
}

async function sendEmailOtp(email,shouldCreateUser=true){
  return supabaseClient.auth.signInWithOtp({
    email,
    options:{shouldCreateUser:Boolean(shouldCreateUser)}
  });
}

function startOtpResendCooldown(email,seconds=60){
  clearOtpResendTimer();
  const btn=$("#resendOtpBtn");
  if(!btn) return;
  let remaining=seconds;
  const paint=()=>{
    if(!$("#resendOtpBtn")) return clearOtpResendTimer();
    if(remaining>0){
      btn.disabled=true;
      btn.textContent=`Resend OTP in ${remaining}s`;
    }else{
      btn.disabled=false;
      btn.textContent="Resend OTP";
      clearOtpResendTimer();
    }
  };
  paint();
  otpResendTimer=setInterval(()=>{remaining-=1;paint();},1000);
}

function oauthErrorFromUrl(){
  const search=new URLSearchParams(window.location.search);
  const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
  return search.get("error_description")||search.get("error")||hash.get("error_description")||hash.get("error")||"";
}

function cleanOAuthUrl(){
  if(window.location.search || window.location.hash){
    history.replaceState({},document.title,window.location.pathname||"/");
  }
}

function renderAuthStart(prefill=""){
  clearOtpResendTimer();
  openModal(authFrame(`
    <div class="auth-step-copy auth-start-copy"><h3>Continue to PricePulse</h3><p>Sign in or create your account to save wishlists, comparisons and future price alerts.</p></div>
    <button class="auth-google" id="googleAuthBtn" type="button"><span class="google-mark" aria-hidden="true"><svg viewBox="0 0 18 18" focusable="false"><path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.703-1.568 2.684-3.88 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.91-2.258c-.806.54-1.835.86-3.046.86-2.344 0-4.328-1.584-5.037-3.712H.956v2.332A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.963 10.71A5.42 5.42 0 0 1 3.681 9c0-.593.102-1.17.282-1.71V4.958H.956A9 9 0 0 0 0 9c0 1.45.347 2.82.956 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.579c1.322 0 2.508.454 3.442 1.346l2.582-2.582C13.464.891 11.426 0 9 0A9 9 0 0 0 .956 4.958l3.007 2.332C4.672 5.162 6.656 3.579 9 3.579z"/></svg></span><span>Continue with Google</span></button>
    <div class="auth-divider"><span>or</span></div>
    <form class="auth-form" id="otpRequestForm">
      <label class="auth-field"><span>Email address</span><input id="authEmail" type="email" autocomplete="email" placeholder="Enter your email address" value="${escapeHTML(prefill)}" required></label>
      <button class="auth-primary" id="sendOtpBtn" type="submit">Continue</button>
    </form>
    <p class="auth-fineprint">Existing accounts sign in automatically. New customers complete a short profile after verification.</p>
    <p class="auth-fineprint">By continuing, you agree to the PricePulse Terms and Privacy notice.</p>
    <p class="auth-status" id="authStatus" aria-live="polite"></p>`));

  $("#googleAuthBtn")?.addEventListener("click",async()=>{
    if(!supabaseClient){setAuthStatus("Sign-in service could not load. Refresh and try again.",true);return;}
    const btn=$("#googleAuthBtn");
    btn.disabled=true;
    setAuthStatus("Opening Google…");
    sessionStorage.setItem(OAUTH_PENDING_KEY,"1");
    const {error}=await supabaseClient.auth.signInWithOAuth({
      provider:"google",
      options:{
        redirectTo:"https://price-pulse.in",
        queryParams:{prompt:"select_account"}
      }
    });
    if(error){
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      btn.disabled=false;
      setAuthStatus(error.message||"Could not open Google.",true);
    }
  });

  $("#otpRequestForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!supabaseClient){setAuthStatus("Sign-in service could not load. Refresh and try again.",true);return;}
    const email=$("#authEmail")?.value.trim();
    const btn=$("#sendOtpBtn");
    if(!email) return;
    setAuthStatus("");
    setBusy(btn,true,"Sending OTP…");
    const {error}=await sendEmailOtp(email,true);
    if(error){
      setBusy(btn,false);
      setAuthStatus(error.message||"Could not send OTP.",true);
      return;
    }
    renderOtpStep(email);
    showToast("OTP sent to your email");
  });
}
function renderOtpStep(email){
  clearOtpResendTimer();
  openModal(authFrame(`
    <button class="auth-back" id="authBackBtn" type="button">← Back</button>
    <div class="auth-step-copy"><h3>Enter email OTP</h3><p>We sent a 6-digit code to <strong>${escapeHTML(email)}</strong>.</p></div>
    <form class="auth-form" id="otpVerifyForm">
      <label class="auth-field"><span>6-digit OTP</span><input id="authOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required></label>
      <button class="auth-primary" id="verifyOtpBtn" type="submit">Verify & Continue →</button>
    </form>
    <div class="otp-resend-row"><span>Didn't receive the code?</span><button class="auth-resend" id="resendOtpBtn" type="button">Resend OTP</button></div>
    <p class="auth-fineprint">Enter the code from your email to continue.</p>
    <p class="auth-status" id="authStatus" aria-live="polite"></p>`));

  $("#authBackBtn")?.addEventListener("click",()=>renderAuthStart(email));
  $("#resendOtpBtn")?.addEventListener("click",async()=>{
    if(!supabaseClient){setAuthStatus("Sign-in service could not load. Refresh and try again.",true);return;}
    const btn=$("#resendOtpBtn");
    if(!btn || btn.disabled) return;
    btn.disabled=true;
    btn.textContent="Sending…";
    setAuthStatus("");
    const {error}=await sendEmailOtp(email,true);
    if(error){
      btn.disabled=false;
      btn.textContent="Resend OTP";
      setAuthStatus(error.message||"Could not resend OTP.",true);
      return;
    }
    setAuthStatus("A new 6-digit OTP was sent.");
    showToast("New OTP sent");
    startOtpResendCooldown(email,60);
  });
  startOtpResendCooldown(email,60);
  $("#otpVerifyForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const token=$("#authOtp")?.value.trim();
    const btn=$("#verifyOtpBtn");
    if(!/^\d{6}$/.test(token||"")){
      setAuthStatus("Enter the 6-digit code from your email.",true);
      return;
    }
    setAuthStatus("");
    setBusy(btn,true,"Verifying…");
    const {data,error}=await supabaseClient.auth.verifyOtp({email,token,type:"email"});
    if(error){
      setBusy(btn,false);
      setAuthStatus(error.message||"Invalid or expired OTP.",true);
      return;
    }
    currentUser=data?.user||data?.session?.user||null;
    currentProfile=currentUser?await loadProfile(currentUser.id):null;
    if(currentUser&&profileComplete(currentProfile))await ppAttachPendingReferral();
    updateAccountHeader();
    if(currentUser) await syncWishlistForUser(currentUser);
    if(currentProfile && profileComplete(currentProfile)){
      closeModal();
      showToast("Signed in successfully");
      await continuePendingAuthAction();
    }else{
      renderProfileForm(currentUser?.email||email,currentProfile);
    }
  });
}

const INDIA_STATES=[
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"
];

function stateOptions(selected=""){
  return `<option value="">Select State / UT</option>`+INDIA_STATES.map(name=>`<option value="${escapeHTML(name)}"${name===selected?" selected":""}>${escapeHTML(name)}</option>`).join("");
}

function countryOptions(selected=""){
  const countries=["India"];
  return `<option value="">Select Country</option>`+countries.map(name=>`<option value="${escapeHTML(name)}"${name===selected?" selected":""}>${escapeHTML(name)}</option>`).join("");
}

function localMobile(value=""){
  const digits=String(value).replace(/\D/g,"");
  return digits.length>=10?digits.slice(-10):digits;
}

function renderProfileForm(email,existing=null){
  const p=existing||{};
  openModal(authFrame(`
    <div class="auth-step-copy"><h3>Complete your profile</h3><p>First-time setup for saved products and future price alerts.</p></div>
    <form class="profile-form" id="profileForm" autocomplete="on">
      <div class="profile-grid">
        <label class="auth-field profile-wide" for="profileFullName"><span>Full Name</span><input id="profileFullName" name="fullName" type="text" autocomplete="section-profile name" autocapitalize="words" spellcheck="false" value="${escapeHTML(p.full_name||"")}" placeholder="Your full name" required></label>
        <label class="auth-field profile-wide"><span>Email</span><input id="profileEmail" name="email" type="email" autocomplete="section-profile email" value="${escapeHTML(email)}" readonly></label>
        <label class="auth-field"><span>Mobile Number</span><div class="phone-field"><span class="phone-prefix">+91</span><input id="profileMobile" name="mobileLocal" type="tel" inputmode="numeric" autocomplete="section-profile tel-national" maxlength="10" pattern="[6-9][0-9]{9}" placeholder="Enter mobile number" value="${escapeHTML(localMobile(p.mobile||""))}" required></div></label>
        <label class="auth-field"><span>City</span><input id="profileCity" name="city" autocomplete="section-profile address-level2" value="${escapeHTML(p.city||"")}" placeholder="City" required></label>
        <label class="auth-field"><span>State / UT</span><select id="profileState" name="state" autocomplete="section-profile address-level1" required>${stateOptions(p.state||"")}</select></label>
        <label class="auth-field"><span>Country</span><select id="profileCountry" name="country" autocomplete="section-profile country-name" required>${countryOptions(p.country||"")}</select></label>
        <label class="auth-field profile-wide"><span>PIN Code</span><input id="profileZip" name="zip" inputmode="numeric" autocomplete="section-profile postal-code" maxlength="6" pattern="[1-9][0-9]{5}" placeholder="Enter PIN code" value="${escapeHTML(p.pin_code||"")}" required></label>
      </div>
      <label class="consent-row"><input name="alerts" type="checkbox" ${p.deal_alerts?"checked":""}><span>Send me optional price-drop and deal alerts.</span></label>
      <button class="auth-primary" id="saveProfileBtn" type="submit">Save Profile</button>
      <p class="auth-fineprint">Your profile is linked to your secure PricePulse account.</p>
      <p class="auth-status" id="authStatus" aria-live="polite"></p>
    </form>`),true);

  $("#profileForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    if(!form.reportValidity()) return;
    const fd=new FormData(form);
    const mobileLocal=String(fd.get("mobileLocal")||"").replace(/\D/g,"");
    const pin=String(fd.get("zip")||"").trim();
    if(!/^[6-9]\d{9}$/.test(mobileLocal)){
      setAuthStatus("Enter a valid 10-digit Indian mobile number.",true);
      return;
    }
    if(!/^[1-9]\d{5}$/.test(pin)){
      setAuthStatus("Enter a valid 6-digit PIN code.",true);
      return;
    }
    const profile={
      id:currentUser?.id,
      full_name:String(fd.get("fullName")||"").trim(),
      email:currentUser?.email||email,
      mobile:`+91${mobileLocal}`,
      city:String(fd.get("city")||"").trim(),
      state:String(fd.get("state")||"").trim(),
      country:String(fd.get("country")||"").trim(),
      pin_code:pin,
      deal_alerts:fd.get("alerts")==="on",
      updated_at:new Date().toISOString()
    };
    if(!profile.id){setAuthStatus("Please sign in again.",true);return;}
    const btn=$("#saveProfileBtn");
    setBusy(btn,true,"Saving…");
    setAuthStatus("");
    const {data,error}=await supabaseClient.from("profiles").upsert(profile,{onConflict:"id"}).select().single();
    if(error){
      setBusy(btn,false);
      setAuthStatus(error.message||"Profile could not be saved.",true);
      console.error(error);
      return;
    }
    currentProfile=data||profile;
    await ppAttachPendingReferral();
    updateAccountHeader();
    closeModal();
    showToast("Profile saved successfully");
    await continuePendingAuthAction();
  });
}

function renderAccountPanel(){
  if(!currentUser){renderAuthStart();return;}
  if(!profileComplete(currentProfile)){renderProfileForm(currentUser.email||"",currentProfile);return;}
  const p=currentProfile;
  openModal(`
    <div class="account-panel">
      <img class="account-logo" src="logo-icon.png" alt="PricePulse logo">
      <h2>${escapeHTML(p.full_name)}</h2>
      <p>${escapeHTML(p.email||currentUser.email||"")}</p>
      <div class="account-details">
        <div><span>Mobile</span><strong>${escapeHTML(p.mobile)}</strong></div>
        <div><span>Location</span><strong>${escapeHTML([p.city,p.state,p.country].filter(Boolean).join(", "))}</strong></div>
        <div><span>PIN Code</span><strong>${escapeHTML(p.pin_code)}</strong></div>
        <div><span>Deal alerts</span><strong>${p.deal_alerts?"On":"Off"}</strong></div>
      </div>
      <div class="account-actions"><button class="auth-primary" id="editProfileBtn" type="button">Edit Profile</button><button class="auth-secondary" id="signOutBtn" type="button">Sign Out</button></div>
    </div>`);
  $("#editProfileBtn")?.addEventListener("click",()=>renderProfileForm(p.email||currentUser.email||"",p));
  $("#signOutBtn")?.addEventListener("click",async()=>{
    const btn=$("#signOutBtn");
    setBusy(btn,true,"Signing out…");
    const {error}=await supabaseClient.auth.signOut();
    if(error){setBusy(btn,false);showToast(error.message||"Could not sign out");return;}
    currentUser=null;
    currentProfile=null;
    ppPlusMembership={status:'available',claimed_at:null,activated_at:null,expires_at:null};
    updateAccountHeader();
    activateGuestWishlist();
    closeModal();
    showToast("Signed out");
  });
}

/* =====================================================================
   PricePulse V75 — Premium signed-in account popover
   V73.5 Wishlist and V74.1 Auth remain locked/unchanged.
   ===================================================================== */
let accountPopover=null;

const accountMenuIcon=(type)=>{
  const icons={
    profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.6-4 3-6 6.5-6s5.9 2 6.5 6"></path></svg>',
    wishlist:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 10.6 19C5.5 14.4 2.5 11.5 2.5 7.8A5.3 5.3 0 0 1 12 4.5a5.3 5.3 0 0 1 9.5 3.3c0 3.7-3 6.6-8.1 11.2L12 20.3Z"></path></svg>',
    alerts:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"></path><path d="M10 20h4"></path></svg>',
    wallet:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h12"></path><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"></path><path d="M6 8h9"></path></svg>',
    subscription:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.2l5-.7L12 3Z"></path></svg>',
    preferences:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.6V21H10v-.1A1.8 1.8 0 0 0 8.9 19a1.8 1.8 0 0 0-2 .4l-.1.1L4 16.7l.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3 13.5H3v-3h.1a1.8 1.8 0 0 0 1.4-1.1 1.8 1.8 0 0 0-.4-2L4 7.3l2.8-2.8.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 10 3.5V3h4v.5a1.8 1.8 0 0 0 1.1 1.5 1.8 1.8 0 0 0 2-.4l.1-.1L20 7.3l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.5 1.1h.1v3H21a1.8 1.8 0 0 0-1.6 1.5Z"></path></svg>',
    help:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9.8 9a2.4 2.4 0 0 1 4.7.8c0 1.8-2.5 2.1-2.5 4"></path><path d="M12 17.5h.01"></path></svg>',
    signout:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5"></path><path d="M14 8l4 4-4 4"></path><path d="M18 12H9"></path></svg>'
  };
  return icons[type]||'';
};

function ensureAccountPopover(){
  if(accountPopover) return accountPopover;
  accountPopover=document.createElement('section');
  accountPopover.id='accountPopover';
  accountPopover.className='pp-account-popover';
  accountPopover.hidden=true;
  accountPopover.setAttribute('role','dialog');
  accountPopover.setAttribute('aria-label','Account menu');
  document.body.appendChild(accountPopover);
  return accountPopover;
}

function accountPopoverHTML(){
  const p=currentProfile||{};
  const email=p.email||currentUser?.email||'';
  const activeAlerts=ppActiveDealAlertCount();
  const unreadAlerts=ppUnreadDealAlertCount();
  const alertSummary=activeAlerts?`${activeAlerts} active ${activeAlerts===1?'alert':'alerts'}`:'Track target prices from Wishlist';
  return `
    <div class="pp-account-summary">
      <span class="signin-icon pp-account-summary-icon" aria-hidden="true"></span>
      <div class="pp-account-identity">
        <strong>${escapeHTML(p.full_name||'My Account')}</strong>
        <span>${escapeHTML(email)}</span>
        ${ppPlusIsActive()?`<small class="pp-plus-account-status"><i class="pp-plus-status-star">★</i>PricePulse Plus</small>`:`<small><i></i>Account active</small>`}
      </div>
    </div>
    <div class="pp-account-menu" role="menu">
      <button type="button" class="pp-account-row is-highlighted" data-account-action="profile" role="menuitem">
        <span class="pp-account-row-icon">${accountMenuIcon('profile')}</span>
        <span class="pp-account-row-copy"><strong>My Profile</strong><small>View &amp; update your details</small></span><b>›</b>
      </button>
      <button type="button" class="pp-account-row" data-account-action="wishlist" role="menuitem">
        <span class="pp-account-row-icon is-heart">${accountMenuIcon('wishlist')}</span>
        <span class="pp-account-row-copy"><strong>My Wishlist</strong><small>Saved products &amp; price updates</small></span><b>›</b>
      </button>
      <button type="button" class="pp-account-row pp-account-wallet-row" data-account-action="wallet" role="menuitem">
        <span class="pp-account-row-icon is-wallet">${accountMenuIcon('wallet')}</span>
        <span class="pp-account-row-copy"><strong>Wallet</strong><small>Rewards, referrals &amp; redemptions</small></span><b>›</b>
      </button>
      <button type="button" class="pp-account-row pp-account-alert-row" data-account-action="alerts" role="menuitem">
        <span class="pp-account-row-icon">${accountMenuIcon('alerts')}</span>
        <span class="pp-account-row-copy"><strong>Deal Alerts</strong><small>${escapeHTML(alertSummary)}</small></span>
        <span class="pp-account-notify-badge" ${unreadAlerts?'':'hidden'}>${unreadAlerts}</span><b>›</b>
      </button>
      <button type="button" class="pp-account-row pp-account-subscription-row" data-account-action="plus" role="menuitem">
        <span class="pp-account-row-icon is-subscription">${accountMenuIcon('subscription')}</span>
        <span class="pp-account-row-copy"><strong class="pp-plus-brand"><span>PricePulse</span> <em>Plus</em></strong><small>${ppPlusIsActive()?'Premium membership active':ppNormalizePlusMaster(ppPlusMaster.mode)==='inactive'?'Temporarily paused by system':ppNormalizePlusStatus(ppPlusMembership.status)==='pending'?'₹99/year • membership setup pending':ppNormalizePlusStatus(ppPlusMembership.status)==='expired'?'Membership period completed':'₹99/year • savings membership'}</small></span><b>›</b>
      </button>
      <button type="button" class="pp-account-row" data-account-action="preferences" role="menuitem">
        <span class="pp-account-row-icon">${accountMenuIcon('preferences')}</span>
        <span class="pp-account-row-copy"><strong>Preferences</strong><small>Language, notifications &amp; more</small></span><b>›</b>
      </button>
      <div class="pp-account-divider"></div>
      <button type="button" class="pp-account-row" data-account-action="help" role="menuitem">
        <span class="pp-account-row-icon">${accountMenuIcon('help')}</span>
        <span class="pp-account-row-copy"><strong>Help &amp; Support</strong><small>FAQ &amp; customer support</small></span><b>›</b>
      </button>
    </div>
    <button type="button" class="pp-account-signout" data-account-action="signout">${accountMenuIcon('signout')}<span>Sign Out</span></button>`;
}

function positionAccountPopover(){
  if(!accountPopover || accountPopover.hidden) return;
  const button=document.querySelector('#signInBtn');
  if(!button) return;
  const r=button.getBoundingClientRect();
  accountPopover.style.setProperty('--pp-account-top',`${Math.round(r.bottom+10)}px`);
  accountPopover.style.setProperty('--pp-account-right',`${Math.max(12,Math.round(window.innerWidth-r.right))}px`);
}

function closeAccountPopover(){
  if(!accountPopover || accountPopover.hidden) return;
  accountPopover.hidden=true;
  document.querySelector('#signInBtn')?.classList.remove('is-account-open');
  document.querySelector('#signInBtn')?.setAttribute('aria-expanded','false');
}

function openAccountPopover(){
  if(!currentUser || !profileComplete(currentProfile)) return;
  if(typeof closeWishlistPanel==='function') closeWishlistPanel();
  const panel=ensureAccountPopover();
  panel.innerHTML=accountPopoverHTML();
  panel.hidden=false;
  document.querySelector('#signInBtn')?.classList.add('is-account-open');
  document.querySelector('#signInBtn')?.setAttribute('aria-expanded','true');
  positionAccountPopover();
}

function toggleAccountPopover(){
  const panel=ensureAccountPopover();
  if(panel.hidden) openAccountPopover();
  else closeAccountPopover();
}

async function signOutFromAccountPopover(button){
  if(!supabaseClient) return;
  setBusy(button,true,'Signing out…');
  const {error}=await supabaseClient.auth.signOut();
  if(error){setBusy(button,false);showToast(error.message||'Could not sign out');return;}
  currentUser=null;
  currentProfile=null;
  ppResetDealAlertsState();
  closeAccountPopover();
  updateAccountHeader();
  activateGuestWishlist();
  showToast('Signed out');
}


/* =====================================================================
   PricePulse V75.4 — Wishlist-connected Deal Alerts
   Real Supabase alerts when the table exists, with a temporary local preview
   fallback so the final Wishlist UX can be tested before the SQL is run.
   ===================================================================== */
const DEAL_ALERTS_TABLE='pp_deal_alerts';
const DEAL_ALERT_FREE_LIMIT=1;
const DEAL_ALERT_PLUS_LIMIT=3;
function ppDealAlertLimit(){return ppPlusIsActive()?DEAL_ALERT_PLUS_LIMIT:DEAL_ALERT_FREE_LIMIT}
function ppDealAlertAtLimit(){return ppActiveDealAlertCount()>=ppDealAlertLimit()}
function ppDealAlertLimitLabel(){return ppPlusIsActive()?`${DEAL_ALERT_PLUS_LIMIT} active Deal Alerts`:`${DEAL_ALERT_FREE_LIMIT} active Deal Alert`}
function ppDealAlertLimitUpsell(){
  if(ppPlusIsActive()){showToast(`You've reached your ${DEAL_ALERT_PLUS_LIMIT} active Deal Alerts limit.`);return}
  ppCloseWishlistDealAlertPopover();
  closeDealAlertsPanel({silent:true});
  renderPlusPanel();
  showToast('Free includes 1 active Deal Alert. Upgrade to Plus for Deal Alerts+.');
}

let ppDealAlerts=[];
let ppDealAlertsReady=false;
let ppDealAlertsError=null;
let ppDealAlertsFilter='active';
let ppDealAlertsOverlay=null;
let ppDealRemovePendingId=null;
let ppDealNewThisOpen=new Set();

function ppDealReadKey(userId=currentUser?.id){return `pp_deal_trigger_read_v1_${userId||'guest'}`}
function ppReadDealReadSignatures(userId=currentUser?.id){
  try{return new Set(JSON.parse(localStorage.getItem(ppDealReadKey(userId))||'[]')||[])}catch{return new Set()}
}
function ppWriteDealReadSignatures(set,userId=currentUser?.id){
  try{localStorage.setItem(ppDealReadKey(userId),JSON.stringify([...set]))}catch{}
}
function ppDealAlertTriggerStamp(alert){
  return alert?.triggered_at||alert?.last_checked_at||alert?.updated_at||'';
}
function ppDealAlertTriggerSignature(alert){
  if(!alert||ppDealAlertStatus(alert).tone!=='triggered')return '';
  const natural=alert.triggered_at||'';
  if(natural)return `${alert.id||alert.product_id}|${natural}`;
  return `${alert.id||alert.product_id}|live|${Number(alert.target_price)||0}`;
}
function ppUnreadDealAlertSignatures(){
  const read=ppReadDealReadSignatures();
  return ppDealAlerts.map(ppDealAlertTriggerSignature).filter(Boolean).filter(sig=>!read.has(sig));
}
function ppUnreadDealAlertCount(){return ppUnreadDealAlertSignatures().length}
function ppMarkCurrentTriggeredDealsRead(){
  const read=ppReadDealReadSignatures();
  ppDealAlerts.map(ppDealAlertTriggerSignature).filter(Boolean).forEach(sig=>read.add(sig));
  ppWriteDealReadSignatures(read);
}
function ppUpdateDealHeader(){
  const count=ppDealAlerts.length;
  const unread=ppUnreadDealAlertCount();
  const button=document.querySelector('#dealTop');
  const badge=document.querySelector('#dealCount');
  const unreadBadge=document.querySelector('#dealUnreadBadge');
  if(badge)badge.textContent=String(count);
  if(unreadBadge){unreadBadge.textContent=String(unread);unreadBadge.hidden=unread<1}
  button?.classList.toggle('has-items',count>0);
  button?.classList.toggle('has-unread',unread>0);
  const accountBadge=document.querySelector('#accountPopover .pp-account-notify-badge');
  if(accountBadge){accountBadge.textContent=String(unread);accountBadge.hidden=unread<1}
}

function ppResetDealAlertsState(){
  ppDealAlerts=[];
  ppDealAlertsReady=false;
  ppDealAlertsError=null;
  ppDealAlertsFilter='active';
  ppDealRemovePendingId=null;
  ppCloseWishlistDealAlertPopover();
  ppUpdateDealHeader();
  closeDealAlertsPanel({silent:true});
}
function ppFindDealAlertForProduct(productId){
  const id=String(productId||'');
  return ppDealAlerts.find(a=>String(a.product_id)===id)||null;
}
function ppActiveDealAlertCount(){return ppDealAlerts.filter(a=>ppDealAlertStatus(a).tone==='watching').length}
function ppDealAlertsLocalKey(userId=currentUser?.id){return `pp_deal_alerts_preview_v1_${userId||'guest'}`}
function ppReadLocalDealAlerts(userId=currentUser?.id){
  try{return JSON.parse(localStorage.getItem(ppDealAlertsLocalKey(userId))||'[]')||[]}catch{return []}
}
function ppWriteLocalDealAlerts(rows,userId=currentUser?.id){
  try{localStorage.setItem(ppDealAlertsLocalKey(userId),JSON.stringify(rows||[]))}catch{}
}
function ppIsDealAlertsTableMissing(error){return Boolean(error&&(error.code==='PGRST205'||/pp_deal_alerts|schema cache|could not find the table/i.test(String(error.message||''))))}
function ppNormalizeDealAlertRows(rows){return (rows||[]).map(row=>({...row,target_price:Number(row.target_price),last_seen_price:row.last_seen_price==null?null:Number(row.last_seen_price),triggered_price:row.triggered_price==null?null:Number(row.triggered_price)}))}
async function ppLoadDealAlertsForUser(user=currentUser){
  if(!user||!supabaseClient){ppResetDealAlertsState();return []}
  const {data,error}=await supabaseClient
    .from(DEAL_ALERTS_TABLE)
    .select('id,user_id,product_id,product_name,product_image,target_price,retailer_scope,status,last_seen_price,last_seen_retailer,last_checked_at,triggered_price,triggered_retailer,triggered_at,email_to,created_at,updated_at')
    .eq('user_id',user.id)
    .order('created_at',{ascending:false});
  if(error){
    console.warn('Deal Alerts sync unavailable',error);
    if(ppIsDealAlertsTableMissing(error)){
      ppDealAlerts=ppNormalizeDealAlertRows(ppReadLocalDealAlerts(user.id));
      ppDealAlertsReady=true;
      ppDealAlertsError=error;
      ppUpdateDealHeader();
      return ppDealAlerts;
    }
    ppDealAlerts=[];ppDealAlertsReady=false;ppDealAlertsError=error;ppUpdateDealHeader();return [];
  }
  let rows=ppNormalizeDealAlertRows(data||[]);
  const local=ppReadLocalDealAlerts(user.id);
  if(local.length){
    const payloads=local.map(({id,...row})=>({...row,user_id:user.id}));
    const migration=await supabaseClient.from(DEAL_ALERTS_TABLE).upsert(payloads,{onConflict:'user_id,product_id'});
    if(!migration.error){
      ppWriteLocalDealAlerts([],user.id);
      const reread=await supabaseClient.from(DEAL_ALERTS_TABLE).select('id,user_id,product_id,product_name,product_image,target_price,retailer_scope,status,last_seen_price,last_seen_retailer,last_checked_at,triggered_price,triggered_retailer,triggered_at,email_to,created_at,updated_at').eq('user_id',user.id).order('created_at',{ascending:false});
      if(!reread.error)rows=ppNormalizeDealAlertRows(reread.data||[]);
    }
  }
  ppDealAlerts=rows;ppDealAlertsReady=true;ppDealAlertsError=null;ppUpdateDealHeader();return ppDealAlerts;
}
async function ppSaveDealAlertPayload(payload){
  const existing=ppFindDealAlertForProduct(payload.product_id);
  if(!existing&&ppDealAlertAtLimit()){
    const limit=ppDealAlertLimit();
    const error=new Error(ppPlusIsActive()?`You've reached your ${limit} active Deal Alerts limit.`:'Free includes 1 active Deal Alert. PricePulse Plus unlocks Deal Alerts+.');
    error.code='PP_DEAL_ALERT_LIMIT';
    return {error};
  }
  const createdAt=existing?.created_at||new Date().toISOString();
  if(!supabaseClient||!currentUser)return {error:new Error('Sign in required')};
  const {error}=await supabaseClient.from(DEAL_ALERTS_TABLE).upsert(payload,{onConflict:'user_id,product_id'});
  if(!error){await ppLoadDealAlertsForUser(currentUser);return {error:null,preview:false}}
  if(!ppIsDealAlertsTableMissing(error))return {error};
  const rows=ppReadLocalDealAlerts(currentUser.id);
  const index=rows.findIndex(a=>String(a.product_id)===String(payload.product_id));
  const localRow={...payload,id:existing?.id||`preview-${Date.now()}`,created_at:createdAt,updated_at:new Date().toISOString()};
  if(index>=0)rows[index]=localRow;else rows.unshift(localRow);
  ppWriteLocalDealAlerts(rows,currentUser.id);
  ppDealAlerts=ppNormalizeDealAlertRows(rows);
  ppDealAlertsReady=true;ppDealAlertsError=error;
  ppUpdateDealHeader();
  return {error:null,preview:true};
}
async function ppRemoveDealAlert(alert){
  if(!alert||!currentUser)return {error:new Error('Alert unavailable')};
  if(String(alert.id||'').startsWith('preview-')||ppDealAlertsError&&ppIsDealAlertsTableMissing(ppDealAlertsError)){
    const rows=ppReadLocalDealAlerts(currentUser.id).filter(a=>String(a.product_id)!==String(alert.product_id));
    ppWriteLocalDealAlerts(rows,currentUser.id);ppDealAlerts=ppNormalizeDealAlertRows(rows);ppUpdateDealHeader();return {error:null,preview:true};
  }
  const result=await supabaseClient.from(DEAL_ALERTS_TABLE).delete().eq('id',alert.id).eq('user_id',currentUser.id);
  if(!result.error)await ppLoadDealAlertsForUser(currentUser);
  return {error:result.error||null,preview:false};
}
function ppDealAlertProduct(productId,alert=null){
  const product=getWishlistProduct(productId);
  if(product)return product;
  if(!alert)return null;
  const fallbackImage=alert.product_image||'';
  return {id:String(alert.product_id),name:alert.product_name||'Saved product',image:fallbackImage,imageState:ppImageItem(fallbackImage,{bg:'soft',fit:'contain',position:'center',scale:'100'}),brandLogo:'',brandAlt:'',facts:[],data:{}};
}
function ppDealAlertOffers(productId){
  const product=getWishlistProduct(productId);
  if(!product)return [];
  return ppComparisonOfferLinks(product.data,productId).filter(o=>o.price!=null&&o.availability!=='out_of_stock');
}
function ppDealAlertCurrentState(alert){
  const offers=ppDealAlertOffers(alert.product_id);
  const scoped=alert.retailer_scope&&alert.retailer_scope!=='any'?offers.filter(o=>o.name===alert.retailer_scope):offers;
  if(!scoped.length)return {price:null,retailer:alert.last_seen_retailer||'',offers};
  const lowest=Math.min(...scoped.map(o=>o.price));
  const selected=scoped.find(o=>o.price===lowest)||scoped[0];
  return {price:lowest,retailer:selected?.name||'',offers};
}
function ppDealAlertStatus(alert){
  if(alert.status==='triggered')return {label:'Target reached',tone:'triggered'};
  if(alert.status==='paused')return {label:'Paused',tone:'paused'};
  const current=ppDealAlertCurrentState(alert);
  if(Number.isFinite(current.price)&&current.price<=Number(alert.target_price))return {label:'Target reached',tone:'triggered'};
  return {label:'Watching',tone:'watching'};
}
function ppDealAlertStoreLabel(scope){return !scope||scope==='any'?'Any verified store':scope}
function ppDealAlertsVisible(){
  if(ppDealAlertsFilter==='all')return ppDealAlerts;
  if(ppDealAlertsFilter==='active')return ppDealAlerts.filter(a=>ppDealAlertStatus(a).tone==='watching');
  if(ppDealAlertsFilter==='triggered')return ppDealAlerts.filter(a=>ppDealAlertStatus(a).tone==='triggered');
  return ppDealAlerts;
}
function ppDealAlertRetailersHTML(alert,product,current){
  const scopedStore=alert.retailer_scope&&alert.retailer_scope!=='any'?alert.retailer_scope:'';
  let state=product?.data?ppRetailerStripState(product.data,alert.product_id):{offers:[],ordered:[],bestOffers:[],uniqueLowest:null,isTie:false};
  let ordered=state.ordered||[];
  let uniqueLowest=state.uniqueLowest||null;
  let tieNames=new Set(state.isTie?(state.bestOffers||[]).map(o=>o.name):[]);
  if(scopedStore){
    ordered=ordered.filter(o=>o.name===scopedStore);
    uniqueLowest=null;
    tieNames=new Set();
  }
  if(!ordered.length&&current?.retailer){
    ordered=[{name:current.retailer}];
    uniqueLowest=null;
    tieNames=new Set();
  }
  const seen=new Set();
  const offers=ordered.filter(o=>o?.name&&!seen.has(o.name)&&(seen.add(o.name),true));
  if(!offers.length){
    return `<span class="pp-da-store-fallback">${escapeHTML(ppDealAlertStoreLabel(alert.retailer_scope))}</span>`;
  }
  const visible=offers.slice(0,3).map(o=>{
    const isLowest=Boolean(uniqueLowest&&o.name===uniqueLowest.name);
    const isTied=tieNames.has(o.name);
    const cls=isLowest?' is-lowest':isTied?' is-tied':'';
    const status=isLowest?'<em class="pp-retailer-status">Lowest</em>':isTied?'<em class="pp-retailer-status">Tie</em>':'';
    return `<span class="pp-retailer-chip${cls}" title="${escapeHTML(o.name)}">${retailerLogo(o.name)}${status}</span>`;
  }).join('');
  return `<div class="pp-da-retailers" aria-label="Tracked retailers">${visible}${offers.length>3?`<small>+${offers.length-3}</small>`:''}</div>`;
}
function ppDealAlertCategoryLabel(productId){
  const heart=$(`.heart[data-id="${CSS.escape(String(productId))}"]`);
  const category=heart?.closest('.deal-card')?.dataset.category||'';
  const labels={mobiles:'Smartphones',laptops:'Laptops',electronics:'Audio & Electronics',home:'Home & Kitchen',fashion:'Fashion',appliances:'Kitchen Appliances',beauty:'Beauty & Skincare',watches:'Audio & Wearables'};
  return labels[category]||'';
}
function ppDealActionIcon(type){
  if(type==='edit')return `<svg class="pp-da-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path></svg>`;
  if(type==='remove')return `<svg class="pp-da-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="m6 7 1 13h10l1-13"></path><path d="M10 11v5M14 11v5"></path></svg>`;
  return '';
}
function ppDealAlertCardHTML(alert){
  const product=ppDealAlertProduct(alert.product_id,alert);
  const current=ppDealAlertCurrentState(alert);
  const status=ppDealAlertStatus(alert);
  const hasLivePrice=Number.isFinite(current.price)||Number.isFinite(alert.last_seen_price);
  const currentPrice=Number.isFinite(current.price)?money(current.price):(Number.isFinite(alert.last_seen_price)?money(alert.last_seen_price):'Checking verified price…');
  const verified=Number.isFinite(current.price);
  const imageState=product?.imageState||ppImageItem(product?.image||'',{bg:'soft',fit:'contain',position:'center',scale:'100'});
  const image=product?.image?`<img class="pp-global-product-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" ${ppGlobalImageDataAttrs(imageState||{})} style="${escapeHTML(ppGlobalImageStyle(imageState||{}))}">`:'<span class="pp-da-image-fallback">↘</span>';
  const triggerSig=ppDealAlertTriggerSignature(alert);
  const triggerStamp=ppDealAlertTriggerStamp(alert);
  const isNewTrigger=Boolean(triggerSig&&ppDealNewThisOpen.has(triggerSig));
  const triggeredDetail=status.tone==='triggered'&&triggerStamp?`<small class="pp-da-trigger-meta ${isNewTrigger?'is-new':''}">${isNewTrigger?'<b>NEW</b>':''}<span>Triggered ${escapeHTML(ppRelativeTime(triggerStamp))}</span></small>`:'';
  const stores=ppDealAlertRetailersHTML(alert,product,current);
  const category=ppDealAlertCategoryLabel(alert.product_id);
  return `<article class="pp-da-card" data-alert-id="${escapeHTML(alert.id)}">
    <div class="pp-da-product-image pp-global-product-surface ${ppGlobalImageBgClass(imageState||{})}">${image}</div>
    <div class="pp-da-product-copy">
      <strong>${escapeHTML(product?.name||alert.product_name||'Product')}</strong>
      ${category?`<small class="pp-da-category">${escapeHTML(category)}</small>`:''}
      ${stores}
      <div class="pp-da-current-inline ${hasLivePrice?'':'is-pending'}"><small>Current Price</small><div class="pp-da-current-value"><strong>${currentPrice}</strong>${verified?'<b>Verified</b>':''}</div></div>
    </div>
    <div class="pp-da-target-block"><small>Your Target</small><strong>${money(Number(alert.target_price))} or below</strong></div>
    <div class="pp-da-state"><span class="is-${escapeHTML(status.tone)}"><i></i>${escapeHTML(status.label)}</span>${triggeredDetail}</div>
    <div class="pp-da-actions">${status.tone==='triggered'?`<button class="is-view" data-deal-alert-action="view" data-id="${escapeHTML(alert.id)}">View Deal</button>`:''}<button data-deal-alert-action="edit" data-id="${escapeHTML(alert.id)}">${ppDealActionIcon('edit')}<span>Edit Alert</span></button><button class="is-remove" data-deal-alert-action="remove" data-id="${escapeHTML(alert.id)}">${ppDealActionIcon('remove')}<span>Remove</span></button></div>
  </article>`;
}
function ppDealRemoveConfirmHTML(){
  if(!ppDealRemovePendingId)return '';
  const alert=ppDealAlerts.find(a=>String(a.id)===String(ppDealRemovePendingId));
  if(!alert)return '';
  return `<div class="pp-da-confirm-layer"><div class="pp-da-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="ppDealRemoveTitle"><div class="pp-da-confirm-icon">${ppDealActionIcon('remove')}</div><div><span>DEAL ALERT</span><h3 id="ppDealRemoveTitle">Remove Deal Alert?</h3><p>${escapeHTML(alert.product_name||'This product')}</p><small>This will stop tracking your target price for this product.</small></div><div class="pp-da-confirm-actions"><button data-deal-alert-action="remove-cancel">Cancel</button><button class="is-danger" data-deal-alert-action="remove-confirm" data-id="${escapeHTML(alert.id)}">${ppDealActionIcon('remove')}<span>Remove Alert</span></button></div></div></div>`;
}
function ppDealAlertsDashboardHTML(){
  const active=ppDealAlerts.filter(a=>ppDealAlertStatus(a).tone==='watching').length;
  const triggered=ppDealAlerts.filter(a=>ppDealAlertStatus(a).tone==='triggered').length;
  const visible=ppDealAlertsVisible();
  const list=visible.length?visible.map(ppDealAlertCardHTML).join(''):`<div class="pp-da-empty"><span>🔔</span><strong>${ppDealAlerts.length?'No alerts in this view':'No deal alerts yet'}</strong><p>${ppDealAlerts.length?'Choose another filter to see your saved alerts.':'Open your Wishlist and set a target price on any saved product.'}</p><button data-deal-alert-action="wishlist">Open Wishlist</button></div>`;
  const limit=ppDealAlertLimit();
  const atLimit=active>=limit;
  return `<div class="pp-alerts-shell pp-alert-dashboard" id="dealAlertsDashboard"><div class="pp-da-brand"><img src="favicon-v18.png" alt="PricePulse"><span>PricePulse</span><b>DEAL ALERTS</b><button type="button" class="pp-da-x" data-deal-alert-action="close" aria-label="Close Deal Alerts">×</button></div>
    <div class="pp-da-head"><div class="pp-da-bell">${accountMenuIcon('alerts')}</div><div><p>SMART SHOPPING</p><h2>Deal Alerts</h2><span>We watch your saved products and notify when prices reach your target.</span></div><b>${active} Active</b></div>
    <div class="pp-da-toolbar">
      <div class="pp-da-tabs">
        <button class="${ppDealAlertsFilter==='active'?'is-active':''}" data-deal-alert-action="filter" data-filter="active">Active <span>${active}</span></button>
        <button class="${ppDealAlertsFilter==='triggered'?'is-active':''}" data-deal-alert-action="filter" data-filter="triggered">Triggered <span>${triggered}</span></button>
        <button class="${ppDealAlertsFilter==='all'?'is-active':''}" data-deal-alert-action="filter" data-filter="all">All <span>${ppDealAlerts.length}</span></button>
      </div>
      <div class="pp-da-toolbar-actions"><button data-deal-alert-action="refresh">↻ Refresh</button><button class="is-primary ${atLimit?'is-limit':''}" data-deal-alert-action="wishlist" title="${atLimit?(ppPlusIsActive()?`Maximum ${limit} active Deal Alerts reached`:'Free plan includes 1 active Deal Alert'):'Add from Wishlist'}">${atLimit?(ppPlusIsActive()?`${active}/${limit} Alerts`:'⭐ Get Deal Alerts+'):'＋ Add from Wishlist'}</button></div>
    </div>
    <div class="pp-da-list">${list}</div>
    <div class="pp-da-foot"><span>${ppPlusIsActive()?'⭐ Deal Alerts+ • up to 3 active alerts':'Free plan • 1 active alert. Your second active alert unlocks with PricePulse Plus.'}</span></div>
    ${ppDealRemoveConfirmHTML()}
  </div>`;
}
function ensureDealAlertsOverlay(){
  if(ppDealAlertsOverlay)return ppDealAlertsOverlay;
  ppDealAlertsOverlay=document.createElement('div');
  ppDealAlertsOverlay.id='dealAlertsOverlay';
  ppDealAlertsOverlay.className='pp-deal-overlay';
  ppDealAlertsOverlay.hidden=true;
  ppDealAlertsOverlay.innerHTML='<button class="pp-deal-scrim" data-deal-alert-action="close" aria-label="Close Deal Alerts"></button><section class="pp-deal-flyout" role="dialog" aria-modal="true" aria-label="Deal Alerts"><div id="dealAlertsPanelBody"></div></section>';
  ppDealAlertsOverlay.addEventListener('click',ppHandleDealAlertsDashboardClick);
  document.body.appendChild(ppDealAlertsOverlay);
  return ppDealAlertsOverlay;
}
function ppDealAlertsIsOpen(){return Boolean(ppDealAlertsOverlay&&!ppDealAlertsOverlay.hidden)}
function ppPositionDealAlertsPanel(){
  if(!ppDealAlertsOverlay||ppDealAlertsOverlay.hidden)return;
  const header=document.querySelector('.site-header');
  const dealButton=document.querySelector('#dealTop');
  const bottom=Math.max(0,Math.round(header?.getBoundingClientRect().bottom||0));
  ppDealAlertsOverlay.style.setProperty('--pp-deal-top',`${bottom+12}px`);
  ppDealAlertsOverlay.style.setProperty('--pp-deal-scrim-top',`${bottom}px`);
  if(window.innerWidth>760&&dealButton){
    const r=dealButton.getBoundingClientRect();
    const right=Math.max(16,Math.round(window.innerWidth-r.right));
    ppDealAlertsOverlay.style.setProperty('--pp-deal-right',`${right}px`);
  }else{
    ppDealAlertsOverlay.style.removeProperty('--pp-deal-right');
  }
}
function ppRenderDealAlertsPanel(){
  const overlay=ensureDealAlertsOverlay();
  const body=overlay.querySelector('#dealAlertsPanelBody');
  if(body)body.innerHTML=ppDealAlertsDashboardHTML();
}
async function renderDealAlertsDashboard(filter=ppDealAlertsFilter){
  if(!currentUser){
    setPendingAuthAction({type:'deal-alerts-open'});
    renderAuthStart();
    return;
  }
  if(!profileComplete(currentProfile)){
    setPendingAuthAction({type:'deal-alerts-open'});
    renderProfileForm(currentUser.email||'',currentProfile);
    return;
  }
  closeCategoriesMenu();
  closeAccountPopover();
  closeWishlistPanel({acknowledge:false});
  const unreadBeforeOpen=ppUnreadDealAlertSignatures();
  if(unreadBeforeOpen.length&&filter==='active')filter='triggered';
  ppDealAlertsFilter=['active','triggered','all'].includes(filter)?filter:'active';
  if(!ppDealAlertsReady){
    const local=ppNormalizeDealAlertRows(ppReadLocalDealAlerts(currentUser.id));
    if(local.length){ppDealAlerts=local;ppDealAlertsReady=true;ppUpdateDealHeader()}
  }
  const overlay=ensureDealAlertsOverlay();
  const unreadNow=ppUnreadDealAlertSignatures();
  ppDealNewThisOpen=new Set(unreadNow.length?unreadNow:unreadBeforeOpen);
  ppRenderDealAlertsPanel();
  overlay.hidden=false;
  document.body.classList.add('pp-deal-open');
  if(ppDealNewThisOpen.size){ppMarkCurrentTriggeredDealsRead();ppUpdateDealHeader()}
  document.querySelector('#dealTop')?.classList.add('is-active');
  document.querySelector('#dealTop')?.setAttribute('aria-expanded','true');
  requestAnimationFrame(ppPositionDealAlertsPanel);
  void (async()=>{
    await Promise.all([ppLoadDealAlertsForUser(currentUser),ppPreloadLivePrices(false)]);
    if(ppDealAlertsIsOpen()){
      const lateUnread=ppUnreadDealAlertSignatures();
      lateUnread.forEach(sig=>ppDealNewThisOpen.add(sig));
      if(lateUnread.length){
        if(ppDealAlertsFilter==='active')ppDealAlertsFilter='triggered';
        ppMarkCurrentTriggeredDealsRead();ppUpdateDealHeader();
      }
      ppRenderDealAlertsPanel();
    }
  })();
}
function closeDealAlertsPanel({silent=false}={}){
  if(!ppDealAlertsOverlay||ppDealAlertsOverlay.hidden){
    document.querySelector('#dealTop')?.classList.remove('is-active');
    document.querySelector('#dealTop')?.setAttribute('aria-expanded','false');
    return;
  }
  ppDealAlertsOverlay.hidden=true;
  ppDealRemovePendingId=null;
  ppDealNewThisOpen=new Set();
  document.body.classList.remove('pp-deal-open');
  document.querySelector('#dealTop')?.classList.remove('is-active');
  document.querySelector('#dealTop')?.setAttribute('aria-expanded','false');
  if(!silent)ppCloseWishlistDealAlertPopover();
}
function toggleDealAlertsPanel(){ppDealAlertsIsOpen()?closeDealAlertsPanel():void renderDealAlertsDashboard(ppDealAlertsFilter)}
async function ppHandleDealAlertsDashboardClick(e){
  const b=e.target.closest('[data-deal-alert-action]');
  if(!b)return;
  const action=b.dataset.dealAlertAction;
  if(action==='close'){
    closeDealAlertsPanel();
    return;
  }
  if(action==='filter'){
    ppDealAlertsFilter=b.dataset.filter||'active';
    ppRenderDealAlertsPanel();
    return;
  }
  if(action==='wishlist'){
    if(ppDealAlertAtLimit()){ppDealAlertLimitUpsell();return}
    closeDealAlertsPanel({silent:true});
    openWishlistPanel();
    return;
  }
  if(action==='refresh'){
    b.disabled=true;b.textContent='Refreshing…';
    await Promise.all([ppPreloadLivePrices(true),ppLoadDealAlertsForUser(currentUser)]);
    ppRenderDealAlertsPanel();
    return;
  }
  if(action==='view'){
    const alert=ppDealAlerts.find(a=>String(a.id)===String(b.dataset.id||''));
    const product=alert?getWishlistProduct(alert.product_id):null;
    if(product){
      closeDealAlertsPanel({silent:true});
      openModal(comparisonModalHTML(product.name,product.data));
      if(window.PP_PRICE_PILOT_ENABLED===true)void ppFetchLivePrices(product.id);
    }
    return;
  }
  if(action==='edit'){
    const alert=ppDealAlerts.find(a=>String(a.id)===String(b.dataset.id||''));
    if(alert){
      closeDealAlertsPanel({silent:true});
      await renderDealAlertEditor(alert.product_id,'dashboard');
    }
    return;
  }
  if(action==='remove'){
    const id=String(b.dataset.id||'');
    const alert=ppDealAlerts.find(a=>String(a.id)===id);
    if(!alert)return;
    ppDealRemovePendingId=id;
    ppRenderDealAlertsPanel();
    return;
  }
  if(action==='remove-cancel'){
    ppDealRemovePendingId=null;
    ppRenderDealAlertsPanel();
    return;
  }
  if(action==='remove-confirm'){
    const id=String(b.dataset.id||ppDealRemovePendingId||'');
    const alert=ppDealAlerts.find(a=>String(a.id)===id);
    if(!alert){ppDealRemovePendingId=null;ppRenderDealAlertsPanel();return}
    b.disabled=true;
    const original=b.innerHTML;
    b.textContent='Removing…';
    const {error}=await ppRemoveDealAlert(alert);
    if(error){showToast(error.message||'Could not remove alert');b.disabled=false;b.innerHTML=original;return}
    ppDealRemovePendingId=null;
    ppRenderDealAlertsPanel();
    showToast('Deal alert removed');
    return;
  }
}

function ppDealAlertEditorCurrentPrice(productId,scope){
  const offers=ppDealAlertOffers(productId);
  const scoped=scope&&scope!=='any'?offers.filter(o=>o.name===scope):offers;
  if(!scoped.length)return {price:null,retailer:''};
  const price=Math.min(...scoped.map(o=>o.price));
  return {price,retailer:scoped.find(o=>o.price===price)?.name||''};
}
let ppWishlistDealAlertPopover=null;
let ppWishlistDealAlertAnchor=null;
function ppEnsureWishlistDealAlertPopover(){
  if(ppWishlistDealAlertPopover)return ppWishlistDealAlertPopover;
  ppWishlistDealAlertPopover=document.createElement('div');
  ppWishlistDealAlertPopover.className='pp-wish-alert-popover';
  ppWishlistDealAlertPopover.hidden=true;
  document.body.appendChild(ppWishlistDealAlertPopover);
  return ppWishlistDealAlertPopover;
}
function ppCloseWishlistDealAlertPopover(){
  if(ppWishlistDealAlertPopover)ppWishlistDealAlertPopover.hidden=true;
  ppWishlistDealAlertAnchor=null;
}
function ppPositionWishlistDealAlertPopover(){
  if(!ppWishlistDealAlertPopover||ppWishlistDealAlertPopover.hidden||!ppWishlistDealAlertAnchor)return;
  const r=ppWishlistDealAlertAnchor.getBoundingClientRect();
  const width=Math.min(310,window.innerWidth-24);
  let left=Math.max(12,Math.min(window.innerWidth-width-12,r.right-width));
  let top=r.bottom+8;
  const estimated=330;
  if(top+estimated>window.innerHeight-12)top=Math.max(12,r.top-estimated-8);
  ppWishlistDealAlertPopover.style.width=`${width}px`;
  ppWishlistDealAlertPopover.style.left=`${Math.round(left)}px`;
  ppWishlistDealAlertPopover.style.top=`${Math.round(top)}px`;
}
async function ppOpenWishlistDealAlertPopover(productId,anchor){
  if(!currentUser){renderAuthStart();return}
  const id=String(productId||'');
  const product=getWishlistProduct(id);
  if(!product)return;
  const existing=ppFindDealAlertForProduct(id);
  if(!existing&&ppDealAlertAtLimit()){ppDealAlertLimitUpsell();return}
  const retailerNames=[...new Set(retailerOffers(product.data).map(o=>o.name).filter(Boolean))];
  const preferredScope=ppReadLocalPreferences().preferred_retailer_scope||'any';
  const selectedScope=existing?.retailer_scope||(retailerNames.includes(preferredScope)?preferredScope:'any');
  const current=ppDealAlertEditorCurrentPrice(id,selectedScope);
  const target=existing?.target_price?Math.round(Number(existing.target_price)):'';
  const storeOptions=['<option value="any">Any verified store</option>',...retailerNames.map(name=>`<option value="${escapeHTML(name)}" ${name===selectedScope?'selected':''}>${escapeHTML(name)}</option>`)].join('');
  const pop=ppEnsureWishlistDealAlertPopover();
  ppWishlistDealAlertAnchor=anchor;
  const wapImageState=product.imageState||ppImageItem(product.image,{bg:'soft',fit:'contain',position:'center',scale:'100'});
  pop.innerHTML=`<div class="pp-wap-head"><div class="pp-wap-brand"><img src="favicon-v18.png" alt="PricePulse"><div><strong>Set Deal Alert</strong><span>PricePulse</span></div></div><button type="button" data-wap-action="close" aria-label="Close">×</button></div><div class="pp-wap-product"><span class="pp-wap-product-image pp-global-product-surface ${ppGlobalImageBgClass(wapImageState||{})}"><img class="pp-global-product-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" ${ppGlobalImageDataAttrs(wapImageState||{})} style="${escapeHTML(ppGlobalImageStyle(wapImageState||{}))}"></span><div><strong>${escapeHTML(product.name)}</strong><span>${Number.isFinite(current.price)?`Current best ${money(current.price)}`:'Verified price checking'}</span></div></div><form id="wishlistDealAlertForm" data-product-id="${escapeHTML(id)}"><label><span>Alert me at or below</span><div class="pp-wap-money"><b>₹</b><input name="target" type="number" min="1" step="1" inputmode="numeric" placeholder="Target price" value="${escapeHTML(String(target))}" required></div></label><label><span>Track price on</span><select name="scope">${storeOptions}</select></label><div class="pp-wap-current"><span>Current verified price</span><strong id="wishlistDealAlertCurrent">${Number.isFinite(current.price)?money(current.price):'Checking…'}</strong><small id="wishlistDealAlertStore">${escapeHTML(current.retailer||ppDealAlertStoreLabel(selectedScope))}</small></div><div class="pp-wap-actions"><button type="button" data-wap-action="close">Cancel</button><button class="is-primary" type="submit">${existing?'Update Alert':'Set Alert'}</button></div><p id="wishlistDealAlertStatus" aria-live="polite"></p></form>`;
  pop.hidden=false;ppPositionWishlistDealAlertPopover();
  if(window.PP_PRICE_PILOT_ENABLED===true){void (async()=>{await ppFetchLivePrices(id);if(!ppWishlistDealAlertPopover||ppWishlistDealAlertPopover.hidden)return;const scopeEl=ppWishlistDealAlertPopover.querySelector('#wishlistDealAlertForm')?.elements?.scope;const now=ppDealAlertEditorCurrentPrice(id,scopeEl?.value||selectedScope);const pe=ppWishlistDealAlertPopover.querySelector('#wishlistDealAlertCurrent');const se=ppWishlistDealAlertPopover.querySelector('#wishlistDealAlertStore');if(pe)pe.textContent=Number.isFinite(now.price)?money(now.price):'Checking…';if(se)se.textContent=now.retailer||ppDealAlertStoreLabel(scopeEl?.value||selectedScope)})()}
  const form=pop.querySelector('#wishlistDealAlertForm');
  const select=form?.elements?.scope;
  select?.addEventListener('change',()=>{const now=ppDealAlertEditorCurrentPrice(id,select.value);const pe=pop.querySelector('#wishlistDealAlertCurrent');const se=pop.querySelector('#wishlistDealAlertStore');if(pe)pe.textContent=Number.isFinite(now.price)?money(now.price):'Checking…';if(se)se.textContent=now.retailer||ppDealAlertStoreLabel(select.value)});
  pop.querySelectorAll('[data-wap-action="close"]').forEach(btn=>btn.addEventListener('click',ppCloseWishlistDealAlertPopover));
  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(form);const targetPrice=Math.round(Number(fd.get('target')));const scope=String(fd.get('scope')||'any');
    const statusEl=pop.querySelector('#wishlistDealAlertStatus');const submit=form.querySelector('button[type="submit"]');
    if(!Number.isFinite(targetPrice)||targetPrice<=0){statusEl.textContent='Enter a valid target price.';statusEl.className='is-error';return}
    setBusy(submit,true,'Saving…');
    const now=ppDealAlertEditorCurrentPrice(id,scope);const reached=Number.isFinite(now.price)&&now.price<=targetPrice;
    const payload={user_id:currentUser.id,product_id:id,product_name:product.name||'Product',product_image:product.image||'',target_price:targetPrice,retailer_scope:scope,status:reached?'triggered':'active',last_seen_price:Number.isFinite(now.price)?now.price:null,last_seen_retailer:now.retailer||null,last_checked_at:new Date().toISOString(),triggered_price:reached?now.price:null,triggered_retailer:reached?(now.retailer||null):null,triggered_at:reached?new Date().toISOString():null,email_to:currentProfile?.email||currentUser?.email||null,updated_at:new Date().toISOString()};
    const result=await ppSaveDealAlertPayload(payload);setBusy(submit,false);
    if(result.error){statusEl.textContent=result.error.message||'Could not save deal alert.';statusEl.className='is-error';return}
    showToast(reached?'Target reached — deal alert saved':existing?'Deal alert updated':'Deal alert created');
    ppCloseWishlistDealAlertPopover();ppRenderWishlistPanel();
  });
}
window.addEventListener('resize',ppPositionWishlistDealAlertPopover,{passive:true});
window.addEventListener('scroll',ppPositionWishlistDealAlertPopover,{passive:true,capture:true});
document.addEventListener('click',e=>{if(!ppWishlistDealAlertPopover||ppWishlistDealAlertPopover.hidden)return;if(e.target.closest('.pp-wish-alert-popover')||e.target.closest('[data-wishlist-action="set-alert"]'))return;ppCloseWishlistDealAlertPopover()});

async function renderDealAlertEditor(productId,origin='wishlist'){
  if(!currentUser){renderAuthStart();return}
  const id=String(productId||'');
  const product=getWishlistProduct(id);
  const existing=ppFindDealAlertForProduct(id);
  if(!product&&!existing){showToast('Product details unavailable');return}
  if(!existing&&ppDealAlertAtLimit()){ppDealAlertLimitUpsell();return}
  if(window.PP_PRICE_PILOT_ENABLED===true)await ppFetchLivePrices(id);
  const p=product||ppDealAlertProduct(id,existing);
  const retailerNames=[...new Set((product?retailerOffers(product.data):[]).map(o=>o.name).filter(Boolean))];
  const preferredScope=ppReadLocalPreferences().preferred_retailer_scope||'any';
  const selectedScope=existing?.retailer_scope||(retailerNames.includes(preferredScope)?preferredScope:'any');
  const current=ppDealAlertEditorCurrentPrice(id,selectedScope);
  const target=existing?.target_price?Math.round(Number(existing.target_price)):'';
  const storeOptions=['<option value="any">Any verified store</option>',...retailerNames.map(name=>`<option value="${escapeHTML(name)}" ${name===selectedScope?'selected':''}>${escapeHTML(name)}</option>`)].join('');
  openModal(`<div class="pp-alerts-shell pp-alert-editor" id="dealAlertEditor" data-origin="${escapeHTML(origin)}" data-product-id="${escapeHTML(id)}">
    <div class="pp-dae-brand"><img src="favicon-v18.png" alt="PricePulse"><span>PricePulse</span><b>${existing?'EDIT ALERT':'NEW ALERT'}</b></div>
    <div class="pp-dae-product"><div class="pp-global-product-surface ${ppGlobalImageBgClass(p.imageState||{})}">${p.image?`<img class="pp-global-product-image" src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" ${ppGlobalImageDataAttrs(p.imageState||{})} style="${escapeHTML(ppGlobalImageStyle(p.imageState||{}))}">`:'🔔'}</div><section><small>SET DEAL ALERT</small><h2>${escapeHTML(p.name)}</h2><p>Choose the price you want. PricePulse will keep watching verified prices for this saved product.</p></section></div>
    <form id="dealAlertForm">
      <label class="pp-dae-field"><span>Alert me at or below</span><div class="pp-dae-money"><b>₹</b><input name="target" type="number" min="1" step="1" inputmode="numeric" placeholder="Enter target price" value="${escapeHTML(String(target))}" required></div></label>
      <label class="pp-dae-field"><span>Track price on</span><select name="scope">${storeOptions}</select></label>
      <div class="pp-dae-now"><span>Current verified price</span><strong id="dealAlertCurrentPrice">${Number.isFinite(current.price)?money(current.price):'Waiting for verified price'}</strong><small id="dealAlertCurrentStore">${escapeHTML(current.retailer||ppDealAlertStoreLabel(selectedScope))}</small></div>
      <div class="pp-dae-note"><i>✓</i><span>This alert is saved to your PricePulse account. The database is already prepared for future email delivery.</span></div>
      <div class="pp-dae-actions"><button type="button" data-dae-action="cancel">Cancel</button><button class="is-primary" type="submit">${existing?'Update Alert':'Create Alert'}</button></div>
      <p class="pp-dae-status" id="dealAlertEditorStatus" aria-live="polite"></p>
    </form>
  </div>`);
  const shell=document.querySelector('#dealAlertEditor');
  const form=document.querySelector('#dealAlertForm');
  const select=form?.elements?.scope;
  select?.addEventListener('change',()=>{
    const now=ppDealAlertEditorCurrentPrice(id,select.value);
    const priceEl=document.querySelector('#dealAlertCurrentPrice');
    const storeEl=document.querySelector('#dealAlertCurrentStore');
    if(priceEl)priceEl.textContent=Number.isFinite(now.price)?money(now.price):'Waiting for verified price';
    if(storeEl)storeEl.textContent=now.retailer||ppDealAlertStoreLabel(select.value);
  });
  shell?.querySelector('[data-dae-action="cancel"]')?.addEventListener('click',()=>ppCloseDealAlertEditor(origin));
  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(form);
    const targetPrice=Math.round(Number(fd.get('target')));
    const scope=String(fd.get('scope')||'any');
    const statusEl=document.querySelector('#dealAlertEditorStatus');
    const submit=form.querySelector('button[type="submit"]');
    if(!Number.isFinite(targetPrice)||targetPrice<=0){if(statusEl){statusEl.textContent='Enter a valid target price.';statusEl.classList.add('is-error')}return}
    setBusy(submit,true,'Saving…');
    const now=ppDealAlertEditorCurrentPrice(id,scope);
    const reached=Number.isFinite(now.price)&&now.price<=targetPrice;
    const payload={
      user_id:currentUser.id,
      product_id:id,
      product_name:p.name||'Product',
      product_image:p.image||'',
      target_price:targetPrice,
      retailer_scope:scope,
      status:reached?'triggered':'active',
      last_seen_price:Number.isFinite(now.price)?now.price:null,
      last_seen_retailer:now.retailer||null,
      last_checked_at:new Date().toISOString(),
      triggered_price:reached?now.price:null,
      triggered_retailer:reached?(now.retailer||null):null,
      triggered_at:reached?new Date().toISOString():null,
      email_to:currentProfile?.email||currentUser?.email||null,
      updated_at:new Date().toISOString()
    };
    const result=await ppSaveDealAlertPayload(payload);
    setBusy(submit,false);
    if(result.error){if(statusEl){statusEl.textContent=result.error.message||'Could not save deal alert.';statusEl.classList.add('is-error')}return}
    showToast(reached?'Target already reached — alert saved':'Deal alert saved');
    ppCloseDealAlertEditor(origin);
  });
}
function ppCloseDealAlertEditor(origin){
  closeModal();
  if(origin==='dashboard')void renderDealAlertsDashboard(ppDealAlertsFilter);
  else if(origin==='wishlist')openWishlistPanel();
}


/* =====================================================================
   PricePulse V76 — Preferences + Help & Support
   Existing Wishlist/Auth/Deal Alerts remain locked.
   ===================================================================== */
const PP_PREFS_STORAGE_KEY='pp_user_preferences_v76';
const PP_SUPPORT_CATEGORIES=['Price or retailer','Account or sign in','Wishlist','Deal Alerts','Technical issue','Feedback','Other'];

function ppPreferenceDefaults(){
  return {
    language:'en-IN',
    notify_deal_alerts:true,
    notify_target_reached:true,
    notify_wishlist_updates:true,
    email_important_deals:true,
    preferred_retailer_scope:'any'
  };
}
function ppPreferenceStorageKey(){return `${PP_PREFS_STORAGE_KEY}:${currentUser?.id||'guest'}`}
function ppReadLocalPreferences(){
  const base=ppPreferenceDefaults();
  try{
    const raw=localStorage.getItem(ppPreferenceStorageKey());
    return raw?{...base,...JSON.parse(raw)}:base;
  }catch(_){return base}
}
function ppWriteLocalPreferences(prefs){
  try{localStorage.setItem(ppPreferenceStorageKey(),JSON.stringify({...ppPreferenceDefaults(),...prefs}))}catch(_){ }
}
function ppBackendTableMissing(error,table){
  if(!error)return false;
  const message=String(error.message||'');
  return Boolean(
    error.code==='PGRST205'||
    error.code==='42P01'||
    /schema cache|could not find the table|relation .* does not exist/i.test(message)
  );
}
async function ppLoadPreferences(){
  const local=ppReadLocalPreferences();
  if(!supabaseClient||!currentUser?.id)return local;
  const {data,error}=await supabaseClient.from('pp_user_preferences')
    .select('user_id,language,notify_deal_alerts,notify_target_reached,notify_wishlist_updates,email_important_deals,preferred_retailer_scope')
    .eq('user_id',currentUser.id).maybeSingle();
  if(error){if(!ppBackendTableMissing(error,'pp_user_preferences'))console.warn('Preferences load failed',error);return local}
  if(!data)return local;
  const merged={...local,...data};
  ppWriteLocalPreferences(merged);
  return merged;
}
async function ppSavePreferences(prefs){
  const merged={...ppPreferenceDefaults(),...prefs};
  ppWriteLocalPreferences(merged);
  if(!supabaseClient||!currentUser?.id)return {data:merged,error:null,localOnly:true};
  const payload={
    user_id:currentUser.id,
    language:merged.language,
    notify_deal_alerts:Boolean(merged.notify_deal_alerts),
    notify_target_reached:Boolean(merged.notify_target_reached),
    notify_wishlist_updates:Boolean(merged.notify_wishlist_updates),
    email_important_deals:Boolean(merged.email_important_deals),
    preferred_retailer_scope:merged.preferred_retailer_scope||'any',
    updated_at:new Date().toISOString()
  };
  const {data,error}=await supabaseClient.from('pp_user_preferences').upsert(payload,{onConflict:'user_id'}).select().single();
  if(error&&ppBackendTableMissing(error,'pp_user_preferences'))return {data:merged,error:null,localOnly:true};
  return {data:data||merged,error,localOnly:false};
}
function ppSwitchRow(name,title,copy,checked){
  return `<label class="pp-pref-switch-row"><span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(copy)}</small></span><span class="pp-pref-switch"><input type="checkbox" name="${escapeHTML(name)}" ${checked?'checked':''}><i></i></span></label>`;
}
function ppPreferencesHTML(p){
  return `<div class="pp-preferences-shell">
    <div class="pp-ph-brand"><img src="favicon-v18.png" alt="PricePulse"><div><b>PricePulse</b><small>ACCOUNT SETTINGS</small></div></div>
    <header class="pp-ph-head"><span class="pp-ph-hero-icon">${accountMenuIcon('preferences')}</span><div><small>PREFERENCES</small><h2>Make PricePulse work your way</h2><p>Choose defaults for alerts and future notification delivery.</p></div></header>
    <form id="ppPreferencesForm">
      <section class="pp-pref-section"><div class="pp-pref-section-title"><b>Language &amp; region</b><small>Display preferences</small></div>
        <label class="pp-pref-select-row"><span><strong>Language</strong><small>More languages can be added later.</small></span><select name="language"><option value="en-IN" ${p.language==='en-IN'?'selected':''}>English (India)</option><option value="hi-IN" disabled>Hindi — coming soon</option></select></label>
      </section>
      <section class="pp-pref-section"><div class="pp-pref-section-title"><b>Notification delivery</b><small>Saved for future email / push delivery</small></div>
        ${ppSwitchRow('notify_deal_alerts','Deal Alert notifications','Notify me about important Deal Alert activity.',p.notify_deal_alerts)}
        ${ppSwitchRow('notify_target_reached','Target reached alerts','Notify me when a saved target price is reached.',p.notify_target_reached)}
        ${ppSwitchRow('notify_wishlist_updates','Wishlist price updates','Receive useful saved-product price updates.',p.notify_wishlist_updates)}
        ${ppSwitchRow('email_important_deals','Important deal emails only','Keep email focused on meaningful deal events.',p.email_important_deals)}
      </section>
      <section class="pp-pref-section"><div class="pp-pref-section-title"><b>Shopping defaults</b><small>Used when creating a new Deal Alert</small></div>
        <label class="pp-pref-select-row"><span><strong>Preferred tracking store</strong><small>Falls back to Any verified store when unavailable.</small></span><select name="preferred_retailer_scope"><option value="any">Any verified store</option>${['Amazon','Flipkart','Croma','Myntra','AJIO','Meesho'].map(x=>`<option value="${x}" ${p.preferred_retailer_scope===x?'selected':''}>${x}</option>`).join('')}</select></label>
      </section>
      <p class="pp-pref-status" id="ppPreferencesStatus" aria-live="polite"></p>
      <div class="pp-pref-actions"><button type="button" data-pp-pref="cancel">Cancel</button><button class="is-primary" type="submit">Save Preferences</button></div>
    </form>
  </div>`;
}
function ppApplyPreferencesToForm(p){
  const form=document.querySelector('#ppPreferencesForm');if(!form)return;
  for(const [key,val] of Object.entries(p||{})){
    const el=form.elements?.[key];if(!el)continue;
    if(el.type==='checkbox')el.checked=Boolean(val);else el.value=String(val??'');
  }
}
function renderPreferencesPanel(){
  const local=ppReadLocalPreferences();
  openModal(ppPreferencesHTML(local));
  document.querySelector('[data-pp-pref="cancel"]')?.addEventListener('click',closeModal);
  const form=document.querySelector('#ppPreferencesForm');
  form?.addEventListener('submit',async e=>{
    e.preventDefault();const fd=new FormData(form);const btn=form.querySelector('button[type="submit"]');const status=document.querySelector('#ppPreferencesStatus');
    const prefs={language:String(fd.get('language')||'en-IN'),notify_deal_alerts:fd.get('notify_deal_alerts')==='on',notify_target_reached:fd.get('notify_target_reached')==='on',notify_wishlist_updates:fd.get('notify_wishlist_updates')==='on',email_important_deals:fd.get('email_important_deals')==='on',preferred_retailer_scope:String(fd.get('preferred_retailer_scope')||'any')};
    setBusy(btn,true,'Saving…');const result=await ppSavePreferences(prefs);setBusy(btn,false);
    if(result.error){if(status){status.textContent=result.error.message||'Preferences could not be saved.';status.classList.add('is-error')}return}
    if(status){status.textContent=result.localOnly?'Saved on this device. Supabase sync will activate after the Preferences SQL is run.':'Preferences saved to your account.';status.classList.remove('is-error')}
    showToast('Preferences saved');
  });
  void ppLoadPreferences().then(ppApplyPreferencesToForm);
}

const PP_FAQS=[
  ['How does PricePulse compare prices?','PricePulse compares approved retailer prices for the same saved product and highlights the best verified option available in its data. Always confirm the final price and seller terms on the merchant website.'],
  ['How do Deal Alerts work?','Save a product to Wishlist, set a target price and choose a tracking store. PricePulse watches verified price checks and marks the alert Triggered when the tracked price reaches your target.'],
  ['What happens when my target price is reached?','The alert moves to Triggered, the Deal notification count can update and View Deal becomes available so you can open the merchant offer.'],
  ['How does Wishlist tracking work?','Wishlist keeps your saved products together and uses verified price history to show genuine price drops and New Updates for saved items.'],
  ['Why can a merchant price be different?','Marketplace prices, stock, seller terms and promotions can change quickly. PricePulse shows its latest verified data, but the merchant page is the final source before purchase.'],
  ['How do I remove a Deal Alert?','Open Deal Alerts, choose Remove on the alert and confirm. The alert is then removed from your account and its slot becomes available for another target.']
];
function ppSupportHTML(){
  return `<div class="pp-support-shell">
    <div class="pp-ph-brand"><img src="favicon-v18.png" alt="PricePulse"><div><b>PricePulse</b><small>SUPPORT CENTER</small></div></div>
    <header class="pp-ph-head"><span class="pp-ph-hero-icon">${accountMenuIcon('help')}</span><div><small>HELP &amp; SUPPORT</small><h2>How can we help?</h2><p>Find an answer quickly or contact PricePulse support.</p></div></header>
    <label class="pp-support-search"><span>⌕</span><input id="ppSupportSearch" type="search" placeholder="Search help topics…" autocomplete="off"></label>
    <section class="pp-support-faq"><div class="pp-pref-section-title"><b>Frequently Asked Questions</b><small>${PP_FAQS.length} help topics</small></div><div id="ppFaqList">${PP_FAQS.map((x,i)=>`<article class="pp-faq-item" data-faq-search="${escapeHTML((x[0]+' '+x[1]).toLowerCase())}"><button type="button" data-faq-index="${i}" aria-expanded="false"><span>${escapeHTML(x[0])}</span><b>+</b></button><div hidden>${escapeHTML(x[1])}</div></article>`).join('')}</div><p id="ppFaqEmpty" class="pp-faq-empty" hidden>No matching help topic found.</p></section>
    <section class="pp-support-contact"><div><small>NEED MORE HELP?</small><h3>Contact PricePulse</h3><p>${escapeHTML(SUPPORT_EMAIL)}</p></div><div class="pp-support-contact-actions"><a href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent('PricePulse Support')}" target="_blank" rel="noopener noreferrer">Email Support</a><button type="button" data-support-action="report">Report a Problem</button></div></section>
    <form id="ppSupportForm" class="pp-support-form" hidden><div class="pp-pref-section-title"><b>Report a Problem</b><small>Tell us what happened</small></div><div class="pp-support-fields"><label><span>Category</span><select name="category">${PP_SUPPORT_CATEGORIES.map(x=>`<option>${escapeHTML(x)}</option>`).join('')}</select></label><label><span>Message</span><textarea name="message" rows="4" maxlength="1500" placeholder="Describe the issue…" required></textarea></label></div><p id="ppSupportStatus" aria-live="polite"></p><div class="pp-pref-actions"><button type="button" data-support-action="cancel-report">Cancel</button><button class="is-primary" type="submit">Submit Request</button></div></form>
  </div>`;
}
function renderHelpSupportPanel(){
  openModal(ppSupportHTML(),true);
  const list=document.querySelector('#ppFaqList');
  list?.addEventListener('click',e=>{const btn=e.target.closest('[data-faq-index]');if(!btn)return;const item=btn.closest('.pp-faq-item');const answer=item?.querySelector('div');const open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));if(answer)answer.hidden=open;const mark=btn.querySelector('b');if(mark)mark.textContent=open?'+':'−'});
  document.querySelector('#ppSupportSearch')?.addEventListener('input',e=>{const q=String(e.target.value||'').trim().toLowerCase();let shown=0;document.querySelectorAll('.pp-faq-item').forEach(item=>{const ok=!q||String(item.dataset.faqSearch||'').includes(q);item.hidden=!ok;if(ok)shown++});const empty=document.querySelector('#ppFaqEmpty');if(empty)empty.hidden=shown>0});
  const form=document.querySelector('#ppSupportForm');
  document.querySelector('[data-support-action="report"]')?.addEventListener('click',()=>{if(form){form.hidden=false;form.scrollIntoView({behavior:'smooth',block:'nearest'});form.querySelector('textarea')?.focus()}});
  document.querySelector('[data-support-action="cancel-report"]')?.addEventListener('click',()=>{if(form)form.hidden=true});
  form?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form);const message=String(fd.get('message')||'').trim();const category=String(fd.get('category')||'Other');const status=document.querySelector('#ppSupportStatus');const btn=form.querySelector('button[type="submit"]');if(message.length<8){if(status){status.textContent='Please add a little more detail.';status.classList.add('is-error')}return}setBusy(btn,true,'Submitting…');let error=null;if(supabaseClient&&currentUser?.id){const result=await supabaseClient.from('pp_support_requests').insert({user_id:currentUser.id,email:currentProfile?.email||currentUser.email||'',category,message,page_url:location.href,status:'open'});error=result.error}setBusy(btn,false);if(!error){if(status){status.textContent='Request submitted. We’ll use your account email for follow-up.';status.classList.remove('is-error')}form.reset();showToast('Support request submitted');return}if(ppBackendTableMissing(error,'pp_support_requests')){const subject=encodeURIComponent(`PricePulse Support — ${category}`);const body=encodeURIComponent(`${message}\n\nAccount: ${currentProfile?.email||currentUser?.email||''}`);location.href=`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;if(status){status.textContent='Opening your email app to send this request.';status.classList.remove('is-error')}return}if(status){status.textContent=error.message||'Could not submit the request.';status.classList.add('is-error')}});
}


function ppPlusCompareHTML(){
  return `<div class="pp-plus-compare-shell">
    <div class="pp-plus-compare-brand"><span>★</span><div><b>Free vs PricePulse <em>Plus</em></b><small>See exactly what ₹99/year unlocks.</small></div></div>
    <div class="pp-plus-compare-table">
      <div class="pp-plus-compare-row is-head"><b>Feature</b><b>Free</b><b>Plus</b></div>
      <div class="pp-plus-compare-row"><span>Price comparison</span><b>✓</b><b>✓</b></div>
      <div class="pp-plus-compare-row"><span>Deal Alerts</span><b>1 active</b><b>Up to 3 + priority</b></div>
      <div class="pp-plus-compare-row"><span>Wallet access</span><b>✓</b><b>✓</b></div>
      <div class="pp-plus-compare-row"><span>Referral ₹100 + ₹100</span><b>✓</b><b>✓</b></div>
      <div class="pp-plus-compare-row"><span>Normal rewards</span><b>✓</b><b>✓</b></div>
      <div class="pp-plus-compare-row is-plus"><span>₹100 Plus Welcome Reward</span><b>—</b><b>✓</b></div>
      <div class="pp-plus-compare-row is-plus"><span>Plus Reward Boost</span><b>—</b><b>✓</b></div>
      <div class="pp-plus-compare-row is-plus"><span>Minimum Wallet redemption</span><b>₹100</b><b>₹25</b></div>
      <div class="pp-plus-compare-row is-plus"><span>Member-only savings</span><b>—</b><b>✓</b></div>
      <div class="pp-plus-compare-row is-plus"><span>Plus Savings Tracker</span><b>—</b><b>✓</b></div>
    </div>
    <div class="pp-plus-compare-foot"><strong>₹99 / year</strong><span>One eligible confirmed purchase can recover the membership cost through the ₹100 Plus Welcome Reward.</span></div>
    <button class="pp-plus-primary" type="button" data-plus-action="checkout">Get PricePulse Plus — ₹99/year</button>
  </div>`;
}
function ppPlusCheckoutHTML(){
  return `<div class="pp-plus-checkout-shell">
    <span class="pp-plus-checkout-star">★</span>
    <p>PRICEPULSE <em>PLUS</em></p>
    <h2>₹99 <small>/ year</small></h2>
    <strong>Built to pay for itself.</strong>
    <div class="pp-plus-checkout-benefit"><b>₹100 Plus Welcome Reward</b><span>After your first eligible confirmed purchase, subject to the reward/return eligibility rules.</span></div>
    <div class="pp-plus-checkout-list"><span>✓ Deal Alerts+</span><span>✓ Plus Reward Boost</span><span>✓ Member-only Savings</span><span>✓ Plus Savings Tracker</span></div>
    <div class="pp-plus-dev-note"><b>Development build</b><span>Secure payment checkout is not connected yet, so this screen will not charge you. Membership activation remains available to Admin for testing until billing is connected.</span></div>
    <button type="button" class="pp-plus-primary" data-plus-action="back">Back to Plus</button>
  </div>`;
}
function ppPlusHTML(){
  const state=ppNormalizePlusStatus(ppPlusMembership.status);
  const masterMode=ppNormalizePlusMaster(ppPlusMaster.mode);
  const masterPaused=masterMode==='inactive';
  const active=ppPlusIsActive();
  const pending=!masterPaused&&state==='pending';
  const expired=!masterPaused&&state==='expired';
  const effectiveExpiry=masterMode==='active'?ppPlusMaster.expires_at:ppPlusMembership.expires_at;
  const expiry=ppFormatPlusDate(effectiveExpiry);
  const shellState=active?'active':masterPaused?'paused':pending?'pending':expired?'expired':'available';
  const statusHTML=active
    ? `<div class="pp-plus-status is-active"><span>★</span><div><b>PricePulse Plus is active</b><small>${expiry?`Valid until ${escapeHTML(expiry)}`:'Your savings membership is active.'}</small></div></div>`
    : masterPaused
      ? `<div class="pp-plus-status is-pending"><span>◷</span><div><b>PricePulse Plus is temporarily paused</b><small>Your individual membership status is preserved while the system-wide pause is active.</small></div></div>`
      : pending
        ? `<div class="pp-plus-status is-pending"><span>◷</span><div><b>Membership activation pending</b><small>Your existing test membership is waiting for its eligible purchase activation rule to complete.</small></div></div>`
        : expired
          ? `<div class="pp-plus-status is-expired"><span>★</span><div><b>Plus membership period completed</b><small>Renewal billing will be connected with the paid membership checkout.</small></div></div>`
          : `<div class="pp-plus-value-hero"><div><span>₹100</span><b>Plus Welcome Reward</b></div><p>On your first eligible confirmed purchase. That can recover the ₹99 annual membership cost.</p></div>`;
  const cta=active
    ? `<div class="pp-plus-dual-actions"><button type="button" class="pp-plus-primary" data-plus-action="members">Explore Member Deals →</button><button type="button" class="pp-plus-secondary" data-plus-action="savings">View Plus Savings</button></div>`
    : masterPaused
      ? `<button type="button" class="pp-plus-primary" disabled>Plus temporarily paused</button>`
      : `<div class="pp-plus-dual-actions"><button type="button" class="pp-plus-primary" data-plus-action="checkout">Get PricePulse Plus — ₹99/year</button><button type="button" class="pp-plus-secondary" data-plus-action="compare">Compare Free vs Plus</button></div>`;
  return `<section class="pp-plus-shell is-${shellState}">
    <header class="pp-plus-head">
      <i class="pp-plus-orbit pp-plus-orbit-left" aria-hidden="true"></i>
      <i class="pp-plus-orbit pp-plus-orbit-right" aria-hidden="true"></i>
      <span class="pp-plus-crown" aria-hidden="true">★</span>
      <p><span>PRICEPULSE</span> <em>PLUS</em></p>
      <h2>${active?'Savings membership active':'₹99 <span class="pp-plus-year">/ year</span>'}</h2>
      <span>${active?'Your Plus benefits are active across eligible PricePulse features.':'A small membership. Bigger savings.'}</span>
    </header>
    <div class="pp-plus-body">
      ${statusHTML}
      <div class="pp-plus-benefits-title"><span>WHAT PLUS GIVES YOU</span><small>Real value, not just a feature badge.</small></div>
      <div class="pp-plus-benefits pp-plus-savings-benefits">
        <article><span class="pp-plus-benefit-icon" aria-hidden="true">₹</span><div><b>₹100 Welcome Reward</b><small>After your first eligible confirmed purchase.</small></div></article>
        <article><span class="pp-plus-benefit-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></span><div><b>Deal Alerts+</b><small>Free gets 1 active alert. Plus unlocks up to 3 active alerts and priority alert experiences.</small></div></article>
        <article><span class="pp-plus-benefit-icon" aria-hidden="true">★</span><div><b>Plus Reward Boost</b><small>Extra eligible rewards, Plus-only campaigns and special vouchers while Wallet stays free for everyone.</small></div></article>
        <article><span class="pp-plus-benefit-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 13 11 22l-9-9V4h9z"/><path d="M7 8h.01"/></svg></span><div><b>Member-Only Savings</b><small>Genuine exclusive offers, eligible coupons/bank offers and early-access campaigns.</small></div></article>
      </div>
      <div class="pp-plus-tracker-preview"><span>PLUS SAVINGS TRACKER</span><b>See when your ₹99 membership has paid for itself.</b><small>Confirmed Plus-specific value is tracked in Wallet.</small></div>
      <div class="pp-plus-action-wrap">${cta}<small>${active?'Benefits remain subject to retailer, campaign and reward eligibility.':'Wallet remains free. Plus adds more earning power, lower redemption minimums and member-only value.'}</small></div>
    </div>
  </section>`;
}
function ppBindPlusPanelActions(){
  document.querySelector('[data-plus-action="members"]')?.addEventListener('click',()=>{void ppOpenMemberDeals()});
  document.querySelector('[data-plus-action="savings"]')?.addEventListener('click',()=>{location.href='wallet.html#plus-savings'});
  document.querySelector('[data-plus-action="compare"]')?.addEventListener('click',()=>{openModal(ppPlusCompareHTML(),true);ppBindPlusPanelActions()});
  document.querySelector('[data-plus-action="checkout"]')?.addEventListener('click',()=>{openModal(ppPlusCheckoutHTML(),true);ppBindPlusPanelActions()});
  document.querySelector('[data-plus-action="back"]')?.addEventListener('click',()=>{renderPlusPanel()});
}
function renderPlusPanel(){
  openModal(ppPlusHTML(),true);
  ppBindPlusPanelActions();
}

ensureAccountPopover().addEventListener('click',async e=>{
  const button=e.target.closest('[data-account-action]');
  if(!button) return;
  const action=button.dataset.accountAction;
  if(action==='profile'){
    closeAccountPopover();
    renderProfileForm(currentProfile?.email||currentUser?.email||'',currentProfile);
    return;
  }
  if(action==='wishlist'){
    closeAccountPopover();
    openWishlistPanel();
    return;
  }
  if(action==='wallet'){
    closeAccountPopover();
    location.href='wallet.html';
    return;
  }
  if(action==='alerts'){
    closeAccountPopover();
    await renderDealAlertsDashboard();
    return;
  }
  if(action==='plus'){
    closeAccountPopover();
    renderPlusPanel();
    return;
  }
  if(action==='preferences'){
    closeAccountPopover();
    renderPreferencesPanel();
    return;
  }
  if(action==='help'){
    closeAccountPopover();
    renderHelpSupportPanel();
    return;
  }
  if(action==='signout') await signOutFromAccountPopover(button);
});

document.addEventListener('click',e=>{
  if(!accountPopover || accountPopover.hidden) return;
  if(e.target.closest('#accountPopover') || e.target.closest('#signInBtn')) return;
  closeAccountPopover();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape') closeAccountPopover();});
window.addEventListener('resize',positionAccountPopover,{passive:true});
window.addEventListener('scroll',positionAccountPopover,{passive:true});
document.querySelector('#wishlistTop')?.addEventListener('click',closeAccountPopover,{capture:true});
document.querySelector('#dealTop')?.setAttribute('aria-expanded','false');
document.querySelector('#dealTop')?.addEventListener('click',e=>{
  e.preventDefault();
  closeAccountPopover();
  if(!currentUser || !profileComplete(currentProfile)){
    setPendingAuthAction({type:'deal-alerts-open'});
    if(currentUser)renderProfileForm(currentUser.email||'',currentProfile);
    else renderAuthStart();
    return;
  }
  toggleDealAlertsPanel();
});
window.addEventListener('resize',ppPositionDealAlertsPanel,{passive:true});
window.addEventListener('scroll',ppPositionDealAlertsPanel,{passive:true});
document.querySelector('.site-header')?.addEventListener('click',e=>{
  if(!ppDealAlertsIsOpen()||e.target.closest('#dealTop'))return;
  closeDealAlertsPanel();
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ppDealAlertsIsOpen())closeDealAlertsPanel();});

$("#signInBtn")?.setAttribute('aria-expanded','false');
$("#signInBtn")?.addEventListener("click",()=>{
  if(!currentUser) renderAuthStart();
  else if(!profileComplete(currentProfile)) renderProfileForm(currentUser.email||"",currentProfile);
  else toggleAccountPopover();
});

let ppPlusDeepLinkHandled=false;
function ppHandlePlusDeepLink(){
  if(ppPlusDeepLinkHandled)return;
  const u=new URL(location.href);
  if(u.searchParams.get('open_plus')!=='1')return;
  ppPlusDeepLinkHandled=true;
  u.searchParams.delete('open_plus');
  history.replaceState(null,'',u.pathname+(u.searchParams.toString()?`?${u.searchParams}`:'')+u.hash);
  setTimeout(()=>renderPlusPanel(),120);
}

async function syncAuthSession(session,{fromOAuth=false}={}){
  currentUser=session?.user||null;
  currentProfile=currentUser?await loadProfile(currentUser.id):null;
  if(currentUser&&profileComplete(currentProfile))await ppAttachPendingReferral();
  await ppLoadPlusMembership();
  updateAccountHeader();
  ppHandlePlusDeepLink();
  if(currentUser){
    await syncWishlistForUser(currentUser);
    await ppLoadDealAlertsForUser(currentUser);
  }else{
    ppResetDealAlertsState();
    activateGuestWishlist();
  }

  if(fromOAuth && currentUser){
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    cleanOAuthUrl();
    if(currentProfile && profileComplete(currentProfile)){
      closeModal();
      showToast("Signed in with Google");
      await continuePendingAuthAction();
    }else{
      renderProfileForm(currentUser.email||"",currentProfile);
    }
  }
}

async function initAuth(){
  if(!supabaseClient){updateAccountHeader();return;}

  const pendingGoogle=sessionStorage.getItem(OAUTH_PENDING_KEY)==="1";
  const oauthError=oauthErrorFromUrl();

  try{
    const {data,error}=await supabaseClient.auth.getSession();
    if(error) throw error;
    await syncAuthSession(data?.session||null,{fromOAuth:pendingGoogle && Boolean(data?.session?.user)});
  }catch(err){
    console.error("Auth init failed",err);
    currentUser=null;
    currentProfile=null;
    ppPlusMembership={status:'available',claimed_at:null,activated_at:null,expires_at:null};
    updateAccountHeader();
  }

  supabaseClient.auth.onAuthStateChange((event,session)=>{
    setTimeout(async()=>{
      try{
        const fromOAuth=sessionStorage.getItem(OAUTH_PENDING_KEY)==="1" && event==="SIGNED_IN";
        await syncAuthSession(session,{fromOAuth});
        if(event==="SIGNED_OUT"){
          currentUser=null;
          currentProfile=null;
          ppPlusMembership={status:'available',claimed_at:null,activated_at:null,expires_at:null};
          ppResetDealAlertsState();
          updateAccountHeader();
          activateGuestWishlist();
        }
      }catch(err){
        console.error("Auth state sync failed",err);
      }
    },0);
  });

  if(pendingGoogle && !currentUser){
    setTimeout(async()=>{
      if(currentUser || sessionStorage.getItem(OAUTH_PENDING_KEY)!=="1") return;
      try{
        const {data}=await supabaseClient.auth.getSession();
        if(data?.session?.user){
          await syncAuthSession(data.session,{fromOAuth:true});
          return;
        }
      }catch(err){
        console.error("OAuth retry failed",err);
      }
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      renderAuthStart();
      setTimeout(()=>setAuthStatus(oauthError||"Google sign-in did not complete. Please try again.",true),0);
      cleanOAuthUrl();
    },1800);
  }else if(oauthError){
    renderAuthStart();
    setTimeout(()=>setAuthStatus(oauthError,true),0);
    cleanOAuthUrl();
  }
}
initAuth();

/* ---------- Information / legal ---------- */
const LEGAL_LAST_UPDATED="October 2026";
const infoContent={
  about:{title:"About PricePulse",body:`
    <p>PricePulse is a product and price-comparison platform designed to help shoppers compare supported retailer offers, discover better prices and make clearer buying decisions.</p>
    <p>PricePulse does not sell or fulfil products directly. Purchases, payments, delivery, warranty, returns and after-sales service are handled by the retailer or seller you choose.</p>
    <p>Prices and availability can change quickly, so the final merchant page should always be checked before purchase.</p>`},
  contact:{title:"Contact PricePulse",body:`
    <p><strong>Support, feedback, partnerships and business enquiries</strong></p>
    <p>You can reach PricePulse at:</p>
    <p><a class="contact-email" href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent('PricePulse Support')}" target="_blank" rel="noopener noreferrer">${SUPPORT_EMAIL}</a></p>
    <p>Signed-in users can also use <strong>Account → Help &amp; Support → Report a Problem</strong> to submit a structured support request.</p>`},
  privacy:{title:"Privacy Policy",body:`
    <p><strong>Last updated: ${LEGAL_LAST_UPDATED}</strong></p>
    <p>When you use account features, PricePulse may process profile information such as your name, email address, mobile number, city, state, country and PIN code. Account authentication and profile storage are provided through Supabase.</p>
    <p>Wishlist items, Deal Alerts, saved Preferences and support requests may be stored with your PricePulse account so these features can continue across signed-in sessions. This browser may also use local storage for lightweight interface and saved-price tracking data.</p>
    <p>PricePulse does not collect payment-card details because checkout and payment take place on merchant websites. When you follow a retailer link, that retailer's own privacy policy and terms apply.</p>
    <p>For privacy, account-data or deletion-related questions, email <a href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent('PricePulse Privacy Request')}" target="_blank" rel="noopener noreferrer">${SUPPORT_EMAIL}</a>.</p>`},
  terms:{title:"Terms of Use",body:`
    <p><strong>Last updated: ${LEGAL_LAST_UPDATED}</strong></p>
    <p>PricePulse provides product-comparison information for supported retailer offers. Prices and availability shown are based on the latest information available to PricePulse and can change when a retailer updates its listing.</p>
    <p>PricePulse is not the seller. Before purchasing, verify the final checkout price, product variant, seller, availability, shipping charges, warranty, return policy and other purchase terms on the retailer website.</p>
    <p>Deal Alerts and Wishlist updates are informational tools and do not guarantee that a price, offer or product will remain available.</p>
    <p>By using retailer links you may leave PricePulse and become subject to the retailer's own terms and policies.</p>
    <p>Questions: <a href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent('PricePulse Terms Question')}" target="_blank" rel="noopener noreferrer">${SUPPORT_EMAIL}</a></p>`},
  affiliate:{title:"Affiliate Disclosure",body:`
    <p><strong>Last updated: ${LEGAL_LAST_UPDATED}</strong></p>
    <p>PricePulse may use affiliate or referral links to supported retailers. If you visit a retailer through an eligible link and make a qualifying purchase, PricePulse may receive a commission from that retailer or affiliate network.</p>
    <p>Using an affiliate link does not add a separate PricePulse fee to your purchase. The final product price, discounts, delivery charges and purchase terms are controlled by the retailer.</p>
    <p>Always compare the current retailer offers and choose the option that suits you.</p>
    <p>Questions: <a href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent('PricePulse Affiliate Question')}" target="_blank" rel="noopener noreferrer">${SUPPORT_EMAIL}</a></p>`}
};

$$(".info-link").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const item=infoContent[btn.dataset.info];
    if(!item) return;
    openModal(`
      <div class="legal-shell">
        <div class="legal-brand"><img src="logo-icon.png" alt=""><span>PricePulse</span></div>
        <h2>${item.title}</h2>
        <div class="legal-copy">${item.body}</div>
      </div>`);
  });
});

/* ---------- All Categories dropdown ---------- */
const allCategoriesBtn=$("#allCategoriesBtn");
const allCategoriesMenu=$("#allCategoriesMenu");
const closeCategoriesBtn=$("#closeCategoriesMenu");

function positionCategoriesMenu(){
  if(!allCategoriesBtn || !allCategoriesMenu || allCategoriesMenu.hidden) return;
  const rect=allCategoriesBtn.getBoundingClientRect();
  const viewportWidth=window.innerWidth;
  const gap=8;
  const menuWidth=Math.min(340,viewportWidth-24);
  let left=rect.left;
  if(left+menuWidth>viewportWidth-16) left=viewportWidth-menuWidth-16;
  if(left<16) left=16;
  allCategoriesMenu.style.left=`${left}px`;
  allCategoriesMenu.style.top=`${rect.bottom+gap}px`;
}

function openCategoriesMenu(){
  if(!allCategoriesBtn || !allCategoriesMenu) return;
  allCategoriesMenu.hidden=false;
  document.body.classList.add("categories-open");
  allCategoriesMenu.classList.remove("menu-enter");
  void allCategoriesMenu.offsetWidth;
  allCategoriesMenu.classList.add("menu-enter");
  allCategoriesBtn.classList.add("menu-open");
  allCategoriesBtn.setAttribute("aria-expanded","true");
  positionCategoriesMenu();
}
function closeCategoriesMenu(){
  if(!allCategoriesBtn || !allCategoriesMenu) return;
  allCategoriesMenu.hidden=true;
  document.body.classList.remove("categories-open");
  allCategoriesBtn.classList.remove("menu-open");
  allCategoriesBtn.setAttribute("aria-expanded","false");
}
document.querySelector('#footerCategoriesLink')?.addEventListener('click',()=>{
  window.scrollTo({top:0,behavior:'smooth'});
  window.setTimeout(()=>openCategoriesMenu(),320);
});

allCategoriesBtn?.addEventListener("click",e=>{
  e.preventDefault();
  e.stopPropagation();
  allCategoriesMenu.hidden?openCategoriesMenu():closeCategoriesMenu();
});
closeCategoriesBtn?.addEventListener("click",e=>{e.stopPropagation();closeCategoriesMenu();});
$$("[data-menu-cat]").forEach(item=>{
  item.addEventListener("click",()=>{
    const category=item.dataset.menuCat;
    pickCategory(category,false);
    closeCategoriesMenu();
    go("#deals");
    showToast(`Filtered to ${item.querySelector("b")?.textContent||"category"}`);
  });
});
document.addEventListener("click",e=>{
  if(allCategoriesMenu && !allCategoriesMenu.hidden && !allCategoriesMenu.contains(e.target) && !allCategoriesBtn?.contains(e.target)) closeCategoriesMenu();
});
window.addEventListener("resize",positionCategoriesMenu);
window.addEventListener("scroll",()=>{if(allCategoriesMenu && !allCategoriesMenu.hidden) positionCategoriesMenu();},{passive:true});

document.querySelector('.footer button[data-scroll="#home"]')?.addEventListener('click', function(e){
  e.preventDefault();
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});
/* V76.9.4 — footer CTA: return shoppers to the main search */
document.querySelector('#startComparingBtn')?.addEventListener('click',()=>{
  window.scrollTo({top:0,behavior:'smooth'});
  window.setTimeout(()=>{
    const input=document.querySelector('#searchInput');
    if(!input) return;
    try{input.focus({preventScroll:true});}
    catch(_){input.focus();}
  },520);
});


let ppGlobalImageResizeTimer=0;
window.addEventListener('resize',()=>{clearTimeout(ppGlobalImageResizeTimer);ppGlobalImageResizeTimer=setTimeout(()=>ppHydrateGlobalProductImages(document),100);});
if(typeof MutationObserver!=='undefined'&&document.body){
  /* Batch image hydration so one click/modal render does not synchronously re-fit every added node. */
  const ppGlobalImageHydrateRoots=new Set();
  let ppGlobalImageHydrateRaf=0;
  const ppGlobalImageObserver=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node?.nodeType!==1)continue;
        if(node.matches?.('img.pp-global-product-image')||node.querySelector?.('img.pp-global-product-image'))ppGlobalImageHydrateRoots.add(node);
      }
    }
    if(!ppGlobalImageHydrateRoots.size||ppGlobalImageHydrateRaf)return;
    ppGlobalImageHydrateRaf=requestAnimationFrame(()=>{
      ppGlobalImageHydrateRaf=0;
      const roots=[...ppGlobalImageHydrateRoots];
      ppGlobalImageHydrateRoots.clear();
      roots.forEach(root=>ppHydrateGlobalProductImages(root));
    });
  });
  ppGlobalImageObserver.observe(document.body,{childList:true,subtree:true});
}
setTimeout(()=>ppHydrateGlobalProductImages(document),120);
if(typeof ppAutoFitBestStoreLogo==="function")setTimeout(ppAutoFitBestStoreLogo, 250);
/* ===== V78.8.37 HOME TITLE SINGLE-LINE + MORE =====
   Presentation-only. Full title remains unchanged in catalog/data and existing popup logic. */
function ppRefreshHomeTitleOverflow(card){
  const title=card?.querySelector('h3');
  if(!title)return;
  title.classList.remove('pp-title-truncated');
  title.removeAttribute('role');
  title.removeAttribute('tabindex');
  const full=String(title.textContent||'').trim();
  if(!full)return;
  title.setAttribute('title',full);
  requestAnimationFrame(()=>{
    const overflow=title.scrollWidth>title.clientWidth+1;
    title.classList.toggle('pp-title-truncated',overflow);
    title.removeAttribute('role');
    title.removeAttribute('tabindex');
    title.removeAttribute('aria-label');
  });
}
function ppRefreshAllHomeTitleOverflow(){document.querySelectorAll('#deals .deal-card').forEach(ppRefreshHomeTitleOverflow);}
window.addEventListener('resize',()=>requestAnimationFrame(ppRefreshAllHomeTitleOverflow));
requestAnimationFrame(ppRefreshAllHomeTitleOverflow);
setTimeout(ppRefreshAllHomeTitleOverflow,250);
setTimeout(ppRefreshAllHomeTitleOverflow,1200);
