const reviewsService = require('./reviews.service');
const { validationResult } = require('express-validator');

class ReviewsController {
  /**
   * Create new review
   * POST /api/v1/m/reviews
   */
  async createReview(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const review = await reviewsService.createReview(req.body, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Review created successfully',
        data: review,
      });
    } catch (error) {
      console.error('Create review error:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.message.includes('not authorized') ||
        error.message.includes('Only COMPLETED') ||
        error.message.includes('already reviewed')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Get property reviews
   * GET /api/v1/m/properties/:propertyId/reviews
   */
  async getPropertyReviews(req, res) {
    try {
      const { propertyId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await reviewsService.getPropertyReviews(
        propertyId,
        page,
        limit
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get property reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Get property rating summary
   * GET /api/v1/m/properties/:propertyId/rating
   */
  async getPropertyRating(req, res) {
    try {
      const { propertyId } = req.params;
      const rating = await reviewsService.getPropertyRating(propertyId);

      res.json({
        success: true,
        data: rating,
      });
    } catch (error) {
      console.error('Get property rating error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Get user's reviews
   * GET /api/v1/m/reviews/my-reviews
   */
  async getUserReviews(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await reviewsService.getUserReviews(
        req.user.id,
        page,
        limit
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get user reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Update review
   * PUT /api/v1/m/reviews/:reviewId
   */
  async updateReview(req, res) {
    try {
      const { reviewId } = req.params;
      const review = await reviewsService.updateReview(
        reviewId,
        req.user.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Review updated successfully',
        data: review,
      });
    } catch (error) {
      console.error('Update review error:', error);

      if (error.message === 'Review not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('not authorized')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Delete review
   * DELETE /api/v1/m/reviews/:reviewId
   */
  async deleteReview(req, res) {
    try {
      const { reviewId } = req.params;
      await reviewsService.deleteReview(reviewId, req.user.id);

      res.json({
        success: true,
        message: 'Review deleted successfully',
      });
    } catch (error) {
      console.error('Delete review error:', error);

      if (error.message === 'Review not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('not authorized')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Check if user can review property
   * GET /api/v1/m/properties/:propertyId/can-review
   */
  async canReview(req, res) {
    try {
      const { propertyId } = req.params;
      const result = await reviewsService.canReview(propertyId, req.user.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Check can review error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}

module.exports = new ReviewsController();
