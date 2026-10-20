const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { getNotifications, markAllRead, markOneRead } = require('../controllers/notificationController');

router.get('/notifications',              authenticate, getNotifications);
router.put('/notifications/read-all',     authenticate, markAllRead);
router.put('/notifications/:id/read',     authenticate, markOneRead);

module.exports = router;
