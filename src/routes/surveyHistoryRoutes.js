const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  getSurveyHistory,
  getSurveyDetail,
  getSurveyStats
} = require('../controllers/surveyHistoryController');

// All routes require authentication
router.use(verifyToken);

// Get survey history for authenticated user
router.get('/', getSurveyHistory);

// Get survey statistics for authenticated user
router.get('/stats', getSurveyStats);

// Get detailed survey response by ID
router.get('/:id', getSurveyDetail);

module.exports = router;