// ─────────────────────────────────────────────────────────────────────
// Dashboard Controllers
// Each returns role-specific placeholder data for Module 1.
// ─────────────────────────────────────────────────────────────────────

// GET /api/victim/dashboard
const victimDashboard = (req, res) => {
  const { name, email, role, user_id } = req.user;
  return res.status(200).json({
    success: true,
    data: {
      user: { user_id, name, email, role },
      dashboard: {
        title: 'Victim Dashboard',
        cards: [
          {
            id:          'card-sos',
            title:       'SOS Alert',
            description: 'Send an emergency SOS alert. (Coming in Module 2)',
            status:      'coming_soon',
          },
          {
            id:          'card-shelters',
            title:       'Nearby Shelters',
            description: 'View shelters near your location. (Coming in Module 3)',
            status:      'coming_soon',
          },
          {
            id:          'card-resources',
            title:       'Resource Requests',
            description: 'Request food, water, and medical supplies. (Coming in Module 4)',
            status:      'coming_soon',
          },
          {
            id:          'card-notifications',
            title:       'Notifications',
            description: 'Emergency alerts and updates. (Coming in Module 5)',
            status:      'coming_soon',
          },
        ],
      },
    },
  });
};

// GET /api/shelter/dashboard
const shelterDashboard = (req, res) => {
  const { name, email, role, user_id } = req.user;
  return res.status(200).json({
    success: true,
    data: {
      user: { user_id, name, email, role },
      dashboard: {
        title: 'Shelter Dashboard',
        cards: [
          {
            id:          'card-capacity',
            title:       'Capacity Management',
            description: 'Manage available beds and occupancy. (Coming in Module 3)',
            status:      'coming_soon',
          },
          {
            id:          'card-inventory',
            title:       'Inventory',
            description: 'Track food, water, and supply inventory. (Coming in Module 4)',
            status:      'coming_soon',
          },
          {
            id:          'card-victims',
            title:       'Registered Victims',
            description: 'View victims assigned to your shelter. (Coming in Module 3)',
            status:      'coming_soon',
          },
          {
            id:          'card-alerts',
            title:       'Broadcast Alerts',
            description: 'Send alerts to nearby victims. (Coming in Module 5)',
            status:      'coming_soon',
          },
        ],
      },
    },
  });
};

// GET /api/admin/dashboard
const adminDashboard = (req, res) => {
  const { name, email, role, user_id } = req.user;
  return res.status(200).json({
    success: true,
    data: {
      user: { user_id, name, email, role },
      dashboard: {
        title: 'Admin Dashboard',
        cards: [
          {
            id:          'card-users',
            title:       'User Management',
            description: 'Manage all victims, shelter accounts, and admins. (Coming in Module 2)',
            status:      'coming_soon',
          },
          {
            id:          'card-map',
            title:       'Disaster Map',
            description: 'View real-time disaster locations and shelters. (Coming in Module 3)',
            status:      'coming_soon',
          },
          {
            id:          'card-sos-feed',
            title:       'SOS Feed',
            description: 'Monitor all incoming SOS alerts. (Coming in Module 2)',
            status:      'coming_soon',
          },
          {
            id:          'card-reports',
            title:       'Reports & Analytics',
            description: 'Generate system reports. (Coming in Module 6)',
            status:      'coming_soon',
          },
        ],
      },
    },
  });
};

module.exports = { victimDashboard, shelterDashboard, adminDashboard };
