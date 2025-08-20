const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');

router.get('/leaders', surveyController.getLeaders);
router.get('/shops/:leader', surveyController.getShopsByLeader);
router.get('/models/:leader/:shopName', surveyController.getModelsByLeaderAndShop);
router.post('/submit', surveyController.submitSurvey);
router.get('/responses', surveyController.getSurveyResponses);
router.delete('/responses/:id', surveyController.deleteSurveyResponse);
router.post('/responses/bulk-delete', surveyController.bulkDeleteSurveyResponses);
router.get('/model-autocomplete', surveyController.getModelAutocomplete);
router.get('/model-posm/:model', surveyController.getPosmByModel);

module.exports = router;