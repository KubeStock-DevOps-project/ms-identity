/**
 * JWT Authentication Middleware for Identity Service
 * Validates Asgardeo JWT tokens and enforces admin role
 */
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const logger = require("../config/logger");

// JWKS client for Asgardeo
const client = jwksClient({
  jwksUri: process.env.ASGARDEO_JWKS_URL || "https://api.asgardeo.io/t/kubestock/oauth2/jwks",
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
});

/**
 * Get signing key from JWKS
 */
const getKey = (header, callback) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      logger.error("Error getting signing key:", err);
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
};

/**
 * Extract token from Authorization header
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  
  return parts[1];
};

/**
 * Authenticate JWT token
 */
const authenticate = (req, res, next) => {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. No token provided.",
    });
  }
  
  const issuer = process.env.ASGARDEO_ISSUER || "https://api.asgardeo.io/t/kubestock/oauth2/token";
  
  jwt.verify(
    token,
    getKey,
    {
      algorithms: ["RS256"],
      issuer,
    },
    (err, decoded) => {
      if (err) {
        logger.warn("JWT verification failed:", err.message);
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token.",
        });
      }
      
      // Extract user info from token
      req.user = {
        sub: decoded.sub,
        email: decoded.email || decoded.username,
        name: decoded.name || decoded.given_name,
        groups: decoded.groups || [],
      };
      
      next();
    }
  );
};

/**
 * Require admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }
  
  const groups = req.user.groups || [];
  const isAdmin = groups.some(
    (group) => group === "admin" || group.toLowerCase().includes("admin")
  );
  
  if (!isAdmin) {
    logger.warn(`Non-admin user ${req.user.email} attempted admin action`);
    return res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }
  
  next();
};

/**
 * Combined middleware for admin-only routes
 */
const adminOnly = [authenticate, requireAdmin];

module.exports = {
  authenticate,
  requireAdmin,
  adminOnly,
};
