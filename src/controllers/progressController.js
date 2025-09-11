const Display = require('../models/Display');
const Store = require('../models/Store');
const SurveyResponse = require('../models/SurveyResponse');
const ModelPosm = require('../models/ModelPosm');

/**
 * Helper functions for improved data matching
 */
function normalizeString(str) {
  if (!str) {
    return '';
  }
  return str.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeStoreId(id) {
  if (!id) {
    return '';
  }
  return id.toString().trim();
}

function normalizeModel(model) {
  if (!model) {
    return '';
  }
  return model
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ''); // Remove spaces
}

function fuzzyMatch(str1, str2, threshold = 0.8) {
  if (!str1 || !str2) {
    return 0;
  }

  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) {
    return 1;
  }

  // Jaccard similarity for fuzzy matching
  const words1 = new Set(s1.split(' '));
  const words2 = new Set(s2.split(' '));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

function isStoreMatch(
  surveyStoreId,
  surveyShopName,
  displayStoreId,
  storeMap = null,
  debug = false
) {
  const displayId = normalizeStoreId(displayStoreId);
  const surveyId = normalizeStoreId(surveyStoreId);
  const shopName = normalizeString(surveyShopName);

  if (debug) {
    console.log(`🔍 Store Match Debug:`, {
      displayStoreId,
      surveyStoreId,
      surveyShopName,
      normalized: { displayId, surveyId, shopName },
    });
  }

  // Method 0: EXACT store name match (highest priority)
  if (storeMap && displayId) {
    const storeInfo = storeMap[displayId];
    if (storeInfo && storeInfo.store_name) {
      const storeName = normalizeString(storeInfo.store_name);
      if (shopName === storeName) {
        if (debug) {
          console.log(`✅ Method 0 Match: EXACT store name match (highest priority)`);
        }
        return true; // Exact match gets highest priority
      }
    }
  }

  // Method 1: Direct ID match (if survey somehow has store ID)
  if (surveyId === displayId) {
    if (debug) {
      console.log(`✅ Method 1 Match: Direct ID match`);
    }
    return true;
  }

  // Method 2: Use store mapping for partial matches (lower priority than exact)
  if (storeMap && displayId) {
    const storeInfo = storeMap[displayId];
    if (storeInfo && storeInfo.store_name) {
      const storeName = normalizeString(storeInfo.store_name);

      if (debug) {
        console.log(`🔍 Method 2 Check:`, {
          storeInfo,
          storeName,
          shopName,
          shopIncludesStore: shopName && storeName && shopName.includes(storeName),
          storeIncludesShop: shopName && storeName && storeName.includes(shopName),
        });
      }

      // Check partial matches (lower confidence than exact)
      if (shopName && storeName && shopName.includes(storeName)) {
        if (debug) {
          console.log(`✅ Method 2 Match: Shop name includes store name`);
        }
        return true;
      }
      if (shopName && storeName && storeName.includes(shopName)) {
        if (debug) {
          console.log(`✅ Method 2 Match: Store name includes shop name`);
        }
        return true;
      }
    }
  }

  // Method 3: Check if shop name contains store ID directly (fallback)
  if (shopName && displayId && shopName.includes(displayId.toLowerCase())) {
    if (debug) {
      console.log(`✅ Method 3 Match: Shop name contains display ID`);
    }
    return true;
  }
  if (shopName && surveyId && shopName.includes(surveyId.toLowerCase())) {
    if (debug) {
      console.log(`✅ Method 3 Match: Shop name contains survey ID`);
    }
    return true;
  }

  // Method 4: Fuzzy matching with shop name words
  if (displayId && shopName) {
    const shopWords = shopName.split(' ').filter((word) => word.length > 2);
    const hasWordMatch = shopWords.some((word) => displayId.toLowerCase().includes(word));
    if (hasWordMatch) {
      if (debug) {
        console.log(`✅ Method 4 Match: Fuzzy word match`);
      }
      return true;
    }
  }

  if (debug) {
    console.log(`❌ No match found`);
  }
  return false;
}

function isModelMatch(displayModel, surveyModel) {
  if (!displayModel || !surveyModel) {
    return false;
  }

  const display = normalizeModel(displayModel);
  const survey = normalizeModel(surveyModel);

  // Exact match after normalization
  if (display === survey) {
    return true;
  }

  // One contains the other (fuzzy)
  if (display.includes(survey) || survey.includes(display)) {
    return true;
  }

  // Fuzzy match with high threshold
  return fuzzyMatch(displayModel, surveyModel, 0.8) >= 0.8;
}

/**
 * Get latest records based on date filtering
 */
