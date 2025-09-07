const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// All progress routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

/**
 * @route GET /api/progress/overview
 * @desc Get overall progress overview statistics
 * @access Admin
 */
router.get('/overview', progressController.getProgressOverview);

/**
 * @route GET /api/progress/stores
 * @desc Get progress by individual stores with pagination
 * @access Admin
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20, max: 100)
 */
router.get('/stores', progressController.getStoreProgress);

/**
 * @route GET /api/progress/models
 * @desc Get progress by model types
 * @access Admin
 */
router.get('/models', progressController.getModelProgress);

/**
 * @route GET /api/progress/posm-types
 * @desc Get progress by POSM types
 * @access Admin
 */
router.get('/posm-types', progressController.getPOSMProgress);

/**
 * @route GET /api/progress/regions
 * @desc Get progress by regions
 * @access Admin
 */
router.get('/regions', progressController.getRegionProgress);

/**
 * @route GET /api/progress/timeline
 * @desc Get progress timeline over time
 * @access Admin
 * @query days - Number of days to look back (default: 30)
 */
router.get('/timeline', progressController.getProgressTimeline);

/**
 * @route GET /api/progress/posm-matrix
 * @desc Get POSM deployment matrix data for AG-Grid
 * @access Admin
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20, max: 100)
 * @query search - Search term for filtering stores
 * @query sortBy - Field to sort by (default: storeName)
 * @query sortOrder - Sort order: asc or desc (default: asc)
 */
router.get('/posm-matrix', progressController.getPOSMMatrix);

// Debug endpoint removed - functionality verified and working correctly

module.exports = router;
