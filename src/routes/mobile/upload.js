/**
 * @swagger
 * tags:
 *   - name: Mobile - Upload
 *     description: File upload endpoints for mobile app
 */

const express = require('express');
const { auth } = require('../../middleware/auth');
const {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
} = require('../../middleware/upload');
const uploadController = require('../../utils/uploadController');

const router = express.Router();

/**
 * @swagger
 * /api/v1/m/upload/single:
 *   post:
 *     summary: Upload a single file (Mobile)
 *     tags: [Mobile - Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               optimize:
 *                 type: boolean
 *                 description: Whether to optimize images (default true)
 *     responses:
 *       200:
 *         description: File uploaded successfully
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
 *                     publicId:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     mimeType:
 *                       type: string
 *                     size:
 *                       type: number
 *                     url:
 *                       type: string
 *                     width:
 *                       type: number
 *                     height:
 *                       type: number
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/single', auth, uploadSingle(), handleUploadError, (req, res) =>
  uploadController.uploadSingle(req, res)
);

/**
 * @swagger
 * /api/v1/m/upload/multiple:
 *   post:
 *     summary: Upload multiple files (Mobile)
 *     tags: [Mobile - Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               optimize:
 *                 type: boolean
 *                 description: Whether to optimize images (default true)
 *     responses:
 *       200:
 *         description: Files uploaded successfully
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
 *                     files:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/multiple',
  auth,
  uploadMultiple(),
  handleUploadError,
  (req, res) => uploadController.uploadMultiple(req, res)
);

/**
 * @swagger
 * /api/v1/m/upload/profile-picture:
 *   post:
 *     summary: Upload profile picture (Mobile)
 *     tags: [Mobile - Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/profile-picture',
  auth,
  uploadSingle(),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file provided',
        });
      }

      const fileUploadService = require('../../utils/fileUpload');
      const { prisma } = require('../../config/database');

      const result = await fileUploadService.uploadFile(req.file, true);

      // Update user's profile picture
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { profilePicture: result.url },
        select: {
          id: true,
          profilePicture: true,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Profile picture uploaded successfully',
        data: {
          ...result,
          user,
        },
      });
    } catch (error) {
      console.error('Upload profile picture error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Profile picture upload failed',
      });
    }
  }
);

module.exports = router;
