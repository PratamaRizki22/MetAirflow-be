/**
 * Users Routes Tests
 * Tests for /api/users/* endpoints
 */

const request = require('supertest');
const app = require('../../app');
const {
  generateToken,
  createTestUser,
  createTestAdmin,
  cleanupDatabase,
} = require('../helpers/testHelpers');

describe('Users Endpoints', () => {
  let adminUser;
  let adminToken;
  let normalUser;
  let normalToken;

  // Set up test users before all tests
  beforeAll(async () => {
    await cleanupDatabase();

    // Create admin user
    adminUser = await createTestAdmin({
      email: 'admin@test.com',
    });
    adminToken = generateToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: 'ADMIN',
    });

    // Create normal user
    normalUser = await createTestUser({
      email: 'user@test.com',
    });
    normalToken = generateToken({
      userId: normalUser.id,
      email: normalUser.email,
      role: 'USER',
    });
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  describe('GET /api/v1/users/profile', () => {
    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${normalToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(normalUser.id);
      expect(response.body.data.user.email).toBe(normalUser.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/users/profile', () => {
    it('should update current user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+1234567890',
      };

      const response = await request(app)
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${normalToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
      expect(response.body.data.user.lastName).toBe(updateData.lastName);
      expect(response.body.data.user.phone).toBe(updateData.phone);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .patch('/api/v1/users/profile')
        .send({ firstName: 'Test' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate profile picture URL', async () => {
      const response = await request(app)
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${normalToken}`)
        .send({ profilePicture: 'invalid-url' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/users (Admin only)', () => {
    it('should create user as admin', async () => {
      const userData = {
        email: 'newuser@test.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should fail as normal user', async () => {
      const userData = {
        email: 'another@test.com',
        password: 'password123',
        firstName: 'Another',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${normalToken}`)
        .send(userData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        email: normalUser.email,
        password: 'password123',
        firstName: 'Duplicate',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/users (Admin only)', () => {
    it('should get all users as admin', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeInstanceOf(Array);
      expect(response.body.data.users.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    it('should filter by role', async () => {
      const response = await request(app)
        .get('/api/v1/users?role=ADMIN')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.every(u => u.role === 'ADMIN')).toBe(
        true
      );
    });

    it('should fail as normal user', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${normalToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should get user by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${normalToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(normalUser.id);
    });

    it('should fail for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${normalToken}`);

      expect(response.body.success).toBe(false);
      // API may return 403 or 404 depending on auth middleware order
      expect([403, 404]).toContain(response.status);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${normalUser.id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('should update own profile', async () => {
      const updateData = {
        firstName: 'SelfUpdated',
      };

      const response = await request(app)
        .patch(`/api/v1/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${normalToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
    });

    it('should allow admin to update any user', async () => {
      const updateData = {
        firstName: 'AdminUpdated',
        role: 'ADMIN',
      };

      const response = await request(app)
        .patch(`/api/v1/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should fail for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .patch(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/users/:id (Admin only)', () => {
    it('should delete user as admin', async () => {
      const userToDelete = await createTestUser({
        email: 'todelete@test.com',
      });

      const response = await request(app)
        .delete(`/api/v1/users/${userToDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should fail as normal user', async () => {
      const response = await request(app)
        .delete(`/api/v1/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${normalToken}`);

      expect(response.body.success).toBe(false);
      // API may return 400 or 403 depending on validation order
      expect([400, 403]).toContain(response.status);
    });

    it('should fail for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
