// ===================== Khabar Lagbe - Shared (common.js) =====================
// Loaded on both index.html and checkout.html. Handles auth, cart sidebar,
// nav, toast, real-time socket, and the account / My-Orders modals.

const API_BASE = '';
const CART_KEY = 'khabar_lagbe_cart';
const TOKEN_KEY = 'khabar_lagbe_token';
const USER_KEY = 'khabar_lagbe_user';

let cart = loadCart();
let token = localStorage.getItem(TOKEN_KEY) || null;
let currentUser = loadUser();
let myOrders = [];
let socket = null;

// --- Persistence ---
function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
function loadUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; } catch { return null; }
}
function setAuth(t, user) {
    token = t; currentUser = user;
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    reflectAuthState();
    connectSocket();
}
function clearAuth() {
    token = null; currentUser = null; myOrders = [];
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    reflectAuthState();
    if (socket) { socket.disconnect(); socket = null; }
}
function authHeaders() { return token ? { Authorization: `Bearer ${token}` } : {}; }

// ===================== Cart (shared sidebar) =====================

function changeQty(id, delta) {
    const item = cart.find((i) => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter((i) => i.id !== id);
    saveCart();
    updateCartUI();
}
function removeFromCart(id) {
    cart = cart.filter((item) => item.id !== id);
    saveCart();
    updateCartUI();
}
function cartTotal() { return cart.reduce((acc, i) => acc + i.price * i.qty, 0); }
function cartCount() { return cart.reduce((acc, i) => acc + i.qty, 0); }

function updateCartUI() {
    const countEl = document.getElementById('cart-count');
    const container = document.getElementById('cart-items-container');
    const cartTotalEl = document.getElementById('cart-total-price');
    const checkoutBtn = document.getElementById('checkout-btn');

    if (countEl) countEl.textContent = cartCount();

    if (container) {
        container.innerHTML = '';
        if (cart.length === 0) {
            const p = document.createElement('p');
            p.style.cssText = 'text-align:center; color:#999; margin-top:20px;';
            p.textContent = 'Your cart is empty.';
            container.appendChild(p);
            if (checkoutBtn) checkoutBtn.disabled = true;
        } else {
            cart.forEach((item) => container.appendChild(cartRow(item)));
            if (checkoutBtn) checkoutBtn.disabled = false;
        }
    }
    if (cartTotalEl) cartTotalEl.textContent = '৳' + cartTotal();

    // Let the current page react (e.g. checkout page re-renders its review)
    if (typeof window.onCartUpdated === 'function') window.onCartUpdated();
}

function cartRow(item) {
    const row = document.createElement('div'); row.className = 'cart-item';
    const img = document.createElement('img'); img.src = item.img; img.alt = item.name;
    const info = document.createElement('div'); info.className = 'cart-item-info';
    const title = document.createElement('div'); title.className = 'cart-item-title'; title.textContent = item.name;
    const price = document.createElement('div'); price.className = 'cart-item-price';
    price.textContent = `৳${item.price} x ${item.qty} = ৳${item.price * item.qty}`;

    const qtyControls = document.createElement('div'); qtyControls.className = 'qty-controls';
    const minus = document.createElement('button'); minus.className = 'qty-btn'; minus.textContent = '−';
    minus.setAttribute('aria-label', `Decrease ${item.name}`);
    minus.addEventListener('click', () => changeQty(item.id, -1));
    const qtyVal = document.createElement('span'); qtyVal.className = 'qty-value'; qtyVal.textContent = item.qty;
    const plus = document.createElement('button'); plus.className = 'qty-btn'; plus.textContent = '+';
    plus.setAttribute('aria-label', `Increase ${item.name}`);
    plus.addEventListener('click', () => changeQty(item.id, 1));
    qtyControls.append(minus, qtyVal, plus);

    info.append(title, price, qtyControls);

    const remove = document.createElement('button'); remove.className = 'cart-item-remove';
    remove.innerHTML = '<i class="fas fa-trash"></i>';
    remove.setAttribute('aria-label', `Remove ${item.name}`);
    remove.addEventListener('click', () => removeFromCart(item.id));

    row.append(img, info, remove);
    return row;
}

function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    closeMobileMenu();
}

// Cart "Checkout" button -> dedicated checkout page
function goToCheckout() {
    if (cart.length === 0) { showToast('Your cart is empty!', 'error'); return; }
    window.location.href = 'checkout.html';
}

