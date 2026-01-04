/**
 * @swagger
 * tags:
 *   - name: Mobile - Bookings
 *     description: Booking endpoints for mobile app
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../../middleware/auth');
const { prisma } = require('../../config/database');

const router = express.Router();

/**
 * @swagger
 * /api/v1/m/bookings:
 *   get:
 *     summary: Get user's bookings (Mobile)
 *     tags: [Mobile - Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, REFUNDED, COMPLETED]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [tenant, landlord]
 *         description: Get bookings as tenant or landlord
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/admin/all', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const { status } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    const where = {};
    if (status) where.status = status;

    const bookings = await prisma.lease.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            currencyCode: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true,
          },
        },
        landlord: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      success: true,
      data: {
        bookings,
      },
    });
  } catch (error) {
    console.error('Admin get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin bookings',
    });
  }
});

/**
 * @swaggerrouter.get('/', auth, async (req, res) => {
  try {
    console.log('🔵 Bookings endpoint hit:', {
      userId: req.user?.id,
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, role = 'tenant' } = req.query;

    console.log(
      '📋 GET /bookings - User:',
      req.user.id,
      'Role:',
      role,
      'Status:',
      status,
      'Page:',
      page,
      'Limit:',
      limit
    );

    const where =
      role === 'landlord'
        ? { landlordId: req.user.id }
        : {
            tenantId: req.user.id,
            // Show all bookings for tenant, including pending payments
            // Removed the paymentStatus filter to show all bookings
          };

    if (status) where.status = status;

    console.log('🔍 Query where:', JSON.stringify(where));
    console.log('📊 Query params - Skip:', skip, 'Take:', limit);

    const [bookings, total] = await Promise.all([
      prisma.lease.findMany({
        where,
        include: {
          property: {
            include: {
              propertyType: true,
            },
          },
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
              phone: true,
              email: true,
            },
          },
          landlord: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
              phone: true,
              email: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lease.count({ where }),
    ]);

    console.log('✅ Found bookings:', bookings.length, 'Total:', total);

    // Debug: Log booking details for landlord mode
    if (role === 'landlord' && bookings.length > 0) {
      console.log('🏠 Landlord Bookings Details:');
      bookings.forEach((b, i) => {
        console.log(`  ${i + 1}. Property: ${b.property?.title}`);
        console.log(
          `     Tenant: ${b.tenant?.firstName} ${b.tenant?.lastName}`
        );
        console.log(`     Status: ${b.status}, Payment: ${b.paymentStatus}`);
        console.log(
          `     LandlordId: ${b.landlordId}, TenantId: ${b.tenantId}`
        );
      });
    }

    const response = {
      success: true,
      data: {
        bookings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };

    console.log('✅ Sending response:', {
      success: response.success,
      bookingsCount: bookings.length,
      total,
    });

    res.json(response);
  } catch (error) {
    console.error('❌ Get bookings error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/bookings/{id}:
 *   get:
 *     summary: Get booking by ID (Mobile)
 *     tags: [Mobile - Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.lease.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            propertyType: true,
            amenities: {
              include: {
                amenity: true,
              },
            },
          },
        },
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            profilePicture: true,
            phone: true,
            email: true,
          },
        },
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            profilePicture: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check if user is authorized to view this booking
    if (
      booking.tenantId !== req.user.id &&
      booking.landlordId !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking',
      });
    }

    // Format property amenities
    const formattedBooking = {
      ...booking,
      property: {
        ...booking.property,
        amenities: booking.property.amenities.map(a => a.amenity),
        mapsUrl:
          booking.property.latitude && booking.property.longitude
            ? `https://www.google.com/maps?q=${booking.property.latitude},${booking.property.longitude}`
            : null,
      },
    };

    res.json({
      success: true,
      data: formattedBooking,
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/bookings:
 *   post:
 *     summary: Create a new booking (Mobile)
 *     tags: [Mobile - Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - propertyId
 *               - startDate
 *               - endDate
 *             properties:
 *               propertyId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               message:
 *                 type: string
 *                 description: Optional message to the owner
 *     responses:
 *       201:
 *         description: Booking created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Property not found
 */
