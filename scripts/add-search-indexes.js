const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function addSearchIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    console.log('📝 Adding search indexes to improve query performance...');

    // Add text index for global search across multiple fields
    console.log('Creating text search index...');
    await db.collection('surveyresponses').createIndex(
      {
        shopName: 'text',
        leader: 'text',
        submittedBy: 'text',
        'responses.model': 'text'
      },
      {
        name: 'global_text_search',
        background: true,
        weights: {
          shopName: 10,      // Higher weight for shop names
          'responses.model': 8, // High weight for models  
          submittedBy: 5,    // Medium weight for submitters
          leader: 3          // Lower weight for leaders
        }
      }
    );
    console.log('✅ Text search index created');

    // Add compound indexes for common filter combinations
    console.log('Creating compound index for shopName + submittedAt...');
    await db.collection('surveyresponses').createIndex(
      { shopName: 1, submittedAt: -1 },
      { name: 'shopName_submittedAt', background: true }
    );
    console.log('✅ shopName + submittedAt compound index created');

    console.log('Creating compound index for submittedBy + submittedAt...');
    await db.collection('surveyresponses').createIndex(
      { submittedBy: 1, submittedAt: -1 },
      { name: 'submittedBy_submittedAt', background: true }
    );
    console.log('✅ submittedBy + submittedAt compound index created');

    // Add index for date range queries
    console.log('Creating index for date queries...');
    await db.collection('surveyresponses').createIndex(
      { submittedAt: -1 },
      { name: 'submittedAt_desc', background: true }
    );
    await db.collection('surveyresponses').createIndex(
      { createdAt: -1 },
      { name: 'createdAt_desc', background: true }
    );
    console.log('✅ Date indexes created');

    // Add index for model queries (nested field)
    console.log('Creating index for model searches...');
    await db.collection('surveyresponses').createIndex(
      { 'responses.model': 1 },
      { name: 'responses_model', background: true, sparse: true }
    );
    console.log('✅ Model search index created');

    // Add index for leader queries
    console.log('Creating index for leader queries...');
    await db.collection('surveyresponses').createIndex(
      { leader: 1, submittedAt: -1 },
      { name: 'leader_submittedAt', background: true }
    );
    console.log('✅ Leader index created');

    // List all indexes to verify
    console.log('\n📋 Current indexes on surveyresponses collection:');
    const indexes = await db.collection('surveyresponses').listIndexes().toArray();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
      if (index.weights) {
        console.log(`   Weights: ${JSON.stringify(index.weights)}`);
      }
    });

    console.log('\n🎉 Search indexes added successfully!');
    console.log('📊 These indexes will improve performance for:');
    console.log('   - Global text searches across shop names, models, users');
    console.log('   - Date range filtering');
    console.log('   - Shop name filtering');  
    console.log('   - User filtering');
    console.log('   - Model searches');
    console.log('   - Combined filters with date sorting');

  } catch (error) {
    console.error('❌ Error adding search indexes:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔗 Disconnected from MongoDB');
  }
}

// Handle script termination
process.on('SIGINT', async () => {
  console.log('\n⚠️ Script interrupted');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️ Script terminated');
  await mongoose.disconnect();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  addSearchIndexes()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = addSearchIndexes;