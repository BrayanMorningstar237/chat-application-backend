// backend/src/sockets/socket.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    const joinConversation = (conversationId) => {
      socket.join(conversationId);
      console.log(`User ${socket.id} joined conversation: ${conversationId}`);
    };

    const leaveConversation = (conversationId) => {
      socket.leave(conversationId);
      console.log(`User ${socket.id} left conversation: ${conversationId}`);
    };

    socket.on('join_conversation', joinConversation);
    socket.on('joinConversation', joinConversation);
    socket.on('leave_conversation', leaveConversation);
    socket.on('leaveConversation', leaveConversation);

    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content = '', senderId, type = 'text', attachments = [] } = data;

        const message = new Message({
          conversationId,
          senderId,
          content,
          type,
          attachments,
          status: 'sent',
          isRead: false,
          isDelivered: false,
          readBy: [{ userId: senderId, readAt: new Date() }]
        });

        await message.save();

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: type === 'image' ? 'Photo' : content.substring(0, 100),
          lastMessageAt: new Date(),
          lastMessageSender: senderId
        });

        await message.populate('senderId', 'username avatar');

        io.to(conversationId).emit('receive_message', {
          ...message.toObject(),
          formattedTime: message.formattedTime
        });
        io.to(conversationId).emit('new_message', message);
        io.to(conversationId).emit('newMessage', message);

        console.log(`Message sent to conversation ${conversationId}`);
      } catch (error) {
        console.error(`Error sending message: ${error.message}`);
        socket.emit('message_error', { error: error.message });
      }
    });

    socket.on('typing_start', ({ conversationId, username }) => {
      socket.to(conversationId).emit('user_typing', { username, isTyping: true });
    });

    socket.on('typing_stop', ({ conversationId, username }) => {
      socket.to(conversationId).emit('user_typing', { username, isTyping: false });
    });

    socket.on('mark_read', async ({ messageId, conversationId, userId }) => {
      try {
        const readAt = new Date();
        await Message.findByIdAndUpdate(messageId, {
          status: 'read',
          isRead: true,
          readAt,
          $addToSet: { readBy: { userId, readAt } }
        });

        io.to(conversationId).emit('message_read', { messageId, userId, readAt });
        io.to(conversationId).emit('messageRead', { messageId, userId, readAt });
      } catch (error) {
        console.error(`Error marking read: ${error.message}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};
