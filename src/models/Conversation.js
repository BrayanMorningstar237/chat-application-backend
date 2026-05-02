// backend/src/models/Conversation.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    required: true
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastReadAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastMessage: {
    type: String,
    default: null
  },
  lastMessageAt: {
    type: Date,
    default: null
  },
  lastMessageSender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  groupInfo: {
    name: String,
    description: String,
    avatar: String,
    createdBy: mongoose.Schema.Types.ObjectId,
    createdAt: Date
  }
}, {
  timestamps: true,
  autoIndex: false
});

// Create the correct index for direct conversations
conversationSchema.index(
  { type: 1, 'participants.userId': 1 },
  { 
    unique: true,
    partialFilterExpression: { type: 'direct' },
    name: 'type_1_participants_userId_1_direct'
  }
);

// Method to add participant
conversationSchema.methods.addParticipant = async function(userId) {
  const exists = this.participants.some(p => p.userId.toString() === userId.toString());
  if (!exists) {
    this.participants.push({ userId, joinedAt: new Date() });
    await this.save();
  }
  return this;
};

module.exports = mongoose.model('Conversation', conversationSchema);