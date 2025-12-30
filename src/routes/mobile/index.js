/**
 * Mobile Routes Index
 * All mobile API routes are prefixed with /api/v1/m/
 */

const express = require('express');
const router = express.Router();

// Import mobile routes
const authRoutes = require('./auth');
const usersRoutes = require('./users');
const propertiesRoutes = require('./properties');
const bookingsRoutes = require('./bookings');
const propertyTypesRoutes = require('./propertyTypes');
const amenitiesRoutes = require('./amenities');
const uploadRoutes = require('./upload');
const paymentsRoutes = require('./payments');
const agreementsRoutes = require('../../modules/agreements/agreements.routes');
const reviewsRoutes = require('../../modules/reviews/reviews.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/properties', propertiesRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/property-types', propertyTypesRoutes);
router.use('/amenities', amenitiesRoutes);
router.use('/upload', uploadRoutes);
router.use('/payments', paymentsRoutes);
router.use('/agreements', agreementsRoutes);
router.use('/', reviewsRoutes); // Reviews routes (includes /reviews and /properties/:id/reviews)

/**
 * @swagger
 * /api/v1/m:
 *   get:
 *     summary: Mobile API Welcome endpoint
 *     tags: [Mobile - General]
 *     responses:
 *       200:
 *         description: Mobile API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 version:
 *                   type: string
 *                 docs:
 *                   type: string
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Rentverse Mobile API',
    version: '1.0.0',
    docs: 'Visit /m/docs for Mobile API documentation',
    endpoints: {
      auth: '/api/v1/m/auth',
      users: '/api/v1/m/users',
      properties: '/api/v1/m/properties',
      bookings: '/api/v1/m/bookings',
      propertyTypes: '/api/v1/m/property-types',
      amenities: '/api/v1/m/amenities',
      upload: '/api/v1/m/upload',
      payments: '/api/v1/m/payments',
      reviews: '/api/v1/m/reviews',
    },
  });
});

/**
 * @swagger
 * /api/v1/m/health:
 *   get:
 *     summary: Mobile API Health check
 *     tags: [Mobile - General]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 platform:
 *                   type: string
 */
router.get('/health', async (req, res) => {
  try {
    const { prisma } = require('../../config/database');
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      platform: 'mobile',
      database: 'Connected',
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      platform: 'mobile',
      database: 'Disconnected',
      error: error.message,
    });
  }
});

module.exports = router;
