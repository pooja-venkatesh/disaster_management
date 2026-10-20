/**
 * verificationService.js
 * Email-verification OTPs, verification sessions and password-reset tokens.
 *
 * Security notes
 *  • OTPs are 6 digits from crypto.randomInt and stored ONLY as
 *    HMAC-SHA256(server secret, userId:otp) — a DB leak alone cannot reveal or
 *    brute-force them offline.
 *  • Reset tokens are 256-bit random values; only their SHA-256 is stored.
 *  • All expiry / cooldown maths is done by the database clock (NOW()).
 *  • A "verification session" (signed, short-lived, bound to the current
 *    password hash) proves the caller is the party that supplied the password
 *    (register or a correct login). It stops a third party from pre-registering
 *    someone else's email with their own password and then relying on the real
 *    owner to complete the OTP step.
 */
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const { pool } = require('../config/db');
const email  = require('./emailService');

// ── Tunables ─────────────────────────────────────────────────────────
const OTP_TTL_MINUTES             = 10;
const OTP_MAX_ATTEMPTS            = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_SENDS_PER_HOUR      = 5;
const VERIFICATION_SESSION_TTL    = '1h';

const RESET_TTL_MINUTES           = 15;
const RESET_COOLDOWN_SECONDS      = 60;
const RESET_MAX_REQUESTS_PER_HOUR = 5;

// ── Crypto helpers ───────────────────────────────────────────────────
const secret = () => {
  const s = process.env.EMAIL_OTP_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET (or EMAIL_OTP_SECRET) must be set.');
  return s;
};

const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

const hashOtp = (userId, otp) =>
  crypto.createHmac('sha256', secret()).update(`otp:${userId}:${otp}`).digest('hex');

const safeEqualHex = (a, b) => {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

const generateResetToken = () => crypto.randomBytes(32).toString('hex');
const hashResetToken     = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const RESET_TOKEN_RE     = /^[a-f0-9]{64}$/;

// ── Verification session (JWT, separate key + purpose) ───────────────
const sessionKey = () =>
  crypto.createHmac('sha256', secret()).update('email-verification-session').digest('hex');

const passwordFingerprint = (passwordHash) =>
  crypto.createHmac('sha256', secret()).update(`pwfp:${passwordHash}`).digest('hex').slice(0, 32);

const signVerificationSession = (user) =>
  jwt.sign(
    { uid: user.user_id, pf: passwordFingerprint(user.password_hash), purpose: 'email_verification' },
    sessionKey(),
    { expiresIn: VERIFICATION_SESSION_TTL }
  );

/** Returns the user row if the session is valid and still matches, else null. */
const resolveVerificationSession = async (token) => {
  if (!token || typeof token !== 'string') return null;
  let decoded;
  try { decoded = jwt.verify(token, sessionKey()); } catch { return null; }
  if (decoded.purpose !== 'email_verification') return null;
  const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [decoded.uid]);
  const user = rows[0];
  if (!user) return null;
  if (!safeEqualHex(decoded.pf, passwordFingerprint(user.password_hash))) return null; // credentials changed
  return user;
};

// ── Email OTP: issue + send ──────────────────────────────────────────
/**
 * Creates (or replaces) the user's OTP, enforcing resend cooldown and an
 * hourly cap, then emails it.
 * Returns { status: 'sent' | 'cooldown' | 'limit' | 'send_failed', retryAfter? }.
 * On send failure the cooldown is rolled back so the user can retry at once,
 * and nothing is marked verified.
 */
