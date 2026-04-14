/**
 * Visitors Controller
 */
const { query } = require('../../../config/database');
const { success, created, notFound, badRequest, conflict, paginated } = require('../utils/response');
const { auditLog } = require('../middleware/audit');

const PAGE_SIZE = 20;

/** GET /api/visitors */
exports.list = async (req, res, next) => {
  try {
    const { search, page = 1, limit = PAGE_SIZE } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE u.name ILIKE $1 OR vp.company ILIKE $1 OR u.phone ILIKE $1`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM users u
       JOIN visitor_profiles vp ON vp.user_id = u.id
       ${where}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.phone,
              vp.company, vp.address, vp.govt_id_type, vp.govt_id_number,
              vp.vehicle_number, vp.vehicle_type, vp.total_visits,
              vp.last_visit_at, vp.is_blacklisted
       FROM users u
       JOIN visitor_profiles vp ON vp.user_id = u.id
       ${where}
       ORDER BY vp.last_visit_at DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return paginated(res, rows, {
      page: parseInt(page), limit: parseInt(limit), total,
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) { next(err); }
};

/** GET /api/visitors/:id */
exports.get = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.phone,
              vp.*,
              (SELECT json_agg(p ORDER BY p.created_at DESC)
               FROM passes p WHERE p.visitor_id = vp.id) AS pass_history
       FROM users u
       JOIN visitor_profiles vp ON vp.user_id = u.id
       WHERE u.id = $1`, [req.params.id]
    );
    if (!rows.length) return notFound(res, 'Visitor not found');
    return success(res, rows[0]);
  } catch (err) { next(err); }
};

/** POST /api/visitors/register  (public — self-registration) */
exports.selfRegister = async (req, res, next) => {
  try {
    const {
      name, email, phone, password,
      company, address, govt_id_type, govt_id_number,
      vehicle_number, vehicle_type,
      // Pass details
      purpose, description, valid_from, valid_until, host_user_id,
    } = req.body;

    // Validate Govt. ID format if provided
    if (govt_id_type && govt_id_number) {
      const sanitized = govt_id_number.replace(/[\s\-]/g, '').toUpperCase();
      const idRules = {
        'Aadhaar':         { pattern: /^\d{12}$/ },
        'PAN':             { pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/ },
        'Passport':        { pattern: /^[A-Z][1-9][0-9]{7}$/ },
        'Driving Licence': { pattern: /^[A-Z]{2}[0-9]{13}$/ },
        'Voter ID':        { pattern: /^[A-Z]{3}[0-9]{7}$/ },
      };
      const rule = idRules[govt_id_type];
      if (rule && !rule.pattern.test(sanitized)) {
        const { badRequest } = require('../utils/response');
        return badRequest(res, `Invalid ${govt_id_type} format`);
      }
    }

    // Duplicate checks
    const dup = await query(
      `SELECT u.id,
         (SELECT 1 FROM users WHERE email = $1) AS dup_email,
         (SELECT 1 FROM users WHERE REGEXP_REPLACE(phone,'[\\s\\-\\+\\(\\)]','','g') =
           REGEXP_REPLACE($2,'[\\s\\-\\+\\(\\)]','','g')) AS dup_phone,
         (SELECT 1 FROM visitor_profiles WHERE govt_id_number = $3 AND $3 IS NOT NULL) AS dup_id
       FROM (VALUES (1)) t(x)`,
      [email, phone, govt_id_number || null]
    );

    if (dup.rows[0].dup_email) return conflict(res, 'Email already registered');
    if (dup.rows[0].dup_phone) return conflict(res, 'Phone number already registered');
    if (dup.rows[0].dup_id)    return conflict(res, 'Government ID already registered');

    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');

    const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    const userId = uuidv4();

    await query(
      `INSERT INTO users (id, email, password_hash, name, phone, role, initial, color)
       VALUES ($1,$2,$3,$4,$5,'visitor',$6,'#0891b2')`,
      [userId, email.toLowerCase().trim(), hash, name, phone, name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase()]
    );

    await query(
      `INSERT INTO visitor_profiles (user_id, company, address, govt_id_type, govt_id_number, vehicle_number, vehicle_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, company||null, address||null, govt_id_type||null, govt_id_number||null, vehicle_number||null, vehicle_type||null]
    );

    return created(res, { user_id: userId, name, email }, 'Registration successful');
  } catch (err) { next(err); }
};

/** GET /api/visitors/inside  — currently inside */
exports.currentlyInside = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM v_currently_inside ORDER BY entry_time DESC`
    );
    return success(res, rows);
  } catch (err) { next(err); }
};
