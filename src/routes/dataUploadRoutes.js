const express = require('express');
const router = express.Router();
const { upload, uploadStores, uploadPOSM, getUploadStats } = require('../controllers/dataUploadController');

// Upload stores from CSV
router.post('/stores', upload.single('csvFile'), uploadStores);

// Upload POSM data from CSV
router.post('/posm', upload.single('csvFile'), uploadPOSM);

// Get upload statistics
router.get('/stats', getUploadStats);

module.exports = router;