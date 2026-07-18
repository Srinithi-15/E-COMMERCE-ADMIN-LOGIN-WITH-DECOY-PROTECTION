const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'admin.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('DB Connection Error:', err);
  else console.log('✅ SQLite Database Connected');
});

function initDatabase() {
  db.serialize(() => {
    // Admin Users Table
    db.run(`CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      is_active INTEGER DEFAULT 1,
      failed_attempts INTEGER DEFAULT 0,
      last_failed_attempt DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // OTP Table
    db.run(`CREATE TABLE IF NOT EXISTS otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      otp TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Security Logs (for decoy tracking)
    db.run(`CREATE TABLE IF NOT EXISTS security_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT,
      username_attempted TEXT,
      user_agent TEXT,
      device_info TEXT,
      login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      action_type TEXT DEFAULT 'decoy_access',
      pages_visited TEXT,
      session_duration INTEGER DEFAULT 0,
      threat_level TEXT DEFAULT 'HIGH'
    )`);

    // Sessions Table
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY(admin_id) REFERENCES admins(id)
    )`);

    // Create default admin if not exists
    db.get("SELECT id FROM admins WHERE username = 'admin'", async (err, row) => {
      if (!row) {
        const hashedPassword = await bcrypt.hash('Admin@123', 12);
        db.run(
          `INSERT INTO admins (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)`,
          ['admin', 'rohinidharmaraj34@gmail.com', hashedPassword, 'Super Admin', 'superadmin'],
          (err) => {
            if (!err) console.log('✅ Default admin created: username=admin, password=Admin@123');
          }
        );
      }
    });

    console.log('✅ Database tables initialized');
  });
}

module.exports = { db, initDatabase };
