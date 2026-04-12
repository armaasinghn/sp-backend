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

// Departments list (any authenticated user — needed for forms)
const { query } = require('../../../config/database');
router.get('/departments', async (req, res) => {
  const { rows } = await query(`SELECT id, name FROM departments ORDER BY name`);
  res.json({ success: true, data: rows });
});

// Admin only
router.get('/',               authorize('admin'), ctrl.listAll);
router.post('/',              authorize('admin'), ctrl.createUser);
router.patch('/:id',          authorize('admin'), ctrl.updateUser);
router.patch('/:id/status',   authorize('admin'), ctrl.toggleStatus);
router.delete('/:id',         authorize('admin'), ctrl.deleteUser);

module.exports = router;
