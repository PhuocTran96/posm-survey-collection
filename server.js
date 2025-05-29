// Load environment variables
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/posm_survey';

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
connectDB();

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

// Data storage for CSV data
let surveyData = [];

// Load CSV data on startup
function loadCSVData() {
  surveyData = [];
  fs.createReadStream('data.csv')
    .pipe(csv())
    .on('data', (row) => {
      surveyData.push({
        shopName: row['shop name'],
        model: row['model'],
        leader: row['leader'],
        posm: row['posm'],
        posmName: row['posm name']
      });
    })
    .on('end', () => {
      console.log('CSV data loaded successfully');
      console.log(`Total records: ${surveyData.length}`);
    });
}

// Load data on startup
loadCSVData();

// API Routes

// Get all leaders
app.get('/api/leaders', (req, res) => {
  const leaders = [...new Set(surveyData.map(item => item.leader))];
  res.json(leaders);
});

// Get shops by leader
app.get('/api/shops/:leader', (req, res) => {
  const leader = decodeURIComponent(req.params.leader);
  const shops = [...new Set(surveyData
    .filter(item => item.leader === leader)
    .map(item => item.shopName))];
  res.json(shops);
});

// Get models and POSM by leader and shop
app.get('/api/models/:leader/:shopName', (req, res) => {
  const leader = decodeURIComponent(req.params.leader);
  const shopName = decodeURIComponent(req.params.shopName);
  
  const filteredData = surveyData.filter(item => 
    item.leader === leader && item.shopName === shopName
  );
  
  // Group by model
  const modelGroups = {};
  filteredData.forEach(item => {
    if (!modelGroups[item.model]) {
      modelGroups[item.model] = [];
    }
    modelGroups[item.model].push({
      posmCode: item.posm,
      posmName: item.posmName
    });
  });
  
  res.json(modelGroups);
});

// Submit survey response
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
    console.log(`Survey submitted to MongoDB: ${leader} - ${shopName}`);
    res.json({ success: true, message: 'Survey submitted successfully' });
  } catch (error) {
    console.error('Error saving survey to MongoDB:', error);
    res.status(500).json({ success: false, message: 'Error saving survey to database' });
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

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
  console.log(`⚙️  Admin URL: http://localhost:${PORT}/admin.html`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});