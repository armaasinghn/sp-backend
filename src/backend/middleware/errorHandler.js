const logger = require('../utils/logger');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack:   err.stack,
    url:     req.url,
    method:  req.method,
    userId:  req.user?.id,
  });

  // PostgreSQL errors
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Duplicate entry — record already exists' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced record not found' });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ success: false, message: 'Invalid value — unexpected data format' });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message,
  });
};

/**
 * 404 handler — must be registered after all routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
};

module.exports = { errorHandler, notFoundHandler };
