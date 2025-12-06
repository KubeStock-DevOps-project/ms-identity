require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const logger = require("./config/logger");
const { metricsMiddleware, getMetrics, getContentType } = require("./middleware/metrics.middleware");
const userRoutes = require("./routes/user.routes");

const app = express();
const PORT = process.env.PORT || 3006;
const HOST = process.env.HOST || "127.0.0.1";

// Middleware
app.use(helmet());
app.use(express.json());
app.use(metricsMiddleware);

// Health check (no auth required)
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "identity-service",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint (no auth required)
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", getContentType());
    res.send(await getMetrics());
  } catch (error) {
    logger.error("Error generating metrics", error);
    res.status(500).send("Error generating metrics");
  }
});

// API Routes - gateway strips /api/identity prefix before forwarding.
app.use("/", userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const server = app.listen(PORT, HOST, () => {
  logger.info(`Identity Service running on http://${HOST}:${PORT}`);
  logger.info(`Metrics available at http://${HOST}:${PORT}/metrics`);
  logger.info(`API base path: /api/identity`);
});

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

module.exports = app;
