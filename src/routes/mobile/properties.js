/**
 * @swagger
 * tags:
 *   - name: Mobile - Properties
 *     description: Property endpoints for mobile app
 */

const express = require('express');
const { auth, optionalAuth } = require('../../middleware/auth');
const { prisma } = require('../../config/database');
const propertiesService = require('../../modules/properties/properties.service');

const router = express.Router();

// Create property (Landlord/Admin only)
router.post('/', auth, async (req, res) => {
  try {
    // Auto-promote USER to LANDLORD if they are creating their first property
    if (req.user.role === 'USER') {
      try {
        await prisma.user.update({
          where: { id: req.user.id },
          data: { role: 'LANDLORD' },
        });
        // Update local user object so downstream logic sees the new role
        req.user.role = 'LANDLORD';
        console.log(`✅ Auto-promoted user ${req.user.id} to LANDLORD`);
      } catch (err) {
        console.error('Failed to auto-promote user:', err);
        // Continue anyway? Or fail?
        // Failing is safer to ensure consistency
        return res.status(500).json({
          success: false,
          message: 'Failed to upgrade user role to Landlord',
        });
      }
    } else if (req.user.role !== 'LANDLORD' && req.user.role !== 'ADMIN') {
      // If they are some other role (e.g. GUEST?), block them
      return res.status(403).json({
        success: false,
        message: 'Only landlords and admins can create properties',
      });
    }

    const property = await propertiesService.createProperty(
      req.body,
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: { property },
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create property',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update property (Landlord/Admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const property = await propertiesService.updateProperty(
      id,
      req.body,
      req.user
    );

    res.json({
      success: true,
      message: 'Property updated successfully',
      data: { property },
    });
  } catch (error) {
    console.error('Update property error:', error);
    const status = error.message.includes('not found')
      ? 404
      : error.message.includes('Access denied')
        ? 403
        : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to update property',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Approve property (Admin only)
router.put('/:id/approve', auth, async (req, res) => {
  try {
    const { id } = req.params;
    // Signature: approveProperty(propertyId, reviewerId, notes)
    const property = await propertiesService.approveProperty(id, req.user.id);

    res.json({
      success: true,
      message: 'Property approved successfully',
      data: { property },
    });
  } catch (error) {
    console.error('Approve property error:', error);
    const status = error.message.includes('not found')
      ? 404
      : error.message.includes('Access denied')
        ? 403
        : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to approve property',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Reject property (Admin only)
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    // Signature: rejectProperty(propertyId, reviewerId, notes)
    const property = await propertiesService.rejectProperty(
      id,
      req.user.id,
      reason
    );

    res.json({
      success: true,
      message: 'Property rejected successfully',
      data: { property },
    });
  } catch (error) {
    console.error('Reject property error:', error);
    const status = error.message.includes('not found')
      ? 404
      : error.message.includes('Access denied')
        ? 403
        : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to reject property',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Delete property (Landlord/Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    await propertiesService.deleteProperty(id, req.user);

    res.json({
      success: true,
      message: 'Property deleted successfully',
    });
  } catch (error) {
    console.error('Delete property error:', error);
    const status = error.message.includes('not found')
      ? 404
      : error.message.includes('Access denied')
        ? 403
        : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete property',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get my properties (Landlord only)
router.get('/my', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filters = {
      status: req.query.status,
      isAvailable: req.query.isAvailable,
      search: req.query.search,
    };

    const result = await propertiesService.getMyProperties(
      req.user.id,
      page,
      limit,
      filters
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get my properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get properties',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get recently viewed properties
router.get('/recently-viewed', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const properties = await propertiesService.getUserRecentlyViewedProperties(
      req.user.id,
      { limit }
    );

    res.json({
      success: true,
      data: {
        properties,
        total: properties.length,
      },
    });
  } catch (error) {
    console.error('Get recently viewed properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recently viewed properties',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/properties:
 *   post:
 *     summary: Create a new property (Landlord/Admin only)
 *     tags: [Mobile - Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - address
 *               - city
 *               - state
 *               - zipCode
 *               - price
 *               - propertyTypeId
 *             properties:
 *               code:
 *                 type: string
 *                 description: Property code (auto-generated if not provided)
 *               title:
 *                 type: string
 *                 description: Property title
 *               description:
 *                 type: string
 *                 description: Property description
 *               address:
 *                 type: string
 *                 description: Property address
 *               city:
 *                 type: string
 *                 description: City
 *               state:
 *                 type: string
 *                 description: State/Province
 *               country:
 *                 type: string
 *                 description: Country code (default ID)
 *               zipCode:
 *                 type: string
 *                 description: Postal code
 *               placeId:
 *                 type: string
 *                 description: Google Places ID
 *               latitude:
 *                 type: number
 *                 format: float
 *                 description: Latitude coordinate
 *               longitude:
 *                 type: number
 *                 format: float
 *                 description: Longitude coordinate
 *               price:
 *                 type: number
 *                 format: decimal
 *                 description: Monthly rent price
 *               currencyCode:
 *                 type: string
 *                 description: Currency code (default MYR)
 *               propertyTypeId:
 *                 type: string
 *                 format: uuid
 *                 description: Property type ID
 *               bedrooms:
 *                 type: integer
 *                 description: Number of bedrooms
 *               bathrooms:
 *                 type: integer
 *                 description: Number of bathrooms
 *               areaSqm:
 *                 type: number
 *                 format: float
 *                 description: Area in square meters
 *               furnished:
 *                 type: boolean
 *                 description: Whether property is furnished
 *               isAvailable:
 *                 type: boolean
 *                 default: true
 *                 description: Whether property is available
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PENDING_REVIEW, APPROVED, REJECTED, ARCHIVED]
 *                 description: Listing status
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of image URLs
 *               amenityIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of amenity IDs
 *             example:
 *               title: "Luxury Penthouse in KLCC"
 *               description: "Stunning 3-bedroom penthouse with panoramic city views in the heart of Kuala Lumpur City Centre. Features premium finishes, private balcony, and access to world-class amenities including infinity pool, gym, and concierge service."
 *               address: "Jalan Pinang, KLCC"
 *               city: "Kuala Lumpur"
 *               state: "Kuala Lumpur"
 *               country: "MY"
 *               zipCode: "50450"
 *               latitude: 3.1516
 *               longitude: 101.7121
 *               placeId: "ChIJ5-U6m9w61TERqB3wOx4BKYw"
 *               price: 8500.00
 *               currencyCode: "MYR"
 *               propertyTypeId: "cltxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *               bedrooms: 3
 *               bathrooms: 3
 *               areaSqm: 180.0
 *               furnished: true
 *               isAvailable: true
 *               status: "PENDING_REVIEW"
 *               images: [
 *                 "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
 *                 "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
 *                 "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"
 *               ]
 *               amenityIds: [
 *                 "amenity-ac-001",
 *                 "amenity-pool-001",
 *                 "amenity-gym-001",
 *                 "amenity-security-001",
 *                 "amenity-parking-001"
 *               ]
 *     responses:
 *       201:
 *         description: Property created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     property:
 *                       $ref: '#/components/schemas/Property'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /api/v1/properties/{id}:
 *   put:
 *     summary: Update property by ID
 *     tags: [Mobile - Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: UUID of the property to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Property title
 *               description:
 *                 type: string
 *                 description: Property description
 *               address:
 *                 type: string
 *                 description: Property address
 *               city:
 *                 type: string
 *                 description: City
 *               state:
 *                 type: string
 *                 description: State/Province
 *               country:
 *                 type: string
 *                 description: Country code
 *               zipCode:
 *                 type: string
 *                 description: Postal code
 *               placeId:
 *                 type: string
 *                 description: Google Places ID
 *               latitude:
 *                 type: number
 *                 format: float
 *                 description: Latitude coordinate
 *               longitude:
 *                 type: number
 *                 format: float
 *                 description: Longitude coordinate
 *               price:
 *                 type: number
 *                 format: decimal
 *                 description: Monthly rent price
 *               currencyCode:
 *                 type: string
 *                 description: Currency code
 *               propertyTypeId:
 *                 type: string
 *                 format: uuid
 *                 description: Property type ID
 *               bedrooms:
 *                 type: integer
 *                 description: Number of bedrooms
 *               bathrooms:
 *                 type: integer
 *                 description: Number of bathrooms
 *               areaSqm:
 *                 type: number
 *                 format: float
 *                 description: Area in square meters
 *               furnished:
 *                 type: boolean
 *                 description: Whether property is furnished
 *               isAvailable:
 *                 type: boolean
 *                 description: Whether property is available
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PENDING_REVIEW, APPROVED, REJECTED, ARCHIVED]
 *                 description: Listing status
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of image URLs
 *               amenityIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of amenity IDs
 *           example:
 *             title: "Luxury Penthouse in KLCC - UPDATED"
 *             price: 9000.00
 *             furnished: true
 *             isAvailable: false
 *             status: "APPROVED"
 *     responses:
 *       200:
 *         description: Property updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     property:
 *                       $ref: '#/components/schemas/Property'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Property not found
 */

/**
 * @swagger
 * /api/v1/properties/{id}:
 *   delete:
 *     summary: Delete property by ID
 *     tags: [Mobile - Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: UUID of the property to delete
 *     responses:
 *       200:
 *         description: Property deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *             example:
 *               success: true
 *               message: "Property deleted successfully"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Property not found
 */

/**
 * @swagger
 * /api/v1/m/properties:
 *   get:
 *     summary: Get all properties with filters (Mobile)
 *     tags: [Mobile - Properties]
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
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: bedrooms
 *         schema:
 *           type: integer
 *       - in: query
 *         name: bathrooms
 *         schema:
 *           type: integer
 *       - in: query
 *         name: propertyTypeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: furnished
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price_asc, price_desc, newest, rating]
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *         description: User's current latitude for distance calculation
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *         description: User's current longitude for distance calculation
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Search radius in kilometers
 *     responses:
 *       200:
 *         description: Properties retrieved successfully
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const {
      city,
      state,
      country,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      propertyTypeId,
      furnished,
      search,
      sortBy,
      latitude,
      longitude,
      radius,
    } = req.query;

    // Build where clause
    const where = {
      status: 'APPROVED',
      isAvailable: true,
    };

    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (state) where.state = { contains: state, mode: 'insensitive' };
    if (country) where.country = { contains: country, mode: 'insensitive' };
    if (minPrice) where.price = { ...where.price, gte: parseFloat(minPrice) };
    if (maxPrice) where.price = { ...where.price, lte: parseFloat(maxPrice) };
    if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms) };
    if (bathrooms) where.bathrooms = { gte: parseInt(bathrooms) };
    if (propertyTypeId) where.propertyTypeId = propertyTypeId;
    if (furnished !== undefined) where.furnished = furnished === 'true';
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build order by
    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'price_asc') orderBy = { price: 'asc' };
    if (sortBy === 'price_desc') orderBy = { price: 'desc' };
    if (sortBy === 'newest') orderBy = { createdAt: 'desc' };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
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
          amenities: {
            include: {
              amenity: true,
            },
          },
          _count: {
            select: {
              ratings: true,
              favorites: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.property.count({ where }),
    ]);

    // Calculate distance if coordinates provided
    let propertiesWithDistance = properties;
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const rad = parseFloat(radius) || 50; // Default 50km radius

      propertiesWithDistance = properties
        .map(property => {
          if (property.latitude && property.longitude) {
            const distance = calculateDistance(
              lat,
              lng,
              property.latitude,
              property.longitude
            );
            return { ...property, distance: Math.round(distance * 100) / 100 };
          }
          return { ...property, distance: null };
        })
        .filter(p => {
          if (radius && p.distance !== null) {
            return p.distance <= rad;
          }
          return true;
        });
    }

    // Check if user has favorited properties
    if (req.user) {
      const favorites = await prisma.propertyFavorite.findMany({
        where: {
          userId: req.user.id,
          propertyId: { in: propertiesWithDistance.map(p => p.id) },
        },
        select: { propertyId: true },
      });
      const favoriteIds = new Set(favorites.map(f => f.propertyId));

      propertiesWithDistance = propertiesWithDistance.map(p => ({
        ...p,
        isFavorited: favoriteIds.has(p.id),
      }));
    }

    // Add Google Maps URL
    propertiesWithDistance = propertiesWithDistance.map(p => ({
      ...p,
      mapsUrl:
        p.latitude && p.longitude
          ? `https://www.google.com/maps?q=${p.latitude},${p.longitude}`
          : null,
      amenities: p.amenities.map(a => a.amenity),
    }));

    res.json({
      success: true,
      data: {
        properties: propertiesWithDistance,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get properties',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/properties/{id}:
 *   get:
 *     summary: Get property by ID (Mobile)
 *     tags: [Mobile - Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property retrieved successfully
 *       404:
 *         description: Property not found
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        propertyType: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            profilePicture: true,
            phone: true,
            email: true,
            createdAt: true,
            _count: {
              select: {
                properties: true,
              },
            },
          },
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
        ratings: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { ratedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            ratings: true,
            favorites: true,
            views: true,
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

    // Record view
    if (req.user) {
      try {
        await prisma.propertyView.create({
          data: {
            propertyId: id,
            userId: req.user.id,
          },
        });
      } catch (viewError) {
        // Silently fail - view tracking is not critical
        console.log('View tracking failed:', viewError.message);
      }
    }

    // Check if favorited
    let isFavorited = false;
    if (req.user) {
      const favorite = await prisma.propertyFavorite.findUnique({
        where: {
          propertyId_userId: {
            propertyId: id,
            userId: req.user.id,
          },
        },
      });
      isFavorited = !!favorite;
    }

    // Calculate average rating
    const avgRating = await prisma.propertyRating.aggregate({
      where: { propertyId: id },
      _avg: { rating: true },
    });

    const propertyData = {
      ...property,
      mapsUrl:
        property.latitude && property.longitude
          ? `https://www.google.com/maps?q=${property.latitude},${property.longitude}`
          : null,
      amenities: property.amenities.map(a => a.amenity),
      isFavorited,
      averageRating: avgRating._avg.rating || 0,
    };

    res.json({
      success: true,
      data: propertyData,
    });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get property',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/properties/{id}/favorite:
 *   post:
 *     summary: Toggle favorite property (Mobile)
 *     tags: [Mobile - Properties]
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
 *         description: Favorite toggled successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Property not found
 */
router.post('/:id/favorite', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { collectionId } = req.query; // Support collectionId from query parameter

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
      });
    }

    // Check if already favorited
    const existingFavorite = await prisma.propertyFavorite.findUnique({
      where: {
        propertyId_userId: {
          propertyId: id,
          userId: req.user.id,
        },
      },
    });

    if (existingFavorite) {
      // If collectionId is provided, update the collection
      if (collectionId) {
        // Verify collection belongs to user
        const collection = await prisma.favoriteCollection.findFirst({
          where: {
            id: collectionId,
            userId: req.user.id,
          },
        });

        if (!collection) {
          return res.status(404).json({
            success: false,
            message: 'Collection not found',
          });
        }

        // Update favorite with collection
        await prisma.propertyFavorite.update({
          where: {
            propertyId_userId: {
              propertyId: id,
              userId: req.user.id,
            },
          },
          data: {
            collectionId: collectionId,
          },
        });

        return res.json({
          success: true,
          message: 'Property added to collection',
          data: { isFavorited: true, collectionId },
        });
      }

      // Remove favorite if no collectionId
      await prisma.propertyFavorite.delete({
        where: {
          propertyId_userId: {
            propertyId: id,
            userId: req.user.id,
          },
        },
      });

      res.json({
        success: true,
        message: 'Property removed from favorites',
        data: { isFavorited: false },
      });
    } else {
      // Add favorite
      const favoriteData = {
        propertyId: id,
        userId: req.user.id,
      };

      // Add collection if provided
      if (collectionId) {
        // Verify collection belongs to user
        const collection = await prisma.favoriteCollection.findFirst({
          where: {
            id: collectionId,
            userId: req.user.id,
          },
        });

        if (!collection) {
          return res.status(404).json({
            success: false,
            message: 'Collection not found',
          });
        }

        favoriteData.collectionId = collectionId;
      }

      await prisma.propertyFavorite.create({
        data: favoriteData,
      });

      res.json({
        success: true,
        message: collectionId
          ? 'Property added to collection'
          : 'Property added to favorites',
        data: { isFavorited: true, collectionId: collectionId || null },
      });
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle favorite',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/properties/{id}/rate:
 *   post:
 *     summary: Rate a property (Mobile)
 *     tags: [Mobile - Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               review:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rating submitted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Property not found
 */
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
      });
    }

    // Upsert rating
    const propertyRating = await prisma.propertyRating.upsert({
      where: {
        propertyId_userId: {
          propertyId: id,
          userId: req.user.id,
        },
      },
      update: {
        rating,
        review: review || null,
      },
      create: {
        propertyId: id,
        userId: req.user.id,
        rating,
        review: review || null,
      },
    });

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: propertyRating,
    });
  } catch (error) {
    console.error('Rate property error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/properties/{id}/rating:
 *   get:
 *     summary: Get property rating summary (Mobile)
 *     tags: [Mobile - Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rating summary retrieved successfully
 *       404:
 *         description: Property not found
 */
router.get('/:id/rating', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
      });
    }

    // Get average rating and total reviews
    const avgRating = await prisma.propertyRating.aggregate({
      where: { propertyId: id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Get rating distribution
    const ratings = await prisma.propertyRating.groupBy({
      by: ['rating'],
      where: { propertyId: id },
      _count: { rating: true },
    });

    // Build rating distribution object
    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    ratings.forEach(r => {
      ratingDistribution[r.rating] = r._count.rating;
    });

    res.json({
      success: true,
      data: {
        averageRating: avgRating._avg.rating || 0,
        totalReviews: avgRating._count.rating || 0,
        ratingDistribution,
      },
    });
  } catch (error) {
    console.error('Get property rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get property rating',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/properties/nearby:
 *   get:
 *     summary: Get nearby properties (Mobile)
 *     tags: [Mobile - Properties]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10
 *         description: Radius in kilometers
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Nearby properties retrieved successfully
 *       400:
 *         description: Latitude and longitude are required
 */
router.get('/nearby', optionalAuth, async (req, res) => {
  try {
    const { latitude, longitude, radius = 10, limit = 20 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseFloat(radius);
    const lim = parseInt(limit);

    // Get all available properties with coordinates
    const properties = await prisma.property.findMany({
      where: {
        status: 'APPROVED',
        isAvailable: true,
        latitude: { not: null },
        longitude: { not: null },
      },
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
    });

    // Calculate distance and filter
    const nearbyProperties = properties
      .map(property => {
        const distance = calculateDistance(
          lat,
          lng,
          property.latitude,
          property.longitude
        );
        return {
          ...property,
          distance: Math.round(distance * 100) / 100,
          mapsUrl: `https://www.google.com/maps?q=${property.latitude},${property.longitude}`,
        };
      })
      .filter(p => p.distance <= rad)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, lim);

    res.json({
      success: true,
      data: {
        properties: nearbyProperties,
        count: nearbyProperties.length,
        searchLocation: { latitude: lat, longitude: lng },
        searchRadius: rad,
      },
    });
  } catch (error) {
    console.error('Get nearby properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get nearby properties',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Check property availability
router.get('/:propertyId/availability', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const propertiesService = require('../../modules/properties/properties.service');
    const result = await propertiesService.checkAvailability(
      propertyId,
      startDate,
      endDate
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/properties/{id}/occupied-dates:
 *   get:
 *     summary: Get occupied dates for a property (for calendar UI)
 *     tags: [Mobile - Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for range (default: today)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for range (default: 3 months from start)
 *     responses:
 *       200:
 *         description: Occupied dates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     occupiedPeriods:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           startDate:
 *                             type: string
 *                             format: date-time
 *                           endDate:
 *                             type: string
 *                             format: date-time
 *                           status:
 *                             type: string
 */
router.get('/:id/occupied-dates', async (req, res) => {
  try {
    const { id } = req.params;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date();
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 3 months

    console.log('📅 Getting occupied dates for property:', {
      propertyId: id,
      startDate,
      endDate,
    });

    // Get all approved/active bookings for this property in the date range
    const occupiedPeriods = await prisma.lease.findMany({
      where: {
        propertyId: id,
        status: { in: ['APPROVED', 'ACTIVE'] },
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        ],
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
      },
      orderBy: { startDate: 'asc' },
    });

    console.log(`✅ Found ${occupiedPeriods.length} occupied periods`);

    res.json({
      success: true,
      data: {
        occupiedPeriods,
        queryRange: {
          startDate,
          endDate,
        },
      },
    });
  } catch (error) {
    console.error('❌ Get occupied dates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get occupied dates',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
