const { SurveyResponse, Store, ModelPosm } = require('../models');
const { s3 } = require('../utils/s3Helper');
const mongoose = require('mongoose');

// Configuration for deletion behavior
const DELETION_CONFIG = {
  // If true, abort entire operation if ANY S3 deletion fails
  // If false, proceed with DB deletion even if some S3 deletions fail
  strictMode: false,

  // Maximum S3 deletions to attempt in parallel
  s3ConcurrencyLimit: 10,

  // Timeout for individual S3 deletion operations (milliseconds)
  s3OperationTimeout: 10000,
};

// Helper function to check if S3 object exists
const checkS3ObjectExists = async (s3Key) => {
  try {
    await s3
      .headObject({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
      })
      .promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound' || error.statusCode === 404) {
      return false;
    }
    // For other errors (permissions, network, etc.), assume it exists to be safe
    console.warn(`⚠️ Could not verify S3 object existence for ${s3Key}: ${error.message}`);
    return true;
  }
};

// Helper function to extract S3 key from URL
const extractS3KeyFromUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Handle different S3 URL formats:
  // 1. https://bucket-name.s3.amazonaws.com/key
  // 2. https://bucket-name.s3-region.amazonaws.com/key
  // 3. https://s3.amazonaws.com/bucket-name/key
  // 4. https://s3-region.amazonaws.com/bucket-name/key

  const patterns = [
    // Pattern 1 & 2: bucket-name.s3[.region].amazonaws.com/key
    /https?:\/\/[^.]+\.s3(?:-[^.]+)?\.amazonaws\.com\/(.+)$/,
    // Pattern 3 & 4: s3[.region].amazonaws.com/bucket-name/key (need to extract key after bucket)
    /https?:\/\/s3(?:-[^.]+)?\.amazonaws\.com\/[^/]+\/(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  console.warn(`⚠️ Unrecognized S3 URL format: ${url}`);
  return null;
};

const getLeaders = async (req, res) => {
  try {
    const leaders = await Store.distinct('leader');
    res.json(leaders);
  } catch (error) {
    console.error('Error fetching leaders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leaders from database',
    });
  }
};

const getShopsByLeader = async (req, res) => {
  try {
    const leader = decodeURIComponent(req.params.leader);
    const shops = await Store.find({ leader: leader }).select('name -_id');
    const shopNames = shops.map((shop) => shop.name);
    res.json(shopNames);
  } catch (error) {
    console.error('Error fetching shops:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shops from database',
    });
  }
};

const getModelsByLeaderAndShop = async (req, res) => {
  try {
    const leader = decodeURIComponent(req.params.leader);
    const shopName = decodeURIComponent(req.params.shopName);

    const shop = await Store.findOne({ leader: leader, name: shopName });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found for this leader',
      });
    }

    const modelPosmData = await ModelPosm.find().lean();
    const modelGroups = {};

    modelPosmData.forEach((item) => {
      if (!modelGroups[item.model]) {
        modelGroups[item.model] = [];
      }
      modelGroups[item.model].push({
        posmCode: item.posm,
        posmName: item.posmName,
      });
    });

    res.json(modelGroups);
  } catch (error) {
    console.error('Error fetching models and POSM:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching models and POSM from database',
    });
  }
};

