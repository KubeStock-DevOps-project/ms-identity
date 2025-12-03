/**
 * User Controller
 * Handles SCIM2 user management operations
 */
const asgardeoClient = require("../config/asgardeo");
const logger = require("../config/logger");

/**
 * Transform SCIM2 user to simplified format
 */
const transformUser = (scimUser) => {
  return {
    id: scimUser.id,
    email: scimUser.emails?.[0]?.value || scimUser.userName?.replace("DEFAULT/", ""),
    firstName: scimUser.name?.givenName || "",
    lastName: scimUser.name?.familyName || "",
    displayName: scimUser.displayName || `${scimUser.name?.givenName || ""} ${scimUser.name?.familyName || ""}`.trim(),
    phone: scimUser.phoneNumbers?.[0]?.value || null,
    active: scimUser.active !== false,
    createdAt: scimUser.meta?.created,
    updatedAt: scimUser.meta?.lastModified,
    groups: scimUser.groups?.map(g => g.display) || [],
  };
};

/**
 * List all suppliers (users in supplier group)
 */
const listSuppliers = async (req, res) => {
  try {
    logger.info("Fetching suppliers from Asgardeo");
    
    const users = await asgardeoClient.getGroupMembersDetailed("supplier");
    const suppliers = users.map(transformUser);
    
    res.json({
      success: true,
      data: suppliers,
      total: suppliers.length,
    });
  } catch (error) {
    logger.error("Failed to list suppliers:", error.message);
    
    if (error.response?.status === 401) {
      return res.status(503).json({
        success: false,
        message: "Failed to authenticate with Asgardeo. Check service credentials.",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to fetch suppliers",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * List all warehouse staff (users in warehouse_staff group)
 */
const listWarehouseStaff = async (req, res) => {
  try {
    logger.info("Fetching warehouse staff from Asgardeo");
    
    const users = await asgardeoClient.getGroupMembersDetailed("warehouse_staff");
    const staff = users.map(transformUser);
    
    res.json({
      success: true,
      data: staff,
      total: staff.length,
    });
  } catch (error) {
    logger.error("Failed to list warehouse staff:", error.message);
    
    if (error.response?.status === 401) {
      return res.status(503).json({
        success: false,
        message: "Failed to authenticate with Asgardeo. Check service credentials.",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to fetch warehouse staff",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get user by ID
 */
const getUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    logger.info(`Fetching user ${userId} from Asgardeo`);
    const scimUser = await asgardeoClient.getUser(userId);
    
    res.json({
      success: true,
      data: transformUser(scimUser),
    });
  } catch (error) {
    logger.error(`Failed to get user ${req.params.userId}:`, error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

/**
 * Create a new supplier
 */
const createSupplier = async (req, res) => {
  try {
    const { email, firstName, lastName, phone } = req.body;
    
    // Validate required fields
    if (!email || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "Email, firstName, and lastName are required",
      });
    }
    
    logger.info(`Creating supplier user: ${email}`);
    
    // Create user in Asgardeo
    const scimUser = await asgardeoClient.createUser({
      email,
      firstName,
      lastName,
      phone,
    });
    
    // Add user to supplier group
    const supplierGroupId = asgardeoClient.groupIds.supplier;
    if (supplierGroupId) {
      await asgardeoClient.addUserToGroup(supplierGroupId, scimUser.id, email);
      logger.info(`Added user ${scimUser.id} to supplier group`);
    } else {
      logger.warn("Supplier group ID not configured, user created without group assignment");
    }
    
    res.status(201).json({
      success: true,
      message: "Supplier created successfully. Password reset email sent.",
      data: transformUser(scimUser),
    });
  } catch (error) {
    logger.error("Failed to create supplier:", error.response?.data || error.message);
    
    if (error.response?.status === 409) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to create supplier",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Create a new warehouse staff member
 */
const createWarehouseStaff = async (req, res) => {
  try {
    const { email, firstName, lastName, phone } = req.body;
    
    // Validate required fields
    if (!email || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "Email, firstName, and lastName are required",
      });
    }
    
    logger.info(`Creating warehouse staff user: ${email}`);
    
    // Create user in Asgardeo
    const scimUser = await asgardeoClient.createUser({
      email,
      firstName,
      lastName,
      phone,
    });
    
    // Add user to warehouse_staff group
    const staffGroupId = asgardeoClient.groupIds.warehouse_staff;
    if (staffGroupId) {
      await asgardeoClient.addUserToGroup(staffGroupId, scimUser.id, email);
      logger.info(`Added user ${scimUser.id} to warehouse_staff group`);
    } else {
      logger.warn("Warehouse staff group ID not configured, user created without group assignment");
    }
    
    res.status(201).json({
      success: true,
      message: "Warehouse staff created successfully. Password reset email sent.",
      data: transformUser(scimUser),
    });
  } catch (error) {
    logger.error("Failed to create warehouse staff:", error.response?.data || error.message);
    
    if (error.response?.status === 409) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to create warehouse staff",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete a user (supplier or warehouse staff only - admins cannot be deleted)
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // First, fetch the user to check their group membership
    logger.info(`Fetching user ${userId} to verify group membership`);
    const scimUser = await asgardeoClient.getUser(userId);
    
    // Check if user is in admin group - prevent deletion
    const adminGroupId = asgardeoClient.groupIds.admin;
    const userGroups = scimUser.groups || [];
    const isAdmin = userGroups.some(g => g.value === adminGroupId || g.display?.toLowerCase().includes('admin'));
    
    if (isAdmin) {
      logger.warn(`Attempted to delete admin user ${userId} - operation denied`);
      return res.status(403).json({
        success: false,
        message: "Cannot delete admin users. Admin group members are protected.",
      });
    }
    
    logger.info(`Deleting user ${userId} from Asgardeo`);
    await asgardeoClient.deleteUser(userId);
    
    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.error(`Failed to delete user ${req.params.userId}:`, error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

/**
 * List manageable groups (excludes admin group)
 */
const listGroups = async (req, res) => {
  try {
    logger.info("Fetching groups from Asgardeo");
    
    const response = await asgardeoClient.listGroups();
    const adminGroupId = asgardeoClient.groupIds.admin;
    
    // Filter out admin group - admins cannot manage admin group
    const groups = response.Resources
      ?.filter(g => g.id !== adminGroupId && !g.displayName?.toLowerCase().includes('admin'))
      .map(g => ({
        id: g.id,
        name: g.displayName?.replace("DEFAULT/", ""),
        memberCount: g.members?.length || 0,
      })) || [];
    
    res.json({
      success: true,
      data: groups,
      total: groups.length,
    });
  } catch (error) {
    logger.error("Failed to list groups:", error.message);
    
    res.status(500).json({
      success: false,
      message: "Failed to fetch groups",
    });
  }
};

module.exports = {
  listSuppliers,
  listWarehouseStaff,
  getUser,
  createSupplier,
  createWarehouseStaff,
  deleteUser,
  listGroups,
};
