// Load environment variables
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI;

// Tạo transporter cho Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true cho port 465, false cho các port khác
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Hàm gửi email thông báo
async function sendSurveyNotification(surveyData) {
  try {
    // Chuyển đổi string thành mảng email
    const emailList = process.env.EMAIL_TO.split(',').map(email => email.trim());
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: emailList.join(', '),
      subject: '🔔 Có phản hồi survey POSM mới',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            📋 Phản hồi Survey POSM Mới
          </h2>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #007bff; margin-top: 0;">Thông tin cơ bản:</h3>
            <p><strong>👤 Leader:</strong> ${surveyData.leader}</p>
            <p><strong>🏪 Tên shop:</strong> ${surveyData.shopName}</p>
            <p><strong>⏰ Thời gian submit:</strong> ${new Date().toLocaleString('vi-VN')}</p>
          </div>

          <div style="background-color: #fff; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px;">
            <h3 style="color: #28a745; margin-top: 0;">📊 Chi tiết phản hồi:</h3>
            ${surveyData.responses.map((response, index) => `
              <div style="margin-bottom: 15px; padding: 10px; background-color: #f1f3f4; border-radius: 3px;">
                <h4 style="color: #495057; margin: 0 0 10px 0;">Model ${index + 1}: ${response.model}</h4>
                <p><strong>Tất cả POSM được chọn:</strong> ${response.allSelected ? '✅ Có' : '❌ Không'}</p>
                ${response.posmSelections && response.posmSelections.length > 0 ? `
                  <p><strong>POSM được chọn:</strong></p>
                  <ul style="margin: 5px 0;">
                    ${response.posmSelections
                      .filter(posm => posm.selected)
                      .map(posm => `<li>${posm.posmName} (${posm.posmCode})</li>`)
                      .join('')}
                  </ul>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${emailList.length} recipients:`, info.messageId);
    return { success: true, messageId: info.messageId, recipients: emailList.length };
  } catch (error) {
    console.error('❌ Error sending email notification:', error);
    return { success: false, error: error.message };
  }
}


// Hàm test kết nối email
async function testEmailConnection() {
  try {
    await transporter.verify();
    console.log('✅ Email server connection verified');
  } catch (error) {
    console.error('❌ Email server connection failed:', error.message);
    console.log('💡 Please check your SMTP credentials in .env file');
  }
}

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
  // Test email connection
  testEmailConnection();
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
    }
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

// Submit survey response với email notification
app.post('/api/submit', async (req, res) => {
  try {
    const { leader, shopName, responses } = req.body;
    
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
    
    // Gửi email thông báo
    const emailResult = await sendSurveyNotification({
      leader,
      shopName,
      responses,
      submittedAt: surveyResponse.submittedAt
    });
    
    if (emailResult.success) {
      console.log('📧 Email notification sent for survey:', surveyResponse._id);
    } else {
      console.error('❌ Failed to send email notification:', emailResult.error);
    }
    
    // Trả về response thành công (không phụ thuộc vào email)
    res.status(200).json({ 
      success: true, 
      message: 'Survey submitted successfully',
      data: {
        id: surveyResponse._id,
        submittedAt: surveyResponse.submittedAt,
        emailSent: emailResult.success,
        emailError: emailResult.success ? null : emailResult.error
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
    const responses = await SurveyResponse.find()
      .sort({ submittedAt: -1 })
      .lean();
    
    console.log(`Retrieved ${responses.length} survey responses from MongoDB`);
    res.json(responses);
  } catch (error) {
    console.error('Error fetching responses from MongoDB:', error);
    res.status(500).json({ success: false, message: 'Error fetching survey responses' });
  }
});

// Delete survey response (for admin)
app.delete('/api/responses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid survey ID'
      });
    }
    
    const deletedResponse = await SurveyResponse.findByIdAndDelete(id);
    
    if (!deletedResponse) {
      return res.status(404).json({
        success: false,
        message: 'Survey response not found'
      });
    }
    
    console.log(`Survey response deleted: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Survey response deleted successfully',
      data: {
        id: deletedResponse._id,
        leader: deletedResponse.leader,
        shopName: deletedResponse.shopName
      }
    });
  } catch (error) {
    console.error('Error deleting survey response:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting survey response',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test email endpoint (tùy chọn - để test email)
app.post('/api/test-email', async (req, res) => {
  try {
    const testData = {
      leader: 'Test Leader',
      shopName: 'Test Shop',
      responses: [{
        model: 'Test Model',
        allSelected: false,
        posmSelections: [{
          posmCode: 'TEST001',
          posmName: 'Test POSM',
          selected: true
        }]
      }]
    };
    
    const result = await sendSurveyNotification(testData);
    
    res.json({
      success: result.success,
      message: result.success ? 'Test email sent successfully' : 'Failed to send test email',
      error: result.error || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message
    });
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
  console.log(`📧 Email notifications: ${process.env.SMTP_USER ? 'Enabled' : 'Disabled (check .env)'}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});
