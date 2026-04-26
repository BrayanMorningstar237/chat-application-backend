// backend/src/controllers/conversationController.js
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Create a direct conversation between two users
const createDirectConversation = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user.id;

    console.log('Creating conversation between:', currentUserId, 'and', targetUserId);

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      type: 'direct',
      participants: {
        $all: [
          { $elemMatch: { userId: currentUserId } },
          { $elemMatch: { userId: targetUserId } }
        ]
      }
    });

    if (existingConversation) {
      return res.json({
        success: true,
        data: existingConversation,
        message: 'Existing conversation found'
      });
    }

    // Create new conversation
    const conversation = new Conversation({
      type: 'direct',
      participants: [
        { userId: currentUserId, joinedAt: new Date() },
        { userId: targetUserId, joinedAt: new Date() }
      ]
    });

    await conversation.save();

    res.status(201).json({
      success: true,
      data: conversation,
      message: 'Conversation created successfully'
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all conversations for current user
const getUserConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      'participants.userId': userId
    })
    .populate('participants.userId', 'username avatar status')
    .populate('lastMessageSender', 'username')
    .sort({ lastMessageAt: -1, updatedAt: -1 });

    res.json({
      success: true,
      count: conversations.length,
      data: conversations
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get conversation by ID
const getConversationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findOne({
      _id: id,
      'participants.userId': userId
    })
    .populate('participants.userId', 'username avatar status')
    .populate('lastMessageSender', 'username');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  createDirectConversation,
  getUserConversations,
  getConversationById
};