const { pool }  = require('../config/db');
const email     = require('../services/emailService');
const socketSvc = require('../services/socketService');

// ── GET /api/admin/dashboard ────────────────────────────────────────
const getAdminDashboard = async (req, res) => {
  try {
    const [userStats] = await pool.query(
      `SELECT
         COUNT(*)                                        AS total_users,
         COUNT(CASE WHEN role='victim'  THEN 1 END)     AS victims,
         COUNT(CASE WHEN role='shelter' THEN 1 END)     AS shelters,
         COUNT(CASE WHEN role='admin'   THEN 1 END)     AS admins
       FROM users WHERE is_active = TRUE`
    );

    const [reqStats] = await pool.query(
      `SELECT
         COUNT(*)                                              AS total_requests,
         COUNT(CASE WHEN status='pending'     THEN 1 END)     AS pending,
         COUNT(CASE WHEN status='assigned'    THEN 1 END)     AS assigned,
         COUNT(CASE WHEN status='accepted'    THEN 1 END)     AS accepted,
         COUNT(CASE WHEN status='fulfilled'   THEN 1 END)     AS fulfilled,
         COUNT(CASE WHEN status='unresolved'  THEN 1 END)     AS unresolved
       FROM emergency_requests`
    );

    const [shelterStats] = await pool.query(
      `SELECT
         COUNT(*)                                        AS total_shelters,
         COUNT(CASE WHEN is_verified=TRUE THEN 1 END)   AS verified,
         COUNT(CASE WHEN is_verified=FALSE THEN 1 END)  AS pending_verification
       FROM shelter_profiles`
    );

    const [recentUnresolved] = await pool.query(
      `SELECT er.request_id, er.type, er.title, er.priority, er.created_at,
              u.full_name AS victim_name, u.phone AS victim_phone
       FROM emergency_requests er
       JOIN users u ON u.user_id = er.victim_id
       WHERE er.status = 'unresolved'
       ORDER BY er.created_at DESC
       LIMIT 5`
    );

    return res.json({
      success: true,
      data: {
        userStats:        userStats[0],
        requestStats:     reqStats[0],
        shelterStats:     shelterStats[0],
        recentUnresolved,
      },
    });
  } catch (err) {
    console.error('getAdminDashboard error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── GET /api/admin/shelters ─────────────────────────────────────────
const getAllShelters = async (req, res) => {
  try {
    const { verified } = req.query;
    let whereClause = '';
    const params = [];
    if (verified === 'true')  { whereClause = 'WHERE sp.is_verified = TRUE';  }
    if (verified === 'false') { whereClause = 'WHERE sp.is_verified = FALSE'; }

    const [rows] = await pool.query(
      `SELECT sp.*, u.full_name AS name, u.email, u.phone, u.is_active,
              adm.name AS verified_by_name
       FROM shelter_profiles sp
       JOIN users u ON u.user_id = sp.user_id
       LEFT JOIN users adm ON adm.user_id = sp.verified_by
       ${whereClause}
       ORDER BY sp.created_at DESC`,
      params
    );

    return res.json({ success: true, data: { shelters: rows } });
  } catch (err) {
    console.error('getAllShelters error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── PUT /api/admin/shelters/:id/verify ──────────────────────────────
const verifyShelter = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.user_id;

    const [rows] = await pool.query(
      `SELECT * FROM shelter_profiles WHERE shelter_id = ?`, [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Shelter not found.' });
    }

    await pool.query(
      `UPDATE shelter_profiles
       SET is_verified = TRUE, verified_by = ?, verified_at = NOW()
       WHERE shelter_id = ?`,
      [adminId, id]
    );

    // Notify the shelter owner
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, 'success')`,
      [
        rows[0].user_id,
        'Shelter Verified',
        'Your shelter has been verified by the administration. You will now receive emergency request assignments.',
      ]
    );

    // Email + socket
    const [shelterUser] = await pool.query('SELECT name, email FROM users WHERE user_id = ?', [rows[0].user_id]);
    if (shelterUser[0]) {
      email.sendShelterVerified({ to: shelterUser[0].email, name: shelterUser[0].name, shelterName: rows[0].shelter_name });
    }
    socketSvc.emitToUser(rows[0].user_id, 'notification:new', { title: 'Shelter Verified', message: 'Your shelter is now verified and will receive requests.' });

    return res.json({ success: true, message: 'Shelter verified successfully.' });
  } catch (err) {
    console.error('verifyShelter error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── PUT /api/admin/shelters/:id/unverify ────────────────────────────
const unverifyShelter = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM shelter_profiles WHERE shelter_id = ?`, [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Shelter not found.' });
    }

    await pool.query(
      `UPDATE shelter_profiles
       SET is_verified = FALSE, verified_by = NULL, verified_at = NULL
       WHERE shelter_id = ?`,
      [id]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, 'warning')`,
      [
        rows[0].user_id,
        'Shelter Verification Revoked',
        'Your shelter verification has been revoked by the administration. Please contact support.',
      ]
    );

    return res.json({ success: true, message: 'Shelter unverified.' });
  } catch (err) {
    console.error('unverifyShelter error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── GET /api/admin/requests ─────────────────────────────────────────
const getAllRequests = async (req, res) => {
  try {
    const { status, type, priority } = req.query;
    const conditions = [];
    const params = [];

    if (status)   { conditions.push('er.status = ?');   params.push(status); }
    if (type)     { conditions.push('er.type = ?');     params.push(type); }
    if (priority) { conditions.push('er.priority = ?'); params.push(priority); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT er.*,
              u.full_name  AS victim_name, u.phone AS victim_phone,
              sp.shelter_name AS current_shelter,
              sp.latitude AS shelter_latitude, sp.longitude AS shelter_longitude, sp.shelter_id
       FROM emergency_requests er
       JOIN users u ON u.user_id = er.victim_id
       LEFT JOIN request_assignments ra ON ra.assignment_id = er.current_assignment_id
       LEFT JOIN shelter_profiles sp   ON sp.shelter_id = ra.shelter_id
       ${whereClause}
       ORDER BY
         FIELD(er.priority,'critical','high','medium','low'),
         er.created_at DESC
       LIMIT 100`,
      params
    );

    return res.json({ success: true, data: { requests: rows } });
  } catch (err) {
    console.error('getAllRequests error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── GET /api/admin/requests/unresolved ──────────────────────────────
const getUnresolvedRequests = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT er.*,
              u.full_name AS victim_name, u.phone AS victim_phone, u.email AS victim_email,
              COUNT(ra.assignment_id) AS shelters_tried
       FROM emergency_requests er
       JOIN users u ON u.user_id = er.victim_id
       LEFT JOIN request_assignments ra ON ra.request_id = er.request_id
       WHERE er.status = 'unresolved'
       GROUP BY er.request_id
       ORDER BY FIELD(er.priority,'critical','high','medium','low'), er.created_at ASC`
    );

    return res.json({ success: true, data: { requests: rows } });
  } catch (err) {
    console.error('getUnresolvedRequests error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── PUT /api/admin/requests/:id/resolve ─────────────────────────────
const resolveRequest = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user.user_id;

    const [rows] = await conn.query(
      `SELECT * FROM emergency_requests WHERE request_id = ?`, [id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    await conn.query(
      `UPDATE emergency_requests
       SET status = 'fulfilled', admin_notes = ?, updated_at = NOW()
       WHERE request_id = ?`,
      [notes || 'Resolved by administration', id]
    );

    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type, related_request_id)
       VALUES (?, ?, ?, 'success', ?)`,
      [
        rows[0].victim_id,
        'Request Resolved by Administration',
        `Your emergency request "${rows[0].title}" has been resolved directly by the government/administration.`,
        id,
      ]
    );
    socketSvc.emitToUser(rows[0].victim_id, 'request:fulfilled', { request_id: parseInt(id) });

    // Email victim
    const [victimRow] = await conn.query('SELECT email, name FROM users WHERE user_id = ?', [rows[0].victim_id]);
    if (victimRow[0]) {
      email.sendAdminResolved({ to: victimRow[0].email, name: victimRow[0].name, requestId: id, title: rows[0].title, notes: notes || 'Resolved by administration' });
    }

    await conn.commit();
    return res.json({ success: true, message: 'Request resolved by admin.' });
  } catch (err) {
    await conn.rollback();
    console.error('resolveRequest error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};

// ── GET /api/admin/users ─────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;
    let whereClause = '';
    const params = [];
    if (role) { whereClause = 'WHERE role = ?'; params.push(role); }

    const [rows] = await pool.query(
      `SELECT user_id, name, email, phone, role, is_active, created_at
       FROM users ${whereClause}
       ORDER BY created_at DESC`,
      params
    );

    return res.json({ success: true, data: { users: rows } });
  } catch (err) {
    console.error('getAllUsers error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── PUT /api/admin/users/:id/toggle-active ───────────────────────────
const toggleUserActive = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`SELECT * FROM users WHERE user_id = ?`, [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const newStatus = !rows[0].is_active;
    await pool.query(`UPDATE users SET is_active = ? WHERE user_id = ?`, [newStatus, id]);
    return res.json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'}.`,
    });
  } catch (err) {
    console.error('toggleUserActive error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAdminDashboard, getAllShelters, verifyShelter, unverifyShelter,
  getAllRequests, getUnresolvedRequests, resolveRequest,
  getAllUsers, toggleUserActive,
};
