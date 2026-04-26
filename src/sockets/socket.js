// backend/src/sockets/socket.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`🟢 New client connected: ${socket.id}`);
    
    // User joins a conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
      console.log(`📢 User ${socket.id} joined conversation: ${conversationId}`);
    });
    
    // User leaves a conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(conversationId);
      console.log(`📢 User ${socket.id} left conversation: ${conversationId}`);
    });
    
    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content, senderId, type = 'text' } = data;
        
        // Save message to database
        const message = new Message({
          conversationId,
          senderId,
          content,
          type,
          status: 'sent'
        });
        
        await message.save();
        
        // Update conversation's last message
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: content.substring(0, 100),
          lastMessageAt: new Date(),
          lastMessageSender: senderId
        });
        
        // Populate sender info
        await message.populate('senderId', 'username avatar');
        
        // Emit to all users in the conversation room
        io.to(conversationId).emit('receive_message', {
          ...message.toObject(),
          formattedTime: message.formattedTime
        });
        
        console.log(`💬 Message sent to conversation ${conversationId}`);
        
      } catch (error) {
        console.error(`❌ Error sending message: ${error.message}`);
        socket.emit('message_error', { error: error.message });
      }
    });
    
    // Handle typing indicator
    socket.on('typing_start', ({ conversationId, username }) => {
      socket.to(conversationId).emit('user_typing', { username, isTyping: true });
    });
    
    socket.on('typing_stop', ({ conversationId, username }) => {
      socket.to(conversationId).emit('user_typing', { username, isTyping: false });
    });
    
    // Handle message read receipt
    socket.on('mark_read', async ({ messageId, conversationId, userId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, {
          status: 'read',
          readAt: new Date()
        });
        
        io.to(conversationId).emit('message_read', { messageId, userId });
      } catch (error) {
        console.error(`❌ Error marking read: ${error.message}`);
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔴 Client disconnected: ${socket.id}`);
    });
  });
};