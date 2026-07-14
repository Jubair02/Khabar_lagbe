// Single source of truth for the menu. Shared by the API (price validation)
// and served to the customer site so prices can never be tampered client-side.
const menuItems = [
  { id: 1, name: 'Special Fried Rice', price: 100, img: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=600&auto=format&fit=crop', desc: 'Stir-fried rice with vegetables and egg.', category: 'Rice' },
  { id: 2, name: 'Crispy Chicken', price: 220, img: 'assets/crispy_chicken.jpg', desc: 'Golden fried chicken with secret spices.', category: 'Snacks' },
  { id: 3, name: 'Beef Burger', price: 180, img: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=600&auto=format&fit=crop', desc: 'Juicy beef patty with fresh lettuce and cheese.', category: 'Snacks' },
  { id: 4, name: 'Soft Drinks', price: 50, img: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?q=80&w=600&auto=format&fit=crop', desc: 'Chilled cola or orange soda.', category: 'Drinks' },
  { id: 5, name: 'Chicken Biryani', price: 250, img: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop', desc: 'Aromatic rice with tender chicken pieces.', category: 'Rice' },
  { id: 6, name: 'French Fries', price: 100, img: 'assets/french_fries.jpg', desc: 'Crispy salted potato fries.', category: 'Snacks' },
];

module.exports = { menuItems };
