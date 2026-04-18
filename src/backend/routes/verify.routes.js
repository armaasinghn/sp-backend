const router     = require('express').Router();
const rateLimit  = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const verifyCtrl = require('../controllers/verify.controller');

const rcLimiter = rateLimit({
  windowMs:     60 * 1000,   // 1-minute window
  max:          10,          // 10 RC lookups per user per minute
  keyGenerator: (req) => req.user?.userId || req.ip,
  message:      { status: 'error', message: 'Too many verification requests — wait a moment' },
});

router.post('/rc', authenticate, rcLimiter, verifyCtrl.verifyRC);

module.exports = router;
