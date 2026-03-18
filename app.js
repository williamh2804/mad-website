/* ============================================
   MAD — Shared JS (cart, header, hours, toast)
   ============================================ */

const WA_NUMBER   = '2347047792000';
const PS_KEY      = 'pk_test_REPLACE_WITH_YOUR_PAYSTACK_PUBLIC_KEY';

/* ===== HOURS ===== */
function isOpen() {
  const now  = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const adj  = mins < 12 * 60 ? mins + 1440 : mins;
  return adj >= 720 && adj < 1620; // 12:00 → 3:00
}

function updateStatus() {
  const open = isOpen();
  // header
  const dot  = document.getElementById('sdot');
  const stxt = document.getElementById('stxt');
  if (dot)  dot.className  = open ? 'sdot' : 'sdot off';
  if (stxt) stxt.innerHTML = open
    ? '<b>Open Now</b> · Until 3AM'
    : '<b>Closed</b> · Opens 12PM';
  // hours banner
  const hd = document.getElementById('hBannerDot');
  const ht = document.getElementById('hBannerTxt');
  if (hd) hd.className = open ? 'sdot' : 'sdot off';
  if (ht) ht.textContent = open ? "We're open right now!" : "Currently closed · Opens at 12:00 PM";
}

/* ===== CART STATE (localStorage) ===== */
function getCart() {
  try { return JSON.parse(localStorage.getItem('mad_cart') || '{}'); } catch { return {}; }
}
function saveCart(c) {
  localStorage.setItem('mad_cart', JSON.stringify(c));
}
function cartCount(c) { return Object.values(c).reduce((s,v)=>s+v.qty,0); }
function cartTotal(c) { return Object.values(c).reduce((s,v)=>s+v.price*v.qty,0); }

function addItem(name, price, emoji) {
  const c = getCart();
  c[name] = c[name] ? {...c[name], qty: c[name].qty+1} : {name, price, emoji, qty:1};
  saveCart(c);
  updateBadge();
  showToast('Added to order!');
}

function changeQty(id, delta) {
  const c = getCart();
  if (!c[id]) return;
  c[id].qty += delta;
  if (c[id].qty <= 0) delete c[id];
  saveCart(c);
  updateBadge();
  renderCartItems();
  updateTotals();
}

function updateBadge() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = cartCount(getCart());
}

/* ===== CART SIDEBAR ===== */
let cartStep = 1;
let payMethod = null;

function openCart() {
  document.getElementById('cartSide').classList.add('on');
  document.getElementById('overlay').classList.add('on');
  renderCartItems();
  updateTotals();
}
function closeCart() {
  document.getElementById('cartSide').classList.remove('on');
  document.getElementById('overlay').classList.remove('on');
}

function renderCartItems() {
  const c = getCart();
  const entries = Object.entries(c);
  const el = document.getElementById('cartItemsBody');
  if (!el) return;
  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">🍔</span><p>Your order is empty</p></div>`;
    return;
  }
  el.innerHTML = entries.map(([id, item]) => `
    <div class="ci">
      <span class="ci-em">${item.emoji}</span>
      <div class="ci-inf">
        <div class="ci-name">${item.name}</div>
        <div class="ci-px">₦${(item.price * item.qty).toLocaleString()}</div>
      </div>
      <div class="qc">
        <button class="qb" onclick="changeQty('${id.replace(/'/g,"\\'")}', -1)">−</button>
        <span class="qn">${item.qty}</span>
        <button class="qb" onclick="changeQty('${id.replace(/'/g,"\\'")}', 1)">+</button>
      </div>
    </div>`).join('');
}

function updateTotals() {
  const c = getCart();
  const t = cartTotal(c);
  const sub = document.getElementById('csSubtotal');
  const gt  = document.getElementById('csGrand');
  if (sub) sub.textContent = '₦' + t.toLocaleString();
  if (gt)  gt.textContent  = '₦' + t.toLocaleString();
  const btn = document.getElementById('csAction');
  if (btn) btn.disabled = cartCount(c) === 0;
}

