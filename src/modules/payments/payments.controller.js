const paymentService = require('./payments.service');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');

/**
 * Create Payment Sheet for mobile app
 * POST /api/v1/m/payments/payment-sheet
 */
exports.createPaymentSheet = catchAsync(async (req, res) => {
    const { bookingId } = req.body;
    const userId = req.user.id;

    if (!bookingId) {
        throw new AppError('Booking ID is required', 400);
    }

    const paymentSheet = await paymentService.createPaymentSheet(bookingId, userId);

    res.status(200).json({
        success: true,
        data: paymentSheet,
    });
});

/**
 * Confirm payment after Stripe payment success
 * POST /api/v1/m/payments/confirm
 */
exports.confirmPayment = catchAsync(async (req, res) => {
    const { bookingId, paymentIntentId } = req.body;
    const userId = req.user.id;

    if (!bookingId || !paymentIntentId) {
        throw new AppError('Booking ID and Payment Intent ID are required', 400);
    }

    const payment = await paymentService.confirmPayment(bookingId, paymentIntentId, userId);

    res.status(200).json({
        success: true,
        data: payment,
    });
});

/**
 * Get payment history
 * GET /api/v1/m/payments/history
 */
exports.getPaymentHistory = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { page, limit, status } = req.query;

    const result = await paymentService.getPaymentHistory(userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        status,
    });

    res.status(200).json({
        success: true,
        data: result,
    });
});

/**
 * Get payment details
 * GET /api/v1/m/payments/:paymentId
 */
exports.getPaymentDetails = catchAsync(async (req, res) => {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const payment = await paymentService.getPaymentDetails(paymentId, userId);

    res.status(200).json({
        success: true,
        data: payment,
    });
});

/**
 * Cancel payment
 * POST /api/v1/m/payments/cancel
 */
exports.cancelPayment = catchAsync(async (req, res) => {
    const { paymentIntentId } = req.body;
    const userId = req.user.id;

    if (!paymentIntentId) {
        throw new AppError('Payment Intent ID is required', 400);
    }

    const result = await paymentService.cancelPayment(paymentIntentId, userId);

    res.status(200).json({
        success: true,
        ...result,
    });
});

/**
 * Request refund
 * POST /api/v1/m/payments/refund
 */
exports.requestRefund = catchAsync(async (req, res) => {
    const { bookingId, reason } = req.body;
    const userId = req.user.id;

    if (!bookingId) {
        throw new AppError('Booking ID is required', 400);
    }

    const refund = await paymentService.requestRefund(bookingId, userId, reason);

    res.status(200).json({
        success: true,
        data: refund,
    });
});

/**
 * Handle Stripe webhooks
 * POST /api/v1/webhooks/stripe
 */
exports.handleWebhook = catchAsync(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        throw new AppError(`Webhook Error: ${err.message}`, 400);
    }

    // Handle the event
    await paymentService.handleWebhook(event);

    res.status(200).json({ received: true });
});
