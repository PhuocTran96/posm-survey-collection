const jwt = require('jsonwebtoken');
const { User } = require('../models');

const ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-key-change-in-production';

/**
 * Middleware to protect HTML routes by redirecting unauthenticated users to login
 */
const protectRoute = (options = {}) => {
  const { redirectTo = '/login.html', allowedRoles = null } = options;

  return async (req, res, next) => {
    // For browser navigation requests, serve the HTML page and let frontend JavaScript handle auth
    // Only check auth headers for API requests or requests with explicit auth headers
    const authHeader = req.headers.authorization;
    const isApiRequest = req.path.startsWith('/api/');
    const hasAuthHeader = authHeader && authHeader.startsWith('Bearer ');

    // If this is a browser navigation (no auth header) and not an API request,
    // serve the page and let frontend JavaScript handle authentication
    if (!hasAuthHeader && !isApiRequest) {
      return next();
    }

    try {
      let token = null;

      if (hasAuthHeader) {
        token = authHeader.substring(7);
      }

      if (!token) {
        return res.redirect(redirectTo);
      }

      // Verify token
      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
        issuer: 'posm-survey-app',
        audience: 'posm-survey-users',
      });

      // Get user from database
      const user = await User.findById(decoded.id).select('-password -refreshToken');

      if (!user) {
        return res.redirect(redirectTo);
      }

      if (!user.isActive) {
        return res.redirect(redirectTo);
      }

      // Check role if specified
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return res.status(403).send('Access denied: Insufficient permissions');
      }

      // User is authenticated, continue to the route
      req.user = user;
      next();
    } catch (error) {
      console.error('Route protection error:', error);
      return res.redirect(redirectTo);
    }
  };
};

/**
 * Middleware specifically for protecting the survey page
 */
const protectSurveyPage = protectRoute({
  redirectTo: '/login.html',
  allowedRoles: ['admin', 'user', 'PRT', 'TDS', 'TDL'],
});

/**
 * Middleware specifically for protecting the admin page
 */
const protectAdminPage = protectRoute({
  redirectTo: '/admin-login.html',
  allowedRoles: ['admin'],
});

/**
 * Middleware to check if user is already logged in and redirect appropriately
 */
const redirectIfAuthenticated = (redirectTo = '/') => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      let token = null;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);

        const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
        const user = await User.findById(decoded.id).select('-password -refreshToken');

        if (user && user.isActive) {
          return res.redirect(redirectTo);
        }
      }
    } catch (error) {
      // Token is invalid, continue to login page
    }

    next();
  };
};

module.exports = {
  protectRoute,
  protectSurveyPage,
  protectAdminPage,
  redirectIfAuthenticated,
};
