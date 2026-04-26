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
      
      console.log('Sending message:', { conversationId, content, senderId }); // DEBUG
      
      // BR8: Message size limit (5MB)
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
        status: 'sent'
      });
      
      await message.save({ session });
      
      // Update conversation last message
      conversation.lastMessage = content.substring(0, 100);
      conversation.lastMessageAt = new Date();
      conversation.lastMessageSender = senderId;
      await conversation.save({ session });
      
      await session.commitTransaction();
      
      // COMMENT OUT FOR NOW - Fix later
      // if (req.io) {
      //   req.io.to(conversationId).emit('new_message', message);
      // }
      
      console.log('Message sent successfully:', message._id); // DEBUG
      
      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: message
      });
      
    } catch (error) {
      await session.abortTransaction();
      console.error('Send message error:', error); // DEBUG
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
      
      console.log('Getting messages for:', conversationId); // DEBUG
      
      // BR3: Users can only see their own conversations
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
      console.error('Get messages error:', error); // DEBUG
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Delete message (soft delete with BR3)
  async deleteMessage(req, res) {
    const session = await Message.startSession();
    session.startTransaction();
    
    try {
      const { messageId } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.isAdmin;
      
      const message = await Message.findById(messageId)
        .populate('conversationId');
      
      if (!message) {
        throw new Error('Message not found');
      }
      
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const hoursOld = messageAge / (1000 * 60 * 60);
      
      // BR3: Regular users cannot delete messages older than 24 hours
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