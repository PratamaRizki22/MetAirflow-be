const express = require('express');
const router = express.Router();
const chatService = require('../services/chat.service');
const { auth } = require('../middleware/auth');

// Create or get conversation
router.post('/conversations', auth, async (req, res) => {
  try {
    const { propertyId } = req.body;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Property ID is required',
      });
    }

    const conversation = await chatService.createOrGetConversation(
      propertyId,
      req.user.id
    );

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Get conversations for user
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await chatService.getConversations(req.user.id);

    res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get messages in conversation
router.get('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await chatService.getMessages(
      conversationId,
      req.user.id,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Send message
router.post('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { content, type = 'TEXT' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required',
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message too long (max 1000 characters)',
      });
    }

    const message = await chatService.sendMessage(
      conversationId,
      req.user.id,
      content,
      type
    );

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Mark messages as read
router.patch('/conversations/:id/read', auth, async (req, res) => {
  try {
    const { id: conversationId } = req.params;

    const result = await chatService.markAsRead(conversationId, req.user.id);

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
