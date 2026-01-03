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

  const paymentSheet = await paymentService.createPaymentSheet(
    bookingId,
    userId
  );

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

  const payment = await paymentService.confirmPayment(
    bookingId,
    paymentIntentId,
    userId
  );

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
  console.log('🔍 Payment history request:', {
    userId: req.user.id,
    query: req.query,
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
    },
  });

  const userId = req.user.id;
  const { page, limit, status } = req.query;

  const result = await paymentService.getPaymentHistory(userId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    status,
  });

  console.log('✅ Payment history result:', {
    userId,
    paymentsCount: result.payments?.length || 0,
    pagination: result.pagination,
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
 * Process refund request (Landlord)
 * POST /api/v1/m/payments/refund-request/:requestId/process
 */
exports.processRefundRequest = catchAsync(async (req, res) => {
  const { requestId } = req.params;
  const { approve, notes } = req.body;
  const landlordId = req.user.id;

  if (typeof approve !== 'boolean') {
    throw new AppError('Approval decision (approve: boolean) is required', 400);
  }

  const result = await paymentService.processRefundRequest(
    requestId,
    landlordId,
    approve,
    notes
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Get refund requests (Landlord)
 * GET /api/v1/m/payments/refund-requests
 */
exports.getRefundRequests = catchAsync(async (req, res) => {
  const landlordId = req.user.id;
  const { status } = req.query;

  const requests = await paymentService.getLandlordRefundRequests(
    landlordId,
    status
  );

  res.status(200).json({
    success: true,
    data: requests,
  });
});

/**
 * Get landlord revenue statistics from Stripe payments
 * GET /api/v1/m/payments/landlord/revenue
 */
exports.getLandlordRevenue = catchAsync(async (req, res) => {
  const landlordId = req.user.id;
  const { startDate, endDate } = req.query;

  const revenue = await paymentService.getLandlordRevenue(
    landlordId,
    startDate,
    endDate
  );

  res.status(200).json({
    success: true,
    message: 'Revenue statistics retrieved successfully',
    data: revenue,
  });
});

/**
 * Get landlord payout summary
 * GET /api/v1/m/payments/landlord/payout
 */
exports.getLandlordPayoutSummary = catchAsync(async (req, res) => {
  const landlordId = req.user.id;

  const payout = await paymentService.getLandlordPayoutSummary(landlordId);

  res.status(200).json({
    success: true,
    message: 'Payout summary retrieved successfully',
    data: payout,
  });
});

/**
 * Create Stripe Connect account for landlord
 * POST /api/v1/m/payments/connect/create
 */
exports.createConnectAccount = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { email, country } = req.body;

  const result = await paymentService.createConnectAccount(userId, {
    email,
    country,
  });

  res.status(200).json({
    success: true,
    message: 'Stripe Connect account created. Please complete onboarding.',
    data: result,
  });
});

/**
 * Get Stripe Connect account status
 * GET /api/v1/m/payments/connect/status
 */
exports.getConnectAccountStatus = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const status = await paymentService.getConnectAccountStatus(userId);

  res.status(200).json({
    success: true,
    message: 'Connect account status retrieved successfully',
    data: status,
  });
});

/**
 * Create Stripe dashboard link for landlord
 * POST /api/v1/m/payments/connect/dashboard
 */
exports.createDashboardLink = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const link = await paymentService.createDashboardLink(userId);

  res.status(200).json({
    success: true,
    message: 'Dashboard link created successfully',
    data: link,
  });
});

/**
 * Handle Stripe webhooks
 * POST /api/v1/webhooks/stripe
 */
exports.handleWebhook = catchAsync(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  // Security: Validate required secrets
  if (!webhookSecret) {
    throw new AppError('Webhook secret not configured', 500);
  }

  if (!stripeSecretKey) {
    throw new AppError('Stripe secret key not configured', 500);
  }

  if (!sig) {
    throw new AppError('Missing stripe-signature header', 400);
  }

  let event;

  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(stripeSecretKey);

    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    throw new AppError(`Webhook Error: ${err.message}`, 400);
  }

  // Handle the event
  await paymentService.handleWebhook(event);

  res.status(200).json({ received: true });
});
