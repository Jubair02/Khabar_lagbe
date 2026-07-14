// ===================== Khabar Lagbe - Checkout page (checkout.js) =====================
// Depends on common.js (cart, auth, socket, toast, cartRow, upsertOrder).

const reviewEl = document.getElementById('checkout-items');
const emptyEl = document.getElementById('checkout-empty');
const summaryEl = document.getElementById('checkout-summary');
const summaryText = document.getElementById('order-summary-text');
const formTotal = document.getElementById('form-total');

const form = document.getElementById('order-form');
const phoneInput = document.getElementById('phone');
const addressInput = document.getElementById('address');

[phoneInput, addressInput].forEach((input) => {
    input.addEventListener('input', function () {
        this.classList.remove('error');
        if (this.nextElementSibling) this.nextElementSibling.style.display = 'none';
    });
});
function showError(input) {
    input.classList.add('error');
    if (input.nextElementSibling) input.nextElementSibling.style.display = 'block';
}

// Re-render the checkout review whenever the cart changes (hook called by common.js)
window.onCartUpdated = function () {
    reviewEl.innerHTML = '';
    if (cart.length === 0) {
        emptyEl.style.display = 'block';
        summaryEl.style.display = 'none';
        form.style.display = 'none';
        return;
    }
    emptyEl.style.display = 'none';
    summaryEl.style.display = 'block';
    form.style.display = 'block';

    cart.forEach((item) => reviewEl.appendChild(cartRow(item)));
    summaryText.textContent = cart.map((i) => `${i.name} (x${i.qty})`).join(', ');
    formTotal.textContent = '৳' + cartTotal();
};

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
        showToast('Please log in to place your order.', 'error');
        openAuthModal();
        return;
    }

    let isValid = true;
    if (phoneInput.value && !/^01[3-9]\d{8}$/.test(phoneInput.value.trim())) { showError(phoneInput); isValid = false; }
    if (addressInput.value.trim() === '') { showError(addressInput); isValid = false; }
    if (cart.length === 0) { showToast('Your cart is empty!', 'error'); isValid = false; }
    if (!isValid) return;

    const payload = {
        phone: phoneInput.value.trim() || currentUser.phone,
        address: addressInput.value.trim(),
        items: cart.map((i) => ({ id: i.id, qty: i.qty })),
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Placing order...';

    try {
        const res = await fetch(`${API_BASE}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.status === 401) {
            clearAuth();
            showToast('Please log in again.', 'error');
            openAuthModal();
        } else if (!res.ok) {
            showToast(data.error || 'Could not place order.', 'error');
        } else {
            upsertOrder(data);
            cart = [];
            saveCart();
            updateCartUI();
            showConfirmation(data);
        }
    } catch {
        showToast('Server unreachable. Please try again.', 'error');
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirm Order';
});

// Success screen shown after placing an order
function showConfirmation(order) {
    document.getElementById('checkout-main').style.display = 'none';
    const done = document.getElementById('checkout-done');
    document.getElementById('done-order-id').textContent = '#' + order._id.slice(-6).toUpperCase();
    document.getElementById('done-total').textContent = '৳' + order.total;
    done.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.getElementById('track-order-btn').addEventListener('click', openOrdersModal);

// If arriving on this page not logged in, gently prompt (but allow browsing the cart)
document.addEventListener('DOMContentLoaded', () => {
    window.onCartUpdated();
    window.onAuthChanged = () => {
        if (phoneInput && !phoneInput.value && currentUser) phoneInput.value = currentUser.phone || '';
        if (addressInput && !addressInput.value && currentUser) addressInput.value = currentUser.address || '';
    };
});
