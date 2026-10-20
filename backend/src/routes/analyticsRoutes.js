const express = require('express');
const router  = express.Router();
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { getAnalytics } = require('../controllers/analyticsController');
const { getAllInventory } = require('../controllers/inventoryController');

router.get('/analytics',  authenticate, authorizeRoles('admin'), getAnalytics);
router.get('/inventory',  authenticate, authorizeRoles('admin'), getAllInventory);

module.exports = router;
