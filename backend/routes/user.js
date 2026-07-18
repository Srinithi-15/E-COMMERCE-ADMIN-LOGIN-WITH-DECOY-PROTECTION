const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');

// Create users table if not exists
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// POST /api/user/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    // Check if email exists
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
      if (row) {
        return res.status(400).json({ success: false, message: 'Email already registered. Please sign in.' });
      }
      const hashed = await bcrypt.hash(password, 10);
      db.run(
        'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
        [name, email, phone || null, hashed],
        function(err) {
          if (err) return res.status(500).json({ success: false, message: 'Registration failed.' });
          res.json({ success: true, message: 'Account created successfully!' });
        }
      );
    });
  } catch(e) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/user/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email], async (err, user) => {
      if (!user) {
        return res.status(200).json({ success: false, message: 'Email not found. Please register first.' });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(200).json({ success: false, message: 'Incorrect password.' });
      }
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '7d' }
      );
      res.json({
        success: true,
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone }
      });
    });
  } catch(e) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/user/all — Admin only
router.get('/all', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  db.all(
    'SELECT id, name, email, phone, created_at FROM users WHERE is_active = 1 ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ success: true, users: rows });
    }
  );
});

module.exports = router;