/**
 * Test Helper Functions
 * Common utilities for testing
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('../../config/database');

/**
 * Generate a valid JWT token for testing
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
function generateToken(payload = {}) {
  const defaultPayload = {
    userId: payload.userId || 'test-user-id',
    email: payload.email || 'test@example.com',
    role: payload.role || 'USER',
  };

  const expiresIn = payload.expiresIn || '1h';

  return jwt.sign(
    {
      ...defaultPayload,
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn }
  );
}

/**
 * Create a test user in the database
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user
 */
async function createTestUser(userData = {}) {
  const hashedPassword = await bcrypt.hash(
    userData.password || 'password123',
    10
  );

  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    password: hashedPassword,
    firstName: 'Test',
    lastName: 'User',
    name: 'Test User',
    role: 'USER',
    isActive: true,
  };

  return await prisma.user.create({
    data: { ...defaultUser, ...userData, password: hashedPassword },
  });
}

/**
 * Create a test admin user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created admin user
 */
async function createTestAdmin(userData = {}) {
  return await createTestUser({ ...userData, role: 'ADMIN' });
}

/**
 * Create a test property
 * @param {string} ownerId - Owner user ID
 * @param {Object} propertyData - Property data
 * @returns {Promise<Object>} Created property
 */
async function createTestProperty(ownerId, propertyData = {}) {
  const defaultProperty = {
    title: 'Test Property',
    description: 'A test property for testing',
    address: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    country: 'Test Country',
    zipCode: '12345',
    pricePerNight: 100,
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    propertyType: 'APARTMENT',
    status: 'ACTIVE',
    ownerId,
  };

  return await prisma.property.create({
    data: { ...defaultProperty, ...propertyData },
  });
}

/**
 * Create a test lease (rental booking)
 * @param {string} tenantId - Tenant user ID
 * @param {string} propertyId - Property ID
 * @param {Object} leaseData - Lease data
 * @returns {Promise<Object>} Created lease
 */
async function createTestLease(tenantId, propertyId, leaseData = {}) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 7); // 7 days from now

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 6); // 6 month lease

  const defaultLease = {
    startDate,
    endDate,
    monthlyRent: 1000,
    depositAmount: 2000,
    status: 'PENDING',
    tenantId,
    propertyId,
  };

  return await prisma.lease.create({
    data: { ...defaultLease, ...leaseData },
  });
}

/**
 * Clean up all test data from database
 */
async function cleanupDatabase() {
  // Delete in order of dependencies
  try {
    await prisma.payment.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.lease.deleteMany({});
    await prisma.propertyAmenity.deleteMany({});
    await prisma.propertyRating.deleteMany({});
    await prisma.propertyFavorite.deleteMany({});
    await prisma.propertyView.deleteMany({});
    await prisma.property.deleteMany({});

    // Delete test users - be more comprehensive
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { contains: 'test' } },
          { email: { contains: 'example.com' } },
          { email: { endsWith: '@test.com' } },
        ],
      },
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    // Continue even if cleanup fails
  }
}

/**
 * Wait for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock file object for upload testing
 * @param {string} filename - File name
 * @param {string} mimetype - MIME type
 * @returns {Object} Mock file object
 */
function createMockFile(filename = 'test.jpg', mimetype = 'image/jpeg') {
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype,
    buffer: Buffer.from('fake image content'),
    size: 1024,
  };
}

module.exports = {
  generateToken,
  createTestUser,
  createTestAdmin,
  createTestProperty,
  createTestLease,
  cleanupDatabase,
  wait,
  createMockFile,
};
