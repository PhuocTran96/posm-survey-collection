const fs = require('fs');
const csv = require('csv-parser');
const { Store, ModelPosm } = require('../models');

const loadStoresData = async () => {
  try {
    const existingStores = await Store.countDocuments();
    if (existingStores > 0) {
      console.log(`✅ Stores data already loaded (${existingStores} records)`);
      return;
    }

    const stores = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream('stores.csv')
        .pipe(csv())
        .on('data', (row) => {
          if (stores.length === 0) {
            console.log('Store CSV columns:', Object.keys(row));
            console.log('Store CSV row sample:', row);
          }

          const name = row['Name'] || row['﻿Name'] || '';
          const province = row['Province'] || '';
          const leader = row['Leader'] || '';

          if (name.trim() && province.trim() && leader.trim()) {
            stores.push({
              name: name.trim(),
              province: province.trim(),
              leader: leader.trim(),
            });
          }
        })
        .on('end', async () => {
          try {
            await Store.insertMany(stores);
            console.log(`✅ Stores data loaded successfully: ${stores.length} records`);
            resolve();
          } catch (error) {
            console.error('❌ Error inserting stores to MongoDB:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('❌ Error reading stores.csv:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error('❌ Error loading stores data:', error);
  }
};

const loadModelPosmData = async () => {
  try {
    const existingRecords = await ModelPosm.countDocuments();
    if (existingRecords > 0) {
      console.log(`✅ Model/POSM data already loaded (${existingRecords} records)`);
      return;
    }

    const modelPosmData = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream('posm.csv')
        .pipe(csv())
        .on('data', (row) => {
          if (modelPosmData.length === 0) {
            console.log('POSM CSV columns:', Object.keys(row));
            console.log('POSM CSV row sample:', row);
          }

          const model = row['model'] || row['﻿model'] || '';
          const posm = row['posm'] || '';
          const posmName = row['posm_name'] || '';
          const category = row['category'] || row['Category'] || null;

          if (model.trim() && posm.trim() && posmName.trim()) {
            modelPosmData.push({
              model: model.trim(),
              posm: posm.trim(),
              posmName: posmName.trim(),
              category: category ? category.trim() : null,
            });
          }
        })
        .on('end', async () => {
          try {
            await ModelPosm.insertMany(modelPosmData);
            console.log(`✅ Model/POSM data loaded successfully: ${modelPosmData.length} records`);
            resolve();
          } catch (error) {
            console.error('❌ Error inserting model/POSM to MongoDB:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('❌ Error reading posm.csv:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error('❌ Error loading model/POSM data:', error);
  }
};

const initializeData = async () => {
  try {
    await loadStoresData();
    await loadModelPosmData();
    console.log('🎉 All data initialization completed');
  } catch (error) {
    console.error('❌ Data initialization failed:', error);
  }
};

module.exports = {
  loadStoresData,
  loadModelPosmData,
  initializeData,
};
