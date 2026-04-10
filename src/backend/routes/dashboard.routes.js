const router = require('express').Router();
const ctrl   = require('../controllers/dashboard.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('admin', 'approver', 'gate'), ctrl.stats);

module.exports = router;
