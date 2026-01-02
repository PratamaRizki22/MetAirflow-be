const { body } = require('express-validator');

const createReviewValidation = [
  body('leaseId')
    .notEmpty()
    .withMessage('Lease ID is required')
    .isUUID()
    .withMessage('Invalid lease ID format'),
  body('propertyId')
    .notEmpty()
    .withMessage('Property ID is required')
    .isUUID()
    .withMessage('Invalid property ID format'),
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .notEmpty()
    .withMessage('Comment is required')
    .isString()
    .withMessage('Comment must be a string')
    .isLength({ min: 10 })
    .withMessage('Comment must be at least 10 characters'),
];

const updateReviewValidation = [
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .isString()
    .withMessage('Comment must be a string')
    .isLength({ min: 10 })
    .withMessage('Comment must be at least 10 characters'),
];

module.exports = {
  createReviewValidation,
  updateReviewValidation,
};
