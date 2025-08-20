const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, requireAdmin, logActivity } = require('../middleware/auth');

// All admin routes require authentication
router.use(verifyToken);
router.use(requireAdmin);

router.post('/reload-data', logActivity('DATA_RELOAD'), adminController.reloadData);
router.get('/data-stats', logActivity('DATA_STATS'), adminController.getDataStats);

module.exports = router;