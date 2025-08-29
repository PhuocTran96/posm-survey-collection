const express = require('express');
const multer = require('multer');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { verifyToken, updateActivity, requireSurveyUser } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// File upload requires authentication for survey users
router.post(
  '/upload',
  verifyToken,
  updateActivity,
  requireSurveyUser,
  upload.single('file'),
  uploadController.uploadFile
);

module.exports = router;
