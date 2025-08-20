const express = require('express');
const router = express.Router();
const { AuditLog } = require('../models');
const { verifyToken, requireAdmin, logActivity } = require('../middleware/auth');

// All audit routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

/**
 * Get audit logs with pagination and filters
 */
router.get('/', logActivity('AUDIT_VIEW'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    
    const result = await AuditLog.getAdminActivities(page, limit);
    
    res.json({
      success: true,
      data: result.activities,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs'
    });
  }
});

/**
 * Get user-specific audit logs
 */
router.get('/user/:username', logActivity('AUDIT_VIEW'), async (req, res) => {
  try {
    const { username } = req.params;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    
    const activities = await AuditLog.getUserActivity(username, limit);
    
    res.json({
      success: true,
      data: activities
    });

  } catch (error) {
    console.error('Get user audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user audit logs'
    });
  }
});

/**
 * Get audit statistics
 */
router.get('/stats', logActivity('AUDIT_STATS'), async (req, res) => {
  try {
    const stats = await AuditLog.aggregate([
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const recentActivity = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action performedBy createdAt success');

    const failedActions = await AuditLog.countDocuments({ success: false });
    const totalActions = await AuditLog.countDocuments({});

    res.json({
      success: true,
      data: {
        actionStats: stats,
        recentActivity,
        failureRate: totalActions > 0 ? (failedActions / totalActions * 100).toFixed(2) : 0,
        totalActions,
        failedActions
      }
    });

  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit statistics'
    });
  }
});

module.exports = router;