function getLatestRecords(records, dateField = 'createdAt', daysBack = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return records
    .filter((record) => {
      const recordDate = new Date(record[dateField] || record.createdAt || record.updatedAt);
      return recordDate >= cutoffDate;
    })
    .sort((a, b) => {
      const dateA = new Date(a[dateField] || a.createdAt || a.updatedAt);
      const dateB = new Date(b[dateField] || b.createdAt || b.updatedAt);
      return dateB - dateA; // Most recent first
    });
}

/**
 * Get latest survey per store (avoid counting multiple surveys from same store)
 */
function getLatestSurveyPerStore(surveys) {
  const storeMap = new Map();

  // Sort by date (most recent first)
  const sortedSurveys = surveys.sort((a, b) => {
    const dateA = new Date(a.createdAt || a.submittedAt);
    const dateB = new Date(b.createdAt || b.submittedAt);
    return dateB - dateA;
  });

  // Keep only the most recent survey per store
  sortedSurveys.forEach((survey) => {
    const storeKey = survey.leader || survey.shopName || 'unknown';
    if (!storeMap.has(storeKey)) {
      storeMap.set(storeKey, survey);
    }
  });

  return Array.from(storeMap.values());
}

// Debug functionality removed - system analysis completed and working correctly

/**
 * Get POSM count for each model from ModelPosm collection
 */
async function getModelPosmCounts() {
  try {
    const modelPosms = await ModelPosm.find().select('model posm').lean();
    const modelPosmCounts = {};

    modelPosms.forEach((mp) => {
      if (!modelPosmCounts[mp.model]) {
        modelPosmCounts[mp.model] = new Set();
      }
      modelPosmCounts[mp.model].add(mp.posm);
    });

    // Convert Sets to counts
    Object.keys(modelPosmCounts).forEach((model) => {
      modelPosmCounts[model] = modelPosmCounts[model].size;
    });

    console.log('Model POSM Counts:', modelPosmCounts);
    return modelPosmCounts;
  } catch (error) {
    console.error('Error getting model POSM counts:', error);
    return {};
  }
}

/**
 * Get overall progress overview statistics
 */
const getProgressOverview = async (req, res) => {
  try {
    // 1. Calculate Total Stores from Display table
    const displayStoreIds = await Display.distinct('store_id');
    const totalStores = displayStoreIds.length;

    // 2. Calculate Total Models from Display table
    const allModelsInDisplay = await Display.distinct('model');
    const totalModels = allModelsInDisplay.length;

    // 3. Get POSM counts for each model
    const modelPosmCounts = await getModelPosmCounts();

    // 4. Calculate Total POSM from all displays and their required POSMs
    const allDisplays = await Display.find({ is_displayed: true }).select('store_id model').lean();
    let totalPOSM = 0;
    allDisplays.forEach((display) => {
      totalPOSM += modelPosmCounts[display.model] || 0;
    });

    // 5. Calculate Stores with Complete POSM using new completion logic
    const allSurveys = await SurveyResponse.find()
      .select('leader shopName responses createdAt submittedAt')
      .lean();
    const stores = await Store.find().select('store_id store_name region province channel').lean();

    // Use the improved POSM-based calculation
    const storeProgress = await calculateStoreProgressImproved(
      allDisplays,
      allSurveys,
      stores,
      modelPosmCounts
    );
    const storesWithCompletPOSM = storeProgress.filter(
      (store) => store.completionRate === 100
    ).length;

    // 6. Calculate Overall Completion percentage
    const totalRequiredPOSMsAll = storeProgress.reduce(
      (sum, store) => sum + (store.totalRequiredPOSMs || 0),
      0
    );
    const totalCompletedPOSMsAll = storeProgress.reduce(
      (sum, store) => sum + (store.completedPOSMs || 0),
      0
    );
    const overallCompletion =
      totalRequiredPOSMsAll > 0
        ? parseFloat(((totalCompletedPOSMsAll / totalRequiredPOSMsAll) * 100).toFixed(1))
        : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalStores, // Count from Display table
          storesWithCompletPOSM, // Stores with 100% POSM completion
          totalModels, // Count from Display table
          totalPOSM, // Total required POSMs across all displays
          overallCompletion, // Overall POSM completion percentage
        },
      },
    });
  } catch (error) {
    console.error('Get progress overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get progress overview',
    });
  }
};

/**
 * Get progress by individual stores
 */
