/**
 * User Routes
 * All routes require admin authentication
 */
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { adminOnly } = require("../middleware/auth.middleware");

// Supplier routes
router.get("/suppliers", adminOnly, userController.listSuppliers);
router.post("/suppliers", adminOnly, userController.createSupplier);

// Warehouse staff routes
router.get("/staff", adminOnly, userController.listWarehouseStaff);
router.post("/staff", adminOnly, userController.createWarehouseStaff);

// Generic user routes
router.get("/users/:userId", adminOnly, userController.getUser);
router.delete("/users/:userId", adminOnly, userController.deleteUser);

// Group routes
router.get("/groups", adminOnly, userController.listGroups);

module.exports = router;
