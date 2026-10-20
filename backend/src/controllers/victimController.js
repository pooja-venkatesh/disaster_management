const { pool }                 = require('../config/db');
const { initiateAssignment }   = require('../services/assignmentService');
const { calculatePriorityScore } = require('../services/priorityService');

// ── POST /api/victim/requests ────────────────────────────────────────
// SECURITY: priority_score and priority_level are NEVER accepted from
// the frontend. They are always calculated server-side.
const submitRequest = async (req, res) => {
  try {
    const {
      title,
      description,
      latitude,
      longitude,
      address,
      people_count,
      needs,               // string[] e.g. ['food','water','rescue']
      children_present,
      elderly_present,
      injured,
      urgent_medical,
    } = req.body;

    const victimId = req.user.user_id;

    // ── Required field & coordinate validation ──────────────────────
    if (!title || latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
      return res.status(400).json({
        success: false,
        message: 'title, latitude, and longitude are required.',
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

    const pc = Math.max(1, parseInt(people_count) || 1);
    const needsArr = Array.isArray(needs)
      ? needs.filter((n) => ['food', 'water', 'medical', 'rescue', 'shelter'].includes(n))
      : [];

    if (needsArr.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one assistance category (needs) is required.',
      });
    }

    // ── Backend priority calculation (frontend values are IGNORED) ───
    const { score, priority_level } = calculatePriorityScore({
      people_count:     pc,
      needs:            needsArr,
      children_present: !!children_present,
      elderly_present:  !!elderly_present,
      injured:          !!injured,
      urgent_medical:   !!urgent_medical,
    });

    // ── Insert request ────────────────────────────────────────────────
    const [result] = await pool.query(
      `INSERT INTO emergency_requests
         (victim_id, type, title, description, latitude, longitude, address,
          priority, priority_score,
          people_count, needs, children_present, elderly_present, injured, urgent_medical,
          status)
       VALUES (?, 'SOS', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        victimId,
        title,
        description || null,
        parseFloat(latitude),
        parseFloat(longitude),
        address || null,
        priority_level,   // backend-calculated
        score,            // backend-calculated
        pc,
        needsArr.join(','),
        children_present ? 1 : 0,
        elderly_present  ? 1 : 0,
        injured          ? 1 : 0,
        urgent_medical   ? 1 : 0,
      ]
    );
    const requestId = result.insertId;

    // ── Trigger cascading shelter assignment ─────────────────────────
    initiateAssignment({
      requestId,
      type:        'SOS',
      latitude:    parseFloat(latitude),
      longitude:   parseFloat(longitude),
      title,
      victimId,
      victimEmail: req.user.email,
      victimName:  req.user.name,
    }).catch((err) =>
      console.error('Assignment initiation failed for request', requestId, err)
    );

    return res.status(201).json({
      success: true,
      message: 'Emergency request submitted. Finding nearest shelter...',
      data: { request_id: requestId },
    });
  } catch (err) {
    console.error('submitRequest error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── GET /api/victim/requests ─────────────────────────────────────────
const getMyRequests = async (req, res) => {
  try {
    const victimId = req.user.user_id;
    const { status } = req.query;

    let whereClause = 'WHERE er.victim_id = ?';
    const params = [victimId];
    if (status) { whereClause += ' AND er.status = ?'; params.push(status); }

    const [rows] = await pool.query(
      `SELECT er.request_id, er.type, er.title, er.status, er.priority,
              er.priority_score, er.people_count, er.needs,
              er.children_present, er.elderly_present, er.injured, er.urgent_medical,
              er.created_at, er.updated_at,
              sp.shelter_name AS current_shelter_name,
              sp.address      AS shelter_address
       FROM emergency_requests er
       LEFT JOIN request_assignments ra ON ra.assignment_id = er.current_assignment_id
       LEFT JOIN shelter_profiles sp   ON sp.shelter_id = ra.shelter_id
       ${whereClause}
       ORDER BY er.created_at DESC`,
      params
    );

    return res.json({ success: true, data: { requests: rows } });
  } catch (err) {
    console.error('getMyRequests error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── GET /api/victim/requests/:id ─────────────────────────────────────
const getRequestDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const victimId = req.user.user_id;

    const [rows] = await pool.query(
      `SELECT request_id, type, title, description, status, priority,
              people_count, needs, children_present, elderly_present,
              injured, urgent_medical, address, latitude, longitude,
              created_at, updated_at, current_assignment_id
       FROM emergency_requests
       WHERE request_id = ? AND victim_id = ?`,
      [id, victimId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const [assignments] = await pool.query(
      `SELECT ra.assignment_id, ra.status AS assignment_status,
              ra.assigned_at, ra.responded_at, ra.sequence_no,
              sp.shelter_name, sp.address AS shelter_address
       FROM request_assignments ra
       JOIN shelter_profiles sp ON sp.shelter_id = ra.shelter_id
       WHERE ra.request_id = ?
       ORDER BY ra.sequence_no ASC`,
      [id]
    );

    return res.json({
      success: true,
      data: { request: rows[0], timeline: assignments },
    });
  } catch (err) {
    console.error('getRequestDetail error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── DELETE /api/victim/requests/:id ──────────────────────────────────
const cancelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const victimId = req.user.user_id;

    const [rows] = await pool.query(
      `SELECT * FROM emergency_requests WHERE request_id = ? AND victim_id = ?`,
      [id, victimId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (!['pending', 'assigned'].includes(rows[0].status)) {
      return res.status(400).json({ success: false, message: 'Only pending or assigned requests can be cancelled.' });
    }

    await pool.query(
      `UPDATE emergency_requests SET status = 'cancelled', updated_at = NOW() WHERE request_id = ?`,
      [id]
    );

    return res.json({ success: true, message: 'Request cancelled.' });
  } catch (err) {
    console.error('cancelRequest error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── GET /api/victim/dashboard ─────────────────────────────────────────
const getVictimDashboard = async (req, res) => {
  try {
    const victimId = req.user.user_id;

    const [stats] = await pool.query(
      `SELECT
         COUNT(*)                                            AS total,
         COUNT(CASE WHEN status='pending'    THEN 1 END)    AS pending,
         COUNT(CASE WHEN status='assigned'   THEN 1 END)    AS assigned,
         COUNT(CASE WHEN status='accepted'   THEN 1 END)    AS accepted,
         COUNT(CASE WHEN status='fulfilled'  THEN 1 END)    AS fulfilled,
         COUNT(CASE WHEN status='unresolved' THEN 1 END)    AS unresolved
       FROM emergency_requests WHERE victim_id = ?`,
      [victimId]
    );

    const [recent] = await pool.query(
      `SELECT er.request_id, er.title, er.status, er.priority,
              er.people_count, er.needs, er.created_at,
              sp.shelter_name AS current_shelter
       FROM emergency_requests er
       LEFT JOIN request_assignments ra ON ra.assignment_id = er.current_assignment_id
       LEFT JOIN shelter_profiles sp   ON sp.shelter_id = ra.shelter_id
       WHERE er.victim_id = ?
       ORDER BY er.created_at DESC LIMIT 5`,
      [victimId]
    );

    return res.json({ success: true, data: { stats: stats[0], recentRequests: recent } });
  } catch (err) {
    console.error('getVictimDashboard error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { submitRequest, getMyRequests, getRequestDetail, cancelRequest, getVictimDashboard };