const getStoreProgress = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Get displays and surveys with improved filtering
    const allDisplays = await Display.find({ is_displayed: true })
      .select('store_id model createdAt updatedAt')
      .lean();
    const allSurveys = await SurveyResponse.find()
      .select('leader shopName responses createdAt submittedAt')
      .lean();
    const stores = await Store.find().select('store_id store_name region province channel').lean();

    // Get POSM counts for each model
    const modelPosmCounts = await getModelPosmCounts();

    // Apply latest records filtering
    const recentDisplays = getLatestRecords(allDisplays, 'updatedAt', 90);
    // const latestSurveyPerStore = getLatestSurveyPerStore(allSurveys); // Flawed logic

    // Calculate store progress using improved matching, passing all surveys and POSM counts
    const storeProgress = await calculateStoreProgressImproved(
      recentDisplays,
      allSurveys,
      stores,
      modelPosmCounts
    );

    // Apply pagination
    const totalStores = storeProgress.length;
    const paginatedProgress = storeProgress.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalStores / limit);

    res.json({
      success: true,
      data: paginatedProgress,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: totalStores,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Get store progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get store progress',
    });
  }
};

/**
 * Get progress by model types
 */
const getModelProgress = async (req, res) => {
  try {
    // Get latest records with improved filtering
    const allDisplays = await Display.find({ is_displayed: true })
      .select('store_id model createdAt updatedAt')
      .lean();
    const allSurveys = await SurveyResponse.find()
      .select('leader shopName responses createdAt submittedAt')
      .lean();
    const allStores = await Store.find().select('store_id store_name').lean();

    const recentDisplays = getLatestRecords(allDisplays, 'updatedAt', 90);
    // const latestSurveyPerStore = getLatestSurveyPerStore(allSurveys); // This function is flawed

    // Create store mapping
    const storeMap = {};
    allStores.forEach((store) => {
      storeMap[store.store_id] = store;
    });

    // Group displays by model
    const modelStats = {};

    recentDisplays.forEach((display) => {
      if (!modelStats[display.model]) {
        modelStats[display.model] = {
          model: display.model,
          totalDisplays: 0,
          verifiedDisplays: 0,
          stores: new Set(),
          matchingExamples: [],
        };
      }

      modelStats[display.model].totalDisplays++;
      modelStats[display.model].stores.add(display.store_id);

      // Find all surveys that match this display's store
      const allMatchingSurveysForStore = allSurveys.filter((survey) =>
        isStoreMatch(survey.leader, survey.shopName, display.store_id, storeMap)
      );

      // If surveys are found, get the latest one and check for a model match
      if (allMatchingSurveysForStore.length > 0) {
        // Sort to find the most recent survey
        const latestSurveyForStore = allMatchingSurveysForStore.sort(
          (a, b) => new Date(b.createdAt || b.submittedAt) - new Date(a.createdAt || a.submittedAt)
        )[0];

        // Check for model match ONLY in the latest survey for that store
        const hasModelInSurvey =
          latestSurveyForStore.responses &&
          latestSurveyForStore.responses.some((response) => {
            const match = isModelMatch(display.model, response.model);
            if (match && modelStats[display.model].matchingExamples.length < 2) {
              modelStats[display.model].matchingExamples.push({
                displayModel: display.model,
                surveyModel: response.model,
                storeId: display.store_id,
              });
            }
            return match;
          });

        if (hasModelInSurvey) {
          modelStats[display.model].verifiedDisplays++;
        }
      }
    });

    // Convert to array and add completion rates
    const modelProgress = Object.values(modelStats)
      .map((model) => {
        // Count unique stores that have verified this model (completed stores)
        const completedStores = new Set();

        // Count stores that have verified displays for this model
        allDisplays.forEach((display) => {
          if (display.model === model.model) {
            const allMatchingSurveysForStore = allSurveys.filter((survey) =>
              isStoreMatch(survey.leader, survey.shopName, display.store_id, storeMap)
            );

            if (allMatchingSurveysForStore.length > 0) {
              const latestSurveyForStore = allMatchingSurveysForStore.sort(
                (a, b) =>
                  new Date(b.createdAt || b.submittedAt) - new Date(a.createdAt || a.submittedAt)
              )[0];

              const hasModelInSurvey =
                latestSurveyForStore.responses &&
                latestSurveyForStore.responses.some((response) =>
                  isModelMatch(display.model, response.model)
                );

              if (hasModelInSurvey) {
                completedStores.add(display.store_id);
              }
            }
          }
        });

        return {
          ...model,
          storeCount: model.stores.size, // Original: Total stores with this model
          completedStores: completedStores.size, // New: Stores that completed surveys for this model
          completionRate:
            model.totalDisplays > 0
              ? ((model.verifiedDisplays / model.totalDisplays) * 100).toFixed(1)
              : 0,
          stores: Array.from(model.stores), // Convert Set to Array
        };
      })
      .sort((a, b) => b.completionRate - a.completionRate);

    res.json({
      success: true,
      data: modelProgress,
    });
  } catch (error) {
    console.error('Get model progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get model progress',
    });
  }
};

/**
 * Get progress by POSM types
 */
