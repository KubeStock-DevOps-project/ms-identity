/**
 * Integration Tests for Identity Service API
 * Tests health, metrics, and 404 handling
 */

const request = require('supertest');

// Mock dependencies before requiring app
jest.mock('../../src/config/asgardeo', () => ({
  getUser: jest.fn(),
  getGroupMembersDetailed: jest.fn(),
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  addUserToGroup: jest.fn(),
  groupIds: {
    admin: 'admin-group-id',
    supplier: 'supplier-group-id',
    warehouse_staff: 'warehouse-group-id',
  },
}));

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Set required environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3099';

const app = require('../../src/server');

describe('Health Endpoint', () => {
  it('GET /health should return healthy status', async () => {
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.service).toBe('identity-service');
    expect(response.body.status).toBe('healthy');
    expect(response.body.timestamp).toBeDefined();
  });

  it('GET /health should return valid ISO timestamp', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    const timestamp = new Date(response.body.timestamp);
    expect(timestamp).toBeInstanceOf(Date);
    expect(isNaN(timestamp.getTime())).toBe(false);
  });
});

describe('Metrics Endpoint', () => {
  it('GET /metrics should return Prometheus metrics', async () => {
    const response = await request(app)
      .get('/metrics')
      .expect(200);

    // Prometheus metrics should include process metrics
    expect(response.text).toContain('process_');
    expect(response.headers['content-type']).toContain('text/plain');
  });

  it('GET /metrics should include custom identity metrics', async () => {
    const response = await request(app)
      .get('/metrics')
      .expect(200);

    // Should have our custom metrics defined
    expect(response.text).toContain('identity_http_requests_total');
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/unknown/route')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Route not found');
  });

  it('should return 404 for POST to unknown routes', async () => {
    const response = await request(app)
      .post('/api/nonexistent')
      .send({ data: 'test' })
      .expect(404);

    expect(response.body.success).toBe(false);
  });
});

describe('Protected Routes', () => {
  it('should require authentication for /api/identity routes', async () => {
    const response = await request(app)
      .get('/suppliers')
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Authentication required');
  });

  it('should reject invalid Bearer token format', async () => {
    const response = await request(app)
      .get('/suppliers')
      .set('Authorization', 'InvalidToken')
      .expect(401);

    expect(response.body.success).toBe(false);
  });
});
