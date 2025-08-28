const express = require('express');
const router = express.Router();
const {
  upload,
  uploadStores,
  uploadPOSM,
  getUploadStats,
} = require('../controllers/dataUploadController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// All data upload routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

// Upload stores from CSV
router.post('/stores', upload.single('csvFile'), uploadStores);

// Upload POSM data from CSV
router.post('/posm', upload.single('csvFile'), uploadPOSM);

// Get upload statistics
router.get('/stats', getUploadStats);

module.exports = router;
