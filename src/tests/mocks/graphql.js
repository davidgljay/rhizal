/**
 * Mock for GraphQL API
 * Parses GraphQL queries and returns appropriate mock responses
 * Can be configured with custom responses per test
 */

class GraphQLMock {
    constructor() {
        this.reset();
    }

    /**
     * Reset all mock state to defaults
     */
    reset() {
        this.customResponses = [];
        this.defaultData = {
            communities: [],
            users: [],
            memberships: [],
            messages: [],
            scripts: [],
            group_threads: [],
            vars: []
        };
    }

    /**
     * Main mock function that mimics the graphql API
     * @param {string} query - GraphQL query string
     * @param {Object} variables - Query variables
     * @returns {Promise<{data: Object}>} - Returns mock data matching query structure
     */
    async graphql(query, variables = {}) {
        // Check for custom response first
        const customResponse = this.findCustomResponse(query, variables);
        if (customResponse) {
            return Promise.resolve(customResponse);
        }

        // Parse query to determine type
        const queryType = this.parseQueryType(query);
        
        // Generate response based on query type
        const response = this.generateResponse(queryType, query, variables);
        
        return Promise.resolve(response);
    }

    /**
     * Find a custom response that matches the query and variables
     * @param {string} query - GraphQL query string
     * @param {Object} variables - Query variables
     * @returns {Object|null} - Custom response or null
     */
    findCustomResponse(query, variables) {
        for (let i = 0; i < this.customResponses.length; i++) {
            const custom = this.customResponses[i];
            if (custom.matcher(query, variables)) {
                // Remove the response after using it to support sequential calls
                const response = custom.response;
                this.customResponses.splice(i, 1);
                return response;
            }
        }
        return null;
    }

    /**
     * Parse query to identify its type
     * @param {string} query - GraphQL query string
     * @returns {string} - Query type identifier
     */
    parseQueryType(query) {
        // Normalize query string for matching
        const normalizedQuery = query.replace(/\s+/g, ' ').trim();

        // Check for common query patterns
        if (normalizedQuery.includes('RecieveMessageQuery') || normalizedQuery.includes('receiveMessageQuery')) {
            return 'receiveMessage';
        }
        if (normalizedQuery.includes('RecieveGroupMessageQuery') || normalizedQuery.includes('receiveGroupMessageQuery')) {
            return 'receiveGroupMessage';
        }
        if (normalizedQuery.includes('ReplyQuery') || normalizedQuery.includes('replyQuery')) {
            return 'reply';
        }
        if (normalizedQuery.includes('CreateUserAndMembership')) {
            return 'createUserAndMembership';
        }
        if (normalizedQuery.includes('CreateMembership') && !normalizedQuery.includes('CreateUserAndMembership')) {
            return 'createMembership';
        }
        if (normalizedQuery.includes('CreateMessage')) {
            return 'createMessage';
        }
        if (normalizedQuery.includes('updateMembershipVariable') || normalizedQuery.includes('update_memberships')) {
            return 'updateMembershipVariable';
        }
        if (normalizedQuery.includes('GetScript') && normalizedQuery.includes('$id:uuid!')) {
            return 'getScript';
        }
        if (normalizedQuery.includes('GetGroupThread')) {
            return 'getGroupThread';
        }
        if (normalizedQuery.includes('CreateGroupThread')) {
            return 'createGroupThread';
        }
        if (normalizedQuery.includes('GetSystemScript')) {
            return 'getSystemScript';
        }
        if (normalizedQuery.includes('GetPermissionsGroups')) {
            return 'getPermissionsGroups';
        }
        if (normalizedQuery.includes('GetMembershipFromPhoneNumbers')) {
            return 'getMembershipFromPhoneNumbers';
        }
        if (normalizedQuery.includes('UpdatePermissions')) {
            return 'updatePermissions';
        }
        if (normalizedQuery.includes('AnnouncementQuery')) {
            return 'announcement';
        }
        if (normalizedQuery.includes('SetMessageType')) {
            return 'setMessageType';
        }
        if (normalizedQuery.includes('SendToPermission')) {
            return 'sendToPermission';
        }
        if (normalizedQuery.includes('UpdateGroupThreadVariable')) {
            return 'updateGroupThreadVariable';
        }
        if (normalizedQuery.includes('GetMessage')) {
            return 'getMessage';
        }
        if (normalizedQuery.includes('GetCommunities')) {
            return 'getCommunities';
        }
        
        // Check for vars queries (usually contain membership_id)
        if (normalizedQuery.includes('membership_id') && normalizedQuery.includes('vars')) {
            return 'varsQuery';
        }

        return 'unknown';
    }

