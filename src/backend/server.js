/**
 * Security Pass — API Server
 * Express + PostgreSQL
 */
require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const compression = require('compression');
const path       = require('path');

const routes     = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger     = require('./utils/logger');
const { pool }   = require('../../config/database');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── SECURITY ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.set('trust proxy', 1);

// ─── CORS ────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['*'];
app.use(cors({
  origin: (origin, cb) => {
    if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── RATE LIMITING ───────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests, please try again later' },
}));
// Stricter limit on auth routes
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many login attempts, please try again later' },
}));

// ─── BODY PARSING ────────────────────────────────────────────
// 2mb for API, 10mb for photo upload endpoints
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ─── LOGGING ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: msg => logger.http(msg.trim()) },
  }));
}

// ─── STATIC FILES (uploaded photos) ─────────────────────────
app.use('/uploads', express.static(
  path.resolve(process.env.UPLOAD_DIR || './uploads')
));

// ─── HEALTH CHECK ────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', uptime: process.uptime(), env: process.env.NODE_ENV });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

// ─── API ROUTES ──────────────────────────────────────────────
app.use('/api', routes);

// ─── FRONTEND SPA ────────────────────────────────────────────
const publicDir = path.resolve('./src/frontend');
app.use(express.static(publicDir, { etag: false, maxAge: 0 }));
app.get(/^(?!\/api|\/uploads).*$/, (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ─── 404 + ERROR HANDLING ────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── START ───────────────────────────────────────────────────
const server = app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    logger.info(`✅ Security Pass API running on port ${PORT} [${process.env.NODE_ENV}]`);
    logger.info(`   DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  } catch (err) {
    logger.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
});

// ─── GRACEFUL SHUTDOWN ───────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await pool.end();
    logger.info('Server closed. Database pool drained.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;
