const { Store } = require('../models');
const csv = require('csv-parser');
const fs = require('fs');
const XLSX = require('xlsx');

/**
 * Get all stores with pagination and filters
 */
const getStores = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter object
    const filters = {};
    
    if (req.query.channel) {
      filters.channel = req.query.channel;
    }
    
    if (req.query.region) {
      filters.region = req.query.region;
    }
    
    if (req.query.province) {
      filters.province = req.query.province;
    }
    
    if (req.query.mcp) {
      filters.mcp = req.query.mcp;
    }
    
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filters.$or = [
        { store_id: searchRegex },
        { store_code: searchRegex },
        { store_name: searchRegex }
      ];
    }

    // Get total count for pagination
    const totalCount = await Store.countDocuments(filters);
    
    // Get stores with pagination
    const stores = await Store.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: stores,
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
    console.error('Get stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve stores'
    });
  }
};

/**
 * Get store by ID
 */
const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const store = await Store.findById(id);
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    res.json({
      success: true,
      data: store
    });

  } catch (error) {
    console.error('Get store by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve store'
    });
  }
};

/**
 * Create new store
 */
const createStore = async (req, res) => {
  try {
    const { store_id, store_code, store_name, channel, hc, region, province, mcp } = req.body;
    const currentUser = req.user;

    // Validation
    if (!store_id || !store_name || !channel || hc === undefined || !region || !province || !mcp) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    if (isNaN(hc) || hc < 0) {
      return res.status(400).json({
        success: false,
        message: 'HC must be a valid positive number'
      });
    }

    // Check for duplicate store_id
    const existingStore = await Store.findOne({ store_id: store_id.trim() });

    if (existingStore) {
      return res.status(400).json({
        success: false,
        message: 'Store with this ID already exists'
      });
    }

    // Create store
    const storeData = {
      store_id: store_id.trim(),
      store_code: store_code?.trim() || null,
      store_name: store_name.trim(),
      channel: channel.trim(),
      hc: parseInt(hc),
      region: region.trim(),
      province: province.trim(),
      mcp: mcp.trim().toUpperCase(),
      createdBy: currentUser?.username || 'system',
      updatedBy: currentUser?.username || 'system'
    };

    const newStore = new Store(storeData);
    await newStore.save();

    res.status(201).json({
      success: true,
      message: 'Store created successfully',
      data: newStore
    });

  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create store'
    });
  }
};

/**
 * Update store
 */
const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { store_id, store_code, store_name, channel, hc, region, province, mcp, isActive } = req.body;
    const currentUser = req.user;

    const store = await Store.findById(id);
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check for duplicate store_id if it's being changed
    if (store_id && store_id !== store.store_id) {
      const existingStore = await Store.findOne({ store_id: store_id.trim(), _id: { $ne: id } });
      if (existingStore) {
        return res.status(400).json({
          success: false,
          message: 'Store with this ID already exists'
        });
      }
      store.store_id = store_id.trim();
    }

    // Update fields
    if (store_code !== undefined) {
      store.store_code = store_code?.trim() || null;
    }
    
    if (store_name) {
      store.store_name = store_name.trim();
    }
    
    if (channel) {
      store.channel = channel.trim();
    }
    
    if (hc !== undefined) {
      if (isNaN(hc) || hc < 0) {
        return res.status(400).json({
          success: false,
          message: 'HC must be a valid positive number'
        });
      }
      store.hc = parseInt(hc);
    }
    
    if (region) {
      store.region = region.trim();
    }
    
    if (province) {
      store.province = province.trim();
    }
    
    if (mcp) {
      store.mcp = mcp.trim().toUpperCase();
    }

    if (isActive !== undefined) {
      store.isActive = isActive;
    }

    store.updatedBy = currentUser?.username || 'system';
    await store.save();

    res.json({
      success: true,
      message: 'Store updated successfully',
      data: store
    });

  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update store'
    });
  }
};

/**
 * Delete store
 */
const deleteStore = async (req, res) => {
  try {
    const { id } = req.params;

    const store = await Store.findById(id);
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    await Store.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Store deleted successfully'
    });

  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete store'
    });
  }
};

