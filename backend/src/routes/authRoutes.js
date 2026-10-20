const express = require('express');
const router  = express.Router();

const {
  register, login, getMe,
  verifyEmail, resendVerification,
  forgotPassword, validateResetToken, resetPassword,
} = require('../controllers/authController');
const { authenticate }        = require('../middleware/auth');
const { createRateLimiter }   = require('../middleware/rateLimiter');

// Per-IP limits (per-account limits are enforced in the database as well)
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20, message: 'Too many sign-up attempts. Please try again later.' });
const otpLimiter      = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
const resendLimiter   = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const recoveryLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const resetLimiter    = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

// POST /api/auth/register  – public (creates an UNVERIFIED account + emails an OTP)
router.post('/register', registerLimiter, register);

// POST /api/auth/login     – public
router.post('/login', login);

// Email verification – public, but gated by a verification session + the emailed OTP
router.post('/verify-email',        otpLimiter,    verifyEmail);
router.post('/resend-verification', resendLimiter, resendVerification);

// Forgot / reset password – public
router.post('/forgot-password',          recoveryLimiter, forgotPassword);
router.post('/reset-password/validate',  resetLimiter,    validateResetToken);
router.post('/reset-password',           resetLimiter,    resetPassword);

// GET  /api/auth/me        – protected (requires valid JWT)
router.get('/me', authenticate, getMe);

module.exports = router;
