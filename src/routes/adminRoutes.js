const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.post('/reload-data', adminController.reloadData);
router.get('/data-stats', adminController.getDataStats);

module.exports = router;