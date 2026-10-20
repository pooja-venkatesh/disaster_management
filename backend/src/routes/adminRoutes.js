const express = require('express');
const router  = express.Router();
const { authenticate, authorizeRoles } = require('../middleware/auth');
const {
  getAdminDashboard, getAllShelters, verifyShelter, unverifyShelter,
  getAllRequests, getUnresolvedRequests, resolveRequest,
  getAllUsers, toggleUserActive,
} = require('../controllers/adminController');

const admin = [authenticate, authorizeRoles('admin')];

router.get('/dashboard',                       ...admin, getAdminDashboard);
router.get('/shelters',                        ...admin, getAllShelters);
router.put('/shelters/:id/verify',             ...admin, verifyShelter);
router.put('/shelters/:id/unverify',           ...admin, unverifyShelter);
router.get('/requests',                        ...admin, getAllRequests);
router.get('/requests/unresolved',             ...admin, getUnresolvedRequests);
router.put('/requests/:id/resolve',            ...admin, resolveRequest);
router.get('/users',                           ...admin, getAllUsers);
router.put('/users/:id/toggle-active',         ...admin, toggleUserActive);

module.exports = router;