function setStep(n) {
  cartStep = n;
  ['csStep1','csStep2','csStep3'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = (i+1===n) ? 'block' : 'none';
    el.classList.toggle('on', i+1===n);
  });
  const labels = ['① Cart','② Details','③ Payment'];
  ['cs-s1','cs-s2','cs-s3'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'cs-step' + (i+1===n ? ' active' : (i+1<n ? ' done' : ''));
  });
  const bk = document.getElementById('csBack');
  if (bk) bk.style.display = n > 1 ? 'block' : 'none';
  const actionLabels = ['Continue to Details →','Continue to Payment →','Place Order'];
  const btn = document.getElementById('csAction');
  if (btn) btn.textContent = actionLabels[n-1];
  if (n===3 && btn) btn.disabled = !payMethod;
}

function csGoBack() { if (cartStep > 1) setStep(cartStep - 1); }

function csHandleAction() {
  if (cartStep === 1) { setStep(2); return; }
  if (cartStep === 2) { if (!validateDeliveryForm()) return; setStep(3); return; }
  if (cartStep === 3) {
    if (!payMethod) { showToast('Choose a payment method'); return; }
    if (payMethod === 'whatsapp') doWhatsApp();
    else openPayModal();
  }
}

function selectMethod(m) {
  payMethod = m;
  document.getElementById('mcPaystack').classList.toggle('sel', m==='paystack');
  document.getElementById('mcWA').classList.toggle('sel', m==='whatsapp');
  const note = document.getElementById('methodNote');
  if (note) note.textContent = m==='paystack'
    ? '💳 Secure card or bank transfer payment via Paystack.'
    : '💬 Order sent to WhatsApp. Our team will confirm and collect payment on delivery.';
  const btn = document.getElementById('csAction');
  if (btn) btn.disabled = false;
}

/* ===== FORM VALIDATION ===== */
function validateDeliveryForm() {
  let ok = true;
  [['df-fname','df-fnameE'],['df-lname','df-lnameE'],['df-phone','df-phoneE'],['df-address','df-addrE']].forEach(([fid,eid]) => {
    const v = document.getElementById(fid)?.value.trim();
    const e = document.getElementById(eid);
    if (!v) { if(e) e.style.display='block'; ok=false; }
    else { if(e) e.style.display='none'; }
  });
  if (!ok) showToast('Fill in all required fields');
  return ok;
}

/* ===== WHATSAPP ===== */
function buildWAMsg() {
  const c       = getCart();
  const lines   = Object.values(c).map(i=>`• ${i.name} x${i.qty} — ₦${(i.price*i.qty).toLocaleString()}`).join('\n');
  const total   = cartTotal(c);
  const fname   = document.getElementById('df-fname')?.value.trim() || '';
  const lname   = document.getElementById('df-lname')?.value.trim() || '';
  const phone   = document.getElementById('df-phone')?.value.trim() || '';
  const address = document.getElementById('df-address')?.value.trim() || '';
  const notes   = document.getElementById('df-notes')?.value.trim() || '';
  const id      = '#MAD-' + Math.floor(1000+Math.random()*9000);
  window._lastOrderId = id;
  return `🍔 *NEW ORDER — Munchies After Dark*\n\n`
    + `*Order ID:* ${id}\n\n`
    + `*Items:*\n${lines}\n\n`
    + `*Total:* ₦${total.toLocaleString()}\n\n`
    + `*Name:* ${fname} ${lname}\n`
    + `*Phone:* ${phone}\n`
    + `*Address:* ${address}\n`
    + (notes ? `*Notes:* ${notes}\n` : '')
    + `\n_via munchiesafterdark.com_`;
}

function doWhatsApp() {
  const msg = encodeURIComponent(buildWAMsg());
  window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, '_blank');
  showSuccess(window._lastOrderId || '#MAD-0000', 'whatsapp');
  resetCart();
  closeCart();
}

