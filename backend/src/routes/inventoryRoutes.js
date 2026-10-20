const express = require('express');
const router  = express.Router();
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { getInventory, updateInventory } = require('../controllers/inventoryController');

router.get('/inventory', authenticate, authorizeRoles('shelter'), getInventory);
router.put('/inventory', authenticate, authorizeRoles('shelter'), updateInventory);

module.exports = router;
