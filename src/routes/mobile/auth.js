/**
 * @swagger
 * tags:
 *   - name: Mobile - Auth
 *     description: Authentication endpoints for mobile app
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../../config/database');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     MobileLoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *     MobileRegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *         firstName:
 *           type: string
 *           description: User's first name
 *         lastName:
 *           type: string
 *           description: User's last name
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           description: User's date of birth (YYYY-MM-DD)
 *         phone:
 *           type: string
 *           description: User's phone number
 *     MobileAuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 name:
 *                   type: string
 *                 dateOfBirth:
 *                   type: string
 *                   format: date
 *                 phone:
 *                   type: string
 *                 role:
 *                   type: string
 *             token:
 *               type: string
 */

/**
 * @swagger
 * /api/v1/m/auth/check-email:
 *   post:
 *     summary: Check if email exists in the system (Mobile)
 *     tags: [Mobile - Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to check
 *     responses:
 *       200:
 *         description: Email check successful
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
 *                     exists:
 *                       type: boolean
 *                       description: Whether the email exists in the system
 *       400:
 *         description: Bad request
 */
router.post(
  '/check-email',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
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

      const { email } = req.body;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      res.json({
        success: true,
        data: {
          exists: !!user,
        },
      });
    } catch (error) {
      console.error('Check email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check email',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/m/auth/register:
 *   post:
 *     summary: Register a new user (Mobile)
 *     tags: [Mobile - Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MobileRegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MobileAuthResponse'
 *       400:
 *         description: Bad request
 *       409:
 *         description: User already exists
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').notEmpty().trim().withMessage('First name is required'),
    body('lastName').notEmpty().trim().withMessage('Last name is required'),
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Date of birth must be a valid date'),
    body('phone').optional().trim(),
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

      const { email, password, firstName, lastName, dateOfBirth, phone } =
        req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create full name for backward compatibility
      const fullName = `${firstName} ${lastName}`;

      // Create user with USER role
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          name: fullName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          phone: phone || null,
          role: 'USER',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          dateOfBirth: true,
          phone: true,
          role: true,
          isHost: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user,
          token,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/m/auth/login:
 *   post:
 *     summary: Login user (Mobile)
 *     tags: [Mobile - Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MobileLoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MobileAuthResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
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

      const { email, password } = req.body;

      // Check for static admin credentials
      if (email === 'admin@rentverse.com' && password === 'admin123') {
        const adminUser = await prisma.user.upsert({
          where: { email: 'admin@rentverse.com' },
          update: { role: 'ADMIN', isActive: true },
          create: {
            email: 'admin@rentverse.com',
            password: await bcrypt.hash('admin123', 12),
            firstName: 'Admin',
            lastName: 'User',
            name: 'Admin User',
            role: 'ADMIN',
            isActive: true,
          },
        });

        const token = jwt.sign(
          { userId: adminUser.id, email: adminUser.email, role: 'ADMIN' },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // eslint-disable-next-line no-unused-vars
        const { password: _, ...adminWithoutPassword } = adminUser;

        return res.json({
          success: true,
          message: 'Admin login successful',
          data: {
            user: adminWithoutPassword,
            token,
          },
        });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          firstName: true,
          lastName: true,
          name: true,
          dateOfBirth: true,
          phone: true,
          profilePicture: true,
          role: true,
          isHost: true,
          isActive: true,
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated',
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          token,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/m/auth/me:
 *   get:
 *     summary: Get current user profile (Mobile)
 *     tags: [Mobile - Auth]
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
router.get('/me', async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
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
 * /api/v1/m/auth/refresh-token:
 *   post:
 *     summary: Refresh JWT token (Mobile)
 *     tags: [Mobile - Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                     token:
 *                       type: string
 *       401:
 *         description: Unauthorized
 */
router.post('/refresh-token', async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token (allow expired tokens for refresh)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: true,
    });

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    // Generate new token
    const newToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
});

/**
 * @swagger
 * /api/v1/m/auth/google:
 *   post:
 *     summary: Authenticate with Google (Mobile)
 *     tags: [Mobile - Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token from mobile SDK
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MobileAuthResponse'
 *       400:
 *         description: Invalid token
 *       401:
 *         description: Authentication failed
 */
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required',
      });
    }

    // Verify Google token using Google Auth Library
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    // Allow tokens issued to Web, Android, or iOS clients
    const validAudiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].filter(id => id); // Filter out undefined/null/empty string

    const ticket = await client.verifyIdToken({
      idToken,
      audience:
        validAudiences.length > 0
          ? validAudiences
          : process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const {
      sub: googleId,
      email,
      given_name: firstName,
      family_name: lastName,
      picture,
    } = payload;

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          googleId,
          firstName: firstName || '',
          lastName: lastName || '',
          name: `${firstName || ''} ${lastName || ''}`.trim(),
          profilePicture: picture,
          password: null, // OAuth users don't have passwords
          role: 'USER',
          isActive: true,
        },
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Google authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/v1/m/auth/forgot-password:
 *   post:
 *     summary: Request password reset email (Mobile)
 *     tags: [Mobile - Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to send password reset link
 *     responses:
 *       200:
 *         description: Password reset email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 */
router.post(
  '/forgot-password',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
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

      const { email } = req.body;

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      });

      // Always return success for security (don't reveal if email exists)
      // But only send email if user exists
      if (user) {
        // Generate password reset token (JWT with 30-minute expiration)
        const resetToken = jwt.sign(
          { userId: user.id, email: user.email, type: 'password-reset' },
          process.env.JWT_SECRET,
          { expiresIn: '30m' }
        );

        // Send password reset email
        const emailService = require('../../services/email.service');
        await emailService.sendPasswordResetEmail(
          user.email,
          resetToken,
          user.firstName || user.name || 'User'
        );

        console.log(`✅ Password reset email sent to: ${email}`);
      } else {
        console.log(
          `⚠️ Password reset requested for non-existent email: ${email}`
        );
      }

      // Always return generic success message (security best practice)
      res.json({
        success: true,
        message:
          'If an account with that email exists, we sent a password reset link.',
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/m/auth/reset-password:
 *   post:
 *     summary: Reset password using token (Mobile)
 *     tags: [Mobile - Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token from email
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: New password
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Invalid or expired token
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
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

      const { token, newPassword } = req.body;

      // Verify reset token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired reset token',
        });
      }

      // Verify token type
      if (decoded.type !== 'password-reset') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type',
        });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update user password
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      console.log(`✅ Password reset successful for user: ${user.email}`);

      res.json({
        success: true,
        message:
          'Password reset successful. You can now login with your new password.',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/m/auth/test-email:
 *   post:
 *     summary: Test SMTP email configuration (Mobile)
 *     tags: [Mobile - Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to send test email
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *       500:
 *         description: Failed to send test email
 */
router.post(
  '/test-email',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    try {
      const { email } = req.body;
      const emailService = require('../../services/email.service');
      await emailService.sendTestEmail(email);

      res.json({
        success: true,
        message: 'Test email sent successfully',
      });
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: error.message,
      });
    }
  }
);

module.exports = router;