/* ===== PAYSTACK ===== */
function openPayModal() {
  const email = document.getElementById('df-email')?.value.trim();
  if (email) { const pe = document.getElementById('payEmail'); if(pe) pe.value = email; }
  const pa = document.getElementById('payAmount');
  if (pa) pa.textContent = '₦' + cartTotal(getCart()).toLocaleString();
  const m = document.getElementById('payModal');
  if (m) m.classList.add('on');
}
function closePayModal() {
  const m = document.getElementById('payModal');
  if (m) m.classList.remove('on');
}

function doPaystack() {
  const email = document.getElementById('payEmail')?.value.trim();
  const errEl = document.getElementById('payEmailErr');
  if (!email || !email.includes('@')) { if(errEl) errEl.style.display='block'; return; }
  if (errEl) errEl.style.display='none';
  if (typeof PaystackPop === 'undefined') { showToast('Add Paystack key to activate payments'); return; }
  const fname   = document.getElementById('df-fname')?.value.trim()||'';
  const lname   = document.getElementById('df-lname')?.value.trim()||'';
  const address = document.getElementById('df-address')?.value.trim()||'';
  const c       = getCart();
  const orderId = '#MAD-' + Math.floor(1000+Math.random()*9000);
  const handler = PaystackPop.setup({
    key: PS_KEY, email,
    amount: cartTotal(c) * 100,
    currency: 'NGN',
    ref: orderId.replace('#',''),
    metadata: { custom_fields: [
      {display_name:'Name',variable_name:'name',value:`${fname} ${lname}`},
      {display_name:'Address',variable_name:'address',value:address},
      {display_name:'Order',variable_name:'items',value:Object.values(c).map(i=>`${i.name}x${i.qty}`).join(',')}
    ]},
    callback: () => { closePayModal(); showSuccess(orderId,'paystack'); resetCart(); closeCart(); },
    onClose: () => showToast('Payment cancelled')
  });
  handler.openIframe();
}

/* ===== SUCCESS ===== */
function showSuccess(id, method) {
  const m = document.getElementById('sucModal');
  if (!m) return;
  document.getElementById('sucIcon').textContent  = method==='whatsapp' ? '💬' : '🎉';
  document.getElementById('sucTitle').textContent = method==='whatsapp' ? 'Order Sent!' : 'Order Placed!';
  document.getElementById('sucSub').textContent   = method==='whatsapp'
    ? 'Your order has been sent to our WhatsApp. We'll confirm and arrange delivery shortly.'
    : 'Payment confirmed! Your order is being prepared and will be delivered to you.';
  document.getElementById('sucId').textContent = id;
  m.classList.add('on');
}
function closeSuc() {
  document.getElementById('sucModal')?.classList.remove('on');
}

function resetCart() {
  saveCart({});
  updateBadge();
  payMethod = null;
  ['df-fname','df-lname','df-phone','df-email','df-address','df-notes','payEmail'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['mcPaystack','mcWA'].forEach(id=>{
    document.getElementById(id)?.classList.remove('sel');
  });
  const note = document.getElementById('methodNote');
  if (note) note.textContent = '';
  renderCartItems();
  updateTotals();
  setStep(1);
}

/* ===== TOAST ===== */
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2400);
}

/* ===== MOBILE NAV ===== */
function openMobNav() { document.getElementById('mobNav')?.classList.add('on'); document.getElementById('overlay')?.classList.add('on'); }
function closeMobNav() { document.getElementById('mobNav')?.classList.remove('on'); document.getElementById('overlay')?.classList.remove('on'); }

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  updateStatus();
  setInterval(updateStatus, 60000);
  updateBadge();
  if (typeof setStep === 'function') setStep(1);
  renderCartItems();
  updateTotals();

  // header scroll shadow
  window.addEventListener('scroll', () => {
    document.getElementById('hdr')?.classList.toggle('scrolled', window.scrollY > 40);
  });

  // overlay closes both nav and cart
  document.getElementById('overlay')?.addEventListener('click', () => {
    closeCart();
    closeMobNav();
  });
});
