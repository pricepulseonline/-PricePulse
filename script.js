const SUPABASE_URL="https://akdrydxbvdtadmcphhxj.supabase.co";
const SUPABASE_KEY="sb_publishable_RZAK4TwpJO6fi3Y306EGaA_PpZdiqHG";
const supabaseClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const SUPPORT_EMAIL="pricepulseonline@gmail.com";

const toast=$("#toast");
let tt;
let currentUser=null;
let currentProfile=null;
let otpResendTimer=null;
const OAUTH_PENDING_KEY="pp_google_oauth_pending";

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

function filterProducts(category="all", query=""){
  query=query.toLowerCase().trim();
  let visible=0;
  cards.forEach(card=>{
    const categoryMatch=category==="all" || card.dataset.category===category;
    const searchMatch=!query || card.dataset.search.includes(query);
    const show=categoryMatch && searchMatch;
    card.hidden=!show;
    if(show) visible++;
  });
  noResults.hidden=visible>0;
  $("#dealGrid")?.classList.toggle("single-result", visible===1);
}

function setTopCategoryActive(category){
  $$(".category-nav [data-cat]").forEach(btn=>{
    btn.classList.toggle("nav-selected",btn.dataset.cat===category);
  });
}

function pickCategory(category,shouldScroll=true){
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
  setTopCategoryActive("");
  filterProducts("all",search.value);
  go("#deals");
  showToast(search.value?`Showing demo matches for "${search.value}"`:"Showing all demo products");
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
  setTopCategoryActive("");
  filterProducts("all");
  $$(".deal-tabs button").forEach(btn=>btn.classList.toggle("active",btn.dataset.filter==="all"));
  go("#deals");
});

$$(".deal-tabs button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const category=btn.dataset.filter;
    filterProducts(category);
    setTopCategoryActive(category==="all"?"":category);
    $$(".deal-tabs button").forEach(x=>x.classList.toggle("active",x===btn));
  });
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
    .select("product_id")
    .eq("user_id",user.id);

  if(error){
    console.warn("Wishlist sync unavailable",error);
    setSavedItems(cachedItems.length?cachedItems:guestItems);
    return;
  }

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

  if(willSave) saved.add(id); else saved.delete(id);
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
      if(wasSaved) saved.add(id); else saved.delete(id);
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

$$(".heart").forEach(btn=>btn.addEventListener("click",()=>toggleWishlistItem(btn)));
syncWishlist();
/* Modal */
const modal=$("#modal");
const modalBody=$("#modalBody");
const modalPanel=modal?.querySelector(".modal-panel");
function openModal(html,wide=false){
  modalBody.innerHTML=html;
  modalPanel?.classList.toggle("modal-wide",Boolean(wide));
  modal.hidden=false;
  document.body.style.overflow="hidden";
}
function closeModal(){
  clearOtpResendTimer();
  modal.hidden=true;
  modalPanel?.classList.remove("modal-wide");
  document.body.style.overflow="";
}
$$("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModal));

document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && modal && !modal.hidden) closeModal();
});

function comparisonModalHTML(product,price,amazonUrl="",flipkartUrl="",thirdStore="",thirdUrl=""){
  if(amazonUrl || flipkartUrl || thirdUrl){
    const retailerCount=[amazonUrl,flipkartUrl,thirdUrl].filter(Boolean).length;
    return `
      <div class="comparison-head">
        <p class="comparison-kicker">COMPARE RETAILER OFFERS</p>
        <h2>${escapeHTML(product)}</h2>
        <p>${retailerCount>1?"Compare the available retailer options below.":"Check the available retailer offer below."} Prices and availability are confirmed on the retailer site.</p>
      </div>
      <div class="offer-list">
        ${amazonUrl?`
        <div class="offer-row offer-row-live">
          <div class="offer-store-copy">
            <span class="offer-store-badge">AMAZON</span>
            <strong>Amazon India</strong>
            <small>Latest price & availability on Amazon.in</small>
          </div>
          <a class="offer-shop-btn" href="${escapeHTML(amazonUrl)}" target="_blank" rel="sponsored noopener noreferrer">View on Amazon →</a>
        </div>`:""}
        ${flipkartUrl?`
        <div class="offer-row offer-row-live">
          <div class="offer-store-copy">
            <span class="offer-store-badge">FLIPKART</span>
            <strong>Flipkart</strong>
            <small>Latest price & availability on Flipkart</small>
          </div>
          <a class="offer-shop-btn" href="${escapeHTML(flipkartUrl)}" target="_blank" rel="sponsored noopener noreferrer">View on Flipkart →</a>
        </div>`:""}
        ${thirdUrl?`
        <div class="offer-row offer-row-live">
          <div class="offer-store-copy">
            <span class="offer-store-badge">${escapeHTML(String(thirdStore||"STORE").toUpperCase())}</span>
            <strong>${escapeHTML(thirdStore||"Retailer")}</strong>
            <small>Latest price & availability on ${escapeHTML(thirdStore||"retailer")}</small>
          </div>
          <a class="offer-shop-btn" href="${escapeHTML(thirdUrl)}" target="_blank" rel="sponsored noopener noreferrer">View on ${escapeHTML(thirdStore||"Store")} →</a>
        </div>`:""}
      </div>
      <p class="offer-affiliate-note">Retailer links may be affiliate links • Prices and availability can change.</p>`;
  }

  return `
    <h2>${escapeHTML(product)}</h2>
    <p>Retailer links are not available for this product yet.</p>`;
}

