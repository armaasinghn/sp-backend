/**
 * Gates Controller — manage entry gate list
 */
const { query } = require('../../../config/database');
const { success, created, notFound, badRequest } = require('../utils/response');

/**
 * GET /api/gates
 * Returns all active gates (all authenticated roles)
 */
exports.getGates = async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, description FROM gates WHERE active = true ORDER BY id'
    );
    return success(res, rows);
  } catch (err) { next(err); }
};

/**
 * POST /api/gates  (admin only)
 */
exports.createGate = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return badRequest(res, 'Gate name is required');
    const { rows } = await query(
      `INSERT INTO gates (name, description) VALUES ($1, $2) RETURNING *`,
      [name.trim(), description || null]
    );
    return created(res, rows[0], 'Gate created');
  } catch (err) {
    if (err.code === '23505') return badRequest(res, 'A gate with that name already exists');
    next(err);
  }
};

/**
 * PATCH /api/gates/:id/toggle  (admin only)
 * Toggles active/inactive
 */
exports.toggleGate = async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE gates SET active = NOT active WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return notFound(res, 'Gate not found');
    return success(res, rows[0], rows[0].active ? 'Gate activated' : 'Gate deactivated');
  } catch (err) { next(err); }
};
