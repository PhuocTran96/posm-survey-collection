const express = require('express');
const router = express.Router();
const { upload, uploadStores, uploadPOSM, getUploadStats } = require('../controllers/dataUploadController');
const { verifyToken, requireAdmin, logActivity } = require('../middleware/auth');

// All data upload routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

// Upload stores from CSV
router.post('/stores', upload.single('csvFile'), logActivity('DATA_UPLOAD'), uploadStores);

// Upload POSM data from CSV
router.post('/posm', upload.single('csvFile'), logActivity('DATA_UPLOAD'), uploadPOSM);

// Get upload statistics
router.get('/stats', logActivity('DATA_STATS'), getUploadStats);

module.exports = router;