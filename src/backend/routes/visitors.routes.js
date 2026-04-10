const router = require('express').Router();
const { body } = require('express-validator');
const ctrl   = require('../controllers/visitors.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Public — self-registration
router.post('/register',
  [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('phone').notEmpty().trim(),
    body('password').isLength({ min: 6 }),
  ],
  validate, ctrl.selfRegister
);

router.use(authenticate);

router.get('/',       authorize('admin', 'gate'), ctrl.list);
router.get('/inside', authorize('admin', 'gate'), ctrl.currentlyInside);
router.get('/:id',    authorize('admin', 'gate'), ctrl.get);

module.exports = router;
