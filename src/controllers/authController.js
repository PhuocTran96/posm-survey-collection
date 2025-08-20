const { User, AuditLog } = require('../models');
const { generateTokens, getClientInfo } = require('../middleware/auth');

/**
 * User login
 */
const login = async (req, res) => {
  try {
    const { loginid, password } = req.body;
    
    if (!loginid || !password) {
      return res.status(400).json({
        success: false,
        message: 'Login ID and password are required'
      });
    }

    // Find user by loginid
    const user = await User.findOne({ loginid: loginid.trim() });
    
    if (!user) {
      // Log failed login attempt
      await AuditLog.logAction({
        action: 'USER_LOGIN',
        performedBy: loginid,
        performedByRole: 'unknown',
        success: false,
        errorMessage: 'User not found',
        ...getClientInfo(req)
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      await AuditLog.logAction({
        action: 'USER_LOGIN',
        performedBy: user.username,
        performedByRole: user.role,
        success: false,
        errorMessage: 'Account deactivated',
        ...getClientInfo(req)
      });
      
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      await AuditLog.logAction({
        action: 'USER_LOGIN',
        performedBy: user.username,
        performedByRole: user.role,
        success: false,
        errorMessage: 'Invalid password',
        ...getClientInfo(req)
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }

    // Generate tokens
    const tokens = generateTokens(user);
    
    // Update user's last login and refresh token
    user.lastLogin = new Date();
    user.refreshToken = tokens.refreshToken;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await user.save();

    // Log successful login
    await AuditLog.logAction({
      action: 'USER_LOGIN',
      performedBy: user.username,
      performedByRole: user.role,
      success: true,
      ...getClientInfo(req)
    });

    // Return tokens and user info
    res.json({
      success: true,
      message: 'Login successful',
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
          lastLogin: user.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed due to server error'
    });
  }
};

/**
 * Admin login (same as regular login but checks admin role)
 */
const adminLogin = async (req, res) => {
  try {
    const { loginid, password } = req.body;
    
    if (!loginid || !password) {
      return res.status(400).json({
        success: false,
        message: 'Login ID and password are required'
      });
    }

    // Find user by loginid
    const user = await User.findOne({ loginid: loginid.trim() });
    
    if (!user || user.role !== 'admin') {
      await AuditLog.logAction({
        action: 'ADMIN_LOGIN',
        performedBy: loginid,
        performedByRole: user?.role || 'unknown',
        success: false,
        errorMessage: 'Not an admin user',
        ...getClientInfo(req)
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      await AuditLog.logAction({
        action: 'ADMIN_LOGIN',
        performedBy: user.username,
        performedByRole: user.role,
        success: false,
        errorMessage: 'Account deactivated',
        ...getClientInfo(req)
      });
      
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      await AuditLog.logAction({
        action: 'ADMIN_LOGIN',
        performedBy: user.username,
        performedByRole: user.role,
        success: false,
        errorMessage: 'Invalid password',
        ...getClientInfo(req)
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Generate tokens
    const tokens = generateTokens(user);
    
    // Update user's last login and refresh token
    user.lastLogin = new Date();
    user.refreshToken = tokens.refreshToken;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    // Log successful admin login
    await AuditLog.logAction({
      action: 'ADMIN_LOGIN',
      performedBy: user.username,
      performedByRole: user.role,
      success: true,
      ...getClientInfo(req)
    });

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user._id,
          userid: user.userid,
          username: user.username,
          loginid: user.loginid,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
          lastLogin: user.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin login failed due to server error'
    });
  }
};

/**
 * User logout
 */
const logout = async (req, res) => {
  try {
    const user = req.user;
    
    // Clear refresh token
    if (user) {
      await User.findByIdAndUpdate(user._id, {
        refreshToken: null,
        refreshTokenExpiry: null
      });

      // Log logout
      await AuditLog.logAction({
        action: 'USER_LOGOUT',
        performedBy: user.username,
        performedByRole: user.role,
        success: true,
        ...getClientInfo(req)
      });
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          userid: user.userid,
          username: user.username,
          loginid: user.loginid,
          role: user.role,
          leader: user.leader,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
};

/**
 * Change password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get full user data including password
    const fullUser = await User.findById(user._id);
    
    // Verify current password
    const isCurrentPasswordValid = await fullUser.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      await AuditLog.logAction({
        action: 'PASSWORD_CHANGED',
        performedBy: user.username,
        performedByRole: user.role,
        success: false,
        errorMessage: 'Invalid current password',
        ...getClientInfo(req)
      });
      
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    fullUser.password = newPassword;
    fullUser.updatedBy = user.username;
    await fullUser.save();

    // Clear all refresh tokens to force re-login
    await User.findByIdAndUpdate(user._id, {
      refreshToken: null,
      refreshTokenExpiry: null
    });

    // Log password change
    await AuditLog.logAction({
      action: 'PASSWORD_CHANGED',
      performedBy: user.username,
      performedByRole: user.role,
      targetUser: user.username,
      success: true,
      ...getClientInfo(req)
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again with your new password.'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

/**
 * Verify token (used to check if user is still authenticated)
 */
const verifyToken = async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: {
          id: user._id,
          userid: user.userid,
          username: user.username,
          loginid: user.loginid,
          role: user.role,
          leader: user.leader,
          isActive: user.isActive
        }
      }
    });

  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Token verification failed'
    });
  }
};

/**
 * Get user's subordinates (for managers)
 */
const getSubordinates = async (req, res) => {
  try {
    const user = req.user;
    
    const subordinates = await user.getSubordinates();
    
    res.json({
      success: true,
      data: {
        subordinates: subordinates.map(sub => ({
          id: sub._id,
          userid: sub.userid,
          username: sub.username,
          role: sub.role,
          isActive: sub.isActive,
          lastLogin: sub.lastLogin
        }))
      }
    });

  } catch (error) {
    console.error('Get subordinates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subordinates'
    });
  }
};

module.exports = {
  login,
  adminLogin,
  logout,
  getProfile,
  changePassword,
  verifyToken,
  getSubordinates
};