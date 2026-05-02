// backend/src/controllers/conversationController.js
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message'); // ADD THIS - needed for unread count

// Create a direct conversation between two users
const createDirectConversation = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user.id;

    console.log('Creating conversation between:', currentUserId, 'and', targetUserId);

    // Validate target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found'
      });
    }

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      type: 'direct',
      participants: {
        $all: [
          { $elemMatch: { userId: currentUserId } },
          { $elemMatch: { userId: targetUserId } }
        ]
      }
    }).populate('participants.userId', 'username avatar status');

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

    // Populate the conversation before returning
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('participants.userId', 'username avatar status');

    res.status(201).json({
      success: true,
      data: populatedConversation,
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

// Get all conversations for current user (WITH UNREAD COUNT)
const getUserConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      'participants.userId': userId
    })
    .populate('participants.userId', 'username avatar status')
    .populate('lastMessageSender', 'username')
    .sort({ lastMessageAt: -1, updatedAt: -1 });

    // Add unread count for each conversation
    const conversationsWithUnread = await Promise.all(conversations.map(async (conv) => {
      // Count unread messages where user is not the sender
      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        senderId: { $ne: userId },
        isRead: false
      });
      
      // Convert to plain object and add unreadCount
      const convObj = conv.toObject();
      convObj.unreadCount = unreadCount;
      
      return convObj;
    }));

    res.json({
      success: true,
      count: conversationsWithUnread.length,
      data: conversationsWithUnread
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

    // Add unread count for this conversation
    const unreadCount = await Message.countDocuments({
      conversationId: conversation._id,
      senderId: { $ne: userId },
      isRead: false
    });
    
    const convObj = conversation.toObject();
    convObj.unreadCount = unreadCount;

    res.json({
      success: true,
      data: convObj
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