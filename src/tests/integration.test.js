const { receive_message, receive_group_message } = require('../handlers/receive_message');
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

const testScript = JSON.stringify(script);
const groupTestScript = JSON.stringify(groupScript);

jest.mock('../apis/signal', () => ({
    send: jest.fn(),
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

        it('should create a new user and send the first message of the script for a new phone number', async () => {
            const senderNumber = '+1234567890';
            const recipientNumber='+0987654321';
            const sentTime = 1741644982;

            const mockGraphql = [

                {
                    query: `query GetCommunities($bot_phone:String!)`,
                    variables: { bot_phone: recipientNumber },
                    response: { data: { communities: [{ id: "community_1", name: 'Mock Community', onboarding_id: 'script_2' }] } }
                },
                {
                    query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                    variables: { phone: senderNumber, bot_phone: recipientNumber },
                    response: { data: { memberships: [] } }
                },
                {
                    query: `query GetUser($phone: String!)`,
                    variables: { phone: senderNumber },
                    response: { data: { users: [] } }
                },
                {
                    query: `mutation CreateUserAndMembership($phone:String!, $community_id:uuid!)`,
                    variables: { phone: senderNumber, community_id: "community_1" },
                    response: { data: { insert_memberships_one: { id: "membership_1", user: { id: "user_1", phone: senderNumber }, type: 'member', community: { id: 'community_1', bot_phone: recipientNumber } } } }
                },
                {
                    query: `mutation updateMembershipVariable($id:uuid!, $value:uuid!)`,
                    variables: { id: "membership_1", value: "script_2" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                },
                {
                    query: `query GetScript($id:uuid!)`,
                    variables: { id: "script_2" },
                    response: { data: { scripts: [{ id: "script_2", name: 'onboarding', script_json: testScript, varsquery: 'query testVarsQuery($membership_id:uuid!) {}' }] } }
                },
                {
                    query: `query testVarsQuery($membership_id:uuid!)`,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ name: 'var1' }] } }
                },                {
                    query: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)`,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        sent_time: expect.any(String),
                        text: 'Welcome to the service!',
                        from_user: false
                    },
                    response: { data: { insert_messages_one: { id: "message_2", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
                },
                {
                    query: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)`,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        from_user: true,
                        sent_time: expect.any(String),
                        text: 'Hello'
                    },
                    response: { data: { insert_messages_one: { id: "message_1", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
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

            expect(Message.create).toHaveBeenCalledTimes(2);
            expect(signal.send).toHaveBeenCalledWith([senderNumber], recipientNumber, 'Welcome to the service!');
        });

        it('should create a new membership for an existing users and send the first message of the script', async () => {
            const senderNumber = '+1234567890';
            const recipientNumber = '+0987654321';
            const sentTime = 1741644982;

            const mockGraphql = [

                {
                    query: `query GetCommunities($bot_phone:String!)`,
                    variables: { bot_phone: recipientNumber },
                    response: { data: { communities: [{ id: "community_1", name: 'Mock Community', onboarding_id: 'script_2' }] } }
                },
                {
                    query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                    variables: { phone: senderNumber, bot_phone: recipientNumber },
                    response: { data: { memberships: [] } }
                },
                {
                    query: `query GetUser($phone: String!)`,
                    variables: { phone: senderNumber },
                    response: { data: { users: [{id: 'user_1'}] } }
                },
                {
                    query: `mutation CreateMembership($user_id:uuid!, $community_id:uuid!)`,
                    variables: { user_id: 'user_1', community_id: "community_1" },
                    response: { data: { insert_memberships_one: { id: "membership_1", user: { id: "user_1", phone: senderNumber }, type: 'member', community: { id: 'community_1', bot_phone: recipientNumber } } } }
                },
                {
                    query: `mutation updateMembershipVariable($id:uuid!, $value:uuid!)`,
                    variables: { id: "membership_1", value: "script_2" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                },
                {
                    query: `query GetScript($id:uuid!)`,
                    variables: { id: "script_2" },
                    response: { data: { scripts: [{ id: "script_2", name: 'onboarding', script_json: testScript, varsquery: 'query testVarsQuery($membership_id:uuid!) {}' } ]} }
                },
                {
                    query: `query testVarsQuery($membership_id:uuid!)`,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ name: 'var1' }] } }
                },                {
                    query: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)`,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        sent_time: expect.any(String),
                        text: 'Welcome to the service!',
                        from_user: false
                    },
                    response: { data: { insert_messages_one: { id: "message_2", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
                },
                {
                    query: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)`,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        from_user: true,
                        sent_time: expect.any(String),
                        text: 'Hello'
                    },
                    response: { data: { insert_messages_one: { id: "message_1", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
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

            const mockGraphql = [
                {
                    query: `query GetCommunities($bot_phone:String!)`,
                    variables: { bot_phone: recipientNumber },
                    response: { data: { communities: [] } }
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
            const senderNumber = '+1234567890';
            const recipientNumber = '+0987654321';
            const sentTime = 1741644982;

            const mockGraphql = [
                {
                    query: `query GetCommunities($bot_phone:String!)`,
                    variables: { bot_phone: recipientNumber },
                    response: { data: { communities: [{ id: "community_1", name: 'Mock Community', onboarding_id: 'script_2' }] } }
                },
                {
                    query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                    variables: { phone: senderNumber, bot_phone: recipientNumber },
                    response: { data: { memberships: [{ id: "membership_1", current_script_id: "script_2", step: "0", user: { id: "user_1", phone: senderNumber }, type: 'member', community: { id: 'community_1', bot_phone: recipientNumber } } ] } }
                },
                {
                    query: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)`,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        from_user: true,
                        sent_time: expect.any(String),
                        text: 'Hello'
                    },
                    response: { data: { insert_messages_one: { id: "message_1", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
                },
                {
                    query: `query GetScript($id:uuid!)`,
                    variables: { id: "script_2" },
                    response: { data: { scripts: [{ id: "script_2", name: 'onboarding', script_json: testScript, varsquery: 'query testVarsQuery($membership_id:uuid!) {}' } ]} }
                },
                {
                    query: `query testVarsQuery($membership_id:uuid!)`,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ var1: 'stuff', var2: 'things' }] } }
                },
                {
                    query: `mutation updateMembershipVariable($id:uuid!, $value:String!)`,
                    variables: { id: "membership_1", value: "1" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                },
                {
                    query: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)`,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        sent_time: expect.any(String),
                        text: 'Message with stuff to things!',
                        from_user: false
                    },
                    response: { data: { insert_messages_one: { id: "message_2", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
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
            expect(signal.send).toHaveBeenCalledWith([senderNumber], recipientNumber, 'Message with stuff to things!');
        });

        it('should implement logic based on a variable in the script and send multiple messages', async () => {
            const senderNumber = '+1234567890';
            const recipientNumber = '+0987654321';
            const sentTime = 1741644982;

            const mockGraphql = [
                {
                    query: `query GetCommunities($bot_phone:String!)`,
                    variables: { bot_phone: recipientNumber },
                    response: { data: { communities: [{ id: "community_1", name: 'Mock Community', onboarding_id: 'script_2' }] } }
                },
                {
                    query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                    variables: { phone: senderNumber, bot_phone: recipientNumber },
                    response: { data: { memberships: [{ id: "membership_1", current_script_id: "script_2", step: "1", user: { id: "user_1", phone: senderNumber }, type: 'member', community: { id: 'community_1', bot_phone: recipientNumber } } ] } }
                },
                {
                    query: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)`,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        from_user: true,
                        sent_time: expect.any(String),
                        text: 'yes'
                    },
                    response: { data: { insert_messages_one: { id: "message_1", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
                },
                {
                    query: `query GetScript($id:uuid!)`,
                    variables: { id: "script_2" },
                    response: { data: { scripts: [{ id: "script_2", name: 'onboarding', script_json: testScript, varsquery: 'query testVarsQuery($membership_id:uuid!) {}' } ]} }
                },
                {
                    query: `query testVarsQuery($membership_id:uuid!)`,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ var1: 'stuff', var2: 'things' }] } }
                },
                {
                    query: `mutation updateMembershipVariable($id:uuid!, $value:String!)`,
                    variables: { id: "membership_1", value: "2" },
                    response: { data: { updateMembership: { id: "membership_1" } } }
                },
                {
                    query: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)`,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        sent_time: expect.any(String),
                        text: 'Another message with no variables!',
                        from_user: false
                    },
                    response: { data: { insert_messages_one: { id: "message_2", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
                },
                {
                    query: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)`,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        sent_time: expect.any(String),
                        text: 'A second message to be sent a few seconds later.',
                        from_user: false
                    },
                    response: { data: { insert_messages_one: { id: "message_3", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
                },
                {
                    query: `mutation updateMembershipVariable($id:uuid!, $value:String!)`,
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
            const senderNumber = '+1234567890';
            const recipientNumber = '+0987654321';
            const sentTime = 1741644982;

            const mockGraphql = [
                {
                    query: `query GetCommunities($bot_phone:String!)`,
                    variables: { bot_phone: recipientNumber },
                    response: { data: { communities: [{ id: "community_1", name: 'Mock Community', onboarding_id: 'script_2' }] } }
                },
                {
                    query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                    variables: { phone: senderNumber, bot_phone: recipientNumber },
                    response: { data: { memberships: [{ id: "membership_1", current_script_id: "script_2", step: "1", user: { id: "user_1", phone: senderNumber }, type: 'member', community: { bot_phone: recipientNumber } } ] } }
                },
                {
                    query: `mutation CreateMessage($community_id: uuid!, $from_user: Boolean!, $membership_id: uuid!, $text: String!, $sent_time: timestamptz!)`,
                    variables: {
                        community_id: 'community_1',
                        membership_id: 'membership_1',
                        from_user: true,
                        sent_time: expect.any(String),
                        text: 'no'
                    },
                    response: { data: { insert_messages_one: { id: "message_1", membership: {id: 'membership_1', user: {phone: '+1234567890'}}, community: { id: 'community_1', bot_phone: '+0987654321'} } } }
                },
                {
                    query: `query GetScript($id:uuid!)`,
                    variables: { id: "script_2" },
                    response: { data: { scripts: [{ id: "script_2", name: 'onboarding', script_json: testScript, varsquery: 'query testVarsQuery($membership_id:uuid!) {}' } ]} }
                },
                {
                    query: `query testVarsQuery($membership_id:uuid!)`,
                    variables: { membership_id: "membership_1" },
                    response: { data: { vars: [{ var1: 'stuff', var2: 'things' }] } }
                },
                {
                    query: `mutation updateMembershipVariable($id:uuid!, $value:String!)`,
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
                        query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                        variables: { phone: senderNumber, bot_phone: botNumber },
                        response: { data: { memberships: [{ id: 'membership_1', phone: senderNumber, community: {id: communityId, bot_phone: botNumber }}] } }
                    },
                    {
                        query: `query GetGroupThread($group_id: String!)`,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [] } }
                    },
                    {
                        query: `mutation CreateGroupThread($community_id: uuid!, $group_id: String!)`,
                        variables: { community_id: communityId, group_id: base64_group_id },
                        response: { data: { insert_group_threads_one: { id: 'thread_1', group_id: base64_group_id, step: '0', community: {group_script_id: 'script_2'} } } }
                    },
                    {
                        query: `query GetScript($id:uuid!)`,
                        variables: { id: 'script_2' },
                        response: { data: { scripts: [{ id: 'script_2', name: 'group_setup', script_json: groupTestScript, varsquery: 'query testVarsQuery($membership_id:uuid!) {}' } ]} }
                    },
                    {
                        query: `query testVarsQuery($membership_id:uuid!)`,
                        variables: { membership_id: 'membership_1' },
                        response: { data: { vars: [{ name: 'var1' }] } }
                    },
                ];

                for (let i = 0; i < mockGraphql.length; i++) {
                    graphql.mockImplementationOnce((...args) => {
                        return Promise.resolve(mockGraphql[i].response);
                    });
                }


                await receive_group_message(group_id, message, senderNumber, botNumber);
                expect(graphql).toHaveBeenCalledTimes(mockGraphql.length);
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
                        query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                        variables: { phone: senderNumber, bot_phone: botNumber },
                        response: { data: { memberships: [{ id: 'membership_1', phone: senderNumber, community: {id: communityId, bot_phone: botNumber }}] } }
                    },
                    {
                        query: `query GetGroupThread($group_id: String!)`,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: '0', community: {group_script_id: 'script_2'} }] } }
                    },
                    {
                        query: `query GetScript($id:uuid!)`,
                        variables: { id: 'script_2' },
                        response: { data: { scripts: [{ id: 'script_2', name: 'group_setup', script_json: groupTestScript, varsquery: 'query testVarsQuery($membership_id:uuid!) {}' } ]} }
                    },
                    {
                        query: `query testVarsQuery($membership_id:uuid!)`,
                        variables: { membership_id: 'membership_1' },
                        response: { data: { vars: [{ name: 'var1' }] } }
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
                        query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                        variables: { phone: senderNumber, bot_phone: botNumber },
                        response: { data: { memberships: [{ id: 'membership_1', phone: senderNumber, community: {id: communityId, bot_phone: botNumber }}] } }
                    },
                    {
                        query: `query GetGroupThread($group_id: String!)`,
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
                        query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                        variables: { phone: senderNumber, bot_phone: botNumber },
                        response: { data: { memberships: [{ id: 'membership_1', phone: senderNumber, community: { id: communityId, bot_phone: botNumber } }] } }
                    },
                    {
                        query: `query GetGroupThread($group_id: String!)`,
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
                        query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                        variables: { phone: senderNumber, bot_phone: botNumber },
                        response: { data: { memberships: [{ id: 'membership_1', phone: senderNumber, community: { id: communityId, bot_phone: botNumber } }] } }
                    },
                    {
                        query: `query GetGroupThread($group_id: String!)`,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: '0', community: { group_script_id: 'script_2' } }] } }
                    },
                    {
                        query: `query GetScript($id:uuid!)`,
                        variables: { id: 'script_2' },
                        response: { data: { scripts: [{ id: 'script_2', name: 'group_setup', script_json: groupTestScript, varsquery: 'query testVarsQuery($membership_id:uuid!) {}' } ]} }
                    },
                    {
                        query: `query testVarsQuery($membership_id:uuid!)`,
                        variables: { membership_id: 'membership_1' },
                        response: { data: { vars: [{ name: 'var1' }] } }
                    },
                    {
                        query: `mutation UpdateGroupThreadVariable($group_id:String!, $value:String!)`,
                        variables: { group_id: base64_group_id, value: '#groupHashtag' },
                        response: { data: { updateGroupThread: { id: 'thread_1' } } }
                    },
                    {
                        query: `mutation UpdateGroupThreadVariable($group_id:String!, $value:String!)`,
                        variables: { group_id: base64_group_id, value: '1' },
                        response: { data: { updateGroupThread: { id: 'thread_1' } } }
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
                        query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                        variables: { phone: senderNumber, bot_phone: botNumber },
                        response: { data: { memberships: [{ id: 'membership_1', phone: senderNumber, community: { id: communityId, bot_phone: botNumber } }] } }
                    },
                    {
                        query: `query GetGroupThread($group_id: String!)`,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: '0', community: { group_script_id: 'script_2' } }] } }
                    },
                    {
                        query: `query GetScript($id:uuid!)`,
                        variables: { id: 'script_2' },
                        response: { data: { scripts: [{ id: 'script_2', name: 'group_setup', script_json: groupTestScript, varsquery: 'query testVarsQuery($membership_id:uuid!) {}' } ]} }
                    },
                    {
                        query: `query testVarsQuery($membership_id:uuid!)`,
                        variables: { membership_id: 'membership_1' },
                        response: { data: { vars: [{ name: 'var1' }] } }
                    },
                    {
                        query: `mutation UpdateGroupThreadVariable($group_id:String!, $value:String!)`,
                        variables: { group_id: base64_group_id, value: '2' },
                        response: { data: { updateGroupThread: { id: 'thread_1' } } }
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
                        query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                        variables: { phone: senderNumber, bot_phone: botNumber },
                        response: { data: { memberships: [{ id: 'membership_1', phone: senderNumber, community: { id: communityId, bot_phone: botNumber } }] } }
                    },
                    {
                        query: `query GetGroupThread($group_id: String!)`,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: 'done', community: { group_script_id: 'script_2' } }] } }
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

            it('should relay a message if the appropriate hashtag exists in the community', async () => {
                const group_id = 'group_123';
                const base64_group_id = Buffer.from(group_id).toString('base64');
                const communityId = 'community_456';
                const senderNumber = '+1234567890';
                const botNumber = '+0987654321';
                const message = 'Lets send this to #anotherGroupHashtag';

                const mockGraphql = [
                    {
                        query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                        variables: { phone: senderNumber, bot_phone: botNumber },
                        response: { data: { memberships: [{ id: 'membership_1', phone: senderNumber, community: { id: communityId, bot_phone: botNumber } }]} }
                    },
                    {
                        query: `query GetGroupThread($group_id: String!)`,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', hashtag: '#groupHash', group_id: base64_group_id, step: 'done', community: { group_script_id: 'script_2', group_threads: [{ group_id: 'group_2', hashtag: '#anotherGroupHashtag' }, { group_id: 'group_3', hashtag: '#funky' }] } }] } }
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
                expect(signal.send).toHaveBeenCalledWith(['group.group_2'], botNumber, 'Message relayed from +1234567890(Test User) in #groupHash: Lets send this to #anotherGroupHashtag');
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
                        query: `query GetMembershipFromPhoneNumbers($phone: String!, $bot_phone: String!)`,
                        variables: { phone: senderNumber, bot_phone: botNumber },
                        response: { data: { memberships: [{ id: 'membership_1', phone: senderNumber, community: { id: communityId, bot_phone: botNumber } }] } }
                    },
                    {
                        query: `query GetGroupThread($group_id: String!)`,
                        variables: { group_id: base64_group_id },
                        response: { data: { group_threads: [{ id: 'thread_1', group_id: base64_group_id, step: 'done', community: { group_script_id: 'script_2' } }] } }
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

    });

});