const issueAndSendEmailOtp = async (user) => {
  const otp     = generateOtp();
  const otpHash = hashOtp(user.user_id, otp);
  const conn    = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, send_count,
              TIMESTAMPDIFF(SECOND, last_sent_at, NOW())             AS since_sent,
              TIMESTAMPDIFF(SECOND, send_window_started_at, NOW())   AS window_age
         FROM email_verification_otps WHERE user_id = ? FOR UPDATE`,
      [user.user_id]
    );

    if (rows.length) {
      const r = rows[0];
      if (r.since_sent < OTP_RESEND_COOLDOWN_SECONDS) {
        await conn.rollback();
        return { status: 'cooldown', retryAfter: OTP_RESEND_COOLDOWN_SECONDS - Math.max(0, r.since_sent) };
      }
      const resetWindow = r.window_age >= 3600;
      const count       = resetWindow ? 0 : r.send_count;
      if (count >= OTP_MAX_SENDS_PER_HOUR) {
        await conn.rollback();
        return { status: 'limit', retryAfter: Math.max(1, 3600 - r.window_age) };
      }
      await conn.query(
        `UPDATE email_verification_otps
            SET otp_hash = ?, expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
                attempts = 0, consumed_at = NULL, last_sent_at = NOW(),
                send_count = ?,
                send_window_started_at = CASE WHEN ? = 1 THEN NOW() ELSE send_window_started_at END
          WHERE id = ?`,
        [otpHash, OTP_TTL_MINUTES, count + 1, resetWindow ? 1 : 0, r.id]
      );
    } else {
      try {
        await conn.query(
          `INSERT INTO email_verification_otps
             (user_id, otp_hash, expires_at, attempts, last_sent_at, send_count, send_window_started_at)
           VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0, NOW(), 1, NOW())`,
          [user.user_id, otpHash, OTP_TTL_MINUTES]
        );
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') { // concurrent first send
          await conn.rollback();
          return { status: 'cooldown', retryAfter: OTP_RESEND_COOLDOWN_SECONDS };
        }
        throw err;
      }
    }
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }

  try {
    await email.sendVerificationOtp({ to: user.email, name: user.name, otp, ttlMinutes: OTP_TTL_MINUTES });
    return { status: 'sent', retryAfter: OTP_RESEND_COOLDOWN_SECONDS };
  } catch (err) {
    console.error('[Auth] Verification email failed:', err.message);
    await pool.query(
      `UPDATE email_verification_otps
          SET last_sent_at = DATE_SUB(NOW(), INTERVAL ? SECOND),
              send_count   = CASE WHEN send_count > 0 THEN send_count - 1 ELSE 0 END
        WHERE user_id = ? AND otp_hash = ?`,
      [OTP_RESEND_COOLDOWN_SECONDS, user.user_id, otpHash]
    );
    return { status: 'send_failed' };
  }
};

// ── Email OTP: verify ────────────────────────────────────────────────
/**
 * Checks a submitted OTP for a user (atomic, row-locked).
 * Returns { ok: true } or { ok: false, httpStatus, code, message, attemptsLeft? }.
 */
const verifyEmailOtp = async (userId, otp) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, otp_hash, attempts, consumed_at, (expires_at <= NOW()) AS expired
         FROM email_verification_otps WHERE user_id = ? FOR UPDATE`,
      [userId]
    );
    const row = rows[0];

    if (!row || row.consumed_at) {
      await conn.rollback();
      return { ok: false, httpStatus: 400, code: 'OTP_NOT_FOUND',
        message: 'No active verification code. Please request a new one.' };
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await conn.rollback();
      return { ok: false, httpStatus: 429, code: 'OTP_TOO_MANY_ATTEMPTS',
        message: 'Too many incorrect attempts. Please request a new code.' };
    }
    if (Number(row.expired) === 1) {
      await conn.rollback();
      return { ok: false, httpStatus: 400, code: 'OTP_EXPIRED',
        message: 'This code has expired. Please request a new one.' };
    }

    if (!safeEqualHex(row.otp_hash, hashOtp(userId, otp))) {
      const attempts = row.attempts + 1;
      await conn.query('UPDATE email_verification_otps SET attempts = ? WHERE id = ?', [attempts, row.id]);
      await conn.commit(); // persist the failed attempt
      if (attempts >= OTP_MAX_ATTEMPTS) {
        return { ok: false, httpStatus: 429, code: 'OTP_TOO_MANY_ATTEMPTS',
          message: 'Too many incorrect attempts. Please request a new code.' };
      }
      return { ok: false, httpStatus: 400, code: 'OTP_INVALID', attemptsLeft: OTP_MAX_ATTEMPTS - attempts,
        message: `Incorrect code. ${OTP_MAX_ATTEMPTS - attempts} attempt(s) remaining.` };
    }

    // Correct: consume (single use) and mark verified, atomically.
    const [consume] = await conn.query(
      'UPDATE email_verification_otps SET consumed_at = NOW() WHERE id = ? AND consumed_at IS NULL',
      [row.id]
    );
    if (consume.affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, httpStatus: 400, code: 'OTP_NOT_FOUND',
        message: 'No active verification code. Please request a new one.' };
    }
    await conn.query(
      'UPDATE users SET email_verified = 1, email_verified_at = NOW() WHERE user_id = ?',
      [userId]
    );
    await conn.commit();
    return { ok: true };
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
};

// ── Password reset ───────────────────────────────────────────────────
/**
 * Creates a reset token (invalidating older unused ones) unless the user is
 * throttled. Returns { status: 'created', token } or { status: 'throttled' }.
 */
const createPasswordResetToken = async (userId) => {
  // Opportunistic cleanup of long-dead rows.
  await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < DATE_SUB(NOW(), INTERVAL ? SECOND)', [86400]);

  const [[recent]] = await pool.query(
    'SELECT COUNT(*) AS n FROM password_reset_tokens WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)',
    [userId, RESET_COOLDOWN_SECONDS]
  );
  if (recent.n > 0) return { status: 'throttled' };

  const [[hourly]] = await pool.query(
    'SELECT COUNT(*) AS n FROM password_reset_tokens WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)',
    [userId, 3600]
  );
  if (hourly.n >= RESET_MAX_REQUESTS_PER_HOUR) return { status: 'throttled' };

  const token = generateResetToken();
  await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [userId]);
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [userId, hashResetToken(token), RESET_TTL_MINUTES]
  );
  return { status: 'created', token };
};

/** True if the token exists, is unused and unexpired (does not consume it). */
const isResetTokenUsable = async (token) => {
  if (typeof token !== 'string' || !RESET_TOKEN_RE.test(token)) return false;
  const [rows] = await pool.query(
    'SELECT id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()',
    [hashResetToken(token)]
  );
  return rows.length === 1;
};

module.exports = {
  OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS,
  RESET_TTL_MINUTES, RESET_TOKEN_RE,
  hashResetToken, signVerificationSession, resolveVerificationSession,
  issueAndSendEmailOtp, verifyEmailOtp,
  createPasswordResetToken, isResetTokenUsable,
};
