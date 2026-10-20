const express = require('express');
const router  = express.Router();

const { authenticate, authorizeRoles } = require('../middleware/auth');
const {
  victimDashboard,
  shelterDashboard,
  adminDashboard,
} = require('../controllers/dashboardController');

// ── Victim routes ──────────────────────────────────────────────────────
// Only users with role='victim' can access
router.get('/victim/dashboard',  authenticate, authorizeRoles('victim'),  victimDashboard);

// ── Shelter routes ─────────────────────────────────────────────────────
// Only users with role='shelter' can access
router.get('/shelter/dashboard', authenticate, authorizeRoles('shelter'), shelterDashboard);

// ── Admin routes ───────────────────────────────────────────────────────
// Only users with role='admin' can access
router.get('/admin/dashboard',   authenticate, authorizeRoles('admin'),   adminDashboard);

module.exports = router;
