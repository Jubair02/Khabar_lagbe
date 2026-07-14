// ===================== Khabar Lagbe - Admin Dashboard =====================

const ADMIN_TOKEN_KEY = 'khabar_lagbe_admin_token';
const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);

// Gate: no token -> go to login
if (!adminToken) location.replace('admin-login.html');

function adminHeaders(extra = {}) {
    return { Authorization: `Bearer ${adminToken}`, ...extra };
}
function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    location.replace('admin-login.html');
}
// Any 401/403 means the session is invalid -> back to login
function guard(res) {
    if (res.status === 401 || res.status === 403) { logout(); return false; }
    return true;
}

const STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

let orders = [];
let filters = { search: '', status: '', sort: '-createdAt' };
let searchDebounce;

// --- DOM refs ---
const tbody = document.getElementById('orders-body');
const connDot = document.getElementById('conn-dot');
const connText = document.getElementById('conn-text');

// --- Socket.IO real-time ---
const socket = io();

socket.on('connect', () => {
    socket.emit('admin:join', adminToken);
    connDot.classList.add('online');
    connText.textContent = 'Live';
});
socket.on('disconnect', () => {
    connDot.classList.remove('online');
    connText.textContent = 'Offline';
});

socket.on('order:new', (order) => {
    // Insert if it passes the current filters
    orders.unshift(order);
    notify(`New order from ${order.customer.name}!`);
    playChime();
    applyAndRender(order._id);
    loadStats();
});

socket.on('order:updated', (order) => {
    const idx = orders.findIndex((o) => o._id === order._id);
    if (idx !== -1) orders[idx] = order;
    applyAndRender();
    loadStats();
});

socket.on('order:deleted', ({ _id }) => {
    orders = orders.filter((o) => o._id !== _id);
    applyAndRender();
    loadStats();
});

// --- Data loading ---
async function loadOrders() {
    try {
        const res = await fetch('/api/orders', { headers: adminHeaders() });
        if (!guard(res)) return;
        orders = await res.json();
        applyAndRender();
    } catch {
        notify('Failed to load orders.');
    }
}

async function loadStats() {
    try {
        const res = await fetch('/api/stats', { headers: adminHeaders() });
        if (!guard(res)) return;
        const s = await res.json();
        document.getElementById('stat-total').textContent = s.total;
        document.getElementById('stat-pending').textContent = s.counts.Pending + s.counts.Processing;
        document.getElementById('stat-delivered').textContent = s.counts.Delivered;
        document.getElementById('stat-revenue').textContent = '৳' + (s.revenue || 0).toLocaleString();
    } catch { /* ignore */ }
}

// --- Filtering / sorting (client-side over loaded set) ---
function getFilteredOrders() {
    let result = [...orders];
    const term = filters.search.trim().toLowerCase();
    if (term) {
        result = result.filter((o) =>
            o.customer.name.toLowerCase().includes(term) ||
            o.customer.phone.includes(term) ||
            o.customer.address.toLowerCase().includes(term)
        );
    }
    if (filters.status) result = result.filter((o) => o.status === filters.status);

    const [key, dir] = filters.sort.startsWith('-') ? [filters.sort.slice(1), -1] : [filters.sort, 1];
    result.sort((a, b) => {
        let av, bv;
        if (key === 'total') { av = a.total; bv = b.total; }
        else if (key === 'status') { av = a.status; bv = b.status; }
        else { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); }
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
    });
    return result;
}

function applyAndRender(flashId) {
    render(getFilteredOrders(), flashId);
}

// --- Rendering ---
function fmtDate(d) {
    const dt = new Date(d);
    return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function render(list, flashId) {
    tbody.innerHTML = '';
    if (list.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No orders found.</p></div>';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    list.forEach((o) => {
        const tr = document.createElement('tr');
        if (flashId && o._id === flashId) tr.className = 'flash';

        // Order ID (short)
        const idTd = document.createElement('td');
        idTd.innerHTML = `<strong>#${o._id.slice(-6).toUpperCase()}</strong>`;

        // Customer
        const custTd = document.createElement('td');
        const nm = document.createElement('div'); nm.className = 'cust-name'; nm.textContent = o.customer.name;
        const ph = document.createElement('div'); ph.className = 'cust-phone'; ph.textContent = o.customer.phone;
        custTd.append(nm, ph);

        // Items count
        const itemsTd = document.createElement('td');
        const count = o.items.reduce((a, i) => a + i.qty, 0);
        itemsTd.textContent = `${count} item${count > 1 ? 's' : ''}`;

        // Total
        const totalTd = document.createElement('td');
        totalTd.className = 'order-total';
        totalTd.textContent = '৳' + o.total;

        // Date
        const dateTd = document.createElement('td');
        dateTd.textContent = fmtDate(o.createdAt);

        // Status (badge + inline select)
        const statusTd = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'status-select';
        STATUSES.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            if (s === o.status) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener('change', () => updateStatus(o._id, select.value));
        statusTd.appendChild(select);

        // Actions
        const actionTd = document.createElement('td');
        const viewBtn = document.createElement('button');
        viewBtn.className = 'icon-btn';
        viewBtn.title = 'View details';
        viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
        viewBtn.addEventListener('click', () => openModal(o));
        const delBtn = document.createElement('button');
        delBtn.className = 'icon-btn danger';
        delBtn.title = 'Delete';
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        delBtn.addEventListener('click', () => deleteOrder(o._id));
        actionTd.append(viewBtn, delBtn);

        tr.append(idTd, custTd, itemsTd, totalTd, dateTd, statusTd, actionTd);
        tbody.appendChild(tr);
    });
}

