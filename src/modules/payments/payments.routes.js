const express = require('express');
const router = express.Router();
const paymentController = require('./payments.controller');
const { auth } = require('../../middleware/auth');

/**
 * @route   POST /api/v1/m/payments/payment-sheet
 * @desc    Create Payment Sheet for mobile app
 * @access  Private
 */
router.post('/payment-sheet', auth, paymentController.createPaymentSheet);

/**
 * @route   POST /api/v1/m/payments/confirm
 * @desc    Confirm payment after Stripe payment success
 * @access  Private
 */
router.post('/confirm', auth, paymentController.confirmPayment);

/**
 * @route   GET /api/v1/m/payments/history
 * @desc    Get payment history
 * @access  Private
 */
router.get('/history', auth, paymentController.getPaymentHistory);

/**
 * @route   GET /api/v1/m/payments/:paymentId
 * @desc    Get payment details
 * @access  Private
 */
router.get('/:paymentId', auth, paymentController.getPaymentDetails);

/**
 * @route   POST /api/v1/m/payments/cancel
 * @desc    Cancel pending payment
 * @access  Private
 */
router.post('/cancel', auth, paymentController.cancelPayment);

/**
 * @route   POST /api/v1/m/payments/refund
 * @desc    Request refund for completed payment
 * @access  Private
 */
router.post('/refund', auth, paymentController.requestRefund);

module.exports = router;
