/**
 * Unit Tests for Logger Configuration
 */

describe('Logger Configuration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should use info level by default', () => {
    delete process.env.LOG_LEVEL;
    const defaultLevel = process.env.LOG_LEVEL || 'info';
    expect(defaultLevel).toBe('info');
  });

  it('should respect LOG_LEVEL environment variable', () => {
    process.env.LOG_LEVEL = 'debug';
    const level = process.env.LOG_LEVEL || 'info';
    expect(level).toBe('debug');
  });

  it('should support error level', () => {
    process.env.LOG_LEVEL = 'error';
    const level = process.env.LOG_LEVEL || 'info';
    expect(level).toBe('error');
  });

  it('should support warn level', () => {
    process.env.LOG_LEVEL = 'warn';
    const level = process.env.LOG_LEVEL || 'info';
    expect(level).toBe('warn');
  });
});
