#!/usr/bin/env node

const { config, validateConfig } = require('./src/config');
const { connectDB } = require('./src/config/database');
const { ModelPosm } = require('./src/models');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

validateConfig();

const uploadPosmData = async (csvFilePath, options = {}) => {
  const {
    clearExisting = false,
    batchSize = 100,
    skipDuplicates = true,
    updateMode = 'upsert'
  } = options;

  try {
    console.log('🚀 Starting POSM data upload...');
    
    await connectDB();

    if (clearExisting) {
      console.log('🧹 Clearing existing POSM data...');
      const deletedCount = await ModelPosm.deleteMany({});
      console.log(`✅ Deleted ${deletedCount.deletedCount} existing records`);
    }

    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found: ${csvFilePath}`);
    }

    console.log(`📂 Reading CSV file: ${csvFilePath}`);
    
    const posmData = [];
    let lineCount = 0;

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv({ skipEmptyLines: true }))
        .on('data', (row) => {
          lineCount++;
          
          const modelValue = row.model || row['﻿model'];
          const posmValue = row.posm;
          const posmNameValue = row.posm_name;
          
          if (!modelValue || !posmValue || !posmNameValue) {
            console.log(`⚠️  Skipping row ${lineCount}: Missing required fields`);
            return;
          }

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
    }

    console.log(`💾 Uploading ${posmData.length} records to MongoDB using ${updateMode} mode...`);
    let uploadedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < posmData.length; i += batchSize) {
      const batch = posmData.slice(i, i + batchSize);
      
      try {
        if (updateMode === 'upsert') {
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
          console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: ${batchUploaded} new, ${batchUpdated} updated`);
          
        } else if (updateMode === 'update') {
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
          const result = await ModelPosm.insertMany(batch, { 
            ordered: false,
            rawResult: true 
          });
          
          uploadedCount += result.insertedCount || batch.length;
          console.log(`✅ Uploaded batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
        }
        
      } catch (error) {
        if (error.code === 11000 && updateMode === 'insert') {
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
    await mongoose.connection.close();
    console.log('📤 MongoDB connection closed');
  }
};

const main = async () => {
  const args = process.argv.slice(2);
  
  const options = {
    clearExisting: args.includes('--clear'),
    batchSize: 100,
    skipDuplicates: true,
    updateMode: 'upsert'
  };

  if (args.includes('--insert-only')) {
    options.updateMode = 'insert';
  } else if (args.includes('--update-only')) {
    options.updateMode = 'update';
  } else if (args.includes('--upsert')) {
    options.updateMode = 'upsert';
  }

  let csvFilePath = args.find(arg => !arg.startsWith('--'));
  if (!csvFilePath) {
    csvFilePath = path.join(__dirname, 'posm.csv');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📋 POSM Data Upload Script

Usage: node upload-posm-data-refactored.js [CSV_FILE_PATH] [OPTIONS]

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
  node upload-posm-data-refactored.js                           # Upsert mode (default)
  node upload-posm-data-refactored.js posm.csv                  # Upsert from specific file
  node upload-posm-data-refactored.js --insert-only             # Only add new records
  node upload-posm-data-refactored.js --update-only             # Only update existing
  node upload-posm-data-refactored.js --clear --upsert          # Clear all and upsert
  node upload-posm-data-refactored.js posm.csv --update-only    # Update from file

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
};

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { uploadPosmData };