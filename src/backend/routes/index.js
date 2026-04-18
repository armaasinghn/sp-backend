/**
 * Route aggregator — mounts all route modules
 */
const router = require('express').Router();

router.use('/auth',          require('./auth.routes'));
router.use('/dashboard',     require('./dashboard.routes'));
router.use('/passes',        require('./passes.routes'));
router.use('/visitors',      require('./visitors.routes'));
router.use('/users',         require('./users.routes'));
router.use('/notifications', require('./notifications.routes'));
router.use('/gates',         require('./gates.routes'));
router.use('/verify',        require('./verify.routes'));

// Health check
router.get('/health', (req, res) => res.json({
  status: 'ok',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}));

module.exports = router;