const getPOSMProgress = async (req, res) => {
  try {
    // Get all displays with models and stores
    const allDisplays = await Display.find({ is_displayed: true }).select('store_id model').lean();
    const allSurveys = await SurveyResponse.find()
      .select('leader shopName responses createdAt submittedAt')
      .lean();
    const allStores = await Store.find().select('store_id store_name').lean();

    // Get current models from displays (models that are actually deployed)
    const currentModels = [...new Set(allDisplays.map((d) => d.model))];

    // Get all POSM types relevant to current models
    const relevantModelPosms = await ModelPosm.find({
      model: { $in: currentModels },
    })
      .select('model posm posmName')
      .lean();

    // Create store mapping
    const storeMap = {};
    allStores.forEach((store) => {
      storeMap[store.store_id] = store;
    });

    // Group POSM data by POSM type
    const posmStats = {};

    relevantModelPosms.forEach((mp) => {
      if (!posmStats[mp.posm]) {
        posmStats[mp.posm] = {
          posmType: mp.posm,
          posmName: mp.posmName,
          models: new Set(),
          storesWithModelAndPosm: new Set(), // Column 2: stores with model displays AND this POSM
          storesWithPosmInSurvey: new Set(), // Column 3: stores with this POSM in survey results
          totalRequired: 0,
          totalCompleted: 0,
        };
      }
      posmStats[mp.posm].models.add(mp.model);
    });

    // Calculate Column 2: Count stores that have displayed models AND have this POSM
    allDisplays.forEach((display) => {
      // For each POSM type
      Object.keys(posmStats).forEach((posmType) => {
        const stat = posmStats[posmType];

        // If this display's model is associated with this POSM type
        if (stat.models.has(display.model)) {
          stat.storesWithModelAndPosm.add(display.store_id);
          stat.totalRequired++;
        }
      });
    });

    // Calculate Column 3 & 4: Survey completion data using storesTable approach
    allDisplays.forEach((display) => {
      // Find all matching surveys for this store
      const allMatchingSurveysForStore = allSurveys.filter((survey) =>
        isStoreMatch(survey.leader, survey.shopName, display.store_id, storeMap)
      );

      if (allMatchingSurveysForStore.length > 0) {
        // Get latest survey for this store
        const latestSurveyForStore = allMatchingSurveysForStore.sort(
          (a, b) => new Date(b.createdAt || b.submittedAt) - new Date(a.createdAt || a.submittedAt)
        )[0];

        // Find matching survey response for this display model
        const matchingResponse =
          latestSurveyForStore.responses &&
          latestSurveyForStore.responses.find((response) =>
            isModelMatch(display.model, response.model)
          );

        if (
          matchingResponse &&
          matchingResponse.posmSelections &&
          Array.isArray(matchingResponse.posmSelections)
        ) {
          // Check each POSM selection for this specific model-store combination
          matchingResponse.posmSelections.forEach((posmSelection) => {
            // FIX: Use posmSelection.posmCode instead of posmSelection.type
            if (posmSelection.selected && posmStats[posmSelection.posmCode]) {
              // Add this store to the POSM completion count (only once per store-model-posm combination)
              posmStats[posmSelection.posmCode].storesWithPosmInSurvey.add(display.store_id);
            }
          });
        }
      }
    });

    // Convert to array and calculate completion percentages (Column 4)
    const posmProgress = Object.values(posmStats)
      .map((stat) => {
        const storesWithModelAndPosmCount = stat.storesWithModelAndPosm.size;
        const storesWithPosmInSurveyCount = stat.storesWithPosmInSurvey.size;

        // Completion percentage: (stores with POSM in survey) / (stores with model displays that require this POSM)
        const completionRate =
          storesWithModelAndPosmCount > 0
            ? parseFloat(
                ((storesWithPosmInSurveyCount / storesWithModelAndPosmCount) * 100).toFixed(1)
              )
            : 0;

        return {
          type: stat.posmType, // Column 1: POSM Type
          requiredStores: storesWithModelAndPosmCount, // Column 2: Required Stores
          completedStores: storesWithPosmInSurveyCount, // Column 3: Completed Stores
          completion: completionRate, // Column 4: Completion percentage
        };
      })
      .sort((a, b) => b.completion - a.completion);

    res.json({
      success: true,
      data: posmProgress,
    });
  } catch (error) {
    console.error('Get POSM progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get POSM progress',
    });
  }
};

/**
 * Get progress by regions
 */
