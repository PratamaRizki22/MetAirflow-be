/**
 * General Endpoints Tests
 * Tests for health check, CORS, and general endpoints
 */

const request = require('supertest');
const app = require('../../app');

describe('General Endpoints', () => {
  describe('GET /', () => {
    it('should return welcome message', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Rentverse Backend API');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('docs');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.database).toBe('Connected');
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
    });
  });

  describe('GET /cors-test', () => {
    it('should handle CORS test successfully', async () => {
      const response = await request(app).get('/cors-test').expect(200);

      expect(response.body.message).toContain('CORS test successful');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /cors-test', () => {
    it('should handle POST CORS test successfully', async () => {
      const testData = { test: 'data' };
      const response = await request(app)
        .post('/cors-test')
        .send(testData)
        .expect(200);

      expect(response.body.message).toContain('CORS POST test successful');
      expect(response.body.body).toEqual(testData);
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Route not found');
      expect(response.body.message).toContain('Cannot GET');
    });

    it('should return 404 for POST to non-existent routes', async () => {
      const response = await request(app)
        .post('/api/v1/non-existent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot POST');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });
});
