const app = require('./src/app');
const { disconnectDB } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

// Graceful shutdown
const gracefulShutdown = async signal => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  try {
    await disconnectDB();
    console.log('👋 Database disconnected successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
// Start server with Socket.IO
const server = require('http').createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for mobile app
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // Join conversation room
  socket.on('join_room', (conversationId) => {
    socket.join(conversationId);
    console.log(`👤 User ${socket.id} joined room: ${conversationId}`);
  });

  // Leave conversation room
  socket.on('leave_room', (conversationId) => {
    socket.leave(conversationId);
    console.log(`👋 User ${socket.id} left room: ${conversationId}`);
  });

  // Handle sending messages
  socket.on('send_message', (data) => {
    const { conversationId, message } = data;
    console.log(`📨 Message in ${conversationId}:`, message.id);

    // Broadcast to everyone in the room INCLUDING sender (for acknowledgement/optimistic UI confirmation if needed)
    // Or use socket.to(conversationId).emit(...) to send to everyone EXCEPT sender
    io.to(conversationId).emit('receive_message', message);
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('🚀 ===================================');
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🚀 Socket.IO is ready`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('🚀 ===================================');
  console.log('');
  console.log('📚 API Documentation:');
  console.log(`📄   http://localhost:${PORT}/docs`);
  console.log('');
  console.log('🏥 Health Check:');
  console.log(`🏥   http://localhost:${PORT}/health`);
  console.log('');
  console.log('🔗 API Base URL:');
  console.log(`🔗   http://localhost:${PORT}/api/v1`);
  console.log('');
});