router.post(
  '/',
  auth,
  [
    body('propertyId').notEmpty().withMessage('Property ID is required'),
    body('startDate')
      .isISO8601()
      .withMessage('Start date must be a valid date'),
    body('endDate').isISO8601().withMessage('End date must be a valid date'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { propertyId, startDate, endDate, message } = req.body;

      // Check if property exists and is available
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Property not found',
        });
      }

      if (!property.isAvailable || property.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: 'Property is not available for booking',
        });
      }

      // Cannot book own property
      if (property.ownerId === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot book your own property',
        });
      }

      // Check date validity
      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (start < today) {
        return res.status(400).json({
          success: false,
          message: 'Start date cannot be in the past',
        });
      }

      if (end <= start) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date',
        });
      }

      // Check for overlapping bookings
      const overlappingBooking = await prisma.lease.findFirst({
        where: {
          propertyId,
          status: { in: ['PENDING', 'APPROVED'] },
          OR: [
            {
              AND: [{ startDate: { lte: start } }, { endDate: { gte: start } }],
            },
            {
              AND: [{ startDate: { lte: end } }, { endDate: { gte: end } }],
            },
            {
              AND: [{ startDate: { gte: start } }, { endDate: { lte: end } }],
            },
          ],
        },
      });

      if (overlappingBooking) {
        return res.status(400).json({
          success: false,
          message: 'Property is already booked for the selected dates',
        });
      }

      // Calculate total price
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const months = Math.ceil(days / 30);
      const totalPrice = property.price * months;

      // Generate booking code
      const bookingCode = `BK-${Date.now().toString(36).toUpperCase()}`;

      // Create booking
      const booking = await prisma.lease.create({
        data: {
          code: bookingCode,
          propertyId,
          tenantId: req.user.id,
          landlordId: property.ownerId,
          startDate: start,
          endDate: end,
          rentAmount: property.price,
          totalPrice,
          status: 'PENDING',
          message: message || null,
        },
        include: {
          property: {
            include: {
              propertyType: true,
            },
          },
          landlord: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: booking,
      });
    } catch (error) {
      console.error('Create booking error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create booking',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/m/bookings/{id}/cancel:
 *   post:
 *     summary: Cancel a booking (Mobile)
 *     tags: [Mobile - Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *       400:
 *         description: Cannot cancel this booking
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    console.log('🔴 Cancel booking request:', {
      bookingId: id,
      userId: req.user.id,
      reason,
    });

    const booking = await prisma.lease.findUnique({
      where: { id },
    });

    if (!booking) {
      console.log('❌ Booking not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    console.log('📋 Booking found:', {
      id: booking.id,
      status: booking.status,
      tenantId: booking.tenantId,
      landlordId: booking.landlordId,
      requestUserId: req.user.id,
    });

    // Check if user is authorized
    if (
      booking.tenantId !== req.user.id &&
      booking.landlordId !== req.user.id
    ) {
      console.log(
        '⛔ Not authorized - User:',
        req.user.id,
        'Tenant:',
        booking.tenantId,
        'Landlord:',
        booking.landlordId
      );
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking',
      });
    }

    // Check if booking can be cancelled
    if (!['PENDING', 'APPROVED'].includes(booking.status)) {
      console.log('⚠️  Cannot cancel - Status:', booking.status);
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status: ${booking.status}`,
      });
    }

    // Update booking
    const updatedBooking = await prisma.lease.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        cancellationReason: reason || null,
        cancelledAt: new Date(),
      },
      include: {
        property: {
          include: {
            propertyType: true,
          },
        },
      },
    });

    console.log('✅ Booking cancelled successfully:', id);

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: updatedBooking,
    });
  } catch (error) {
    console.error('❌ Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/bookings/{id}/approve:
 *   post:
 *     summary: Approve a booking (Owner only) (Mobile)
 *     tags: [Mobile - Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking approved successfully
 *       400:
 *         description: Cannot approve this booking
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
router.post('/:id/approve', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.lease.findUnique({
      where: { id },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Only landlord can approve
    if (booking.landlordId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only property owner can approve bookings',
      });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve booking with status: ${booking.status}`,
      });
    }

    const updatedBooking = await prisma.lease.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
      include: {
        property: {
          include: {
            propertyType: true,
          },
        },
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Booking approved successfully',
      data: updatedBooking,
    });
  } catch (error) {
    console.error('Approve booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/bookings/{id}/reject:
 *   post:
 *     summary: Reject a booking (Owner only) (Mobile)
 *     tags: [Mobile - Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *     responses:
 *       200:
 *         description: Booking rejected successfully
 *       400:
 *         description: Cannot reject this booking
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await prisma.lease.findUnique({
      where: { id },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Only landlord can reject
    if (booking.landlordId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only property owner can reject bookings',
      });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject booking with status: ${booking.status}`,
      });
    }

    const updatedBooking = await prisma.lease.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || null,
        rejectedAt: new Date(),
      },
      include: {
        property: {
          include: {
            propertyType: true,
          },
        },
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Booking rejected successfully',
      data: updatedBooking,
    });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Upload tenant signature
router.post('/:bookingId/upload-signature', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { signatureUrl } = req.body;

    if (!signatureUrl) {
      return res.status(400).json({
        success: false,
        message: 'Signature URL is required',
      });
    }

    const bookingsService = require('../../modules/bookings/bookings.service');
    const result = await bookingsService.uploadTenantSignature(
      bookingId,
      signatureUrl,
      req.user.id
    );

    res.json({
      success: true,
      message: 'Signature uploaded successfully',
      data: result,
    });
  } catch (error) {
    console.error('Upload signature error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload signature',
    });
  }
});

module.exports = router;
