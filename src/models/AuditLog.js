const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DELETED',
      'USER_LOGIN',
      'USER_LOGOUT',
      'USER_ACTIVATED',
      'USER_DEACTIVATED',
      'CSV_IMPORT',
      'CSV_EXPORT',
      'PASSWORD_CHANGED',
      'BULK_USER_IMPORT',
      'ADMIN_LOGIN'
    ]
  },
  performedBy: {
    type: String,
    required: true,
    trim: true
  },
  performedByRole: {
    type: String,
    required: true
  },
  targetUser: {
    type: String,
    trim: true,
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for performance
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ targetUser: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ success: 1 });

// Static method to log actions
auditLogSchema.statics.logAction = async function(actionData) {
  try {
    const log = new this(actionData);
    await log.save();
    console.log(`📝 Audit log created: ${actionData.action} by ${actionData.performedBy}`);
  } catch (error) {
    console.error('❌ Failed to create audit log:', error);
  }
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = async function(username, limit = 50) {
  return await this.find({
    $or: [
      { performedBy: username },
      { targetUser: username }
    ]
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to get admin activities
auditLogSchema.statics.getAdminActivities = async function(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const activities = await this.find({})
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
  const total = await this.countDocuments({});
  
  return {
    activities,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCount: total,
      limit
    }
  };
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;