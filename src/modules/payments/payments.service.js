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
            },
          },
          tenant: {
            select: {
              id: true,
              email: true,
              name: true,
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

      // 4. Create PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(booking.totalPrice * 100), // Convert to cents
        currency: 'myr',
        customer: customer.id,
        metadata: {
          bookingId: booking.id,
          userId: userId,
          propertyTitle: booking.property.title,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

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
      // 1. Verify PaymentIntent with Stripe
      const paymentIntent =
        await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new AppError('Payment not successful', 400);
      }

      // 2. Find payment record
      const payment = await prisma.stripePayment.findFirst({
        where: {
          bookingId: bookingId,
          paymentIntentId: paymentIntentId,
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
      // 1. Find payment record
      const payment = await prisma.stripePayment.findFirst({
        where: { paymentIntentId },
      });

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      // Verify user owns this payment
      if (payment.userId !== userId) {
        throw new AppError('Unauthorized access to payment', 403);
      }

      if (payment.status !== 'pending') {
        throw new AppError('Cannot cancel completed payment', 400);
      }

      // 2. Cancel PaymentIntent in Stripe
      await stripe.paymentIntents.cancel(paymentIntentId);

      // 3. Update payment status
      await prisma.stripePayment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });

      return { message: 'Payment cancelled successfully' };
    } catch (error) {
      console.error('Cancel payment error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to cancel payment', 500);
    }
  }

  /**
   * Request refund for completed payment
   */
  async requestRefund(bookingId, userId, reason) {
    try {
      // 1. Find payment
      const payment = await prisma.stripePayment.findFirst({
        where: {
          bookingId,
          status: 'completed',
        },
        include: {
          booking: true,
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
      const daysSincePayment = Math.floor(
        (new Date() - new Date(payment.completedAt)) / (1000 * 60 * 60 * 24)
      );

      if (daysSincePayment > 7) {
        throw new AppError(
          'Refund window expired (must be within 7 days)',
          400
        );
      }

      // 3. Create refund in Stripe
      const refund = await stripe.refunds.create({
        payment_intent: payment.paymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          bookingId: bookingId,
          userId: userId,
          reason: reason || 'Customer requested refund',
        },
      });

      // 4. Update payment status
      await prisma.stripePayment.update({
        where: { id: payment.id },
        data: {
          status: 'refunded',
          refundedAt: new Date(),
        },
      });

      // 5. Update booking status
      await prisma.lease.update({
        where: { id: bookingId },
        data: {
          status: 'REJECTED',
          paymentStatus: 'refunded',
        },
      });

      return {
        refundId: refund.id,
        amount: refund.amount / 100, // Convert from cents
        status: refund.status,
        reason: reason,
        createdAt: new Date(refund.created * 1000),
      };
    } catch (error) {
      console.error('Refund request error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to process refund', 500);
    }
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
}

module.exports = new PaymentService();
