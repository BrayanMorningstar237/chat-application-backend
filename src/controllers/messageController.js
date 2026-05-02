// backend/src/controllers/messageController.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

class MessageController {
  
  // Send a new message
  async sendMessage(req, res) {
    const session = await Message.startSession();
    session.startTransaction();
    
    try {
      const { conversationId, content, type, replyTo } = req.body;
      const senderId = req.user.id;
      
      console.log('Sending message:', { conversationId, content, senderId });
      
      // Message size limit (5KB - reasonable for chat)
      if (content && content.length > 5000) {
        throw new Error('Message exceeds 5000 character limit');
      }
      
      // Check if user is in conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      const isParticipant = conversation.participants.some(
        p => p.userId.equals(senderId)
      );
      
      if (!isParticipant) {
        throw new Error('User is not a participant in this conversation');
      }
      
      // Create message
      const message = new Message({
        conversationId,
        senderId,
        content,
        type: type || 'text',
        replyTo: replyTo || null,
        status: 'sent',
        isRead: false
      });
      
      await message.save({ session });
      
      // Update conversation last message
      conversation.lastMessage = content.substring(0, 100);
      conversation.lastMessageAt = new Date();
      conversation.lastMessageSender = senderId;
      await conversation.save({ session });
      
      await session.commitTransaction();
      
      // Emit socket event for real-time
      if (req.io) {
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'username avatar');
        req.io.to(conversationId).emit('new_message', populatedMessage);
      }
      
      console.log('Message sent successfully:', message._id);
      
      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: message
      });
      
    } catch (error) {
      await session.abortTransaction();
      console.error('Send message error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    } finally {
      session.endSession();
    }
  }
  
  // Get messages with pagination
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { limit = 50, before } = req.query;
      
      console.log('Getting messages for:', conversationId);
      
      // Users can only see their own conversations
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }
      
      const isParticipant = conversation.participants.some(
        p => p.userId.equals(req.user.id)
      );
      
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this conversation'
        });
      }
      
      let query = { conversationId, isDeleted: false };
      
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }
      
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('senderId', 'username avatar')
        .populate('replyTo');
      
      res.json({
        success: true,
        count: messages.length,
        data: messages.reverse()
      });
      
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Mark messages as read in a conversation
  async markMessagesAsRead(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      console.log('Marking messages as read for:', conversationId, 'user:', userId);

      // Update all unread messages where user is not the sender
      const result = await Message.updateMany(
        {
          conversationId: conversationId,
          senderId: { $ne: userId },
          isRead: false
        },
        {
          $set: { isRead: true },
          $addToSet: { readBy: userId }
        }
      );

      console.log('Marked as read:', result.modifiedCount, 'messages');

      // Emit socket event to update unread count in real-time
      if (req.io) {
        req.io.to(conversationId).emit('messages_read', {
          conversationId,
          userId,
          readAt: new Date()
        });
        
        // Emit unread count update to all participants
        const unreadCount = await Message.countDocuments({
          conversationId: conversationId,
          senderId: { $ne: userId },
          isRead: false
        });
        
        req.io.to(conversationId).emit('unread_count_update', {
          conversationId,
          userId,
          unreadCount
        });
      }

      res.json({
        success: true,
        message: `${result.modifiedCount} messages marked as read`,
        data: { modifiedCount: result.modifiedCount }
      });

    } catch (error) {
      console.error('Mark messages as read error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Delete message (soft delete)
  async deleteMessage(req, res) {
    const session = await Message.startSession();
    session.startTransaction();
    
    try {
      const { messageId } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.isAdmin;
      
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }
      
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const hoursOld = messageAge / (1000 * 60 * 60);
      
      // Regular users cannot delete messages older than 24 hours
      if (!isAdmin && hoursOld > 24) {
        throw new Error('Cannot delete messages older than 24 hours');
      }
      
      // Check if user is sender or admin
      const isSender = message.senderId.equals(userId);
      
      if (!isSender && !isAdmin) {
        throw new Error('Not authorized to delete this message');
      }
      
      message.isDeleted = true;
      await message.save({ session });
      
      await session.commitTransaction();
      
      // Notify clients
      if (req.io) {
        req.io.to(message.conversationId.toString()).emit('message_deleted', {
          messageId,
          deletedBy: userId
        });
      }
      
      res.json({
        success: true,
        message: 'Message deleted successfully'
      });
      
    } catch (error) {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        error: error.message
      });
    } finally {
      session.endSession();
    }
  }
}

module.exports = new MessageController();