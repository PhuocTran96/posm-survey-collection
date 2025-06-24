#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;

// Model and POSM Schema (matching server.js)
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

// MongoDB connection function
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
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Function to upload POSM data from CSV
async function uploadPosmData(csvFilePath, options = {}) {
  const {
    clearExisting = false,
    batchSize = 100,
    skipDuplicates = true,
    updateMode = 'upsert' // 'insert', 'update', 'upsert'
  } = options;

  try {
    console.log('🚀 Starting POSM data upload...');
    
    // Connect to MongoDB
    await connectDB();

    // Clear existing data if requested
    if (clearExisting) {
      console.log('🧹 Clearing existing POSM data...');
      const deletedCount = await ModelPosm.deleteMany({});
      console.log(`✅ Deleted ${deletedCount.deletedCount} existing records`);
    }

    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found: ${csvFilePath}`);
    }

    console.log(`📂 Reading CSV file: ${csvFilePath}`);
    
    const posmData = [];
    let lineCount = 0;    // Read and parse CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)        .pipe(csv({
          skipEmptyLines: true
        }))
        .on('data', (row) => {
          lineCount++;
          
          // Skip empty rows - handle BOM in column names
          const modelValue = row.model || row['﻿model']; // Handle BOM character
          const posmValue = row.posm;
          const posmNameValue = row.posm_name;
          
          if (!modelValue || !posmValue || !posmNameValue) {
            console.log(`⚠️  Skipping row ${lineCount}: Missing required fields`);
            return;
          }

          // Create POSM document
          const posmDoc = {
            model: modelValue.trim(),
            posm: posmValue.trim(),
            posmName: posmNameValue.trim()
          };

          posmData.push(posmDoc);
        })
        .on('end', () => {
          console.log(`✅ CSV parsing completed. ${posmData.length} valid records found`);
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ Error reading CSV file:', error);
          reject(error);
        });
    });

    if (posmData.length === 0) {
      console.log('⚠️  No valid data found in CSV file');
      return;
    }

    // Remove duplicates if requested
    if (skipDuplicates) {
      console.log('🔍 Checking for duplicates...');
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
        console.log(`⚠️  Removed ${duplicatesCount} duplicate records`);
      }
      
      posmData.length = 0;
      posmData.push(...uniqueData);
    }    // Insert data in batches with different modes
    console.log(`💾 Uploading ${posmData.length} records to MongoDB using ${updateMode} mode...`);
    let uploadedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < posmData.length; i += batchSize) {
      const batch = posmData.slice(i, i + batchSize);
      
      try {
        if (updateMode === 'upsert') {
          // Use upsert to both insert new and update existing records
          let batchUploaded = 0;
          let batchUpdated = 0;
          
          for (const item of batch) {
            const result = await ModelPosm.updateOne(
              { model: item.model, posm: item.posm }, // Filter by model and posm
              { $set: item }, // Update with new data
              { upsert: true } // Create if doesn't exist
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
          
        } else if (updateMode === 'update') {
          // Only update existing records, don't create new ones
          let batchUpdated = 0;
          
          for (const item of batch) {
            const result = await ModelPosm.updateOne(
              { model: item.model, posm: item.posm },
              { $set: item }
            );
            
            if (result.modifiedCount > 0) {
              batchUpdated++;
            }
          }
          
          updatedCount += batchUpdated;
          console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: ${batchUpdated} updated`);
          
        } else {
          // Default insert mode (original functionality)
          const result = await ModelPosm.insertMany(batch, { 
            ordered: false,
            rawResult: true 
          });
          
          uploadedCount += result.insertedCount || batch.length;
          console.log(`✅ Uploaded batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
        }
        
      } catch (error) {
        if (error.code === 11000 && updateMode === 'insert') {
          // Duplicate key error - count unique inserts (only for insert mode)
          const insertedCount = error.result?.nInserted || 0;
          uploadedCount += insertedCount;
          errorCount += batch.length - insertedCount;
          console.log(`⚠️  Batch ${Math.floor(i / batchSize) + 1}: ${insertedCount} inserted, ${batch.length - insertedCount} duplicates skipped`);
        } else {
          console.error(`❌ Error uploading batch ${Math.floor(i / batchSize) + 1}:`, error.message);
          errorCount += batch.length;
        }
      }
    }

    // Summary
    console.log('\n📊 Upload Summary:');
    if (updateMode === 'upsert') {
      console.log(`✅ New records created: ${uploadedCount}`);
      console.log(`🔄 Existing records updated: ${updatedCount}`);
      console.log(`📝 Total processed: ${uploadedCount + updatedCount}`);
    } else if (updateMode === 'update') {
      console.log(`🔄 Records updated: ${updatedCount}`);
    } else {
      console.log(`✅ Successfully uploaded: ${uploadedCount} records`);
    }
    
    if (errorCount > 0) {
      console.log(`❌ Errors/Duplicates: ${errorCount} records`);
    }
    
    // Show some statistics
    const totalRecords = await ModelPosm.countDocuments();
    const uniqueModels = await ModelPosm.distinct('model');
    
    console.log(`📈 Database Statistics:`);
    console.log(`   Total POSM records: ${totalRecords}`);
    console.log(`   Unique models: ${uniqueModels.length}`);
    
    console.log('\n🎉 POSM data upload completed successfully!');

  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('📤 MongoDB connection closed');
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const options = {
    clearExisting: args.includes('--clear'),
    batchSize: 100,
    skipDuplicates: true,
    updateMode: 'upsert' // Default to upsert mode
  };

  // Parse update mode
  if (args.includes('--insert-only')) {
    options.updateMode = 'insert';
  } else if (args.includes('--update-only')) {
    options.updateMode = 'update';
  } else if (args.includes('--upsert')) {
    options.updateMode = 'upsert';
  }

  // Get CSV file path
  let csvFilePath = args.find(arg => !arg.startsWith('--'));
  if (!csvFilePath) {
    csvFilePath = path.join(__dirname, 'posm.csv');
  }

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📋 POSM Data Upload Script

Usage: node upload-posm-data.js [CSV_FILE_PATH] [OPTIONS]

Options:
  --clear              Clear existing POSM data before upload
  --insert-only        Only insert new records (skip existing)
  --update-only        Only update existing records (don't create new)  
  --upsert             Insert new and update existing records (default)
  --help, -h           Show this help message

Update Modes:
  --insert-only:       Traditional insert mode - adds new records, skips duplicates
  --update-only:       Only updates existing records based on model+posm combination
  --upsert:            Smart mode - creates new records OR updates existing ones

Examples:
  node upload-posm-data.js                           # Upsert mode (default)
  node upload-posm-data.js posm.csv                  # Upsert from specific file
  node upload-posm-data.js --insert-only             # Only add new records
  node upload-posm-data.js --update-only             # Only update existing
  node upload-posm-data.js --clear --upsert          # Clear all and upsert
  node upload-posm-data.js posm.csv --update-only    # Update from file

CSV Format:
  model,posm,posm_name
  EWF9023P5WC,CARE_W5002,Sticker Máy giặt UC3  500
  ...
`);
    return;
  }

  console.log('🚀 POSM Data Upload Script');
  console.log('==========================');
  console.log(`📂 CSV File: ${csvFilePath}`);
  console.log(`🧹 Clear existing: ${options.clearExisting ? 'Yes' : 'No'}`);
  console.log(`🔄 Update mode: ${options.updateMode}`);
  console.log(`📦 Batch size: ${options.batchSize}`);
  console.log(`🔍 Skip duplicates: ${options.skipDuplicates ? 'Yes' : 'No'}`);
  console.log('');

  await uploadPosmData(csvFilePath, options);
}

// Run the script if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { uploadPosmData };
