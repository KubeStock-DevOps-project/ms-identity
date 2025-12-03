/**
 * User Routes
 * All routes require admin authentication
 */
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { adminOnly } = require("../middleware/auth.middleware");

// Apply admin authentication to all routes
router.use(adminOnly);

// Supplier routes
router.get("/suppliers", userController.listSuppliers);
router.post("/suppliers", userController.createSupplier);

// Warehouse staff routes
router.get("/staff", userController.listWarehouseStaff);
router.post("/staff", userController.createWarehouseStaff);

// Generic user routes
router.get("/users/:userId", userController.getUser);
router.delete("/users/:userId", userController.deleteUser);

// Group routes
router.get("/groups", userController.listGroups);

module.exports = router;
