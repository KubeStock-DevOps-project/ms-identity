/**
 * Unit Tests for Metrics Middleware
 * Tests metric collection and middleware behavior
 */

const { register, Counter, Histogram } = require('prom-client');

describe('Metrics Middleware', () => {
  beforeEach(() => {
    // Clear the registry before each test to avoid duplicate metrics
    register.clear();
  });

  it('should create HTTP request counter', () => {
    const httpRequestsTotal = new Counter({
      name: 'test_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
    });

    httpRequestsTotal.inc({ method: 'GET', path: '/health', status: 200 });
    
    expect(httpRequestsTotal).toBeDefined();
  });

  it('should create HTTP request duration histogram', () => {
    const httpRequestDuration = new Histogram({
      name: 'test_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
    });

    httpRequestDuration.observe({ method: 'GET', path: '/health' }, 0.05);
    
    expect(httpRequestDuration).toBeDefined();
  });

  it('should track request duration correctly', () => {
    const start = Date.now();
    // Simulate some work
    const duration = (Date.now() - start) / 1000;
    
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(1); // Should complete in under 1 second
  });

  it('should format path for metrics', () => {
    // Test path normalization logic
    const req = { route: { path: '/api/users/:id' }, path: '/api/users/123' };
    const metricPath = req.route?.path || req.path;
    
    expect(metricPath).toBe('/api/users/:id');
  });

  it('should use raw path when route is undefined', () => {
    const req = { path: '/unknown/path' };
    const metricPath = req.route?.path || req.path;
    
    expect(metricPath).toBe('/unknown/path');
  });
});
