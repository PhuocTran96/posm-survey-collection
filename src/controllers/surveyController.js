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
    const requestedLimit = parseInt(req.query.limit) || 20;

    // CRITICAL FIX: Detect export requests and bypass 100-record cap
    const isExportRequest = requestedLimit >= 999999;
    const limit = isExportRequest ? 999999 : Math.min(100, Math.max(1, requestedLimit));
    const skip = isExportRequest ? 0 : (page - 1) * limit; // Don't skip records for exports

    console.log(
      `📄 Pagination: page=${page}, requestedLimit=${requestedLimit}, actualLimit=${limit}, skip=${skip}, isExport=${isExportRequest}`
    );

    // Build filter conditions from query parameters
    const filters = {};

    // Global search functionality
    if (req.query.search) {
      const searchTerm = req.query.search.trim();
      if (searchTerm) {
        console.log(`🔍 Global search term: "${searchTerm}"`);

        // Create text search across multiple fields
        const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        filters.$or = [
          { shopName: { $regex: searchRegex } },
          { leader: { $regex: searchRegex } },
          { submittedBy: { $regex: searchRegex } },
          { 'responses.model': { $regex: searchRegex } },
        ];
      }
    }

    // Specific field filters (work alongside global search)
    if (req.query.leader) {
      if (filters.$or) {
        filters.$and = [{ $or: filters.$or }, { leader: req.query.leader }];
        delete filters.$or;
      } else {
        filters.leader = req.query.leader;
      }
    }
    if (req.query.shopName) {
      const shopNameFilter = {
        shopName: new RegExp(req.query.shopName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      };
      if (filters.$and) {
        filters.$and.push(shopNameFilter);
      } else if (filters.$or) {
        filters.$and = [{ $or: filters.$or }, shopNameFilter];
        delete filters.$or;
      } else {
        filters.shopName = shopNameFilter.shopName;
      }
    }
    if (req.query.submittedBy) {
      const submittedByFilter = { submittedBy: req.query.submittedBy };
      if (filters.$and) {
        filters.$and.push(submittedByFilter);
      } else if (filters.$or) {
        filters.$and = [{ $or: filters.$or }, submittedByFilter];
        delete filters.$or;
      } else {
        filters.submittedBy = req.query.submittedBy;
      }
    }

    // Model filtering
    if (req.query.model) {
      const modelFilter = {
        'responses.model': new RegExp(req.query.model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      };
      if (filters.$and) {
        filters.$and.push(modelFilter);
      } else if (filters.$or) {
        filters.$and = [{ $or: filters.$or }, modelFilter];
        delete filters.$or;
      } else {
        filters['responses.model'] = modelFilter['responses.model'];
      }
    }
    // Enhanced date filtering with comprehensive debugging
    if (req.query.dateFrom || req.query.dateTo) {
      console.log('📅 Backend Date Filtering Debug:', {
        receivedDateFrom: req.query.dateFrom,
        receivedDateTo: req.query.dateTo,
        dateFromType: typeof req.query.dateFrom,
        dateToType: typeof req.query.dateTo,
      });

      // Parse dates with detailed logging
      let dateFromParsed = null,
        dateToParsed = null;
      if (req.query.dateFrom) {
        dateFromParsed = new Date(req.query.dateFrom);
        console.log('📅 Parsing dateFrom:', {
          input: req.query.dateFrom,
          parsed: dateFromParsed,
          isValid: !isNaN(dateFromParsed),
          iso: dateFromParsed.toISOString(),
          local: dateFromParsed.toLocaleString('vi-VN'),
        });
      }

      if (req.query.dateTo) {
        dateToParsed = new Date(req.query.dateTo);
        // CRITICAL FIX: Ensure end-of-day for "to" date filters
        if (
          dateToParsed.getHours() === 0 &&
          dateToParsed.getMinutes() === 0 &&
          dateToParsed.getSeconds() === 0
        ) {
          dateToParsed.setHours(23, 59, 59, 999);
        }
        console.log('📅 Parsing dateTo:', {
          input: req.query.dateTo,
          parsed: dateToParsed,
          isValid: !isNaN(dateToParsed),
          iso: dateToParsed.toISOString(),
          local: dateToParsed.toLocaleString('vi-VN'),
          adjustedToEndOfDay: dateToParsed.getHours() === 23,
        });
      }

      // Build date filter - check both submittedAt and createdAt
      const dateFilter = {};
      if (dateFromParsed && !isNaN(dateFromParsed)) {
        dateFilter.$gte = dateFromParsed;
      }
      if (dateToParsed && !isNaN(dateToParsed)) {
        dateFilter.$lte = dateToParsed;
      }

      // Apply to both possible date fields
      filters.$or = [{ submittedAt: dateFilter }, { createdAt: dateFilter }];

      console.log('📅 Final Date Filter:', {
        dateFilter: dateFilter,
        orConditions: filters.$or,
      });
    }

    console.log('🔍 All Applied Filters:', JSON.stringify(filters, null, 2));

    // Database debugging - get statistics
    let totalDocuments = 0;
    try {
      totalDocuments = await SurveyResponse.countDocuments({});
      console.log('📊 Database Statistics:', {
        totalDocumentsInCollection: totalDocuments,
      });
    } catch (error) {
      console.warn('⚠️ Error getting total document count:', error.message);
    }

    // If date filters are applied, let's see what data exists in the date range
    if (req.query.dateFrom || req.query.dateTo) {
      // Build safe filter objects for statistics
      const submittedAtFilter = {};
      const createdAtFilter = {};

      if (req.query.dateFrom) {
        const fromDate = new Date(req.query.dateFrom);
        submittedAtFilter.$gte = fromDate;
        createdAtFilter.$gte = fromDate;
      } else {
        submittedAtFilter.$gte = new Date('1970-01-01');
        createdAtFilter.$gte = new Date('1970-01-01');
      }

      if (req.query.dateTo) {
        const toDate = new Date(req.query.dateTo);
        // CRITICAL FIX: Apply same end-of-day logic for statistics
        if (toDate.getHours() === 0 && toDate.getMinutes() === 0 && toDate.getSeconds() === 0) {
          toDate.setHours(23, 59, 59, 999);
        }
        submittedAtFilter.$lte = toDate;
        createdAtFilter.$lte = toDate;
      } else {
        submittedAtFilter.$lte = new Date();
        createdAtFilter.$lte = new Date();
      }

      // Test individual date field queries with error handling
      let submittedAtCount = 0;
      let createdAtCount = 0;

      try {
        submittedAtCount = await SurveyResponse.countDocuments({
          submittedAt: submittedAtFilter,
        });
      } catch (error) {
        console.warn('⚠️ Error counting submittedAt documents:', error.message);
      }

      try {
        createdAtCount = await SurveyResponse.countDocuments({
          createdAt: createdAtFilter,
        });
      } catch (error) {
        console.warn('⚠️ Error counting createdAt documents:', error.message);
      }

      console.log('📊 Date Range Statistics:', {
        documentsWithSubmittedAtInRange: submittedAtCount,
        documentsWithCreatedAtInRange: createdAtCount,
        requestedDateRange: {
          from: req.query.dateFrom ? new Date(req.query.dateFrom).toISOString() : null,
          to: req.query.dateTo ? new Date(req.query.dateTo).toISOString() : null,
        },
      });

      // Sample a few documents to see their actual date field values
      try {
        const sampleDocs = await SurveyResponse.find({}).limit(3).lean();
        console.log(
          '📋 Sample Documents Date Fields:',
          sampleDocs.map((doc) => ({
            id: doc._id,
            submittedAt: doc.submittedAt,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          }))
        );
      } catch (error) {
        console.warn('⚠️ Error fetching sample documents:', error.message);
      }
    }

    // Get total count for pagination metadata
    const totalCount = await SurveyResponse.countDocuments(filters);
    console.log('🔢 Query Results Count:', {
      matchingDocuments: totalCount,
      appliedFilters: filters,
    });

    // Log export request details
    if (isExportRequest) {
      console.log('📤 EXPORT REQUEST DETECTED:', {
        totalRecordsAvailable: totalCount,
        willReturnAllRecords: true,
        skipPagination: true,
        requestedLimit: requestedLimit,
        actualQueryLimit: limit,
      });
    }

    // Get responses - optimized for export requests
    let query = SurveyResponse.find(filters).sort({ submittedAt: -1 });

    if (isExportRequest) {
      // For exports: return ALL records, no pagination
      query = query.lean();
      console.log('📋 Executing UNLIMITED query for export...');
    } else {
      // For regular requests: use pagination
      query = query.skip(skip).limit(limit).lean();
    }

    const responses = await query;

    const totalPages = isExportRequest ? 1 : Math.ceil(totalCount / limit);

    if (isExportRequest) {
      console.log(
        `✅ EXPORT COMPLETE: Retrieved ALL ${responses.length} of ${totalCount} total survey responses`
      );
      console.log(`📤 Export success: ${responses.length} records ready for Excel generation`);
    } else {
      console.log(`✅ Retrieved ${responses.length} of ${totalCount} total survey responses`);
      console.log(
        `📊 Pagination info: page ${page}/${totalPages}, showing ${responses.length} items`
      );
    }

    if (responses.length > 0) {
      console.log('📋 Sample response structure:', {
        id: responses[0]._id,
        leader: responses[0].leader,
        shopName: responses[0].shopName,
        responsesCount: responses[0].responses ? responses[0].responses.length : 0,
        dateFields: {
          submittedAt: responses[0].submittedAt,
          createdAt: responses[0].createdAt,
          updatedAt: responses[0].updatedAt,
        },
      });

      // Show date range of returned results
      if (req.query.dateFrom || req.query.dateTo) {
        const dates = responses
          .map((r) => ({
            id: r._id,
            submittedAt: r.submittedAt,
            createdAt: r.createdAt,
            shopName: r.shopName,
          }))
          .slice(0, 5); // Show first 5

        console.log('📅 Date Fields of Returned Results (first 5):', dates);

        // Show date range summary
        const submittedDates = responses
          .map((r) => r.submittedAt)
          .filter(Boolean)
          .sort();
        const createdDates = responses
          .map((r) => r.createdAt)
          .filter(Boolean)
          .sort();

        console.log('📊 Date Range Summary of Results:', {
          submittedAtRange: {
            earliest: submittedDates[0],
            latest: submittedDates[submittedDates.length - 1],
            count: submittedDates.length,
          },
          createdAtRange: {
            earliest: createdDates[0],
            latest: createdDates[createdDates.length - 1],
            count: createdDates.length,
          },
        });
      }
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
        message: 'Invalid survey ID format',
      });
    }

    const survey = await SurveyResponse.findById(id).lean();

    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey response not found',
      });
    }

    console.log(`✅ Found survey: ${survey.shopName} by ${survey.submittedBy}`);

    res.json({
      success: true,
      data: survey,
    });
  } catch (error) {
    console.error('Error fetching survey response by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve survey response',
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

    // Add logging for debugging mobile requests
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    );
    console.log(
      `🔍 Model lookup request: "${model}" from mobile=${isMobile}, UA="${userAgent.substring(0, 50)}"`
    );

    // Case-insensitive query with regex to handle mobile case variations
    const modelPosmData = await ModelPosm.find({
      model: { $regex: new RegExp(`^${model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).lean();

    if (modelPosmData.length === 0) {
      console.log(`❌ No POSM found for model: "${model}" (mobile=${isMobile})`);
      return res.status(404).json({
        success: false,
        message: 'Model not found',
      });
    }

    console.log(
      `✅ Found ${modelPosmData.length} POSM records for model: "${model}" (mobile=${isMobile})`
    );

    const posmList = modelPosmData.map((item) => ({
      posmCode: item.posm,
      posmName: item.posmName,
    }));

    // Return just the array to match frontend expectations
    res.json(posmList);
  } catch (error) {
    console.error('Error fetching POSM for model:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching POSM data for model',
    });
  }
};

/**
 * Get autocomplete suggestions for shop names
 * Used for improved UX in filtering
 */
const getShopAutocomplete = async (req, res) => {
  try {
    const query = req.query.q || '';

    if (query.length < 2) {
      return res.json([]);
    }

    console.log(`🔍 Shop autocomplete search: "${query}"`);

    const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const shops = await SurveyResponse.distinct('shopName', {
      shopName: { $regex: searchRegex },
    });

    // Sort by relevance (exact matches first, then alphabetical)
    const sortedShops = shops.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const queryLower = query.toLowerCase();

      // Exact match first
      if (aLower === queryLower) {
        return -1;
      }
      if (bLower === queryLower) {
        return 1;
      }

      // Starts with query
      if (aLower.startsWith(queryLower) && !bLower.startsWith(queryLower)) {
        return -1;
      }
      if (bLower.startsWith(queryLower) && !aLower.startsWith(queryLower)) {
        return 1;
      }

      // Alphabetical
      return a.localeCompare(b);
    });

    res.json(sortedShops.slice(0, 10)); // Limit to 10 suggestions
  } catch (error) {
    console.error('Error in shop autocomplete:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching shops',
    });
  }
};

/**
 * Get search suggestions based on partial input
 * Provides suggestions across all searchable fields
 */
const getSearchSuggestions = async (req, res) => {
  try {
    const query = req.query.q || '';

    if (query.length < 2) {
      return res.json({
        shops: [],
        models: [],
        submitters: [],
      });
    }

    console.log(`💡 Search suggestions for: "${query}"`);

    const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // Get suggestions from different fields in parallel
    const [shops, models, submitters] = await Promise.all([
      SurveyResponse.distinct('shopName', { shopName: { $regex: searchRegex } }),
      SurveyResponse.distinct('responses.model', { 'responses.model': { $regex: searchRegex } }),
      SurveyResponse.distinct('submittedBy', { submittedBy: { $regex: searchRegex } }),
    ]);

    // Sort each array
    const sortFn = (a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const queryLower = query.toLowerCase();

      if (aLower.startsWith(queryLower) && !bLower.startsWith(queryLower)) {
        return -1;
      }
      if (bLower.startsWith(queryLower) && !aLower.startsWith(queryLower)) {
        return 1;
      }
      return a.localeCompare(b);
    };

    res.json({
      shops: shops.sort(sortFn).slice(0, 5),
      models: models.filter(Boolean).sort(sortFn).slice(0, 5),
      submitters: submitters.filter(Boolean).sort(sortFn).slice(0, 5),
    });
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting search suggestions',
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

/**
 * Delete a specific model response from within a survey
 * Admin only function
 */
const deleteModelFromSurvey = async (req, res) => {
  try {
    const { surveyId, modelIndex } = req.params;
    console.log(`🗑️ Delete model request: surveyId=${surveyId}, modelIndex=${modelIndex}`);

    // Validate surveyId format
    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
      console.log(`❌ Invalid ObjectId format: ${surveyId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid survey ID format',
      });
    }

    // Validate modelIndex is a number
    const index = parseInt(modelIndex);
    if (isNaN(index) || index < 0) {
      console.log(`❌ Invalid model index: ${modelIndex}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid model index',
      });
    }

    // Find the survey
    const survey = await SurveyResponse.findById(surveyId);
    if (!survey) {
      console.log(`❌ Survey response not found: ${surveyId}`);
      return res.status(404).json({
        success: false,
        message: 'Survey response not found',
      });
    }

    // Check if model index is valid
    if (!survey.responses || index >= survey.responses.length) {
      console.log(`❌ Model index out of range: ${index}/${survey.responses?.length || 0}`);
      return res.status(400).json({
        success: false,
        message: 'Model index out of range',
      });
    }

    // Prevent deletion if it's the last model in the survey
    if (survey.responses.length <= 1) {
      console.log(`❌ Cannot delete last model from survey: ${surveyId}`);
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last model from a survey. Delete the entire survey instead.',
      });
    }

    const modelToDelete = survey.responses[index];
    console.log(`✅ Found model to delete: ${modelToDelete.model} (index: ${index})`);

    // Extract image URLs for S3 cleanup
    const imageData = [];
    if (modelToDelete.images && Array.isArray(modelToDelete.images)) {
      modelToDelete.images.forEach((url) => {
        const s3Key = extractS3KeyFromUrl(url);
        if (s3Key) {
          imageData.push({ url, s3Key });
        } else {
          console.warn(`⚠️ Could not extract S3 key from URL: ${url}`);
        }
      });
    }

    console.log(`📸 Found ${imageData.length} images to delete from S3`);

    // Phase 1: Delete images from S3
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

    // Check deletion policy for S3 failures
    if (failedS3Deletions.length > 0 && DELETION_CONFIG.strictMode) {
      console.error(
        `❌ ${failedS3Deletions.length} S3 deletions failed. Aborting operation due to strict mode.`
      );
      return res.status(500).json({
        success: false,
        message: `Failed to delete ${failedS3Deletions.length} image(s) from S3. Operation aborted.`,
        failedImages: failedS3Deletions.map((f) => ({ url: f.url, error: f.error })),
      });
    }

    // Phase 2: Remove model from survey responses array
    survey.responses.splice(index, 1);
    survey.updatedAt = new Date();

    const updatedSurvey = await survey.save();
    console.log(`✅ Model deleted successfully from survey: ${surveyId}`);

    // Prepare response with detailed results
    const responseData = {
      success: true,
      message: 'Model deleted successfully from survey',
      data: {
        surveyId: updatedSurvey._id,
        deletedModel: modelToDelete.model,
        modelIndex: index,
        remainingModels: updatedSurvey.responses.length,
      },
      imagesDeleted: s3DeletionResults.filter((r) => r.success).length,
      totalImages: imageData.length,
    };

    // Add warnings if there were S3 deletion failures
    if (failedS3Deletions.length > 0) {
      responseData.warnings = [
        `Failed to delete ${failedS3Deletions.length} image(s) from S3. Model was still removed from survey.`,
      ];
      responseData.failedImages = failedS3Deletions.map((f) => ({ url: f.url, error: f.error }));
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ Error deleting model from survey:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting model from survey',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Bulk delete specific models from multiple surveys
 * Admin only function
 */
const bulkDeleteModelsFromSurveys = async (req, res) => {
  try {
    const { deletions } = req.body;
    console.log(`🗑️ Bulk delete models request for ${deletions?.length || 0} models`);

    if (!Array.isArray(deletions) || deletions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No deletions provided for bulk model delete',
      });
    }

    // Validate deletion objects
    for (const deletion of deletions) {
      if (!deletion.surveyId || typeof deletion.modelIndex !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Invalid deletion format. Each deletion must have surveyId and modelIndex.',
        });
      }
      if (!mongoose.Types.ObjectId.isValid(deletion.surveyId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid survey ID format: ${deletion.surveyId}`,
        });
      }
    }

    console.log('📋 Processing bulk model deletions...');

    const results = {
      successful: [],
      failed: [],
      s3Images: { deleted: 0, failed: 0 },
      warnings: [],
    };

    // Group deletions by survey ID and sort by modelIndex descending
    // This ensures we delete from highest index first to avoid index shifting issues
    const deletionsBySurvey = {};
    deletions.forEach((deletion) => {
      if (!deletionsBySurvey[deletion.surveyId]) {
        deletionsBySurvey[deletion.surveyId] = [];
      }
      deletionsBySurvey[deletion.surveyId].push(deletion);
    });

    // Sort each survey's deletions by index descending
    Object.keys(deletionsBySurvey).forEach((surveyId) => {
      deletionsBySurvey[surveyId].sort((a, b) => b.modelIndex - a.modelIndex);
    });

    // Process each survey
    for (const [surveyId, surveyDeletions] of Object.entries(deletionsBySurvey)) {
      try {
        const survey = await SurveyResponse.findById(surveyId);
        if (!survey) {
          surveyDeletions.forEach((deletion) => {
            results.failed.push({
              surveyId: deletion.surveyId,
              modelIndex: deletion.modelIndex,
              error: 'Survey not found',
            });
          });
          continue;
        }

        // Check if we would delete all models from this survey
        const validDeletions = surveyDeletions.filter(
          (d) => d.modelIndex >= 0 && d.modelIndex < survey.responses.length
        );

        if (validDeletions.length >= survey.responses.length) {
          surveyDeletions.forEach((deletion) => {
            results.failed.push({
              surveyId: deletion.surveyId,
              modelIndex: deletion.modelIndex,
              error: 'Cannot delete all models from survey',
            });
          });
          continue;
        }

        // Process S3 image cleanup for valid deletions
        const imageData = [];
        validDeletions.forEach((deletion) => {
          const modelToDelete = survey.responses[deletion.modelIndex];
          if (modelToDelete && modelToDelete.images) {
            modelToDelete.images.forEach((url) => {
              const s3Key = extractS3KeyFromUrl(url);
              if (s3Key) {
                imageData.push({ url, s3Key });
              }
            });
          }
        });

        // Delete S3 images
        for (const { url, s3Key } of imageData) {
          try {
            await s3
              .deleteObject({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: s3Key,
              })
              .promise();
            results.s3Images.deleted++;
          } catch (err) {
            console.error(`❌ Failed to delete S3 image: ${s3Key}`, err);
            results.s3Images.failed++;
            if (!DELETION_CONFIG.strictMode) {
              results.warnings.push(`Failed to delete S3 image: ${s3Key}`);
            }
          }
        }

        // If strict mode and S3 failures, skip this survey
        if (results.s3Images.failed > 0 && DELETION_CONFIG.strictMode) {
          validDeletions.forEach((deletion) => {
            results.failed.push({
              surveyId: deletion.surveyId,
              modelIndex: deletion.modelIndex,
              error: 'S3 deletion failed in strict mode',
            });
          });
          continue;
        }

        // Remove models from survey (in descending index order)
        validDeletions.forEach((deletion) => {
          const modelToDelete = survey.responses[deletion.modelIndex];
          survey.responses.splice(deletion.modelIndex, 1);
          results.successful.push({
            surveyId: deletion.surveyId,
            modelIndex: deletion.modelIndex,
            deletedModel: modelToDelete.model,
          });
        });

        // Save updated survey
        survey.updatedAt = new Date();
        await survey.save();

        console.log(`✅ Deleted ${validDeletions.length} models from survey ${surveyId}`);

        // Mark invalid deletions as failed
        surveyDeletions
          .filter((d) => !validDeletions.includes(d))
          .forEach((deletion) => {
            results.failed.push({
              surveyId: deletion.surveyId,
              modelIndex: deletion.modelIndex,
              error: 'Invalid model index',
            });
          });
      } catch (error) {
        console.error(`❌ Error processing survey ${surveyId}:`, error);
        surveyDeletions.forEach((deletion) => {
          results.failed.push({
            surveyId: deletion.surveyId,
            modelIndex: deletion.modelIndex,
            error: error.message,
          });
        });
      }
    }

    const successCount = results.successful.length;
    const failCount = results.failed.length;

    console.log(`📊 Bulk model deletion summary: ${successCount} successful, ${failCount} failed`);

    const responseData = {
      success: true,
      message: `Bulk model deletion completed: ${successCount} successful, ${failCount} failed`,
      results: {
        successful: results.successful,
        failed: results.failed,
        s3Images: results.s3Images,
      },
    };

    if (results.warnings.length > 0) {
      responseData.warnings = results.warnings;
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ Error in bulk model delete operation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during bulk model delete operation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
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
  deleteModelFromSurvey,
  bulkDeleteModelsFromSurveys,
  getModelAutocomplete,
  getPosmByModel,
  getShopAutocomplete,
  getSearchSuggestions,
};
