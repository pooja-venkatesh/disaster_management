const express = require('express');
const router  = express.Router();
const { authenticate, authorizeRoles } = require('../middleware/auth');
const {
  submitRequest, getMyRequests, getRequestDetail,
  cancelRequest, getVictimDashboard,
} = require('../controllers/victimController');

const victim = [authenticate, authorizeRoles('victim')];

router.get(   '/dashboard',       ...victim, getVictimDashboard);
router.post(  '/requests',        ...victim, submitRequest);
router.get(   '/requests',        ...victim, getMyRequests);
router.get(   '/requests/:id',    ...victim, getRequestDetail);
router.delete('/requests/:id',    ...victim, cancelRequest);

module.exports = router;
