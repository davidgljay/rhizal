const { receive_message, receive_group_message, receive_reply } = require('../handlers/receive_message');
const Membership = require('../models/membership');
const Message = require('../models/message');
const Community = require('../models/community');

// Mock the APIs
jest.mock('../apis/signal', () => require('./mocks/signal_cli_rest_api'));
jest.mock('../apis/graphql', () => {
    const { graphqlMock } = require('./mocks/graphql');
    return { graphql: (query, variables) => graphqlMock.graphql(query, variables) };
});

// Import mocks after mocking
const signalMock = require('./mocks/signal_cli_rest_api');
const { graphqlMock } = require('./mocks/graphql');

// Test scripts
const onboardingScript = {
    "0": {
        "send": [
            "Welcome to the service!"
        ],
        "on_receive": {
            "step": 1
        }
    },
    "1": {
        "send": [
            "What's your name?"
        ],
        "on_receive": [
            {
                "set_variable": {
                    "variable": "name",
                    "value": "message"
                }
            },
            {
                "step": 2
            }
        ]
    },
    "2": {
        "send": [
            "Thanks {{name}}! You're all set."
        ],
        "on_receive": {
            "step": "done"
        }
    }
};

const groupThreadScript = {
    "0": {
        "send": [
            "Thanks for inviting me to the group!",
            "What's a good hashtag to use for this group?"
        ],
        "on_receive": {
            "if": "regex(message, /#\\w+/)",
            "then": [
                {
                    "set_group_variable": {
                        "variable": "hashtag",
                        "value": "regex(message, /#\\w+/)"
                    }
                },
                { "step": 1 }
            ],
            "else": [
                { "step": 2 }
            ]
        }
    },
    "1": {
        "send": [
            "Thanks for the hashtag!"
        ],
        "on_receive": {
            "step": "done"
        }
    },
    "2": {
        "send": [
            "I don't see a hashtag in that response, please include a word with the # character."
        ],
        "on_receive": {
            "if": "regex(message, /#\\w+/)",
            "then": [
                {
                    "set_group_variable": {
                        "variable": "hashtag",
                        "value": "regex(message, /#\\w+/)"
                    }
                },
                { "step": 1 }
            ],
            "else": [
                { "step": "done" }
            ]
        }
    }
};

const announcementScript = {
    "0": {
        "send": [
            "Would you like to send an announcement to your entire community? Just enter the message here and I'll confirm that it looks good before sending. You can also cancel this process with #cancel."
        ],
        "on_receive": {
            "if": "regex(message, /#cancel[^a-zA-Z0-9]/)",
            "then": [
                { "step": 3 }
            ],
            "else": [
                {
                    "set_message_type": {
                        "type": "draft_announcement"
                    }
                },
                { "step": 1 }
            ]
        }
    },
    "1": {
        "send": [
            "Thanks! Does this look good? \n\n{{message}}\n\nPlease respond with 'yes' to send or 'no' to cancel."
        ],
        "on_receive": {
            "if": "regex(message, /yes/)",
            "then": [
                { "send_announcement": true },
                { "step": 2 }
            ],
            "else": [
                { "step": 3 }
            ]
        }
    },
    "2": {
        "send": [
            "Great! Your announcement has been sent to your community."
        ],
        "on_receive": [
            { "step": "done" }
        ]
    },
    "3": {
        "send": [
            "Okay, I've canceled the announcement process. You can start it again with #announcement at any time."
        ],
        "on_receive": [
            { "step": "done" }
        ]
    }
};

