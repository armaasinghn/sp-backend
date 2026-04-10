const router = require('express').Router();
const { body } = require('express-validator');
const ctrl     = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const rateLimit  = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10'),
  message: { success: false, message: 'Too many auth attempts, please try again later' },
});

router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate, ctrl.login
);

router.post('/refresh',
  [body('refreshToken').notEmpty()],
  validate, ctrl.refresh
);

router.post('/logout', ctrl.logout);

router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validate, ctrl.forgotPassword
);

router.post('/reset-password',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
  ],
  validate, ctrl.resetPassword
);

router.post('/lookup-user-id', ctrl.lookupUserId);

module.exports = router;
