// Jest test setup file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.PORT = '3099'; // Use different port for tests

// Mock console.error to reduce noise
jest.spyOn(console, 'error').mockImplementation(() => {});
