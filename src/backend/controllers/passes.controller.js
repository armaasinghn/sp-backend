/**
 * Passes Controller — Full pass lifecycle management
 */
const QRCode = require('qrcode');
const crypto = require('crypto');
const { query, getClient } = require('../../../config/database');
const { success, created, notFound, badRequest, forbidden, paginated } = require('../utils/response');
const { auditLog } = require('../middleware/audit');

const PAGE_SIZE = 20;

/**
 * GET /api/passes
 * Admin/Approver: list passes (scoped for approver), Gate: all approved
 */
exports.list = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = PAGE_SIZE, from, until } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    // Role scoping
    if (req.user.role === 'approver') {
      params.push(req.user.id);
      conditions.push(`p.host_user_id = $${params.length}`);
    } else if (req.user.role === 'visitor') {
      params.push(req.user.name);
      conditions.push(`p.visitor_name = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(p.visitor_name ILIKE $${params.length} OR p.pass_number ILIKE $${params.length} OR p.visitor_company ILIKE $${params.length})`);
    }
    if (from) {
      params.push(from);
      conditions.push(`p.valid_from >= $${params.length}`);
    }
    if (until) {
      params.push(until);
      conditions.push(`p.valid_until <= $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM passes p ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const { rows } = await query(
      `SELECT p.*, u.color AS host_color, u.initial AS host_initial,
              d.name AS dept_name_full,
              (SELECT COUNT(*) FROM gate_logs gl WHERE gl.pass_id = p.id AND gl.log_type = 'entry') AS entry_count
       FROM passes p
       LEFT JOIN users u ON u.id = p.host_user_id
       LEFT JOIN departments d ON d.id = p.department_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return paginated(res, rows, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/passes/:id
 */
exports.get = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*,
              u.email AS host_email, u.phone AS host_phone, u.color AS host_color,
              json_agg(
                json_build_object(
                  'id', gl.id, 'type', gl.log_type, 'gate', gl.gate_name,
                  'guard', gl.logged_by_name, 'logged_at', gl.logged_at
                ) ORDER BY gl.logged_at
              ) FILTER (WHERE gl.id IS NOT NULL) AS gate_logs
       FROM passes p
       LEFT JOIN users u ON u.id = p.host_user_id
       LEFT JOIN gate_logs gl ON gl.pass_id = p.id
       WHERE p.id = $1
       GROUP BY p.id, u.email, u.phone, u.color`,
      [req.params.id]
    );

    if (!rows.length) return notFound(res, 'Pass not found');

    // Visitor: only own passes
    const pass = rows[0];
    if (req.user.role === 'visitor' && pass.visitor_name !== req.user.name) {
      return forbidden(res);
    }

    return success(res, pass);
  } catch (err) { next(err); }
};

/**
 * POST /api/passes
 */
exports.create = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      visitor_name, visitor_phone, visitor_email, visitor_company, visitor_address,
      govt_id_type, govt_id_number, vehicle_number, vehicle_type,
      purpose, description, notes,
      valid_from, valid_until,
      host_user_id, photo_url,
      companions = [], companion_count,
    } = req.body;

    // Look up host
    const hostResult = await client.query(
      `SELECT u.id, u.name, u.department_id, d.name AS dept_name
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = $1 AND u.role IN ('approver','admin') AND u.is_active = TRUE`,
      [host_user_id]
    );
    if (!hostResult.rows.length) {
      await client.query('ROLLBACK');
      return badRequest(res, 'Invalid meeting officer selected');
    }
    const host = hostResult.rows[0];

    // Generate pass number
    const passNum = await client.query(`SELECT generate_pass_number() AS num`);
    const passNumber = passNum.rows[0].num;

    // Insert pass
    const { rows } = await client.query(
      `INSERT INTO passes (
         pass_number, visitor_name, visitor_phone, visitor_email,
         visitor_company, visitor_address, govt_id_type, govt_id_number,
         vehicle_number, vehicle_type, purpose, description, notes,
         valid_from, valid_until, host_user_id, host_name,
         department_id, department_name, photo_url,
         requested_by_id, self_registered,
         companions, companion_count
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [
        passNumber, visitor_name, visitor_phone, visitor_email || null,
        visitor_company || null, visitor_address || null,
        govt_id_type || null, govt_id_number || null,
        vehicle_number || null, vehicle_type || null,
        purpose, description || null, notes || null,
        valid_from, valid_until, host_user_id, host.name,
        host.department_id || null, host.dept_name || null,
        photo_url || null,
        req.user?.id || null,
        req.user?.role === 'visitor',
        JSON.stringify(companions || []),
        Array.isArray(companions) ? companions.length : (companion_count || 0),
      ]
    );
    const pass = rows[0];

    // Notify host
    await client.query(
      `INSERT INTO notifications (target_user_id, event, title, message, pass_id)
       VALUES ($1, 'pass_pending', $2, $3, $4)`,
      [
        host_user_id,
        'New security pass awaiting your approval',
        `${visitor_name}${visitor_company ? ' (' + visitor_company + ')' : ''} has requested a pass for ${purpose}.`,
        pass.id,
      ]
    );

    await client.query('COMMIT');

    await auditLog({
      userId: req.user?.id, userName: req.user?.name,
      action: 'PASS_CREATED', entityType: 'pass', entityId: pass.id,
      newValues: { pass_number: passNumber, visitor_name, purpose },
      ipAddress: req.ip,
    });

    return created(res, pass, 'Pass created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * PATCH /api/passes/:id/approve
 */
exports.approve = async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    if (!['admin', 'approver'].includes(req.user.role)) {
      return forbidden(res);
    }

    const { rows: passRows } = await client.query(
      `SELECT * FROM passes WHERE id = $1`, [id]
    );
    if (!passRows.length) return notFound(res, 'Pass not found');
    const pass = passRows[0];

    if (pass.status !== 'pending') {
      return badRequest(res, `Pass is already ${pass.status}`);
    }
    if (req.user.role === 'approver' && pass.host_user_id !== req.user.id) {
      return forbidden(res, 'You can only approve your own assigned passes');
    }

    await client.query('BEGIN');

    // Generate QR
    const token    = crypto.randomBytes(32).toString('hex');
    const qrUrl    = `https://securitypass.app/verify/${pass.pass_number}?token=${token}`;
    const qrBase64 = await QRCode.toDataURL(qrUrl);

    await client.query(
      `UPDATE passes SET
         status = 'approved', approved_by_id = $1, approved_by_name = $2,
         approved_at = NOW(), qr_enabled = TRUE, qr_token = $3, qr_url = $4,
         updated_at = NOW()
       WHERE id = $5`,
      [req.user.id, req.user.name, token, qrUrl, id]
    );

    // Notify requester
    if (pass.requested_by_id) {
      await client.query(
        `INSERT INTO notifications (target_user_id, event, title, message, pass_id)
         VALUES ($1, 'pass_approved', $2, $3, $4)`,
        [
          pass.requested_by_id,
          'Your security pass has been approved!',
          `Pass ${pass.pass_number} for ${pass.visitor_name} has been approved. Show QR code at the gate.`,
          id,
        ]
      );
    }

    await client.query('COMMIT');

    await auditLog({
      userId: req.user.id, userName: req.user.name,
      action: 'PASS_APPROVED', entityType: 'pass', entityId: id,
      ipAddress: req.ip,
    });

    const { rows: updated } = await query(`SELECT * FROM passes WHERE id = $1`, [id]);
    return success(res, { ...updated[0], qr_data: qrBase64 }, 'Pass approved');
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * PATCH /api/passes/:id/reject
 */
exports.reject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!['admin', 'approver'].includes(req.user.role)) return forbidden(res);

    const { rows } = await query(
      `UPDATE passes SET
         status = 'rejected', rejected_by_id = $1,
         reject_reason = $2, rejected_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [req.user.id, reason || null, id]
    );

    if (!rows.length) return notFound(res, 'Pass not found or already processed');

    await auditLog({
      userId: req.user.id, userName: req.user.name,
      action: 'PASS_REJECTED', entityType: 'pass', entityId: id,
      newValues: { reason }, ipAddress: req.ip,
    });

    return success(res, rows[0], 'Pass rejected');
  } catch (err) { next(err); }
};

/**
 * POST /api/passes/:id/gate-log
 */
exports.gateLog = async (req, res, next) => {
  const client = await getClient();
  try {
    if (!['admin', 'gate'].includes(req.user.role)) return forbidden(res);

    const { id } = req.params;
    const { log_type, gate_name = 'Main Gate', remarks } = req.body;

    const { rows: passRows } = await client.query(
      `SELECT * FROM passes WHERE id = $1`, [id]
    );
    if (!passRows.length) return notFound(res, 'Pass not found');
    const pass = passRows[0];

    if (pass.status !== 'approved') {
      return badRequest(res, 'Can only log activity on approved passes');
    }
    if (new Date() > new Date(pass.valid_until)) {
      return badRequest(res, 'Pass has expired');
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO gate_logs (pass_id, log_type, gate_name, logged_by_id, logged_by_name, remarks)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, log_type, gate_name, req.user.id, req.user.name, remarks || null]
    );

    // Notify host
    const notifEvent = log_type === 'entry' ? 'pass_entry' : 'pass_exit';
    await client.query(
      `INSERT INTO notifications (target_user_id, event, title, message, pass_id)
       VALUES ($1, $2::notif_event, $3, $4, $5)`,
      [
        pass.host_user_id,
        notifEvent,
        `Visitor ${log_type === 'entry' ? 'entered' : 'exited'} — ${pass.visitor_name}`,
        `${log_type === 'entry' ? 'Entry' : 'Exit'} recorded at ${gate_name} for pass ${pass.pass_number}.`,
        id,
      ]
    );

    await client.query('COMMIT');

    return created(res, rows[0], `${log_type === 'entry' ? 'Entry' : 'Exit'} logged successfully`);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * GET /api/passes/:id/qr
 */
exports.getQR = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT pass_number, qr_url, qr_enabled, status FROM passes WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return notFound(res, 'Pass not found');
    const pass = rows[0];

    if (!pass.qr_enabled || !pass.qr_url) {
      return badRequest(res, 'QR not available for this pass');
    }

    const qrData = await QRCode.toDataURL(pass.qr_url);
    return success(res, { qr_data: qrData, qr_url: pass.qr_url });
  } catch (err) { next(err); }
};

/**
 * GET /api/passes/verify/:passNumber  (public — gate scanner)
 */
exports.verify = async (req, res, next) => {
  try {
    const { passNumber } = req.params;
    const { token } = req.query;

    const { rows } = await query(
      `SELECT p.*, u.name AS host_full_name, u.phone AS host_phone
       FROM passes p LEFT JOIN users u ON u.id = p.host_user_id
       WHERE p.pass_number = $1`,
      [passNumber]
    );

    if (!rows.length) return notFound(res, 'Pass not found');
    const pass = rows[0];

    const valid =
      pass.status === 'approved' &&
      pass.qr_enabled &&
      pass.qr_token === token &&
      new Date() <= new Date(pass.valid_until);

    return success(res, {
      valid,
      pass_number: pass.pass_number,
      visitor_name: pass.visitor_name,
      visitor_company: pass.visitor_company,
      host_name: pass.host_name,
      purpose: pass.purpose,
      valid_from: pass.valid_from,
      valid_until: pass.valid_until,
      status: pass.status,
      ...(!valid && { reason: pass.status !== 'approved' ? `Pass is ${pass.status}` : 'Token mismatch or pass expired' }),
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/passes/reports?from=&until=&status=&dept=
 * Admin only — aggregate report with gate log join
 */
exports.getReport = async (req, res, next) => {
  try {
    const { from, until, status, dept } = req.query;
    const params = [];
    const conditions = [];

    if (from) { params.push(from); conditions.push(`p.valid_from >= $${params.length}`); }
    if (until) { params.push(until); conditions.push(`p.valid_until <= $${params.length}`); }
    if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
    if (dept) { params.push(`%${dept}%`); conditions.push(`p.department_name ILIKE $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
      `SELECT
         p.id, p.pass_number, p.visitor_name, p.visitor_phone, p.visitor_company,
         p.host_name, p.department_name, p.purpose, p.status,
         p.valid_from, p.valid_until,
         p.companion_count,
         p.approved_at, p.approved_by_name,
         p.reject_reason,
         (SELECT MIN(gl.logged_at) FROM gate_logs gl WHERE gl.pass_id = p.id AND gl.log_type = 'entry') AS first_entry,
         (SELECT MAX(gl.logged_at) FROM gate_logs gl WHERE gl.pass_id = p.id AND gl.log_type = 'exit')  AS last_exit,
         (SELECT COUNT(*) FROM gate_logs gl WHERE gl.pass_id = p.id AND gl.log_type = 'entry') AS entry_count,
         (SELECT COUNT(*) FROM gate_logs gl WHERE gl.pass_id = p.id AND gl.log_type = 'exit')  AS exit_count,
         CASE
           WHEN (SELECT MIN(gl.logged_at) FROM gate_logs gl WHERE gl.pass_id = p.id AND gl.log_type = 'entry') IS NOT NULL
            AND (SELECT MAX(gl.logged_at) FROM gate_logs gl WHERE gl.pass_id = p.id AND gl.log_type = 'exit')  IS NOT NULL
           THEN EXTRACT(EPOCH FROM (
             (SELECT MAX(gl.logged_at) FROM gate_logs gl WHERE gl.pass_id = p.id AND gl.log_type = 'exit') -
             (SELECT MIN(gl.logged_at) FROM gate_logs gl WHERE gl.pass_id = p.id AND gl.log_type = 'entry')
           )) / 60
           ELSE NULL
         END AS duration_minutes
       FROM passes p
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );

    // Summary stats
    const total = rows.length;
    const byStatus = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    const withEntry = rows.filter(r => r.entry_count > 0).length;
    const durations = rows.filter(r => r.duration_minutes !== null).map(r => parseFloat(r.duration_minutes));
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    return res.json({
      success: true,
      summary: {
        total,
        approved: byStatus.approved || 0,
        pending:  byStatus.pending  || 0,
        rejected: byStatus.rejected || 0,
        expired:  byStatus.expired  || 0,
        with_entry: withEntry,
        avg_duration_minutes: avgDuration,
      },
      data: rows,
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/passes/visitor-lookup?q=<name|phone|email>
 * Returns the most recent pass data for a matching visitor (for auto-fill)
 */
exports.visitorLookup = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return success(res, null);

    const { rows } = await query(
      `SELECT DISTINCT ON (visitor_phone)
         visitor_name, visitor_phone, visitor_email,
         visitor_company, visitor_address,
         govt_id_type, govt_id_number,
         vehicle_number, vehicle_type
       FROM passes
       WHERE visitor_name ILIKE $1
          OR visitor_phone ILIKE $1
          OR visitor_email ILIKE $1
       ORDER BY visitor_phone, created_at DESC
       LIMIT 5`,
      [`%${q}%`]
    );

    return success(res, rows.length ? rows : []);
  } catch (err) { next(err); }
};
