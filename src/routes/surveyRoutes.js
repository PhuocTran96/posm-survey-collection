const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const {
  verifyToken,
  updateActivity,
  requireSurveyUser,
  requireAdmin,
  optionalAuth,
} = require('../middleware/auth');

// Protected routes (require authentication)
router.get('/leaders', verifyToken, updateActivity, requireSurveyUser, surveyController.getLeaders);
router.get(
  '/shops/:leader',
  verifyToken,
  updateActivity,
  requireSurveyUser,
  surveyController.getShopsByLeader
);
router.get(
  '/models/:leader/:shopName',
  verifyToken,
  updateActivity,
  requireSurveyUser,
  surveyController.getModelsByLeaderAndShop
);
router.get(
  '/model-autocomplete',
  verifyToken,
  updateActivity,
  requireSurveyUser,
  surveyController.getModelAutocomplete
);
router.get(
  '/model-posm/:model',
  verifyToken,
  updateActivity,
  requireSurveyUser,
  surveyController.getPosmByModel
);

// Protected routes for survey submission
router.post(
  '/submit',
  verifyToken,
  updateActivity,
  requireSurveyUser,
  surveyController.submitSurvey
);

// Admin-only routes for viewing and managing responses
router.get(
  '/responses',
  verifyToken,
  updateActivity,
  requireAdmin,
  surveyController.getSurveyResponses
);
router.get(
  '/responses/:id',
  verifyToken,
  updateActivity,
  requireAdmin,
  surveyController.getSurveyResponseById
);
router.put(
  '/responses/:id',
  verifyToken,
  updateActivity,
  requireAdmin,
  surveyController.updateSurveyResponse
);
router.delete(
  '/responses/bulk-delete',
  verifyToken,
  updateActivity,
  requireAdmin,
  surveyController.bulkDeleteSurveyResponses
);
router.delete(
  '/responses/:id',
  verifyToken,
  updateActivity,
  requireAdmin,
  surveyController.deleteSurveyResponse
);

// Admin-only routes for model-level deletion within surveys
router.delete(
  '/responses/:surveyId/models/:modelIndex',
  verifyToken,
  updateActivity,
  requireAdmin,
  surveyController.deleteModelFromSurvey
);
router.delete(
  '/responses/models/bulk-delete',
  verifyToken,
  updateActivity,
  requireAdmin,
  surveyController.bulkDeleteModelsFromSurveys
);

module.exports = router;
