const Display = require('../models/Display');
const csv = require('csv-parser');
const fs = require('fs');
const XLSX = require('xlsx');

/**
 * Get all display records with pagination and filters
 */
const getDisplays = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter object
    const filters = {};
    
    if (req.query.store_id) {
      const searchRegex = new RegExp(req.query.store_id, 'i');
      filters.store_id = searchRegex;
    }
    
    if (req.query.model) {
      const searchRegex = new RegExp(req.query.model, 'i');
      filters.model = searchRegex;
    }
    
    if (req.query.is_displayed !== undefined) {
      filters.is_displayed = req.query.is_displayed === 'true';
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filters.$or = [
        { store_id: searchRegex },
        { model: searchRegex }
      ];
    }

    // Get total count for pagination
    const totalCount = await Display.countDocuments(filters);
    
    // Get displays with pagination
    const displays = await Display.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: displays,
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
    console.error('Get displays error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve display records'
    });
  }
};

/**
 * Get display record by ID
 */
const getDisplayById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const display = await Display.findById(id);
    
    if (!display) {
      return res.status(404).json({
        success: false,
        message: 'Display record not found'
      });
    }

    res.json({
      success: true,
      data: display
    });

  } catch (error) {
    console.error('Get display by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve display record'
    });
  }
};

/**
 * Create new display record
 */
const createDisplay = async (req, res) => {
  try {
    const { store_id, model, is_displayed } = req.body;
    const currentUser = req.user;

    // Validation
    if (!store_id || !model || is_displayed === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Store ID, model, and display status are required'
      });
    }

    // Check for duplicate store_id + model combination
    const existingDisplay = await Display.findOne({
      store_id: store_id.trim(),
      model: model.trim()
    });

    if (existingDisplay) {
      return res.status(400).json({
        success: false,
        message: `Display record for store ${store_id} and model ${model} already exists`
      });
    }

    // Create display record
    const displayData = {
      store_id: store_id.trim(),
      model: model.trim(),
      is_displayed: Boolean(is_displayed),
      createdBy: currentUser?.username || 'system',
      updatedBy: currentUser?.username || 'system'
    };

    const newDisplay = new Display(displayData);
    await newDisplay.save();

    res.status(201).json({
      success: true,
      message: 'Display record created successfully',
      data: newDisplay
    });

  } catch (error) {
    console.error('Create display error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create display record'
    });
  }
};

/**
 * Update display record
 */
const updateDisplay = async (req, res) => {
  try {
    const { id } = req.params;
    const { store_id, model, is_displayed } = req.body;
    const currentUser = req.user;

    const display = await Display.findById(id);
    
    if (!display) {
      return res.status(404).json({
        success: false,
        message: 'Display record not found'
      });
    }

    // Check for duplicate if store_id or model are being changed
    if ((store_id && store_id !== display.store_id) || (model && model !== display.model)) {
      const checkStoreId = store_id || display.store_id;
      const checkModel = model || display.model;
      
      const existingDisplay = await Display.findOne({
        store_id: checkStoreId.trim(),
        model: checkModel.trim(),
        _id: { $ne: id }
      });
      
      if (existingDisplay) {
        return res.status(400).json({
          success: false,
          message: `Display record for store ${checkStoreId} and model ${checkModel} already exists`
        });
      }
    }

    // Update fields
    if (store_id !== undefined) {
      display.store_id = store_id.trim();
    }
    
    if (model !== undefined) {
      display.model = model.trim();
    }
    
    if (is_displayed !== undefined) {
      display.is_displayed = Boolean(is_displayed);
    }

    display.updatedBy = currentUser?.username || 'system';
    await display.save();

    res.json({
      success: true,
      message: 'Display record updated successfully',
      data: display
    });

  } catch (error) {
    console.error('Update display error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update display record'
    });
  }
};

/**
 * Delete display record
 */
const deleteDisplay = async (req, res) => {
  try {
    const { id } = req.params;

    const display = await Display.findById(id);
    
    if (!display) {
      return res.status(404).json({
        success: false,
        message: 'Display record not found'
      });
    }

    await Display.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Display record deleted successfully'
    });

  } catch (error) {
    console.error('Delete display error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete display record'
    });
  }
};