$$(".compare-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    openModal(comparisonModalHTML(
      btn.dataset.product||"Product",
      btn.dataset.price||"",
      btn.dataset.amazonUrl||"",
      btn.dataset.flipkartUrl||"",
      btn.dataset.thirdStore||"",
      btn.dataset.thirdUrl||""
    ));
  });
});

function getWishlistProduct(id){
  const heart=$(`.heart[data-id="${CSS.escape(String(id))}"]`);
  const card=heart?.closest(".deal-card");
  if(!card) return null;
  return {
    id:String(id),
    name:card.querySelector("h3")?.textContent?.trim()||"Saved product",
    image:card.querySelector(".product-media img")?.getAttribute("src")||"",
    price:card.querySelector(".price")?.textContent?.trim()||"",
    stores:card.querySelector(".store-count")?.textContent?.trim()||"",
    discount:card.querySelector(".discount")?.textContent?.trim()||"",
    compareProduct:card.querySelector(".compare-btn")?.dataset.product||"",
    comparePrice:card.querySelector(".compare-btn")?.dataset.price||"",
    amazonUrl:card.querySelector(".compare-btn")?.dataset.amazonUrl||"",
    flipkartUrl:card.querySelector(".compare-btn")?.dataset.flipkartUrl||"",
    thirdStore:card.querySelector(".compare-btn")?.dataset.thirdStore||"",
    thirdUrl:card.querySelector(".compare-btn")?.dataset.thirdUrl||""
  };
}

function wishlistModalHTML(){
  const products=[...saved].map(getWishlistProduct).filter(Boolean);
  if(!products.length){
    return `
      <div class="wishlist-modal-head">
        <div><p class="wishlist-kicker">SAVED ITEMS</p><h2>Wishlist</h2></div>
        <span class="wishlist-modal-count">0 items</span>
      </div>
      <div class="wishlist-empty">
        <span class="wishlist-empty-heart" aria-hidden="true">♡</span>
        <h3>Your wishlist is empty</h3>
        <p>Tap the heart on any product to save it here.</p>
        <button class="primary wishlist-browse-btn" type="button" data-wishlist-action="browse">Browse Deals →</button>
      </div>`;
  }

  return `
    <div class="wishlist-modal-head">
      <div><p class="wishlist-kicker">SAVED ITEMS</p><h2>Wishlist</h2></div>
      <span class="wishlist-modal-count">${products.length} ${products.length===1?"item":"items"}</span>
    </div>
    <div class="wishlist-modal-list">
      ${products.map(product=>`
        <article class="wishlist-item" data-wishlist-id="${escapeHTML(product.id)}">
          <div class="wishlist-item-media">
            <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}">
          </div>
          <div class="wishlist-item-info">
            <div class="wishlist-item-title-row">
              <div>
                ${product.discount?`<span class="wishlist-discount">${escapeHTML(product.discount)}</span>`:""}
                <h3>${escapeHTML(product.name)}</h3>
              </div>
              <button class="wishlist-remove-icon" type="button" data-wishlist-action="remove" data-id="${escapeHTML(product.id)}" aria-label="Remove ${escapeHTML(product.name)} from wishlist">×</button>
            </div>
            <p class="wishlist-store-count">${escapeHTML(product.stores)}</p>
            <div class="wishlist-item-bottom">
              <strong>${escapeHTML(product.price)}</strong>
              <div class="wishlist-item-actions">
                <button class="wishlist-remove-btn" type="button" data-wishlist-action="remove" data-id="${escapeHTML(product.id)}">Remove</button>
                <button class="wishlist-compare-btn" type="button" data-wishlist-action="compare" data-product="${escapeHTML(product.compareProduct||product.name)}" data-price="${escapeHTML(product.comparePrice||product.price)}" data-amazon-url="${escapeHTML(product.amazonUrl||"")}" data-flipkart-url="${escapeHTML(product.flipkartUrl||"")}" data-third-store="${escapeHTML(product.thirdStore||"")}" data-third-url="${escapeHTML(product.thirdUrl||"")}">Compare Offers</button>
              </div>
            </div>
          </div>
        </article>`).join("")}
    </div>`;
}

