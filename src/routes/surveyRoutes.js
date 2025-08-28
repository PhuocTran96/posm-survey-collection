const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const {
  verifyToken,
  requireSurveyUser,
  requireAdmin,
  optionalAuth,
} = require('../middleware/auth');

// Protected routes (require authentication)
router.get('/leaders', verifyToken, requireSurveyUser, surveyController.getLeaders);
router.get('/shops/:leader', verifyToken, requireSurveyUser, surveyController.getShopsByLeader);
router.get(
  '/models/:leader/:shopName',
  verifyToken,
  requireSurveyUser,
  surveyController.getModelsByLeaderAndShop
);
router.get(
  '/model-autocomplete',
  verifyToken,
  requireSurveyUser,
  surveyController.getModelAutocomplete
);
router.get('/model-posm/:model', verifyToken, requireSurveyUser, surveyController.getPosmByModel);

// Protected routes for survey submission
router.post('/submit', verifyToken, requireSurveyUser, surveyController.submitSurvey);

// Admin-only routes for viewing and managing responses
router.get('/responses', verifyToken, requireAdmin, surveyController.getSurveyResponses);
router.get('/responses/:id', verifyToken, requireAdmin, surveyController.getSurveyResponseById);
router.put('/responses/:id', verifyToken, requireAdmin, surveyController.updateSurveyResponse);
router.delete(
  '/responses/bulk-delete',
  verifyToken,
  requireAdmin,
  surveyController.bulkDeleteSurveyResponses
);
router.delete('/responses/:id', verifyToken, requireAdmin, surveyController.deleteSurveyResponse);

module.exports = router;
