// backend/src/controllers/conversationController.js
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message'); // ADD THIS - needed for unread count

// Create a direct or group conversation
const createConversation = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { type, targetUserId, participantIds = [], groupInfo } = req.body;

    if (type === 'group') {
      const participants = Array.isArray(participantIds)
        ? [...new Set(participantIds.map(String))]
        : [];

      if (participants.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Group conversations need at least two participants besides you'
        });
      }

      if (!groupInfo || !groupInfo.name) {
        return res.status(400).json({
          success: false,
          error: 'Group name is required'
        });
      }

      const users = await User.find({ _id: { $in: participants } });
      if (users.length !== participants.length) {
        return res.status(404).json({
          success: false,
          error: 'One or more group participants not found'
        });
      }

      const conversation = new Conversation({
        type: 'group',
        participants: [
          { userId: currentUserId, joinedAt: new Date() },
          ...participants.map((participantId) => ({ userId: participantId, joinedAt: new Date() }))
        ],
        groupInfo: {
          name: groupInfo.name,
          description: groupInfo.description || '',
          avatar: groupInfo.avatar || null,
          createdBy: currentUserId,
          createdAt: new Date()
        }
      });

      await conversation.save();
      const populatedConversation = await Conversation.findById(conversation._id)
        .populate('participants.userId', 'username avatar status');

      return res.status(201).json({
        success: true,
        data: populatedConversation,
        message: 'Group created successfully'
      });
    }

    if (type !== 'direct' && !targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation type or missing target user'
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found'
      });
    }

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

    const conversation = new Conversation({
      type: 'direct',
      participants: [
        { userId: currentUserId, joinedAt: new Date() },
        { userId: targetUserId, joinedAt: new Date() }
      ]
    });

    await conversation.save();
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

const updateConversation = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { name, description, avatar } = req.body;
    const requesterId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId.toString() === requesterId
    );

    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (conversation.type !== 'group') {
      return res.status(400).json({ success: false, error: 'Only group conversations can be updated' });
    }

    const isGroupAdmin = conversation.groupInfo?.createdBy?.toString() === requesterId || req.user.isAdmin;
    if (!isGroupAdmin) {
      return res.status(403).json({ success: false, error: 'Only group admins can update group details' });
    }

    if (name) conversation.groupInfo.name = name;
    if (description !== undefined) conversation.groupInfo.description = description;
    if (avatar !== undefined) conversation.groupInfo.avatar = avatar;

    await conversation.save();
    const updatedConversation = await Conversation.findById(conversation._id)
      .populate('participants.userId', 'username avatar status');

    res.json({ success: true, data: updatedConversation, message: 'Group updated successfully' });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ success: false, error: error.message });
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
        isDeleted: false,
        'readBy.userId': { $ne: userId }
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
      isDeleted: false,
      'readBy.userId': { $ne: userId }
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
  createDirectConversation: createConversation,
  createConversation,
  updateConversation,
  getUserConversations,
  getConversationById
};
