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

/* Wishlist stays local for now; account sync is a later step. */
const saved=new Set(JSON.parse(localStorage.getItem("pp_wish")||"[]"));
function syncWishlist(){
  $$(".heart").forEach(btn=>{
    const on=saved.has(btn.dataset.id);
    btn.classList.toggle("saved",on);
    btn.textContent=on?"♥":"♡";
  });
  if($("#wishCount")) $("#wishCount").textContent=saved.size;
}
$$(".heart").forEach(btn=>{
  btn.addEventListener("click",()=>{
    if(saved.has(btn.dataset.id)) saved.delete(btn.dataset.id); else saved.add(btn.dataset.id);
    localStorage.setItem("pp_wish",JSON.stringify([...saved]));
    syncWishlist();
    showToast(saved.has(btn.dataset.id)?"Added to wishlist":"Removed from wishlist");
  });
});
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
  modal.hidden=true;
  modalPanel?.classList.remove("modal-wide");
  document.body.style.overflow="";
}
$$("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModal));

document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && modal && !modal.hidden) closeModal();
});

$$(".compare-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    openModal(`
      <h2>${escapeHTML(btn.dataset.product)}</h2>
      <p>This is a working demo comparison panel. Live marketplace feeds will replace these placeholders after affiliate/API connections are added.</p>
      <div class="offer-list">
        <div class="offer-row"><strong>Store A</strong><small>Demo listing • ${escapeHTML(btn.dataset.price)}</small></div>
        <div class="offer-row"><strong>Store B</strong><small>Live price connection coming next</small></div>
        <div class="offer-row"><strong>Store C</strong><small>Live price connection coming next</small></div>
      </div>`);
  });
});

$("#wishlistTop")?.addEventListener("click",()=>{
  const names=$$(".heart.saved").map(btn=>btn.closest(".deal-card").querySelector("h3").textContent);
  openModal(`<h2>Wishlist</h2>${names.length?`<p>${names.map(escapeHTML).join("<br>")}</p>`:"<p>Your wishlist is empty.</p>"}`);
});

/* ---------- Authentication ---------- */
function profileComplete(profile){
  return Boolean(profile?.full_name && profile?.mobile && profile?.city && profile?.state && profile?.pin_code);
}

function updateAccountHeader(){
  const label=$("#signInBtn span:last-child");
  if(!label) return;
  /* Logged-out/incomplete accounts keep Sign In. Completed profiles get a friendly first-name greeting. */
  if(currentUser && profileComplete(currentProfile)){
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

function renderAuthStart(prefill=""){
  openModal(authFrame(`
    <button class="auth-google" id="googleAuthBtn" type="button"><span class="google-mark">G</span><span>Continue with Google</span></button>
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
    const {error}=await supabaseClient.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:"https://price-pulse.in"}
    });
    if(error){
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
    const {error}=await supabaseClient.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
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
  openModal(authFrame(`
    <button class="auth-back" id="authBackBtn" type="button">← Back</button>
    <div class="auth-step-copy"><h3>Enter email OTP</h3><p>We sent a 6-digit code to <strong>${escapeHTML(email)}</strong>.</p></div>
    <form class="auth-form" id="otpVerifyForm">
      <label class="auth-field"><span>6-digit OTP</span><input id="authOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required></label>
      <button class="auth-primary" id="verifyOtpBtn" type="submit">Verify & Continue →</button>
    </form>
    <p class="auth-fineprint">Enter the code from your email to continue.</p>
    <p class="auth-status" id="authStatus" aria-live="polite"></p>`));

  $("#authBackBtn")?.addEventListener("click",()=>renderAuthStart(email));
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
    closeModal();
    showToast("Signed out");
  });
}

$("#signInBtn")?.addEventListener("click",()=>{
  if(!currentUser) renderAuthStart();
  else if(!profileComplete(currentProfile)) renderProfileForm(currentUser.email||"",currentProfile);
  else renderAccountPanel();
});

async function initAuth(){
  if(!supabaseClient){updateAccountHeader();return;}
  try{
    const {data,error}=await supabaseClient.auth.getSession();
    if(error) throw error;
    currentUser=data?.session?.user||null;
    currentProfile=currentUser?await loadProfile(currentUser.id):null;
    updateAccountHeader();
  }catch(err){
    console.error("Auth init failed",err);
    currentUser=null;
    currentProfile=null;
    updateAccountHeader();
  }
  supabaseClient.auth.onAuthStateChange(async(event,session)=>{
    currentUser=session?.user||null;
    currentProfile=currentUser?await loadProfile(currentUser.id):null;
    updateAccountHeader();
    if(event==="SIGNED_OUT"){
      currentUser=null;
      currentProfile=null;
      updateAccountHeader();
    }
  });
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
