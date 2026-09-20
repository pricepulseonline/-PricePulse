const toast=document.getElementById('toast');
function showToast(t){toast.textContent=t;toast.classList.add('show');clearTimeout(window._t);window._t=setTimeout(()=>toast.classList.remove('show'),1800);}
document.querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>document.querySelector(b.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
document.getElementById('headerSearch')?.addEventListener('submit',e=>{e.preventDefault();const q=document.getElementById('headerSearchInput').value.trim();showToast(q?`Searching demo products for "${q}"`:'Type a product to compare');document.getElementById('deals').scrollIntoView({behavior:'smooth'});});
document.querySelectorAll('.category-card').forEach(b=>b.addEventListener('click',()=>{document.getElementById('headerSearchInput').value=b.dataset.q;showToast(`${b.dataset.q} selected`);document.getElementById('deals').scrollIntoView({behavior:'smooth'});}));
document.querySelectorAll('.heart').forEach(b=>b.addEventListener('click',()=>{b.classList.toggle('saved');b.textContent=b.classList.contains('saved')?'♥':'♡';showToast(b.classList.contains('saved')?'Added to wishlist':'Removed from wishlist');}));
document.querySelectorAll('.compare').forEach(b=>b.addEventListener('click',()=>showToast('Live affiliate offers will be connected next.')));