function openWishlistModal(){
  openModal(wishlistModalHTML(),true);
}

$("#wishlistTop")?.addEventListener("click",openWishlistModal);

modalBody?.addEventListener("click",async e=>{
  const actionButton=e.target.closest("[data-wishlist-action]");
  if(!actionButton) return;
  const action=actionButton.dataset.wishlistAction;

  if(action==="browse"){
    closeModal();
    go("#deals");
    return;
  }

  if(action==="remove"){
    const id=actionButton.dataset.id;
    const heart=$(`.heart[data-id="${CSS.escape(String(id||""))}"]`);
    if(heart && saved.has(String(id))){
      await toggleWishlistItem(heart);
      if(modal && !modal.hidden) openWishlistModal();
    }
    return;
  }

  if(action==="compare"){
    const product=actionButton.dataset.product||"Saved product";
    const price=actionButton.dataset.price||"";
    const amazonUrl=actionButton.dataset.amazonUrl||"";
    const flipkartUrl=actionButton.dataset.flipkartUrl||"";
    const thirdStore=actionButton.dataset.thirdStore||"";
    const thirdUrl=actionButton.dataset.thirdUrl||"";
    openModal(comparisonModalHTML(product,price,amazonUrl,flipkartUrl,thirdStore,thirdUrl));
  }
});

