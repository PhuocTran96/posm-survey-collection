const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const userController = require('../controllers/userController');
const { verifyToken, requireAdmin, logActivity } = require('../middleware/auth');

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/csv/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'users-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});

// All user management routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

// User CRUD operations
router.get('/', logActivity('USER_VIEW'), userController.getUsers);
router.get('/stats', logActivity('USER_STATS'), userController.getUserStats);
router.get('/:id', logActivity('USER_VIEW'), userController.getUserById);
router.post('/', logActivity('USER_CREATED'), userController.createUser);
router.put('/:id', logActivity('USER_UPDATED'), userController.updateUser);
router.delete('/:id', logActivity('USER_DELETED'), userController.deleteUser);
router.delete('/bulk/delete', logActivity('USER_DELETED'), userController.bulkDeleteUsers);

// Password management
router.post('/:id/reset-password', logActivity('PASSWORD_CHANGED'), userController.resetUserPassword);

// CSV import/export
router.post('/import/csv', 
  upload.single('csvFile'), 
  logActivity('CSV_IMPORT'), 
  userController.importUsersFromCSV
);

router.get('/export/csv', 
  logActivity('CSV_EXPORT'), 
  userController.exportUsersToCSV
);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
  }
  
  if (error.message === 'Only CSV and Excel files are allowed') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;