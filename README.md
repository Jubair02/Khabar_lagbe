# 🍽️ Khabar Lagbe — Fresh Food Delivery

A full-stack food ordering platform with a customer storefront and a **real-time admin dashboard**. Orders placed on the store appear instantly on the dashboard via WebSockets.

## Features

### Customer site (`/`)
- **Accounts**: register / login with JWT auth (passwords hashed with bcrypt)
- **Secure checkout** tied to the logged-in account
- **Real-time order tracking** in "My Orders" — a live status timeline
  (Pending → Processing → Shipped → Delivered) that updates instantly when an admin changes status
- Menu loaded from the server (single source of truth — prices can't be tampered with)
- Search + category filters
- Cart with quantity +/− controls, persisted in `localStorage`
- BD phone validation, accessible markup, SEO/Open Graph tags

### Admin dashboard (`/admin.html`)
- **Protected by admin login** (`/admin-login.html`) — credentials from `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`); all admin APIs require an admin JWT
- **Real-time** — new orders appear instantly (Socket.IO) with a chime + toast
- Live stats: total orders, active, delivered, revenue
- Search (name/phone/address), filter by status, sort by date/total/status
- Inline status updates: Pending → Processing → Shipped → Delivered / Cancelled
- Order details modal, delete order
- Clean, responsive UI (works on mobile)

## Tech stack
Node.js · Express · MongoDB (Mongoose) · Socket.IO · Vanilla JS/CSS

## Getting started

```bash
npm install
# Configure your database (see below), then:
npm start        # or: npm run dev  (auto-restart)
```

- Store:     http://localhost:3000
- Dashboard: http://localhost:3000/admin.html

## Configuration

Copy `.env.example` to `.env` and set your MongoDB connection string:

```
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/khabar_lagbe
PORT=3000
```

## Project structure

```
Khabar_lagbe/
├── server.js            # Express + Socket.IO + REST API
├── models/Order.js      # Mongoose Order schema
├── data/menu.js         # Menu (shared by API + store)
├── public/
│   ├── index.html       # Customer store
│   ├── admin.html       # Admin dashboard
│   ├── css/             # style.css, admin.css
│   └── js/              # app.js (store), admin.js (dashboard)
├── .env                 # secrets (gitignored)
└── README.md
```

## API

| Method | Endpoint                   | Auth  | Purpose                        |
|--------|----------------------------|-------|--------------------------------|
| POST   | `/api/auth/register`       | –     | Create customer account        |
| POST   | `/api/auth/login`          | –     | Log in, returns JWT            |
| GET    | `/api/auth/me`             | ✅    | Current user profile           |
| GET    | `/api/menu`                | –     | Menu items                     |
| POST   | `/api/orders`              | ✅    | Place an order                 |
| GET    | `/api/orders/mine`         | ✅    | The logged-in user's orders    |
| GET    | `/api/orders`              | admin | List all orders (filter/sort)  |
| GET    | `/api/stats`               | admin | Order statistics               |
| PATCH  | `/api/orders/:id/status`   | admin | Update order status            |
| DELETE | `/api/orders/:id`          | admin | Delete an order                |

Real-time (Socket.IO): admins join the `admins` room; each customer joins `user:<id>`.
Events: `order:new`, `order:updated`, `order:deleted` — customers only receive their own.

## ⚠️ Security notes
- Admin login uses a single credential pair from `.env`. For multiple admins or extra safety, move to hashed DB-backed admin accounts.
- Set a strong, random `JWT_SECRET` in `.env` before production.
- Rotate your MongoDB password if it was ever shared in plain text.
