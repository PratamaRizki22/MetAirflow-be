const express = require('express');
const router = express.Router();
const paymentController = require('./payments.controller');
const { authenticate } = require('../../middleware/auth');

/**
 * @route   POST /api/v1/m/payments/payment-sheet
 * @desc    Create Payment Sheet for mobile app
 * @access  Private
 */
router.post(
  '/payment-sheet',
  authenticate,
  paymentController.createPaymentSheet
);

/**
 * @route   POST /api/v1/m/payments/confirm
 * @desc    Confirm payment after Stripe payment success
 * @access  Private
 */
router.post('/confirm', authenticate, paymentController.confirmPayment);

/**
 * @route   GET /api/v1/m/payments/history
 * @desc    Get payment history
 * @access  Private
 */
router.get('/history', authenticate, paymentController.getPaymentHistory);

/**
 * @route   GET /api/v1/m/payments/:paymentId
 * @desc    Get payment details
 * @access  Private
 */
router.get('/:paymentId', authenticate, paymentController.getPaymentDetails);

/**
 * @route   POST /api/v1/m/payments/cancel
 * @desc    Cancel pending payment
 * @access  Private
 */
router.post('/cancel', authenticate, paymentController.cancelPayment);

/**
 * @route   POST /api/v1/m/payments/refund
 * @desc    Request refund for completed payment
 * @access  Private
 */
router.post('/refund', authenticate, paymentController.requestRefund);

module.exports = router;
