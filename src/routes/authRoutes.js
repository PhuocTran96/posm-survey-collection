const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, refreshAccessToken, requireSurveyUser } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);
router.post('/admin/login', authController.adminLogin);
router.post('/refresh', refreshAccessToken);

// Protected routes
router.use(verifyToken); // All routes below require authentication

router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);
router.post('/change-password', authController.changePassword);
router.get('/verify', authController.verifyToken);
router.get('/subordinates', requireSurveyUser, authController.getSubordinates);

module.exports = router;
