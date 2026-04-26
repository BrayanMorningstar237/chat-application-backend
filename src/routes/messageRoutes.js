// backend/src/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Routes
router.post('/', messageController.sendMessage);
router.get('/:conversationId', messageController.getMessages);
router.delete('/:messageId', messageController.deleteMessage);

module.exports = router;