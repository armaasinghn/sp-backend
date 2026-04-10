const router = require('express').Router();
const { body } = require('express-validator');
const ctrl   = require('../controllers/users.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.get('/me',              ctrl.getProfile);
router.patch('/me',            ctrl.updateProfile);
router.post('/me/avatar',      ctrl.uploadAvatar);
router.post('/me/change-password',
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
  ],
  validate, ctrl.changePassword
);

// Admin only
router.get('/',               authorize('admin'), ctrl.listAll);
router.patch('/:id/status',   authorize('admin'), ctrl.toggleStatus);

module.exports = router;
