/**
 * Mobile Authentication Routes Tests
 * Tests for /api/m/auth/* endpoints
 */

const request = require('supertest');
const app = require('../../app');
const {
  generateToken,
  createTestUser,
  cleanupDatabase,
} = require('../helpers/testHelpers');

describe('Mobile Authentication Endpoints', () => {
  beforeAll(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  describe('POST /api/v1/m/auth/register', () => {
    it('should register a new user via mobile', async () => {
      const userData = {
        email: `mobile-${Date.now()}@example.com`,
        password: 'password123',
        firstName: 'Mobile',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/v1/m/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBeTruthy();
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('token');
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        firstName: 'Mobile',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/v1/m/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/m/auth/login', () => {
    let testUser;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: 'mobile-login@example.com',
        password: 'password123',
      });
    });

    it('should login successfully via mobile', async () => {
      const response = await request(app)
        .post('/api/v1/m/auth/login')
        .send({
          email: 'mobile-login@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should fail with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/m/auth/login')
        .send({
          email: 'mobile-login@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/m/auth/me', () => {
    let testUser;
    let validToken;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: 'mobile-me@example.com',
      });
      validToken = generateToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
    });

    it('should get current mobile user profile', async () => {
      const response = await request(app)
        .get('/api/v1/m/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUser.id);
    });

    it('should fail without token', async () => {
      const response = await request(app).get('/api/v1/m/auth/me').expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
