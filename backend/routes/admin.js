const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db } = require('../database');

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// GET /api/admin/dashboard-stats
router.get('/dashboard-stats', authMiddleware, (req, res) => {
  res.json({
    success: true,
    stats: {
      totalRevenue: 284750,
      totalOrders: 1847,
      totalProducts: 342,
      totalCustomers: 5621,
      monthlyGrowth: 12.5,
      pendingOrders: 23,
      todayRevenue: 4320,
      todayOrders: 18
    },
    recentOrders: [
      { id: '#ORD-7821', customer: 'Priya Sharma', amount: 2450, status: 'Delivered', date: '2026-03-14' },
      { id: '#ORD-7820', customer: 'Rahul Verma', amount: 890, status: 'Processing', date: '2026-03-14' },
      { id: '#ORD-7819', customer: 'Anitha Kumar', amount: 3200, status: 'Shipped', date: '2026-03-13' },
      { id: '#ORD-7818', customer: 'Karthik Raja', amount: 1560, status: 'Pending', date: '2026-03-13' },
      { id: '#ORD-7817', customer: 'Meena Devi', amount: 4100, status: 'Delivered', date: '2026-03-12' }
    ],
    topProducts: [
      { name: 'iPhone 16 Pro', sales: 142, revenue: 170580 },
      { name: 'Samsung Galaxy S25', sales: 98, revenue: 88200 },
      { name: 'MacBook Air M4', sales: 45, revenue: 112500 },
      { name: 'Sony WH-1000XM6', sales: 203, revenue: 60900 },
    ]
  });
});

// GET /api/admin/security-logs
router.get('/security-logs', authMiddleware, (req, res) => {
  db.all(
    'SELECT * FROM security_logs ORDER BY login_time DESC LIMIT 50',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'DB error' });
      // Convert login_time to IST for display
      const logs = (rows || []).map(row => ({
        ...row,
        login_time: row.login_time 
          ? new Date(row.login_time + (row.login_time.includes('+') || row.login_time.includes('Z') ? '' : 'Z'))
              .toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : row.login_time
      }));
      res.json({ success: true, logs });
    }
  );
});

// GET /api/admin/profile
router.get('/profile', authMiddleware, (req, res) => {
  db.get('SELECT id, username, email, full_name, role, created_at FROM admins WHERE id = ?',
    [req.admin.adminId],
    (err, admin) => {
      if (err || !admin) return res.status(404).json({ success: false, message: 'Admin not found' });
      res.json({ success: true, admin });
    }
  );
});

module.exports = router;