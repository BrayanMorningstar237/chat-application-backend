// backend/src/models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN',
      'LOGOUT',
      'SEND_MESSAGE',
      'DELETE_MESSAGE',
      'EDIT_MESSAGE',
      'CREATE_CONVERSATION',
      'DELETE_CONVERSATION',
      'ADD_PARTICIPANT',
      'REMOVE_PARTICIPANT',
      'CREATE_GROUP',
      'DELETE_GROUP',
      'UPDATE_GROUP_SETTINGS',
      'ADD_GROUP_MEMBER',
      'REMOVE_GROUP_MEMBER',
      'USER_REGISTER',
      'USER_UPDATE_PROFILE',
      'USER_DELETE',
      'BACKUP_CREATED',
      'BACKUP_RESTORED',
      'SYSTEM_CONFIG_CHANGE'
    ]
  },
  resourceType: {
    type: String,
    enum: ['user', 'message', 'conversation', 'group', 'system'],
    required: true
  },
  resourceId: {
    type: String
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'pending'],
    default: 'success'
  },
  errorMessage: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for efficient querying
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// TTL index: Keep logs for 1 year (optional)
auditLogSchema.index({ timestamp: 1 }, { 
  expireAfterSeconds: 365 * 24 * 60 * 60 // 1 year
});

// Static method to log an action
auditLogSchema.statics.log = async function(data) {
  const log = new this({
    userId: data.userId,
    username: data.username,
    action: data.action,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    details: data.details || {},
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    status: data.status || 'success',
    errorMessage: data.errorMessage
  });
  
  return await log.save();
};

module.exports = mongoose.model('AuditLog', auditLogSchema);