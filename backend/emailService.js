const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTPEmail = async (toEmail, otp, type = 'login') => {
  const subject = type === 'login'
    ? '🔐 ShopNova Admin - Login Verification OTP'
    : '🔑 ShopNova Admin - Password Reset OTP';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background: #0a0a1a; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #1a1a2e; border-radius: 20px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #f97316, #ec4899); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 800; }
        .body { padding: 40px 30px; }
        .otp-box { background: linear-gradient(135deg, #f97316, #ec4899); border-radius: 16px; padding: 30px; text-align: center; margin: 25px 0; }
        .otp-code { font-size: 48px; font-weight: 900; letter-spacing: 10px; color: white; font-family: monospace; }
        .otp-label { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 8px; }
        .info { color: #94a3b8; font-size: 14px; line-height: 1.8; }
        .warning { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 15px; margin-top: 20px; color: #fca5a5; font-size: 13px; }
        .footer { background: rgba(0,0,0,0.3); padding: 20px; text-align: center; color: #475569; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛒 ShopNova Admin</h1>
        </div>
        <div class="body">
          <div class="info">
            <strong style="color:#e2e8f0;font-size:18px;">
              ${type === 'login' ? '🔐 Login Verification' : '🔑 Password Reset'}
            </strong>
            <br><br>
            Your One-Time Password is:
          </div>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="otp-label">⏱ Expires in 10 minutes</div>
          </div>
          <div class="warning">
            ⚠️ Never share this OTP with anyone. If you did not request this, please secure your account immediately.
          </div>
        </div>
        <div class="footer">
          © 2026 ShopNova Admin Panel. Automated security email.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"ShopNova Security" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      html: htmlContent
    });
    console.log(`📧 OTP email sent to ${toEmail}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email Error:', error.message);
    console.log(`🔑 DEV MODE OTP for ${toEmail}: ${otp}`);
    return { success: true, devOtp: otp, message: 'Dev mode - check console for OTP' };
  }
};

module.exports = { generateOTP, sendOTPEmail };