    /**
     * Generate response based on query type
     * @param {string} queryType - Type of query
     * @param {string} query - Full query string
     * @param {Object} variables - Query variables
     * @returns {Object} - Mock response
     */
    generateResponse(queryType, query, variables) {
        const baseResponse = { data: {} };

        switch (queryType) {
            case 'receiveMessage':
                baseResponse.data = {
                    communities: this.defaultData.communities.length > 0 
                        ? this.defaultData.communities 
                        : [{
                            id: 'community_1',
                            bot_phone: variables.bot_phone || '+0987654321',
                            onboarding: {
                                id: 'onboarding_script',
                                name: 'Onboarding Script',
                                script_json: '{}',
                                vars_query: null,
                                targets_query: null
                            }
                        }],
                    users: this.defaultData.users.length > 0 
                        ? this.defaultData.users 
                        : variables.phone ? [{
                            id: 'user_1',
                            phone: variables.phone
                        }] : [],
                    memberships: this.defaultData.memberships.length > 0 
                        ? this.defaultData.memberships 
                        : []
                };
                break;

            case 'receiveGroupMessage':
                baseResponse.data = {
                    communities: this.defaultData.communities.length > 0 
                        ? this.defaultData.communities 
                        : [{
                            id: 'community_1',
                            bot_phone: variables.bot_phone || '+0987654321',
                            group_script_id: 'group_script_1',
                            group_threads: []
                        }],
                    memberships: this.defaultData.memberships.length > 0 
                        ? this.defaultData.memberships 
                        : []
                };
                break;

            case 'reply':
                baseResponse.data = {
                    memberships: this.defaultData.memberships.length > 0 
                        ? this.defaultData.memberships 
                        : [],
                    messages: this.defaultData.messages.length > 0 
                        ? this.defaultData.messages 
                        : []
                };
                break;

            case 'createUserAndMembership':
                baseResponse.data = {
                    insert_memberships_one: {
                        id: 'membership_1',
                        step: '0',
                        permissions: [],
                        current_script_id: variables.current_script_id || 'onboarding_script',
                        user: {
                            id: 'user_1',
                            phone: variables.phone
                        },
                        community: {
                            id: variables.community_id || 'community_1',
                            bot_phone: '+0987654321',
                            onboarding_id: variables.current_script_id || 'onboarding_script'
                        }
                    }
                };
                break;

            case 'createMembership':
                baseResponse.data = {
                    insert_memberships_one: {
                        id: 'membership_1',
                        step: '0',
                        permissions: [],
                        current_script_id: variables.current_script_id || 'onboarding_script',
                        user: {
                            id: variables.user_id || 'user_1',
                            phone: '+1234567890'
                        },
                        community: {
                            id: variables.community_id || 'community_1',
                            bot_phone: '+0987654321',
                            onboarding_id: variables.current_script_id || 'onboarding_script'
                        }
                    }
                };
                break;

            case 'createMessage':
                baseResponse.data = {
                    insert_messages_one: {
                        id: 'message_1',
                        type: variables.message_type || 'message',
                        membership: {
                            id: variables.membership_id || 'membership_1',
                            user: {
                                phone: '+1234567890'
                            }
                        },
                        community: {
                            id: variables.community_id || 'community_1',
                            bot_phone: '+0987654321'
                        }
                    }
                };
                break;

            case 'updateMembershipVariable':
                baseResponse.data = {
                    update_memberships: {
                        returning: [{
                            id: variables.id || 'membership_1'
                        }]
                    }
                };
                break;

            case 'getScript':
                baseResponse.data = {
                    scripts: this.defaultData.scripts.length > 0 
                        ? this.defaultData.scripts 
                        : [{
                            id: variables.id || 'script_1',
                            name: 'Test Script',
                            script_json: '{}',
                            vars_query: null,
                            targets_query: null
                        }]
                };
                break;

            case 'getGroupThread':
                baseResponse.data = {
                    group_threads: this.defaultData.group_threads.length > 0 
                        ? this.defaultData.group_threads 
                        : []
                };
                break;

            case 'createGroupThread':
                baseResponse.data = {
                    insert_group_threads_one: {
                        id: 'thread_1',
                        group_id: variables.group_id || 'group_123',
                        step: '0',
                        hashtag: null,
                        permissions: [],
                        community: {
                            group_script_id: 'group_script_1',
                            group_threads: []
                        }
                    }
                };
                break;

            case 'getSystemScript':
                baseResponse.data = {
                    scripts: this.defaultData.scripts.length > 0 
                        ? this.defaultData.scripts 
                        : [{
                            id: 'system_script_1',
                            name: variables.script_name || 'announcement',
                            script_json: '{}',
                            vars_query: null,
                            targets_query: null
                        }]
                };
                break;

            case 'getPermissionsGroups':
                baseResponse.data = {
                    group_threads: this.defaultData.group_threads.length > 0 
                        ? this.defaultData.group_threads 
                        : []
                };
                break;

            case 'getMembershipFromPhoneNumbers':
                baseResponse.data = {
                    memberships: this.defaultData.memberships.length > 0 
                        ? this.defaultData.memberships 
                        : []
                };
                break;

            case 'updatePermissions':
                baseResponse.data = {
                    update_memberships: {
                        returning: [{
                            id: variables.id || 'membership_1'
                        }]
                    }
                };
                break;

            case 'announcement':
                baseResponse.data = {
                    communities: this.defaultData.communities.length > 0 
                        ? this.defaultData.communities.map(c => ({
                            ...c,
                            memberships: this.defaultData.memberships.length > 0 ? this.defaultData.memberships : [],
                            messages: this.defaultData.messages.length > 0 ? this.defaultData.messages : []
                        }))
                        : [{
                            id: variables.community_id || 'community_1',
                            bot_phone: '+0987654321',
                            memberships: [],
                            messages: []
                        }]
                };
                break;

            case 'setMessageType':
                baseResponse.data = {
                    update_messages: {
                        returning: [{
                            id: 'message_1'
                        }]
                    }
                };
                break;

            case 'sendToPermission':
                baseResponse.data = {
                    communities: [{
                        id: variables.community_id || 'community_1',
                        bot_phone: '+0987654321',
                        groups: []
                    }]
                };
                break;

            case 'updateGroupThreadVariable':
                baseResponse.data = {
                    update_group_threads: {
                        returning: [{
                            id: 'thread_1'
                        }]
                    }
                };
                break;

            case 'getMessage':
                baseResponse.data = {
                    message: {
                        id: variables.id || 'message_1',
                        text: 'Test message',
                        from_user: false,
                        sent_time: Date.now(),
                        membership: {
                            id: 'membership_1',
                            user: {
                                phone: '+1234567890'
                            }
                        },
                        community: {
                            id: 'community_1',
                            bot_phone: '+0987654321'
                        }
                    }
                };
                break;

            case 'getCommunities':
                baseResponse.data = {
                    communities: this.defaultData.communities.length > 0 
                        ? this.defaultData.communities 
                        : []
                };
                break;

            case 'varsQuery':
                baseResponse.data = {
                    vars: this.defaultData.vars.length > 0 
                        ? this.defaultData.vars 
                        : [{}]
                };
                break;

            default:
                baseResponse.data = {};
        }

        return baseResponse;
    }

