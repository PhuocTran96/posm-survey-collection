const express = require('express');
const surveyRoutes = require('./surveyRoutes');
const adminRoutes = require('./adminRoutes');
const uploadRoutes = require('./uploadRoutes');
const dataUploadRoutes = require('./dataUploadRoutes');

const router = express.Router();

router.use('/api', surveyRoutes);
router.use('/api', adminRoutes);
router.use('/api', uploadRoutes);
router.use('/api/data-upload', dataUploadRoutes);

module.exports = router;