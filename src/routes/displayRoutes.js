const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const {
  getDisplays,
  getDisplayById,
  createDisplay,
  updateDisplay,
  deleteDisplay,
  bulkDeleteDisplays,
  importDisplaysFromCSV,
  exportDisplaysToCSV,
  getDisplayStats
} = require('../controllers/displayController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'displays-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.mimetype === 'application/vnd.ms-excel';

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});

// Apply authentication to all routes
router.use(verifyToken);
router.use(requireAdmin);

// Routes
router.get('/', getDisplays);
router.get('/stats', getDisplayStats);
router.get('/export', exportDisplaysToCSV);
router.post('/import', upload.single('csvFile'), importDisplaysFromCSV);
router.post('/bulk-delete', bulkDeleteDisplays);
router.get('/:id', getDisplayById);
router.post('/', createDisplay);
router.put('/:id', updateDisplay);
router.delete('/:id', deleteDisplay);

module.exports = router;