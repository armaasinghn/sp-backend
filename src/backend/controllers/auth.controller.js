/**
 * Auth Controller — Login, Refresh, Logout, Password Reset
 */
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../../../config/database');
const { success, created, badRequest, unauthorized, error } = require('../utils/response');
const { auditLog } = require('../middleware/audit');

/**
 * Generate tokens
 */
const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    role:   user.role,
    email:  user.email,
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  const refreshToken = crypto.randomBytes(64).toString('hex');
  return { accessToken, refreshToken };
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query(
      `SELECT u.*, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.email = $1 AND u.is_active = TRUE`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length) {
      return unauthorized(res, 'Invalid email or password');
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return unauthorized(res, 'Invalid email or password');
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Store hashed refresh token
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // Update last login
    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    await auditLog({
      userId: user.id, userName: user.name,
      action: 'LOGIN', entityType: 'user', entityId: user.id,
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });

    return success(res, {
      accessToken,
      refreshToken,
      user: {
        id:         user.id,
        email:      user.email,
        name:       user.name,
        role:       user.role,
        department: user.department_name,
        initial:    user.initial,
        color:      user.color,
        avatar_url: user.avatar_url,
      },
    }, 'Login successful');
  } catch (err) { next(err); }
};

/**
 * POST /api/auth/refresh
 */
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return badRequest(res, 'Refresh token required');

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const { rows } = await query(
      `SELECT rt.*, u.id AS user_id, u.email, u.role, u.name, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
         AND rt.revoked_at IS NULL
         AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (!rows.length || !rows[0].is_active) {
      return unauthorized(res, 'Invalid or expired refresh token');
    }

    const record = rows[0];
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(record);

    // Rotate refresh token
    await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
    const newHash    = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [record.user_id, newHash, expiresAt]
    );

    return success(res, { accessToken, refreshToken: newRefreshToken }, 'Token refreshed');
  } catch (err) { next(err); }
};

/**
 * POST /api/auth/logout
 */
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
    }
    return success(res, {}, 'Logged out successfully');
  } catch (err) { next(err); }
};

/**
 * POST /api/auth/forgot-password  (initiates OTP flow)
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const { rows }  = await query(`SELECT id, name FROM users WHERE email = $1`, [email]);

    // Always return success to prevent email enumeration
    if (!rows.length) {
      return success(res, {}, 'If that email exists, an OTP has been sent');
    }

    // In production: generate OTP, store hashed, send via email/SMS
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.info(`[DEV] OTP for ${email}: ${otp}`); // Remove in production

    return success(res, {
      message: 'OTP sent',
      // In production remove this — sent via email only
      ...(process.env.NODE_ENV !== 'production' && { otp }),
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    // In production: validate OTP from store
    // For demo: skip OTP validation
    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    await query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE email = $2`,
      [hash, email]
    );
    return success(res, {}, 'Password reset successfully');
  } catch (err) { next(err); }
};

/**
 * POST /api/auth/lookup-user-id   (Forgot User ID)
 */
exports.lookupUserId = async (req, res, next) => {
  try {
    const { phone, name } = req.body;
    let rows = [];

    if (phone) {
      const norm = phone.replace(/[\s\-\+\(\)]/g, '');
      ({ rows } = await query(
        `SELECT email, name, role FROM users
         WHERE REGEXP_REPLACE(phone, '[\\s\\-\\+\\(\\)]', '', 'g') = $1`,
        [norm]
      ));
    } else if (name) {
      ({ rows } = await query(
        `SELECT email, name, role FROM users
         WHERE LOWER(name) LIKE $1 LIMIT 1`,
        [`%${name.toLowerCase()}%`]
      ));
    }

    if (!rows.length) {
      return success(res, { found: false }, 'No account found');
    }

    const user  = rows[0];
    const parts = user.email.split('@');
    const local = parts[0];
    const masked = (local.length <= 3
      ? local[0] + '***'
      : local.substring(0, 2) + '*'.repeat(Math.min(local.length - 3, 5)) + local[local.length - 1]
    ) + '@' + parts[1];

    return success(res, {
      found:       true,
      maskedEmail: masked,
      name:        user.name,
      role:        user.role,
    });
  } catch (err) { next(err); }
};
