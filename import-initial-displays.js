const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const Display = require('./src/models/Display');

// Database connection
require('dotenv').config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/posm_survey';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function importDisplaysFromCSV() {
  try {
    console.log('🚀 Starting display import from displayed.csv...');
    
    const displays = [];
    let lineNumber = 0;
    
    // Read CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream('./displayed.csv')
        .pipe(csv())
        .on('data', (data) => {
          lineNumber++;
          
          // Clean and validate data - handle BOM in column names
          const storeIdKey = Object.keys(data).find(key => key.includes('store_id')) || 'store_id';
          const store_id = data[storeIdKey]?.toString().trim();
          const model = data.model?.toString().trim();
          const is_displayed = data.is_displayed === '1' || data.is_displayed === 'true' || data.is_displayed === true;
          
          if (store_id && model) {
            displays.push({
              store_id,
              model,
              is_displayed,
              createdBy: 'system',
              updatedBy: 'system'
            });
          } else {
            console.warn(`⚠️ Line ${lineNumber}: Missing required fields - Store ID: ${store_id}, Model: ${model}`);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 Parsed ${displays.length} display records from CSV`);
    
    // Clear existing displays (optional)
    const existingCount = await Display.countDocuments();
    if (existingCount > 0) {
      console.log(`🗑️ Found ${existingCount} existing display records`);
      const shouldClear = process.argv.includes('--clear');
      if (shouldClear) {
        await Display.deleteMany({});
        console.log('✅ Cleared existing display records');
      }
    }
    
    // Import displays with upsert (update if exists, create if not)
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    for (const displayData of displays) {
      try {
        const result = await Display.findOneAndUpdate(
          { 
            store_id: displayData.store_id, 
            model: displayData.model 
          },
          displayData,
          { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true
          }
        );
        
        if (result.isNew) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error importing ${displayData.store_id} - ${displayData.model}:`, error.message);
      }
    }
    
    console.log('\n📈 Import Summary:');
    console.log(`✅ Created: ${created} records`);
    console.log(`🔄 Updated: ${updated} records`);
    console.log(`❌ Errors: ${errors} records`);
    console.log(`📊 Total processed: ${created + updated + errors} records`);
    
    // Display some statistics
    const totalDisplays = await Display.countDocuments();
    const displayedCount = await Display.countDocuments({ is_displayed: true });
    const hiddenCount = await Display.countDocuments({ is_displayed: false });
    
    console.log('\n📊 Final Statistics:');
    console.log(`📝 Total display records in database: ${totalDisplays}`);
    console.log(`👁️ Currently displayed: ${displayedCount}`);
    console.log(`🙈 Currently hidden: ${hiddenCount}`);
    
    // Show some sample data
    const sampleDisplays = await Display.find().limit(5);
    console.log('\n📋 Sample records:');
    sampleDisplays.forEach((display, index) => {
      console.log(`${index + 1}. Store: ${display.store_id}, Model: ${display.model}, Displayed: ${display.is_displayed ? '✅' : '❌'}`);
    });
    
  } catch (error) {
    console.error('💥 Import failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔐 Database connection closed');
    process.exit(0);
  }
}

// Show usage if no CSV file exists
if (!fs.existsSync('./displayed.csv')) {
  console.error('❌ displayed.csv file not found in current directory');
  console.log('\n💡 Usage:');
  console.log('  node import-initial-displays.js              # Import with upsert');
  console.log('  node import-initial-displays.js --clear      # Clear existing data first');
  process.exit(1);
}

// Run import
console.log('🎯 Display Import Tool');
console.log('='.repeat(50));
importDisplaysFromCSV();