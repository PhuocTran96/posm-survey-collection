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
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
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
      updateMode: req.body.updateMode || 'upsert', // Default to upsert
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

      const storeIdValue = row.store_id;
      if (!storeIdValue) {
        errors.push(`Row ${lineCount}: Missing required field 'store_id'`);
        continue;
      }

      // Build the document with only the fields present in the CSV row
      const storeDoc = { store_id: storeIdValue.trim() };
      if (row.store_code) storeDoc.store_code = row.store_code.trim();
      if (row.store_name) storeDoc.store_name = row.store_name.trim();
      if (row.channel) storeDoc.channel = row.channel.trim();
      if (row.hc) storeDoc.hc = parseInt(row.hc) || 0;
      if (row.region) storeDoc.region = row.region.trim();
      if (row.province) storeDoc.province = row.province.trim();
      if (row.mcp) storeDoc.mcp = row.mcp.trim().toUpperCase();
      if (row.leader) storeDoc.leader = row.leader.trim();
      if (row.TDS) storeDoc.TDS = row.TDS.trim();
      
      storeDoc.updatedBy = 'csv-import';

      storeData.push(storeDoc);
    }

    if (storeData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid store data found in CSV',
        errors,
      });
    }
    
    // The rest of the logic remains the same as uploadPOSM for upserting
    let uploadedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const batchSize = 100;

    for (let i = 0; i < storeData.length; i += batchSize) {
      const batch = storeData.slice(i, i + batchSize);

      if (options.updateMode === 'upsert') {
        let batchUploaded = 0;
        let batchUpdated = 0;

        for (const item of batch) {
          const result = await Store.updateOne(
            { store_id: item.store_id },
            { $set: item, $setOnInsert: { createdBy: 'csv-import', isActive: true } },
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
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: ${batchUploaded} new, ${batchUpdated} updated`);
      } else { // Original insertMany logic
        try {
            const result = await Store.insertMany(batch, { ordered: false, rawResult: true });
            uploadedCount += result.insertedCount || batch.length;
            console.log(`✅ Uploaded batch ${Math.floor(i / batchSize) + 1}: ${batch.length} stores`);
        } catch (error) {
            if (error.code === 11000) {
                const insertedCount = error.result?.nInserted || 0;
                uploadedCount += insertedCount;
                errorCount += batch.length - insertedCount;
                console.log(`⚠️ Batch ${Math.floor(i / batchSize) + 1}: ${insertedCount} inserted, ${batch.length - insertedCount} duplicates skipped`);
            } else {
                console.error(`❌ Error uploading batch ${Math.floor(i / batchSize) + 1}:`, error.message);
                errorCount += batch.length;
            }
        }
      }
    }

    const totalStores = await Store.countDocuments();

    res.json({
      success: true,
      message: 'Stores uploaded successfully',
      stats: {
        uploaded: uploadedCount,
        updated: updatedCount,
        errors: errorCount,
        totalInDatabase: totalStores,
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
      const categoryValue = row.category || row.Category || null;

      if (!modelValue || !posmValue || !posmNameValue) {
        errors.push(`Row ${lineCount}: Missing required fields (model, posm, posm_name)`);
        continue;
      }

      const posmDoc = {
        model: modelValue.trim(),
        posm: posmValue.trim(),
        posmName: posmNameValue.trim(),
        category: categoryValue ? categoryValue.trim() : null,
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

// Export POSM Data
const exportPOSM = async (req, res) => {
  try {
    const posmData = await ModelPosm.find({}).lean();

    if (posmData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No POSM data found to export',
      });
    }

    // Convert to CSV format with UTF-8 BOM
    const csvHeaders = 'model,posm,posm_name,category\n';
    const csvRows = posmData
      .map((item) => {
        const model = item.model || '';
        const posm = item.posm || '';
        const posmName = item.posmName || '';
        const category = item.category || '';
        return `"${model}","${posm}","${posmName}","${category}"`;
      })
      .join('\n');

    const csvContent = csvHeaders + csvRows;

    // Create Buffer with UTF-8 BOM
    const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
    const csvBuffer = Buffer.from(csvContent, 'utf8');
    const csvWithBOM = Buffer.concat([BOM, csvBuffer]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="posm_export.csv"');
    res.send(csvWithBOM);
  } catch (error) {
    console.error('❌ POSM export failed:', error);
    res.status(500).json({
      success: false,
      message: 'POSM export failed: ' + error.message,
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
  exportPOSM,
  getUploadStats,
};
