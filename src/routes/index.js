const express = require('express');
const surveyRoutes = require('./surveyRoutes');
const adminRoutes = require('./adminRoutes');
const uploadRoutes = require('./uploadRoutes');
const dataUploadRoutes = require('./dataUploadRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const auditRoutes = require('./auditRoutes');

const router = express.Router();

// Authentication routes
router.use('/api/auth', authRoutes);

// User management routes
router.use('/api/users', userRoutes);

// Audit log routes
router.use('/api/audit', auditRoutes);

// Existing routes
router.use('/api', surveyRoutes);
router.use('/api', adminRoutes);
router.use('/api', uploadRoutes);
router.use('/api/data-upload', dataUploadRoutes);

module.exports = router;