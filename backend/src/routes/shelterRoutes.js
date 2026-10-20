const express = require('express');
const router  = express.Router();
const { authenticate, authorizeRoles } = require('../middleware/auth');
const {
  getProfile, upsertProfile, getShelterDashboard,
  getShelterRequests, acceptRequest, rejectRequest,
  fulfillRequest, getShelterHistory,
} = require('../controllers/shelterController');

const shelter = [authenticate, authorizeRoles('shelter')];

router.get( '/profile',                        ...shelter, getProfile);
router.post('/profile',                        ...shelter, upsertProfile);
router.get( '/dashboard',                      ...shelter, getShelterDashboard);
router.get( '/requests',                       ...shelter, getShelterRequests);
router.put( '/requests/:assignmentId/accept',  ...shelter, acceptRequest);
router.put( '/requests/:assignmentId/reject',  ...shelter, rejectRequest);
router.put( '/requests/:assignmentId/fulfill', ...shelter, fulfillRequest);
router.get( '/history',                        ...shelter, getShelterHistory);

module.exports = router;
