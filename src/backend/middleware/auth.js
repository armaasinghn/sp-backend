/**
 * JWT Authentication Middleware
 */
const jwt  = require('jsonwebtoken');
const { query } = require('../../../config/database');
const { unauthorized, forbidden } = require('../utils/response');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch current user from DB
    const { rows } = await query(
      `SELECT id, email, name, role, department_id, is_active
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (!rows.length || !rows[0].is_active) {
      return unauthorized(res, 'User not found or inactive');
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token expired');
    }
    if (err.name === 'JsonWebTokenError') {
      return unauthorized(res, 'Invalid token');
    }
    next(err);
  }
};

/**
 * Role-based access control factory
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res);
  if (!roles.includes(req.user.role)) {
    return forbidden(res, 'Insufficient permissions');
  }
  next();
};

module.exports = { authenticate, authorize };
