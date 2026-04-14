const router = require('express').Router();
const ctrl   = require('../controllers/gates.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/',          ctrl.getGates);
router.post('/',         authorize('admin'), ctrl.createGate);
router.patch('/:id/toggle', authorize('admin'), ctrl.toggleGate);

module.exports = router;
