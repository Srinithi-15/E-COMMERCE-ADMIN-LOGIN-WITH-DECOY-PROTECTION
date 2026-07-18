# 🛒 ShopNova — Secure E-Commerce Admin Login System with Decoy Protection

## 🏗️ Project Structure

```
ecommerce-admin/
├── backend/
│   ├── server.js           # Express server entry point
│   ├── database.js         # SQLite DB setup & initialization
│   ├── emailService.js     # Nodemailer OTP email service
│   ├── package.json        # Node.js dependencies
│   ├── .env                # Environment variables (configure this!)
│   └── routes/
│       ├── auth.js         # Login, OTP, Forgot/Reset Password APIs
│       └── admin.js        # Dashboard stats, security logs APIs
└── frontend/
    ├── index.html          # 🛒 E-Commerce Homepage (starting point)
    ├── login.html          # 🔐 Admin Login + OTP + Forgot Password
    ├── dashboard.html      # ✅ Real Admin Dashboard (after OTP login)
    └── decoy-dashboard.html # 🪤 Fake Dashboard (for attackers)
```

## 🚀 Setup Instructions

### Step 1: Setup Backend

```bash
cd backend
npm install
```

### Step 2: Configure Email (for real OTP emails)

Edit `backend/.env`:
```
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
```

To get Gmail App Password:
1. Go to Google Account → Security → 2-Step Verification
2. Scroll to App Passwords → Generate one for "Mail"
3. Copy the 16-digit password into .env

> **DEV MODE**: If EMAIL_USER is not set, OTP will be printed in the backend console.

### Step 3: Start Backend

```bash
cd backend
node server.js
```

You should see:
```
✅ SQLite Database Connected
✅ Database tables initialized  
✅ Default admin created: username=admin, password=Admin@123
🚀 ShopNova Backend running on http://localhost:5000
```

### Step 4: Open Frontend

Open `frontend/index.html` in your browser.

OR use a simple HTTP server:
```bash
cd frontend
npx serve .
# Visit: http://localhost:3000
```

## 🔐 Default Admin Credentials

| Field    | Value         |
|----------|--------------|
| Username | admin         |
| Password | Admin@123     |
| Email    | admin@shopnova.com |

## 🧪 Testing the System

### Test 1: Normal Admin Login
1. Go to homepage → Click "Admin Login"
2. Enter: username=`admin`, password=`Admin@123`
3. OTP will be sent (or printed in console in dev mode)
4. Enter OTP → Redirected to **Real Dashboard** ✅

### Test 2: Decoy Dashboard (Hacker Trap)
1. Enter wrong password **3 times**
2. System redirects to **Decoy Dashboard** 🪤
3. IP address, device info, and actions are logged silently
4. Admin can see these logs in Security Logs tab

### Test 3: Forgot Password
1. Click "Forgot password?" on login page
2. Enter email: `admin@shopnova.com`
3. Enter reset OTP (printed in console)
4. Set new password → Login again

## 🔒 Security Features

| Feature | Description |
|---------|-------------|
| Bcrypt Hashing | Passwords hashed with 12 salt rounds |
| OTP Verification | 6-digit OTP, expires in 10 minutes |
| JWT Sessions | Secure tokens expire in 8 hours |
| Decoy Dashboard | Attacker redirected after 3 failed attempts |
| Threat Logging | IP, device, user agent captured for attackers |
| Rate Limiting | 20 login attempts per 15 minutes |
| Activity Tracking | Decoy pages visited + session duration logged |

## 📊 Database Tables

- **admins** — Admin user accounts with hashed passwords
- **otps** — OTP codes with expiry (login & password reset)
- **security_logs** — Attacker details (IP, device, pages visited)
- **sessions** — Active JWT sessions

## 🌐 API Endpoints

```
POST /api/auth/login           → Login (returns requireOtp or decoy)
POST /api/auth/verify-otp      → Verify OTP → get JWT token
POST /api/auth/forgot-password → Send password reset OTP
POST /api/auth/reset-password  → Reset with OTP + new password
POST /api/auth/logout          → Invalidate session
GET  /api/admin/dashboard-stats → Real dashboard stats (auth required)
GET  /api/admin/security-logs  → Attacker logs (auth required)
```