// ===================== Toast =====================
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const msgEl = document.getElementById('toast-message');
    const icon = toast.querySelector('i');
    msgEl.textContent = msg;
    if (type === 'error') {
        toast.style.borderLeftColor = 'var(--danger)';
        icon.className = 'fas fa-exclamation-circle';
        icon.style.color = 'var(--danger)';
    } else {
        toast.style.borderLeftColor = 'var(--primary-color)';
        icon.className = 'fas fa-check-circle';
        icon.style.color = 'var(--success)';
    }
    toast.classList.add('active');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('active'), 3000);
}

// ===================== Nav / mobile menu =====================
const mobileMenu = document.getElementById('mobile-menu');
const navLinks = document.querySelector('.nav-links');

function closeMobileMenu() {
    if (!navLinks || !navLinks.classList.contains('active')) return;
    navLinks.classList.remove('active');
    const icon = mobileMenu.querySelector('i');
    icon.classList.remove('fa-times'); icon.classList.add('fa-bars');
}
if (mobileMenu) {
    mobileMenu.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = mobileMenu.querySelector('i');
        const open = navLinks.classList.contains('active');
        icon.classList.toggle('fa-bars', !open);
        icon.classList.toggle('fa-times', open);
    });
}
document.querySelectorAll('.nav-link').forEach((link) => link.addEventListener('click', closeMobileMenu));
window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (header) header.classList.toggle('sticky', window.scrollY > 0);
});

// ===================== Auth UI =====================
const authModal = document.getElementById('auth-modal');
const authError = document.getElementById('auth-error');
const accountMenu = document.getElementById('account-menu');

function openAuthModal() { authError.classList.remove('active'); authModal.classList.add('active'); }
function closeAuthModal() { authModal.classList.remove('active'); }
function showAuthError(msg) { authError.textContent = msg; authError.classList.add('active'); }

if (authModal) {
    document.getElementById('login-btn').addEventListener('click', openAuthModal);
    document.getElementById('auth-close').addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });

    document.querySelectorAll('.auth-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
            authError.classList.remove('active');
        });
    });

    document.getElementById('account-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        accountMenu.classList.toggle('active');
    });
    document.addEventListener('click', () => accountMenu.classList.remove('active'));
    document.getElementById('logout-btn').addEventListener('click', () => { clearAuth(); showToast('Logged out.'); });
    document.getElementById('my-orders-btn').addEventListener('click', openOrdersModal);

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('login-email').value.trim(),
                    password: document.getElementById('login-password').value,
                }),
            });
            const data = await res.json();
            if (!res.ok) return showAuthError(data.error || 'Login failed.');
            setAuth(data.token, data.user);
            closeAuthModal(); e.target.reset();
            showToast(`Welcome back, ${data.user.name}!`);
        } catch { showAuthError('Server unreachable. Try again.'); }
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('reg-name').value.trim(),
            email: document.getElementById('reg-email').value.trim(),
            phone: document.getElementById('reg-phone').value.trim(),
            address: document.getElementById('reg-address').value.trim(),
            password: document.getElementById('reg-password').value,
        };
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) return showAuthError(data.error || 'Registration failed.');
            setAuth(data.token, data.user);
            closeAuthModal(); e.target.reset();
            showToast(`Account created. Welcome, ${data.user.name}!`);
        } catch { showAuthError('Server unreachable. Try again.'); }
    });
}