const getRegionProgress = async (req, res) => {
  try {
    // Get latest records with improved filtering
    const allDisplays = await Display.find({ is_displayed: true })
      .select('store_id model createdAt updatedAt')
      .lean();
    const allSurveys = await SurveyResponse.find()
      .select('leader shopName responses createdAt submittedAt')
      .lean();
    const stores = await Store.find().select('store_id region province channel').lean();

    const recentDisplays = getLatestRecords(allDisplays, 'updatedAt', 90);
    const latestSurveyPerStore = getLatestSurveyPerStore(allSurveys);

    // Create store lookup map
    const storeMap = {};
    stores.forEach((store) => {
      storeMap[store.store_id] = store;
    });

    // Group by region
    const regionStats = {};

    recentDisplays.forEach((display) => {
      const store = storeMap[display.store_id];
      if (!store) {
        return;
      } // Skip if store info not found

      const region = store.region;

      if (!regionStats[region]) {
        regionStats[region] = {
          region,
          totalDisplays: 0,
          verifiedDisplays: 0,
          stores: new Set(),
          provinces: new Set(),
        };
      }

      regionStats[region].totalDisplays++;
      regionStats[region].stores.add(display.store_id);
      regionStats[region].provinces.add(store.province);

      // Check verification using improved matching
      const matchingSurveys = latestSurveyPerStore.filter((survey) =>
        isStoreMatch(survey.leader, survey.shopName, display.store_id, storeMap)
      );

      const hasModelInSurvey = matchingSurveys.some((survey) => {
        if (!survey.responses) {
          return false;
        }
        return survey.responses.some((response) => isModelMatch(display.model, response.model));
      });

      if (hasModelInSurvey) {
        regionStats[region].verifiedDisplays++;
      }
    });

    // Convert to array and calculate rates
    const regionProgress = Object.values(regionStats)
      .map((region) => ({
        ...region,
        storeCount: region.stores.size,
        provinceCount: region.provinces.size,
        completionRate:
          region.totalDisplays > 0
            ? ((region.verifiedDisplays / region.totalDisplays) * 100).toFixed(1)
            : 0,
        stores: Array.from(region.stores),
        provinces: Array.from(region.provinces),
      }))
      .sort((a, b) => b.completionRate - a.completionRate);

    res.json({
      success: true,
      data: regionProgress,
    });
  } catch (error) {
    console.error('Get region progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get region progress',
    });
  }
};

/**
 * Get progress timeline over time
 */
const getProgressTimeline = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30; // Default to 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get surveys within the time range
    const surveys = await SurveyResponse.find({
      createdAt: { $gte: startDate },
    })
      .select('createdAt responses leader shopName')
      .sort({ createdAt: 1 });

    // Group surveys by date
    const dailyProgress = {};

    surveys.forEach((survey) => {
      const date = survey.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!dailyProgress[date]) {
        dailyProgress[date] = {
          date,
          surveys: 0,
          models: 0,
          stores: new Set(),
        };
      }

      dailyProgress[date].surveys++;
      dailyProgress[date].models += survey.responses?.length || 0;
      dailyProgress[date].stores.add(survey.leader || survey.shopName);
    });

    // Convert to array and calculate cumulative progress
    const timelineData = Object.values(dailyProgress)
      .map((day) => ({
        ...day,
        storeCount: day.stores.size,
        stores: Array.from(day.stores),
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Add cumulative data
    let cumulativeSurveys = 0;
    let cumulativeModels = 0;
    const cumulativeStores = new Set();

    timelineData.forEach((day) => {
      cumulativeSurveys += day.surveys;
      cumulativeModels += day.models;
      day.stores.forEach((store) => cumulativeStores.add(store));

      day.cumulativeSurveys = cumulativeSurveys;
      day.cumulativeModels = cumulativeModels;
      day.cumulativeStores = cumulativeStores.size;
    });

    res.json({
      success: true,
      data: timelineData,
    });
  } catch (error) {
    console.error('Get progress timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get progress timeline',
    });
  }
};

/**
 * Get POSM deployment matrix data for AG-Grid
 */
