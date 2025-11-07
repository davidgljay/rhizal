const { receive_message, receive_group_message, receive_reply } = require('../handlers/receive_message');
const signal = require('../apis/signal');
const {graphql} = require('../apis/graphql');
const Membership = require('../models/membership');
const Message = require('../models/message');
const Community = require('../models/community');

const script = {
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
            "Message with {{var1}} to {{var2}}!"
        ],
        "on_receive": {
            "if": "regex(message, /yes/)",
            "then": [
                { "step": 2 },
                {
                    "set_variable": {
                        "variable": "name",
                        "value": "user_name"
                    }
                }
            ],
            "else": { "step": "done" }
        }
    },
    "2": {
        "send": [
            "Another message with no variables!",
            "A second message to be sent a few seconds later."
        ],
        "on_receive": {
            "step": "done"
        }
    }
};

const groupScript = {
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
                { "step": 3 }
            ]
        }
    },
    "3": {
        "send": [
            "Seems like now's not a good time, just use #name to set a hashtag when you're ready."
        ],
        "on_receive": {
            "step": "done"
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
            {
            "step": 3
            }
        ],
        "else": [
            {
            "set_message_type": {
                "type": "draft_announcement"
            }
            },
            {
            "step": 1
            }
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
            {
            "send_announcement": true
            },
            {
            "step": 2
            }
        ],
        "else": [
            {
            "step": 3
            }
        ]
        }
    },
    "2": {
        "send": [
        "Great! Your announcement has been sent to your community."
        ],
        "on_receive": [
        {
            "step": "done"
        }
        ]
    },
    "3": {
        "send": [
        "Okay, I've canceled the announcement process. You can start it again with #announcement at any time."
        ],
        "on_receive": [
        {
            "step": "done"
        }
        ]
    }
}

