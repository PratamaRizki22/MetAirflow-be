const { PrismaClient } = require('@prisma/client');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();

class RefundService {
  // Create refund request (tenant)
  async createRefundRequest(leaseId, userId, reason) {
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        property: true,
        stripePayments: { where: { status: 'completed' } },
      },
    });

    if (!lease) throw new Error('Booking not found');
    if (lease.tenantId !== userId) throw new Error('Unauthorized');
    if (lease.status === 'REFUNDED') throw new Error('Already refunded');

    const completedPayment = lease.stripePayments[0];
    if (!completedPayment) throw new Error('No completed payment found');

    return await prisma.refundRequest.create({
      data: {
        leaseId,
        requestedBy: userId,
        landlordId: lease.landlordId,
        reason,
        amount: completedPayment.amount,
      },
    });
  }

  // Get refund requests (filtered by role)
  async getRefundRequests(userId, role) {
    const where =
      role === 'landlord' ? { landlordId: userId } : { requestedBy: userId };

    return await prisma.refundRequest.findMany({
      where,
      include: {
        lease: {
          include: { property: { select: { title: true, images: true } } },
        },
        tenant: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Approve refund (landlord)
  async approveRefund(refundRequestId, landlordId, note) {
    const refundRequest = await prisma.refundRequest.findUnique({
      where: { id: refundRequestId },
      include: {
        lease: {
          include: { stripePayments: { where: { status: 'completed' } } },
        },
      },
    });

    if (!refundRequest) throw new Error('Refund request not found');
    if (refundRequest.landlordId !== landlordId)
      throw new Error('Unauthorized');
    if (refundRequest.status !== 'PENDING')
      throw new Error('Request already processed');

    // Process Stripe refund
    const payment = refundRequest.lease.stripePayments[0];
    if (payment?.paymentIntentId) {
      await stripe.refunds.create({
        payment_intent: payment.paymentIntentId,
        reason: 'requested_by_customer',
      });
    }

    // Update refund request and lease
    await prisma.$transaction([
      prisma.refundRequest.update({
        where: { id: refundRequestId },
        data: {
          status: 'APPROVED',
          landlordNote: note,
          approvedAt: new Date(),
        },
      }),
      prisma.lease.update({
        where: { id: refundRequest.leaseId },
        data: { status: 'REFUNDED', paymentStatus: 'refunded' },
      }),
    ]);

    return { success: true, message: 'Refund approved and processed' };
  }

  // Reject refund (landlord)
  async rejectRefund(refundRequestId, landlordId, note) {
    const refundRequest = await prisma.refundRequest.findUnique({
      where: { id: refundRequestId },
    });

    if (!refundRequest) throw new Error('Refund request not found');
    if (refundRequest.landlordId !== landlordId)
      throw new Error('Unauthorized');
    if (refundRequest.status !== 'PENDING')
      throw new Error('Request already processed');

    await prisma.refundRequest.update({
      where: { id: refundRequestId },
      data: {
        status: 'REJECTED',
        landlordNote: note,
        rejectedAt: new Date(),
      },
    });

    return { success: true, message: 'Refund request rejected' };
  }
}

module.exports = new RefundService();