/**
 * Bulk delete display records
 */
const bulkDeleteDisplays = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of display record IDs is required'
      });
    }

    // Delete display records
    const deleteResult = await Display.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} display record(s)`,
      data: {
        deletedCount: deleteResult.deletedCount
      }
    });

  } catch (error) {
    console.error('Bulk delete displays error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete display records'
    });
  }
};

/**
 * Import display records from CSV
 */
const importDisplaysFromCSV = async (req, res) => {
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

    // Process each display record
    for (const displayData of results) {
      try {
        // Validate required fields
        if (!displayData.store_id || !displayData.model || displayData.is_displayed === undefined) {
          errors.push({
            line: displayData.lineNumber,
            error: 'Missing required fields (store_id, model, is_displayed)',
            data: displayData
          });
          stats.errors++;
          continue;
        }

        // Check if display record exists
        const existingDisplay = await Display.findOne({
          store_id: displayData.store_id.trim(),
          model: displayData.model.trim()
        });

        const cleanDisplayData = {
          store_id: displayData.store_id.trim(),
          model: displayData.model.trim(),
          is_displayed: displayData.is_displayed === '1' || displayData.is_displayed === 'true' || displayData.is_displayed === true,
          createdBy: currentUser?.username || 'system',
          updatedBy: currentUser?.username || 'system'
        };

        if (existingDisplay) {
          // Update existing display record
          Object.assign(existingDisplay, cleanDisplayData);
          await existingDisplay.save();
          stats.updated++;
        } else {
          // Create new display record
          const newDisplay = new Display(cleanDisplayData);
          await newDisplay.save();
          stats.created++;
        }

      } catch (error) {
        errors.push({
          line: displayData.lineNumber,
          error: error.message,
          data: displayData
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
 * Export display records to CSV
 */
const exportDisplaysToCSV = async (req, res) => {
  try {
    // Get all display records
    const displays = await Display.find({})
      .sort({ store_id: 1, model: 1 });

    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare data for export
    const exportData = displays.map(display => ({
      store_id: display.store_id,
      model: display.model,
      is_displayed: display.is_displayed ? 1 : 0,
      createdAt: display.createdAt.toISOString(),
      updatedAt: display.updatedAt.toISOString(),
      createdBy: display.createdBy,
      updatedBy: display.updatedBy
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Display Records');

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `displays-export-${timestamp}.xlsx`;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send file
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);

  } catch (error) {
    console.error('Export displays error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export display records'
    });
  }
};

/**
 * Get display statistics
 */
const getDisplayStats = async (req, res) => {
  try {
    const stats = await Display.aggregate([
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          displayedCount: { $sum: { $cond: ['$is_displayed', 1, 0] } },
          notDisplayedCount: { $sum: { $cond: ['$is_displayed', 0, 1] } }
        }
      }
    ]);

    const modelStats = await Display.aggregate([
      {
        $group: {
          _id: '$model',
          count: { $sum: 1 },
          displayed: { $sum: { $cond: ['$is_displayed', 1, 0] } }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const storeStats = await Display.aggregate([
      {
        $group: {
          _id: '$store_id',
          modelCount: { $sum: 1 },
          displayedCount: { $sum: { $cond: ['$is_displayed', 1, 0] } }
        }
      },
      {
        $group: {
          _id: null,
          totalStores: { $sum: 1 },
          avgModelsPerStore: { $avg: '$modelCount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || { totalRecords: 0, displayedCount: 0, notDisplayedCount: 0 },
        modelDistribution: modelStats,
        storeStats: storeStats[0] || { totalStores: 0, avgModelsPerStore: 0 }
      }
    });

  } catch (error) {
    console.error('Get display stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get display statistics'
    });
  }
};

module.exports = {
  getDisplays,
  getDisplayById,
  createDisplay,
  updateDisplay,
  deleteDisplay,
  bulkDeleteDisplays,
  importDisplaysFromCSV,
  exportDisplaysToCSV,
  getDisplayStats
};