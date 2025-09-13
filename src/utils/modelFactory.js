const { databaseManager } = require('../config/database');
const mongoose = require('mongoose');

/**
 * Model Factory for routing database operations to appropriate connections
 *
 * This factory ensures that:
 * - Survey operations (write/real-time) use the primary database
 * - Dashboard/analytics operations use the analytics database (read-only clone)
 * - Automatic fallback to primary database if analytics database is unavailable
 */

class ModelFactory {
  constructor() {
    this.modelCache = {
      primary: new Map(),
      analytics: new Map(),
    };
  }

  /**
   * Get a model for the specified operation type
   * @param {string} modelName - Name of the Mongoose model
   * @param {string} operationType - 'primary' for surveys/writes, 'analytics' for dashboard/reads
   * @returns {mongoose.Model} - The Mongoose model connected to appropriate database
   */
  getModel(modelName, operationType = 'primary') {
    try {
      const cacheKey = `${modelName}_${operationType}`;

      // Check cache first
      if (this.modelCache[operationType].has(cacheKey)) {
        // Only log the first few times to avoid spam
        const logKey = `${modelName}_${operationType}_logged`;
        if (!this.loggedModels) {
          this.loggedModels = new Set();
        }
        if (!this.loggedModels.has(logKey)) {
          console.log(`📋 Using cached ${operationType} model: ${modelName}`);
          this.loggedModels.add(logKey);
        }
        return this.modelCache[operationType].get(cacheKey);
      }

      // Get appropriate connection
      const connection = databaseManager.getConnection(operationType);

      // Log which database is being used
      console.log(
        `📋 Creating ${operationType} model: ${modelName} on ${connection.name || connection.db?.databaseName || 'unknown database'}`
      );

      // Create model on the specified connection
      const model = this.createModelOnConnection(modelName, connection);

      // Cache the model
      this.modelCache[operationType].set(cacheKey, model);

      return model;
    } catch (error) {
      console.error(`❌ Error creating model ${modelName} for ${operationType}:`, error.message);

      // Fallback to primary database if analytics fails
      if (operationType === 'analytics' && databaseManager.fallbackToPrimary) {
        console.log(`🔄 Falling back to primary database for model: ${modelName}`);
        return this.getModel(modelName, 'primary');
      }

      throw error;
    }
  }

  /**
   * Create a model on the specified connection
   * @param {string} modelName - Name of the model
   * @param {mongoose.Connection} connection - Database connection
   * @returns {mongoose.Model} - The created model
   */
  createModelOnConnection(modelName, connection) {
    // Import the schema for the model
    const modelSchemas = this.getModelSchemas();

    if (!modelSchemas[modelName]) {
      throw new Error(`Schema not found for model: ${modelName}`);
    }

    const schema = modelSchemas[modelName];

    // Create model on the specified connection
    return connection.model(modelName, schema);
  }

  /**
   * Get all model schemas - this centralizes schema imports
   * @returns {Object} - Object containing all schemas
   */
  getModelSchemas() {
    // Import schemas dynamically to avoid circular dependencies
    const displaySchema = require('../models/Display').schema;
    const storeSchema = require('../models/Store').schema;
    const surveyResponseSchema = require('../models/SurveyResponse').schema;
    const modelPosmSchema = require('../models/ModelPosm').schema;
    const userSchema = require('../models/User').schema;

    return {
      Display: displaySchema,
      Store: storeSchema,
      SurveyResponse: surveyResponseSchema,
      ModelPosm: modelPosmSchema,
      User: userSchema,
    };
  }

  /**
   * Helper methods for specific operation types
   */

  // Dashboard/Analytics models (use analytics database)
  getAnalyticsModel(modelName) {
    return this.getModel(modelName, 'analytics');
  }

  // Survey/User operation models (use primary database)
  getPrimaryModel(modelName) {
    return this.getModel(modelName, 'primary');
  }

  /**
   * Clear model cache (useful for testing or connection changes)
   */
  clearCache() {
    this.modelCache.primary.clear();
    this.modelCache.analytics.clear();
    console.log('🧹 Model cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      primary: {
        models: Array.from(this.modelCache.primary.keys()),
        count: this.modelCache.primary.size,
      },
      analytics: {
        models: Array.from(this.modelCache.analytics.keys()),
        count: this.modelCache.analytics.size,
      },
    };
  }
}

// Create singleton instance
const modelFactory = new ModelFactory();

/**
 * Convenience functions for common operations
 */

// Dashboard operations - use analytics database
const getDisplayModel = () => modelFactory.getAnalyticsModel('Display');
const getStoreModel = () => modelFactory.getAnalyticsModel('Store');
const getSurveyResponseModel = () => modelFactory.getAnalyticsModel('SurveyResponse');
const getModelPosmModel = () => modelFactory.getAnalyticsModel('ModelPosm');

// Survey operations - use primary database
const getUserModel = () => modelFactory.getPrimaryModel('User');
const getPrimarySurveyResponseModel = () => modelFactory.getPrimaryModel('SurveyResponse');

module.exports = {
  modelFactory,
  // Dashboard models (analytics database)
  getDisplayModel,
  getStoreModel,
  getSurveyResponseModel,
  getModelPosmModel,
  // Primary models (primary database)
  getUserModel,
  getPrimarySurveyResponseModel,
};
