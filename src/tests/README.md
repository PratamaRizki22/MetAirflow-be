# Testing Documentation

## Overview

This project includes comprehensive unit tests for all API endpoints using Jest and Supertest.

## Test Structure

```
src/tests/
├── setup.js                    # Global test setup
├── helpers/
│   └── testHelpers.js          # Common test utilities
├── auth/
│   └── auth.test.js            # Authentication endpoint tests
├── users/
│   └── users.test.js           # User management tests
├── mobile/
│   └── auth.test.js            # Mobile authentication tests
└── general/
    └── health.test.js          # Health check and general tests
```

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Generate coverage report

```bash
npm run test:coverage
```

### Run specific test file

```bash
npm test -- auth.test.js
```

### Run specific test suite

```bash
npm test -- --testNamePattern="Authentication"
```

## Test Configuration

- **Test Environment**: Node.js
- **Test Database**: Use `.env.test` for test database configuration
- **Timeout**: 10 seconds per test
- **Coverage Threshold**: 70% for branches, functions, lines, and statements

## Test Database Setup

1. Create a test database:

```sql
CREATE DATABASE rentverse_test;
```

2. Update `.env.test` with your test database credentials:

```
DATABASE_URL="postgresql://username:password@localhost:5432/rentverse_test?schema=public"
```

3. Run migrations on test database:

```bash
DATABASE_URL="postgresql://username:password@localhost:5432/rentverse_test?schema=public" npx prisma migrate deploy
```

## Test Helpers

The `testHelpers.js` file provides useful utilities:

- `generateToken(payload)` - Generate JWT tokens for testing
- `createTestUser(userData)` - Create test users
- `createTestAdmin(userData)` - Create admin users
- `createTestProperty(ownerId, data)` - Create test properties
- `createTestBooking(userId, propertyId, data)` - Create test bookings
- `cleanupDatabase()` - Clean up test data
- `createMockFile(filename, mimetype)` - Create mock file uploads

## Writing Tests

### Basic Test Structure

```javascript
const request = require('supertest');
const app = require('../../app');
const {
  generateToken,
  createTestUser,
  cleanupDatabase,
} = require('../helpers/testHelpers');

describe('Feature Name', () => {
  beforeAll(async () => {
    await cleanupDatabase();
    // Setup code
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  describe('Endpoint', () => {
    it('should do something', async () => {
      const response = await request(app).get('/api/endpoint').expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
```

### Testing Authenticated Endpoints

```javascript
it('should require authentication', async () => {
  const user = await createTestUser();
  const token = generateToken({ userId: user.id });

  const response = await request(app)
    .get('/api/protected')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.success).toBe(true);
});
```

### Testing Admin-Only Endpoints

```javascript
it('should require admin role', async () => {
  const admin = await createTestAdmin();
  const adminToken = generateToken({
    userId: admin.id,
    role: 'ADMIN',
  });

  const response = await request(app)
    .post('/api/admin/action')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  expect(response.body.success).toBe(true);
});
```

## Coverage Reports

After running `npm run test:coverage`, view the HTML coverage report:

```bash
open coverage/lcov-report/index.html
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on others
2. **Cleanup**: Always clean up test data in `beforeAll`/`afterAll`
3. **Descriptive Names**: Use clear, descriptive test names
4. **Assertions**: Make specific assertions, not just status codes
5. **Edge Cases**: Test both success and failure scenarios
6. **Mock External Services**: Don't make real API calls to external services

## Troubleshooting

### Tests are timing out

- Increase timeout in `jest.config.js`
- Check database connection
- Ensure cleanup is happening properly

### Database connection errors

- Verify test database exists
- Check `.env.test` configuration
- Ensure migrations are up to date

### Tests passing locally but failing in CI

- Check environment variables
- Ensure test database is properly set up
- Verify Node.js version matches

## Adding New Tests

When adding new endpoints:

1. Create a test file in the appropriate directory
2. Import necessary helpers
3. Set up test data in `beforeAll`
4. Write tests for all scenarios (success, validation, authorization)
5. Clean up in `afterAll`
6. Run tests to ensure they pass

## Future Enhancements

- Integration tests for complete user flows
- E2E tests using browser automation
- Performance/load testing
- API contract testing
- Snapshot testing for responses
