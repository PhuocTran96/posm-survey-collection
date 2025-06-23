// Load environment variables
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const { getS3SignedUrl, s3, reduceImageSize } = require('./s3');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI;

// MongoDB connection with retry logic
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Exit process if connection fails in production
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    // Retry connection after 5 seconds in development
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

// Connect to MongoDB
connectDB().then(() => {
  // Initialize data after successful MongoDB connection
  initializeData();
});

const db = mongoose.connection;
db.on('error', (error) => {
  console.error('MongoDB connection error:', error.message);
});
db.on('disconnected', () => {
  console.log('MongoDB disconnected');
});
db.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Survey Response Schema
const surveyResponseSchema = new mongoose.Schema({
  leader: {
    type: String,
    required: true
  },
  shopName: {
    type: String,
    required: true
  },
  responses: [{
    model: {
      type: String,
      required: true
    },
    posmSelections: [{
      posmCode: String,
      posmName: String,
      selected: Boolean
    }],
    allSelected: {
      type: Boolean,
      default: false
    },
    images: [{
      type: String
    }]
  }],
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema);

// Store Schema
const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  province: {
    type: String,
    required: true
  },
  leader: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const Store = mongoose.model('Store', storeSchema);

// Model and POSM Schema
const modelPosmSchema = new mongoose.Schema({
  model: {
    type: String,
    required: true
  },
  posm: {
    type: String,
    required: true
  },
  posmName: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const ModelPosm = mongoose.model('ModelPosm', modelPosmSchema);

// Load stores data from CSV to MongoDB
async function loadStoresData() {
  try {
    const existingStores = await Store.countDocuments();
    if (existingStores > 0) {
      console.log(`✅ Stores data already loaded (${existingStores} records)`);
      return;
    }

    const stores = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream('stores.csv')
        .pipe(csv())        .on('data', (row) => {
          // Debug: log only the first row to see available columns
          if (stores.length === 0) {
            console.log('Store CSV columns:', Object.keys(row));
            console.log('Store CSV row sample:', row);
          }
          
          // Handle BOM character in CSV headers
          const name = row['Name'] || row['﻿Name'] || '';
          const province = row['Province'] || '';
          const leader = row['Leader'] || '';
          
          // Skip empty records
          if (name.trim() && province.trim() && leader.trim()) {
            stores.push({
              name: name.trim(),
              province: province.trim(),
              leader: leader.trim()
            });
          }
        })
        .on('end', async () => {
          try {
            await Store.insertMany(stores);
            console.log(`✅ Stores data loaded successfully: ${stores.length} records`);
            resolve();
          } catch (error) {
            console.error('❌ Error inserting stores to MongoDB:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('❌ Error reading stores.csv:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error('❌ Error loading stores data:', error);
  }
}

// Load model and POSM data from CSV to MongoDB
async function loadModelPosmData() {
  try {
    const existingRecords = await ModelPosm.countDocuments();
    if (existingRecords > 0) {
      console.log(`✅ Model/POSM data already loaded (${existingRecords} records)`);
      return;
    }

    const modelPosmData = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream('posm.csv')
        .pipe(csv())        .on('data', (row) => {
          // Debug: log only the first row to see available columns
          if (modelPosmData.length === 0) {
            console.log('POSM CSV columns:', Object.keys(row));
            console.log('POSM CSV row sample:', row);
          }
          
          // Handle BOM character in CSV headers
          const model = row['model'] || row['﻿model'] || '';
          const posm = row['posm'] || '';
          const posmName = row['posm_name'] || '';
          
          // Skip empty records
          if (model.trim() && posm.trim() && posmName.trim()) {
            modelPosmData.push({
              model: model.trim(),
              posm: posm.trim(),
              posmName: posmName.trim()
            });
          }
        })
        .on('end', async () => {
          try {
            await ModelPosm.insertMany(modelPosmData);
            console.log(`✅ Model/POSM data loaded successfully: ${modelPosmData.length} records`);
            resolve();
          } catch (error) {
            console.error('❌ Error inserting model/POSM to MongoDB:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('❌ Error reading posm.csv:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error('❌ Error loading model/POSM data:', error);
  }
}

// Initialize data loading
async function initializeData() {
  try {
    await loadStoresData();
    await loadModelPosmData();
    console.log('🎉 All data initialization completed');
  } catch (error) {
    console.error('❌ Data initialization failed:', error);
  }
}

// API Routes

// Get all leaders
app.get('/api/leaders', async (req, res) => {
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
});

// Get shops by leader
app.get('/api/shops/:leader', async (req, res) => {
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
});

// Get models and POSM by leader and shop
app.get('/api/models/:leader/:shopName', async (req, res) => {
  try {
    const leader = decodeURIComponent(req.params.leader);
    const shopName = decodeURIComponent(req.params.shopName);
    
    // Verify the shop exists for this leader
    const shop = await Store.findOne({ leader: leader, name: shopName });
    if (!shop) {
      return res.status(404).json({ 
        success: false, 
        message: 'Shop not found for this leader' 
      });
    }
    
    // Get all model-posm combinations
    const modelPosmData = await ModelPosm.find().lean();
      // Group by model
    const modelGroups = {};
    modelPosmData.forEach(item => {
      if (!modelGroups[item.model]) {
        modelGroups[item.model] = [];
      }
      modelGroups[item.model].push({
        posmCode: item.posm,
        posmName: item.posmName // Using the actual posm name from database
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
});

// Submit survey response (email notification removed)
app.post('/api/submit', async (req, res) => {
  try {
    const { leader, shopName, responses, modelImages } = req.body;
    
    // Validate required fields
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
    
    // Only return success, no email notification
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
});

// Get survey responses (for admin)
app.get('/api/responses', async (req, res) => {
  try {
    console.log('📊 Fetching survey responses from MongoDB...');
    const responses = await SurveyResponse.find()
      .sort({ submittedAt: -1 })
      .lean();
    
    console.log(`✅ Retrieved ${responses.length} survey responses from MongoDB`);
    
    // Log a sample response structure for debugging
    if (responses.length > 0) {
      console.log('📋 Sample response structure:', {
        id: responses[0]._id,
        leader: responses[0].leader,
        shopName: responses[0].shopName,
        responsesCount: responses[0].responses ? responses[0].responses.length : 0
      });
    }
    
    res.json(responses);
  } catch (error) {
    console.error('❌ Error fetching responses from MongoDB:', error);
    res.status(500).json({ success: false, message: 'Error fetching survey responses' });
  }
});

// Delete survey response (for admin)
app.delete('/api/responses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Delete request for survey ID: ${id}`);
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`❌ Invalid ObjectId format: ${id}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid survey ID'
      });
    }
    
    // Find the response first to get image URLs
    const response = await SurveyResponse.findById(id);
    if (!response) {
      console.log(`❌ Survey response not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }
    
    console.log(`✅ Found survey response: ${response.leader} - ${response.shopName}`);
    
    // Collect all image URLs from all models
    const imageUrls = [];
    if (response.responses && Array.isArray(response.responses)) {
      response.responses.forEach(modelResp => {
        if (modelResp.images && Array.isArray(modelResp.images)) {
          modelResp.images.forEach(url => imageUrls.push(url));
        }
      });
    }
    
    console.log(`📸 Found ${imageUrls.length} images to delete from S3`);
    
    // Delete images from S3
    for (const url of imageUrls) {
      try {
        // Parse the S3 key from the URL
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
        // Continue deleting other images and the DB record
      }
    }
    
    // Delete the survey response from DB
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
});

// Bulk delete survey responses and their images
app.post('/api/responses/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No IDs provided' });
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
        // Collect all image URLs from all models
        const imageUrls = [];
        if (response.responses && Array.isArray(response.responses)) {
          response.responses.forEach(modelResp => {
            if (modelResp.images && Array.isArray(modelResp.images)) {
              modelResp.images.forEach(url => imageUrls.push(url));
            }
          });
        }
        // Delete images from S3
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
        // Delete the survey response from DB
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
    res.status(500).json({ success: false, message: 'Error in bulk delete', error: error.message });
  }
});

// Data management endpoints (for admin use)
app.post('/api/reload-data', async (req, res) => {
  try {
    // Clear existing data
    await Store.deleteMany({});
    await ModelPosm.deleteMany({});
    
    // Reload data
    await initializeData();
    
    res.json({
      success: true,
      message: 'Data reloaded successfully'
    });
  } catch (error) {
    console.error('Error reloading data:', error);
    res.status(500).json({
      success: false,
      message: 'Error reloading data',
      error: error.message
    });
  }
});

// Get data statistics
app.get('/api/data-stats', async (req, res) => {
  try {
    const storeCount = await Store.countDocuments();
    const modelPosmCount = await ModelPosm.countDocuments();
    const responseCount = await SurveyResponse.countDocuments();
    
    res.json({
      success: true,
      data: {
        stores: storeCount,
        modelPosm: modelPosmCount,
        responses: responseCount
      }
    });
  } catch (error) {
    console.error('Error fetching data stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching data statistics',
      error: error.message
    });
  }
});

// --- API: Model Autocomplete ---
app.get('/api/model-autocomplete', async (req, res) => {
  try {
    const q = req.query.q || '';
    // Find distinct models that match the query (case-insensitive, partial match)
    const models = await ModelPosm.find({
      model: { $regex: q, $options: 'i' }
    }).distinct('model');
    res.json(models);
  } catch (error) {
    console.error('Error in model autocomplete:', error);
    res.status(500).json({ success: false, message: 'Error searching models' });
  }
});

// --- API: Get POSM for specific model ---
app.get('/api/model-posm/:model', async (req, res) => {
  try {
    const { model } = req.params;
    const modelPosmData = await ModelPosm.find({ model: model }).lean();
    
    if (modelPosmData.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Model not found' 
      });
    }
    
    // Format the response to match the expected structure
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
});

// New server-side upload endpoint
app.post('/api/upload', multer({ storage: multer.memoryStorage() }).single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const file = req.file;
    const fileExt = file.originalname.split('.').pop();
    const s3Key = `uploads/${Date.now()}_${file.originalname}`;
    let fileBuffer = file.buffer;
    // Only resize if image type
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      fileBuffer = await reduceImageSize(file.buffer, 1024, 80);
    }
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: file.mimetype
    };
    await s3.upload(params).promise();
    const s3Url = `https://${process.env.AWS_S3_BUCKET}.s3-${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    res.json({ success: true, url: s3Url });
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    res.status(500).json({ success: false, message: 'Error uploading file to S3' });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 POSM Survey Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Survey URL: http://localhost:${PORT}`);
  console.log(`⚙️  Admin URL: http://localhost:${PORT}/admin`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});