const expectedQueries = {
    receiveMessage: `query RecieveMessageQuery($bot_phone:String!, $phone:String!)`,
    createUserAndMembership: `mutation CreateUserAndMembership($phone:String!, $community_id:uuid!, $current_script_id:uuid!)`,
    createMembership: `mutation CreateMembership($user_id:uuid!, $community_id:uuid!, $current_script_id:uuid!)`,
    testVars: `testVarsQuery($membership_id:uuid!)`,
    createMessage: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $signal_timestamp: bigint!, $about_membership_id: uuid = null)`,
    updateMembershipVariable: `mutation updateMembershipVariable($id:uuid!, $value:String!)`,
    getScript: `query GetScript($id:uuid!)`,
    getGroupThread: `query GetGroupThread($group_id: String!)`,
    createGroupThread: `mutation CreateGroupThread($community_id: uuid!, $group_id: String!)`,
    replyQuery: `query ReplyQuery($bot_phone:String!, $phone:String!, $signal_timestamp:bigint!)`,
    systemScript: `query GetSystemScript($script_name: String!)`
}

const testScript = JSON.stringify(script);
const groupTestScript = JSON.stringify(groupScript);

jest.mock('../apis/signal', () => ({
    send: jest.fn(() => ({timestamp: 1234567890})),
    show_typing_indicator: jest.fn(),
    emoji_reaction: jest.fn(),
}));
jest.mock('../apis/graphql', () => ({
    graphql: jest.fn()
}));
jest.spyOn(Membership, 'get');
jest.spyOn(Membership, 'create');
jest.spyOn(Community, 'get');

jest.spyOn(Message, 'send');
jest.spyOn(Message, 'create');

describe('Integration Tests for receive_message Handler', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('receive_message', () => {

        const mockQueryResponse = {
            data: {
                communities: [
                    {
                        id: 'community_1',
                        name: 'Test Community',
                        bot_phone: '0987654321',
                        onboarding: {
                            id: 'onboarding_script',
                            name: 'Onboarding Script',
                            script_json: JSON.stringify(script),
                            vars_query: 'query testVarsQuery($membership_id:uuid!){}',
                            targets_query: 'target query',
                        }
                    }
                ],
                memberships: [
                    {
                        id: 'membership_1',
                        user: {
                            phone: '1234567890',
                        },
                        community: {
                            id: 'community_1',
                            bot_phone: '0987654321',
                        },
                        step: '0',
                        current_script_id: 'onboarding_script',
                        set_variable: jest.fn(),
                    }
                ],
                users: [
                    {
                        id: 'user_1',
                        phone: '1234567890',
                    }
                ]
            }
        };

        it('should create a new user and send the first message of the script for a new phone number', async () => {
            const senderNumber = '+1234567890';
            const recipientNumber='+0987654321';
            const sentTime = 1741644982;

            const noMembershipResponse = JSON.parse(JSON.stringify(mockQueryResponse));
            noMembershipResponse.data.memberships = [];
            noMembershipResponse.data.users = [];

            const mockGraphql = [

                {
                    query: expectedQueries.receiveMessage,
                    variables: { bot_phone: recipientNumber, phone: senderNumber },
                    response: noMembershipResponse
                },
                {
                    query: expectedQueries.createUserAndMembership,
                    variables: { phone: senderNumber, community_id: "community_1", current_script_id: 'onboarding_script' },
                    response: { data: { insert_memberships_one: { id: "membership_1", user: { id: "user_1", phone: senderNumber }, type: 'member', community: { id: 'community_1', bot_phone: recipientNumber } } } }
                },
                {
                    query: expectedQueries.testVars,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ name: 'var1' }] } }
                }
            ];

            for (let i = 0; i < mockGraphql.length; i++) {
                graphql.mockImplementationOnce((...args) => {
                    return Promise.resolve(mockGraphql[i].response);
                });
                
            }

            await receive_message(senderNumber, recipientNumber, 'Hello', sentTime);

            for (let i = 0; i < mockGraphql.length; i++) {
                expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
            }
            expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);

            expect(Message.create).not.toHaveBeenCalled();
            expect(signal.send).toHaveBeenCalledWith([senderNumber], recipientNumber, 'Welcome to the service!');
        });

        it('should create a new membership for an existing users and send the first message of the script', async () => {
            const senderNumber = '+1234567890';
            const recipientNumber = '+0987654321';
            const sentTime = 1741644982;

            const noMembershipResponse = JSON.parse(JSON.stringify(mockQueryResponse));
            noMembershipResponse.data.memberships = [];

            const mockGraphql = [

                {
                    query: expectedQueries.receiveMessage,
                    variables: { bot_phone: recipientNumber, phone: senderNumber },
                    response: noMembershipResponse
                },
                {
                    query: expectedQueries.createMembership,
                    variables: { user_id: 'user_1', community_id: "community_1", current_script_id: 'onboarding_script' },
                    response: { data: { insert_memberships_one: { id: "membership_1", user: { id: "user_1", phone: senderNumber }, type: 'member', community: { id: 'community_1', bot_phone: recipientNumber } } } }
                },
                {
                    query: expectedQueries.testVars,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ name: 'var1' }] } }
                }
            ];

            for (let i = 0; i < mockGraphql.length; i++) {
                graphql.mockImplementationOnce((...args) => {
                    // console.log('graphql called with:', args);
                    return Promise.resolve(mockGraphql[i].response);
                });
                
            }

            await receive_message(senderNumber, recipientNumber, 'Hello', sentTime);

            for (let i = 0; i < mockGraphql.length; i++) {
                expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
            }
            expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);

            expect(signal.send).toHaveBeenCalledWith([senderNumber], recipientNumber, 'Welcome to the service!');
        });

        it('should take no action if the community does not exist', async () => {
            const senderNumber = '+1234567890';
            const recipientNumber = '+0987654321';
            const sentTime = 1741644982;

            const noCommunitiesResponse = JSON.parse(JSON.stringify(mockQueryResponse));
            noCommunitiesResponse.data.communities = [];

            const mockGraphql = [
                {
                    query: expectedQueries.receiveMessage,
                    variables: { bot_phone: recipientNumber, phone: senderNumber },
                    response: noCommunitiesResponse
                }
            ];

            for (let i = 0; i < mockGraphql.length; i++) {
                graphql.mockImplementationOnce((...args) => {
                    // console.log('graphql called with:', args);
                    return Promise.resolve(mockGraphql[i].response);
                });
            }
            await receive_message(senderNumber, recipientNumber, 'Hello', sentTime);
            for (let i = 0; i < mockGraphql.length; i++) {
                expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
            }
            expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
            expect(signal.send).not.toHaveBeenCalled();
        });

        it('should send the next message in the script for an existing user', async () => {
            const senderNumber = '1234567890';
            const recipientNumber = '0987654321';
            const sentTime = 1741644982;

            const mockGraphql = [
                {
                    query: expectedQueries.receiveMessage,
                    variables: { bot_phone: recipientNumber, phone: senderNumber },
                    response: mockQueryResponse
                },
                {
                    query: expectedQueries.testVars,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ var1: 'stuff', var2: "things" }] } }
                }, 
                {
                    query: expectedQueries.updateMembershipVariable,
                    variables: { id: "membership_1", value: "1" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                }
            ];

            for (let i = 0; i < mockGraphql.length; i++) {
                graphql.mockImplementationOnce((...args) => {
                    return Promise.resolve(mockGraphql[i].response);
                });
            }

            await receive_message(senderNumber, recipientNumber, 'Hello', sentTime);

            for (let i = 0; i < mockGraphql.length; i++) {
                expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
            }
            expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
            expect(signal.send).toHaveBeenCalledWith([senderNumber], recipientNumber, 'Message with stuff to things!');
        });

        it('should log a message if the script is configured to do so', async () => {
            const senderNumber = '1234567890';
            const recipientNumber = '0987654321';
            const sentTime = 1741644982;

            let testScript = JSON.parse(JSON.stringify(script));
            testScript['0']['on_receive'] = [{save_message: 'true'}, {step: '1'}];
            const testScriptResponse = JSON.parse(JSON.stringify(mockQueryResponse));
            testScriptResponse.data.communities[0].onboarding.script_json = JSON.stringify(testScript);


            const mockGraphql = [
                {
                    query: expectedQueries.receiveMessage,
                    variables: { bot_phone: recipientNumber, phone: senderNumber },
                    response: testScriptResponse
                },
                {
                    query: expectedQueries.testVars,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ var1: 'stuff', var2: "things" }] } }
                }, 
                {
                    query: expectedQueries.createMessage,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        from_user: true,
                        signal_timestamp: expect.any(Number),
                        text: 'Hello',
                        about_membership_id: null
                    },
                    response: { data: { insert_messages_one: { id: "message_1", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
                },
                {
                    query: expectedQueries.updateMembershipVariable,
                    variables: { id: "membership_1", value: "1" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                }
            ];

            for (let i = 0; i < mockGraphql.length; i++) {
                graphql.mockImplementationOnce((...args) => {
                    return Promise.resolve(mockGraphql[i].response);
                });
            }

            await receive_message(senderNumber, recipientNumber, 'Hello', sentTime);

            for (let i = 0; i < mockGraphql.length; i++) {
                expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
            }
            expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
            expect(signal.send).toHaveBeenCalledWith([senderNumber], recipientNumber, 'Message with stuff to things!');
        });

        it('should implement logic based on a variable in the script and send multiple messages', async () => {
            const senderNumber = '1234567890';
            const recipientNumber = '0987654321';
            const sentTime = 1741644982;

            let step1Response = JSON.parse(JSON.stringify(mockQueryResponse));
            step1Response.data.memberships[0].step = '1';

            const mockGraphql = [
                {
                    query: expectedQueries.receiveMessage,
                    variables: { bot_phone: recipientNumber, phone: senderNumber },
                    response: step1Response
                },
                {
                    query: expectedQueries.testVars,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ var1: 'stuff', var2: 'things' }] } }
                },
                {
                    query: expectedQueries.updateMembershipVariable,
                    variables: { id: "membership_1", value: "2" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                },
                {
                    query: expectedQueries.updateMembershipVariable,
                    variables: { id: "membership_1", value: "user_name" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                }
            ];

            for (let i = 0; i < mockGraphql.length; i++) {
                graphql.mockImplementationOnce((...args) => {
                    return Promise.resolve(mockGraphql[i].response);
                });
            }

            await receive_message(senderNumber, recipientNumber, 'yes', sentTime);

            for (let i = 0; i < mockGraphql.length; i++) {
                expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
            }
            expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
            expect(signal.send).toHaveBeenCalledWith([senderNumber], recipientNumber, 'Another message with no variables!');
            expect(signal.send).toHaveBeenCalledWith([senderNumber], recipientNumber, 'A second message to be sent a few seconds later.');
        });

        it('should implement logic based on a different variable in the script', async () => {
            const senderNumber = '1234567890';
            const recipientNumber = '0987654321';
            const sentTime = 1741644982;

            let step1Response = JSON.parse(JSON.stringify(mockQueryResponse));
            step1Response.data.memberships[0].step = '1';

            const mockGraphql = [
                {
                    query: expectedQueries.receiveMessage,
                    variables: { bot_phone: recipientNumber, phone: senderNumber },
                    response: step1Response
                },
                {
                    query: expectedQueries.testVars,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ var1: 'stuff', var2: 'things' }] } }
                },
                {
                    query: expectedQueries.updateMembershipVariable,
                    variables: { id: "membership_1", value: "done" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                }
            ];

            for (let i = 0; i < mockGraphql.length; i++) {
                graphql.mockImplementationOnce((...args) => {
                    return Promise.resolve(mockGraphql[i].response);
                });
            }

            await receive_message(senderNumber, recipientNumber, 'no', sentTime);

            for (let i = 0; i < mockGraphql.length; i++) {
                expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
            }
            expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
            expect(signal.send).not.toHaveBeenCalled();
        });

        //Disabling this test for now, since this activity should only happen in a group messages at present. Leaving the test in case we bring this functionality back to direct chat with the Rhizal bot.
        xit('should trigger the correct command if the member is an admin and the message includes a hashtag command', async () => {
            const senderNumber = '1234567890';
            const recipientNumber = '0987654321';
            const sentTime = 1741644982;
            const expectedMessage = "Would you like to send an announcement to your entire community? Just enter the message here and I'll confirm that it looks good before sending. You can also cancel this process with #cancel."

            const hashtagCommandResponse = JSON.parse(JSON.stringify(mockQueryResponse));
            hashtagCommandResponse.data.memberships[0].type = 'admin';

            const mockGraphql = [
                {
                    query: expectedQueries.receiveMessage,
                    variables: { bot_phone: recipientNumber, phone: senderNumber },
                    response: hashtagCommandResponse
                },
                {
                    query: expectedQueries.systemScript,
                    variables: { script_name: 'announcement' },
                    response: { data: { scripts: [{ id: 'script_1', name: 'announcement', script_json: JSON.stringify(announcementScript), vars_query: null }] } }
                },
                {
                    query: 'mutation updateMembershipVariable($id:uuid!, $value:uuid!)',
                    variables: { id: "membership_1", value: "script_1" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                },
    
                {
                    query: expectedQueries.updateMembershipVariable,
                    variables: { id: "membership_1", value: "0" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                }
            ];

            for (let i = 0; i < mockGraphql.length; i++) {
                graphql.mockImplementationOnce((...args) => {
                    return Promise.resolve(mockGraphql[i].response);
                });
            }

            await receive_message(senderNumber, recipientNumber, '#announcement', sentTime);

            for (let i = 0; i < mockGraphql.length; i++) {
                expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
            }
            expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
            expect(signal.send).toHaveBeenCalledWith([senderNumber], recipientNumber, expectedMessage);
        });  

    });
    
    describe('receive_group_message', () => {

        describe('when a group is joined it', () => {

            it('should create a new group thread and send a message to the group', async () => {
                const group_id = 'group_123';
                const base64_group_id = Buffer.from(group_id).toString('base64');
                const communityId = 'community_456';
                const senderNumber = '+1234567890';
                const botNumber = '+0987654321';
                const message = undefined;

                const mockGraphql = [
                    {
                        query: `query RecieveGroupMessageQuery($bot_phone:String!, $phone:String!)`,
                        variables: { bot_phone: botNumber, phone: senderNumber },
                        response: { data: { communities: [{id: communityId, bot_phone: botNumber }], memberships: [ { id: 'membership_1', type: 'member', user: { phone: senderNumber }, community: { id: communityId, bot_phone: botNumber }, name: 'Test User' }] } }
                    },
                    {
                        query: expectedQueries.getGroupThread,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [] } }
                    },
                    {
                        query: expectedQueries.createGroupThread,
                        variables: { community_id: communityId, group_id: base64_group_id },
                        response: { data: { insert_group_threads_one: { id: 'thread_1', group_id: base64_group_id, step: '0', community: {group_script_id: 'script_2'} } } }
                    },
                    {
                        query: expectedQueries.getScript,
                        variables: { id: 'script_2' },
                        response: { data: { scripts: [{ id: 'script_2', name: 'group_setup', script_json: groupTestScript, vars_query: null } ]} }
                    },
                ];

                for (let i = 0; i < mockGraphql.length; i++) {
                    graphql.mockImplementationOnce((...args) => {
                        return Promise.resolve(mockGraphql[i].response);
                    });
                }


                await receive_group_message(group_id, message, senderNumber, botNumber);
                for (let i = 0; i < mockGraphql.length; i++) {
                    expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
                }

                const send_group_id = 'group.' + base64_group_id;

                expect(signal.send).toHaveBeenCalledWith([send_group_id], botNumber, 'Thanks for inviting me to the group!');
                expect(signal.send).toHaveBeenCalledWith([send_group_id], botNumber, 'What\'s a good hashtag to use for this group?');
            });

            it('should not create a new group thread if one already exists', async () => {
                const group_id = 'group_123';
                const base64_group_id = Buffer.from(group_id).toString('base64');
                const communityId = 'community_456';
                const senderNumber = '+1234567890';
                const botNumber = '+0987654321';
                const message = undefined;

                const mockGraphql = [
                    {
                        query: `query RecieveGroupMessageQuery($bot_phone:String!, $phone:String!)`,
                        variables: { bot_phone: botNumber, phone: senderNumber },
                        response: { data: { communities: [{id: communityId, bot_phone: botNumber }], memberships: [ { id: 'membership_1', type: 'member', user: { phone: senderNumber }, community: { id: communityId, bot_phone: botNumber }, name: 'Test User' }] } }
                    },
                    {
                        query: expectedQueries.getGroupThread,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: '0', community: {group_script_id: 'script_2'} }] } }
                    },
                    {
                        query: expectedQueries.getScript,
                        variables: { id: 'script_2' },
                        response: { data: { scripts: [{ id: 'script_2', name: 'group_setup', script_json: groupTestScript, vars_query: null } ]} }
                    }
                ];

                for (let i = 0; i < mockGraphql.length; i++) {
                    graphql.mockImplementationOnce((...args) => {
                        return Promise.resolve(mockGraphql[i].response);
                    });
                }

                await receive_group_message(group_id, message, senderNumber, botNumber);

                for (let i = 0; i < mockGraphql.length; i++) {
                    expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
                }
                expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
                const send_group_id = 'group.' + base64_group_id;
                expect(signal.send).toHaveBeenCalledWith([send_group_id], botNumber, 'Thanks for inviting me to the group!');
                expect(signal.send).toHaveBeenCalledWith([send_group_id], botNumber, 'What\'s a good hashtag to use for this group?');
            });

            it('should take no action if the group thread step is done and no message is included', async () => {
                const group_id = 'group_123';
                const base64_group_id = Buffer.from(group_id).toString('base64');
                const communityId = 'community_456';
                const senderNumber = '+1234567890';
                const botNumber = '+0987654321';
                const message = undefined;

                const mockGraphql = [
                    {
                        query: `query RecieveGroupMessageQuery($bot_phone:String!, $phone:String!)`,
                        variables: { bot_phone: botNumber, phone: senderNumber },
                        response: { data: { communities: [{id: communityId, bot_phone: botNumber }], memberships: [ { id: 'membership_1', type: 'member' }] } }
                    },
                    {
                        query: expectedQueries.getGroupThread,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: 'done', community: {group_script_id: 'script_2'} }] } }
                    }
                ];

                for (let i = 0; i < mockGraphql.length; i++) {
                    graphql.mockImplementationOnce((...args) => {
                        return Promise.resolve(mockGraphql[i].response);
                    });
                }

                await receive_group_message(group_id, message, senderNumber, botNumber);

                for (let i = 0; i < mockGraphql.length; i++) {
                    expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
                }
                expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
                expect(signal.send).not.toHaveBeenCalled();
            });

        });

        describe('when a group message is recieved', () => {

            it('should take no action if the message does not include a hashtag and the script step is done', async () => {
                const group_id = 'group_123';
                const base64_group_id = Buffer.from(group_id).toString('base64');
                const communityId = 'community_456';
                const senderNumber = '+1234567890';
                const botNumber = '+0987654321';
                const message = 'Hello group!';

                const mockGraphql = [
                    {
                        query: `query RecieveGroupMessageQuery($bot_phone:String!, $phone:String!)`,
                        variables: { bot_phone: botNumber, phone: senderNumber },
                        response: { data: { communities: [{id: communityId, bot_phone: botNumber }], memberships: [ { id: 'membership_1', type: 'member' }] } }
                    },
                    {
                        query: expectedQueries.getGroupThread,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: 'done', community: { group_script_id: 'script_2' } }] } }
                    },
                ];

                for (let i = 0; i < mockGraphql.length; i++) {
                    graphql.mockImplementationOnce((...args) => {
                        return Promise.resolve(mockGraphql[i].response);
                    });
                }

                await receive_group_message(group_id, message, senderNumber, botNumber);

                for (let i = 0; i < mockGraphql.length; i++) {
                    expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
                }
                expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
                expect(signal.send).not.toHaveBeenCalled();
            });

            it('should respond properly if the the user sends a hashtag', async () => {
                const group_id = 'group_123';
                const base64_group_id = Buffer.from(group_id).toString('base64');
                const communityId = 'community_456';
                const senderNumber = '+1234567890';
                const botNumber = '+0987654321';
                const message = 'Sure use #groupHashtag';

                const mockGraphql = [
                    {
                        query: `query RecieveGroupMessageQuery($bot_phone:String!, $phone:String!)`,
                        variables: { bot_phone: botNumber, phone: senderNumber },
                        response: { data: { communities: [{id: communityId, bot_phone: botNumber }], memberships: [ { id: 'membership_1', type: 'member', user: { phone: senderNumber }, community: { id: communityId, bot_phone: botNumber }, name: 'Test User' }] } }
                    },
                    {
                        query: expectedQueries.getGroupThread,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: '0', community: { group_script_id: 'script_2' } }] } }
                    },
                    {
                        query: expectedQueries.systemScript,
                        variables: { script_name: 'announcement' },
                        response: { data: { scripts: [{ id: 'announcement_script', name: 'announcement', script_json: JSON.stringify(announcementScript), vars_query: null }] } }
                    },
                    {
                        query: expectedQueries.getScript,
                        variables: { id: 'script_2' },
                        response: { data: { scripts: [{ id: 'script_2', name: 'group_setup', script_json: groupTestScript, vars_query: null } ]} }
                    },
                    {
                        query: `mutation UpdateGroupThreadVariable($group_id:String!, $value:String!)`,
                        variables: { group_id: base64_group_id, value: '#groupHashtag' },
                        response: { data: { update_group_threads: { returning: [{ id: 'thread_1' }] } } }
                    },
                    {
                        query: `mutation UpdateGroupThreadVariable($group_id:String!, $value:String!)`,
                        variables: { group_id: base64_group_id, value: '1' },
                        response: { data: { update_group_threads: { returning: [{ id: 'thread_1' }] } } }
                    }
                ];

                for (let i = 0; i < mockGraphql.length; i++) {
                    graphql.mockImplementationOnce((...args) => {
                        return Promise.resolve(mockGraphql[i].response);
                    });
                }

                await receive_group_message(group_id, message, senderNumber, botNumber);

                for (let i = 0; i < mockGraphql.length; i++) {
                    expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
                }
                expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);

                const send_group_id = 'group.' + base64_group_id;

                expect(signal.send).toHaveBeenCalledWith([send_group_id], botNumber, 'Thanks for the hashtag!');
            });

            it('should respond properly if the the user fails to send a hashtag', async () => {
                const group_id = 'group_123';
                const base64_group_id = Buffer.from(group_id).toString('base64');
                const communityId = 'community_456';
                const senderNumber = '+1234567890';
                const botNumber = '+0987654321';
                const message = 'I\'m not sure about the hashtag';

                const mockGraphql = [
                    {
                        query: `query RecieveGroupMessageQuery($bot_phone:String!, $phone:String!)`,
                        variables: { bot_phone: botNumber, phone: senderNumber },
                        response: { data: { communities: [{id: communityId, bot_phone: botNumber }], memberships: [ { id: 'membership_1', type: 'member', user: { phone: senderNumber }, community: { id: communityId, bot_phone: botNumber }, name: 'Test User' }] } }
                    },
                    {
                        query: expectedQueries.getGroupThread,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: '0', community: { group_script_id: 'script_2' } }] } }
                    },
                    {
                        query: expectedQueries.getScript,
                        variables: { id: 'script_2' },
                        response: { data: { scripts: [{ id: 'script_2', name: 'group_setup', script_json: groupTestScript, vars_query: null } ]} }
                    },
                    {
                        query: `mutation UpdateGroupThreadVariable($group_id:String!, $value:String!)`,
                        variables: { group_id: base64_group_id, value: '2' },
                        response: { data: { update_group_threads: { returning: [{ id: 'thread_1' }] } } }
                    }
                ];

                for (let i = 0; i < mockGraphql.length; i++) {
                    graphql.mockImplementationOnce((...args) => {
                        return Promise.resolve(mockGraphql[i].response);
                    });
                }
                await receive_group_message(group_id, message, senderNumber, botNumber, 'Test User', 1234567890);

                for (let i = 0; i < mockGraphql.length; i++) {
                    expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
                }
                expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
                const send_group_id = 'group.' + base64_group_id;
                expect(signal.send).toHaveBeenCalledWith([send_group_id], botNumber, 'I don\'t see a hashtag in that response, please include a word with the # character.');
            });

            it('should not relay a message if no hashtags exist in the community', async () => {
                const group_id = 'group_123';
                const base64_group_id = Buffer.from(group_id).toString('base64');
                const communityId = 'community_456';
                const senderNumber = '+1234567890';
                const botNumber = '+0987654321';
                const message = '#anotherGroupHashtag';

                const mockGraphql = [
                    {
                        query: `query RecieveGroupMessageQuery($bot_phone:String!, $phone:String!)`,
                        variables: { bot_phone: botNumber, phone: senderNumber },
                        response: { data: { communities: [{id: communityId, bot_phone: botNumber }], memberships: [ { id: 'membership_1', type: 'member', user: { phone: senderNumber }, community: { id: communityId, bot_phone: botNumber }, name: 'Test User' }] } }
                    },
                    {
                        query: expectedQueries.getGroupThread,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: 'done', community: { group_script_id: 'script_2' } }] } }
                    },
                    {
                        query: expectedQueries.systemScript,
                        variables: { script_name: 'announcement' },
                        response: { data: { scripts: [{ id: 'announcement_script', name: 'announcement', script_json: JSON.stringify(announcementScript), vars_query: null }] } }
                    },
                ];

                for (let i = 0; i < mockGraphql.length; i++) {
                    graphql.mockImplementationOnce((...args) => {
                        return Promise.resolve(mockGraphql[i].response);
                    });
                }

                await receive_group_message(group_id, message, senderNumber, botNumber);

                for (let i = 0; i < mockGraphql.length; i++) {
                    expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
                }
                expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
                expect(signal.send).not.toHaveBeenCalled();
            });

            it('should relay a message if the appropriate hashtag exists in the community', async () => {
                const group_id = 'group_123';
                const base64_group_id = Buffer.from(group_id).toString('base64');
                const communityId = 'community_456';
                const senderNumber = '+1234567890';
                const botNumber = '+0987654321';
                const message = 'Lets send this to #anotherGroupHashtag';

                const mockGraphql = [
                    {
                        query: `query RecieveGroupMessageQuery($bot_phone:String!, $phone:String!)`,
                        variables: { bot_phone: botNumber, phone: senderNumber },
                        response: { data: { communities: [{id: communityId, bot_phone: botNumber }], memberships: [ { id: 'membership_1', permissions: ['group_comms'], user: { phone: senderNumber }, community: { id: communityId, bot_phone: botNumber }, name: 'Test User' }] } }
                    },
                    {
                        query: expectedQueries.getGroupThread,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', hashtag: '#groupHash', group_id: base64_group_id, step: 'done', community: { group_script_id: 'script_2', group_threads: [{ group_id: Buffer.from('group_2').toString('base64'), hashtag: '#anotherGroupHashtag' }, { group_id: Buffer.from('group_3').toString('base64'), hashtag: '#funky' }] } }] } }
                    },
                    {
                        query: expectedQueries.systemScript,
                        variables: { script_name: 'announcement' },
                        response: { data: { scripts: [{ id: 'announcement_script', name: 'announcement', script_json: JSON.stringify(announcementScript), vars_query: null }] } }
                    }
                ];

                for (let i = 0; i < mockGraphql.length; i++) {
                    graphql.mockImplementationOnce((...args) => {
                        return Promise.resolve(mockGraphql[i].response);
                    });
                }

                await receive_group_message(group_id, message, senderNumber, botNumber, 'Test User');

                for (let i = 0; i < mockGraphql.length; i++) {
                    expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
                }
                expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
                const target_group_id = Buffer.from('group_2').toString('base64');
                expect(signal.send).toHaveBeenCalledWith(['group.' + target_group_id], botNumber, 'Message relayed from Test User in #groupHash: Lets send this to #anotherGroupHashtag');
            });

            it('should not relay a hashtag if the group is not in the community', async () => {
                const group_id = 'group_123';
                const base64_group_id = Buffer.from(group_id).toString('base64');
                const communityId = 'community_456';
                const senderNumber = '+1234567890';
                const botNumber = '+0987654321';
                const message = '#invalidGroupHashtag';

                const mockGraphql = [
                    {
                        query: `query RecieveGroupMessageQuery($bot_phone:String!, $phone:String!)`,
                        variables: { bot_phone: botNumber, phone: senderNumber },
                        response: { data: { communities: [{id: communityId, bot_phone: botNumber }], memberships: [ { id: 'membership_1', type: 'member', user: { phone: senderNumber }, community: { id: communityId, bot_phone: botNumber }, name: 'Test User' }] } }
                    },
                    {
                        query: expectedQueries.getGroupThread,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: 'done', community: { group_script_id: 'script_2' } }] } }
                    },
                    {
                        query: expectedQueries.systemScript,
                        variables: { script_name: 'announcement' },
                        response: { data: { scripts: [{ id: 'announcement_script', name: 'announcement', script_json: JSON.stringify(announcementScript), vars_query: null }] } }
                    },
                ];

                for (let i = 0; i < mockGraphql.length; i++) {
                    graphql.mockImplementationOnce((...args) => {
                        return Promise.resolve(mockGraphql[i].response);
                    });
                }

                await receive_group_message(group_id, message, senderNumber, botNumber);

                for (let i = 0; i < mockGraphql.length; i++) {
                    expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
                }
                expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
                expect(signal.send).not.toHaveBeenCalled();
            });
        });

    });

    describe('reply_message', () => {

        const mockQueryResponse = {
            data: {
                memberships: [{
                    id: 'membership_1',
                    permissions: ['onboarding', 'group_comms', 'announcement'],
                    name: 'Test Admin',
                    community_id: 'community_1',
                }],
                messages: [{
                    id: 'message_1',
                    about_membership: {
                        id: 'membership_2',
                        user: {
                            phone: '+9999999999'
                        }
                    }
                }]
            }
        };
            
        it('should forward a reply from admins to the person who sent the original message', async () => {
            const phone = '+1234567890';
            const bot_phone = '+0987654321';
            const signal_timestamp = 1741644982;
            const message = 'This is a reply';
            const expectedMessage = 'Message from Test Admin: ' + message;

            const mockGraphql = [
                {
                    query: expectedQueries.replyQuery,
                    variables: { bot_phone, phone, signal_timestamp },
                    response: mockQueryResponse
                }
            ];

            for (let i = 0; i < mockGraphql.length; i++) {
                graphql.mockImplementationOnce((...args) => {
                    return Promise.resolve(mockGraphql[i].response);
                });
            }

            await receive_reply(message, phone, bot_phone, signal_timestamp);

            for (let i = 0; i < mockGraphql.length; i++) {
                expect(graphql).toHaveBeenNthCalledWith(i + 1, expect.stringContaining(mockGraphql[i].query), mockGraphql[i].variables);
            }
            expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
            expect(signal.send).toHaveBeenCalledWith(['+9999999999'], bot_phone, expectedMessage);
        });

    });

});
