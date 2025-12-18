module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/config/**',
    '!**/node_modules/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Coverage directory
  coverageDirectory: 'coverage',

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],
};
