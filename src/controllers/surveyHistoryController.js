const { SurveyResponse, Store } = require('../models');

/**
 * Get survey history for the authenticated user
 */
const getSurveyHistory = async (req, res) => {
  try {
    const user = req.user;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter object
    const filters = { submittedById: user.userid };

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filters.submittedAt = {};
      if (req.query.startDate) {
        filters.submittedAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        filters.submittedAt.$lte = endDate;
      }
    }

    // Store name filter
    if (req.query.storeName) {
      const searchRegex = new RegExp(req.query.storeName, 'i');
      filters.shopName = searchRegex;
    }

    // Status filter (for now, all surveys are considered "Completed" since we don't have pending status)
    // This can be extended later if needed

    // Get total count for pagination
    const totalCount = await SurveyResponse.countDocuments(filters);

    // Get survey responses with pagination
    const surveys = await SurveyResponse.find(filters)
      .select('leader shopName submittedAt submittedBy submittedByRole responses')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);

    // Transform data for frontend
    const surveyHistory = surveys.map((survey) => ({
      id: survey._id,
      date: survey.submittedAt,
      storeName: survey.shopName,
      storeId: survey.leader, // Using leader as store identifier
      status: 'Completed', // All submitted surveys are completed
      submittedBy: survey.submittedBy,
      submittedByRole: survey.submittedByRole,
      responseCount: survey.responses.length,
      hasImages: survey.responses.some((r) => r.images && r.images.length > 0),
    }));

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: surveyHistory,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Get survey history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve survey history',
    });
  }
};

/**
 * Get detailed survey response by ID
 */
const getSurveyDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const survey = await SurveyResponse.findOne({
      _id: id,
      submittedById: user.userid, // Ensure user can only access their own surveys
    });

    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found or access denied',
      });
    }

    // Try to get store details if available
    let storeDetails = null;
    try {
      storeDetails = await Store.findOne({
        $or: [{ store_id: survey.leader }, { store_name: survey.shopName }],
      }).select('store_id store_name channel region province');
    } catch (storeError) {
      console.warn('Could not fetch store details:', storeError.message);
    }

    // Format the response
    const surveyDetail = {
      id: survey._id,
      storeName: survey.shopName,
      storeId: survey.leader,
      storeDetails: storeDetails,
      submittedAt: survey.submittedAt,
      submittedBy: survey.submittedBy,
      submittedByRole: survey.submittedByRole,
      status: 'Completed',
      responses: survey.responses.map((response) => ({
        model: response.model,
        quantity: response.quantity,
        allSelected: response.allSelected,
        posmSelections: response.posmSelections,
        images: response.images,
        imageCount: response.images ? response.images.length : 0,
      })),
      totalModels: survey.responses.length,
      totalImages: survey.responses.reduce(
        (total, r) => total + (r.images ? r.images.length : 0),
        0
      ),
    };

    res.json({
      success: true,
      data: surveyDetail,
    });
  } catch (error) {
    console.error('Get survey detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve survey details',
    });
  }
};

/**
 * Get survey statistics for the user
 */
const getSurveyStats = async (req, res) => {
  try {
    const user = req.user;

    const stats = await SurveyResponse.aggregate([
      { $match: { submittedById: user.userid } },
      {
        $group: {
          _id: null,
          totalSurveys: { $sum: 1 },
          totalStores: { $addToSet: '$shopName' },
          totalModels: { $sum: { $size: '$responses' } },
          totalImages: {
            $sum: {
              $reduce: {
                input: '$responses',
                initialValue: 0,
                in: { $add: ['$$value', { $size: { $ifNull: ['$$this.images', []] } }] },
              },
            },
          },
          earliestSurvey: { $min: '$submittedAt' },
          latestSurvey: { $max: '$submittedAt' },
        },
      },
      {
        $project: {
          _id: 0,
          totalSurveys: 1,
          totalStores: { $size: '$totalStores' },
          totalModels: 1,
          totalImages: 1,
          earliestSurvey: 1,
          latestSurvey: 1,
        },
      },
    ]);

    const result = stats[0] || {
      totalSurveys: 0,
      totalStores: 0,
      totalModels: 0,
      totalImages: 0,
      earliestSurvey: null,
      latestSurvey: null,
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get survey stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve survey statistics',
    });
  }
};

module.exports = {
  getSurveyHistory,
  getSurveyDetail,
  getSurveyStats,
};
