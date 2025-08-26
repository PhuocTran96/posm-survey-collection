const { User, Store } = require('../models');
const { getClientInfo } = require('../middleware/auth');
const csv = require('csv-parser');
const fs = require('fs');
const XLSX = require('xlsx');

/**
 * Get all users with pagination and filters
 */
const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter object
    const filters = {};
    
    if (req.query.role) {
      filters.role = req.query.role;
    }
    
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    
    if (req.query.leader) {
      filters.leader = req.query.leader;
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filters.$or = [
        { userid: searchRegex },
        { username: searchRegex },
        { loginid: searchRegex }
      ];
    }

    // Get total count for pagination
    const totalCount = await User.countDocuments(filters);
    
    // Get users with pagination
    const users = await User.find(filters)
      .select('-password -refreshToken')
      .populate('assignedStores', 'store_id store_name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users'
    });
  }
};

/**
 * Get user by ID
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .select('-password -refreshToken')
      .populate('assignedStores', 'store_id store_name channel region province');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user'
    });
  }
};

/**
 * Create new user
 */
const createUser = async (req, res) => {
  try {
    const { userid, username, loginid, password, role, leader, isActive, assignedStores } = req.body;
    const currentUser = req.user;

    // Validation
    if (!userid || !username || !loginid || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check for duplicate userid, username, or loginid
    const existingUser = await User.findOne({
      $or: [
        { userid: userid.trim() },
        { username: username.trim() },
        { loginid: loginid.trim() }
      ]
    });

    if (existingUser) {
      const duplicateField = 
        existingUser.userid === userid.trim() ? 'userid' :
        existingUser.username === username.trim() ? 'username' : 'loginid';
        
      return res.status(400).json({
        success: false,
        message: `User with this ${duplicateField} already exists`
      });
    }

    // Validate hierarchy if leader is provided
    if (leader && !User.validateHierarchy(role, leader)) {
      return res.status(400).json({
        success: false,
        message: `Invalid hierarchy: ${role} cannot report to ${leader}`
      });
    }

    // If leader is provided, verify leader exists
    if (leader) {
      const leaderUser = await User.findOne({ username: leader, isActive: true });
      if (!leaderUser) {
        return res.status(400).json({
          success: false,
          message: 'Specified leader does not exist or is inactive'
        });
      }
    }

    // Create user
    const userData = {
      userid: userid.trim(),
      username: username.trim(),
      loginid: loginid.trim(),
      password: password.trim(),
      role: role.trim(),
      leader: leader?.trim() || null,
      isActive: isActive !== undefined ? isActive : true,
      assignedStores: assignedStores || [],
      createdBy: currentUser.username,
      updatedBy: currentUser.username
    };

    const newUser = new User(userData);
    await newUser.save();

    // Log user creation

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: newUser._id,
        userid: newUser.userid,
        username: newUser.username,
        loginid: newUser.loginid,
        role: newUser.role,
        leader: newUser.leader,
        isActive: newUser.isActive
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
};

/**
 * Update user
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { userid, username, loginid, role, leader, isActive, assignedStores, password } = req.body;
    const currentUser = req.user;

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent updating super admin by non-super admin
    if (user.isSuperAdmin && !currentUser.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify super admin account'
      });
    }

    // Check for duplicates if fields are being changed
    if (userid && userid !== user.userid) {
      const existingUser = await User.findOne({ userid: userid.trim(), _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this userid already exists'
        });
      }
      user.userid = userid.trim();
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username: username.trim(), _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this username already exists'
        });
      }
      user.username = username.trim();
    }

    if (loginid && loginid !== user.loginid) {
      const existingUser = await User.findOne({ loginid: loginid.trim(), _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this loginid already exists'
        });
      }
      user.loginid = loginid.trim();
    }

    // Update other fields
    if (role && role !== user.role) {
      // Validate hierarchy with new role
      if (leader && !User.validateHierarchy(role, leader)) {
        return res.status(400).json({
          success: false,
          message: `Invalid hierarchy: ${role} cannot report to ${leader}`
        });
      }
      user.role = role.trim();
    }

    if (leader !== undefined) {
      if (leader) {
        // Validate hierarchy
        if (!User.validateHierarchy(user.role, leader)) {
          return res.status(400).json({
            success: false,
            message: `Invalid hierarchy: ${user.role} cannot report to ${leader}`
          });
        }
        
        // Verify leader exists
        const leaderUser = await User.findOne({ username: leader.trim(), isActive: true });
        if (!leaderUser) {
          return res.status(400).json({
            success: false,
            message: 'Specified leader does not exist or is inactive'
          });
        }
        user.leader = leader.trim();
      } else {
        user.leader = null;
      }
    }

    if (isActive !== undefined) {
      // Prevent deactivating super admin
      if (user.isSuperAdmin && isActive === false) {
        return res.status(403).json({
          success: false,
          message: 'Cannot deactivate super admin account'
        });
      }
      user.isActive = isActive;
    }

    if (assignedStores !== undefined) {
      user.assignedStores = assignedStores;
    }

    if (password && password.trim()) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }
      user.password = password.trim();
    }

    user.updatedBy = currentUser.username;
    await user.save();

    // Log user update

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user._id,
        userid: user.userid,
        username: user.username,
        loginid: user.loginid,
        role: user.role,
        leader: user.leader,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
};

/**
 * Delete user
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting super admin
    if (user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete super admin account'
      });
    }

    // Prevent deleting yourself
    if (user._id.toString() === currentUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Check if user has subordinates
    const subordinates = await User.find({ leader: user.username, isActive: true });
    if (subordinates.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete user with ${subordinates.length} active subordinate(s). Please reassign or deactivate subordinates first.`,
        data: {
          subordinates: subordinates.map(sub => ({
            userid: sub.userid,
            username: sub.username,
            role: sub.role
          }))
        }
      });
    }

    await User.findByIdAndDelete(id);

    // Log user deletion

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

/**
 * Bulk delete users
 */
const bulkDeleteUsers = async (req, res) => {
  try {
    const { ids } = req.body;
    const currentUser = req.user;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of user IDs is required'
      });
    }

    // Get users to delete
    const users = await User.find({ _id: { $in: ids } });
    
    // Check for super admin or current user
    const protectedUsers = users.filter(user => 
      user.isSuperAdmin || user._id.toString() === currentUser._id.toString()
    );
    
    if (protectedUsers.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete super admin or your own account',
        data: {
          protectedUsers: protectedUsers.map(u => u.username)
        }
      });
    }

    // Check for users with subordinates
    const usersWithSubordinates = [];
    for (const user of users) {
      const subordinates = await User.find({ leader: user.username, isActive: true });
      if (subordinates.length > 0) {
        usersWithSubordinates.push({
          username: user.username,
          subordinateCount: subordinates.length
        });
      }
    }

    if (usersWithSubordinates.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some users have active subordinates',
        data: {
          usersWithSubordinates
        }
      });
    }

    // Delete users
    const deleteResult = await User.deleteMany({ _id: { $in: ids } });

    // Log bulk deletion

    res.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} user(s)`,
      data: {
        deletedCount: deleteResult.deletedCount
      }
    });

  } catch (error) {
    console.error('Bulk delete users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete users'
    });
  }
};

/**
 * Reset user password (admin only)
 */
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const currentUser = req.user;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password
    user.password = newPassword;
    user.updatedBy = currentUser.username;
    
    // Clear refresh tokens to force re-login
    user.refreshToken = null;
    user.refreshTokenExpiry = null;
    
    await user.save();

    // Log password reset

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
};

/**
 * Import users from CSV
 */
const importUsersFromCSV = async (req, res) => {
  try {
    const currentUser = req.user;
    console.log('🔄 User import request from:', currentUser?.username);
    
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }
    
    console.log('📁 Uploaded file:', {
      originalname: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    });

    const results = [];
    const errors = [];
    let lineNumber = 0;

    // Process CSV file
    console.log('📊 Processing CSV file...');
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          lineNumber++;
          results.push({ ...data, lineNumber });
        })
        .on('end', () => {
          console.log('✅ CSV processing completed. Records found:', results.length);
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ CSV processing error:', error);
          reject(error);
        });
    });

    const stats = {
      total: results.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    // Process each user
    for (const userData of results) {
      try {
        // Validate required fields
        if (!userData.userid || !userData.username || !userData.loginid || 
            !userData.password || !userData.role) {
          errors.push({
            line: userData.lineNumber,
            error: 'Missing required fields',
            data: userData
          });
          stats.errors++;
          continue;
        }

        // Check if user exists
        const existingUser = await User.findOne({
          $or: [
            { userid: userData.userid.trim() },
            { username: userData.username.trim() },
            { loginid: userData.loginid.trim() }
          ]
        });

        // Process assigned stores - convert store_id to ObjectIds
        let assignedStoreIds = [];
        if (userData.assignedStores) {
          const storeIds = typeof userData.assignedStores === 'string' ? 
            userData.assignedStores.split(';').map(s => s.trim()).filter(s => s) : 
            userData.assignedStores;
          
          if (storeIds.length > 0) {
            // Find stores by store_id and get their ObjectIds
            const foundStores = await Store.find({ 
              store_id: { $in: storeIds } 
            }).select('_id');
            assignedStoreIds = foundStores.map(store => store._id);
          }
        }

        const cleanUserData = {
          userid: userData.userid.trim(),
          username: userData.username.trim(),
          loginid: userData.loginid.trim(),
          password: userData.password.trim(),
          role: userData.role.trim(),
          leader: userData.leader?.trim() || null,
          assignedStores: assignedStoreIds,
          createdBy: currentUser.username,
          updatedBy: currentUser.username
        };

        if (existingUser) {
          // Update existing user
          Object.assign(existingUser, cleanUserData);
          await existingUser.save();
          stats.updated++;
        } else {
          // Create new user
          const newUser = new User(cleanUserData);
          await newUser.save();
          stats.created++;
        }

      } catch (error) {
        errors.push({
          line: userData.lineNumber,
          error: error.message,
          data: userData
        });
        stats.errors++;
      }
    }

    // Log import activity

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: 'CSV import completed',
      data: {
        stats,
        errors: errors.slice(0, 10) // Limit errors in response
      }
    });

  } catch (error) {
    console.error('CSV import error:', error);
    
    // Clean up uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to import CSV'
    });
  }
};

/**
 * Export users to CSV
 */
const exportUsersToCSV = async (req, res) => {
  try {
    const currentUser = req.user;
    
    // Get all users (excluding passwords) with populated store details
    const users = await User.find({})
      .select('-password -refreshToken -refreshTokenExpiry')
      .populate('assignedStores', 'store_id')
      .sort({ createdAt: -1 });

    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare data for export
    const exportData = users.map(user => ({
      userid: user.userid,
      username: user.username,
      loginid: user.loginid,
      role: user.role,
      leader: user.leader || '',
      assignedStores: Array.isArray(user.assignedStores) ? 
        user.assignedStores.map(store => store.store_id || store).join(';') : '',
      isActive: user.isActive,
      lastLogin: user.lastLogin ? user.lastLogin.toISOString() : '',
      createdAt: user.createdAt ? user.createdAt.toISOString() : '',
      createdBy: user.createdBy || '',
      updatedBy: user.updatedBy || ''
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `users-export-${timestamp}.xlsx`;

    // Log export activity

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send file
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);

  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export users'
    });
  }
};

/**
 * Get user statistics
 */
const getUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactiveUsers: { $sum: { $cond: ['$isActive', 0, 1] } }
        }
      }
    ]);

    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || { totalUsers: 0, activeUsers: 0, inactiveUsers: 0 },
        roleDistribution: roleStats
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user statistics'
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
  resetUserPassword,
  importUsersFromCSV,
  exportUsersToCSV,
  getUserStats
};