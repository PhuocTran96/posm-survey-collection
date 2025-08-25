const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const { config, validateConfig } = require('./src/config');
const { connectDB, setupDatabaseEvents } = require('./src/config/database');
const routes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { protectSurveyPage, protectAdminPage, redirectIfAuthenticated } = require('./src/middleware/routeAuth');
const dataInitializer = require('./src/services/dataInitializer');

validateConfig();

const app = express();

app.use(cors());
app.use(express.json({ limit: config.upload.maxFileSize }));
app.use(express.urlencoded({ extended: true, limit: config.upload.maxFileSize }));

// Debug endpoint to count users
app.get('/debug/users/count', async (req, res) => {
  try {
    const User = require('./src/models/User');
    
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const superAdmins = await User.countDocuments({ isSuperAdmin: true });
    
    res.json({
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      byRole: usersByRole,
      admins: adminUsers,
      superAdmins: superAdmins,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to count users',
      message: error.message 
    });
  }
});

// Debug endpoint to list sample users
app.get('/debug/users/list', async (req, res) => {
  try {
    const User = require('./src/models/User');
    
    const sampleUsers = await User.find({})
      .select('userid username loginid role isActive leader')
      .limit(10)
      .sort({ createdAt: -1 });
    
    res.json({
      sampleUsers,
      count: sampleUsers.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to list users',
      message: error.message 
    });
  }
});

// Debug endpoint to find admin users
app.get('/debug/users/admins', async (req, res) => {
  try {
    const User = require('./src/models/User');
    
    const admins = await User.find({ $or: [{ role: 'admin' }, { role: 'Admin' }] })
      .select('userid username loginid role isActive isSuperAdmin')
      .sort({ createdAt: -1 });
    
    res.json({
      admins,
      count: admins.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to list admins',
      message: error.message 
    });
  }
});

// API routes first
app.use(routes);

// Public login routes
app.get('/login.html', redirectIfAuthenticated('/'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin-login.html', redirectIfAuthenticated('/admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Protected HTML routes  
app.get('/', protectSurveyPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', protectSurveyPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', protectAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', protectAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin-dashboard.html', protectAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.get('/survey-results.html', protectAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'survey-results.html'));
});

app.get('/data-upload.html', protectAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'data-upload.html'));
});

app.get('/user-management.html', protectAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user-management.html'));
});

app.get('/store-management.html', protectAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'store-management.html'));
});

// Static files (CSS, JS, images) - these should be served last
app.use(express.static('public', {
  index: false // Prevent serving index.html automatically
}));

app.use(errorHandler);
app.use('*', notFoundHandler);

const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  await mongoose.connection.close();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const startServer = async () => {
  try {
    const db = await connectDB();
    setupDatabaseEvents(db.connection);
    
    await dataInitializer.initializeData();
    
    const server = app.listen(config.server.port, () => {
      console.log(`🚀 POSM Survey Server running on port ${config.server.port}`);
      console.log(`📊 Environment: ${config.server.nodeEnv}`);
      console.log(`🌐 Survey URL: http://localhost:${config.server.port}`);
      console.log(`⚙️  Admin URL: http://localhost:${config.server.port}/admin`);
    });
    
    server.on('error', (error) => {
      console.error('Server error:', error);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();