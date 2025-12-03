const { register, Counter, Histogram, Gauge, collectDefaultMetrics } = require("prom-client");

// Clear default registry to avoid duplicates on hot reload
register.clear();

// Collect default metrics
collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new Counter({
  name: "identity_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status"],
});

const httpRequestDuration = new Histogram({
  name: "identity_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

const asgardeoApiCalls = new Counter({
  name: "identity_asgardeo_api_calls_total",
  help: "Total number of Asgardeo SCIM2 API calls",
  labelNames: ["method", "endpoint", "status"],
});

const asgardeoApiDuration = new Histogram({
  name: "identity_asgardeo_api_duration_seconds",
  help: "Asgardeo API call duration in seconds",
  labelNames: ["method", "endpoint"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Middleware
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    const path = req.route?.path || req.path;
    
    httpRequestsTotal.inc({
      method: req.method,
      path,
      status: res.statusCode,
    });
    
    httpRequestDuration.observe(
      { method: req.method, path },
      duration
    );
  });
  
  next();
};

const getMetrics = async () => {
  return register.metrics();
};

const getContentType = () => {
  return register.contentType;
};

module.exports = {
  metricsMiddleware,
  getMetrics,
  getContentType,
  asgardeoApiCalls,
  asgardeoApiDuration,
};
