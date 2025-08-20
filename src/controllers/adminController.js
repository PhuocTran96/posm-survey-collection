const { Store, ModelPosm, SurveyResponse } = require('../models');

const reloadData = async (req, res) => {
  try {
    await Store.deleteMany({});
    await ModelPosm.deleteMany({});
    
    const dataInitializer = require('../services/dataInitializer');
    await dataInitializer.initializeData();
    
    res.json({
      success: true,
      message: 'Data reloaded successfully'
    });
  } catch (error) {
    console.error('Error reloading data:', error);
    res.status(500).json({
      success: false,
      message: 'Error reloading data',
      error: error.message
    });
  }
};

const getDataStats = async (req, res) => {
  try {
    const storeCount = await Store.countDocuments();
    const modelPosmCount = await ModelPosm.countDocuments();
    const responseCount = await SurveyResponse.countDocuments();
    
    res.json({
      success: true,
      data: {
        stores: storeCount,
        modelPosm: modelPosmCount,
        responses: responseCount
      }
    });
  } catch (error) {
    console.error('Error fetching data stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching data statistics',
      error: error.message
    });
  }
};

module.exports = {
  reloadData,
  getDataStats
};