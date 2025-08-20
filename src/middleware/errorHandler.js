const { config } = require('../config');

const errorHandler = (err, req, res, next) => {
  console.error('Global error handler:', err);
  
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }
  
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }
  
  if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate entry detected';
  }
  
  res.status(statusCode).json({
    success: false,
    message: config.server.nodeEnv === 'production' ? 'Internal server error' : message,
    ...(config.server.nodeEnv === 'development' && { stack: err.stack })
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};