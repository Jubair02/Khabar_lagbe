// ===================== Khabar Lagbe - Menu page (menu.js) =====================
// Index page only. Depends on common.js (cart, updateCartUI, showToast).

let menuItems = [];
let activeCategory = 'All';
let searchTerm = '';

const menuContainer = document.getElementById('menu-container');
const categoriesContainer = document.getElementById('menu-filters');

async function loadMenu() {
    try {
        const res = await fetch(`${API_BASE}/api/menu`);
        if (!res.ok) throw new Error('menu fetch failed');
        menuItems = await res.json();
    } catch {
        menuItems = FALLBACK_MENU;
    }
    renderCategories();
    renderMenu();
    // Reconcile persisted cart against the current menu (prices/names may have changed)
    cart = cart
        .map((c) => {
            const m = menuItems.find((i) => i.id === c.id);
            return m ? { id: m.id, name: m.name, price: m.price, img: m.img, qty: c.qty } : null;
        })
        .filter(Boolean);
    saveCart();
    updateCartUI();
}

function renderCategories() {
    const categories = ['All', ...new Set(menuItems.map((i) => i.category).filter(Boolean))];
    categoriesContainer.innerHTML = '';
    categories.forEach((cat) => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn' + (cat === activeCategory ? ' active' : '');
        btn.textContent = cat;
        btn.addEventListener('click', () => { activeCategory = cat; renderCategories(); renderMenu(); });
        categoriesContainer.appendChild(btn);
    });
}

function renderMenu() {
    const term = searchTerm.trim().toLowerCase();
    const filtered = menuItems.filter((item) => {
        const matchCat = activeCategory === 'All' || item.category === activeCategory;
        const matchSearch = !term || item.name.toLowerCase().includes(term) || (item.desc || '').toLowerCase().includes(term);
        return matchCat && matchSearch;
    });

    menuContainer.innerHTML = '';
    if (filtered.length === 0) {
        const p = document.createElement('p');
        p.className = 'no-results';
        p.textContent = 'No items match your search.';
        menuContainer.appendChild(p);
        return;
    }

    filtered.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'food-card';

        const img = document.createElement('img');
        img.src = item.img; img.alt = item.name; img.className = 'food-img'; img.loading = 'lazy';

        const info = document.createElement('div'); info.className = 'food-info';
        const name = document.createElement('h3'); name.className = 'food-name'; name.textContent = item.name;
        const desc = document.createElement('p'); desc.className = 'food-desc'; desc.textContent = item.desc || '';

        const footer = document.createElement('div'); footer.className = 'food-footer';
        const price = document.createElement('span'); price.className = 'price'; price.textContent = `৳${item.price}`;
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-sm';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
        addBtn.setAttribute('aria-label', `Add ${item.name} to cart`);
        addBtn.addEventListener('click', () => addToCart(item.id));

        footer.append(price, addBtn);
        info.append(name, desc, footer);
        card.append(img, info);
        menuContainer.appendChild(card);
    });
}

function addToCart(id) {
    const item = menuItems.find((i) => i.id === id);
    if (!item) return;
    const existing = cart.find((i) => i.id === id);
    if (existing) existing.qty++;
    else cart.push({ id: item.id, name: item.name, price: item.price, img: item.img, qty: 1 });
    saveCart();
    updateCartUI();
    showToast(`Added ${item.name} to cart!`);
}

document.getElementById('menu-search-input').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderMenu();
});

// Fallback menu (only used if the API is unreachable)
const FALLBACK_MENU = [
    { id: 1, name: 'Special Fried Rice', price: 100, img: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=600&auto=format&fit=crop', desc: 'Stir-fried rice with vegetables and egg.', category: 'Rice' },
    { id: 2, name: 'Crispy Chicken', price: 220, img: 'assets/crispy_chicken.jpg', desc: 'Golden fried chicken with secret spices.', category: 'Snacks' },
    { id: 3, name: 'Beef Burger', price: 180, img: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=600&auto=format&fit=crop', desc: 'Juicy beef patty with fresh lettuce and cheese.', category: 'Snacks' },
    { id: 4, name: 'Soft Drinks', price: 50, img: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?q=80&w=600&auto=format&fit=crop', desc: 'Chilled cola or orange soda.', category: 'Drinks' },
    { id: 5, name: 'Chicken Biryani', price: 250, img: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop', desc: 'Aromatic rice with tender chicken pieces.', category: 'Rice' },
    { id: 6, name: 'French Fries', price: 100, img: 'assets/french_fries.jpg', desc: 'Crispy salted potato fries.', category: 'Snacks' },
];

document.addEventListener('DOMContentLoaded', loadMenu);
