/**
 * Global Test Setup
 * This file runs before all tests to set up the test environment
 */

const { prisma } = require('../config/database');

// Set test environment
process.env.NODE_ENV = 'test';

// Global setup before all tests
beforeAll(async () => {
  // Connect to test database
  try {
    await prisma.$connect();
    console.log('Connected to test database');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
});

// Clean up after all tests
afterAll(async () => {
  // Disconnect from database
  await prisma.$disconnect();
  console.log('Disconnected from test database');
});

// Clean up between test suites
beforeEach(async () => {
  // This can be used to clean up data between tests if needed
  // For now, we'll keep it empty and clean up in individual test files
});

afterEach(async () => {
  // Clean up after each test if needed
});

// Global error handler for unhandled rejections
process.on('unhandledRejection', error => {
  console.error('Unhandled rejection in tests:', error);
});