const submitSurvey = async (req, res) => {
  try {
    const { leader, shopName, responses } = req.body;
    const user = req.user; // From auth middleware

    if (!leader || !shopName || !responses || !Array.isArray(responses)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: leader, shopName, and responses',
      });
    }

    const surveyResponse = new SurveyResponse({
      leader,
      shopName,
      responses,
      submittedBy: user ? user.username : 'anonymous',
      submittedById: user ? user.userid : null,
      submittedByRole: user ? user.role : 'unknown',
    });

    await surveyResponse.save();
    console.log(
      `✅ Survey submitted successfully: ${leader} - ${shopName} by ${user?.username || 'anonymous'}`
    );

    res.status(200).json({
      success: true,
      message: 'Survey submitted successfully',
      data: {
        id: surveyResponse._id,
        submittedAt: surveyResponse.submittedAt,
        submittedBy: surveyResponse.submittedBy,
      },
    });
  } catch (error) {
    console.error('Error saving survey:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving survey to database',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const getSurveyResponses = async (req, res) => {
  try {
    console.log('📊 Fetching survey responses from MongoDB...');

    // Get pagination parameters from query
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    console.log(`📄 Pagination: page=${page}, limit=${limit}, skip=${skip}`);

    // Build filter conditions from query parameters
    const filters = {};
    if (req.query.leader) {
      filters.leader = req.query.leader;
    }
    if (req.query.shopName) {
      filters.shopName = req.query.shopName;
    }
    if (req.query.dateFrom || req.query.dateTo) {
      filters.submittedAt = {};
      if (req.query.dateFrom) {
        filters.submittedAt.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        const dateTo = new Date(req.query.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        filters.submittedAt.$lte = dateTo;
      }
    }

    console.log('🔍 Applied filters:', filters);

    // Get total count for pagination metadata
    const totalCount = await SurveyResponse.countDocuments(filters);

    // Get paginated responses
    const responses = await SurveyResponse.find(filters)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalCount / limit);

    console.log(`✅ Retrieved ${responses.length} of ${totalCount} total survey responses`);
    console.log(
      `📊 Pagination info: page ${page}/${totalPages}, showing ${responses.length} items`
    );

    if (responses.length > 0) {
      console.log('📋 Sample response structure:', {
        id: responses[0]._id,
        leader: responses[0].leader,
        shopName: responses[0].shopName,
        responsesCount: responses[0].responses ? responses[0].responses.length : 0,
      });
    }

    // Return paginated response with metadata
    res.json({
      data: responses,
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
    console.error('❌ Error fetching responses from MongoDB:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching survey responses',
    });
  }
};

/**
 * Get a single survey response by ID for admin editing
 * Admin only - no user filtering
 */
const getSurveyResponseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📋 Admin fetching survey response: ${id}`);
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid survey ID format'
      });
    }
    
    const survey = await SurveyResponse.findById(id).lean();
    
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }
    
    console.log(`✅ Found survey: ${survey.shopName} by ${survey.submittedBy}`);
    
    res.json({
      success: true,
      data: survey
    });
    
  } catch (error) {
    console.error('Error fetching survey response by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve survey response'
    });
  }
};

const deleteSurveyResponse = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Delete request for survey ID: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`❌ Invalid ObjectId format: ${id}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid survey ID',
      });
    }

    const response = await SurveyResponse.findById(id);
    if (!response) {
      console.log(`❌ Survey response not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Survey response not found',
      });
    }

    console.log(`✅ Found survey response: ${response.leader} - ${response.shopName}`);

    // Extract all image URLs and their S3 keys
    const imageData = [];
    if (response.responses && Array.isArray(response.responses)) {
      response.responses.forEach((modelResp) => {
        if (modelResp.images && Array.isArray(modelResp.images)) {
          modelResp.images.forEach((url) => {
            const s3Key = extractS3KeyFromUrl(url);
            if (s3Key) {
              imageData.push({ url, s3Key });
            } else {
              console.warn(`⚠️ Could not extract S3 key from URL: ${url}`);
            }
          });
        }
      });
    }

    console.log(`📸 Found ${imageData.length} images to delete from S3`);

    // Phase 1: Delete images from S3 with error tracking
    const s3DeletionResults = [];
    for (const { url, s3Key } of imageData) {
      try {
        await s3
          .deleteObject({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: s3Key,
          })
          .promise();
        console.log(`✅ Deleted S3 image: ${s3Key}`);
        s3DeletionResults.push({ url, s3Key, success: true });
      } catch (err) {
        console.error(`❌ Failed to delete S3 image: ${s3Key}`, err);
        s3DeletionResults.push({ url, s3Key, success: false, error: err.message });
      }
    }

    const failedS3Deletions = s3DeletionResults.filter((result) => !result.success);

    // Check deletion policy: should we proceed if some S3 deletions failed?
    if (failedS3Deletions.length > 0) {
      if (DELETION_CONFIG.strictMode) {
        console.error(
          `❌ ${failedS3Deletions.length} S3 deletions failed. Aborting operation due to strict mode.`
        );
        return res.status(500).json({
          success: false,
          message: `Failed to delete ${failedS3Deletions.length} image(s) from S3. Operation aborted.`,
          failedImages: failedS3Deletions.map((f) => ({ url: f.url, error: f.error })),
          totalImages: imageData.length,
        });
      } else {
        console.warn(
          `⚠️ ${failedS3Deletions.length} S3 deletions failed, but proceeding with DB deletion (non-strict mode)`
        );
      }
    }

    // Phase 2: Delete from MongoDB
    const deletedResponse = await SurveyResponse.findByIdAndDelete(id);
    if (!deletedResponse) {
      console.log(`❌ Failed to delete survey response from DB: ${id}`);

      // Rollback: attempt to restore S3 objects if DB deletion failed
      // (Note: This is complex to implement perfectly due to S3 eventual consistency)
      if (s3DeletionResults.some((r) => r.success)) {
        console.warn(
          `⚠️ DB deletion failed but S3 objects were already deleted. Manual cleanup may be needed.`
        );
      }

      return res.status(404).json({
        success: false,
        message: 'Survey response not found or could not be deleted',
      });
    }

    console.log(`✅ Survey response deleted successfully: ${id}`);
    console.log(
      `📊 Deletion Summary: DB=✅ | S3 Images: ${s3DeletionResults.filter((r) => r.success).length}/${imageData.length} deleted`
    );

    // Prepare response with detailed results
    const responseData = {
      success: true,
      message: 'Survey response deleted successfully',
      data: {
        id: deletedResponse._id,
        leader: deletedResponse.leader,
        shopName: deletedResponse.shopName,
      },
      imagesDeleted: s3DeletionResults.filter((r) => r.success).length,
      totalImages: imageData.length,
    };

    // Add warnings if there were S3 deletion failures
    if (failedS3Deletions.length > 0) {
      responseData.warnings = [
        `Failed to delete ${failedS3Deletions.length} image(s) from S3. Database record was still deleted.`,
      ];
      responseData.failedImages = failedS3Deletions.map((f) => ({ url: f.url, error: f.error }));
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ Error deleting survey response:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting survey response',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const bulkDeleteSurveyResponses = async (req, res) => {
  try {
    const { ids } = req.body;
    console.log(`🗑️ Bulk delete request for ${ids?.length || 0} survey responses`);

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No IDs provided for bulk delete',
      });
    }

    // Validate all IDs first
    const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid survey IDs provided: ${invalidIds.join(', ')}`,
      });
    }

    // Fetch all responses in parallel for better performance
    console.log('📋 Fetching responses to delete...');
    const responses = await SurveyResponse.find({ _id: { $in: ids } }).lean();

    const foundIds = responses.map((r) => r._id.toString());
    const notFoundIds = ids.filter((id) => !foundIds.includes(id));

    if (responses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No survey responses found with the provided IDs',
      });
    }

    console.log(
      `✅ Found ${responses.length} responses to delete, ${notFoundIds.length} not found`
    );

    // Collect all image URLs and their S3 keys that need to be deleted from S3
    const imageData = [];
    responses.forEach((response) => {
      if (response.responses && Array.isArray(response.responses)) {
        response.responses.forEach((modelResp) => {
          if (modelResp.images && Array.isArray(modelResp.images)) {
            modelResp.images.forEach((url) => {
              const s3Key = extractS3KeyFromUrl(url);
              if (s3Key) {
                imageData.push({ url, s3Key });
              } else {
                console.warn(`⚠️ Could not extract S3 key from URL: ${url}`);
              }
            });
          }
        });
      }
    });

    console.log(`📸 Found ${imageData.length} images to delete from S3`);

    // Delete images from S3 in parallel (with concurrency limit)
    const deleteImagePromises = imageData.map(async ({ url, s3Key }) => {
      try {
        await s3
          .deleteObject({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: s3Key,
          })
          .promise();
        return { url, s3Key, success: true };
      } catch (err) {
        console.error(`❌ Failed to delete S3 image: ${s3Key}`, err.message);
        return { url, s3Key, success: false, error: err.message };
      }
    });

    // Process S3 deletions with concurrency limit
    const batchSize = DELETION_CONFIG.s3ConcurrencyLimit;
    const imageResults = [];
    for (let i = 0; i < deleteImagePromises.length; i += batchSize) {
      const batch = deleteImagePromises.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch);
      imageResults.push(...batchResults);
    }

    const failedImages = imageResults.filter((result) => !result.success);

    // Check if we should abort due to S3 failures (strict mode)
    if (failedImages.length > 0) {
      if (DELETION_CONFIG.strictMode) {
        console.error(
          `❌ ${failedImages.length} S3 deletions failed. Aborting bulk operation due to strict mode.`
        );
        return res.status(500).json({
          success: false,
          message: `Failed to delete ${failedImages.length} image(s) from S3. Bulk operation aborted.`,
          failedImages: failedImages.map((f) => ({ url: f.url, error: f.error })),
          totalImages: imageData.length,
          affectedResponses: responses.length,
        });
      } else {
        console.warn(
          `⚠️ ${failedImages.length} S3 deletions failed, but proceeding with DB bulk deletion (non-strict mode)`
        );
      }
    }

    // Delete survey responses from database in bulk
    console.log('🗑️ Deleting survey responses from database...');
    const deleteResult = await SurveyResponse.deleteMany({ _id: { $in: foundIds } });

    const successMessage = `Successfully deleted ${deleteResult.deletedCount} survey response(s)`;
    console.log(`✅ ${successMessage}`);
    console.log(
      `📊 Bulk Deletion Summary: DB=${deleteResult.deletedCount}/${responses.length} | S3 Images: ${imageResults.filter((r) => r.success).length}/${imageData.length} deleted`
    );

    // Prepare response with detailed results
    const responseData = {
      success: true,
      message: successMessage,
      deletedCount: deleteResult.deletedCount,
      deletedIds: foundIds,
      skippedIds: notFoundIds,
      imagesDeleted: imageResults.filter((r) => r.success).length,
      imagesFailed: failedImages.length,
    };

    // Add warnings if there were issues
    if (notFoundIds.length > 0) {
      responseData.warnings = [
        `${notFoundIds.length} survey response(s) not found: ${notFoundIds.join(', ')}`,
      ];
    }
    if (failedImages.length > 0) {
      responseData.warnings = responseData.warnings || [];
      responseData.warnings.push(`Failed to delete ${failedImages.length} image(s) from S3`);
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ Error in bulk delete operation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during bulk delete operation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const getModelAutocomplete = async (req, res) => {
  try {
    const q = req.query.q || '';
    const models = await ModelPosm.find({
      model: { $regex: q, $options: 'i' },
    }).distinct('model');
    res.json(models);
  } catch (error) {
    console.error('Error in model autocomplete:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching models',
    });
  }
};

