const express = require('express');
const router = express.Router();
const paymentController = require('../../modules/payments/payments.controller');
const { auth } = require('../../middleware/auth');

/**
 * Mobile Payment Routes
 * Base path: /api/v1/m/payments
 */

/**
 * @route   POST /api/v1/m/payments/payment-sheet
 * @desc    Create Payment Sheet for Stripe mobile integration
 * @access  Private
 * @body    { bookingId: string }
 */
router.post('/payment-sheet', auth, paymentController.createPaymentSheet);

/**
 * @route   POST /api/v1/m/payments/confirm
 * @desc    Confirm payment after successful Stripe payment
 * @access  Private
 * @body    { bookingId: string, paymentIntentId: string }
 */
router.post('/confirm', auth, paymentController.confirmPayment);

/**
 * @route   GET /api/v1/m/payments/history
 * @desc    Get user's payment history
 * @access  Private
 * @query   page, limit, status
 */
router.get('/history', auth, paymentController.getPaymentHistory);

/**
 * @route   GET /api/v1/m/payments/:paymentId
 * @desc    Get specific payment details
 * @access  Private
 * @param   paymentId
 */
router.get('/:paymentId', auth, paymentController.getPaymentDetails);

/**
 * @route   POST /api/v1/m/payments/cancel
 * @desc    Cancel a pending payment
 * @access  Private
 * @body    { paymentIntentId: string }
 */
router.post('/cancel', auth, paymentController.cancelPayment);

/**
 * @route   POST /api/v1/m/payments/refund
 * @desc    Request refund for a completed payment
 * @access  Private
 * @body    { bookingId: string, reason?: string }
 */
router.post('/refund', auth, paymentController.requestRefund);

module.exports = router;
