const { query } = require('../../../config/database');

/**
 * Log an action to the audit_logs table
 */
const auditLog = async ({
  userId, userName, action, entityType, entityId,
  oldValues, newValues, ipAddress, userAgent,
}) => {
  try {
    await query(
      `INSERT INTO audit_logs
         (user_id, user_name, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        userId || null,
        userName || null,
        action,
        entityType,
        entityId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress || null,
        userAgent || null,
      ]
    );
  } catch (err) {
    // Audit failures must never break the request
    console.error('Audit log failed:', err.message);
  }
};

/**
 * Express middleware factory — auto-logs based on route + method
 */
const withAudit = (action, entityType) => (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      auditLog({
        userId:     req.user?.id,
        userName:   req.user?.name,
        action,
        entityType,
        entityId:   req.params?.id || res.locals?.entityId,
        ipAddress:  req.ip,
        userAgent:  req.headers['user-agent'],
      });
    }
  });
  next();
};

module.exports = { auditLog, withAudit };
