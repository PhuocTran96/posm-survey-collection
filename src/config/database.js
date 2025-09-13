const mongoose = require('mongoose');
const { config } = require('./index');

class DatabaseManager {
  constructor() {
    this.primaryConnection = null;
    this.analyticsConnection = null;
    this.isAnalyticsEnabled = config.database.analyticsEnabled;
    this.fallbackToPrimary = config.database.fallbackToPrimary;
  }

  async initializeConnections() {
    try {
      // Log configuration for debugging
      console.log('🔧 Database Configuration:');
      console.log(`   Analytics Enabled: ${this.isAnalyticsEnabled}`);
      console.log(`   Fallback to Primary: ${this.fallbackToPrimary}`);
      console.log(`   Primary URI: ${config.database.uri ? 'configured' : 'missing'}`);
      console.log(`   Analytics URI: ${config.database.analyticsUri ? 'configured' : 'missing'}`);

      // Initialize primary database connection (existing functionality)
      this.primaryConnection = await this.connectToPrimary();

      // Initialize analytics database connection if enabled
      if (this.isAnalyticsEnabled && config.database.analyticsUri) {
        console.log('🟡 Attempting to connect to analytics database...');
        try {
          this.analyticsConnection = await this.connectToAnalytics();
          console.log('✅ Dual-database mode activated successfully!');
        } catch (analyticsError) {
          console.error('❌ Analytics database connection failed:', analyticsError.message);
          if (this.fallbackToPrimary) {
            console.log('🔄 Falling back to primary database for analytics operations');
          } else {
            throw analyticsError;
          }
        }
      } else if (!this.isAnalyticsEnabled) {
        console.log(
          '📊 Analytics database disabled (ANALYTICS_DB_ENABLED=false) - using primary database'
        );
      } else if (!config.database.analyticsUri) {
        console.log(
          '📊 Analytics database not configured (MONGODB_URI_2 missing) - using primary database'
        );
      }

      return {
        primary: this.primaryConnection,
        analytics: this.analyticsConnection || this.primaryConnection,
      };
    } catch (error) {
      console.error('Database initialization failed:', error.message);
      throw error;
    }
  }

  async connectToPrimary() {
    try {
      const conn = await mongoose.connect(config.database.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10, // For real-time operations
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      });

      console.log(`🔵 Primary MongoDB Connected: ${conn.connection.host}`);
      console.log(`📋 Primary Database: ${conn.connection.name}`);
      return conn;
    } catch (error) {
      console.error('Primary MongoDB connection error:', error.message);
      throw error;
    }
  }

  async connectToAnalytics() {
    try {
      const analyticsConn = await mongoose.createConnection(config.database.analyticsUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 15, // More connections for analytics
        serverSelectionTimeoutMS: 10000, // Longer timeout for analytics
        socketTimeoutMS: 120000, // Longer socket timeout for heavy queries
        bufferCommands: false,
      });

      console.log(`🟡 Analytics MongoDB Connected: ${analyticsConn.host}`);
      console.log(`📊 Analytics Database: ${analyticsConn.name}`);

      // Set up analytics connection events
      this.setupDatabaseEvents(analyticsConn, 'Analytics');

      return analyticsConn;
    } catch (error) {
      console.error('Analytics MongoDB connection error:', error.message);
      throw error;
    }
  }

  getConnection(type = 'primary') {
    switch (type) {
      case 'analytics':
        // Return analytics connection if available, otherwise fallback to primary
        if (this.analyticsConnection && this.analyticsConnection.readyState === 1) {
          return this.analyticsConnection;
        } else if (this.fallbackToPrimary && this.primaryConnection) {
          console.log(
            '⚠️  Using primary database for analytics operation (analytics DB unavailable)'
          );
          return this.primaryConnection.connection;
        }
        throw new Error('Analytics database not available and fallback is disabled');

      case 'primary':
      default:
        if (this.primaryConnection && this.primaryConnection.connection.readyState === 1) {
          return this.primaryConnection.connection;
        }
        throw new Error('Primary database not available');
    }
  }

  setupDatabaseEvents(connection, label = '') {
    const prefix = label ? `${label} ` : '';

    connection.on('error', (error) => {
      console.error(`${prefix}MongoDB connection error:`, error.message);
    });

    connection.on('disconnected', () => {
      console.log(`${prefix}MongoDB disconnected`);
    });

    connection.on('reconnected', () => {
      console.log(`${prefix}MongoDB reconnected`);
    });

    connection.on('close', () => {
      console.log(`${prefix}MongoDB connection closed`);
    });
  }

  async healthCheck() {
    const health = {
      primary: { status: 'disconnected', error: null },
      analytics: { status: 'disconnected', error: null },
      timestamp: new Date().toISOString(),
    };

    try {
      if (this.primaryConnection && this.primaryConnection.connection.readyState === 1) {
        await this.primaryConnection.connection.db.admin().ping();
        health.primary.status = 'connected';
      }
    } catch (error) {
      health.primary.error = error.message;
    }

    try {
      if (this.analyticsConnection && this.analyticsConnection.readyState === 1) {
        await this.analyticsConnection.db.admin().ping();
        health.analytics.status = 'connected';
      } else if (!this.isAnalyticsEnabled) {
        health.analytics.status = 'disabled';
      }
    } catch (error) {
      health.analytics.error = error.message;
    }

    return health;
  }

  async close() {
    console.log('🔄 Closing database connections...');

    if (this.analyticsConnection) {
      await this.analyticsConnection.close();
      console.log('🟡 Analytics database connection closed');
    }

    if (this.primaryConnection) {
      await this.primaryConnection.disconnect();
      console.log('🔵 Primary database connection closed');
    }
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Legacy function for backward compatibility
const connectDB = async () => {
  const connections = await databaseManager.initializeConnections();

  // Setup events for primary connection (legacy support)
  databaseManager.setupDatabaseEvents(connections.primary.connection, 'Primary');

  return connections.primary;
};

// Legacy function for backward compatibility
const setupDatabaseEvents = (db) => {
  databaseManager.setupDatabaseEvents(db, 'Legacy');
};

module.exports = {
  connectDB,
  setupDatabaseEvents,
  databaseManager,
};
