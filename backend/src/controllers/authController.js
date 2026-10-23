const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const dns     = require('dns').promises;
const { pool } = require('../config/db');
const email   = require('../services/emailService');
const verification = require('../services/verificationService');

// ─────────────────────────────────────────────────────────────────────
// Helper: build a safe user object (NEVER expose password_hash)
// ─────────────────────────────────────────────────────────────────────
const safeUser = (user) => ({
  user_id:    user.user_id,
  name: user.name || user.full_name,
  email:      user.email,
  phone:      user.phone || null,
  role:       user.role,
  is_active:  user.is_active,
  email_verified: user.email_verified === undefined ? undefined : Boolean(Number(user.email_verified)),
  created_at: user.created_at,
});

// True only when the account is explicitly flagged as not yet verified.
// (Existing / seeded accounts default to verified — see migrate_email_auth.js.)
const isUnverified = (user) => user.email_verified !== undefined && Number(user.email_verified) === 0;

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');

// ─────────────────────────────────────────────────────────────────────
// Helper: generate JWT
// ─────────────────────────────────────────────────────────────────────
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Allows registration for 'victim' and 'shelter' only.
// ─────────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // ── Validation ──────────────────────────────────────────────────
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'name, email, password, and role are required.',
      });
    }

    if ([name, email, password].some((v) => typeof v !== 'string')) {
      return res.status(400).json({ success: false, message: 'name, email and password must be text.' });
    }

    // Only victim and shelter can register publicly
    if (!['victim', 'shelter'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Only "victim" or "shelter" can register.',
      });
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    // MX record check — verifies the email domain can actually receive mail.
    // Only a definitive "no such domain / no mail records" answer rejects the
    // address. A DNS *failure* (timeout, blocked DNS, offline server) must not
    // be reported as a bad email: the OTP step proves deliverability anyway.
    const emailDomain = email.split('@')[1].toLowerCase();
    const noRecords = (e) => e && ['ENOTFOUND', 'ENODATA'].includes(e.code);
    let domainOk = process.env.SKIP_MX_CHECK === 'true'; // escape hatch for networks with broken DNS
    if (!domainOk) try {
      const mxRecords = await dns.resolveMx(emailDomain);
      domainOk = !!(mxRecords && mxRecords.length);
    } catch (err) {
      if (noRecords(err)) {
        // RFC 5321: a domain with no MX but an A/AAAA record still receives mail.
        try { domainOk = (await dns.resolve4(emailDomain)).length > 0; } catch (e2) {
          if (!noRecords(e2)) domainOk = true; // DNS trouble, not a verdict
        }
      } else {
        console.warn(`[Auth] MX lookup for ${emailDomain} failed (${err.code || err.message}); skipping DNS check.`);
        domainOk = true;
      }
    }
    if (!domainOk) {
      return res.status(400).json({ success: false, message: 'Invalid email address — this email domain cannot receive emails. Please check the spelling or use a different email.' });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
    }

    if (phone && !/^\+?[\d\s\-]{7,15}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number format.' });
    }

    // ── Check for existing account ───────────────────────────────────
    const normEmail = email.trim().toLowerCase();
    const [existing] = await pool.query(
      'SELECT user_id, role, email_verified FROM users WHERE email = ?',
      [normEmail]
    );
    // A verified account (or any admin) can never be re-registered.
    if (existing.length > 0 && (!isUnverified(existing[0]) || existing[0].role === 'admin')) {
      return res.status(409).json({ success: false, message: 'Email is already registered.' });
    }

    // ── Hash password ────────────────────────────────────────────────
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // ── Insert user (unverified) — or refresh a still-unverified signup ─
    // Re-registering an UNVERIFIED email replaces the pending credentials, so
    // nobody can squat on an address they do not own: whoever finishes the
    // OTP step must also be the party that chose the password.
    let userId;
    if (existing.length > 0) {
      userId = existing[0].user_id;
      await pool.query(
        'UPDATE users SET full_name = ?, password_hash = ?, phone = ?, role = ? WHERE user_id = ? AND email_verified = 0',
        [name.trim(), password_hash, phone || null, role, userId]
      );
    } else {
      const [result] = await pool.query(
        'INSERT INTO users (full_name, email, password_hash, phone, role, email_verified) VALUES (?, ?, ?, ?, ?, 0)',
        [name.trim(), normEmail, password_hash, phone || null, role]
      );
      userId = result.insertId;
    }

    const [newUserRows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [userId]);
    const newUser = newUserRows[0];

    // ── Send the verification OTP. No login token is issued here. ────
    const otp = await verification.issueAndSendEmailOtp(newUser);
    const messages = {
      sent:        `Account created. We sent a 6-digit verification code to ${newUser.email}.`,
      cooldown:    'A verification code was sent recently. Please check your inbox, or wait before requesting another.',
      limit:       'Too many verification codes have been requested for this email. Please try again later.',
      send_failed: "Your account was created, but we couldn't send the verification email. Please use \"Resend Code\" to try again.",
    };

    return res.status(201).json({
      success: true,
      message: messages[otp.status],
      data: {
        email:                 newUser.email,
        requiresVerification:  true,
        verificationToken:     verification.signVerificationSession(newUser),
        emailSent:             otp.status === 'sent',
        resendAvailableInSeconds: otp.status === 'send_failed' ? 0 : (otp.retryAfter || 0),
        otpExpiresInMinutes:   verification.OTP_TTL_MINUTES,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Validation ──────────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // ── Find user ────────────────────────────────────────────────────
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (rows.length === 0) {
      // Generic message to avoid user enumeration
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = rows[0];

    // ── Check account is active ──────────────────────────────────────
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the administrator.',
      });
    }

    // ── Verify password ──────────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // ── Email must be verified (checked after the password so that
    //    the response never reveals anything to someone without it) ───
    if (isUnverified(user)) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before signing in.',
        data: {
          email: user.email,
          verificationToken: verification.signVerificationSession(user),
        },
      });
    }

    // ── Generate token ───────────────────────────────────────────────
    const token = generateToken(user.user_id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user:  safeUser(user),
        token,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET /api/auth/me   (protected)
// Returns the currently authenticated user's safe profile.
// ─────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    // req.user is already populated by the authenticate middleware
    return res.status(200).json({
      success: true,
      data: { user: safeUser(req.user) },
    });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────
// Email verification
// ─────────────────────────────────────────────────────────────────────
const SESSION_INVALID = {
  success: false,
  code: 'VERIFICATION_SESSION_INVALID',
  message: 'Your verification session has expired. Please sign in again to continue.',
};

// POST /api/auth/verify-email   { verificationToken, otp }
const verifyEmail = async (req, res) => {
  try {
    const { verificationToken, otp } = req.body || {};
    const user = await verification.resolveVerificationSession(verificationToken);
    if (!user) return res.status(401).json(SESSION_INVALID);

    if (!isUnverified(user)) {
      return res.status(400).json({ success: false, code: 'ALREADY_VERIFIED',
        message: 'This email is already verified. Please sign in.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false,
        message: 'Your account has been deactivated. Please contact the administrator.' });
    }
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      return res.status(400).json({ success: false, code: 'OTP_FORMAT', message: 'Enter the 6-digit code.' });
    }

    const result = await verification.verifyEmailOtp(user.user_id, otp.trim());
    if (!result.ok) {
      return res.status(result.httpStatus).json({
        success: false, code: result.code, message: result.message,
        ...(result.attemptsLeft !== undefined && { data: { attemptsLeft: result.attemptsLeft } }),
      });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [user.user_id]);
    const verified = rows[0];
    const token = generateToken(verified.user_id, verified.role);

    email.sendWelcome({ to: verified.email, name: verified.name, role: verified.role }); // fire-and-forget

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
      data: { user: safeUser(verified), token },
    });
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// POST /api/auth/resend-verification   { verificationToken }
const resendVerification = async (req, res) => {
  try {
    const user = await verification.resolveVerificationSession((req.body || {}).verificationToken);
    if (!user) return res.status(401).json(SESSION_INVALID);
    if (!isUnverified(user)) {
      return res.status(400).json({ success: false, code: 'ALREADY_VERIFIED',
        message: 'This email is already verified. Please sign in.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false,
        message: 'Your account has been deactivated. Please contact the administrator.' });
    }

    const r = await verification.issueAndSendEmailOtp(user);
    if (r.status === 'sent') {
      return res.status(200).json({
        success: true,
        message: `A new verification code has been sent to ${user.email}.`,
        data: { resendAvailableInSeconds: r.retryAfter, otpExpiresInMinutes: verification.OTP_TTL_MINUTES },
      });
    }
    if (r.status === 'cooldown') {
      return res.status(429).json({ success: false, code: 'RESEND_COOLDOWN',
        message: `Please wait ${r.retryAfter}s before requesting another code.`,
        data: { retryAfter: r.retryAfter } });
    }
    if (r.status === 'limit') {
      return res.status(429).json({ success: false, code: 'RESEND_LIMIT',
        message: 'Too many codes requested. Please try again later.',
        data: { retryAfter: r.retryAfter } });
    }
    return res.status(502).json({ success: false, code: 'EMAIL_SEND_FAILED',
      message: "We couldn't send the verification email right now. Please try again in a moment.",
      data: { retryAfter: 0 } });
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────
// Forgot / reset password
// ─────────────────────────────────────────────────────────────────────
const RESET_GENERIC_MSG = 'If an account exists for that email address, a password reset link has been sent.';
const RESET_INVALID_MSG = 'This password reset link is invalid, expired, or has already been used. Please request a new one.';

// POST /api/auth/forgot-password   { email }
// Always answers identically so it cannot be used to discover registered emails.
const forgotPassword = async (req, res) => {
  const raw = (req.body || {}).email;
  if (typeof raw !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  // Respond first: the response is then identical in content AND timing
  // whether or not the account exists or the mail server is slow/failing.
  res.status(200).json({ success: true, message: RESET_GENERIC_MSG });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [raw.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !user.is_active || isUnverified(user)) return;

    const r = await verification.createPasswordResetToken(user.user_id);
    if (r.status !== 'created') return; // throttled

    const resetUrl = `${clientUrl()}/reset-password?token=${r.token}`;
    try {
      await email.sendPasswordReset({ to: user.email, name: user.name || user.full_name, resetUrl, ttlMinutes: verification.RESET_TTL_MINUTES });
    } catch (err) {
      console.error('[Auth] Password reset email failed:', err.message);
      // Nothing was delivered: drop the token so the user can retry immediately.
      await pool.query('DELETE FROM password_reset_tokens WHERE token_hash = ?', [verification.hashResetToken(r.token)]);
    }
  } catch (err) {
    console.error('Forgot password error:', err);
  }
};

// POST /api/auth/reset-password/validate   { token }
const validateResetToken = async (req, res) => {
  try {
    const ok = await verification.isResetTokenUsable((req.body || {}).token);
    if (!ok) return res.status(400).json({ success: false, code: 'RESET_TOKEN_INVALID', message: RESET_INVALID_MSG });
    return res.status(200).json({ success: true, data: { valid: true } });
  } catch (err) {
    console.error('Validate reset token error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// POST /api/auth/reset-password   { token, password, confirmPassword }
const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};

    if (typeof password !== 'string' || typeof confirmPassword !== 'string') {
      return res.status(400).json({ success: false, message: 'Password and confirmation are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (password.length > 72) {
      return res.status(400).json({ success: false, message: 'Password must be at most 72 characters.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (!(await verification.isResetTokenUsable(token))) {
      return res.status(400).json({ success: false, code: 'RESET_TOKEN_INVALID', message: RESET_INVALID_MSG });
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12; // same mechanism as register
    const password_hash = await bcrypt.hash(password, saltRounds);

    const conn = await pool.getConnection();
    let account;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT id, user_id, used_at, (expires_at <= NOW()) AS expired
           FROM password_reset_tokens WHERE token_hash = ? FOR UPDATE`,
        [verification.hashResetToken(token)]
      );
      const t = rows[0];
      let usable = !!t && !t.used_at && Number(t.expired) !== 1;

      if (usable) {
        const [urows] = await conn.query('SELECT user_id, full_name AS name, email, is_active FROM users WHERE user_id = ?', [t.user_id]);
        account = urows[0];
        usable = !!account && !!account.is_active;
      }
      if (usable) {
        const [mark] = await conn.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL', [t.id]);
        usable = mark.affectedRows === 1;
      }
      if (!usable) {
        await conn.rollback();
        return res.status(400).json({ success: false, code: 'RESET_TOKEN_INVALID', message: RESET_INVALID_MSG });
      }

      await conn.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [account.user_id]);
      await conn.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [password_hash, account.user_id]);
      await conn.commit();
    } catch (err) {
      try { await conn.rollback(); } catch { /* ignore */ }
      throw err;
    } finally {
      conn.release();
    }

    email.sendPasswordChanged({ to: account.email, name: account.name }); // fire-and-forget

    return res.status(200).json({ success: true, message: 'Your password has been updated. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  register, login, getMe,
  verifyEmail, resendVerification,
  forgotPassword, validateResetToken, resetPassword,
};
