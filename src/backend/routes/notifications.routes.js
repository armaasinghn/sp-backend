const router = require('express').Router();
const ctrl   = require('../controllers/notifications.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/',                ctrl.list);
router.get('/unread-count',    ctrl.unreadCount);
router.patch('/read-all',      ctrl.markAllRead);
router.patch('/:id/read',      ctrl.markRead);

module.exports = router;
