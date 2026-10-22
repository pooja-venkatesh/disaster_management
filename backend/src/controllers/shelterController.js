const { pool }  = require('../config/db');
const email     = require('../services/emailService');
const socketSvc = require('../services/socketService');

// ── GET /api/shelter/profile ────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sp.*, u.full_name AS name, u.email, u.phone
       FROM shelter_profiles sp
       JOIN users u ON u.user_id = sp.user_id
       WHERE sp.user_id = ?`,
      [req.user.user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shelter profile not set up yet.' });
    }
    return res.json({ success: true, data: { profile: rows[0] } });
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── POST /api/shelter/profile ───────────────────────────────────────
// Create or update shelter profile (upsert)
const upsertProfile = async (req, res) => {
  try {
    const {
      shelter_name, address, latitude, longitude,
      total_capacity, accepted_types,
    } = req.body;

    if (!shelter_name || latitude === undefined || latitude === null || longitude === undefined || longitude === null || !total_capacity) {
      return res.status(400).json({
        success: false,
        message: 'shelter_name, latitude, longitude, and total_capacity are required.',
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS coordinates are required (latitude between -90 and 90, longitude between -180 and 180).',
      });
    }

    const types = Array.isArray(accepted_types)
      ? accepted_types.join(',')
      : (accepted_types || 'shelter');

    // Upsert: insert or update on duplicate user_id
    await pool.query(
      `INSERT INTO shelter_profiles
         (user_id, shelter_name, address, latitude, longitude, total_capacity, accepted_types)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         shelter_name     = VALUES(shelter_name),
         address          = VALUES(address),
         latitude         = VALUES(latitude),
         longitude        = VALUES(longitude),
         total_capacity   = VALUES(total_capacity),
         accepted_types   = VALUES(accepted_types)`,
      [req.user.user_id, shelter_name, address || null, latitude, longitude, total_capacity, types]
    );

    const [rows] = await pool.query(
      `SELECT * FROM shelter_profiles WHERE user_id = ?`,
      [req.user.user_id]
    );

    return res.json({ success: true, message: 'Shelter profile saved.', data: { profile: rows[0] } });
  } catch (err) {
    console.error('upsertProfile error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── GET /api/shelter/dashboard ──────────────────────────────────────
const getShelterDashboard = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get shelter profile
    const [profileRows] = await pool.query(
      `SELECT * FROM shelter_profiles WHERE user_id = ?`, [userId]
    );
    const profile = profileRows[0] || null;
    const shelterId = profile?.shelter_id;

    if (!shelterId) {
      return res.json({
        success: true,
        data: { profile: null, stats: null, pendingRequests: [] },
      });
    }

    const [stats] = await pool.query(
      `SELECT
         COUNT(CASE WHEN ra.status = 'pending'   THEN 1 END) AS pending_count,
         COUNT(CASE WHEN ra.status = 'accepted'  THEN 1 END) AS accepted_count,
         COUNT(CASE WHEN ra.status = 'rejected'  THEN 1 END) AS rejected_count,
         COUNT(CASE WHEN er.status = 'fulfilled' AND ra.shelter_id = ? THEN 1 END) AS fulfilled_count
       FROM request_assignments ra
       JOIN emergency_requests er ON er.request_id = ra.request_id
       WHERE ra.shelter_id = ?`,
      [shelterId, shelterId]
    );

    const [pending] = await pool.query(
      `SELECT ra.assignment_id, ra.assigned_at, ra.sequence_no,
              er.request_id, er.type, er.title, er.priority, er.address,
              er.description, er.latitude, er.longitude,
              u.full_name AS victim_name, u.phone AS victim_phone
       FROM request_assignments ra
       JOIN emergency_requests er ON er.request_id = ra.request_id
       JOIN users u               ON u.user_id = er.victim_id
       WHERE ra.shelter_id = ? AND ra.status = 'pending'
       ORDER BY ra.assigned_at DESC
       LIMIT 10`,
      [shelterId]
    );

    return res.json({
      success: true,
      data: {
        profile,
        stats: stats[0],
        pendingRequests: pending,
      },
    });
  } catch (err) {
    console.error('getShelterDashboard error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── GET /api/shelter/requests ───────────────────────────────────────
const getShelterRequests = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { status = 'pending' } = req.query;

    const [profileRows] = await pool.query(
      `SELECT shelter_id FROM shelter_profiles WHERE user_id = ?`, [userId]
    );
    if (!profileRows.length) {
      return res.status(404).json({ success: false, message: 'Shelter profile not found.' });
    }
    const shelterId = profileRows[0].shelter_id;

    const [rows] = await pool.query(
      `SELECT ra.assignment_id, ra.status AS assignment_status,
              ra.assigned_at, ra.responded_at, ra.shelter_notes, ra.sequence_no,
              er.request_id, er.type, er.title, er.priority, er.priority_score,
              er.people_count, er.needs,
              er.children_present, er.elderly_present, er.injured, er.urgent_medical,
              er.description, er.address, er.latitude, er.longitude,
              er.status AS request_status, er.created_at,
              u.full_name AS victim_name, u.phone AS victim_phone, u.email AS victim_email,
              -- compute distance from shelter
              sp_self.latitude AS shelter_lat, sp_self.longitude AS shelter_lng,
              ROUND((6371 * ACOS(
                COS(RADIANS(sp_self.latitude)) * COS(RADIANS(er.latitude)) *
                COS(RADIANS(er.longitude) - RADIANS(sp_self.longitude)) +
                SIN(RADIANS(sp_self.latitude)) * SIN(RADIANS(er.latitude))
              )), 1) AS distance_km
       FROM request_assignments ra
       JOIN emergency_requests er ON er.request_id = ra.request_id
       JOIN users u               ON u.user_id = er.victim_id
       JOIN shelter_profiles sp_self ON sp_self.shelter_id = ra.shelter_id
       WHERE ra.shelter_id = ?
         AND ra.status = ?
       ORDER BY
         FIELD(er.priority, 'critical', 'high', 'medium', 'low') ASC,
         ra.assigned_at DESC`,
      [shelterId, status]
    );

    return res.json({ success: true, data: { requests: rows } });
  } catch (err) {
    console.error('getShelterRequests error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── PUT /api/shelter/requests/:assignmentId/accept ──────────────────
const acceptRequest = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { assignmentId } = req.params;
    const userId = req.user.user_id;

    // Verify this assignment belongs to this shelter
    const [rows] = await conn.query(
      `SELECT ra.*, sp.user_id AS shelter_user_id, sp.shelter_id,
              er.victim_id, er.title, er.request_id
       FROM request_assignments ra
       JOIN shelter_profiles sp ON sp.shelter_id = ra.shelter_id
       JOIN emergency_requests er ON er.request_id = ra.request_id
       WHERE ra.assignment_id = ?`,
      [assignmentId]
    );
    if (!rows.length || rows[0].shelter_user_id !== userId) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Assignment not found or not yours.' });
    }
    const assignment = rows[0];
    if (assignment.status !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Assignment already responded to.' });
    }

    // Mark assignment accepted
    await conn.query(
      `UPDATE request_assignments
       SET status = 'accepted', responded_at = NOW()
       WHERE assignment_id = ?`,
      [assignmentId]
    );

    // Mark request accepted
    await conn.query(
      `UPDATE emergency_requests
       SET status = 'accepted', updated_at = NOW()
       WHERE request_id = ?`,
      [assignment.request_id]
    );

    // Notify victim (DB + socket + email)
    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type, related_request_id)
       VALUES (?, ?, ?, 'success', ?)`,
      [
        assignment.victim_id,
        'Request Accepted',
        `Your request "${assignment.title}" has been accepted by a shelter. Help is on the way.`,
        assignment.request_id,
      ]
    );
    socketSvc.emitToUser(assignment.victim_id, 'request:accepted', { request_id: assignment.request_id });

    // Get shelter info for email
    const [shelterInfo] = await conn.query(
      `SELECT sp.shelter_name, sp.address, u.email AS victim_email, u.full_name AS victim_name
       FROM shelter_profiles sp
       JOIN emergency_requests er ON er.request_id = ?
       JOIN users u ON u.user_id = er.victim_id
       WHERE sp.shelter_id = ?`,
      [assignment.request_id, assignment.shelter_id]
    );
    if (shelterInfo[0]) {
      email.sendRequestAccepted({
        to:             shelterInfo[0].victim_email,
        name:           shelterInfo[0].victim_name,
        requestId:      assignment.request_id,
        title:          assignment.title,
        shelterName:    shelterInfo[0].shelter_name,
        shelterAddress: shelterInfo[0].address,
      });
    }

    await conn.commit();
    return res.json({ success: true, message: 'Request accepted successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error('acceptRequest error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};

// ── PUT /api/shelter/requests/:assignmentId/reject ──────────────────
const rejectRequest = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { notes } = req.body;
    const userId = req.user.user_id;

    const [rows] = await pool.query(
      `SELECT ra.*, sp.user_id AS shelter_user_id, er.request_id, er.title
       FROM request_assignments ra
       JOIN shelter_profiles sp ON sp.shelter_id = ra.shelter_id
       JOIN emergency_requests er ON er.request_id = ra.request_id
       WHERE ra.assignment_id = ?`,
      [assignmentId]
    );
    if (!rows.length || rows[0].shelter_user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Assignment not found or not yours.' });
    }
    if (rows[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Assignment already responded to.' });
    }

    const { handleRejection } = require('../services/assignmentService');
    await handleRejection({
      assignmentId: parseInt(assignmentId),
      requestId:    rows[0].request_id,
      shelterNotes: notes || null,
    });

    return res.json({ success: true, message: 'Request rejected. Forwarding to next shelter.' });
  } catch (err) {
    console.error('rejectRequest error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── PUT /api/shelter/requests/:assignmentId/fulfill ─────────────────
const fulfillRequest = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { assignmentId } = req.params;
    const userId = req.user.user_id;

    const [rows] = await conn.query(
      `SELECT ra.*, sp.user_id AS shelter_user_id, sp.shelter_id,
              er.request_id, er.victim_id, er.title
       FROM request_assignments ra
       JOIN shelter_profiles sp ON sp.shelter_id = ra.shelter_id
       JOIN emergency_requests er ON er.request_id = ra.request_id
       WHERE ra.assignment_id = ? AND sp.user_id = ?`,
      [assignmentId, userId]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Assignment not found.' });
    }
    if (rows[0].status !== 'accepted') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Can only fulfill an accepted request.' });
    }

    await conn.query(
      `UPDATE emergency_requests
       SET status = 'fulfilled', updated_at = NOW()
       WHERE request_id = ?`,
      [rows[0].request_id]
    );

    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type, related_request_id)
       VALUES (?, ?, ?, 'success', ?)`,
      [
        rows[0].victim_id,
        'Request Fulfilled',
        `Your request "${rows[0].title}" has been marked as fulfilled. Thank you for using DisasterRM.`,
        rows[0].request_id,
      ]
    );
    socketSvc.emitToUser(rows[0].victim_id, 'request:fulfilled', { request_id: rows[0].request_id });

    // Get victim email for notification
    const [victimRow] = await conn.query('SELECT email, name FROM users WHERE user_id = ?', [rows[0].victim_id]);
    if (victimRow[0]) {
      email.sendRequestFulfilled({ to: victimRow[0].email, name: victimRow[0].name, requestId: rows[0].request_id, title: rows[0].title });
    }

    await conn.commit();
    return res.json({ success: true, message: 'Request marked as fulfilled.' });
  } catch (err) {
    await conn.rollback();
    console.error('fulfillRequest error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    conn.release();
  }
};

// ── GET /api/shelter/history ────────────────────────────────────────
const getShelterHistory = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [profileRows] = await pool.query(
      `SELECT shelter_id FROM shelter_profiles WHERE user_id = ?`, [userId]
    );
    if (!profileRows.length) {
      return res.json({ success: true, data: { history: [] } });
    }
    const shelterId = profileRows[0].shelter_id;

    const [rows] = await pool.query(
      `SELECT ra.assignment_id, ra.status AS assignment_status,
              ra.assigned_at, ra.responded_at, ra.shelter_notes,
              er.request_id, er.type, er.title, er.priority,
              er.status AS request_status, er.created_at,
              u.full_name AS victim_name
       FROM request_assignments ra
       JOIN emergency_requests er ON er.request_id = ra.request_id
       JOIN users u               ON u.user_id = er.victim_id
       WHERE ra.shelter_id = ? AND ra.status != 'pending'
       ORDER BY ra.responded_at DESC
       LIMIT 50`,
      [shelterId]
    );

    return res.json({ success: true, data: { history: rows } });
  } catch (err) {
    console.error('getShelterHistory error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getProfile, upsertProfile, getShelterDashboard,
  getShelterRequests, acceptRequest, rejectRequest,
  fulfillRequest, getShelterHistory,
};