/**
 * Bulk delete stores
 */
const bulkDeleteStores = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of store IDs is required'
      });
    }

    // Delete stores
    const deleteResult = await Store.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} store(s)`,
      data: {
        deletedCount: deleteResult.deletedCount
      }
    });

  } catch (error) {
    console.error('Bulk delete stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete stores'
    });
  }
};

/**
 * Import stores from CSV
 */
const importStoresFromCSV = async (req, res) => {
  try {
    const currentUser = req.user;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }

    const results = [];
    const errors = [];
    let lineNumber = 0;

    // Process CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          lineNumber++;
          results.push({ ...data, lineNumber });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const stats = {
      total: results.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    // Process each store
    for (const storeData of results) {
      try {
        // Validate required fields
        if (!storeData.store_id || !storeData.store_name || !storeData.channel || 
            storeData.hc === undefined || !storeData.region || !storeData.province || !storeData.mcp) {
          errors.push({
            line: storeData.lineNumber,
            error: 'Missing required fields',
            data: storeData
          });
          stats.errors++;
          continue;
        }

        // Check if store exists
        const existingStore = await Store.findOne({ store_id: storeData.store_id.trim() });

        const cleanStoreData = {
          store_id: storeData.store_id.trim(),
          store_code: storeData.store_code?.trim() || null,
          store_name: storeData.store_name.trim(),
          channel: storeData.channel.trim(),
          hc: parseInt(storeData.hc) || 0,
          region: storeData.region.trim(),
          province: storeData.province.trim(),
          mcp: storeData.mcp.trim().toUpperCase(),
          createdBy: currentUser?.username || 'system',
          updatedBy: currentUser?.username || 'system'
        };

        if (existingStore) {
          // Update existing store
          Object.assign(existingStore, cleanStoreData);
          await existingStore.save();
          stats.updated++;
        } else {
          // Create new store
          const newStore = new Store(cleanStoreData);
          await newStore.save();
          stats.created++;
        }

      } catch (error) {
        errors.push({
          line: storeData.lineNumber,
          error: error.message,
          data: storeData
        });
        stats.errors++;
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: 'CSV import completed',
      data: {
        stats,
        errors: errors.slice(0, 10) // Limit errors in response
      }
    });

  } catch (error) {
    console.error('CSV import error:', error);
    
    // Clean up uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to import CSV'
    });
  }
};

/**
 * Export stores to CSV
 */
const exportStoresToCSV = async (req, res) => {
  try {
    // Get all stores
    const stores = await Store.find({})
      .sort({ createdAt: -1 });

    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare data for export
    const exportData = stores.map(store => ({
      store_id: store.store_id,
      store_code: store.store_code || '',
      store_name: store.store_name,
      channel: store.channel,
      hc: store.hc,
      region: store.region,
      province: store.province,
      mcp: store.mcp,
      isActive: store.isActive,
      createdAt: store.createdAt.toISOString(),
      createdBy: store.createdBy,
      updatedBy: store.updatedBy
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stores');

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `stores-export-${timestamp}.xlsx`;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send file
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);

  } catch (error) {
    console.error('Export stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export stores'
    });
  }
};

/**
 * Get store statistics
 */
const getStoreStats = async (req, res) => {
  try {
    const stats = await Store.aggregate([
      {
        $group: {
          _id: null,
          totalStores: { $sum: 1 },
          activeStores: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactiveStores: { $sum: { $cond: ['$isActive', 0, 1] } }
        }
      }
    ]);

    const channelStats = await Store.aggregate([
      {
        $group: {
          _id: '$channel',
          count: { $sum: 1 }
        }
      }
    ]);

    const regionStats = await Store.aggregate([
      {
        $group: {
          _id: '$region',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || { totalStores: 0, activeStores: 0, inactiveStores: 0 },
        channelDistribution: channelStats,
        regionDistribution: regionStats
      }
    });

  } catch (error) {
    console.error('Get store stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get store statistics'
    });
  }
};

module.exports = {
  getStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
  bulkDeleteStores,
  importStoresFromCSV,
  exportStoresToCSV,
  getStoreStats
};