/**
 * Users Controller — Profile + Admin user management
 */
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { query } = require('../../../config/database');
const { success, notFound, badRequest, forbidden } = require('../utils/response');
const { auditLog } = require('../middleware/audit');

// ─── MULTER SETUP ──────────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '5')) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error('Only JPEG, PNG and WEBP images allowed'));
    }
    cb(null, true);
  },
}).single('avatar');

// ── PROFILE ─────────────────────────────────────────────────

/** GET /api/users/me */
exports.getProfile = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.email, u.name, u.phone, u.role,
              u.designation, u.employee_code, u.avatar_url,
              u.color, u.initial, u.last_login_at, u.created_at,
              d.name AS department
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!rows.length) return notFound(res, 'User not found');
    return success(res, rows[0]);
  } catch (err) { next(err); }
};

/** PATCH /api/users/me */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const { rows } = await query(
      `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone),
              initial = LEFT(UPPER(COALESCE($1, name)), 2), updated_at = NOW()
       WHERE id = $3 RETURNING id, name, phone, email, role, initial, color`,
      [name || null, phone || null, req.user.id]
    );
    await auditLog({ userId: req.user.id, userName: req.user.name,
      action: 'PROFILE_UPDATE', entityType: 'user', entityId: req.user.id,
      newValues: { name, phone }, ipAddress: req.ip });
    return success(res, rows[0], 'Profile updated');
  } catch (err) { next(err); }
};

/** POST /api/users/me/avatar */
exports.uploadAvatar = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) return badRequest(res, err.message);
    if (!req.file) return badRequest(res, 'No file uploaded');
    try {
      const avatarUrl = `/uploads/${req.file.filename}`;
      await query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [avatarUrl, req.user.id]);
      return success(res, { avatar_url: avatarUrl }, 'Avatar updated');
    } catch (e) { next(e); }
  });
};

/** POST /api/users/me/change-password */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return badRequest(res, 'New password must be at least 6 characters');
    }

    const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return badRequest(res, 'Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    await query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2`,
      [hash, req.user.id]
    );

    await auditLog({ userId: req.user.id, userName: req.user.name,
      action: 'PASSWORD_CHANGE', entityType: 'user', entityId: req.user.id,
      ipAddress: req.ip });

    return success(res, {}, 'Password changed successfully');
  } catch (err) { next(err); }
};

// ── ADMIN — USER MANAGEMENT ──────────────────────────────────

/** POST /api/users  (admin only) — create a new staff/visitor user */
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, phone, role, department_id, designation, password } = req.body;
    if (!name || !email || !role || !password) {
      return badRequest(res, 'Name, email, role and password are required');
    }
    const validRoles = ['admin', 'approver', 'gate', 'visitor'];
    if (!validRoles.includes(role)) return badRequest(res, 'Invalid role');

    const dup = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    if (dup.rows.length) return badRequest(res, 'Email already in use');

    const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    const id = uuidv4();
    const initial = name.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const colors = ['#0891b2','#10b981','#f59e0b','#3b82f6','#ef4444','#06b6d4','#8b5cf6','#ec4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const { rows } = await query(
      `INSERT INTO users (id, email, password_hash, name, phone, role, department_id, designation, initial, color, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)
       RETURNING id, email, name, phone, role, designation, initial, color, is_active, created_at`,
      [id, email.toLowerCase().trim(), hash, name.trim(), phone||null, role, department_id||null, designation||null, initial, color]
    );
    await auditLog({ userId: req.user.id, userName: req.user.name,
      action: 'USER_CREATED', entityType: 'user', entityId: id,
      newValues: { name, email, role }, ipAddress: req.ip });
    return success(res, rows[0], 'User created successfully');
  } catch (err) { next(err); }
};

/** PATCH /api/users/:id  (admin only) — update name/phone/role/dept/designation */
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, role, department_id, designation } = req.body;
    const validRoles = ['admin', 'approver', 'gate', 'visitor'];
    if (role && !validRoles.includes(role)) return badRequest(res, 'Invalid role');

    const { rows } = await query(
      `UPDATE users SET
         name        = COALESCE($1, name),
         phone       = COALESCE($2, phone),
         role        = COALESCE($3, role),
         department_id = COALESCE($4, department_id),
         designation = COALESCE($5, designation),
         initial     = LEFT(UPPER(COALESCE($1, name)), 2),
         updated_at  = NOW()
       WHERE id = $6
       RETURNING id, email, name, phone, role, designation, initial, color, is_active`,
      [name||null, phone||null, role||null, department_id||null, designation||null, id]
    );
    if (!rows.length) return notFound(res, 'User not found');
    await auditLog({ userId: req.user.id, userName: req.user.name,
      action: 'USER_UPDATED', entityType: 'user', entityId: id,
      newValues: { name, role }, ipAddress: req.ip });
    return success(res, rows[0], 'User updated successfully');
  } catch (err) { next(err); }
};

/** DELETE /api/users/:id  (admin only) — permanently remove a user */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return badRequest(res, 'You cannot delete your own account');
    const { rows } = await query(`SELECT name, role FROM users WHERE id = $1`, [id]);
    if (!rows.length) return notFound(res, 'User not found');
    await query(`DELETE FROM users WHERE id = $1`, [id]);
    await auditLog({ userId: req.user.id, userName: req.user.name,
      action: 'USER_DELETED', entityType: 'user', entityId: id,
      oldValues: { name: rows[0].name, role: rows[0].role }, ipAddress: req.ip });
    return success(res, { id }, 'User deleted successfully');
  } catch (err) { next(err); }
};

/** GET /api/users  (admin only) */
exports.listAll = async (req, res, next) => {
  try {
    const { role, search } = req.query;
    const params = [];
    const conditions = [];

    if (role) { params.push(role); conditions.push(`u.role = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await query(
      `SELECT u.id, u.email, u.name, u.phone, u.role,
              u.designation, u.employee_code, u.is_active,
              u.last_login_at, u.created_at, d.name AS department
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       ${where}
       ORDER BY u.role, u.name`,
      params
    );
    return success(res, rows);
  } catch (err) { next(err); }
};

/** PATCH /api/users/:id/status  (admin only) */
exports.toggleStatus = async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active`,
      [req.params.id]
    );
    if (!rows.length) return notFound(res, 'User not found');
    await auditLog({ userId: req.user.id, userName: req.user.name,
      action: rows[0].is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'user', entityId: req.params.id, ipAddress: req.ip });
    return success(res, rows[0], `User ${rows[0].is_active ? 'activated' : 'deactivated'}`);
  } catch (err) { next(err); }
};
