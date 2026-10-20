const express = require('express');
const router  = express.Router();
const { pool }  = require('../config/db');

// ── GET /api/shelters ────────────────────────────────────────────────
// Returns all verified, active shelters with valid coordinates.
// Accessible to victims, shelters, admins, and authenticated users.
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         sp.shelter_id,
         sp.shelter_name AS name,
         sp.shelter_name,
         sp.address,
         CAST(sp.latitude AS DOUBLE) AS latitude,
         CAST(sp.longitude AS DOUBLE) AS longitude,
         sp.total_capacity AS capacity,
         sp.total_capacity,
         sp.current_occupancy AS occupancy,
         sp.current_occupancy,
         GREATEST(0, sp.total_capacity - sp.current_occupancy) AS available_capacity,
         CASE 
           WHEN sp.current_occupancy >= sp.total_capacity THEN 'full'
           WHEN sp.is_verified = 1 THEN 'active'
           ELSE 'pending'
         END AS status,
         sp.accepted_types AS facilities,
         sp.accepted_types,
         sp.is_verified,
         sp.updated_at AS last_updated,
         sp.updated_at,
         u.phone,
         u.email
       FROM shelter_profiles sp
       JOIN users u ON u.user_id = sp.user_id
       WHERE sp.is_verified = TRUE
         AND sp.latitude != 0
         AND sp.longitude != 0
         AND u.is_active = TRUE
       ORDER BY sp.shelter_name ASC`
    );

    return res.json({
      success: true,
      data: {
        shelters: rows,
        count: rows.length,
      },
    });
  } catch (err) {
    console.error('GET /api/shelters error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch registered shelters.' });
  }
});

// ── GET /api/shelters/:id ────────────────────────────────────────────
// Single shelter details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT 
         sp.shelter_id,
         sp.shelter_name AS name,
         sp.shelter_name,
         sp.address,
         CAST(sp.latitude AS DOUBLE) AS latitude,
         CAST(sp.longitude AS DOUBLE) AS longitude,
         sp.total_capacity AS capacity,
         sp.total_capacity,
         sp.current_occupancy AS occupancy,
         sp.current_occupancy,
         GREATEST(0, sp.total_capacity - sp.current_occupancy) AS available_capacity,
         sp.accepted_types AS facilities,
         sp.accepted_types,
         sp.is_verified,
         sp.updated_at AS last_updated,
         u.phone,
         u.email
       FROM shelter_profiles sp
       JOIN users u ON u.user_id = sp.user_id
       WHERE sp.shelter_id = ?
         AND sp.is_verified = TRUE`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shelter not found or not yet verified.' });
    }

    return res.json({ success: true, data: { shelter: rows[0] } });
  } catch (err) {
    console.error('GET /api/shelters/:id error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

module.exports = router;
