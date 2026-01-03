const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../../middleware/auth');
const { prisma } = require('../../config/database');

const router = express.Router();

/**
 * @swagger
 * /api/v1/m/collections:
 *   get:
 *     summary: Get user's favorite collections
 *     tags: [Mobile - Collections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Collections retrieved successfully
 */
router.get('/', auth, async (req, res) => {
  try {
    const collections = await prisma.favoriteCollection.findMany({
      where: { userId: req.user.id },
      include: {
        _count: {
          select: { favorites: true },
        },
        favorites: {
          select: { propertyId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to include propertyIds array
    const transformedCollections = collections.map(collection => ({
      ...collection,
      propertyIds: collection.favorites.map(fav => fav.propertyId),
      favorites: undefined, // Remove favorites array from response
    }));

    res.json({
      success: true,
      data: { collections: transformedCollections },
    });
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get collections',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/collections:
 *   post:
 *     summary: Create a new collection
 *     tags: [Mobile - Collections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 20
 *     responses:
 *       201:
 *         description: Collection created successfully
 */
router.post(
  '/',
  auth,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Collection name is required')
      .isLength({ max: 20 })
      .withMessage('Collection name must be 20 characters or less'),
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

      const { name } = req.body;

      const collection = await prisma.favoriteCollection.create({
        data: {
          userId: req.user.id,
          name: name.trim(),
        },
      });

      res.status(201).json({
        success: true,
        message: 'Collection created successfully',
        data: collection,
      });
    } catch (error) {
      console.error('Create collection error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create collection',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/m/collections/{id}:
 *   put:
 *     summary: Update collection name
 *     tags: [Mobile - Collections]
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Collection updated successfully
 */
router.put(
  '/:id',
  auth,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Collection name is required')
      .isLength({ max: 20 })
      .withMessage('Collection name must be 20 characters or less'),
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

      const { id } = req.params;
      const { name } = req.body;

      // Check if collection exists and belongs to user
      const existing = await prisma.favoriteCollection.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Collection not found',
        });
      }

      if (existing.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this collection',
        });
      }

      const collection = await prisma.favoriteCollection.update({
        where: { id },
        data: { name: name.trim() },
      });

      res.json({
        success: true,
        message: 'Collection updated successfully',
        data: collection,
      });
    } catch (error) {
      console.error('Update collection error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update collection',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/m/collections/{id}:
 *   delete:
 *     summary: Delete a collection
 *     tags: [Mobile - Collections]
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
 *         description: Collection deleted successfully
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if collection exists and belongs to user
    const existing = await prisma.favoriteCollection.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this collection',
      });
    }

    await prisma.favoriteCollection.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Collection deleted successfully',
    });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete collection',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/collections/{id}/properties:
 *   post:
 *     summary: Add property to collection
 *     tags: [Mobile - Collections]
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
 *               - propertyId
 *             properties:
 *               propertyId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Property added to collection successfully
 */
router.post('/:id/properties', auth, async (req, res) => {
  try {
    const { id: collectionId } = req.params;
    const { propertyId } = req.body;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Property ID is required',
      });
    }

    // Check if collection exists and belongs to user
    const collection = await prisma.favoriteCollection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      });
    }

    if (collection.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this collection',
      });
    }

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
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
          propertyId,
          userId: req.user.id,
        },
      },
    });

    if (existingFavorite) {
      // Update existing favorite to add to collection
      await prisma.propertyFavorite.update({
        where: {
          propertyId_userId: {
            propertyId,
            userId: req.user.id,
          },
        },
        data: {
          collectionId,
        },
      });
    } else {
      // Create new favorite with collection
      await prisma.propertyFavorite.create({
        data: {
          propertyId,
          userId: req.user.id,
          collectionId,
        },
      });
    }

    res.json({
      success: true,
      message: 'Property added to collection successfully',
    });
  } catch (error) {
    console.error('Add property to collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add property to collection',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/collections/{id}/properties/{propertyId}:
 *   delete:
 *     summary: Remove property from collection
 *     tags: [Mobile - Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property removed from collection successfully
 */
router.delete('/:id/properties/:propertyId', auth, async (req, res) => {
  try {
    const { id: collectionId, propertyId } = req.params;

    // Check if collection exists and belongs to user
    const collection = await prisma.favoriteCollection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found',
      });
    }

    if (collection.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this collection',
      });
    }

    // Remove property from collection (set collectionId to null)
    const favorite = await prisma.propertyFavorite.findUnique({
      where: {
        propertyId_userId: {
          propertyId,
          userId: req.user.id,
        },
      },
    });

    if (!favorite || favorite.collectionId !== collectionId) {
      return res.status(404).json({
        success: false,
        message: 'Property not found in this collection',
      });
    }

    await prisma.propertyFavorite.update({
      where: {
        propertyId_userId: {
          propertyId,
          userId: req.user.id,
        },
      },
      data: {
        collectionId: null,
      },
    });

    res.json({
      success: true,
      message: 'Property removed from collection successfully',
    });
  } catch (error) {
    console.error('Remove property from collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove property from collection',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
