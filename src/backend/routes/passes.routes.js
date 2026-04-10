const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl   = require('../controllers/passes.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { withAudit } = require('../middleware/audit');

// Public — QR verification
router.get('/verify/:passNumber', ctrl.verify);

// All authenticated routes below
router.use(authenticate);

router.get('/',                 ctrl.list);
router.get('/visitor-lookup',   ctrl.visitorLookup);
router.get('/:id',              ctrl.get);

router.post('/',
  authorize('admin', 'approver', 'visitor'),
  [
    body('visitor_name').notEmpty().trim(),
    body('visitor_phone').notEmpty().trim(),
    body('purpose').isIn(['meeting','delivery','interview','audit','vendor','maintenance','other']),
    body('valid_from').isISO8601(),
    body('valid_until').optional({ nullable: true }).isISO8601(),
    body('host_user_id').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Invalid meeting officer ID'),
  ],
  validate,
  withAudit('CREATE_PASS', 'pass'),
  ctrl.create
);

router.patch('/:id/approve',
  authorize('admin', 'approver'),
  withAudit('APPROVE_PASS', 'pass'),
  ctrl.approve
);

router.patch('/:id/reject',
  authorize('admin', 'approver'),
  [body('reason').optional().trim()],
  validate,
  withAudit('REJECT_PASS', 'pass'),
  ctrl.reject
);

router.post('/:id/gate-log',
  authorize('admin', 'gate'),
  [
    body('log_type').isIn(['entry', 'exit']),
    body('gate_name').optional().trim(),
  ],
  validate,
  ctrl.gateLog
);

router.get('/:id/qr', ctrl.getQR);

module.exports = router;