const getPOSMMatrix = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'storeName';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

    // Get all displays, surveys, and stores
    const allDisplays = await Display.find({ is_displayed: true })
      .select('store_id model createdAt updatedAt')
      .lean();
    const allSurveys = await SurveyResponse.find()
      .select('leader shopName responses createdAt submittedAt')
      .lean();
    const stores = await Store.find().select('store_id store_name region province channel').lean();

    // Get POSM counts for each model
    const modelPosmCounts = await getModelPosmCounts();

    // Calculate store progress using existing improved logic
    const storeProgress = await calculateStoreProgressImproved(
      allDisplays,
      allSurveys,
      stores,
      modelPosmCounts
    );

    // Get all unique models from displays
    const allModels = [...new Set(allDisplays.map((d) => d.model))].sort();

    // Create matrix data structure
    const matrixData = storeProgress.map((store) => {
      const row = {
        storeId: store.storeId,
        storeName: store.storeName,
        region: store.region,
        province: store.province,
        channel: store.channel,
        totalModels: store.models.length,
        completionRate: store.completionRate,
        status: store.status,
        posmStatus: {},
      };

      // For each model, determine the POSM status
      allModels.forEach((model) => {
        if (store.models.includes(model)) {
          // Store has this model
          const modelDetails = store.posmCompletionDetails[model];
          if (modelDetails) {
            const status = getMatrixCellStatus(modelDetails.completed, modelDetails.required);
            row.posmStatus[model] = {
              completed: modelDetails.completed,
              required: modelDetails.required,
              status: status,
              percentage:
                modelDetails.required > 0
                  ? Math.round((modelDetails.completed / modelDetails.required) * 100)
                  : 0,
            };
          } else {
            // Model exists but no POSM details
            row.posmStatus[model] = {
              completed: 0,
              required: 0,
              status: 'not_applicable',
              percentage: 0,
            };
          }
        } else {
          // Store doesn't have this model
          row.posmStatus[model] = {
            completed: 0,
            required: 0,
            status: 'not_applicable',
            percentage: 0,
          };
        }
      });

      return row;
    });

    // Apply search filter
    let filteredData = matrixData;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = matrixData.filter(
        (row) =>
          row.storeName.toLowerCase().includes(searchLower) ||
          row.storeId.toLowerCase().includes(searchLower) ||
          row.region.toLowerCase().includes(searchLower) ||
          row.province.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filteredData.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return -1 * sortOrder;
      }
      if (aValue > bValue) {
        return 1 * sortOrder;
      }
      return 0;
    });

    // Apply pagination
    const totalCount = filteredData.length;
    const paginatedData = filteredData.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalCount / limit);

    // Calculate summary statistics
    const summary = {
      totalStores: matrixData.length,
      totalModels: allModels.length,
      averageCompletion:
        matrixData.reduce((sum, store) => sum + store.completionRate, 0) / matrixData.length,
      statusCounts: {
        complete: matrixData.filter((s) => s.status === 'complete').length,
        partial: matrixData.filter((s) => s.status === 'partial').length,
        not_verified: matrixData.filter((s) => s.status === 'not_verified').length,
        no_displays: matrixData.filter((s) => s.status === 'no_displays').length,
      },
    };

    res.json({
      success: true,
      data: {
        matrix: paginatedData,
        models: allModels,
        summary: summary,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Get POSM matrix error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get POSM matrix data',
    });
  }
};

/**
 * Helper function to determine matrix cell status
 */
function getMatrixCellStatus(completed, required) {
  if (required === 0) {
    return 'not_applicable';
  }
  if (completed === 0) {
    return 'none';
  }
  if (completed === required) {
    return 'complete';
  }
  return 'partial';
}

/**
 * Survey validation and quality scoring functions
 */
function calculateSurveyQuality(survey) {
  let score = 0;

  // Check if survey has responses
  if (!survey.responses || survey.responses.length === 0) {
    return 0;
  }

  // Base score for having responses
  score += 30;

  // Check for valid POSM selections
  const hasValidPosm = survey.responses.some(
    (response) => response.posmSelections && response.posmSelections.length > 0
  );
  if (hasValidPosm) {
    score += 40;
  }

  // Check for complete data (store name, model info)
  if (survey.shopName && survey.shopName.trim() !== '') {
    score += 15;
  }
  if (survey.leader && survey.leader.trim() !== '') {
    score += 10;
  }

  // Check submission completeness
  if (survey.submittedAt || survey.createdAt) {
    score += 5;
  }

  return Math.min(score, 100);
}

function validateAndCleanSurveys(surveys) {
  return surveys
    .filter((survey) => {
      // Filter out surveys with no responses
      if (!survey.responses || survey.responses.length === 0) {
        return false;
      }

      // Filter out surveys with no POSM data
      const hasValidPosm = survey.responses.some(
        (response) => response.posmSelections && response.posmSelections.length > 0
      );
      if (!hasValidPosm) {
        return false;
      }

      // Filter out surveys without store identification
      if (!survey.shopName || survey.shopName.trim() === '') {
        return false;
      }

      return true;
    })
    .map((survey) => ({
      ...survey,
      qualityScore: calculateSurveyQuality(survey),
    }))
    .filter((survey) => survey.qualityScore >= 30); // Minimum quality threshold
}

/**
 * Improved helper function to calculate store progress with better matching
 */