    /**
     * Add a custom response that will be returned for matching queries
     * @param {Function} matcher - Function that takes (query, variables) and returns boolean
     * @param {Object} response - Response object to return
     */
    addCustomResponse(matcher, response) {
        this.customResponses.push({ matcher, response });
    }

    /**
     * Add a custom response based on query string pattern
     * @param {string|RegExp} pattern - Query pattern to match
     * @param {Object} response - Response object to return
     */
    addResponseForQuery(pattern, response) {
        const matcher = (query, variables) => {
            // Normalize query for matching (remove extra whitespace)
            const normalizedQuery = query.replace(/\s+/g, ' ').trim();
            if (typeof pattern === 'string') {
                // Try both original and normalized query
                return query.includes(pattern) || normalizedQuery.includes(pattern);
            } else if (pattern instanceof RegExp) {
                return pattern.test(query) || pattern.test(normalizedQuery);
            }
            return false;
        };
        this.addCustomResponse(matcher, response);
    }

    /**
     * Set default data for a record type
     * @param {string} recordType - Type of record (communities, users, memberships, etc.)
     * @param {Array|Object} data - Data to set
     */
    setDefaultData(recordType, data) {
        if (Array.isArray(data)) {
            this.defaultData[recordType] = data;
        } else {
            this.defaultData[recordType] = [data];
        }
    }

    /**
     * Clear all custom responses
     */
    clearCustomResponses() {
        this.customResponses = [];
    }
}

// Export singleton instance for use in tests
const graphqlMock = new GraphQLMock();

// Export the mock function that matches the graphql API signature
const mockGraphql = async (query, variables) => {
    return await graphqlMock.graphql(query, variables);
};

module.exports = { graphql: mockGraphql };
module.exports.GraphQLMock = GraphQLMock;
module.exports.graphqlMock = graphqlMock;