function reflectAuthState() {
    const loginBtn = document.getElementById('login-btn');
    const accountBtn = document.getElementById('account-btn');
    if (!loginBtn || !accountBtn) return;
    if (currentUser) {
        loginBtn.style.display = 'none';
        accountBtn.style.display = 'flex';
        document.getElementById('account-name').textContent = currentUser.name.split(' ')[0];
        document.getElementById('account-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
        document.getElementById('menu-user-name').textContent = currentUser.name;
        document.getElementById('menu-user-email').textContent = currentUser.email;
        // Prefill checkout fields if present on this page
        const phoneInput = document.getElementById('phone');
        const addressInput = document.getElementById('address');
        if (phoneInput && !phoneInput.value) phoneInput.value = currentUser.phone || '';
        if (addressInput && !addressInput.value) addressInput.value = currentUser.address || '';
    } else {
        loginBtn.style.display = 'inline-block';
        accountBtn.style.display = 'none';
    }
    if (typeof window.onAuthChanged === 'function') window.onAuthChanged();
}

// ===================== Socket.IO real-time tracking =====================
function connectSocket() {
    if (!token) return;
    if (socket) socket.disconnect();
    socket = io();
    socket.on('connect', () => socket.emit('customer:join', token));
    socket.on('order:new', (order) => upsertOrder(order));
    socket.on('order:updated', (order) => {
        upsertOrder(order);
        showToast(`Order #${order._id.slice(-6).toUpperCase()} is now ${order.status}`);
        renderOrdersIfOpen();
    });
    socket.on('order:deleted', ({ _id }) => {
        myOrders = myOrders.filter((o) => o._id !== _id);
        renderOrdersIfOpen();
    });
}
function upsertOrder(order) {
    const idx = myOrders.findIndex((o) => o._id === order._id);
    if (idx !== -1) myOrders[idx] = order; else myOrders.unshift(order);
    renderOrdersIfOpen();
}

// ===================== My Orders modal + tracking =====================
const ordersModal = document.getElementById('orders-modal');
const ordersListEl = document.getElementById('orders-list');
const TRACK_STEPS = ['Pending', 'Processing', 'Shipped', 'Delivered'];

async function openOrdersModal() {
    if (accountMenu) accountMenu.classList.remove('active');
    if (!currentUser) return openAuthModal();
    ordersModal.classList.add('active');
    ordersListEl.innerHTML = '<div class="orders-empty"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';
    try {
        const res = await fetch('/api/orders/mine', { headers: authHeaders() });
        if (res.status === 401) { clearAuth(); closeOrdersModal(); return openAuthModal(); }
        myOrders = await res.json();
        renderOrders();
    } catch {
        ordersListEl.innerHTML = '<div class="orders-empty"><i class="fas fa-triangle-exclamation"></i><p>Could not load orders.</p></div>';
    }
}
function closeOrdersModal() { ordersModal.classList.remove('active'); }
if (ordersModal) {
    document.getElementById('orders-close').addEventListener('click', closeOrdersModal);
    ordersModal.addEventListener('click', (e) => { if (e.target === ordersModal) closeOrdersModal(); });
}
function renderOrdersIfOpen() { if (ordersModal && ordersModal.classList.contains('active')) renderOrders(); }

function fmtDate(d) {
    return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function renderOrders() {
    ordersListEl.innerHTML = '';
    if (!myOrders.length) {
        ordersListEl.innerHTML = '<div class="orders-empty"><i class="fas fa-box-open"></i><p>You have no orders yet.</p></div>';
        return;
    }
    myOrders.forEach((o) => ordersListEl.appendChild(orderCard(o)));
}
function orderCard(o) {
    const card = document.createElement('div'); card.className = 'order-card';
    const head = document.createElement('div'); head.className = 'order-card-head';
    const left = document.createElement('div');
    const oid = document.createElement('div'); oid.className = 'oid'; oid.textContent = `Order #${o._id.slice(-6).toUpperCase()}`;
    const odate = document.createElement('div'); odate.className = 'odate'; odate.textContent = fmtDate(o.createdAt);
    left.append(oid, odate);
    const pill = document.createElement('span'); pill.className = `status-pill ${o.status}`; pill.textContent = o.status;
    head.append(left, pill);

    const items = document.createElement('div'); items.className = 'order-card-items';
    items.textContent = o.items.map((i) => `${i.name} ×${i.qty}`).join(', ');
    const total = document.createElement('div'); total.className = 'order-card-total'; total.textContent = 'Total: ৳' + o.total;

    card.append(head, items, total, buildTracker(o.status));
    return card;
}
function buildTracker(status) {
    if (status === 'Cancelled') {
        const c = document.createElement('div'); c.className = 'tracker-cancelled';
        c.innerHTML = '<i class="fas fa-circle-xmark"></i> This order was cancelled.';
        return c;
    }
    const currentIndex = TRACK_STEPS.indexOf(status);
    const tracker = document.createElement('div'); tracker.className = 'tracker';
    TRACK_STEPS.forEach((label, i) => {
        const step = document.createElement('div');
        step.className = 'step' + (i < currentIndex ? ' done' : i === currentIndex ? ' current' : '');
        const dot = document.createElement('div'); dot.className = 'dot-step';
        dot.innerHTML = i < currentIndex ? '<i class="fas fa-check"></i>' : (i + 1);
        const lbl = document.createElement('div'); lbl.className = 'step-label'; lbl.textContent = label;
        step.append(dot, lbl);
        tracker.appendChild(step);
    });
    return tracker;
}

// Inline handlers used by HTML
window.toggleCart = toggleCart;
window.goToCheckout = goToCheckout;
window.openOrdersModal = openOrdersModal;

// ===================== Init (shared) =====================
document.addEventListener('DOMContentLoaded', async () => {
    updateCartUI();
    reflectAuthState();
    if (token) {
        try {
            const res = await fetch('/api/auth/me', { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                currentUser = data.user;
                localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
                reflectAuthState();
                connectSocket();
            } else {
                clearAuth();
            }
        } catch { /* offline: keep cached session */ }
    }
});