const getPosmByModel = async (req, res) => {
  try {
    const { model } = req.params;
    const modelPosmData = await ModelPosm.find({ model: model }).lean();

    if (modelPosmData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Model not found',
      });
    }

    const posmList = modelPosmData.map((item) => ({
      posmCode: item.posm,
      posmName: item.posmName,
    }));

    res.json({
      success: true,
      data: posmList
    });
  } catch (error) {
    console.error('Error fetching POSM for model:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching POSM data for model',
    });
  }
};

/**
 * Update a survey response by ID
 * Admin only function
 */
const updateSurveyResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log(`🔄 Attempting to update survey response: ${id}`);

    // Validate the survey exists
    const existingSurvey = await SurveyResponse.findById(id);
    if (!existingSurvey) {
      console.log(`❌ Survey response not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Survey not found',
      });
    }

    // Update the survey with validation
    const updatedSurvey = await SurveyResponse.findByIdAndUpdate(
      id,
      {
        shopName: updateData.shopName,
        shopId: updateData.shopId,
        submittedBy: updateData.submittedBy,
        responses: updateData.responses,
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
        select: '-__v', // Exclude version field
      }
    );

    if (!updatedSurvey) {
      console.log(`❌ Failed to update survey response: ${id}`);
      return res.status(400).json({
        success: false,
        message: 'Failed to update survey',
      });
    }

    console.log(`✅ Survey updated successfully: ${id}`);
    res.json({
      success: true,
      message: 'Survey updated successfully',
      data: updatedSurvey,
    });
  } catch (error) {
    console.error('Error updating survey:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors,
      });
    }

    // Handle cast errors (invalid ObjectId)
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid survey ID format',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
    });
  }
};

module.exports = {
  getLeaders,
  getShopsByLeader,
  getModelsByLeaderAndShop,
  submitSurvey,
  getSurveyResponses,
  getSurveyResponseById,
  deleteSurveyResponse,
  updateSurveyResponse,
  bulkDeleteSurveyResponses,
  getModelAutocomplete,
  getPosmByModel,
};
