const { pool } = require('../config/db');

// ── GET /api/admin/analytics ─────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    // 1. Requests per day — last 30 days
    const [dailyRequests] = await pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM emergency_requests
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    // 2. Requests by type
    const [byType] = await pool.query(
      `SELECT type, COUNT(*) AS count
       FROM emergency_requests
       GROUP BY type
       ORDER BY count DESC`
    );

    // 3. Requests by status
    const [byStatus] = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM emergency_requests
       GROUP BY status`
    );

    // 4. Requests by priority
    const [byPriority] = await pool.query(
      `SELECT priority, COUNT(*) AS count
       FROM emergency_requests
       GROUP BY priority`
    );

    // 5. Top 5 shelters by fulfilled requests
    const [topShelters] = await pool.query(
      `SELECT sp.shelter_name,
              COUNT(ra.assignment_id) AS total_assigned,
              COUNT(CASE WHEN ra.status = 'accepted' THEN 1 END) AS accepted,
              COUNT(CASE WHEN ra.status = 'rejected' THEN 1 END) AS rejected,
              COUNT(CASE WHEN er.status = 'fulfilled' THEN 1 END) AS fulfilled
       FROM shelter_profiles sp
       LEFT JOIN request_assignments ra ON ra.shelter_id = sp.shelter_id
       LEFT JOIN emergency_requests er  ON er.request_id = ra.request_id AND ra.shelter_id = sp.shelter_id
       WHERE sp.is_verified = TRUE
       GROUP BY sp.shelter_id
       ORDER BY fulfilled DESC
       LIMIT 5`
    );

    // 6. Avg response time (minutes) — from assigned to responded
    const [avgResponse] = await pool.query(
      `SELECT
         ROUND(AVG(TIMESTAMPDIFF(MINUTE, assigned_at, responded_at)), 1) AS avg_minutes
       FROM request_assignments
       WHERE responded_at IS NOT NULL`
    );

    // 7. Fulfillment rate
    const [fulfillmentRate] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN status = 'fulfilled' THEN 1 END) AS fulfilled,
         COUNT(CASE WHEN status = 'unresolved' THEN 1 END) AS unresolved,
         ROUND(COUNT(CASE WHEN status='fulfilled' THEN 1 END) * 100.0 / NULLIF(COUNT(*),0), 1) AS rate_pct
       FROM emergency_requests
       WHERE status NOT IN ('pending','assigned','cancelled')`
    );

    // 8. New users per day — last 14 days
    const [newUsers] = await pool.query(
      `SELECT DATE(created_at) AS date, role, COUNT(*) AS count
       FROM users
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       GROUP BY DATE(created_at), role
       ORDER BY date ASC`
    );

    return res.json({
      success: true,
      data: {
        dailyRequests,
        byType,
        byStatus,
        byPriority,
        topShelters,
        avgResponseMinutes: avgResponse[0]?.avg_minutes ?? null,
        fulfillmentRate: fulfillmentRate[0],
        newUsers,
      },
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { getAnalytics };