/* ---------- Authentication ---------- */
function profileComplete(profile){
  return Boolean(profile?.full_name && profile?.mobile && profile?.city && profile?.state && profile?.pin_code);
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
    label.textContent=`Hi, ${firstName}`;
  }else{
    label.textContent="Sign In";
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

async function sendEmailOtp(email){
  return supabaseClient.auth.signInWithOtp({
    email,
    options:{shouldCreateUser:true}
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
    <button class="auth-google" id="googleAuthBtn" type="button"><span class="google-mark" aria-hidden="true"><svg viewBox="0 0 18 18" focusable="false"><path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.703-1.568 2.684-3.88 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.91-2.258c-.806.54-1.835.86-3.046.86-2.344 0-4.328-1.584-5.037-3.712H.956v2.332A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.963 10.71A5.42 5.42 0 0 1 3.681 9c0-.593.102-1.17.282-1.71V4.958H.956A9 9 0 0 0 0 9c0 1.45.347 2.82.956 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.579c1.322 0 2.508.454 3.442 1.346l2.582-2.582C13.464.891 11.426 0 9 0A9 9 0 0 0 .956 4.958l3.007 2.332C4.672 5.162 6.656 3.579 9 3.579z"/></svg></span><span>Continue with Google</span></button>
    <div class="auth-divider"><span>or</span></div>
    <form class="auth-form" id="otpRequestForm">
      <label class="auth-field"><span>Email address</span><input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com" value="${escapeHTML(prefill)}" required></label>
      <button class="auth-primary" id="sendOtpBtn" type="submit">Send Email OTP →</button>
    </form>
    <p class="auth-fineprint">By continuing, you agree to the PricePulse Terms and Privacy notice.</p>
    <p class="auth-status" id="authStatus" aria-live="polite"></p>`));

  $("#googleAuthBtn")?.addEventListener("click",async()=>{
    if(!supabaseClient){setAuthStatus("Sign-in service could not load. Refresh and try again.",true);return;}
    const btn=$("#googleAuthBtn");
    btn.disabled=true;
    setAuthStatus("Opening Google sign-in…");
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
      setAuthStatus(error.message||"Could not start Google sign-in.",true);
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
    const {error}=await sendEmailOtp(email);
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
    const {error}=await sendEmailOtp(email);
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
    updateAccountHeader();
    if(currentUser) await syncWishlistForUser(currentUser);
    if(currentProfile && profileComplete(currentProfile)){
      closeModal();
      showToast("Signed in successfully");
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
        <label class="auth-field"><span>Mobile Number</span><div class="phone-field"><span class="phone-prefix">+91</span><input id="profileMobile" name="mobileLocal" type="tel" inputmode="numeric" autocomplete="section-profile tel-national" maxlength="10" pattern="[6-9][0-9]{9}" placeholder="9876543210" value="${escapeHTML(localMobile(p.mobile||""))}" required></div></label>
        <label class="auth-field"><span>City</span><input id="profileCity" name="city" autocomplete="section-profile address-level2" value="${escapeHTML(p.city||"")}" placeholder="City" required></label>
        <label class="auth-field"><span>State / UT</span><select id="profileState" name="state" autocomplete="section-profile address-level1" required>${stateOptions(p.state||"")}</select></label>
        <label class="auth-field"><span>Country</span><input id="profileCountry" name="country" autocomplete="section-profile country-name" value="India" readonly></label>
        <label class="auth-field profile-wide"><span>PIN Code</span><input id="profileZip" name="zip" inputmode="numeric" autocomplete="section-profile postal-code" maxlength="6" pattern="[1-9][0-9]{5}" placeholder="302001" value="${escapeHTML(p.pin_code||"")}" required></label>
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
      country:"India",
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
    updateAccountHeader();
    closeModal();
    showToast("Profile saved successfully");
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
    updateAccountHeader();
    activateGuestWishlist();
    closeModal();
    showToast("Signed out");
  });
}

$("#signInBtn")?.addEventListener("click",()=>{
  if(!currentUser) renderAuthStart();
  else if(!profileComplete(currentProfile)) renderProfileForm(currentUser.email||"",currentProfile);
  else renderAccountPanel();
});

async function syncAuthSession(session,{fromOAuth=false}={}){
  currentUser=session?.user||null;
  currentProfile=currentUser?await loadProfile(currentUser.id):null;
  updateAccountHeader();
  if(currentUser) await syncWishlistForUser(currentUser);
  else activateGuestWishlist();

  if(fromOAuth && currentUser){
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    cleanOAuthUrl();
    if(currentProfile && profileComplete(currentProfile)){
      closeModal();
      showToast("Signed in with Google");
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
const infoContent={
  about:{title:"About PricePulse",body:`
    <p>PricePulse is a product and price-comparison platform designed to help shoppers compare options, discover better prices and make clearer buying decisions.</p>
    <p>PricePulse does not sell products directly. Product prices, availability and seller terms should always be confirmed on the merchant website before purchase.</p>`},
  contact:{title:"Contact PricePulse",body:`
    <p>For support, feedback, partnership or business enquiries, contact us at:</p>
    <p><a class="contact-email" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`},
  privacy:{title:"Privacy Policy",body:`
    <p>When you use account features, PricePulse may process profile information such as your name, email address, mobile number, city, state, country and PIN code. Account authentication and profile storage are provided through Supabase.</p>
    <p>Wishlist information is currently stored in your browser. Optional price/deal alerts are only enabled when you choose the alert option.</p>
    <p>We do not collect payment-card details because purchases are completed on merchant websites.</p>
    <p>Privacy questions: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`},
  terms:{title:"Terms of Use",body:`
    <p>PricePulse provides product-comparison information for convenience. Demo prices and store counts currently shown on the site are placeholders, not live marketplace quotes.</p>
    <p>Before purchasing, verify the final price, availability, shipping, warranty, return policy and seller terms on the merchant website.</p>
    <p>Contact: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`},
  affiliate:{title:"Affiliate Disclosure",body:`
    <p>PricePulse may use affiliate links. If you visit a merchant through an eligible link and make a qualifying purchase, PricePulse may receive a commission.</p>
    <p>This does not increase the price you pay. Merchant pricing and purchase terms are controlled by the merchant.</p>
    <p>Questions: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`}
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