// --- Actions ---
async function updateStatus(id, status) {
    try {
        const res = await fetch(`/api/orders/${id}/status`, {
            method: 'PATCH',
            headers: adminHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ status }),
        });
        if (!guard(res)) return;
        if (!res.ok) throw new Error();
        notify(`Status updated to ${status}.`);
        // socket 'order:updated' will refresh the view
    } catch {
        notify('Failed to update status.');
    }
}

async function deleteOrder(id) {
    if (!confirm('Delete this order permanently?')) return;
    try {
        const res = await fetch(`/api/orders/${id}`, { method: 'DELETE', headers: adminHeaders() });
        if (!guard(res)) return;
        if (!res.ok) throw new Error();
        notify('Order deleted.');
    } catch {
        notify('Failed to delete order.');
    }
}

// --- Modal ---
const modalOverlay = document.getElementById('modal-overlay');
function openModal(o) {
    document.getElementById('modal-title').textContent = `Order #${o._id.slice(-6).toUpperCase()}`;
    const body = document.getElementById('modal-body');
    body.innerHTML = '';

    const rows = [
        ['Customer', o.customer.name],
        ['Phone', o.customer.phone],
        ['Address', o.customer.address],
        ['Status', o.status],
        ['Placed', fmtDate(o.createdAt)],
    ];
    rows.forEach(([k, v]) => {
        const row = document.createElement('div');
        row.className = 'detail-row';
        const kEl = document.createElement('span'); kEl.className = 'k'; kEl.textContent = k;
        const vEl = document.createElement('span'); vEl.className = 'v'; vEl.textContent = v;
        row.append(kEl, vEl);
        body.appendChild(row);
    });

    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'detail-items';
    const h = document.createElement('h4'); h.textContent = 'Items';
    itemsWrap.appendChild(h);
    o.items.forEach((it) => {
        const el = document.createElement('div');
        el.className = 'detail-item';
        const left = document.createElement('span'); left.textContent = `${it.name} × ${it.qty}`;
        const right = document.createElement('span'); right.textContent = '৳' + it.price * it.qty;
        el.append(left, right);
        itemsWrap.appendChild(el);
    });
    body.appendChild(itemsWrap);

    const totalRow = document.createElement('div');
    totalRow.className = 'detail-row';
    totalRow.style.marginTop = '12px';
    totalRow.innerHTML = `<span class="k" style="font-size:1.05rem;font-weight:700;">Total</span><span class="v" style="font-size:1.05rem;color:var(--primary-dark);">৳${o.total}</span>`;
    body.appendChild(totalRow);

    modalOverlay.classList.add('active');
}
function closeModal() { modalOverlay.classList.remove('active'); }
document.getElementById('modal-close').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// --- Controls wiring ---
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { filters.search = e.target.value; applyAndRender(); }, 200);
});
document.getElementById('status-filter').addEventListener('change', (e) => { filters.status = e.target.value; applyAndRender(); });
document.getElementById('sort-select').addEventListener('change', (e) => { filters.sort = e.target.value; applyAndRender(); });

// --- Toast ---
let noteTimer;
function notify(msg) {
    const el = document.getElementById('toast-note');
    document.getElementById('toast-note-msg').textContent = msg;
    el.classList.add('active');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => el.classList.remove('active'), 3000);
}

// --- New-order chime (WebAudio, no asset needed) ---
function playChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(880, ctx.currentTime);
        o.frequency.setValueAtTime(1174, ctx.currentTime + 0.12);
        g.gain.setValueAtTime(0.2, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        o.start();
        o.stop(ctx.currentTime + 0.4);
    } catch { /* autoplay may be blocked until user interacts */ }
}

// --- Mobile sidebar ---
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
document.getElementById('hamburger').addEventListener('click', () => {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
});
backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
});

// --- Logout ---
document.getElementById('logout-link').addEventListener('click', (e) => { e.preventDefault(); logout(); });

// --- Init ---
loadOrders();
loadStats();
