/**
 * Asgardeo SCIM2 Client Configuration
 * Handles OAuth2 token acquisition and SCIM2 API calls
 */
const axios = require("axios");
const logger = require("./logger");

class AsgardeoClient {
    constructor() {
        this.org = process.env.ASGARDEO_ORG;
        this.baseUrl = process.env.ASGARDEO_BASE_URL;
        this.clientId = process.env.ASGARDEO_CLIENT_ID;
        this.clientSecret = process.env.ASGARDEO_CLIENT_SECRET;
        this.tokenUrl = process.env.ASGARDEO_TOKEN_URL;
        this.scim2Url = process.env.ASGARDEO_SCIM2_URL;

        // Group IDs from Asgardeo
        this.groupIds = {
            admin: process.env.ASGARDEO_GROUP_ID_ADMIN,
            supplier: process.env.ASGARDEO_GROUP_ID_SUPPLIER,
            warehouse_staff: process.env.ASGARDEO_GROUP_ID_WAREHOUSE_STAFF,
        };

        // Token cache
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get M2M access token from Asgardeo
     * Uses client credentials grant
     */
    async getAccessToken() {
        // Return cached token if still valid
        if (
            this.accessToken &&
            this.tokenExpiry &&
            Date.now() < this.tokenExpiry
        ) {
            return this.accessToken;
        }

        try {
            const credentials = Buffer.from(
                `${this.clientId}:${this.clientSecret}`
            ).toString("base64");

            const response = await axios.post(
                this.tokenUrl,
                new URLSearchParams({
                    grant_type: "client_credentials",
                    scope: "internal_user_mgt_create internal_user_mgt_list internal_user_mgt_view internal_user_mgt_delete internal_user_mgt_update internal_group_mgt_update internal_group_mgt_view"}),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Authorization: `Basic ${credentials}`,
                    },
                }
            );

            this.accessToken = response.data.access_token;
            // Set expiry 5 minutes before actual expiry for safety
            this.tokenExpiry =
                Date.now() + (response.data.expires_in - 300) * 1000;

            logger.info("Asgardeo M2M token acquired successfully");
            return this.accessToken;
        } catch (error) {
            logger.error(
                "Failed to get Asgardeo access token:",
                error.response?.data || error.message
            );
            throw new Error("Failed to authenticate with Asgardeo");
        }
    }

    /**
     * Make authenticated SCIM2 API request
     */
    async scim2Request(method, endpoint, data = null, params = {}) {
        const token = await this.getAccessToken();

        try {
            const response = await axios({
                method,
                url: `${this.scim2Url}${endpoint}`,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/scim+json",
                    Accept: "application/scim+json",
                },
                data,
                params,
            });

            return response.data;
        } catch (error) {
            logger.error(
                `SCIM2 API error (${method} ${endpoint}):`,
                error.response?.data || error.message
            );
            throw error;
        }
    }

    /**
     * List users with optional filters
     */
    async listUsers(options = {}) {
        const { filter, startIndex = 1, count = 50, attributes } = options;

        const params = {
            startIndex,
            count,
        };

        if (filter) params.filter = filter;
        if (attributes) params.attributes = attributes;

        return this.scim2Request("GET", "/Users", null, params);
    }

    /**
     * Get user by ID
     */
    async getUser(userId) {
        return this.scim2Request("GET", `/Users/${userId}`);
    }

    /**
     * Create a new user
     */
    async createUser(userData) {
        const scimUser = {
            schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
            userName: `DEFAULT/${userData.email}`,
            name: {
                givenName: userData.firstName,
                familyName: userData.lastName,
            },
            emails: [
                {
                    value: userData.email,
                    primary: true,
                },
            ],
            phoneNumbers: userData.phone
                ? [
                      {
                          value: userData.phone,
                          type: "mobile",
                      },
                  ]
                : undefined,
            "urn:scim:wso2:schema": {
                askPassword: true, // Send password reset email
            },
        };

        return this.scim2Request("POST", "/Users", scimUser);
    }

    /**
     * Delete a user
     */
    async deleteUser(userId) {
        return this.scim2Request("DELETE", `/Users/${userId}`);
    }

    /**
     * List groups
     */
    async listGroups(options = {}) {
        const { filter, startIndex = 1, count = 50 } = options;

        const params = { startIndex, count };
        if (filter) params.filter = filter;

        return this.scim2Request("GET", "/Groups", null, params);
    }

    /**
     * Get group by ID
     */
    async getGroup(groupId) {
        return this.scim2Request("GET", `/Groups/${groupId}`);
    }

    /**
     * Add user to a group
     */
    async addUserToGroup(groupId, userId, displayName = null) {
        const memberObj = {
            value: userId,
        };
        
        // Include display name if provided (required by Asgardeo SCIM2 API)
        if (displayName) {
            memberObj.display = displayName;
        }

        const patchData = {
            schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            Operations: [
                {
                    op: "add",
                    value: {
                        members: [memberObj],
                    },
                },
            ],
        };

        return this.scim2Request("PATCH", `/Groups/${groupId}`, patchData);
    }

    /**
     * Remove user from a group
     */
    async removeUserFromGroup(groupId, userId) {
        const patchData = {
            schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            Operations: [
                {
                    op: "remove",
                    path: `members[value eq "${userId}"]`,
                },
            ],
        };

        return this.scim2Request("PATCH", `/Groups/${groupId}`, patchData);
    }

    /**
     * Get users in a specific group (suppliers or warehouse_staff)
     */
    async getUsersByGroup(groupName) {
        const groupId = this.groupIds[groupName];
        if (!groupId) {
            throw new Error(`Unknown group: ${groupName}`);
        }

        // Get group with members
        const group = await this.getGroup(groupId);
        return group.members || [];
    }

    /**
     * Get full user details for members of a group
     */
    async getGroupMembersDetailed(groupName) {
        const members = await this.getUsersByGroup(groupName);

        // Fetch full details for each member
        const userPromises = members.map((member) =>
            this.getUser(member.value).catch((err) => {
                logger.warn(
                    `Failed to fetch user ${member.value}:`,
                    err.message
                );
                return null;
            })
        );

        const users = await Promise.all(userPromises);
        return users.filter((u) => u !== null);
    }
}

// Singleton instance
const asgardeoClient = new AsgardeoClient();

module.exports = asgardeoClient;
