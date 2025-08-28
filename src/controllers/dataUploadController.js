const { Store, ModelPosm } = require('../models');
const fs = require('fs');
const csv = require('csv-parser');
const multer = require('multer');
const path = require('path');

// Configure multer for CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Helper function to parse CSV from buffer with BOM handling
const parseCSVFromBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = require('stream');
    
    // Strip UTF-8 BOM if present (0xEF, 0xBB, 0xBF)
    let cleanBuffer = buffer;
    if (buffer.length >= 3 && 
        buffer[0] === 0xEF && 
        buffer[1] === 0xBB && 
        buffer[2] === 0xBF) {
      cleanBuffer = buffer.slice(3);
      console.log('🔧 UTF-8 BOM detected and stripped from CSV file');
    }
    
    const readable = new stream.Readable();
    readable.push(cleanBuffer);
    readable.push(null);

    readable
      .pipe(csv({ skipEmptyLines: true }))
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

// Upload Stores Data
const uploadStores = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file uploaded',
      });
    }

    console.log('🏪 Starting stores upload...');
    const csvData = await parseCSVFromBuffer(req.file.buffer);

    if (csvData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is empty',
      });
    }

    const options = {
      clearExisting: req.body.clearExisting === 'true',
      skipDuplicates: req.body.skipDuplicates !== 'false',
    };

    if (options.clearExisting) {
      const deletedCount = await Store.deleteMany({});
      console.log(`🧹 Deleted ${deletedCount.deletedCount} existing stores`);
    }

    const storeData = [];
    let lineCount = 0;
    const errors = [];

    for (const row of csvData) {
      lineCount++;

      // Extract column values  
      const storeIdValue = row.store_id;
      const storeCodeValue = row.store_code;
      const storeNameValue = row.store_name;
      const channelValue = row.channel;
      const hcValue = row.hc;
      const regionValue = row.region;
      const provinceValue = row.province;
      const mcpValue = row.mcp;

      if (
        !storeIdValue ||
        !storeNameValue ||
        !channelValue ||
        hcValue === undefined ||
        !regionValue ||
        !provinceValue ||
        !mcpValue
      ) {
        errors.push(
          `Row ${lineCount}: Missing required fields (store_id, store_name, channel, hc, region, province, mcp)`
        );
        continue;
      }

      const storeDoc = {
        store_id: storeIdValue.trim(),
        store_code: storeCodeValue?.trim() || null,
        store_name: storeNameValue.trim(),
        channel: channelValue.trim(),
        hc: parseInt(hcValue) || 0,
        region: regionValue.trim(),
        province: provinceValue.trim(),
        mcp: mcpValue.trim().toUpperCase(),
        isActive: true,
        createdBy: 'csv-import',
        updatedBy: 'csv-import',
      };

      storeData.push(storeDoc);
    }

    if (storeData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid store data found in CSV',
        errors,
      });
    }

    // Remove duplicates if requested
    let finalData = storeData;
    if (options.skipDuplicates) {
      const uniqueData = [];
      const seen = new Set();

      for (const item of storeData) {
        const key = `${item.store_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueData.push(item);
        }
      }

      const duplicatesCount = storeData.length - uniqueData.length;
      if (duplicatesCount > 0) {
        console.log(`⚠️ Removed ${duplicatesCount} duplicate stores`);
      }

      finalData = uniqueData;
    }

    // Upload to database
    let uploadedCount = 0;
    let errorCount = 0;
    const batchSize = 100;

    for (let i = 0; i < finalData.length; i += batchSize) {
      const batch = finalData.slice(i, i + batchSize);

      try {
        const result = await Store.insertMany(batch, {
          ordered: false,
          rawResult: true,
        });

        uploadedCount += result.insertedCount || batch.length;
        console.log(`✅ Uploaded batch ${Math.floor(i / batchSize) + 1}: ${batch.length} stores`);
      } catch (error) {
        if (error.code === 11000) {
          // Handle duplicate key errors
          const insertedCount = error.result?.nInserted || 0;
          uploadedCount += insertedCount;
          errorCount += batch.length - insertedCount;
          console.log(
            `⚠️ Batch ${Math.floor(i / batchSize) + 1}: ${insertedCount} inserted, ${batch.length - insertedCount} duplicates skipped`
          );
        } else {
          console.error(
            `❌ Error uploading batch ${Math.floor(i / batchSize) + 1}:`,
            error.message
          );
          errorCount += batch.length;
        }
      }
    }

    const totalStores = await Store.countDocuments();
    const uniqueChannels = await Store.distinct('channel');
    const uniqueRegions = await Store.distinct('region');

    res.json({
      success: true,
      message: 'Stores uploaded successfully',
      stats: {
        uploaded: uploadedCount,
        errors: errorCount,
        totalInDatabase: totalStores,
        uniqueChannels: uniqueChannels.length,
        uniqueRegions: uniqueRegions.length,
        parseErrors: errors,
      },
    });
  } catch (error) {
    console.error('❌ Store upload failed:', error);
    res.status(500).json({
      success: false,
      message: 'Store upload failed: ' + error.message,
    });
  }
};

// Upload POSM Data (enhanced from existing script)
const uploadPOSM = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file uploaded',
      });
    }

    console.log('📦 Starting POSM upload...');
    const csvData = await parseCSVFromBuffer(req.file.buffer);

    if (csvData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is empty',
      });
    }

    const options = {
      clearExisting: req.body.clearExisting === 'true',
      skipDuplicates: req.body.skipDuplicates !== 'false',
      updateMode: req.body.updateMode || 'upsert',
    };

    if (options.clearExisting) {
      const deletedCount = await ModelPosm.deleteMany({});
      console.log(`🧹 Deleted ${deletedCount.deletedCount} existing POSM records`);
    }

    const posmData = [];
    let lineCount = 0;
    const errors = [];

    for (const row of csvData) {
      lineCount++;

      // Extract column values
      const modelValue = row.model;
      const posmValue = row.posm;
      const posmNameValue = row.posm_name || row.posmName;

      if (!modelValue || !posmValue || !posmNameValue) {
        errors.push(`Row ${lineCount}: Missing required fields (model, posm, posm_name)`);
        continue;
      }

      const posmDoc = {
        model: modelValue.trim(),
        posm: posmValue.trim(),
        posmName: posmNameValue.trim(),
      };

      posmData.push(posmDoc);
    }

    if (posmData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid POSM data found in CSV',
        errors,
      });
    }

    // Remove duplicates if requested
    let finalData = posmData;
    if (options.skipDuplicates) {
      const uniqueData = [];
      const seen = new Set();

      for (const item of posmData) {
        const key = `${item.model}-${item.posm}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueData.push(item);
        }
      }

      const duplicatesCount = posmData.length - uniqueData.length;
      if (duplicatesCount > 0) {
        console.log(`⚠️ Removed ${duplicatesCount} duplicate POSM records`);
      }

      finalData = uniqueData;
    }

    // Upload to database using the specified update mode
    let uploadedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const batchSize = 100;

    for (let i = 0; i < finalData.length; i += batchSize) {
      const batch = finalData.slice(i, i + batchSize);

      try {
        if (options.updateMode === 'upsert') {
          let batchUploaded = 0;
          let batchUpdated = 0;

          for (const item of batch) {
            const result = await ModelPosm.updateOne(
              { model: item.model, posm: item.posm },
              { $set: item },
              { upsert: true }
            );

            if (result.upsertedCount > 0) {
              batchUploaded++;
            } else if (result.modifiedCount > 0) {
              batchUpdated++;
            }
          }

          uploadedCount += batchUploaded;
          updatedCount += batchUpdated;
          console.log(
            `✅ Batch ${Math.floor(i / batchSize) + 1}: ${batchUploaded} new, ${batchUpdated} updated`
          );
        } else {
          const result = await ModelPosm.insertMany(batch, {
            ordered: false,
            rawResult: true,
          });

          uploadedCount += result.insertedCount || batch.length;
          console.log(
            `✅ Uploaded batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`
          );
        }
      } catch (error) {
        if (error.code === 11000 && options.updateMode !== 'upsert') {
          const insertedCount = error.result?.nInserted || 0;
          uploadedCount += insertedCount;
          errorCount += batch.length - insertedCount;
          console.log(
            `⚠️ Batch ${Math.floor(i / batchSize) + 1}: ${insertedCount} inserted, ${batch.length - insertedCount} duplicates skipped`
          );
        } else {
          console.error(
            `❌ Error uploading batch ${Math.floor(i / batchSize) + 1}:`,
            error.message
          );
          errorCount += batch.length;
        }
      }
    }

    const totalRecords = await ModelPosm.countDocuments();
    const uniqueModels = await ModelPosm.distinct('model');

    res.json({
      success: true,
      message: 'POSM data uploaded successfully',
      stats: {
        uploaded: uploadedCount,
        updated: updatedCount,
        errors: errorCount,
        totalInDatabase: totalRecords,
        uniqueModels: uniqueModels.length,
        parseErrors: errors,
      },
    });
  } catch (error) {
    console.error('❌ POSM upload failed:', error);
    res.status(500).json({
      success: false,
      message: 'POSM upload failed: ' + error.message,
    });
  }
};

// Get upload statistics
const getUploadStats = async (req, res) => {
  try {
    const [storeCount, posmCount, uniqueModels, uniqueChannels] = await Promise.all([
      Store.countDocuments(),
      ModelPosm.countDocuments(),
      ModelPosm.distinct('model'),
      Store.distinct('channel'),
    ]);

    res.json({
      success: true,
      stats: {
        stores: {
          total: storeCount,
          uniqueChannels: uniqueChannels.length,
        },
        posm: {
          total: posmCount,
          uniqueModels: uniqueModels.length,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error getting upload stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting upload statistics',
    });
  }
};

module.exports = {
  upload,
  uploadStores,
  uploadPOSM,
  getUploadStats,
};
