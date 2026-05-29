// backend/src/routes/conversationRoutes.js
const express = require('express');
const router = express.Router();
const {
  createDirectConversation,
  getUserConversations,
  getConversationById
} = require('../controllers/conversationController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Routes
router.post('/direct', createDirectConversation);
router.post('/', createConversation);
router.put('/:id', updateConversation);
router.get('/', getUserConversations);
router.get('/:id', getConversationById);

module.exports = router;