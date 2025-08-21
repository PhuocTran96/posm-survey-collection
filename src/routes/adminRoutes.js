const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// All admin routes require authentication
router.use(verifyToken);
router.use(requireAdmin);

router.post('/reload-data', adminController.reloadData);
router.get('/data-stats', adminController.getDataStats);

module.exports = router;