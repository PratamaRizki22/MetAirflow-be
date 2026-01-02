const express = require('express');
const { auth } = require('../../middleware/auth');
const reviewsController = require('./reviews.controller');
const {
  createReviewValidation,
  updateReviewValidation,
} = require('./reviews.validation');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated UUID of the review
 *         propertyId:
 *           type: string
 *           description: Property being reviewed
 *         userId:
 *           type: string
 *           description: User who wrote the review
 *         leaseId:
 *           type: string
 *           description: Booking/lease being reviewed
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Star rating (1-5)
 *         comment:
 *           type: string
 *           description: Review text
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/m/reviews:
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - leaseId
 *               - propertyId
 *               - rating
 *               - comment
 *             properties:
 *               leaseId:
 *                 type: string
 *                 format: uuid
 *               propertyId:
 *                 type: string
 *                 format: uuid
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 minLength: 10
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Validation error or booking not eligible for review
 *       401:
 *         description: Unauthorized
 */
router.post('/', auth, createReviewValidation, reviewsController.createReview);

/**
 * @swagger
 * /api/v1/m/reviews/my-reviews:
 *   get:
 *     summary: Get user's reviews
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: User reviews retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/my-reviews', auth, reviewsController.getUserReviews);

/**
 * @swagger
 * /api/v1/m/reviews/{reviewId}:
 *   put:
 *     summary: Update a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 minLength: 10
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to update this review
 *       404:
 *         description: Review not found
 */
router.put(
  '/:reviewId',
  auth,
  updateReviewValidation,
  reviewsController.updateReview
);

/**
 * @swagger
 * /api/v1/m/reviews/{reviewId}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to delete this review
 *       404:
 *         description: Review not found
 */
router.delete('/:reviewId', auth, reviewsController.deleteReview);

/**
 * @swagger
 * /api/v1/m/properties/{propertyId}/reviews:
 *   get:
 *     summary: Get property reviews
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Property reviews retrieved successfully
 */
router.get(
  '/properties/:propertyId/reviews',
  reviewsController.getPropertyReviews
);

/**
 * @swagger
 * /api/v1/m/properties/{propertyId}/rating:
 *   get:
 *     summary: Get property rating summary
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *     responses:
 *       200:
 *         description: Property rating retrieved successfully
 */
router.get(
  '/properties/:propertyId/rating',
  reviewsController.getPropertyRating
);

/**
 * @swagger
 * /api/v1/m/properties/{propertyId}/can-review:
 *   get:
 *     summary: Check if user can review property
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *     responses:
 *       200:
 *         description: Review eligibility checked successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/properties/:propertyId/can-review',
  auth,
  reviewsController.canReview
);

module.exports = router;
