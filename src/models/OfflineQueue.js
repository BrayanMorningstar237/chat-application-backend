// backend/src/models/OfflineQueue.js
const mongoose = require('mongoose');

const offlineQueueSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  message: {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    type: {
      type: String,
      default: 'text'
    },
    attachments: [{
      filename: String,
      url: String,
      size: Number,
      mimeType: String
    }],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  lastAttemptAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'delivered', 'failed'],
    default: 'pending'
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// TTL index: Automatically delete after 30 days (BR4)
offlineQueueSchema.index({ createdAt: 1 }, { 
  expireAfterSeconds: 30 * 24 * 60 * 60 // 30 days
});

// Index for pending messages
offlineQueueSchema.index({ userId: 1, status: 1, createdAt: 1 });

// Method to increment attempt count
offlineQueueSchema.methods.incrementAttempt = async function() {
  this.attempts += 1;
  this.lastAttemptAt = new Date();
  
  if (this.attempts >= 5) {
    this.status = 'failed';
    this.errorMessage = 'Max delivery attempts exceeded';
  }
  
  return this.save();
};

module.exports = mongoose.model('OfflineQueue', offlineQueueSchema);