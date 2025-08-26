const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'stores-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, XLSX, and XLS files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// All routes require authentication
router.use(verifyToken);

// GET routes
router.get('/', storeController.getStores);
router.get('/search', storeController.searchStores);
router.get('/stats', storeController.getStoreStats);
router.get('/export', requireRole(['admin']), storeController.exportStoresToCSV);
router.get('/:id', storeController.getStoreById);

// POST routes
router.post('/', requireRole(['admin']), storeController.createStore);
router.post('/import', requireRole(['admin']), upload.single('csvFile'), storeController.importStoresFromCSV);
router.post('/bulk-delete', requireRole(['admin']), storeController.bulkDeleteStores);

// PUT routes
router.put('/:id', requireRole(['admin']), storeController.updateStore);

// DELETE routes
router.delete('/:id', requireRole(['admin']), storeController.deleteStore);

module.exports = router;