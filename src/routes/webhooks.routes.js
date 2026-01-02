const express = require('express');
const router = express.Router();
const paymentController = require('../modules/payments/payments.controller');

/**
 * @route   POST /api/v1/webhooks/stripe
 * @desc    Handle Stripe webhook events
 * @access  Public (verified by Stripe signature)
 * @note    This endpoint should use raw body parser, not JSON parser
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

module.exports = router;
