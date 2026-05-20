module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  // Integration / manual suites need live auth, DB, or upload harness — excluded from default CI signal.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/jdParser.integration.test.js',
    '<rootDir>/tests/jdParser.unit.test.js',
    '<rootDir>/tests/resumeRoutes.integration.test.js',
    '<rootDir>/tests/jdRoutes.integration.test.js',
    '<rootDir>/tests/concurrency.integration.test.js',
    '<rootDir>/tests/middleware/uploadMiddleware.test.js',
    '<rootDir>/tests/security.test.js',
    '<rootDir>/tests/resumeController.unit.test.js',
    '<rootDir>/tests/applyService.integration.test.js',
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ]
};
