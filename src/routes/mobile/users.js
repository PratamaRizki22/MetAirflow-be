/**
 * @swagger
 * tags:
 *   - name: Mobile - Users
 *     description: User management endpoints for mobile app
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { auth } = require('../../middleware/auth');
const { prisma } = require('../../config/database');

const router = express.Router();

/**
 * @swagger
 * /api/v1/m/users/profile:
 *   get:
 *     summary: Get current user profile (Mobile)
 *     tags: [Mobile - Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        dateOfBirth: true,
        phone: true,
        profilePicture: true,
        role: true,
        isHost: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            properties: true,
            tenantBookings: true,
            ownerBookings: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/users/profile:
 *   put:
 *     summary: Update current user profile (Mobile)
 *     tags: [Mobile - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               phone:
 *                 type: string
 *               profilePicture:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/profile',
  auth,
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('dateOfBirth').optional().isISO8601(),
    body('phone').optional().trim(),
    body('profilePicture').optional().trim(),
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

      const { firstName, lastName, dateOfBirth, phone, profilePicture } =
        req.body;

      const updateData = {};
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (firstName || lastName) {
        const currentUser = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { firstName: true, lastName: true },
        });
        updateData.name = `${firstName || currentUser.firstName} ${lastName || currentUser.lastName}`;
      }
      if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
      if (phone !== undefined) updateData.phone = phone;
      if (profilePicture !== undefined)
        updateData.profilePicture = profilePicture;

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          dateOfBirth: true,
          phone: true,
          profilePicture: true,
          role: true,
          isHost: true,
          isActive: true,
          updatedAt: true,
        },
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user,
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/m/users/activate-hosting:
 *   post:
 *     summary: Activate hosting for current user (Mobile)
 *     tags: [Mobile - Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hosting activated successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/activate-hosting', auth, async (req, res) => {
  console.log(
    '🚀 [Backend] Received request to activate hosting for User ID:',
    req.user.id
  );
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { isHost: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        dateOfBirth: true,
        phone: true,
        profilePicture: true,
        role: true,
        isHost: true,
        isActive: true,
        updatedAt: true,
      },
    });

    console.log(
      '✅ [Backend] Successfully activated hosting. User isHost set to true for:',
      user.email
    );

    res.json({
      success: true,
      message: 'Hosting activated successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Activate hosting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate hosting',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/users/change-password:
 *   post:
 *     summary: Change user password (Mobile)
 *     tags: [Mobile - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Bad request or incorrect current password
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/change-password',
  auth,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
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

      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { password: true },
      });

      if (!user.password) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change password for OAuth accounts',
        });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword },
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/m/users/favorites:
 *   get:
 *     summary: Get user's favorite properties (Mobile)
 *     tags: [Mobile - Users]
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
 *     responses:
 *       200:
 *         description: Favorites retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/favorites', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      prisma.propertyFavorite.findMany({
        where: { userId: req.user.id },
        include: {
          property: {
            include: {
              propertyType: true,
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePicture: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { favoritedAt: 'desc' },
      }),
      prisma.propertyFavorite.count({
        where: { userId: req.user.id },
      }),
    ]);

    res.json({
      success: true,
      data: {
        favorites: favorites, // Return full favorite objects with property relation
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get favorites',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/users/bookings:
 *   get:
 *     summary: Get user's bookings (Mobile)
 *     tags: [Mobile - Users]
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
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/bookings', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const where = { tenantId: req.user.id };
    if (status) where.status = status;

    const [bookings, total] = await Promise.all([
      prisma.lease.findMany({
        where,
        include: {
          property: {
            include: {
              propertyType: true,
              owner: {
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
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lease.count({ where }),
    ]);

    res.json({
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
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/users/{id}/profile:
 *   get:
 *     summary: Get public landlord profile (Mobile)
 *     tags: [Mobile - Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User/Landlord ID
 *     responses:
 *       200:
 *         description: Landlord profile retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;

    // Get user basic info
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        phone: true,
        profilePicture: true,
        isHost: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get property count
    const propertyCount = await prisma.property.count({
      where: {
        ownerId: id,
        status: 'APPROVED',
        isAvailable: true,
      },
    });

    // Get completed bookings count
    const completedBookingsCount = await prisma.lease.count({
      where: {
        landlordId: id,
        status: 'COMPLETED',
      },
    });

    // Calculate average rating from all reviews of landlord's properties
    const reviews = await prisma.review.findMany({
      where: {
        property: {
          ownerId: id,
        },
      },
      select: {
        rating: true,
      },
    });

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    res.json({
      success: true,
      data: {
        user,
        stats: {
          propertyCount,
          completedBookingsCount,
          averageRating,
          reviewCount: reviews.length,
        },
      },
    });
  } catch (error) {
    console.error('Get landlord profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get landlord profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/users/{id}/properties:
 *   get:
 *     summary: Get landlord's active properties (Mobile)
 *     tags: [Mobile - Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Landlord ID
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
 *     responses:
 *       200:
 *         description: Properties retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/:id/properties', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get landlord's properties
    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where: {
          ownerId: id,
          status: 'APPROVED',
          isAvailable: true,
        },
        include: {
          propertyType: true,
          amenities: {
            include: {
              amenity: true,
            },
          },
          _count: {
            select: {
              ratings: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.property.count({
        where: {
          ownerId: id,
          status: 'APPROVED',
          isAvailable: true,
        },
      }),
    ]);

    // Calculate average rating for each property
    const propertiesWithRatings = await Promise.all(
      properties.map(async property => {
        const ratings = await prisma.propertyRating.findMany({
          where: { propertyId: property.id },
          select: { rating: true },
        });

        const averageRating =
          ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : null;

        return {
          ...property,
          averageRating,
        };
      })
    );

    res.json({
      success: true,
      data: {
        properties: propertiesWithRatings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get landlord properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get landlord properties',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/users/{id}/testimonials:
 *   get:
 *     summary: Get landlord testimonials from completed bookings (Mobile)
 *     tags: [Mobile - Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Landlord ID
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
 *     responses:
 *       200:
 *         description: Testimonials retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/:id/testimonials', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get reviews from completed bookings for landlord's properties
    const [testimonials, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          property: {
            ownerId: id,
          },
          lease: {
            status: 'COMPLETED',
          },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          property: {
            select: {
              id: true,
              title: true,
              images: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.count({
        where: {
          property: {
            ownerId: id,
          },
          lease: {
            status: 'COMPLETED',
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        testimonials,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get landlord testimonials error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get landlord testimonials',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
