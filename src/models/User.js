const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  userid: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  loginid: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'user', 'PRT', 'TDS', 'TDL'],
    default: 'user'
  },
  leader: {
    type: String,
    trim: true,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  refreshToken: {
    type: String,
    default: null
  },
  refreshTokenExpiry: {
    type: Date,
    default: null
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  updatedBy: {
    type: String,
    default: 'system'
  },
  isSuperAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshToken;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
userSchema.index({ userid: 1 });
userSchema.index({ username: 1 });
userSchema.index({ loginid: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ leader: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Validate hierarchy before saving
userSchema.pre('save', async function(next) {
  // Skip validation if this is an update and role/leader haven't changed
  if (!this.isNew && !this.isModified('role') && !this.isModified('leader')) {
    return next();
  }
  
  try {
    const isValidHierarchy = await this.constructor.validateHierarchy(this.role, this.leader);
    if (!isValidHierarchy) {
      const errorMsg = this.leader 
        ? `Invalid hierarchy: ${this.role} cannot report to user with username '${this.leader}'`
        : `Role ${this.role} must have a leader`;
      return next(new Error(errorMsg));
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get user hierarchy
userSchema.methods.getSubordinates = async function() {
  const User = this.constructor;
  return await User.find({ leader: this.username, isActive: true });
};

// Static method to validate hierarchy
userSchema.statics.validateHierarchy = async function(role, leaderUsername) {
  // If no leader specified, only TDL and admin are allowed to have no leader
  if (!leaderUsername) {
    return ['TDL', 'admin'].includes(role);
  }
  
  // Find the leader user to check their role
  const leaderUser = await this.findOne({ username: leaderUsername });
  if (!leaderUser) {
    return false; // Leader doesn't exist
  }
  
  const validHierarchy = {
    'PRT': ['TDS'], // PRT reports to TDS
    'TDS': ['TDL'], // TDS reports to TDL  
    'user': ['TDS', 'TDL'] // users can report to TDS or TDL
  };
  
  const allowedLeaderRoles = validHierarchy[role];
  if (!allowedLeaderRoles) {
    return false; // Role not found in hierarchy
  }
  
  return allowedLeaderRoles.includes(leaderUser.role);
};

// Static method to create super admin
userSchema.statics.createSuperAdmin = async function(adminData) {
  const existingSuperAdmin = await this.findOne({ isSuperAdmin: true });
  if (existingSuperAdmin) {
    throw new Error('Super admin already exists');
  }
  
  const superAdmin = new this({
    ...adminData,
    role: 'admin',
    isSuperAdmin: true,
    isActive: true,
    leader: null
  });
  
  return await superAdmin.save();
};

// Prevent deletion of super admin
userSchema.pre('deleteOne', { document: true, query: false }, function(next) {
  if (this.isSuperAdmin) {
    return next(new Error('Cannot delete super admin account'));
  }
  next();
});

userSchema.pre('findOneAndDelete', function(next) {
  this.where({ isSuperAdmin: { $ne: true } });
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;