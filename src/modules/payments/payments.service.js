const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const AppError = require('../../utils/AppError');

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class PaymentService {
    /**
     * Create Payment Sheet parameters for mobile app
     * This creates a PaymentIntent and ephemeral key for Stripe Payment Sheet
     */
    async createPaymentSheet(bookingId, userId) {
        try {
            // 1. Get booking details
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: {
                    property: {
                        select: {
                            title: true,
                            pricePerNight: true,
                        },
                    },
                    user: {
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
            if (booking.userId !== userId) {
                throw new AppError('Unauthorized access to booking', 403);
            }

            // Check if booking is already paid
            if (booking.status === 'confirmed') {
                throw new AppError('Booking already paid', 400);
            }

            // 2. Get or create Stripe customer
            let customer;
            const existingCustomer = await prisma.user.findUnique({
                where: { id: userId },
                select: { stripeCustomerId: true },
            });

            if (existingCustomer?.stripeCustomerId) {
                customer = await stripe.customers.retrieve(existingCustomer.stripeCustomerId);
            } else {
                customer = await stripe.customers.create({
                    email: booking.user.email,
                    name: booking.user.name,
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
            let payment = await prisma.payment.findFirst({
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
                payment = await prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        paymentIntentId: paymentIntent.id,
                        amount: booking.totalPrice,
                    },
                });
            } else {
                payment = await prisma.payment.create({
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
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            if (paymentIntent.status !== 'succeeded') {
                throw new AppError('Payment not successful', 400);
            }

            // 2. Find payment record
            const payment = await prisma.payment.findFirst({
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
            const updatedPayment = await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                },
            });

            // 4. Update booking status to confirmed
            await prisma.booking.update({
                where: { id: bookingId },
                data: {
                    status: 'confirmed',
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
            const skip = (page - 1) * limit;
            const where = { userId };

            if (status) {
                where.status = status;
            }

            const [payments, total] = await Promise.all([
                prisma.payment.findMany({
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
                prisma.payment.count({ where }),
            ]);

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
            console.error('Get payment history error:', error);
            throw new AppError('Failed to get payment history', 500);
        }
    }

    /**
     * Get payment details by ID
     */
    async getPaymentDetails(paymentId, userId) {
        try {
            const payment = await prisma.payment.findUnique({
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

            if (!payment) {
                throw new AppError('Payment not found', 404);
            }

            // Verify user owns this payment
            if (payment.userId !== userId) {
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
            const payment = await prisma.payment.findFirst({
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
            await prisma.payment.update({
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
            const payment = await prisma.payment.findFirst({
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
                throw new AppError('Refund window expired (must be within 7 days)', 400);
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
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'refunded',
                    refundedAt: new Date(),
                },
            });

            // 5. Update booking status
            await prisma.booking.update({
                where: { id: bookingId },
                data: {
                    status: 'cancelled',
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

                case 'payment_intent.payment_failed':
                    await this.handlePaymentFailure(event.data.object);
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
        const payment = await prisma.payment.findFirst({
            where: { paymentIntentId: paymentIntent.id },
        });

        if (payment && payment.status === 'pending') {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                },
            });

            await prisma.booking.update({
                where: { id: payment.bookingId },
                data: {
                    status: 'confirmed',
                    paymentStatus: 'paid',
                },
            });
        }
    }

    async handlePaymentFailure(paymentIntent) {
        const payment = await prisma.payment.findFirst({
            where: { paymentIntentId: paymentIntent.id },
        });

        if (payment) {
            await prisma.payment.update({
                where: { id: payment.id },
                data: { status: 'failed' },
            });
        }
    }

    async handleRefund(charge) {
        const payment = await prisma.payment.findFirst({
            where: { paymentIntentId: charge.payment_intent },
        });

        if (payment) {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'refunded',
                    refundedAt: new Date(),
                },
            });

            await prisma.booking.update({
                where: { id: payment.bookingId },
                data: {
                    status: 'cancelled',
                    paymentStatus: 'refunded',
                },
            });
        }
    }
}

module.exports = new PaymentService();