async function calculateStoreProgressImproved(
  displays,
  surveys,
  stores = [],
  modelPosmCounts = {}
) {
  // Validate and clean surveys first to prevent corrupt data
  const validatedSurveys = validateAndCleanSurveys(surveys);

  console.log(
    `Survey validation: ${surveys.length} raw surveys → ${validatedSurveys.length} validated surveys`
  );

  const storeStats = {};
  const storeMap = {};

  // Create store info lookup if stores provided
  if (stores && stores.length > 0) {
    stores.forEach((store) => {
      storeMap[store.store_id] = store;
    });
  }

  // Initialize store stats from displays
  displays.forEach((display) => {
    if (!storeStats[display.store_id]) {
      const storeInfo = storeMap[display.store_id];
      storeStats[display.store_id] = {
        storeId: display.store_id,
        storeName: storeInfo?.store_name || display.store_id,
        region: storeInfo?.region || 'Unknown',
        province: storeInfo?.province || 'Unknown',
        channel: storeInfo?.channel || 'Unknown',
        totalDisplays: 0,
        verifiedDisplays: 0,
        models: new Set(),
        verifiedModels: new Set(),
        totalRequiredPOSMs: 0,
        completedPOSMs: 0,
        posmCompletionDetails: {},
        lastSurveyDate: null,
        matchingDebug: [],
      };
    }

    storeStats[display.store_id].totalDisplays++;
    storeStats[display.store_id].models.add(display.model);

    // Calculate required POSMs for this model
    const posmCount = modelPosmCounts[display.model] || 0;
    storeStats[display.store_id].totalRequiredPOSMs += posmCount;

    // Initialize POSM completion tracking for this model
    if (!storeStats[display.store_id].posmCompletionDetails[display.model]) {
      storeStats[display.store_id].posmCompletionDetails[display.model] = {
        required: posmCount,
        completed: 0,
      };
    }
  });

  // Check verification against surveys using improved matching with cumulative POSM tracking
  displays.forEach((display) => {
    const allMatchingSurveysForStore = validatedSurveys.filter((survey) =>
      isStoreMatch(survey.leader, survey.shopName, display.store_id, storeMap)
    );

    // Debug specific store
    const debugStore = (storeId) => {
      const debugStores = ['cao_phong_dist_5', 'Cao Phong Dist 5'];
      return debugStores.some(
        (debug) =>
          storeId.toLowerCase().includes(debug.toLowerCase()) ||
          debug.toLowerCase().includes(storeId.toLowerCase())
      );
    };

    if (allMatchingSurveysForStore.length > 0) {
      // Use cumulative approach: track all completed POSMs from all surveys for this model
      const completedPosmSet = new Set();
      let latestSurveyDate = null;
      let hasValidResponse = false;

      // Process all surveys to build cumulative POSM completion
      allMatchingSurveysForStore.forEach((survey) => {
        const matchingResponse =
          survey.responses &&
          survey.responses.find((response) => isModelMatch(display.model, response.model));

        if (
          matchingResponse &&
          matchingResponse.posmSelections &&
          Array.isArray(matchingResponse.posmSelections)
        ) {
          hasValidResponse = true;

          // Add all selected POSMs to our cumulative set
          matchingResponse.posmSelections.forEach((posmSelection) => {
            if (posmSelection.selected) {
              completedPosmSet.add(
                posmSelection.posmCode || posmSelection.posm_id || JSON.stringify(posmSelection)
              );
            }
          });

          // Track latest survey date
          const surveyDate = new Date(survey.createdAt || survey.submittedAt);
          if (!latestSurveyDate || surveyDate > latestSurveyDate) {
            latestSurveyDate = surveyDate;
          }
        }
      });

      // Only proceed if we found valid responses
      if (hasValidResponse) {
        storeStats[display.store_id].verifiedDisplays++;
        storeStats[display.store_id].verifiedModels.add(display.model);

        // Use cumulative completed POSM count
        const completedPosmCount = completedPosmSet.size;

        if (debugStore(display.store_id)) {
          console.log(`DEBUG: Store ${display.store_id}, Model ${display.model}:`);
          console.log(`  - Found ${allMatchingSurveysForStore.length} matching surveys`);
          console.log(`  - Cumulative completed POSMs: ${completedPosmCount}`);
          console.log(`  - POSM codes: [${Array.from(completedPosmSet).join(', ')}]`);
        }

        // Update store totals
        storeStats[display.store_id].completedPOSMs += completedPosmCount;

        // Update per-model completion details
        if (storeStats[display.store_id].posmCompletionDetails[display.model]) {
          storeStats[display.store_id].posmCompletionDetails[display.model].completed =
            completedPosmCount;
        }

        // Update last survey date
        if (
          !storeStats[display.store_id].lastSurveyDate ||
          latestSurveyDate > storeStats[display.store_id].lastSurveyDate
        ) {
          storeStats[display.store_id].lastSurveyDate = latestSurveyDate;
        }

        // Add debug info using the best available data
        const latestSurvey = allMatchingSurveysForStore.sort(
          (a, b) => new Date(b.createdAt || b.submittedAt) - new Date(a.createdAt || a.submittedAt)
        )[0];

        storeStats[display.store_id].matchingDebug.push({
          displayModel: display.model,
          surveyModels: latestSurvey.responses.map((r) => r.model),
          surveyShop: latestSurvey.shopName,
          surveyLeader: latestSurvey.leader,
          completedPOSMs: completedPosmCount, // Use cumulative count
          totalSurveys: allMatchingSurveysForStore.length,
          method: 'cumulative',
        });
      }
    }
  });

  // Convert to array and calculate completion rates
  return Object.values(storeStats)
    .map((store) => {
      // Calculate POSM-based completion rate
      const posmCompletionRate =
        store.totalRequiredPOSMs > 0
          ? parseFloat(((store.completedPOSMs / store.totalRequiredPOSMs) * 100).toFixed(1))
          : 0;

      // Use POSM-based status calculation
      const posmBasedStatus = getStorePosmStatus(store.completedPOSMs, store.totalRequiredPOSMs);

      return {
        ...store,
        modelCount: store.models.size,
        verifiedModelCount: store.verifiedModels.size,
        completionRate: posmCompletionRate,
        status: posmBasedStatus,
        models: Array.from(store.models),
        verifiedModels: Array.from(store.verifiedModels),
        matchingDebug: store.matchingDebug.slice(0, 3), // Keep only first 3 debug entries
      };
    })
    .sort((a, b) => b.completionRate - a.completionRate);
}

