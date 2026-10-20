/**
 * assignmentService.js — with Socket.io + Email integration
 */

const { pool }  = require('../config/db');
const socketSvc = require('./socketService');
const email     = require('./emailService');

// ── Notification helper ──────────────────────────────────────────────
const createNotification = async (conn, { userId, title, message, type = 'info', requestId = null }) => {
  const [result] = await conn.query(
    `INSERT INTO notifications (user_id, title, message, type, related_request_id)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, title, message, type, requestId]
  );
  // Emit real-time notification
  socketSvc.emitToUser(userId, 'notification:new', {
    notification_id: result.insertId,
    title, message, type,
    related_request_id: requestId,
    is_read: false,
    created_at: new Date(),
  });
};

// ── Find next eligible shelter ───────────────────────────────────────
const findNextEligibleShelter = async (conn, { requestId, type, latitude, longitude }) => {
  const [tried] = await conn.query(
    `SELECT shelter_id FROM request_assignments WHERE request_id = ?`,
    [requestId]
  );
  const triedIds = tried.map((r) => r.shelter_id);

  let excludeClause = '';
  let excludeParams = [];
  if (triedIds.length > 0) {
    excludeClause = `AND sp.shelter_id NOT IN (${triedIds.map(() => '?').join(',')})`;
    excludeParams = triedIds;
  }

  const [rows] = await conn.query(
    `SELECT sp.*,
            (6371 * ACOS(
              COS(RADIANS(?)) * COS(RADIANS(sp.latitude)) *
              COS(RADIANS(sp.longitude) - RADIANS(?)) +
              SIN(RADIANS(?)) * SIN(RADIANS(sp.latitude))
            )) AS distance_km
     FROM shelter_profiles sp
     WHERE sp.is_verified = TRUE
       AND sp.current_occupancy < sp.total_capacity
       AND FIND_IN_SET(?, sp.accepted_types) > 0
       ${excludeClause}
     ORDER BY distance_km ASC
     LIMIT 1`,
    [latitude, longitude, latitude, type, ...excludeParams]
  );

  return rows[0] || null;
};

// ── Assign to shelter ────────────────────────────────────────────────
const assignToShelter = async (conn, { requestId, shelterId, sequenceNo }) => {
  const [result] = await conn.query(
    `INSERT INTO request_assignments (request_id, shelter_id, sequence_no, status)
     VALUES (?, ?, ?, 'pending')`,
    [requestId, shelterId, sequenceNo]
  );
  const assignmentId = result.insertId;

  await conn.query(
    `UPDATE emergency_requests
     SET status = 'assigned', current_assignment_id = ?, updated_at = NOW()
     WHERE request_id = ?`,
    [assignmentId, requestId]
  );

  // Emit real-time to shelter user
  const [reqRow] = await conn.query(
    `SELECT er.*, u.name AS victim_name FROM emergency_requests er
     JOIN users u ON u.user_id = er.victim_id WHERE er.request_id = ?`,
    [requestId]
  );
  socketSvc.emitToUser(
    (await conn.query('SELECT user_id FROM shelter_profiles WHERE shelter_id = ?', [shelterId]))[0][0]?.user_id,
    'request:assigned',
    { ...reqRow[0], assignment_id: assignmentId }
  );

  return assignmentId;
};

// ── Mark unresolved ──────────────────────────────────────────────────
const markUnresolved = async (conn, { requestId, requestTitle, victimId, victimEmail, victimName }) => {
  await conn.query(
    `UPDATE emergency_requests
     SET status = 'unresolved', current_assignment_id = NULL, updated_at = NOW()
     WHERE request_id = ?`,
    [requestId]
  );

  // Notify + email victim
  await createNotification(conn, {
    userId: victimId,
    title:  'Emergency Escalated to Authorities',
    message:`Your request "${requestTitle}" could not be fulfilled by nearby shelters. Government/Admin has been notified.`,
    type:   'error',
    requestId,
  });
  email.sendRequestUnresolved({ to: victimEmail, name: victimName, requestId, title: requestTitle });

  // Emit socket to victim
  socketSvc.emitToUser(victimId, 'request:unresolved', { request_id: requestId });

  // Notify all admins
  const [admins] = await conn.query(
    `SELECT user_id FROM users WHERE role = 'admin' AND is_active = TRUE`
  );
  for (const admin of admins) {
    await createNotification(conn, {
      userId:  admin.user_id,
      title:   'Unresolved Emergency Alert',
      message: `Request "${requestTitle}" (ID: ${requestId}) rejected by all shelters — needs intervention.`,
      type:    'error',
      requestId,
    });
  }
  socketSvc.emitToUsers(admins.map(a => a.user_id), 'request:unresolved', { request_id: requestId, title: requestTitle });
};

// ── Initiate assignment (called after victim submits) ────────────────
const initiateAssignment = async ({ requestId, type, latitude, longitude, title, victimId, victimEmail, victimName }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const shelter = await findNextEligibleShelter(conn, { requestId, type, latitude, longitude });

    if (!shelter) {
      await markUnresolved(conn, { requestId, requestTitle: title, victimId, victimEmail, victimName });
    } else {
      await assignToShelter(conn, { requestId, shelterId: shelter.shelter_id, sequenceNo: 1 });
      await createNotification(conn, {
        userId:  shelter.user_id,
        title:   'New Emergency Request Assigned',
        message: `A new "${type}" request has been assigned to your shelter. Please review and respond.`,
        type:    'warning',
        requestId,
      });
    }

    // Email victim: request submitted confirmation
    email.sendRequestConfirmation({ to: victimEmail, name: victimName, requestId, type, title });

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Handle shelter rejection ─────────────────────────────────────────
const handleRejection = async ({ assignmentId, requestId, shelterNotes }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE request_assignments
       SET status = 'rejected', responded_at = NOW(), shelter_notes = ?
       WHERE assignment_id = ?`,
      [shelterNotes || null, assignmentId]
    );

    const [reqRows] = await conn.query(
      `SELECT er.*, ra.sequence_no, u.email AS victim_email, u.name AS victim_name
       FROM emergency_requests er
       LEFT JOIN request_assignments ra ON ra.assignment_id = er.current_assignment_id
       JOIN users u ON u.user_id = er.victim_id
       WHERE er.request_id = ?`,
      [requestId]
    );
    const req = reqRows[0];

    // Notify victim: forwarding
    await createNotification(conn, {
      userId:  req.victim_id,
      title:   'Request Forwarded',
      message: `Your request "${req.title}" was forwarded to the next available shelter.`,
      type:    'info',
      requestId,
    });
    socketSvc.emitToUser(req.victim_id, 'request:rejected', { request_id: requestId });

    // Find next shelter
    const nextShelter = await findNextEligibleShelter(conn, {
      requestId,
      type:      req.type,
      latitude:  req.latitude,
      longitude: req.longitude,
    });

    if (!nextShelter) {
      await markUnresolved(conn, {
        requestId,
        requestTitle: req.title,
        victimId:     req.victim_id,
        victimEmail:  req.victim_email,
        victimName:   req.victim_name,
      });
    } else {
      const nextSeq = (req.sequence_no || 1) + 1;
      await assignToShelter(conn, { requestId, shelterId: nextShelter.shelter_id, sequenceNo: nextSeq });
      await createNotification(conn, {
        userId:  nextShelter.user_id,
        title:   'New Emergency Request Assigned',
        message: `A "${req.type}" request has been forwarded to your shelter. Please respond promptly.`,
        type:    'warning',
        requestId,
      });
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = { initiateAssignment, handleRejection, createNotification };
