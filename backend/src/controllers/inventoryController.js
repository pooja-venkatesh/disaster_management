const { pool } = require('../config/db');

const VALID_TYPES = ['food', 'water', 'medicine', 'clothing', 'other'];

// ── GET /api/shelter/inventory ───────────────────────────────────────
const getInventory = async (req, res) => {
  try {
    const [profile] = await pool.query(
      'SELECT shelter_id FROM shelter_profiles WHERE user_id = ?',
      [req.user.user_id]
    );
    if (!profile.length) {
      return res.status(404).json({ success: false, message: 'Shelter profile not found.' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM shelter_inventory WHERE shelter_id = ? ORDER BY item_type',
      [profile[0].shelter_id]
    );

    return res.json({ success: true, data: { inventory: rows } });
  } catch (err) {
    console.error('getInventory error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── PUT /api/shelter/inventory ───────────────────────────────────────
// Upsert multiple inventory items at once
const updateInventory = async (req, res) => {
  try {
    const { items } = req.body; // [{item_type, quantity, unit}]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required.' });
    }

    const [profile] = await pool.query(
      'SELECT shelter_id FROM shelter_profiles WHERE user_id = ?',
      [req.user.user_id]
    );
    if (!profile.length) {
      return res.status(404).json({ success: false, message: 'Shelter profile not found.' });
    }
    const shelterId = profile[0].shelter_id;

    for (const item of items) {
      if (!VALID_TYPES.includes(item.item_type)) continue;
      await pool.query(
        `INSERT INTO shelter_inventory (shelter_id, item_type, quantity, unit)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           quantity     = VALUES(quantity),
           unit         = VALUES(unit),
           last_updated = NOW()`,
        [shelterId, item.item_type, item.quantity ?? 0, item.unit || 'units']
      );
    }

    const [rows] = await pool.query(
      'SELECT * FROM shelter_inventory WHERE shelter_id = ? ORDER BY item_type',
      [shelterId]
    );

    return res.json({ success: true, message: 'Inventory updated.', data: { inventory: rows } });
  } catch (err) {
    console.error('updateInventory error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── GET /api/admin/inventory ─────────────────────────────────────────
// Admin sees all shelters inventory (highlights low stock)
const getAllInventory = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT si.*, sp.shelter_name, sp.is_verified, u.full_name AS owner_name
       FROM shelter_inventory si
       JOIN shelter_profiles sp ON sp.shelter_id = si.shelter_id
       JOIN users u ON u.user_id = sp.user_id
       WHERE sp.is_verified = TRUE
       ORDER BY si.quantity ASC`
    );

    // Flag low stock (quantity < 20)
    const withFlag = rows.map((r) => ({ ...r, is_low: r.quantity < 20 }));

    return res.json({ success: true, data: { inventory: withFlag } });
  } catch (err) {
    console.error('getAllInventory error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { getInventory, updateInventory, getAllInventory };
