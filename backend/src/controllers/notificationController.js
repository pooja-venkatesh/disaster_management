const { pool } = require('../config/db');

// ── GET /api/notifications ───────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user.user_id]
    );
    const unreadCount = rows.filter((n) => !n.is_read).length;
    return res.json({ success: true, data: { notifications: rows, unreadCount } });
  } catch (err) {
    console.error('getNotifications error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── PUT /api/notifications/read-all ─────────────────────────────────
const markAllRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = ?`,
      [req.user.user_id]
    );
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('markAllRead error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── PUT /api/notifications/:id/read ─────────────────────────────────
const markOneRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE notification_id = ? AND user_id = ?`,
      [req.params.id, req.user.user_id]
    );
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('markOneRead error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { getNotifications, markAllRead, markOneRead };
