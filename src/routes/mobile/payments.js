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

/**
 * @route   GET /api/v1/m/payments/landlord/revenue
 * @desc    Get landlord revenue statistics from Stripe payments
 * @access  Private (Landlord only)
 * @query   startDate?, endDate?
 */
router.get('/landlord/revenue', auth, paymentController.getLandlordRevenue);

/**
 * @route   GET /api/v1/m/payments/landlord/payout
 * @desc    Get landlord payout summary
 * @access  Private (Landlord only)
 */
router.get(
  '/landlord/payout',
  auth,
  paymentController.getLandlordPayoutSummary
);

/**
 * @route   POST /api/v1/m/payments/connect/create
 * @desc    Create Stripe Connect account for landlord
 * @access  Private (Landlord only)
 * @body    { email?: string, country?: string }
 */
router.post('/connect/create', auth, paymentController.createConnectAccount);

/**
 * @route   GET /api/v1/m/payments/connect/status
 * @desc    Get Stripe Connect account status
 * @access  Private (Landlord only)
 */
router.get('/connect/status', auth, paymentController.getConnectAccountStatus);

/**
 * @route   POST /api/v1/m/payments/connect/dashboard
 * @desc    Create dashboard link to manage Stripe account
 * @access  Private (Landlord only)
 */
router.post('/connect/dashboard', auth, paymentController.createDashboardLink);

module.exports = router;
