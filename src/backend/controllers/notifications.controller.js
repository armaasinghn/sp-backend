/**
 * Notifications Controller
 */
const { query } = require('../../../config/database');
const { success, notFound } = require('../utils/response');

/** GET /api/notifications */
exports.list = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT n.*, p.pass_number, p.visitor_name
       FROM notifications n
       LEFT JOIN passes p ON p.id = n.pass_id
       WHERE n.target_user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const unread = rows.filter(n => n.status === 'unread').length;
    return success(res, { notifications: rows, unread_count: unread });
  } catch (err) { next(err); }
};

/** PATCH /api/notifications/:id/read */
exports.markRead = async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE notifications
       SET status = 'read', read_at = NOW()
       WHERE id = $1 AND target_user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return notFound(res, 'Notification not found');
    return success(res, rows[0]);
  } catch (err) { next(err); }
};

/** PATCH /api/notifications/read-all */
exports.markAllRead = async (req, res, next) => {
  try {
    await query(
      `UPDATE notifications
       SET status = 'read', read_at = NOW()
       WHERE target_user_id = $1 AND status = 'unread'`,
      [req.user.id]
    );
    return success(res, {}, 'All notifications marked as read');
  } catch (err) { next(err); }
};

/** GET /api/notifications/unread-count */
exports.unreadCount = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*) AS count FROM notifications
       WHERE target_user_id = $1 AND status = 'unread'`,
      [req.user.id]
    );
    return success(res, { count: parseInt(rows[0].count) });
  } catch (err) { next(err); }
};
