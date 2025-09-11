const jwt = require('jsonwebtoken');
const { User } = require('../models');

// JWT Secret keys (should be in environment variables)
const ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-key-change-in-production';
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '7d'; // 7 days
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

// Session timeout (60 minutes of inactivity)
const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutes in milliseconds

/**
 * Generate access and refresh tokens for a user
 */
const generateTokens = (user) => {
  const now = new Date();
  const payload = {
    id: user._id,
    userid: user.userid,
    username: user.username,
    loginid: user.loginid,
    role: user.role,
    leader: user.leader,
    lastActivity: now.getTime(), // Track last activity for session timeout
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'posm-survey-app',
    audience: 'posm-survey-users',
  });

  const refreshToken = jwt.sign({ id: user._id, username: user.username }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'posm-survey-app',
    audience: 'posm-survey-users',
  });

  return { accessToken, refreshToken };
};

/**
 * Verify access token middleware
 */
const verifyToken = async (req, res, next) => {
  try {
    // Mobile and ETG request detection for targeted logging
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      req.headers['user-agent'] || ''
    );
    const requestUrl = req.originalUrl || req.url;
    const isETGRequest =
      requestUrl.includes('ETG') ||
      (req.params && req.params.model && req.params.model.includes('ETG'));

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ AUTH FAILED - No Bearer token:`, {
        url: requestUrl,
        mobile: isMobile,
        isETG: isETGRequest,
        authHeader: authHeader ? 'present but invalid' : 'missing',
      });
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
        code: 'NO_TOKEN',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
      issuer: 'posm-survey-app',
      audience: 'posm-survey-users',
    });

    // Get fresh user data from database
    const user = await User.findById(decoded.id).select('-password -refreshToken');

    if (!user) {
      console.log(`❌ AUTH FAILED - User not found:`, {
        url: requestUrl,
        mobile: isMobile,
        isETG: isETGRequest,
        userId: decoded.id,
        decodedData: {
          ...decoded,
          iat: new Date(decoded.iat * 1000),
          exp: new Date(decoded.exp * 1000),
        },
      });
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.isActive) {
      console.log(`❌ AUTH FAILED - Account deactivated:`, {
        url: requestUrl,
        mobile: isMobile,
        isETG: isETGRequest,
        userId: user._id,
        username: user.username,
      });
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Check for session timeout (60 minutes of inactivity)
    const now = Date.now();
    const lastActivity = decoded.lastActivity || decoded.iat * 1000; // Fallback to token issued time
    const timeSinceLastActivity = now - lastActivity;

    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      console.log(`❌ AUTH FAILED - Session timeout:`, {
        url: requestUrl,
        mobile: isMobile,
        isETG: isETGRequest,
        userId: user._id,
        username: user.username,
        exceededBy: `${Math.round((timeSinceLastActivity - SESSION_TIMEOUT) / 1000)}s`,
      });
      return res.status(401).json({
        success: false,
        message: 'Session expired due to inactivity',
        code: 'SESSION_TIMEOUT',
      });
    }

    // Attach user info to request
    req.user = user;
    req.tokenData = decoded;

    // Only log for ETG mobile requests or approaching timeout
    const timeUntilTimeout = SESSION_TIMEOUT - timeSinceLastActivity;
    if ((isMobile && isETGRequest) || timeUntilTimeout < 10 * 60 * 1000) {
      console.log(`✅ AUTH SUCCESS (ETG/Near-timeout):`, {
        url: requestUrl,
        mobile: isMobile,
        isETG: isETGRequest,
        timeRemaining: `${Math.round(timeUntilTimeout / 1000)}s`,
      });
    }

    next();
  } catch (error) {
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      req.headers['user-agent'] || ''
    );
    const requestUrl = req.originalUrl || req.url;
    const isETGRequest =
      requestUrl.includes('ETG') ||
      (req.params && req.params.model && req.params.model.includes('ETG'));

    console.error(`❌ AUTH ERROR - Token verification failed:`, {
      url: requestUrl,
      mobile: isMobile,
      isETG: isETGRequest,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack?.split('\n')[0],
    });

    if (error.name === 'TokenExpiredError') {
      console.log(`❌ AUTH FAILED - Token expired:`, {
        url: requestUrl,
        mobile: isMobile,
        isETG: isETGRequest,
        expiredAt: new Date(error.expiredAt).toISOString(),
      });
      return res.status(401).json({
        success: false,
        message: 'Access token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      console.log(`❌ AUTH FAILED - Invalid JWT:`, {
        url: requestUrl,
        mobile: isMobile,
        isETG: isETGRequest,
        reason: error.message,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid access token',
        code: 'INVALID_TOKEN',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Token verification failed',
      code: 'VERIFICATION_ERROR',
    });
  }
};

/**
 * Role-based access control middleware
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role,
      });
    }

    next();
  };
};

/**
 * Admin-only access middleware
 */
const requireAdmin = requireRole(['admin']);

/**
 * Survey user access middleware (users who can submit surveys)
 */
const requireSurveyUser = requireRole(['admin', 'user', 'PRT', 'TDS', 'TDL']);

/**
 * Manager access middleware (users who can manage teams)
 */
const requireManager = requireRole(['admin', 'TDS', 'TDL']);

/**
 * Verify refresh token and generate new access token
 */
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, {
      issuer: 'posm-survey-app',
      audience: 'posm-survey-users',
    });

    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Check if refresh token is expired
    if (user.refreshTokenExpiry && new Date() > user.refreshTokenExpiry) {
      // Clear expired refresh token
      user.refreshToken = null;
      user.refreshTokenExpiry = null;
      await user.save();

      return res.status(401).json({
        success: false,
        message: 'Refresh token expired',
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    // Update refresh token in database
    user.refreshToken = tokens.refreshToken;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await user.save();

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user._id,
          userid: user.userid,
          username: user.username,
          loginid: user.loginid,
          role: user.role,
          leader: user.leader,
        },
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);

    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Token refresh failed',
    });
  }
};

/**
 * Extract client information for audit logging
 */
const getClientInfo = (req) => {
  return {
    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent'] || 'unknown',
  };
};

/**
 * Update user activity timestamp (for session management)
 * Should be used after verifyToken middleware
 */
const updateActivity = async (req, res, next) => {
  try {
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      req.headers['user-agent'] || ''
    );
    const requestUrl = req.originalUrl || req.url;
    const isETGRequest =
      requestUrl.includes('ETG') ||
      (req.params && req.params.model && req.params.model.includes('ETG'));

    if (req.user && req.tokenData) {
      const now = Date.now();
      const lastActivity = req.tokenData.lastActivity || req.tokenData.iat * 1000;
      const timeSinceLastActivity = now - lastActivity;
      const activityThreshold = 5 * 60 * 1000; // 5 minutes

      // Update activity if more than 5 minutes have passed to avoid excessive token generation
      if (timeSinceLastActivity > activityThreshold) {
        // Only log token generation for ETG mobile requests or when debugging needed
        if (isMobile && isETGRequest) {
          console.log(`🔄 Generating new token for ETG mobile request`);
        }

        // Generate new token with updated activity
        const newTokens = generateTokens(req.user);

        // Set new token in response header for client to update
        res.setHeader('X-New-Access-Token', newTokens.accessToken);
      }
    }
  } catch (error) {
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      req.headers['user-agent'] || ''
    );
    const requestUrl = req.originalUrl || req.url;
    const isETGRequest =
      requestUrl.includes('ETG') ||
      (req.params && req.params.model && req.params.model.includes('ETG'));

    console.error(`❌ Activity update error (mobile=${isMobile}, ETG=${isETGRequest}):`, {
      url: requestUrl,
      error: error.message,
      stack: error.stack,
    });
    // Don't fail the request if activity update fails
  }

  next();
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshToken');

    if (user && user.isActive) {
      req.user = user;
      req.tokenData = decoded;
    }
  } catch (error) {
    // Ignore token errors in optional auth
    console.log('Optional auth failed:', error.message);
  }

  next();
};

module.exports = {
  generateTokens,
  verifyToken,
  updateActivity,
  requireRole,
  requireAdmin,
  requireSurveyUser,
  requireManager,
  refreshAccessToken,
  getClientInfo,
  optionalAuth,

  // Constants
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  SESSION_TIMEOUT,
};
