const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ChatService {
  // Create or get conversation between tenant and landlord for a property
  async createOrGetConversation(propertyId, tenantId) {
    // Check if property exists and get landlord
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });

    if (!property) {
      throw new Error('Property not found');
    }

    const landlordId = property.ownerId;
    console.log(
      `[UnifiedChat] Lookup conversation for Tenant: ${tenantId} and Landlord: ${landlordId}`
    );

    // Prevent self-conversation
    if (tenantId === landlordId) {
      throw new Error('Cannot create conversation with yourself');
    }

    // Find existing conversation (Unified Chat: find ANY conversation between tenant and landlord)
    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        landlordId,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        property: { select: { title: true } },
        tenant: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
        landlord: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (conversation) {
      console.log(
        `[UnifiedChat] Found existing conversation: ${conversation.id}`
      );
    } else {
      console.log(
        `[UnifiedChat] No existing conversation found. Creating new one.`
      );
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          propertyId,
          tenantId,
          landlordId,
        },
        include: {
          property: { select: { title: true } },
          tenant: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
            },
          },
          landlord: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
            },
          },
          messages: true,
        },
      });
    }

    return conversation;
  }

  // Get conversations for user (tenant or landlord)
  async getConversations(userId) {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ tenantId: userId }, { landlordId: userId }],
      },
      include: {
        property: { select: { title: true, images: true } },
        tenant: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
        landlord: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: userId },
                readAt: null,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map(conv => ({
      ...conv,
      lastMessage: conv.messages[0] || null,
      unreadCount: conv._count.messages,
    }));
  }

  // Get messages in conversation
  async getMessages(conversationId, userId, page = 1, limit = 50) {
    // Verify user has access to this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ tenantId: userId }, { landlordId: userId }],
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    const skip = (page - 1) * limit;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // Count messages sent by current user (for rate limiting)
    const sentCount = await prisma.message.count({
      where: {
        conversationId,
        senderId: userId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    return {
      messages: messages.reverse(), // Return in chronological order
      sentCount,
    };
  }

  // Send message
  async sendMessage(conversationId, senderId, content, type = 'TEXT') {
    // Verify user has access to this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ tenantId: senderId }, { landlordId: senderId }],
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    // Rate limiting: max 50 messages per day
    const todayMessageCount = await prisma.message.count({
      where: {
        conversationId,
        senderId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (todayMessageCount >= 50) {
      throw new Error('Daily message limit reached (50 messages per day)');
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: content.trim(),
        type,
      },
      include: {
        sender: { select: { name: true, email: true } },
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  // Mark messages as read
  async markAsRead(conversationId, userId) {
    // Verify user has access to this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ tenantId: userId }, { landlordId: userId }],
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    // Mark unread messages as read
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId }, // Only mark messages from other user
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { success: true };
  }
}

module.exports = new ChatService();
