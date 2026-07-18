const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { generateOTP, sendOTPEmail } = require('../emailService');

const MAX_FAILED_ATTEMPTS = 3;
const OTP_EXPIRY_MINUTES = 10;

// IP-based attempt tracking (in-memory)
const ipAttempts = {};

// Helper: get admin by username
const getAdminByUsername = (username) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM admins WHERE username = ? AND is_active = 1', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Helper: save OTP
const saveOTP = (email, otp, type) => {
  return new Promise((resolve, reject) => {
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    db.run(
      'INSERT INTO otps (email, otp, type, expires_at) VALUES (?, ?, ?, ?)',
      [email, otp, type, expiresAt],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

// Helper: log security incident (decoy) + send email alert
const logSecurityIncident = (req, username) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const deviceInfo = JSON.stringify({
    platform: req.headers['sec-ch-ua-platform'] || 'Unknown',
    browser: userAgent.substring(0, 100),
    language: req.headers['accept-language'] || 'Unknown',
    referer: req.headers['referer'] || 'Direct'
  });
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  db.run(
    `INSERT INTO security_logs (ip_address, username_attempted, user_agent, device_info, threat_level)
     VALUES (?, ?, ?, ?, ?)`,
    [ip, username, userAgent, deviceInfo, 'HIGH'],
    (err) => { if (err) console.error('Log error:', err); }
  );

  // Send security alert email to admin
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0f0a1a;color:#e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#ef4444,#f97316);padding:24px 32px;">
        <h1 style="margin:0;font-size:20px;color:white;">🚨 Security Alert — Intrusion Detected</h1>
      </div>
      <div style="padding:28px;">
        <p style="color:#fca5a5;font-size:15px;margin-bottom:20px;">A brute-force attack was detected on your ShopNova admin portal. The attacker has been redirected to a decoy dashboard.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="padding:10px 0;color:#94a3b8;width:140px;">IP Address</td>
            <td style="padding:10px 0;color:#ef4444;font-family:monospace;font-weight:700;">${ip}</td>
          </tr>
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="padding:10px 0;color:#94a3b8;">Username tried</td>
            <td style="padding:10px 0;color:#e2e8f0;">${username}</td>
          </tr>
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="padding:10px 0;color:#94a3b8;">Date & Time</td>
            <td style="padding:10px 0;color:#e2e8f0;">${now} (IST)</td>
          </tr>
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="padding:10px 0;color:#94a3b8;">Browser</td>
            <td style="padding:10px 0;color:#e2e8f0;font-size:12px;">${userAgent.substring(0,80)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#94a3b8;">Action Taken</td>
            <td style="padding:10px 0;color:#f59e0b;font-weight:700;">🍯 Redirected to Honeypot Dashboard</td>
          </tr>
        </table>
        <div style="margin-top:20px;background:#1e0a0a;border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:14px;font-size:13px;color:#fca5a5;">
          ⚠️ The attacker is currently browsing a fake dashboard and does not know your real data is protected.
        </div>
      </div>
    </div>`;

  transporter.sendMail({
    from: '"ShopNova Security" <' + process.env.EMAIL_USER + '>',
    to: process.env.ADMIN_EMAIL,
    subject: '🚨 Security Alert: Failed Login Attempt from ' + ip,
    html
  }).then(() => console.log('🚨 Security alert sent to admin!'))
    .catch(e => console.error('Alert email error:', e.message));
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    if (!ipAttempts[ip]) ipAttempts[ip] = 0;

    // Already exceeded IP attempts — decoy
    if (ipAttempts[ip] >= MAX_FAILED_ATTEMPTS) {
      logSecurityIncident(req, username);
      return res.json({ success: false, decoy: true, message: 'Redirecting...', token: 'decoy_' + uuidv4() });
    }

    const admin = await getAdminByUsername(username);

    if (!admin) {
      // Wrong username — increment IP counter
      ipAttempts[ip]++;
      const left = MAX_FAILED_ATTEMPTS - ipAttempts[ip];
      if (ipAttempts[ip] >= MAX_FAILED_ATTEMPTS) {
        logSecurityIncident(req, username);
        return res.json({ success: false, decoy: true, message: 'Redirecting...', token: 'decoy_' + uuidv4() });
      }
      return res.status(200).json({ success: false, message: `Invalid credentials. ${left} attempt${left !== 1 ? 's' : ''} remaining.`, attemptsLeft: left });
    }

    // Check DB failed attempts
    if (admin.failed_attempts >= MAX_FAILED_ATTEMPTS) {
      logSecurityIncident(req, username);
      return res.json({ success: false, decoy: true, message: 'Redirecting...', token: 'decoy_' + uuidv4() });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      ipAttempts[ip]++;
      const newAttempts = admin.failed_attempts + 1;
      db.run('UPDATE admins SET failed_attempts = ?, last_failed_attempt = CURRENT_TIMESTAMP WHERE id = ?', [newAttempts, admin.id]);

      if (ipAttempts[ip] >= MAX_FAILED_ATTEMPTS || newAttempts >= MAX_FAILED_ATTEMPTS) {
        logSecurityIncident(req, username);
        return res.json({ success: false, decoy: true, message: 'Redirecting...', token: 'decoy_' + uuidv4() });
      }

      const left = MAX_FAILED_ATTEMPTS - ipAttempts[ip];
      return res.status(200).json({ success: false, message: `Invalid credentials. ${left} attempt${left !== 1 ? 's' : ''} remaining.`, attemptsLeft: left });
    }

    // Password correct — reset all counters
    ipAttempts[ip] = 0;
    db.run('UPDATE admins SET failed_attempts = 0 WHERE id = ?', [admin.id]);

    // Password correct — send OTP
    const otp = generateOTP();
    await saveOTP(admin.email, otp, 'login');
    const emailResult = await sendOTPEmail(admin.email, otp, 'login');

    return res.json({
      success: true,
      requireOtp: true,
      email: admin.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      message: 'OTP sent to your registered email',
      ...(emailResult.devOtp && { devOtp: emailResult.devOtp })
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { username, otp } = req.body;
    if (!username || !otp) {
      return res.status(400).json({ success: false, message: 'Username and OTP required' });
    }

    const admin = await getAdminByUsername(username);
    if (!admin) return res.status(404).json({ success: false, message: 'User not found' });

    // Check OTP
    db.get(
      `SELECT * FROM otps WHERE email = ? AND otp = ? AND type = 'login' AND used = 0 
       AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1`,
      [admin.email, otp],
      (err, otpRow) => {
        if (err || !otpRow) {
          return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Mark OTP as used
        db.run('UPDATE otps SET used = 1 WHERE id = ?', [otpRow.id]);

        // Generate JWT
        const token = jwt.sign(
          { adminId: admin.id, username: admin.username, role: admin.role },
          process.env.JWT_SECRET || 'fallback_secret',
          { expiresIn: '8h' }
        );

        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        db.run(
          'INSERT INTO sessions (admin_id, token, ip_address, expires_at) VALUES (?, ?, ?, ?)',
          [admin.id, token, ip, expiresAt]
        );

        res.json({
          success: true,
          token,
          admin: {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            full_name: admin.full_name,
            role: admin.role
          }
        });
      }
    );
  } catch (error) {
    console.error('OTP verify error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    db.get('SELECT * FROM admins WHERE email = ? AND is_active = 1', [email], async (err, admin) => {
      if (err || !admin) {
        // Don't reveal if email exists
        return res.json({ success: true, message: 'If this email exists, a reset OTP has been sent.' });
      }

      const otp = generateOTP();
      await saveOTP(email, otp, 'reset');
      const emailResult = await sendOTPEmail(email, otp, 'reset');

      res.json({ 
        success: true, 
        message: 'Password reset OTP sent to your email.',
        ...(emailResult.devOtp && { devOtp: emailResult.devOtp })
      });
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    db.get(
      `SELECT * FROM otps WHERE email = ? AND otp = ? AND type = 'reset' AND used = 0 
       AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1`,
      [email, otp],
      async (err, otpRow) => {
        if (err || !otpRow) {
          return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        db.run(
          'UPDATE admins SET password = ?, failed_attempts = 0 WHERE email = ?',
          [hashedPassword, email],
          (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Failed to update password' });
            db.run('UPDATE otps SET used = 1 WHERE id = ?', [otpRow.id]);
            res.json({ success: true, message: 'Password reset successfully! Please login.' });
          }
        );
      }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/auth/verify-token
router.get('/verify-token', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ valid: false });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    res.json({ valid: true, admin: decoded });
  } catch {
    res.status(401).json({ valid: false });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    db.run('DELETE FROM sessions WHERE token = ?', [token]);
  }
  res.json({ success: true, message: 'Logged out' });
});

// POST /api/auth/log-decoy-activity
router.post('/log-decoy-activity', (req, res) => {
  const { pages_visited, session_duration, username } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || 'Unknown';

  db.run(
    `UPDATE security_logs SET pages_visited = ?, session_duration = ? 
     WHERE id = (SELECT id FROM security_logs WHERE ip_address = ? AND username_attempted = ? ORDER BY login_time DESC LIMIT 1)`,
    [JSON.stringify(pages_visited), session_duration, ip, username || 'unknown']
  );

  res.json({ success: true });
});

// POST /api/auth/reset-attempts — called when decoy logout happens
router.post('/reset-attempts', (req, res) => {
  const { username } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  
  // Reset IP attempts
  if (ipAttempts[ip]) ipAttempts[ip] = 0;
  
  // Reset DB attempts for this username
  if (username) {
    db.run('UPDATE admins SET failed_attempts = 0 WHERE username = ?', [username]);
  }
  
  res.json({ success: true });
});

module.exports = router;