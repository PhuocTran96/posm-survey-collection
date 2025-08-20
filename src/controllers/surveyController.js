const { SurveyResponse, Store, ModelPosm } = require('../models');
const { s3 } = require('../utils/s3Helper');
const mongoose = require('mongoose');

const getLeaders = async (req, res) => {
  try {
    const leaders = await Store.distinct('leader');
    res.json(leaders);
  } catch (error) {
    console.error('Error fetching leaders:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching leaders from database' 
    });
  }
};

const getShopsByLeader = async (req, res) => {
  try {
    const leader = decodeURIComponent(req.params.leader);
    const shops = await Store.find({ leader: leader }).select('name -_id');
    const shopNames = shops.map(shop => shop.name);
    res.json(shopNames);
  } catch (error) {
    console.error('Error fetching shops:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching shops from database' 
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
        message: 'Shop not found for this leader' 
      });
    }
    
    const modelPosmData = await ModelPosm.find().lean();
    const modelGroups = {};
    
    modelPosmData.forEach(item => {
      if (!modelGroups[item.model]) {
        modelGroups[item.model] = [];
      }
      modelGroups[item.model].push({
        posmCode: item.posm,
        posmName: item.posmName
      });
    });
    
    res.json(modelGroups);
  } catch (error) {
    console.error('Error fetching models and POSM:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching models and POSM from database' 
    });
  }
};

const submitSurvey = async (req, res) => {
  try {
    const { leader, shopName, responses } = req.body;
    
    if (!leader || !shopName || !responses || !Array.isArray(responses)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: leader, shopName, and responses'
      });
    }
    
    const surveyResponse = new SurveyResponse({
      leader,
      shopName,
      responses
    });
    
    await surveyResponse.save();
    console.log(`✅ Survey submitted successfully: ${leader} - ${shopName}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'Survey submitted successfully',
      data: {
        id: surveyResponse._id,
        submittedAt: surveyResponse.submittedAt
      }
    });
  } catch (error) {
    console.error('Error saving survey:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error saving survey to database',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    console.log(`📊 Pagination info: page ${page}/${totalPages}, showing ${responses.length} items`);
    
    if (responses.length > 0) {
      console.log('📋 Sample response structure:', {
        id: responses[0]._id,
        leader: responses[0].leader,
        shopName: responses[0].shopName,
        responsesCount: responses[0].responses ? responses[0].responses.length : 0
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
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('❌ Error fetching responses from MongoDB:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching survey responses' 
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
        message: 'Invalid survey ID'
      });
    }
    
    const response = await SurveyResponse.findById(id);
    if (!response) {
      console.log(`❌ Survey response not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }
    
    console.log(`✅ Found survey response: ${response.leader} - ${response.shopName}`);
    
    const imageUrls = [];
    if (response.responses && Array.isArray(response.responses)) {
      response.responses.forEach(modelResp => {
        if (modelResp.images && Array.isArray(modelResp.images)) {
          modelResp.images.forEach(url => imageUrls.push(url));
        }
      });
    }
    
    console.log(`📸 Found ${imageUrls.length} images to delete from S3`);
    
    for (const url of imageUrls) {
      try {
        const match = url.match(/https?:\/\/.+?\.amazonaws\.com\/(.+)$/);
        if (match && match[1]) {
          const Key = decodeURIComponent(match[1]);
          await s3.deleteObject({
            Bucket: process.env.AWS_S3_BUCKET,
            Key
          }).promise();
          console.log(`✅ Deleted S3 image: ${Key}`);
        }
      } catch (err) {
        console.error('❌ Failed to delete image from S3:', url, err);
      }
    }
    
    const deletedResponse = await SurveyResponse.findByIdAndDelete(id);
    if (!deletedResponse) {
      console.log(`❌ Failed to delete survey response from DB: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }
    
    console.log(`✅ Survey response and images deleted successfully: ${id}`);
    res.status(200).json({
      success: true,
      message: 'Survey response and images deleted successfully',
      data: {
        id: deletedResponse._id,
        leader: deletedResponse.leader,
        shopName: deletedResponse.shopName
      }
    });
  } catch (error) {
    console.error('❌ Error deleting survey response:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting survey response',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const bulkDeleteSurveyResponses = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No IDs provided' 
      });
    }
    
    const deletedIds = [];
    const errors = [];
    
    for (const id of ids) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        errors.push({ id, error: 'Invalid survey ID' });
        continue;
      }
      
      try {
        const response = await SurveyResponse.findById(id);
        if (!response) {
          errors.push({ id, error: 'Survey response not found' });
          continue;
        }
        
        const imageUrls = [];
        if (response.responses && Array.isArray(response.responses)) {
          response.responses.forEach(modelResp => {
            if (modelResp.images && Array.isArray(modelResp.images)) {
              modelResp.images.forEach(url => imageUrls.push(url));
            }
          });
        }
        
        for (const url of imageUrls) {
          try {
            const match = url.match(/https?:\/\/.+?\.amazonaws\.com\/(.+)$/);
            if (match && match[1]) {
              const Key = decodeURIComponent(match[1]);
              await s3.deleteObject({
                Bucket: process.env.AWS_S3_BUCKET,
                Key
              }).promise();
            }
          } catch (err) {
            errors.push({ id, error: 'Failed to delete image from S3', url });
          }
        }
        
        await SurveyResponse.findByIdAndDelete(id);
        deletedIds.push(id);
      } catch (err) {
        errors.push({ id, error: err.message });
      }
    }
    
    res.json({
      success: true,
      deletedIds,
      errors
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error in bulk delete', 
      error: error.message 
    });
  }
};

const getModelAutocomplete = async (req, res) => {
  try {
    const q = req.query.q || '';
    const models = await ModelPosm.find({
      model: { $regex: q, $options: 'i' }
    }).distinct('model');
    res.json(models);
  } catch (error) {
    console.error('Error in model autocomplete:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error searching models' 
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
        message: 'Model not found' 
      });
    }
    
    const posmList = modelPosmData.map(item => ({
      posmCode: item.posm,
      posmName: item.posmName
    }));
    
    res.json(posmList);
  } catch (error) {
    console.error('Error fetching POSM for model:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching POSM data for model' 
    });
  }
};

module.exports = {
  getLeaders,
  getShopsByLeader,
  getModelsByLeaderAndShop,
  submitSurvey,
  getSurveyResponses,
  deleteSurveyResponse,
  bulkDeleteSurveyResponses,
  getModelAutocomplete,
  getPosmByModel
};