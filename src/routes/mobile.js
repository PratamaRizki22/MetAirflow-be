const express = require('express');
const router = express.Router();

// Import mobile-specific modules
const paymentRoutes = require('../modules/payments/payments.routes');
const authRoutes = require('./auth');
const bookingRoutes = require('../modules/bookings/bookings.routes');
const propertyRoutes = require('../modules/properties/properties.routes');
const userRoutes = require('../modules/users/users.routes');
const amenityRoutes = require('../modules/amenities/amenities.routes');
const propertyTypeRoutes = require('../modules/propertyTypes/propertyTypes.routes');
const reviewRoutes = require('../modules/reviews/reviews.routes');

/**
 * Mobile API Routes (v1)
 * Base path: /api/v1/m
 *
 * These routes are optimized for mobile app consumption
 * with appropriate response formats and error handling
 */

// Authentication routes
router.use('/auth', authRoutes);

// Payment routes (Stripe integration)
router.use('/payments', paymentRoutes);

// Booking routes
router.use('/bookings', bookingRoutes);

// Property routes
router.use('/properties', propertyRoutes);

// User routes
router.use('/users', userRoutes);

// Amenity routes
router.use('/amenities', amenityRoutes);

// Property type routes
router.use('/property-types', propertyTypeRoutes);

// Review routes
router.use('/reviews', reviewRoutes);

module.exports = router;
