require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const Order = require('./models/Order');
const User = require('./models/User');
const { menuItems } = require('./data/menu');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---
const VALID_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const menuById = new Map(menuItems.map((m) => [m.id, m]));

function signToken(user) {
  return jwt.sign({ id: user._id, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Customer auth middleware — requires a valid Bearer token
function auth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// Admin auth middleware — requires a valid admin token
function adminAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Admin authentication required.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access only.' });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Admin session expired. Please log in again.' });
  }
}

// ===================== Auth Routes =====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, address } = req.body || {};
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Name, email, phone and password are required.' });
    }
    if (!/^01[3-9]\d{8}$/.test(String(phone).trim())) {
      return res.status(400).json({ error: 'Invalid Bangladeshi phone number.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });

    const user = new User({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      phone: String(phone).trim(),
      address: address ? String(address).trim() : '',
      password: String(password),
    });
    await user.save();

    res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (err) {
    console.error('Register failed:', err.message);
    res.status(500).json({ error: 'Could not create account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
    if (!user || !(await user.comparePassword(String(password)))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    res.json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (err) {
    console.error('Login failed:', err.message);
    res.status(500).json({ error: 'Could not log in.' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: user.toSafeJSON() });
});

// Admin login (credentials from environment)
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin account is not configured on the server.' });
  }
  if (String(email || '').toLowerCase().trim() !== ADMIN_EMAIL || String(password || '') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }
  const token = jwt.sign({ role: 'admin', email: ADMIN_EMAIL }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token });
});

// ===================== Public =====================

app.get('/api/menu', (req, res) => res.json(menuItems));

// ===================== Customer Orders (auth) =====================

// Place an order (must be logged in)
app.post('/api/orders', auth, async (req, res) => {
  try {
    const { phone, address, items } = req.body || {};
    const dbUser = await User.findById(req.user.id);
    if (!dbUser) return res.status(401).json({ error: 'Account not found.' });

    const finalPhone = String(phone || dbUser.phone).trim();
    const finalAddress = String(address || dbUser.address).trim();

    if (!/^01[3-9]\d{8}$/.test(finalPhone)) {
      return res.status(400).json({ error: 'Invalid Bangladeshi phone number.' });
    }
    if (!finalAddress) return res.status(400).json({ error: 'Delivery address is required.' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    // Rebuild items & total from the trusted server-side menu (prevents price tampering)
    const safeItems = [];
    let total = 0;
    for (const line of items) {
      const menuItem = menuById.get(Number(line.id));
      const qty = Math.max(1, Math.floor(Number(line.qty) || 0));
      if (!menuItem || qty < 1) continue;
      safeItems.push({ id: menuItem.id, name: menuItem.name, price: menuItem.price, qty });
      total += menuItem.price * qty;
    }
    if (safeItems.length === 0) {
      return res.status(400).json({ error: 'No valid menu items in the order.' });
    }

    const now = new Date();
    const order = await Order.create({
      user: dbUser._id,
      customer: { name: dbUser.name, phone: finalPhone, address: finalAddress },
      items: safeItems,
      total,
      status: 'Pending',
      statusHistory: [{ status: 'Pending', at: now }],
    });

    // Notify admins (all) + this customer's own live tracking
    io.to('admins').emit('order:new', order);
    io.to(`user:${dbUser._id}`).emit('order:new', order);

    res.status(201).json(order);
  } catch (err) {
    console.error('Create order failed:', err.message);
    res.status(500).json({ error: 'Could not place order. Please try again.' });
  }
});

// A customer's own orders (for tracking)
app.get('/api/orders/mine', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort('-createdAt').limit(100).lean();
    res.json(orders);
  } catch (err) {
    console.error('List my orders failed:', err.message);
    res.status(500).json({ error: 'Could not load your orders.' });
  }
});

// ===================== Admin Orders (adminAuth) =====================

app.get('/api/orders', adminAuth, async (req, res) => {
  try {
    const { status, search, sort = '-createdAt' } = req.query;
    const query = {};
    if (status && VALID_STATUSES.includes(status)) query.status = status;
    if (search) {
      const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ 'customer.name': rx }, { 'customer.phone': rx }, { 'customer.address': rx }];
    }
    const allowedSorts = ['createdAt', '-createdAt', 'total', '-total', 'status', '-status'];
    const sortBy = allowedSorts.includes(sort) ? sort : '-createdAt';
    const orders = await Order.find(query).sort(sortBy).limit(500).lean();
    res.json(orders);
  } catch (err) {
    console.error('List orders failed:', err.message);
    res.status(500).json({ error: 'Could not load orders.' });
  }
});

app.get('/api/stats', adminAuth, async (req, res) => {
  try {
    const [byStatus, revenueAgg, total] = await Promise.all([
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, revenue: { $sum: '$total' } } },
      ]),
      Order.countDocuments(),
    ]);

    const counts = { Pending: 0, Processing: 0, Shipped: 0, Delivered: 0, Cancelled: 0 };
    byStatus.forEach((s) => { if (s._id in counts) counts[s._id] = s.count; });

    res.json({ total, revenue: revenueAgg[0]?.revenue || 0, counts });
  } catch (err) {
    console.error('Stats failed:', err.message);
    res.status(500).json({ error: 'Could not load stats.' });
  }
});

app.patch('/api/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, $push: { statusHistory: { status, at: new Date() } } },
      { new: true, runValidators: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    io.to('admins').emit('order:updated', order);
    io.to(`user:${order.user}`).emit('order:updated', order);
    res.json(order);
  } catch (err) {
    console.error('Update status failed:', err.message);
    res.status(500).json({ error: 'Could not update order.' });
  }
});

app.delete('/api/orders/:id', adminAuth, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    io.to('admins').emit('order:deleted', { _id: order._id });
    io.to(`user:${order.user}`).emit('order:deleted', { _id: order._id });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete order failed:', err.message);
    res.status(500).json({ error: 'Could not delete order.' });
  }
});

// ===================== Socket.IO =====================

io.on('connection', (socket) => {
  // Admin dashboards join the shared admin room (token-verified)
  socket.on('admin:join', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role === 'admin') socket.join('admins');
    } catch {
      /* invalid admin token — no room joined */
    }
  });

  // Customers authenticate to receive updates only for their own orders
  socket.on('customer:join', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.join(`user:${decoded.id}`);
    } catch {
      /* invalid token — no room joined */
    }
  });
});

// ===================== Boot =====================

async function start() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is missing. Create a .env file (see .env.example).');
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
    server.listen(PORT, () => {
      console.log(`Server running:  http://localhost:${PORT}`);
      console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
    });
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

start();
