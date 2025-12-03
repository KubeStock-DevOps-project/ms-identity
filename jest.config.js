module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
  ],
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  verbose: true,
  testTimeout: 10000,
  // Clear mocks between tests
  clearMocks: true,
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Force exit after tests complete
  forceExit: true,
};
