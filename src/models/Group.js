// backend/src/models/Group.js
const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    minlength: [3, 'Group name must be at least 3 characters'],
    maxlength: [100, 'Group name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  avatar: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    isPrivate: {
      type: Boolean,
      default: false
    },
    allowMedia: {
      type: Boolean,
      default: true
    },
    onlyAdminsCanSend: {
      type: Boolean,
      default: false
    }
  },
  maxMembers: {
    type: Number,
    default: 500,
    min: 2,
    max: 500
  }
}, {
  timestamps: true
});

// Index for quick member lookup
groupSchema.index({ 'members.userId': 1 });

// Method to add member
groupSchema.methods.addMember = async function(userId, role = 'member') {
  const exists = this.members.some(m => m.userId.equals(userId));
  if (!exists) {
    if (this.members.length >= this.maxMembers) {
      throw new Error(`Group cannot exceed ${this.maxMembers} members`);
    }
    this.members.push({ userId, role, joinedAt: new Date() });
    await this.save();
  }
  return this;
};

// Method to remove member
groupSchema.methods.removeMember = async function(userId) {
  this.members = this.members.filter(m => !m.userId.equals(userId));
  await this.save();
  return this;
};

// Method to check if user is admin
groupSchema.methods.isAdmin = function(userId) {
  const member = this.members.find(m => m.userId.equals(userId));
  return member && member.role === 'admin';
};

module.exports = mongoose.model('Group', groupSchema);