describe('Integration Scenarios', () => {
    beforeEach(() => {
        // Reset all mocks
        signalMock.reset();
        graphqlMock.reset();
        graphqlMock.clearCustomResponses();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('1. New user onboarding', () => {
        it('should complete full onboarding flow for a new user', async () => {
            const senderNumber = '+1234567890';
            const botNumber = '+0987654321';
            const communityId = 'community_1';
            const onboardingScriptId = 'onboarding_script_1';
            const sentTime = 1741644982;

            // Configure GraphQL responses for initial message (new user)
            graphqlMock.addResponseForQuery('RecieveMessageQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        onboarding: {
                            id: onboardingScriptId,
                            name: 'Onboarding Script',
                            script_json: JSON.stringify(onboardingScript),
                            vars_query: null,
                            targets_query: null
                        }
                    }],
                    users: [],
                    memberships: []
                }
            });

            // Create user and membership
            graphqlMock.addResponseForQuery('CreateUserAndMembership', {
                data: {
                    insert_memberships_one: {
                        id: 'membership_1',
                        step: '0',
                        permissions: [],
                        current_script_id: onboardingScriptId,
                        user: {
                            id: 'user_1',
                            phone: senderNumber
                        },
                        community: {
                            id: communityId,
                            bot_phone: botNumber,
                            onboarding_id: onboardingScriptId
                        }
                    }
                }
            });

            // Vars query for step 0
            graphqlMock.addResponseForQuery('membership_id', {
                data: {
                    vars: [{}]
                }
            });

            // Step update to 1
            graphqlMock.addResponseForQuery('updateMembershipVariable', {
                data: {
                    update_memberships: {
                        returning: [{ id: 'membership_1' }]
                    }
                }
            });

            // First message: User sends initial message
            await receive_message(senderNumber, botNumber, 'Hello', sentTime);

            // Verify bot sent welcome message
            expect(signalMock.send).toHaveBeenCalledWith(
                [senderNumber],
                botNumber,
                'Welcome to the service!'
            );

            // Reset mocks for next step
            signalMock.reset();
            graphqlMock.reset();
            graphqlMock.clearCustomResponses();

            // Configure for step 1: User provides name
            graphqlMock.addResponseForQuery('RecieveMessageQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        onboarding: {
                            id: onboardingScriptId,
                            name: 'Onboarding Script',
                            script_json: JSON.stringify(onboardingScript),
                            vars_query: null,
                            targets_query: null
                        }
                    }],
                    users: [{
                        id: 'user_1',
                        phone: senderNumber
                    }],
                    memberships: [{
                        id: 'membership_1',
                        step: '1',
                        name: null,
                        permissions: [],
                        current_script: null,
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        },
                        user: {
                            id: 'user_1',
                            phone: senderNumber
                        }
                    }]
                }
            });

            // Vars query - get_vars sets vars.message from the message parameter, 
            // so we don't need it in the GraphQL response. The vars query just adds extra vars.
            graphqlMock.addResponseForQuery('membership_id', {
                data: {
                    vars: [{ 
                        id: 'membership_1', 
                        phone: senderNumber, 
                        bot_phone: botNumber, 
                        community_id: communityId, 
                        signal_timestamp: sentTime + 1
                        // Note: vars.message is set by get_vars from the message parameter ("John")
                    }]
                }
            });

            // Update name variable (first updateMembershipVariable call)
            graphqlMock.addResponseForQuery('updateMembershipVariable', {
                data: {
                    update_memberships: {
                        returning: [{ id: 'membership_1' }]
                    }
                }
            });

            // Vars query for step 2 (after name is set)
            graphqlMock.addResponseForQuery('membership_id', {
                data: {
                    vars: [{ name: 'John', id: 'membership_1', phone: senderNumber, bot_phone: botNumber, community_id: communityId, signal_timestamp: sentTime + 1 }]
                }
            });

            // Update step to 2 (second updateMembershipVariable call)
            graphqlMock.addResponseForQuery('updateMembershipVariable', {
                data: {
                    update_memberships: {
                        returning: [{ id: 'membership_1' }]
                    }
                }
            });

            // User responds with name
            await receive_message(senderNumber, botNumber, 'John', sentTime + 1);

            // Verify bot thanked user (step 2 message after processing step 1)
            expect(signalMock.send).toHaveBeenCalledWith(
                [senderNumber],
                botNumber,
                'Thanks John! You\'re all set.'
            );

            // Reset for final step
            signalMock.reset();
            graphqlMock.reset();
            graphqlMock.clearCustomResponses();

            // Configure for step 2: Final step
            graphqlMock.addResponseForQuery('RecieveMessageQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        onboarding: {
                            id: onboardingScriptId,
                            name: 'Onboarding Script',
                            script_json: JSON.stringify(onboardingScript),
                            vars_query: null,
                            targets_query: null
                        }
                    }],
                    users: [{
                        id: 'user_1',
                        phone: senderNumber
                    }],
                    memberships: [{
                        id: 'membership_1',
                        step: '2',
                        name: 'John',
                        permissions: [],
                        current_script: null,
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        },
                        user: {
                            id: 'user_1',
                            phone: senderNumber
                        }
                    }]
                }
            });

            graphqlMock.addResponseForQuery('membership_id', {
                data: {
                    vars: [{ name: 'John' }]
                }
            });

            // Update step to done
            graphqlMock.addResponseForQuery('updateMembershipVariable', {
                data: {
                    update_memberships: {
                        returning: [{ id: 'membership_1' }]
                    }
                }
            });

            // User sends final message
            await receive_message(senderNumber, botNumber, 'Thanks!', sentTime + 2);

        });
    });

    describe('2. Group thread script completion', () => {
        it('should complete group thread script when bot is invited and user provides hashtag', async () => {
            const groupId = 'group_123';
            const base64GroupId = Buffer.from(groupId).toString('base64');
            const senderNumber = '+1234567890';
            const botNumber = '+0987654321';
            const communityId = 'community_1';
            const groupScriptId = 'group_script_1';
            const sentTime = 1741644982;

            // Configure for group join (no message)
            graphqlMock.addResponseForQuery('RecieveGroupMessageQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        group_script_id: groupScriptId,
                        group_threads: []
                    }],
                    memberships: [{
                        id: 'membership_1',
                        permissions: ['group_comms'],
                        user: {
                            phone: senderNumber
                        },
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        },
                        name: 'Test User'
                    }]
                }
            });

            // Group thread doesn't exist yet
            graphqlMock.addResponseForQuery('GetGroupThread', {
                data: {
                    group_threads: []
                }
            });

            // Create group thread
            graphqlMock.addResponseForQuery('CreateGroupThread', {
                data: {
                    insert_group_threads_one: {
                        id: 'thread_1',
                        group_id: base64GroupId,
                        step: '0',
                        hashtag: null,
                        permissions: [],
                        community: {
                            group_script_id: groupScriptId,
                            group_threads: []
                        }
                    }
                }
            });

            // Get group script
            graphqlMock.addResponseForQuery('GetScript', {
                data: {
                    scripts: [{
                        id: groupScriptId,
                        name: 'group_setup',
                        script_json: JSON.stringify(groupThreadScript),
                        vars_query: null,
                        targets_query: null
                    }]
                }
            });

            // Bot invited to group (no message)
            await receive_group_message(groupId, undefined, senderNumber, botNumber, 'Test User', sentTime);

            const sendGroupId = 'group.' + base64GroupId;
            expect(signalMock.send).toHaveBeenCalledWith(
                [sendGroupId],
                botNumber,
                'Thanks for inviting me to the group!'
            );
            expect(signalMock.send).toHaveBeenCalledWith(
                [sendGroupId],
                botNumber,
                'What\'s a good hashtag to use for this group?'
            );

            // Reset mocks
            signalMock.reset();
            graphqlMock.reset();
            graphqlMock.clearCustomResponses();

            // Configure for user providing hashtag
            graphqlMock.addResponseForQuery('RecieveGroupMessageQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        group_script_id: groupScriptId,
                        group_threads: []
                    }],
                    memberships: [{
                        id: 'membership_1',
                        permissions: ['group_comms'],
                        user: {
                            phone: senderNumber
                        },
                        community: {
                            id: communityId,
                            bot_phone: botNumber,
                            group_threads: []
                        },
                        name: 'Test User'
                    }]
                }
            });

            graphqlMock.addResponseForQuery('GetGroupThread', {
                data: {
                    group_threads: [{
                        id: 'thread_1',
                        group_id: base64GroupId,
                        step: '0',
                        hashtag: null,
                        community: {
                            group_script_id: groupScriptId,
                            group_threads: []
                        }
                    }]
                }
            });

            graphqlMock.addResponseForQuery('GetScript', {
                data: {
                    scripts: [{
                        id: groupScriptId,
                        name: 'group_setup',
                        script_json: JSON.stringify(groupThreadScript),
                        vars_query: null,
                        targets_query: null
                    }]
                }
            });

            // Update hashtag variable
            graphqlMock.addResponseForQuery('UpdateGroupThreadVariable', {
                data: {
                    update_group_threads: {
                        returning: [{ id: 'thread_1' }]
                    }
                }
            });

            // Update step to 1
            graphqlMock.addResponseForQuery('UpdateGroupThreadVariable', {
                data: {
                    update_group_threads: {
                        returning: [{ id: 'thread_1' }]
                    }
                }
            });

            // User provides hashtag
            await receive_group_message(groupId, 'Sure, use #groupHashtag', senderNumber, botNumber, 'Test User', sentTime + 1);

            expect(signalMock.send).toHaveBeenCalledWith(
                [sendGroupId],
                botNumber,
                'Thanks for the hashtag!'
            );
        });
    });

    describe('3. Cross-group messaging with hashtag', () => {
        it('should relay message between groups when user has group_comms permission', async () => {
            const groupId1 = 'group_1';
            const base64GroupId1 = Buffer.from(groupId1).toString('base64');
            const groupId2 = 'group_2';
            const base64GroupId2 = Buffer.from(groupId2).toString('base64');
            const senderNumber = '+1234567890';
            const botNumber = '+0987654321';
            const communityId = 'community_1';
            const sentTime = 1741644982;

            // Configure for group message with hashtag
            graphqlMock.addResponseForQuery('RecieveGroupMessageQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        group_script_id: 'group_script_1',
                        group_threads: [
                            { group_id: base64GroupId1, hashtag: '#group1' },
                            { group_id: base64GroupId2, hashtag: '#group2' }
                        ]
                    }],
                    memberships: [{
                        id: 'membership_1',
                        permissions: ['group_comms'],
                        user: {
                            phone: senderNumber
                        },
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        },
                        name: 'Test User'
                    }]
                }
            });

            graphqlMock.addResponseForQuery('GetGroupThread', {
                data: {
                    group_threads: [{
                        id: 'thread_1',
                        group_id: base64GroupId1,
                        step: 'done',
                        hashtag: '#group1',
                        community: {
                            group_script_id: 'group_script_1',
                            group_threads: [
                                { group_id: base64GroupId1, hashtag: '#group1' },
                                { group_id: base64GroupId2, hashtag: '#group2' }
                            ]
                        }
                    }]
                }
            });

            // User sends message with hashtag targeting another group
            await receive_group_message(groupId1, 'Hello #group2', senderNumber, botNumber, 'Test User', sentTime);

            const targetGroupId = 'group.' + base64GroupId2;
            expect(signalMock.send).toHaveBeenCalledWith(
                [targetGroupId],
                botNumber,
                'Message relayed from Test User in #group1: Hello #group2'
            );
            expect(signalMock.emoji_reaction).toHaveBeenCalledWith(
                senderNumber,
                botNumber,
                sentTime,
                '📤',
                base64GroupId1
            );
        });
    });

    describe('4. Announcement flow', () => {
        it('should complete announcement flow when user has announcement permission', async () => {
            const senderNumber = '+1234567890';
            const botNumber = '+0987654321';
            const communityId = 'community_1';
            const sentTime = 1741644982;

            // User sends #announcement
            graphqlMock.addResponseForQuery('RecieveMessageQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        onboarding: {
                            id: 'onboarding_script',
                            name: 'Onboarding Script',
                            script_json: '{}',
                            vars_query: null,
                            targets_query: null
                        }
                    }],
                    users: [{
                        id: 'user_1',
                        phone: senderNumber
                    }],
                    memberships: [{
                        id: 'membership_1',
                        step: 'done',
                        permissions: ['announcement'],
                        current_script: null,
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        },
                        user: {
                            id: 'user_1',
                            phone: senderNumber
                        }
                    }]
                }
            });

            // Get system script
            graphqlMock.addResponseForQuery('GetSystemScript', {
                data: {
                    scripts: [{
                        id: 'announcement_script',
                        name: 'announcement',
                        script_json: JSON.stringify(announcementScript),
                        vars_query: null,
                        targets_query: null
                    }]
                }
            });

            // Update membership to use announcement script
            graphqlMock.addResponseForQuery('updateMembershipVariable', {
                data: {
                    update_memberships: {
                        returning: [{ id: 'membership_1' }]
                    }
                }
            });

            // Update step to 0
            graphqlMock.addResponseForQuery('updateMembershipVariable', {
                data: {
                    update_memberships: {
                        returning: [{ id: 'membership_1' }]
                    }
                }
            });

            await receive_message(senderNumber, botNumber, '#announcement', sentTime);

            expect(signalMock.send).toHaveBeenCalledWith(
                [senderNumber],
                botNumber,
                'Would you like to send an announcement to your entire community? Just enter the message here and I\'ll confirm that it looks good before sending. You can also cancel this process with #cancel.'
            );

            // Reset mocks
            signalMock.reset();
            graphqlMock.reset();
            graphqlMock.clearCustomResponses();

            // User provides announcement text
            graphqlMock.addResponseForQuery('RecieveMessageQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        onboarding: {
                            id: 'onboarding_script',
                            name: 'Onboarding Script',
                            script_json: '{}',
                            vars_query: null,
                            targets_query: null
                        }
                    }],
                    users: [{
                        id: 'user_1',
                        phone: senderNumber
                    }],
                    memberships: [{
                        id: 'membership_1',
                        step: '0',
                        permissions: ['announcement'],
                        current_script: {
                            id: 'announcement_script',
                            name: 'announcement',
                            script_json: JSON.stringify(announcementScript),
                            vars_query: null,
                            targets_query: null
                        },
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        },
                        user: {
                            id: 'user_1',
                            phone: senderNumber
                        }
                    }]
                }
            });

            // Vars query for announcement script step 0
            graphqlMock.addResponseForQuery('membership_id', {
                data: {
                    vars: [{ 
                        message: 'Test announcement',
                        id: 'membership_1',
                        phone: senderNumber,
                        name: 'Test User',
                        bot_phone: botNumber,
                        community_id: communityId,
                        signal_timestamp: sentTime + 1
                    }]
                }
            });

            // Set message type - this happens when processing the message
            graphqlMock.addResponseForQuery('SetMessageType', {
                data: {
                    update_messages: {
                        returning: [{ id: 'message_1' }]
                    }
                }
            });
            
            // Also match by signal_timestamp pattern
            graphqlMock.addResponseForQuery('signal_timestamp', {
                data: {
                    update_messages: {
                        returning: [{ id: 'message_1' }]
                    }
                }
            });

            // Update step to 1
            graphqlMock.addResponseForQuery('updateMembershipVariable', {
                data: {
                    update_memberships: {
                        returning: [{ id: 'membership_1' }]
                    }
                }
            });

            await receive_message(senderNumber, botNumber, 'Test announcement', sentTime + 1);

            expect(signalMock.send).toHaveBeenCalledWith(
                [senderNumber],
                botNumber,
                'Thanks! Does this look good? \n\nTest announcement\n\nPlease respond with \'yes\' to send or \'no\' to cancel.'
            );

            // Reset mocks (but keep signal mock for tracking)
            signalMock.reset();
            graphqlMock.reset();
            graphqlMock.clearCustomResponses();

            // User confirms - need to set up all responses including AnnouncementQuery
            graphqlMock.addResponseForQuery('RecieveMessageQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        onboarding: {
                            id: 'onboarding_script',
                            name: 'Onboarding Script',
                            script_json: '{}',
                            vars_query: null,
                            targets_query: null
                        }
                    }],
                    users: [{
                        id: 'user_1',
                        phone: senderNumber
                    }],
                    memberships: [{
                        id: 'membership_1',
                        step: '1',
                        permissions: ['announcement'],
                        current_script: {
                            id: 'announcement_script',
                            name: 'announcement',
                            script_json: JSON.stringify(announcementScript),
                            vars_query: null,
                            targets_query: null
                        },
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        },
                        user: {
                            id: 'user_1',
                            phone: senderNumber
                        }
                    }]
                }
            });

            // Announcement query - this will be called when send_announcement action is triggered
            // Must be set up BEFORE processing "yes"
            graphqlMock.addResponseForQuery('AnnouncementQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        memberships: [
                            {
                                id: 'membership_2',
                                user: { phone: '+1111111111' }
                            },
                            {
                                id: 'membership_3',
                                user: { phone: '+2222222222' }
                            }
                        ],
                        messages: [{
                            id: 'message_1',
                            text: 'Test announcement'
                        }]
                    }]
                }
            });
            
            // Also add a matcher that checks for the actual query structure
            graphqlMock.addCustomResponse((query, variables) => {
                return query.includes('draft_announcement') && 
                       query.includes('membership_id') &&
                       variables.community_id === communityId &&
                       variables.membership_id === 'membership_1';
            }, {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        memberships: [
                            {
                                id: 'membership_2',
                                user: { phone: '+1111111111' }
                            },
                            {
                                id: 'membership_3',
                                user: { phone: '+2222222222' }
                            }
                        ],
                        messages: [{
                            id: 'message_1',
                            text: 'Test announcement'
                        }]
                    }]
                }
            });

            // Create announcement messages (one per membership)
            graphqlMock.addResponseForQuery('CreateMessage', {
                data: {
                    insert_messages_one: {
                        id: 'message_2',
                        type: 'announcement',
                        membership: {
                            id: 'membership_2',
                            user: { phone: '+1111111111' }
                        },
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        }
                    }
                }
            });

            graphqlMock.addResponseForQuery('CreateMessage', {
                data: {
                    insert_messages_one: {
                        id: 'message_3',
                        type: 'announcement',
                        membership: {
                            id: 'membership_3',
                            user: { phone: '+2222222222' }
                        },
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        }
                    }
                }
            });

            // Update step to 2
            graphqlMock.addResponseForQuery('updateMembershipVariable', {
                data: {
                    update_memberships: {
                        returning: [{ id: 'membership_1' }]
                    }
                }
            });

            await receive_message(senderNumber, botNumber, 'yes', sentTime + 2);

            // Verify announcement sent to all members
            expect(signalMock.send).toHaveBeenCalledWith(
                ['+1111111111'],
                botNumber,
                'Test announcement'
            );
            expect(signalMock.send).toHaveBeenCalledWith(
                ['+2222222222'],
                botNumber,
                'Test announcement'
            );
            expect(signalMock.send).toHaveBeenCalledWith(
                [senderNumber],
                botNumber,
                'Great! Your announcement has been sent to your community.'
            );
        });
    });

    describe('5. Onboarding group reply flow', () => {
        it('should forward admin reply back to original user', async () => {
            const userNumber = '+9999999999';
            const adminNumber = '+1234567890';
            const botNumber = '+0987654321';
            const communityId = 'community_1';
            const sentTime = 1741644982;
            const replyToTimestamp = 1741644980;

            // User sends message (triggers no_script_message)
            graphqlMock.addResponseForQuery('RecieveMessageQuery', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        onboarding: {
                            id: 'onboarding_script',
                            name: 'Onboarding Script',
                            script_json: '{}',
                            vars_query: null,
                            targets_query: null
                        }
                    }],
                    users: [{
                        id: 'user_1',
                        phone: userNumber
                    }],
                    memberships: [{
                        id: 'membership_1',
                        step: 'done',
                        name: 'Test User',
                        permissions: [],
                        current_script: null,
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        },
                        user: {
                            id: 'user_1',
                            phone: userNumber
                        }
                    }]
                }
            });

            // Send to permission query (onboarding group) - match the actual query pattern
            // Match by query name
            graphqlMock.addResponseForQuery('SendToPermission', {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        groups: [{
                            id: 'group_1',
                            group_id: Buffer.from('onboarding_group').toString('base64')
                        }]
                    }]
                }
            });
            
            // Also match by group_threads pattern (in case the query name doesn't match)
            graphqlMock.addCustomResponse((query, variables) => {
                return query.includes('group_threads') && 
                       query.includes('permissions') && 
                       query.includes('_contains') &&
                       variables.community_id === communityId;
            }, {
                data: {
                    communities: [{
                        id: communityId,
                        bot_phone: botNumber,
                        groups: [{
                            id: 'group_1',
                            group_id: Buffer.from('onboarding_group').toString('base64')
                        }]
                    }]
                }
            });

            // Create relay message
            graphqlMock.addResponseForQuery('CreateMessage', {
                data: {
                    insert_messages_one: {
                        id: 'message_1',
                        type: 'relay_to_onboarding_group',
                        membership: {
                            id: 'membership_1',
                            user: { phone: userNumber }
                        },
                        community: {
                            id: communityId,
                            bot_phone: botNumber
                        }
                    }
                }
            });

            await receive_message(userNumber, botNumber, 'Hello, I need help', sentTime);

            // Verify message relayed to onboarding group
            const onboardingGroupId = 'group.' + Buffer.from('onboarding_group').toString('base64');
            expect(signalMock.send).toHaveBeenCalledWith(
                [onboardingGroupId],
                botNumber,
                'Message relayed from Test User: "Hello, I need help" Reply to respond.'
            );

            // Reset mocks
            signalMock.reset();
            graphqlMock.reset();
            graphqlMock.clearCustomResponses();

            // Admin replies to the message
            graphqlMock.addResponseForQuery('ReplyQuery', {
                data: {
                    memberships: [{
                        id: 'membership_2',
                        permissions: ['onboarding'],
                        name: 'Admin User',
                        community_id: communityId
                    }],
                    messages: [{
                        id: 'message_1',
                        about_membership: {
                            id: 'membership_1',
                            user: {
                                phone: userNumber
                            }
                        }
                    }]
                }
            });

            await receive_reply('Here is the help you need', adminNumber, botNumber, replyToTimestamp, sentTime + 1, 'Admin User');

            // Verify reply forwarded to original user
            expect(signalMock.send).toHaveBeenCalledWith(
                [userNumber],
                botNumber,
                'Message from Admin User: Here is the help you need'
            );
        });
    });
});

