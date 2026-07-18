require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 5000;

// Init DB
initDatabase();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { success: false, message: 'Too many requests, try again later.' }
});

app.use('/api/auth/login', loginLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

app.get('/', (req, res) => {
  res.json({ 
    message: '🛒 ShopNova Admin API Running',
    version: '1.0.0',
    status: 'OK'
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 ShopNova Backend running on http://localhost:${PORT}`);
  console.log(`📋 Default Admin: username=admin, password=Admin@123`);
  console.log(`⚠️  Set EMAIL_USER and EMAIL_PASS in .env for real email OTP`);
  console.log(`🔐 In DEV mode, OTP will be printed in console\n`);
});

module.exports = app;