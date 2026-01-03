const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const AppError = require('../../utils/AppError');

const prisma = new PrismaClient();

// Security: Validate Stripe key before initialization
if (!process.env.STRIPE_SECRET_KEY) {
  console.error(
    '⚠️  STRIPE_SECRET_KEY is not configured. Payment features will be disabled.'
  );
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

class PaymentService {
  constructor() {
    // Validate Stripe is initialized
    if (!stripe) {
      console.warn(
        '⚠️  PaymentService initialized without Stripe. Payment features are disabled.'
      );
    }
  }

  /**
   * Create Payment Sheet parameters for mobile app
   * This creates a PaymentIntent and ephemeral key for Stripe Payment Sheet
   */
  async createPaymentSheet(bookingId, userId) {
    // Security: Check if Stripe is configured
    if (!stripe) {
      throw new AppError('Payment service is not configured', 503);
    }

    try {
      // 1. Get booking details (using Lease model)
      const booking = await prisma.lease.findUnique({
        where: { id: bookingId },
        include: {
          property: {
            select: {
              title: true,
              price: true,
              ownerId: true,
            },
          },
          tenant: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          landlord: {
            select: {
              id: true,
              stripeAccountId: true,
              stripeOnboardingComplete: true,
            },
          },
        },
      });

      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      // Verify user owns this booking
      if (booking.tenantId !== userId) {
        throw new AppError('Unauthorized access to booking', 403);
      }

      // Check if booking is already paid
      if (booking.paymentStatus === 'paid') {
        throw new AppError('Booking already paid', 400);
      }

      // Check if landlord has connected Stripe account
      const landlordConnected =
        booking.landlord?.stripeAccountId &&
        booking.landlord?.stripeOnboardingComplete;

      // 2. Get or create Stripe customer
      let customer;
      const existingCustomer = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (existingCustomer?.stripeCustomerId) {
        customer = await stripe.customers.retrieve(
          existingCustomer.stripeCustomerId
        );
      } else {
        customer = await stripe.customers.create({
          email: booking.tenant.email,
          name: booking.tenant.name,
          metadata: {
            userId: userId,
          },
        });

        // Save Stripe customer ID to database
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customer.id },
        });
      }

      // 3. Create or get existing payment record
      let payment = await prisma.stripePayment.findFirst({
        where: {
          bookingId: bookingId,
          status: 'pending',
        },
      });

      // 4. Create PaymentIntent (with or without direct charge to landlord)
      const amount = Math.round(booking.totalPrice * 100); // Convert to cents
      const platformFee = landlordConnected ? Math.round(amount * 0.1) : 0; // 10% platform fee

      const paymentIntentParams = {
        amount: amount,
        currency: 'myr',
        customer: customer.id,
        metadata: {
          bookingId: booking.id,
          userId: userId,
          landlordId: booking.landlordId,
          propertyTitle: booking.property.title,
          directCharge: landlordConnected ? 'true' : 'false',
        },
        automatic_payment_methods: {
          enabled: true,
        },
      };

      // If landlord has Stripe Connect, use direct charge (on_behalf_of)
      if (landlordConnected) {
        paymentIntentParams.application_fee_amount = platformFee;
        paymentIntentParams.on_behalf_of = booking.landlord.stripeAccountId;
        paymentIntentParams.transfer_data = {
          destination: booking.landlord.stripeAccountId,
        };
        console.log(
          '💳 Creating PaymentIntent with direct charge to landlord:',
          {
            landlordAccountId: booking.landlord.stripeAccountId,
            amount: amount / 100,
            platformFee: platformFee / 100,
          }
        );
      } else {
        console.log(
          '⚠️  Landlord Stripe not connected, payment goes to platform account'
        );
      }

      const paymentIntent =
        await stripe.paymentIntents.create(paymentIntentParams);

      // 5. Create ephemeral key for customer
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customer.id },
        { apiVersion: '2024-12-18.acacia' }
      );

      // 6. Save or update payment record
      if (payment) {
        payment = await prisma.stripePayment.update({
          where: { id: payment.id },
          data: {
            paymentIntentId: paymentIntent.id,
            amount: booking.totalPrice,
          },
        });
      } else {
        payment = await prisma.stripePayment.create({
          data: {
            bookingId: booking.id,
            userId: userId,
            amount: booking.totalPrice,
            currency: 'myr',
            paymentIntentId: paymentIntent.id,
            status: 'pending',
          },
        });
      }

      return {
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        paymentId: payment.id,
      };
    } catch (error) {
      console.error('Payment Sheet creation error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create payment sheet', 500);
    }
  }

  /**
   * Confirm payment after successful Stripe payment
   */
  async confirmPayment(bookingId, paymentIntentId, userId) {
    try {
      console.log('🔵 confirmPayment called:', {
        bookingId,
        paymentIntentId,
        userId,
      });

      // Extract actual payment intent ID from secret (mobile sends full secret)
      // Format: pi_xxx_secret_yyy -> we need only pi_xxx
      const actualPaymentIntentId = paymentIntentId.split('_secret_')[0];
      console.log('📋 Extracted payment intent ID:', actualPaymentIntentId);

      // 1. Verify PaymentIntent with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(
        actualPaymentIntentId
      );

      console.log('💳 Stripe payment intent status:', paymentIntent.status);

      if (paymentIntent.status !== 'succeeded') {
        throw new AppError('Payment not successful', 400);
      }

      // 2. Find payment record
      const payment = await prisma.stripePayment.findFirst({
        where: {
          bookingId: bookingId,
          paymentIntentId: actualPaymentIntentId,
        },
        include: {
          booking: true,
        },
      });
      if (!payment) {
        throw new AppError('Payment record not found', 404);
      }

      // Verify user owns this payment
      if (payment.userId !== userId) {
        throw new AppError('Unauthorized access to payment', 403);
      }

      // 3. Update payment status
      const updatedPayment = await prisma.stripePayment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      // 4. Update booking status to confirmed
      await prisma.lease.update({
        where: { id: bookingId },
        data: {
          status: 'APPROVED',
          paymentStatus: 'paid',
        },
      });

      return {
        paymentId: updatedPayment.id,
        bookingId: bookingId,
        amount: updatedPayment.amount,
        status: updatedPayment.status,
        paymentIntentId: paymentIntentId,
        completedAt: updatedPayment.completedAt,
      };
    } catch (error) {
      console.error('Payment confirmation error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to confirm payment', 500);
    }
  }

  /**
   * Get payment history for user
   */
  async getPaymentHistory(userId, { page = 1, limit = 10, status }) {
    try {
      console.log('📊 Getting payment history:', {
        userId,
        page,
        limit,
        status,
      });

      const skip = (page - 1) * limit;
      const where = { userId };

      if (status) {
        where.status = status;
      }

      console.log('🔍 Payment history query where:', where);

      const [payments, total] = await Promise.all([
        prisma.stripePayment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            booking: {
              include: {
                property: {
                  select: {
                    title: true,
                    city: true,
                    state: true,
                    images: true,
                  },
                },
              },
            },
          },
        }),
        prisma.stripePayment.count({ where }),
      ]);

      console.log('✅ Payment history found:', {
        paymentsCount: payments.length,
        total,
        firstPaymentId: payments[0]?.id,
      });

      return {
        payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('❌ Get payment history error:', {
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw new AppError('Failed to get payment history', 500);
    }
  }

  /**
   * Get payment details by ID
   */
  async getPaymentDetails(paymentId, userId) {
    try {
      console.log('Getting payment details for:', { paymentId, userId });

      const payment = await prisma.stripePayment.findUnique({
        where: { id: paymentId },
        include: {
          booking: {
            include: {
              property: {
                select: {
                  title: true,
                  city: true,
                  state: true,
                  images: true,
                  pricePerNight: true,
                },
              },
            },
          },
        },
      });

      console.log('Payment found:', payment ? 'Yes' : 'No');

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      // Verify user owns this payment
      if (payment.userId !== userId) {
        console.log('Unauthorized access attempt:', {
          paymentUserId: payment.userId,
          requestUserId: userId,
        });
        throw new AppError('Unauthorized access to payment', 403);
      }

      return payment;
    } catch (error) {
      console.error('Get payment details error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get payment details', 500);
    }
  }

  /**
   * Cancel pending payment
   */
  async cancelPayment(paymentIntentId, userId) {
    try {
      console.log('🔴 Cancelling payment:', { paymentIntentId, userId });

      // 1. Find payment record with booking details
      const payment = await prisma.stripePayment.findFirst({
        where: { paymentIntentId },
        include: {
          booking: true,
        },
      });

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      console.log('📋 Payment found:', {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        status: payment.status,
        bookingStatus: payment.booking?.status,
      });

      // Verify user owns this payment
      if (payment.userId !== userId) {
        throw new AppError('Unauthorized access to payment', 403);
      }

      if (payment.status !== 'pending') {
        throw new AppError('Cannot cancel completed payment', 400);
      }

      // 2. Cancel PaymentIntent in Stripe
      try {
        await stripe.paymentIntents.cancel(paymentIntentId);
        console.log('✅ Stripe PaymentIntent cancelled');
      } catch (stripeError) {
        console.warn('⚠️  Stripe cancellation warning:', stripeError.message);
        // Continue even if Stripe cancellation fails (might be already cancelled)
      }

      // 3. Update payment status
      await prisma.stripePayment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
      console.log('✅ Payment status updated to failed');

      // 4. Auto-cancel the booking without landlord verification
      if (payment.bookingId && payment.booking) {
        const bookingStatus = payment.booking.status;

        // Only cancel if booking is PENDING or APPROVED (not yet started)
        if (bookingStatus === 'PENDING' || bookingStatus === 'APPROVED') {
          await prisma.lease.update({
            where: { id: payment.bookingId },
            data: {
              status: 'REFUNDED',
              cancelledAt: new Date(),
              cancellationReason: 'Payment cancelled by user',
              paymentStatus: 'failed',
            },
          });
          console.log('✅ Booking auto-cancelled:', payment.bookingId);
        } else {
          console.log('ℹ️  Booking not cancelled - status:', bookingStatus);
        }
      }

      return {
        message: 'Payment and booking cancelled successfully',
        bookingCancelled: payment.bookingId ? true : false,
      };
    } catch (error) {
      console.error('❌ Cancel payment error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to cancel payment', 500);
    }
  }

  /**
   * Request refund for completed payment
   * - If payment < 4 hours: Auto-refund immediately
   * - If payment > 4 hours: Require landlord approval (TODO: implement approval flow)
   */
  async requestRefund(bookingId, userId, reason) {
    try {
      console.log('🔵 Refund request:', { bookingId, userId, reason });

      // 1. Find payment
      const payment = await prisma.stripePayment.findFirst({
        where: {
          bookingId,
          status: 'completed',
        },
        include: {
          booking: {
            include: {
              landlord: true,
            },
          },
        },
      });

      if (!payment) {
        throw new AppError('Payment not found or not completed', 404);
      }

      // Verify user owns this payment
      if (payment.userId !== userId) {
        throw new AppError('Unauthorized access to payment', 403);
      }

      // 2. Check refund eligibility (within 7 days)
      const hoursSincePayment = Math.floor(
        (new Date() - new Date(payment.completedAt)) / (1000 * 60 * 60)
      );

      const daysSincePayment = Math.floor(hoursSincePayment / 24);

      if (daysSincePayment > 7) {
        throw new AppError(
          'Refund window expired (must be within 7 days)',
          400
        );
      }

      // 3. Check if within 4-hour auto-refund window
      if (hoursSincePayment < 4) {
        console.log('⚡ Auto-refund (< 4 hours)');

        // Auto-refund immediately
        const refund = await stripe.refunds.create({
          payment_intent: payment.paymentIntentId,
          reason: 'requested_by_customer',
          metadata: {
            bookingId: bookingId,
            userId: userId,
            reason: reason || 'Customer requested refund within 4 hours',
            autoRefund: 'true',
          },
        });

        // Update payment status
        await prisma.stripePayment.update({
          where: { id: payment.id },
          data: {
            status: 'refunded',
            refundedAt: new Date(),
          },
        });

        // Update booking status to REFUNDED
        await prisma.lease.update({
          where: { id: bookingId },
          data: {
            status: 'REFUNDED',
            paymentStatus: 'refunded',
            cancelledAt: new Date(),
            cancellationReason: reason || 'Refund requested within 4 hours',
          },
        });

        return {
          refundId: refund.id,
          amount: refund.amount / 100,
          status: 'refunded',
          reason: reason,
          autoRefund: true,
          message: 'Refund processed immediately (within 4-hour window)',
        };
      } else {
        console.log('⏳ Refund requires landlord approval (> 4 hours)');

        // Check if pending request already exists
        const existingRequest = await prisma.refundRequest.findFirst({
          where: {
            leaseId: bookingId,
            status: 'PENDING',
          },
        });

        if (existingRequest) {
          throw new AppError('A pending refund request already exists', 400);
        }

        // Create refund request
        const refundRequest = await prisma.refundRequest.create({
          data: {
            leaseId: bookingId,
            requestedBy: userId,
            landlordId: payment.booking.landlordId,
            amount: payment.amount,
            reason: reason || 'Customer requested refund (> 4 hours)',
            status: 'PENDING',
          },
        });

        // TODO: Send notification to landlord

        return {
          success: true,
          refundRequestId: refundRequest.id,
          status: 'pending_approval',
          message:
            'Refund request sent to landlord for approval (payment > 4 hours old)',
          autoRefund: false,
          requiresApproval: true,
        };
      }
    } catch (error) {
      console.error('❌ Refund request error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to process refund request', 500);
    }
  }

  /**
   * Process refund request (Landlord only)
   * @param {string} requestId
   * @param {string} landlordId
   * @param {boolean} approve
   * @param {string} notes
   */
  async processRefundRequest(requestId, landlordId, approve, notes) {
    try {
      console.log('👷 Processing refund request:', {
        requestId,
        landlordId,
        approve,
      });

      // 1. Get request
      const refundRequest = await prisma.refundRequest.findUnique({
        where: { id: requestId },
        include: {
          lease: true,
        },
      });

      if (!refundRequest) {
        throw new AppError('Refund request not found', 404);
      }

      // Verify landlord ownership
      if (refundRequest.landlordId !== landlordId) {
        throw new AppError('Unauthorized to process this request', 403);
      }

      // Verify status
      if (refundRequest.status !== 'PENDING') {
        throw new AppError(
          `Request is already ${refundRequest.status.toLowerCase()}`,
          400
        );
      }

      if (approve) {
        // Find payment to refund
        const payment = await prisma.stripePayment.findFirst({
          where: {
            bookingId: refundRequest.leaseId,
            status: 'completed',
          },
        });

        if (!payment) {
          throw new AppError(
            'Original payment not found or not completed',
            404
          );
        }

        // Process Stripe refund
        const refund = await stripe.refunds.create({
          payment_intent: payment.paymentIntentId,
          reason: 'requested_by_customer',
          metadata: {
            bookingId: refundRequest.leaseId,
            refundRequestId: requestId,
            approvedBy: landlordId,
          },
        });

        // Update StripePayment status
        await prisma.stripePayment.update({
          where: { id: payment.id },
          data: {
            status: 'refunded',
            refundedAt: new Date(),
          },
        });

        // Update RefundRequest status
        await prisma.refundRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            landlordNote: notes,
          },
        });

        // Update Lease status
        await prisma.lease.update({
          where: { id: refundRequest.leaseId },
          data: {
            status: 'REFUNDED',
            paymentStatus: 'refunded',
            cancelledAt: new Date(),
            cancellationReason: `Refund approved by landlord: ${notes || ''}`,
          },
        });

        // TODO: Notify tenant

        return {
          success: true,
          status: 'APPROVED',
          message: 'Refund approved and processed successfully',
          refundId: refund.id,
        };
      } else {
        // Reject request
        await prisma.refundRequest.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            rejectedAt: new Date(),
            landlordNote: notes,
          },
        });

        // TODO: Notify tenant

        return {
          success: true,
          status: 'REJECTED',
          message: 'Refund request rejected',
        };
      }
    } catch (error) {
      console.error('❌ Process refund request error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to process refund request', 500);
    }
  }

  /**
   * Get refund requests for landlord
   */
  async getLandlordRefundRequests(landlordId, status) {
    const where = { landlordId };
    if (status) where.status = status;

    return await prisma.refundRequest.findMany({
      where,
      include: {
        lease: {
          select: {
            id: true,
            property: {
              select: { title: true, address: true },
            },
            startDate: true,
            endDate: true,
          },
        },
        tenant: {
          select: { name: true, email: true, profilePicture: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;

        case 'payment_intent.processing':
          await this.handlePaymentProcessing(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object);
          break;

        case 'payment_intent.requires_action':
          await this.handlePaymentRequiresAction(event.data.object);
          break;

        case 'charge.refunded':
          await this.handleRefund(event.data.object);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  async handlePaymentSuccess(paymentIntent) {
    const payment = await prisma.stripePayment.findFirst({
      where: { paymentIntentId: paymentIntent.id },
    });

    if (payment && payment.status === 'pending') {
      await prisma.stripePayment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      await prisma.lease.update({
        where: { id: payment.bookingId },
        data: {
          status: 'APPROVED',
          paymentStatus: 'paid',
        },
      });
    }
  }

  async handlePaymentProcessing(paymentIntent) {
    const payment = await prisma.stripePayment.findFirst({
      where: { paymentIntentId: paymentIntent.id },
    });

    if (payment && payment.status === 'pending') {
      await prisma.stripePayment.update({
        where: { id: payment.id },
        data: {
          status: 'processing',
        },
      });

      await prisma.lease.update({
        where: { id: payment.bookingId },
        data: {
          paymentStatus: 'processing',
        },
      });
    }
  }

  async handlePaymentFailure(paymentIntent) {
    const payment = await prisma.stripePayment.findFirst({
      where: { paymentIntentId: paymentIntent.id },
    });

    if (payment) {
      await prisma.stripePayment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
    }
  }

  async handlePaymentCanceled(paymentIntent) {
    const payment = await prisma.stripePayment.findFirst({
      where: { paymentIntentId: paymentIntent.id },
    });

    if (payment && payment.status === 'pending') {
      await prisma.stripePayment.update({
        where: { id: payment.id },
        data: {
          status: 'canceled',
        },
      });

      await prisma.lease.update({
        where: { id: payment.bookingId },
        data: {
          paymentStatus: 'canceled',
        },
      });
    }
  }

  async handlePaymentRequiresAction(paymentIntent) {
    const payment = await prisma.stripePayment.findFirst({
      where: { paymentIntentId: paymentIntent.id },
    });

    if (payment && payment.status === 'pending') {
      console.log(`Payment ${payment.id} requires action (3D Secure/OTP)`);

      await prisma.stripePayment.update({
        where: { id: payment.id },
        data: {
          status: 'requires_action',
        },
      });
    }
  }

  async handleRefund(charge) {
    const payment = await prisma.stripePayment.findFirst({
      where: { paymentIntentId: charge.payment_intent },
    });

    if (payment) {
      await prisma.stripePayment.update({
        where: { id: payment.id },
        data: {
          status: 'refunded',
          refundedAt: new Date(),
        },
      });

      await prisma.lease.update({
        where: { id: payment.bookingId },
        data: {
          status: 'REJECTED',
          paymentStatus: 'refunded',
        },
      });
    }
  }

  /**
   * Get landlord revenue statistics from actual Stripe payments
   * @param {string} landlordId - The landlord user ID
   * @param {Date} startDate - Start date for filtering (optional)
   * @param {Date} endDate - End date for filtering (optional)
   * @returns {Object} Revenue statistics
   */
  async getLandlordRevenue(landlordId, startDate = null, endDate = null) {
    try {
      // Build date filter
      const dateFilter = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);

      // Get all completed payments for landlord's properties
      const payments = await prisma.stripePayment.findMany({
        where: {
          status: 'completed',
          completedAt:
            Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
          booking: {
            landlordId: landlordId,
          },
        },
        include: {
          booking: {
            select: {
              id: true,
              checkIn: true,
              checkOut: true,
              totalPrice: true,
              property: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
        orderBy: {
          completedAt: 'desc',
        },
      });

      // Calculate statistics
      const totalRevenue = payments.reduce(
        (sum, payment) => sum + parseFloat(payment.amount),
        0
      );

      // Group by month for monthly revenue
      const monthlyRevenue = {};
      payments.forEach(payment => {
        const date = new Date(payment.completedAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyRevenue[monthKey]) {
          monthlyRevenue[monthKey] = {
            month: monthKey,
            revenue: 0,
            count: 0,
          };
        }

        monthlyRevenue[monthKey].revenue += parseFloat(payment.amount);
        monthlyRevenue[monthKey].count += 1;
      });

      // Get current month revenue
      const currentDate = new Date();
      const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const currentMonthRevenue = monthlyRevenue[currentMonthKey]?.revenue || 0;

      // Count pending payments (processing or pending)
      const pendingPayments = await prisma.stripePayment.count({
        where: {
          status: { in: ['pending', 'processing'] },
          booking: {
            landlordId: landlordId,
          },
        },
      });

      return {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        currentMonthRevenue: parseFloat(currentMonthRevenue.toFixed(2)),
        totalTransactions: payments.length,
        pendingTransactions: pendingPayments,
        monthlyBreakdown: Object.values(monthlyRevenue).map(m => ({
          month: m.month,
          revenue: parseFloat(m.revenue.toFixed(2)),
          count: m.count,
        })),
        recentPayments: payments.slice(0, 10).map(p => ({
          id: p.id,
          amount: parseFloat(p.amount),
          currency: p.currency,
          completedAt: p.completedAt,
          bookingId: p.bookingId,
          propertyTitle: p.booking.property.title,
        })),
      };
    } catch (error) {
      console.error('Get landlord revenue error:', error);
      throw new AppError('Failed to get revenue statistics', 500);
    }
  }

  /**
   * Get landlord payout summary (future: for Stripe Connect payouts)
   * @param {string} landlordId
   * @returns {Object} Payout summary
   */
  async getLandlordPayoutSummary(landlordId) {
    try {
      // Get total completed payments
      const completedPayments = await prisma.stripePayment.aggregate({
        where: {
          status: 'completed',
          booking: {
            landlordId: landlordId,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      // Get refunded amounts
      const refundedPayments = await prisma.stripePayment.aggregate({
        where: {
          status: 'refunded',
          booking: {
            landlordId: landlordId,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      const totalEarned = parseFloat(completedPayments._sum.amount || 0);
      const totalRefunded = parseFloat(refundedPayments._sum.amount || 0);
      const netRevenue = totalEarned - totalRefunded;

      // TODO: When implementing Stripe Connect, calculate actual payouts
      // For now, assume platform takes 10% commission
      const platformFee = netRevenue * 0.1;
      const landlordPayout = netRevenue - platformFee;

      return {
        totalEarned: parseFloat(totalEarned.toFixed(2)),
        totalRefunded: parseFloat(totalRefunded.toFixed(2)),
        netRevenue: parseFloat(netRevenue.toFixed(2)),
        platformFee: parseFloat(platformFee.toFixed(2)),
        landlordPayout: parseFloat(landlordPayout.toFixed(2)),
        completedTransactions: completedPayments._count.id,
        refundedTransactions: refundedPayments._count.id,
      };
    } catch (error) {
      console.error('Get landlord payout summary error:', error);
      throw new AppError('Failed to get payout summary', 500);
    }
  }

  /**
   * Create Stripe Connect account for landlord
   * @param {string} userId - Landlord user ID
   * @param {object} accountInfo - Account information (email, country, etc.)
   * @returns {Object} Account link for onboarding
   */
  async createConnectAccount(userId, accountInfo = {}) {
    if (!stripe) {
      throw new AppError('Payment service is not configured', 503);
    }

    try {
      // Check if user already has a Stripe account
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeAccountId: true, email: true },
      });

      let accountId = existingUser.stripeAccountId;

      // Create new Stripe Connect account if doesn't exist
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express', // Using Express for easier onboarding
          email: accountInfo.email || existingUser.email,
          country: accountInfo.country || 'MY', // Default Malaysia
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
        });

        accountId = account.id;

        // Save Stripe account ID to database
        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeAccountId: accountId,
            stripeAccountStatus: 'pending',
          },
        });

        console.log('✅ Stripe Connect account created:', accountId);
      }

      // Create account link for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.FRONTEND_URL || 'https://rentverse.com'}/landlord/stripe/refresh`,
        return_url: `${process.env.FRONTEND_URL || 'https://rentverse.com'}/landlord/stripe/success`,
        type: 'account_onboarding',
      });

      return {
        accountId,
        onboardingUrl: accountLink.url,
        expiresAt: accountLink.expires_at,
      };
    } catch (error) {
      console.error('Create Connect account error:', error);
      throw new AppError('Failed to create Stripe Connect account', 500);
    }
  }

  /**
   * Get Stripe Connect account status
   * @param {string} userId - Landlord user ID
   * @returns {Object} Account status
   */
  async getConnectAccountStatus(userId) {
    if (!stripe) {
      throw new AppError('Payment service is not configured', 503);
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          stripeAccountId: true,
          stripeAccountStatus: true,
          stripeOnboardingComplete: true,
        },
      });

      if (!user.stripeAccountId) {
        return {
          connected: false,
          onboardingComplete: false,
          status: 'not_created',
          message: 'Stripe account not created yet',
        };
      }

      // Retrieve account from Stripe
      const account = await stripe.accounts.retrieve(user.stripeAccountId);

      // Check if account is fully onboarded
      const chargesEnabled = account.charges_enabled;
      const detailsSubmitted = account.details_submitted;
      const onboardingComplete = chargesEnabled && detailsSubmitted;

      // Update database if status changed
      if (onboardingComplete !== user.stripeOnboardingComplete) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeOnboardingComplete: onboardingComplete,
            stripeAccountStatus: chargesEnabled ? 'active' : 'restricted',
          },
        });
      }

      return {
        connected: true,
        onboardingComplete,
        chargesEnabled,
        detailsSubmitted,
        status: account.charges_enabled ? 'active' : 'restricted',
        accountId: user.stripeAccountId,
        requirements: account.requirements,
      };
    } catch (error) {
      console.error('Get Connect account status error:', error);
      throw new AppError('Failed to get account status', 500);
    }
  }

  /**
   * Create dashboard link for landlord to manage their Stripe account
   * @param {string} userId - Landlord user ID
   * @returns {Object} Dashboard login link
   */
  async createDashboardLink(userId) {
    if (!stripe) {
      throw new AppError('Payment service is not configured', 503);
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeAccountId: true },
      });

      if (!user.stripeAccountId) {
        throw new AppError(
          'Stripe account not found. Please complete onboarding first.',
          404
        );
      }

      // Create login link for Express dashboard
      const loginLink = await stripe.accounts.createLoginLink(
        user.stripeAccountId
      );

      return {
        url: loginLink.url,
        created: loginLink.created,
      };
    } catch (error) {
      console.error('Create dashboard link error:', error);
      throw new AppError('Failed to create dashboard link', 500);
    }
  }
}

module.exports = new PaymentService();