/**
 * Helper function to calculate store progress (legacy version)
 */
async function calculateStoreProgress(displays, surveys, stores = []) {
  const storeStats = {};
  const storeMap = {};

  // Create store info lookup
  stores.forEach((store) => {
    storeMap[store.store_id] = store;
  });

  // Initialize store stats from displays
  displays.forEach((display) => {
    if (!storeStats[display.store_id]) {
      const storeInfo = storeMap[display.store_id];
      storeStats[display.store_id] = {
        storeId: display.store_id,
        storeName: storeInfo?.store_name || display.store_id,
        region: storeInfo?.region || 'Unknown',
        province: storeInfo?.province || 'Unknown',
        channel: storeInfo?.channel || 'Unknown',
        totalDisplays: 0,
        verifiedDisplays: 0,
        models: new Set(),
        verifiedModels: new Set(),
        lastSurveyDate: null,
      };
    }

    storeStats[display.store_id].totalDisplays++;
    storeStats[display.store_id].models.add(display.model);
  });

  // Check verification against surveys
  displays.forEach((display) => {
    const matchingSurveys = surveys.filter(
      (survey) =>
        survey.leader === display.store_id ||
        survey.shopName === display.store_id ||
        survey.shopName.includes(display.store_id) ||
        display.store_id.includes(survey.shopName)
    );

    const hasModelInSurvey = matchingSurveys.some((survey) => {
      const hasModel = survey.responses.some(
        (response) =>
          response.model.toLowerCase().includes(display.model.toLowerCase()) ||
          display.model.toLowerCase().includes(response.model.toLowerCase())
      );

      if (hasModel) {
        // Update last survey date
        const surveyDate = new Date(survey.createdAt || survey.submittedAt);
        if (
          !storeStats[display.store_id].lastSurveyDate ||
          surveyDate > storeStats[display.store_id].lastSurveyDate
        ) {
          storeStats[display.store_id].lastSurveyDate = surveyDate;
        }
      }

      return hasModel;
    });

    if (hasModelInSurvey) {
      storeStats[display.store_id].verifiedDisplays++;
      storeStats[display.store_id].verifiedModels.add(display.model);
    }
  });

  // Convert to array and calculate completion rates
  return Object.values(storeStats)
    .map((store) => ({
      ...store,
      modelCount: store.models.size,
      verifiedModelCount: store.verifiedModels.size,
      completionRate:
        store.totalDisplays > 0
          ? ((store.verifiedDisplays / store.totalDisplays) * 100).toFixed(1)
          : 0,
      status: getStoreStatus(store.verifiedDisplays, store.totalDisplays),
      models: Array.from(store.models),
      verifiedModels: Array.from(store.verifiedModels),
    }))
    .sort((a, b) => b.completionRate - a.completionRate);
}

/**
 * Helper function to determine store status
 */
function getStoreStatus(verified, total) {
  if (total === 0) {
    return 'no_displays';
  }
  if (verified === 0) {
    return 'not_verified';
  }
  if (verified === total) {
    return 'complete';
  }
  return 'partial';
}

/**
 * Helper function to determine store status based on POSM completion
 */
function getStorePosmStatus(completedPosms, totalRequiredPosms) {
  if (totalRequiredPosms === 0) {
    return 'no_displays';
  }
  if (completedPosms === 0) {
    return 'not_verified';
  }
  if (completedPosms === totalRequiredPosms) {
    return 'complete';
  }
  return 'partial';
}

module.exports = {
  getProgressOverview,
  getStoreProgress,
  getModelProgress,
  getPOSMProgress,
  getRegionProgress,
  getProgressTimeline,
  getPOSMMatrix,
};
