const express = require('express');
const surveyRoutes = require('./surveyRoutes');
const adminRoutes = require('./adminRoutes');
const uploadRoutes = require('./uploadRoutes');
const dataUploadRoutes = require('./dataUploadRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const storeRoutes = require('./storeRoutes');

const router = express.Router();

// Authentication routes
router.use('/api/auth', authRoutes);

// User management routes
router.use('/api/users', userRoutes);

// Store management routes
router.use('/api/stores', storeRoutes);

// Existing routes
router.use('/api', uploadRoutes);
router.use('/api', surveyRoutes);
router.use('/api/admin', adminRoutes);
router.use('/api/data-upload', dataUploadRoutes);

module.exports = router;