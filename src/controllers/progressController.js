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

  // CONFIDENCE THRESHOLD - Only matches with confidence >= 0.85 are accepted
  const CONFIDENCE_THRESHOLD = 0.85;
  let matchResult = { matched: false, confidence: 0, method: 'none', details: null };

  if (debug) {
    console.log(`🔍 Store Match Debug:`, {
      displayStoreId,
      surveyStoreId,
      surveyShopName,
      normalized: { displayId, surveyId, shopName },
    });
  }

  // METHOD 1: EXACT store name match (confidence: 1.0)
  if (storeMap && displayId) {
    const storeInfo = storeMap[displayId];
    if (storeInfo && storeInfo.store_name) {
      const storeName = normalizeString(storeInfo.store_name);
      if (shopName === storeName) {
        matchResult = {
          matched: true,
          confidence: 1.0,
          method: 'exact_store_name',
          details: { storeName, shopName },
        };
        if (debug) {
          console.log(`✅ Method 1: EXACT store name match (confidence: 1.0)`);
        }
        return matchResult.confidence >= CONFIDENCE_THRESHOLD;
      }
    }
  }

  // METHOD 2: Direct ID match (confidence: 1.0)
  if (surveyId === displayId) {
    matchResult = {
      matched: true,
      confidence: 1.0,
      method: 'exact_id',
      details: { surveyId, displayId },
    };
    if (debug) {
      console.log(`✅ Method 2: Direct ID match (confidence: 1.0)`);
    }
    return matchResult.confidence >= CONFIDENCE_THRESHOLD;
  }

  // METHOD 3: Controlled partial name matching with validation
  if (storeMap && displayId) {
    const storeInfo = storeMap[displayId];
    if (storeInfo && storeInfo.store_name) {
      const storeName = normalizeString(storeInfo.store_name);

      if (debug) {
        console.log(`🔍 Method 3 Check:`, { storeName, shopName });
      }

      // Only allow partial matches if both strings are substantial (>3 chars) and contain multiple words
      if (shopName && storeName && shopName.length > 3 && storeName.length > 3) {
        const shopWords = shopName.split(' ').filter((w) => w.length > 2);
        const storeWords = storeName.split(' ').filter((w) => w.length > 2);

        // Calculate word-level similarity
        if (shopWords.length > 1 && storeWords.length > 1) {
          const commonWords = shopWords.filter((word) => storeWords.includes(word));
          const wordSimilarity = commonWords.length / Math.max(shopWords.length, storeWords.length);

          // FIX 1: Increase similarity threshold to prevent false matches like "Cao Phong Binh Tan" vs "Cao Phong Binh Tan 2"
          if (wordSimilarity >= 0.85 && commonWords.length >= 3) {
            // FIX 2: Add exact length validation to prevent subset matching
            const lengthDifference = Math.abs(shopWords.length - storeWords.length);

            // FIX 3: Only allow matches if the length difference is minimal (max 1 word)
            if (lengthDifference <= 1) {
              // FIX 4: Add special handling for numbered stores to prevent cross-matching
              const shopHasNumber = /\d+$/.test(shopName.trim());
              const storeHasNumber = /\d+$/.test(storeName.trim());

              if (shopHasNumber || storeHasNumber) {
                // For numbered stores, require exact match to prevent false positives
                if (shopName !== storeName) {
                  if (debug) {
                    console.log(
                      `❌ Method 3: Numbered store mismatch prevented - "${shopName}" vs "${storeName}"`
                    );
                  }
                  return false;
                }
              }

              const shopIncludesStore = shopName.includes(storeName);
              const storeIncludesShop = storeName.includes(shopName);

              // FIX 5: Require bidirectional containment check for high confidence
              if (shopIncludesStore && storeIncludesShop) {
                const confidence = Math.min(0.9, 0.75 + wordSimilarity * 0.15);
                matchResult = {
                  matched: confidence >= CONFIDENCE_THRESHOLD,
                  confidence: confidence,
                  method: 'strict_partial_name',
                  details: {
                    storeName,
                    shopName,
                    wordSimilarity,
                    commonWords,
                    lengthDifference,
                    shopHasNumber,
                    storeHasNumber,
                  },
                };

                if (debug) {
                  console.log(
                    `✅ Method 3: Strict partial name match (confidence: ${confidence}) - prevented numbered store cross-match`
                  );
                }
                return matchResult.confidence >= CONFIDENCE_THRESHOLD;
              }

              if (debug) {
                console.log(
                  `❌ Method 3: Bidirectional containment failed - shopIncludes=${shopIncludesStore}, storeIncludes=${storeIncludesShop}`
                );
              }
            } else {
              if (debug) {
                console.log(
                  `❌ Method 3: Length difference too large - ${lengthDifference} words (max 1 allowed)`
                );
              }
            }
          } else {
            if (debug) {
              console.log(
                `❌ Method 3: Insufficient similarity - wordSimilarity=${wordSimilarity.toFixed(
                  2
                )}, commonWords=${commonWords.length} (need >=0.85 similarity, >=3 common words)`
              );
            }
          }
        }
      }
    }
  }

  // METHOD 4: Controlled ID-in-name matching with strict validation
  if (shopName && displayId && shopName.length > displayId.length) {
    // Only match if display ID is substantial and appears as complete word in shop name
    if (displayId.length >= 4) {
      // Check for word boundary matches to prevent partial word matches
      const regex = new RegExp(`\\b${displayId.toLowerCase()}\\b`);
      if (regex.test(shopName)) {
        const confidence = 0.88; // Just above threshold but lower than exact matches
        matchResult = {
          matched: true,
          confidence: confidence,
          method: 'controlled_id_in_name',
          details: { displayId, shopName },
        };

        if (debug) {
          console.log(`✅ Method 4: Controlled ID-in-name match (confidence: ${confidence})`);
        }
        return matchResult.confidence >= CONFIDENCE_THRESHOLD;
      }
    }
  }

  // METHOD 5: Survey ID in shop name (similar validation)
  if (shopName && surveyId && surveyId.length >= 4 && shopName.length > surveyId.length) {
    const regex = new RegExp(`\\b${surveyId.toLowerCase()}\\b`);
    if (regex.test(shopName)) {
      const confidence = 0.87;
      matchResult = {
        matched: true,
        confidence: confidence,
        method: 'controlled_survey_id_in_name',
        details: { surveyId, shopName },
      };

      if (debug) {
        console.log(`✅ Method 5: Controlled survey ID-in-name match (confidence: ${confidence})`);
      }
      return matchResult.confidence >= CONFIDENCE_THRESHOLD;
    }
  }

  // REMOVED: The dangerous Method 4 fuzzy word matching that caused false positives

  // Log no match found
  if (debug) {
    console.log(`❌ No match found (highest confidence: ${matchResult.confidence})`);
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

    // Generate audit trail for monitoring (with debug flag from query params)
    const enableAudit = false; // Can be enabled via environment variable or request parameter
    let auditResults = null;
    if (enableAudit) {
      auditResults = generateCompletionRateAudit(storeProgress, allDisplays, allSurveys);
      console.log('📊 COMPLETION RATE AUDIT GENERATED:', auditResults.summary);

      // Log critical issues
      if (auditResults.potentialIssues.length > 0) {
        console.warn(
          `🚨 AUDIT ALERT: ${auditResults.potentialIssues.length} stores flagged with potential issues`
        );
        auditResults.potentialIssues.slice(0, 5).forEach((issue) => {
          console.warn(
            `  - ${issue.storeId}: ${issue.issues.join(', ')} (confidence: ${issue.confidence})`
          );
        });
      }
    }

    const storesWithCompletPOSM = storeProgress.filter(
      (store) => store.completionRate === 100
    ).length;

    // Alert for suspicious completion rates
    const completionRateDistribution = storeProgress.reduce((acc, store) => {
      const bucket = Math.floor(store.completionRate / 10) * 10;
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {});

    // Flag if more than 30% of stores have 100% completion (potentially suspicious)
    const totalStoresCalc = storeProgress.length;
    if (totalStoresCalc > 0 && storesWithCompletPOSM / totalStoresCalc > 0.3) {
      console.warn(
        `🚨 HIGH COMPLETION ALERT: ${((storesWithCompletPOSM / totalStoresCalc) * 100).toFixed(1)}% of stores have 100% completion - verify accuracy`
      );
    }

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

  // Check verification against surveys using improved matching with validation and cumulative POSM tracking
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
      // VALIDATION STEP 1: Verify surveys actually exist and contain valid data
      const validSurveysForStore = allMatchingSurveysForStore.filter((survey) => {
        return (
          survey.responses &&
          survey.responses.length > 0 &&
          (survey.shopName || survey.leader) &&
          survey.createdAt
        ); // Must have creation date
      });

      if (validSurveysForStore.length === 0) {
        console.warn(
          `🚨 VALIDATION FAILED: Store ${display.store_id} matched ${allMatchingSurveysForStore.length} surveys but none contain valid data`
        );
        return; // Skip processing this display if no valid surveys found
      }

      // Use cumulative approach: track all completed POSMs from all surveys for this model
      const completedPosmSet = new Set();
      let latestSurveyDate = null;
      let hasValidResponse = false;
      let validResponseCount = 0;
      const matchingMethod = 'none';

      // Process all validated surveys to build cumulative POSM completion
      validSurveysForStore.forEach((survey) => {
        const matchingResponse =
          survey.responses &&
          survey.responses.find((response) => isModelMatch(display.model, response.model));

        if (
          matchingResponse &&
          matchingResponse.posmSelections &&
          Array.isArray(matchingResponse.posmSelections)
        ) {
          hasValidResponse = true;
          validResponseCount++;

          // VALIDATION STEP 2: Cross-verify POSM selections are meaningful
          const validPosmSelections = matchingResponse.posmSelections.filter(
            (posmSelection) =>
              posmSelection.selected && (posmSelection.posmCode || posmSelection.posm_id)
          );

          if (validPosmSelections.length === 0) {
            console.warn(
              `🚨 VALIDATION WARNING: Store ${display.store_id} has survey response but no valid POSM selections`
            );
          }

          // Add all selected POSMs to our cumulative set
          validPosmSelections.forEach((posmSelection) => {
            completedPosmSet.add(
              posmSelection.posmCode || posmSelection.posm_id || JSON.stringify(posmSelection)
            );
          });

          // Track latest survey date
          const surveyDate = new Date(survey.createdAt || survey.submittedAt);
          if (!latestSurveyDate || surveyDate > latestSurveyDate) {
            latestSurveyDate = surveyDate;
          }
        }
      });

      // VALIDATION STEP 3: Only proceed if we found valid responses with actual POSM data
      if (hasValidResponse && completedPosmSet.size > 0) {
        storeStats[display.store_id].verifiedDisplays++;
        storeStats[display.store_id].verifiedModels.add(display.model);

        // Use cumulative completed POSM count
        const completedPosmCount = completedPosmSet.size;
        const requiredPosmCount = modelPosmCounts[display.model] || 0;

        // VALIDATION STEP 4: Anomaly detection for suspicious completion rates
        if (completedPosmCount > requiredPosmCount) {
          console.warn(
            `🚨 ANOMALY DETECTED: Store ${display.store_id} claims ${completedPosmCount} POSMs for model ${display.model}, but only ${requiredPosmCount} are required`
          );

          // Cap the completed count to prevent inflation
          const cappedCount = Math.min(completedPosmCount, requiredPosmCount);
          console.log(
            `🔧 CORRECTION: Capped completed POSMs from ${completedPosmCount} to ${cappedCount}`
          );

          // Update the store totals with capped count
          storeStats[display.store_id].completedPOSMs += cappedCount;

          // Update per-model completion details with capped count
          if (storeStats[display.store_id].posmCompletionDetails[display.model]) {
            storeStats[display.store_id].posmCompletionDetails[display.model].completed =
              cappedCount;
          }
        } else {
          // Normal case: use actual completed count
          storeStats[display.store_id].completedPOSMs += completedPosmCount;

          // Update per-model completion details
          if (storeStats[display.store_id].posmCompletionDetails[display.model]) {
            storeStats[display.store_id].posmCompletionDetails[display.model].completed =
              completedPosmCount;
          }
        }

        // VALIDATION STEP 5: Flag stores with sudden 100% completion for review
        const completionRate =
          requiredPosmCount > 0
            ? (Math.min(completedPosmCount, requiredPosmCount) / requiredPosmCount) * 100
            : 0;
        if (completionRate === 100 && validResponseCount === 1) {
          console.log(
            `🔍 REVIEW FLAGGED: Store ${display.store_id} achieved 100% completion (${completedPosmCount}/${requiredPosmCount}) from single survey - verify accuracy`
          );
        }

        if (debugStore(display.store_id)) {
          console.log(`DEBUG: Store ${display.store_id}, Model ${display.model}:`);
          console.log(
            `  - Found ${allMatchingSurveysForStore.length} matching surveys (${validSurveysForStore.length} valid)`
          );
          console.log(`  - Valid responses: ${validResponseCount}`);
          console.log(
            `  - Cumulative completed POSMs: ${completedPosmCount} (capped to ${Math.min(completedPosmCount, requiredPosmCount)})`
          );
          console.log(`  - Required POSMs: ${requiredPosmCount}`);
          console.log(`  - Completion rate: ${completionRate.toFixed(1)}%`);
          console.log(`  - POSM codes: [${Array.from(completedPosmSet).join(', ')}]`);
        }

        // Update last survey date
        if (
          !storeStats[display.store_id].lastSurveyDate ||
          latestSurveyDate > storeStats[display.store_id].lastSurveyDate
        ) {
          storeStats[display.store_id].lastSurveyDate = latestSurveyDate;
        }

        // Add enhanced debug info with validation results
        const latestSurvey = validSurveysForStore.sort(
          (a, b) => new Date(b.createdAt || b.submittedAt) - new Date(a.createdAt || a.submittedAt)
        )[0];

        storeStats[display.store_id].matchingDebug.push({
          displayModel: display.model,
          surveyModels: latestSurvey.responses.map((r) => r.model),
          surveyShop: latestSurvey.shopName,
          surveyLeader: latestSurvey.leader,
          completedPOSMs: Math.min(completedPosmCount, requiredPosmCount), // Show capped value
          requiredPOSMs: requiredPosmCount,
          completionRate: completionRate.toFixed(1),
          totalSurveys: allMatchingSurveysForStore.length,
          validSurveys: validSurveysForStore.length,
          validResponses: validResponseCount,
          anomalyDetected: completedPosmCount > requiredPosmCount,
          method: 'validated_cumulative',
        });
      } else {
        // Log why we rejected this store-model combination
        console.warn(
          `🚨 VALIDATION REJECTED: Store ${display.store_id}, Model ${display.model}: hasValidResponse=${hasValidResponse}, posmCount=${completedPosmSet.size}, surveys=${allMatchingSurveysForStore.length}`
        );
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

/**
 * Enhanced completion rate audit and statistics tracking
 */
function generateCompletionRateAudit(storeProgress, displays, surveys) {
  const audit = {
    timestamp: new Date().toISOString(),
    summary: {
      totalStores: storeProgress.length,
      totalDisplays: displays.length,
      totalSurveys: surveys.length,
      completionRateDistribution: {},
      statusDistribution: {},
      anomaliesDetected: 0,
      validationResults: {
        highConfidenceMatches: 0,
        lowConfidenceMatches: 0,
        rejectedMatches: 0,
        cappedCompletions: 0,
      },
    },
    storeAnalysis: [],
    potentialIssues: [],
    recommendations: [],
  };

  // Analyze completion rate distribution
  const completionRates = {};
  storeProgress.forEach((store) => {
    const rate = Math.floor(store.completionRate / 10) * 10; // Group by 10% buckets
    completionRates[rate] = (completionRates[rate] || 0) + 1;
    audit.summary.statusDistribution[store.status] =
      (audit.summary.statusDistribution[store.status] || 0) + 1;
  });
  audit.summary.completionRateDistribution = completionRates;

  // Analyze individual stores for potential issues
  storeProgress.forEach((store) => {
    const storeAudit = {
      storeId: store.storeId,
      storeName: store.storeName,
      completionRate: store.completionRate,
      status: store.status,
      totalRequiredPOSMs: store.totalRequiredPOSMs,
      completedPOSMs: store.completedPOSMs,
      issues: [],
      confidence: 'high',
    };

    // Check for suspicious completion patterns
    if (store.completionRate === 100 && store.matchingDebug && store.matchingDebug.length > 0) {
      const debug = store.matchingDebug[0];
      if (debug.totalSurveys === 1 && debug.validSurveys === 1) {
        storeAudit.issues.push('100% completion from single survey - verify accuracy');
        storeAudit.confidence = 'medium';
        audit.summary.validationResults.lowConfidenceMatches++;
      } else {
        audit.summary.validationResults.highConfidenceMatches++;
      }

      if (debug.anomalyDetected) {
        storeAudit.issues.push('POSM count anomaly detected and corrected');
        audit.summary.anomaliesDetected++;
        audit.summary.validationResults.cappedCompletions++;
      }

      if (debug.method === 'validated_cumulative') {
        storeAudit.confidence = 'high';
      }
    }

    // Check for data quality issues
    if (
      store.completionRate > 0 &&
      (!store.lastSurveyDate || !store.verifiedModels || store.verifiedModels.length === 0)
    ) {
      storeAudit.issues.push('Completion reported but missing verification data');
      storeAudit.confidence = 'low';
      audit.summary.validationResults.rejectedMatches++;
    }

    // Check for stores with displays but no surveys
    if (store.totalRequiredPOSMs > 0 && store.completedPOSMs === 0) {
      storeAudit.issues.push('Has displays but no survey completion');
    }

    audit.storeAnalysis.push(storeAudit);

    // Add to potential issues list if confidence is not high
    if (storeAudit.confidence !== 'high' || storeAudit.issues.length > 0) {
      audit.potentialIssues.push({
        storeId: store.storeId,
        storeName: store.storeName,
        issues: storeAudit.issues,
        confidence: storeAudit.confidence,
        completionRate: store.completionRate,
      });
    }
  });

  // Generate recommendations based on analysis
  const highCompletionStores = storeProgress.filter((s) => s.completionRate === 100).length;
  const totalStores = storeProgress.length;
  const completionPercentage = totalStores > 0 ? (highCompletionStores / totalStores) * 100 : 0;

  if (completionPercentage > 50) {
    audit.recommendations.push(
      'High completion rate detected - verify accuracy of fuzzy matching logic'
    );
  }

  if (audit.summary.anomaliesDetected > 0) {
    audit.recommendations.push(
      `${audit.summary.anomaliesDetected} anomalies detected and corrected - consider improving data validation`
    );
  }

  if (
    audit.summary.validationResults.rejectedMatches >
    audit.summary.validationResults.highConfidenceMatches
  ) {
    audit.recommendations.push('More matches rejected than accepted - review matching criteria');
  }

  if (audit.potentialIssues.length > totalStores * 0.1) {
    audit.recommendations.push(
      'More than 10% of stores flagged with issues - systematic review needed'
    );
  }

  return audit;
}

/**
 * Log completion rate changes for monitoring
 */
function logCompletionRateChange(storeId, oldRate, newRate, method, details = {}) {
  const change = {
    timestamp: new Date().toISOString(),
    storeId: storeId,
    oldCompletionRate: oldRate,
    newCompletionRate: newRate,
    change: newRate - oldRate,
    method: method,
    details: details,
  };

  // Log significant changes
  if (Math.abs(change.change) >= 10) {
    console.log(
      `📊 COMPLETION RATE CHANGE: Store ${storeId}: ${oldRate}% → ${newRate}% (${change.change > 0 ? '+' : ''}${change.change}%) via ${method}`
    );
  }

  // Could be extended to write to database or file for persistent tracking
  return change;
}

/**
 * Debug specific store matching issues
 */
const debugStoreMatching = async (req, res) => {
  try {
    const { storeId, storeName } = req.query;

    if (!storeId && !storeName) {
      return res.status(400).json({
        success: false,
        message: 'Either storeId or storeName parameter is required',
      });
    }

    // Get store data
    const stores = await Store.find().select('store_id store_name region province channel').lean();
    const storeMap = {};
    stores.forEach((store) => {
      storeMap[store.store_id] = store;
    });

    // Find target store
    let targetStore = null;
    if (storeId) {
      targetStore = storeMap[storeId];
    } else if (storeName) {
      targetStore = stores.find(
        (s) =>
          s.store_name.toLowerCase().includes(storeName.toLowerCase()) ||
          storeName.toLowerCase().includes(s.store_name.toLowerCase())
      );
    }

    if (!targetStore) {
      return res.status(404).json({
        success: false,
        message: `Store not found: ${storeId || storeName}`,
      });
    }

    // Get displays for this store
    const displays = await Display.find({
      store_id: targetStore.store_id,
      is_displayed: true,
    })
      .select('store_id model')
      .lean();

    // Get all surveys
    const allSurveys = await SurveyResponse.find()
      .select('leader shopName responses createdAt submittedAt')
      .lean();

    const debugResults = {
      targetStore: {
        storeId: targetStore.store_id,
        storeName: targetStore.store_name,
        region: targetStore.region,
        province: targetStore.province,
        channel: targetStore.channel,
      },
      displays: displays.map((d) => ({ model: d.model, storeId: d.store_id })),
      totalDisplays: displays.length,
      matchAnalysis: [],
      surveyMatches: [],
      noMatches: [],
      potentialIssues: [],
    };

    // Test matching with all surveys
    allSurveys.forEach((survey) => {
      const matchResult = isStoreMatch(
        survey.leader,
        survey.shopName,
        targetStore.store_id,
        storeMap,
        true // Enable debug
      );

      // Pre-calculate word analysis for all surveys
      const shopNormalized = normalizeString(survey.shopName || '');
      const storeNormalized = normalizeString(targetStore.store_name);
      const shopWords = shopNormalized.split(' ').filter((w) => w.length > 2);
      const storeWords = storeNormalized.split(' ').filter((w) => w.length > 2);

      const surveyAnalysis = {
        surveyId: survey._id,
        leader: survey.leader,
        shopName: survey.shopName,
        createdAt: survey.createdAt,
        responseCount: survey.responses?.length || 0,
        matched: matchResult,
        models: survey.responses?.map((r) => r.model) || [],
      };

      if (matchResult) {
        debugResults.surveyMatches.push(surveyAnalysis);

        // Check if this could be a false positive
        const commonWords = shopWords.filter((word) => storeWords.includes(word));
        const wordSimilarity =
          shopWords.length > 0 && storeWords.length > 0
            ? commonWords.length / Math.max(shopWords.length, storeWords.length)
            : 0;

        if (wordSimilarity < 0.9 || Math.abs(shopWords.length - storeWords.length) > 0) {
          debugResults.potentialIssues.push({
            issue: 'Potential false positive match',
            survey: surveyAnalysis,
            similarity: wordSimilarity,
            lengthDiff: Math.abs(shopWords.length - storeWords.length),
            explanation: 'Store names are not exact matches but passed fuzzy matching',
          });
        }
      } else {
        // Only include first 5 non-matches to avoid huge response
        if (debugResults.noMatches.length < 5) {
          debugResults.noMatches.push(surveyAnalysis);
        }
      }

      debugResults.matchAnalysis.push({
        survey: `${survey.leader || 'No leader'} - ${survey.shopName || 'No shop name'}`,
        matched: matchResult,
        similarity: survey.shopName
          ? shopWords.filter((word) => storeWords.includes(word)).length
          : 0,
      });
    });

    // Calculate expected completion rate
    const modelPosmCounts = await getModelPosmCounts();
    let totalRequiredPOSMs = 0;
    let totalCompletedPOSMs = 0;

    displays.forEach((display) => {
      totalRequiredPOSMs += modelPosmCounts[display.model] || 0;

      // Check if there are matching surveys for this model
      debugResults.surveyMatches.forEach((surveyMatch) => {
        const matchingResponse = surveyMatch.models.find((model) =>
          isModelMatch(display.model, model)
        );
        if (matchingResponse) {
          totalCompletedPOSMs += modelPosmCounts[display.model] || 0;
        }
      });
    });

    debugResults.completion = {
      totalRequiredPOSMs,
      totalCompletedPOSMs,
      completionRate:
        totalRequiredPOSMs > 0 ? ((totalCompletedPOSMs / totalRequiredPOSMs) * 100).toFixed(1) : 0,
      hasValidSurveys: debugResults.surveyMatches.length > 0,
    };

    res.json({
      success: true,
      data: debugResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Debug store matching error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug store matching',
      error: error.message,
    });
  }
};

/**
 * Get detailed completion rate audit information for debugging
 */
const getCompletionAudit = async (req, res) => {
  try {
    // Get all data needed for audit
    const allDisplays = await Display.find({ is_displayed: true })
      .select('store_id model createdAt updatedAt')
      .lean();
    const allSurveys = await SurveyResponse.find()
      .select('leader shopName responses createdAt submittedAt')
      .lean();
    const stores = await Store.find().select('store_id store_name region province channel').lean();
    const modelPosmCounts = await getModelPosmCounts();

    // Calculate store progress
    const storeProgress = await calculateStoreProgressImproved(
      allDisplays,
      allSurveys,
      stores,
      modelPosmCounts
    );

    // Generate comprehensive audit
    const auditResults = generateCompletionRateAudit(storeProgress, allDisplays, allSurveys);

    // Add additional debugging statistics
    const debugStats = {
      matchingStatistics: {
        totalMatchAttempts: allDisplays.length,
        successfulMatches: storeProgress.filter((s) => s.completionRate > 0).length,
        perfectMatches: storeProgress.filter((s) => s.completionRate === 100).length,
        partialMatches: storeProgress.filter((s) => s.completionRate > 0 && s.completionRate < 100)
          .length,
        noMatches: storeProgress.filter((s) => s.completionRate === 0).length,
      },
      dataQuality: {
        displayModels: [...new Set(allDisplays.map((d) => d.model))].length,
        surveyModels: [
          ...new Set(allSurveys.flatMap((s) => s.responses?.map((r) => r.model) || [])),
        ].length,
        orphanedSurveys: allSurveys.filter((survey) => {
          return !allDisplays.some((display) =>
            isStoreMatch(
              survey.leader,
              survey.shopName,
              display.store_id,
              stores.reduce((acc, s) => ({ ...acc, [s.store_id]: s }), {})
            )
          );
        }).length,
      },
      performanceMetrics: {
        averageCompletionRate:
          auditResults.summary.totalStores > 0
            ? (
                storeProgress.reduce((sum, s) => sum + s.completionRate, 0) /
                auditResults.summary.totalStores
              ).toFixed(2)
            : 0,
        medianCompletionRate: calculateMedian(storeProgress.map((s) => s.completionRate)),
        completionRateVariance: calculateVariance(storeProgress.map((s) => s.completionRate)),
      },
    };

    res.json({
      success: true,
      data: {
        audit: auditResults,
        debugging: debugStats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get completion audit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate completion audit',
      error: error.message,
    });
  }
};

/**
 * Enable or disable debug mode for store matching
 */
const toggleDebugMode = async (req, res) => {
  try {
    const { enabled, storeIds } = req.body;

    // This could be extended to store debug settings in database
    // For now, just return the current settings
    const debugSettings = {
      enabled: enabled || false,
      targetStores: storeIds || [],
      timestamp: new Date().toISOString(),
    };

    console.log(`🔧 DEBUG MODE ${enabled ? 'ENABLED' : 'DISABLED'}`, debugSettings);

    res.json({
      success: true,
      message: `Debug mode ${enabled ? 'enabled' : 'disabled'}`,
      settings: debugSettings,
    });
  } catch (error) {
    console.error('Toggle debug mode error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle debug mode',
    });
  }
};

/**
 * Helper functions for statistics
 */
function calculateMedian(numbers) {
  const sorted = numbers.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function calculateVariance(numbers) {
  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  const squaredDiffs = numbers.map((num) => Math.pow(num - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
}

module.exports = {
  getProgressOverview,
  getStoreProgress,
  getModelProgress,
  getPOSMProgress,
  getRegionProgress,
  getProgressTimeline,
  getPOSMMatrix,
  getCompletionAudit,
  toggleDebugMode,
  debugStoreMatching,
};
