/**
 * Authentication Routes Tests
 * Tests for /api/auth/* endpoints
 */

const request = require('supertest');
const app = require('../../app');
const { prisma } = require('../../config/database');
const {
  generateToken,
  createTestUser,
  cleanupDatabase,
} = require('../helpers/testHelpers');

describe('Authentication Endpoints', () => {
  // Clean up before and after all tests
  beforeAll(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.firstName).toBe(userData.firstName);
      expect(response.body.data.user.lastName).toBe(userData.lastName);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should fail with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should fail with short password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should fail with missing firstName', async () => {
      const userData = {
        email: 'test2@example.com',
        password: 'password123',
        lastName: 'Doe',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      // Create first user
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should register user with optional fields', async () => {
      const userData = {
        email: 'optional@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        phone: '+1234567890',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.phone).toBe(userData.phone);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser;

    beforeAll(async () => {
      // Create a test user for login tests
      testUser = await createTestUser({
        email: 'login@example.com',
        password: 'password123',
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe('login@example.com');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should fail with invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail with invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let testUser;
    let validToken;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: 'me@example.com',
      });
      validToken = generateToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
    });

    it('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should fail without token', async () => {
      const response = await request(app).get('/api/v1/auth/me').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No token provided');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');
    });

    it('should fail with expired token', async () => {
      const expiredToken = generateToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
        expiresIn: '-1h', // Expired 1 hour ago
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/check-email', () => {
    beforeAll(async () => {
      await createTestUser({ email: 'exists@example.com' });
    });

    it('should return true for existing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/check-email')
        .send({ email: 'exists@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exists).toBe(true);
      expect(response.body.data).toHaveProperty('isActive');
      expect(response.body.data).toHaveProperty('role');
    });

    it('should return false for non-existing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/check-email')
        .send({ email: 'notexists@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exists).toBe(false);
      expect(response.body.data).not.toHaveProperty('isActive');
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/check-email')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/apple', () => {
    it('should fail without identity token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/apple')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Identity token is required');
    });

    // Note: Full Apple Sign In testing would require mocking the Apple authentication service
    // which is beyond the scope of basic unit tests
  });
});
