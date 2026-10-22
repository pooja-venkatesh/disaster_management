const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// ─────────────────────────────────────────────
// authenticate  – verifies JWT in Authorization header
// ─────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    // Fetch fresh user data from DB (catches deactivated accounts mid-session)
    const [rows] = await pool.query(
      'SELECT user_id, full_name AS name, email, phone, role, is_active, email_verified FROM users WHERE user_id = ?',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });
    }

    // Unverified accounts may never use the API (blocks tokens issued before verification existed)
    if (Number(user.email_verified) === 0) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before continuing.',
      });
    }

    req.user = user; // Attach to request for downstream use
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────
// authorizeRoles  – role-based access control
// Usage: authorizeRoles('admin', 'shelter')
// ─────────────────────────────────────────────
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated.' });
    }

    if (!roles.map(r => String(r).toLowerCase()).includes(String(req.user.role).toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This route is restricted to: ${roles.join(', ')}.`,
      });
    }

    next();
  };
};

module.exports = { authenticate, authorizeRoles };
