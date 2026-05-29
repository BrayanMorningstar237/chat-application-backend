// backend/src/models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'location', 'voice'],
    default: 'text'
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    mimeType: String
  }],
  isDelivered: {
    type: Boolean,
    default: false
  },
  deliveredTo: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed', 'deleted'],
    default: 'sent'
  },
  deliveredAt: {
    type: Date
  },
  readAt: {
    type: Date
  },
  editedAt: {
    type: Date
  },
  editedContent: {
    type: String
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound index for efficient conversation queries
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Virtual for formatted timestamp
messageSchema.virtual('formattedTime').get(function() {
  return this.createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Method to mark as delivered
messageSchema.methods.markDelivered = async function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

// Method to mark as read
messageSchema.methods.markRead = async function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);
