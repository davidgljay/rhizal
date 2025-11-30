const Membership = require('../models/membership');
const Message = require('../models/message');
const Script = require('../models/script');
const Community = require('../models/community');
const GroupThread = require('../models/group_thread');
const Signal = require('../apis/signal');
const { graphql } = require('../apis/graphql');
const { new_member, no_script_message, receive_message, receive_group_message, receive_reply, group_join_or_leave, new_member_joined_group  } = require('../handlers/receive_message');
const { bot_message_hashtag } = require('../helpers/hashtag_commands');

jest.mock('../models/membership', () => {
    const mockSetVariable = jest.fn();
    
    const MockMembership = jest.fn().mockImplementation((data) => {
        const instance = {
            set_variable: mockSetVariable,
        };
        // Copy all properties from data to instance
        if (data) {
            Object.assign(instance, data);
        }
        return instance;
    });
    
    // Add static methods
    MockMembership.create = jest.fn();
    MockMembership.set_variable = jest.fn();
    MockMembership.add_permissions = jest.fn();
    MockMembership.remove_permissions = jest.fn();
    MockMembership.get = jest.fn();
    MockMembership.update_permissions = jest.fn();
    MockMembership.create_admin = jest.fn();
    
    return MockMembership;
});

jest.mock('../models/message', () => {
    return {
        create: jest.fn(),
        send: jest.fn(),
        send_to_permission: jest.fn(),
        send_permission_message: jest.fn()
    };
});

jest.mock('../apis/signal', () => ({
    send: jest.fn(),
    show_typing_indicator: jest.fn(),
    emoji_reaction: jest.fn(),
    get_group_info: jest.fn(),
    get_contacts: jest.fn(),
}));


jest.mock('../models/group_thread', () => {
    return {
        run_script: jest.fn(),
        find_or_create_group_thread: jest.fn(),
        leave_group: jest.fn(),
        send_message: jest.fn()
    };
});

jest.mock('../models/community', () => {
    const mockCommunityClass = jest.fn().mockImplementation((id, name, data) => {
        return {
            id,
            name,
            data
        };
    });
    mockCommunityClass.get = jest.fn();
    return mockCommunityClass;
});

jest.mock('../apis/graphql', () => ({
    graphql: jest.fn()
}));

jest.mock('../helpers/hashtag_commands', () => ({
    bot_message_hashtag: jest.fn(),
    group_message_hashtag: jest.fn(),
}));

const mockScriptSend = jest.fn();
const mockScriptReceive = jest.fn();
const mockGetVars = jest.fn();
const mockScriptMessage = jest.fn();

jest.mock('../models/script', () => {
    return jest.fn().mockImplementation(() => {
        return {
            send: mockScriptSend,
            receive: mockScriptReceive,
            get_vars: mockGetVars,
            message: mockScriptMessage,
        };
    });
});


describe('receive_message', () => {
    describe('new_member', () => {

        const phone = '1234567890';
        const community = {
            id: 'community_1',
            name: 'Test Community',
            bot_phone: '0987654321',
            admins: [],
            onboarding: {
                id: 'onboarding_script',
                name: 'Onboarding Script',
                script_json: '{"0": {"send": ["Welcome to Test Community! Please reply with your name."]}}',
                vars_query: 'vars query',
                targets_query: 'target query',
            }
        }
        const user = { id: 'user_1', phone: '1234567890' };

        const mockMembership = {
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
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should create a new member and send a message', async () => {

            Membership.create.mockReturnValue(mockMembership);
            Message.send.mockReturnValue(Promise.resolve());

            await new_member(phone, community, "message", user);
            expect(Membership.create).toHaveBeenCalledWith(phone, community, user);
            expect(mockScriptSend).toHaveBeenCalledWith('0');
        });

        it('should create a new member and a new user and send a message', async () => {
            Membership.create.mockReturnValue(mockMembership);
            Message.send.mockReturnValue(Promise.resolve());

            await new_member(phone, community, "message", null);
            expect(Membership.create).toHaveBeenCalledWith(phone, community, null);
            expect(mockScriptSend).toHaveBeenCalledWith("0");
        });

    });

    describe('no_script_message', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should send a message to the member', async () => {
            const membership = { user: {phone: '1234567890' }, community: { id: 'community_1', bot_phone: '0987654321' }, id: 'membership_1', name: 'Test User' };
            const community = { id: 'community_1', bot_phone: '0987654321', admins: [] };
            const message = 'Test message';
            await no_script_message(membership, community, message);
            expect(Message.send_to_permission).toHaveBeenCalledWith('community_1', 'membership_1', 'Message relayed from Test User: \"Test message\" Reply to respond.', 'onboarding');
        });
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
                            script_json: '{"0": {"send": ["Welcome to Test Community! Please reply with your name."], "on_receive": [{"step": "done"}]}}',
                            vars_query: 'vars query',
                            targets_query: 'target query',
                        },
                        admins: []
                    }
                ],
                memberships: [
                    {
                        id: 'membership_1',
                        name: 'Test User',
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

        let sender = '1234567890';
        let recipient = '0987654321';
        let message = 'test message';
        let sent_time = new Date();
        
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should not log a message', async () => {
            graphql.mockResolvedValue(mockQueryResponse);

            await receive_message(sender, recipient, message, sent_time);

            expect(Message.create).not.toHaveBeenCalled();
        });

        it('should get the member and a community', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message';
            const sent_time = new Date();
            graphql.mockResolvedValue(mockQueryResponse);

            await receive_message(sender, recipient, message, sent_time);

            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('query RecieveMessageQuery($bot_phone:String!, $phone:String!)'), { bot_phone: recipient, phone: sender });
        });

        it('should create a new member if the member does not exist', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message';
            const sent_time = new Date();
            let noUserResponse = JSON.parse(JSON.stringify(mockQueryResponse));
            noUserResponse.data.users = [];
            noUserResponse.data.memberships = [];
            graphql.mockResolvedValue(noUserResponse);
            Membership.create.mockReturnValue({ id: 'membership_1', user: { phone: sender }, community: { id: 'community_1', bot_phone: recipient } });

            await receive_message(sender, recipient, message, sent_time);

            expect(Membership.create).toHaveBeenCalledWith(sender, noUserResponse.data.communities[0], null);
        });

        it('should send a message if the member\'s step is done and relay it to admins', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message';
            const sent_time = new Date();
            let doneResponse = JSON.parse(JSON.stringify(mockQueryResponse));;
            doneResponse.data.memberships[0].step = 'done';
            graphql.mockResolvedValue(doneResponse);

            await receive_message(sender, recipient, message, sent_time);

            expect(Message.send_to_permission).toHaveBeenCalledWith('community_1', 'membership_1', 'Message relayed from Test User: \"test message\" Reply to respond.', 'onboarding');
        });

        it('should process the member\'s message', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message';
            const sent_time = new Date();
            graphql.mockResolvedValue(mockQueryResponse);
            await receive_message(sender, recipient, message, sent_time);

            expect(mockGetVars).toHaveBeenCalledWith(mockQueryResponse.data.memberships[0], message, sent_time); 
            expect(mockScriptReceive).toHaveBeenCalledWith('0', message);
        });

        it('should stop if the hashtag triggers a command', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message with #command';
            const sent_time = new Date();
            graphql.mockResolvedValue(mockQueryResponse);
            bot_message_hashtag.mockResolvedValue(true);
            await receive_message(sender, recipient, message, sent_time);
            expect(Membership.set_variable).not.toHaveBeenCalled();
            expect(Message.send).not.toHaveBeenCalled();
        });

        it('should proceed if the hashtag does not trigger a command', async () => {

            graphql.mockResolvedValue(mockQueryResponse);
            bot_message_hashtag.mockResolvedValue(false);
            await receive_message(sender, recipient, message, sent_time);
            expect(mockGetVars).toHaveBeenCalledWith(mockQueryResponse.data.memberships[0], message, sent_time); 
            expect(mockScriptReceive).toHaveBeenCalledWith('0', message);
        });

        it('should load the script if the member has a current script', async () => {
            const memberScriptResponse = { ...mockQueryResponse };
            memberScriptResponse.data.memberships[0].current_script = { 
                id: 'current_script_id',
                name: 'Current Script',
                script_json: '{"0": {"send": ["Current script message"]}}'
            };
            graphql.mockResolvedValue(memberScriptResponse);
            await receive_message(sender, recipient, message, sent_time);
            expect(Script).toHaveBeenCalledWith(memberScriptResponse.data.memberships[0].current_script);
            expect(mockGetVars).toHaveBeenCalledWith(memberScriptResponse.data.memberships[0], message, sent_time);
            expect(mockScriptReceive).toHaveBeenCalledWith('0', message);
        });
    });

    describe('receive_group_message', () => {
        const mockQueryResponse = { data: {communities: [{ id: 'community_1', bot_phone: '0987654321' }], memberships: [ { id: 'membership_1', permissions: ['group_comms'] }] }};

        afterEach(() => {
            jest.clearAllMocks();
            jest.restoreAllMocks();
        });

        it('should handle messages when group_thread step is not "done"', async () => {
            const group_id = 'test_group_id';
            const base64_group_id = Buffer.from(group_id).toString('base64');
            const message = 'test message';
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';
            const timestamp = 1234567890;

            const mockGroupThread = { step: '0' };

            jest.spyOn(GroupThread, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);
            graphql.mockResolvedValue(mockQueryResponse);

            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name, timestamp);

            expect(graphql).toHaveBeenCalled();
            expect(GroupThread.find_or_create_group_thread).toHaveBeenCalledWith(base64_group_id, 'community_1');
            expect(GroupThread.run_script).toHaveBeenCalledWith(mockGroupThread, {user: {phone: from_phone}, community: { id: 'community_1', bot_phone }}, message, timestamp);
        });

        it('should take the appropriate action if the message includes a hashtag', async () => {
            const group_id = 'test_group_id';
            const message = 'test message with #command';
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';
            const timestamp = 1234567890;
            graphql.mockResolvedValue(mockQueryResponse);
            const mockGroupThread = { step: '0' };

            jest.spyOn(GroupThread, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);
            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name, timestamp);

            expect(bot_message_hashtag).toHaveBeenCalledWith('#command', expect.objectContaining({ id: 'membership_1' }), expect.objectContaining({ id: 'community_1' }), message, {step: '0'});

        });

        it('should return if there is no message and the group step is done', async () => {
            const group_id = 'test_group_id';
            const message = null;
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';
            const mockGroupThread = { step: 'done' };
            const timestamp = 1234567890;

            graphql.mockResolvedValue(mockQueryResponse);
            jest.spyOn(GroupThread, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);

            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name, timestamp);

            expect(graphql).toHaveBeenCalled();
            expect(GroupThread.find_or_create_group_thread).toHaveBeenCalled();
            expect(GroupThread.run_script).not.toHaveBeenCalled();
            expect(GroupThread.send_message).not.toHaveBeenCalled();
        });

        it('should return if there are no hashtags in the message', async () => {
            const group_id = 'test_group_id';
            const message = 'No hashtags here';
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';
            const mockGroupThread = { step: 'done' };
            const mockMembership = {community: { id: 'community_id' } };

            graphql.mockResolvedValue(mockQueryResponse);
            jest.spyOn(GroupThread, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);

            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name);

            expect(graphql).toHaveBeenCalled();
            expect(GroupThread.find_or_create_group_thread).toHaveBeenCalled();
            expect(GroupThread.run_script).not.toHaveBeenCalled();
            expect(GroupThread.send_message).not.toHaveBeenCalled();
        });

        it('should leave the group if the message contains the "leave" hashtag', async () => {
            const group_id = 'test_group_id';
            const base64_group_id = Buffer.from(group_id).toString('base64');
            const message = '#leave';
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';
            const mockGroupThread = { step: 'done', community: {group_threads: [{group_id: '123', hashtag: '#test'}]} };
            graphql.mockResolvedValue(mockQueryResponse);

            jest.spyOn(GroupThread, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);
            jest.spyOn(GroupThread, 'leave_group').mockResolvedValue();
            

            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name);

            expect(GroupThread.leave_group).toHaveBeenCalledWith(base64_group_id, bot_phone);
            expect(graphql).toHaveBeenCalled();
            expect(GroupThread.find_or_create_group_thread).toHaveBeenCalled();
            expect(GroupThread.run_script).not.toHaveBeenCalled();
            expect(GroupThread.send_message).not.toHaveBeenCalled();
        });

        it('should relay messages to groups with matching hashtags', async () => {
            const group_id = 'test_group_id';
            const message = '#test_hashtag Message content';
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';

            const mockGroupThread = {
                    step: 'done',
                    community: {
                        group_threads: [
                            { group_id: '1', hashtag: '#test_hashtag' },
                            { group_id: '2', hashtag: '#other_hashtag' },
                        ],
                    },
                    hashtag: '#other_hashtag',
            };

            jest.spyOn(GroupThread, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);
            graphql.mockResolvedValue(mockQueryResponse);
            jest.spyOn(Message, 'send').mockResolvedValue();

            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name);

            const expectedMessage = `Message relayed from ${sender_name} in ${mockGroupThread.hashtag}: ${message}`;
            expect(Message.send).toHaveBeenCalledWith(null, null, 'group.1', bot_phone, expectedMessage, false);
            expect(Message.send).not.toHaveBeenCalledWith(null, null, 'group.2', bot_phone, expectedMessage, false);
        });

        it('should not relay messages if the member does not have group_comms permission', async () => {
            const group_id = 'test_group_id';
            const message = '#test_hashtag Message content';
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';
            const mockQueryResponse = { data: {communities: [{ id: 'community_1', bot_phone: '0987654321' }], memberships: [ { id: 'membership_1', permissions: [] }] }};
            graphql.mockResolvedValue(mockQueryResponse);
            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name);
            expect(Message.send).not.toHaveBeenCalled();
        });
    });

    describe('receive_reply', () => {
        const mockQueryResponse = {
            data: {
                memberships: [
                    {
                        id: 'membership_1',
                        permissions: ['onboarding'],
                        name: 'Admin User',
                        community_id: 'community_1',
                    },
                ],
                messages: [
                    {
                        id: 'message_1',
                        about_membership: {
                            id: 'membership_2',
                            user: {
                                phone: '1234567890',
                            },
                        },
                    },
                ],
                communities: [
                    {
                        id: 'community_1',
                        bot_phone: '0987654321',
                    },
                ],
            },
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should send a reply to the member if the sender is an admin', async () => {
            const message = 'Reply message';
            const from_phone = '1111111111';
            const bot_phone = '0987654321';
            const reply_to_timestamp = 1234567890;

            graphql.mockResolvedValue(mockQueryResponse);

            await receive_reply(message, from_phone, bot_phone, reply_to_timestamp);

            expect(graphql).toHaveBeenCalledWith(
                expect.stringContaining('query ReplyQuery($bot_phone:String!, $phone:String!, $signal_timestamp:bigint!)'),
                { phone: from_phone, bot_phone, signal_timestamp: reply_to_timestamp }
            );
            expect(Message.send).toHaveBeenCalledWith(
                'community_1',
                'membership_1',
                '1234567890',
                bot_phone,
                'Message from Admin User: Reply message',
                false
            );
        });

        it('should not send a reply if there is no reply_to phone number', async () => {
            const message = 'Reply message';
            const from_phone = '1111111111';
            const bot_phone = '0987654321';
            const reply_to_timestamp = 1234567890;

            const noReplyToResponse = {
                ...mockQueryResponse,
                data: {
                    ...mockQueryResponse.data,
                    messages: [],
                },
            };

            graphql.mockResolvedValue(noReplyToResponse);

            await receive_reply(message, from_phone, bot_phone, reply_to_timestamp);

            expect(graphql).toHaveBeenCalled();
            expect(Message.send).not.toHaveBeenCalled();
        });

        it('should call receive_message if the user is not an admin', async () => {
            const message = 'Reply message';
            const from_phone = '1111111111';
            const bot_phone = '0987654321';
            const reply_to_timestamp = 1234567890;

            const mockReceiveMessageQueryResponse = {
                data: {
                    communities: [
                        {
                            id: 'community_1',
                            name: 'Test Community',
                            bot_phone: '0987654321',
                            onboarding: {
                                id: 'onboarding_script',
                                name: 'Onboarding Script',
                                script_json: '{"0": {"send": ["Welcome to Test Community! Please reply with your name."], "on_receive": [{"step": "done"}]}}',
                                vars_query: 'vars query',
                                targets_query: 'target query',
                            },
                            admins: []
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
            

            const nonAdminResponse = {
                ...mockQueryResponse,
                data: {
                    ...mockQueryResponse.data,
                    memberships: [
                        {
                            id: 'membership_1',
                            permissions: [],
                            name: 'Regular User',
                            community_id: 'community_1',
                        },
                    ],
                },
            };

            graphql.mockResolvedValueOnce(nonAdminResponse);
            graphql.mockResolvedValueOnce(mockReceiveMessageQueryResponse);

            await receive_reply(message, from_phone, bot_phone, reply_to_timestamp);

            expect(graphql).toHaveBeenNthCalledWith(1, 
                expect.stringContaining('query ReplyQuery($bot_phone:String!, $phone:String!, $signal_timestamp:bigint!)'),
                {"bot_phone": "0987654321", "phone": "1111111111", "signal_timestamp": 1234567890}
            );
            expect(graphql).toHaveBeenNthCalledWith(2,
                expect.stringContaining('query RecieveMessageQuery($bot_phone:String!, $phone:String!)'),
                { bot_phone: bot_phone, phone: from_phone }
            );
            expect(Message.send).not.toHaveBeenCalled();
            
        });

    });

    describe('group_join_or_leave', () => {
        const bot_phone = '0987654321';
        // Mock contacts mapping phone numbers to UUIDs
        const mockContacts = {
            '+1234567890': 'uuid-1234567890',
            '+0987654321': 'uuid-0987654321',
            '+1111111111': 'uuid-1111111111'
        };
        const mockGroupsResponse = {
            data: {
                group_threads: [
                    {
                        group_id: 'group1',
                        permissions: ['announcement', 'group_comms']
                    }
                ],
                memberships: [
                    {
                        id: 'membership_1',
                        user: { phone: 'uuid-1234567890' },
                        permissions: ['onboarding'],
                        community: { id: 'community_1', bot_phone: '0987654321' }
                    },
                    {
                        id: 'membership_2',
                        user: { phone: 'uuid-0987654321' },
                        permissions: ['onboarding'],
                        community: { id: 'community_1', bot_phone: '0987654321' }
                    }
                ]
            }
        };        
        
        beforeEach(() => {
            jest.clearAllMocks();
            // Mock get_contacts to return contacts object
            Signal.get_contacts.mockResolvedValue(mockContacts);
        });

        it('should add permissions to an existing user', async () => {


            const mockGroupInfo = {
                members: ['uuid-1234567890', 'uuid-0987654321']
            };


            graphql.mockResolvedValue(mockGroupsResponse);
            Signal.get_group_info.mockResolvedValue(mockGroupInfo);
            Signal.get_contacts.mockResolvedValue(mockContacts);
            Membership.update_permissions.mockResolvedValue({
                oldPermissions: ['onboarding'],
                newPermissions: ['onboarding', 'announcement', 'group_comms']
            });

            await group_join_or_leave(bot_phone);

            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('GetPermissionsGroups'), { bot_phone });
            expect(Signal.get_group_info).toHaveBeenCalledWith(bot_phone, 'group1');
            expect(Membership.update_permissions).toHaveBeenCalledWith(
                'membership_1',
                ['announcement', 'group_comms']
            );
        });

        it('should remove permissions from an existing user', async () => {

            // Clone mockGroupMemberships object so we can mutate it safely
            const mockGroupMemberships = JSON.parse(JSON.stringify(mockGroupsResponse));
            mockGroupMemberships.data.group_threads = [
                {
                    group_id: 'group1',
                    permissions: ['announcement']
                }
            ];
            mockGroupMemberships.data.memberships = [
                {
                    id: 'membership_1',
                    user: { phone: 'uuid-1234567890' },
                    permissions: ['announcement', 'group_comms', 'onboarding'],
                }
            ];

            const mockGroupInfo = {
                members: ['uuid-1234567890']
            };

            graphql.mockResolvedValue(mockGroupMemberships);
            Signal.get_group_info.mockResolvedValue(mockGroupInfo);
            Signal.get_contacts.mockResolvedValue(mockContacts);
            Membership.update_permissions.mockResolvedValue({
                oldPermissions: ['announcement', 'group_comms', 'onboarding'],
                newPermissions: ['announcement']
            });

            await group_join_or_leave(bot_phone);

            expect(Membership.update_permissions).toHaveBeenCalledWith(
                'membership_1',
                ['announcement']
            );
        });

        it('should call send_permission_message for new permissions that are added', async () => {

            const mockGroupInfo = {
                members: ['uuid-1234567890']
            };

            graphql.mockResolvedValue(mockGroupsResponse);
            Signal.get_group_info.mockResolvedValue(mockGroupInfo);
            Signal.get_contacts.mockResolvedValue(mockContacts);
            Membership.update_permissions.mockResolvedValue({
                oldPermissions: ['onboarding'],
                newPermissions: ['onboarding', 'announcement', 'group_comms']
            });
            Message.send.mockResolvedValue();

            await group_join_or_leave(bot_phone);

            // send_permission_message should be called for 'announcement' and 'group_comms' (new permissions)
            expect(Message.send_permission_message).toHaveBeenCalledTimes(2);
            expect(Message.send_permission_message).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'membership_1',
                    user: { phone: 'uuid-1234567890' },
                    community: { id: 'community_1', bot_phone: '0987654321' },
                    permissions: ['onboarding'],
                    set_variable: expect.any(Function)
                }),
                'announcement'
            );
            
            expect(Message.send_permission_message).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'membership_1',
                    user: { phone: 'uuid-1234567890' },
                    community: { id: 'community_1', bot_phone: '0987654321' }
                }),
                'group_comms'
            );
        });

        it('should not call send_permission_message for permissions that already exist', async () => {

            const mockGroupInfo = {
                members: ['uuid-1234567890']
            };

            graphql.mockResolvedValue(mockGroupsResponse);
            Signal.get_group_info.mockResolvedValue(mockGroupInfo);
            Signal.get_contacts.mockResolvedValue(mockContacts);
            // User already has these permissions
            Membership.update_permissions.mockResolvedValue({
                oldPermissions: ['announcement', 'group_comms'],
                newPermissions: ['announcement', 'group_comms']
            });
            Message.send.mockResolvedValue();

            await group_join_or_leave(bot_phone);

            // No new permissions, so send_permission_message should not be called
            expect(Message.send).not.toHaveBeenCalled();
        });

        it('should call new_member_joined_group for members in the group who are not already registered with Rhizal', async () => {

            
            const mockGroupMemberships = JSON.parse(JSON.stringify(mockGroupsResponse));
            mockGroupMemberships.data.memberships = [
                {
                    id: 'membership_1',
                    user: { phone: 'uuid-1234567890' },
                    permissions: ['onboarding'],
                }
            ];

            const mockGroupInfo = {
                members: ['uuid-1234567890', 'uuid-1111111111']
            };

            const mockNameRequestScriptResponse = {
                data: {
                    scripts: [{
                        id: 'name_request_script_id',
                        name: 'name_request',
                        script_json: '{}',
                        vars_query: '',
                        targets_query: '',
                        community: {
                            id: 'community_1',
                            bot_phone: '0987654321'
                        }
                    }]
                }
            };

            // Mock graphql - it will be called twice: once for groups, once for name request script
            graphql
                .mockResolvedValueOnce(mockGroupMemberships) // First call: get_permissions_groups_query in group_join_or_leave
                .mockResolvedValueOnce(mockNameRequestScriptResponse); // Second call: nameRequestScriptQuery in new_member_joined_group
            Signal.get_group_info.mockResolvedValue(mockGroupInfo);
            Signal.get_contacts.mockResolvedValue(mockContacts);
            Membership.update_permissions.mockResolvedValue({
                oldPermissions: ['onboarding'],
                newPermissions: ['onboarding', 'announcement', 'group_comms']
            });
            const newMemberMockMembership = {
                id: 'membership_2',
                user: { phone: 'uuid-1111111111' },
                community: { id: 'community_1', bot_phone: '0987654321' }
            };
            Membership.create.mockResolvedValue(newMemberMockMembership);
            Membership.set_variable.mockResolvedValue();

            await group_join_or_leave(bot_phone);
            // Verify that new_member_joined_group was called by checking its side effects
            // It calls graphql for name request script (second call), creates membership, and updates permissions
            expect(graphql).toHaveBeenCalledTimes(2); // Once for groups, once for name request script
            // Verify that graphql was called with nameRequestScriptQuery (indicating new_member_joined_group was called)
            const graphqlCalls = graphql.mock.calls;
            const nameRequestCall = graphqlCalls[1];
            expect(nameRequestCall).toBeDefined();
            // Verify that Membership.create was called (new_member_joined_group creates a membership)
            expect(Membership.create).toHaveBeenCalledWith('uuid-1111111111', { id: 'community_1', bot_phone: '0987654321' }, null);
            // Verify that update_permissions was called for both members
            expect(Membership.update_permissions).toHaveBeenCalledTimes(2);

            expect(Membership.update_permissions).toHaveBeenCalledWith(
                'membership_2',
                ['announcement', 'group_comms']
            );
            expect(Membership.update_permissions).toHaveBeenCalledWith(
                'membership_1',
                ['announcement', 'group_comms']
            );
            console.log(Membership.update_permissions.mock.calls);

            // Should update permissions for existing member
            expect(Membership.update_permissions).toHaveBeenCalledWith(
                'membership_1',
                ['announcement', 'group_comms']
            );
        });

        it('should handle multiple groups and aggregate permissions correctly', async () => {

            const mockGroupMemberships = JSON.parse(JSON.stringify(mockGroupsResponse));
            mockGroupMemberships.data.group_threads = [
                {
                    group_id: 'group1',
                    permissions: ['announcement']
                },
                {
                    group_id: 'group2',
                    permissions: ['group_comms']
                }
            ];

            const mockGroupInfo1 = {
                members: ['uuid-1234567890']
            };

            const mockGroupInfo2 = {
                members: ['uuid-1234567890']
            };

            const mockMembership = {
                id: 'membership_1',
                user: { phone: '1234567890' },
                community: { id: 'community_1', bot_phone: '0987654321' }
            };

            graphql.mockResolvedValue(mockGroupMemberships);
            Signal.get_group_info
                .mockResolvedValueOnce(mockGroupInfo1)
                .mockResolvedValueOnce(mockGroupInfo2);
            Signal.get_contacts.mockResolvedValue(mockContacts);
            Membership.get.mockResolvedValue(mockMembership);
            Membership.update_permissions.mockResolvedValue({
                oldPermissions: ['onboarding'],
                newPermissions: ['onboarding', 'announcement', 'group_comms']
            });
            Message.send.mockResolvedValue();

            await group_join_or_leave(bot_phone);

            // Should aggregate permissions from both groups
            expect(Membership.update_permissions).toHaveBeenCalledWith(
                'membership_1',
                ['announcement', 'group_comms']
            );
            // Should send messages for both new permissions
            expect(Message.send_permission_message).toHaveBeenCalledTimes(2);
        });

        it('should handle errors from Signal.get_group_info gracefully', async () => {
            const mockGroupsResponse = {
                data: {
                    group_threads: [
                        {
                            group_id: 'group1',
                            permissions: ['announcement']
                        }
                    ]
                }
            };

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            graphql.mockResolvedValue(mockGroupsResponse);
            Signal.get_contacts.mockResolvedValue(mockContacts);
            Signal.get_group_info.mockResolvedValue(new Error('Failed to get group info'));

            await group_join_or_leave(bot_phone);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error updating membership permissions:',
                expect.any(Error)
            );
            expect(Membership.get).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should convert phone numbers to UUIDs when members are returned as phone numbers', async () => {
            const mockGroupInfo = {
                members: ['+1234567890', '+0987654321'] // Phone numbers instead of UUIDs
            };

            graphql.mockResolvedValue(mockGroupsResponse);
            Signal.get_group_info.mockResolvedValue(mockGroupInfo);
            Signal.get_contacts.mockResolvedValue(mockContacts);
            Membership.update_permissions.mockResolvedValue({
                oldPermissions: ['onboarding'],
                newPermissions: ['onboarding', 'announcement', 'group_comms']
            });

            await group_join_or_leave(bot_phone);

            // Verify get_contacts was called
            expect(Signal.get_contacts).toHaveBeenCalledWith(bot_phone);
            
            // Verify that update_permissions was called with UUIDs (converted from phone numbers)
            expect(Membership.update_permissions).toHaveBeenCalledWith(
                'membership_1',
                ['announcement', 'group_comms']
            );
            expect(Membership.update_permissions).toHaveBeenCalledWith(
                'membership_2',
                ['announcement', 'group_comms']
            );
        });

        it('should handle members that are already UUIDs without conversion', async () => {
            const mockGroupInfo = {
                members: ['uuid-1234567890'] // Already UUIDs
            };

            graphql.mockResolvedValue(mockGroupsResponse);
            Signal.get_group_info.mockResolvedValue(mockGroupInfo);
            Signal.get_contacts.mockResolvedValue(mockContacts);
            Membership.update_permissions.mockResolvedValue({
                oldPermissions: ['onboarding'],
                newPermissions: ['onboarding', 'announcement', 'group_comms']
            });

            await group_join_or_leave(bot_phone);

            // Verify get_contacts was called
            expect(Signal.get_contacts).toHaveBeenCalledWith(bot_phone);
            
            // Verify that update_permissions was called with the UUIDs as-is
            expect(Membership.update_permissions).toHaveBeenCalledWith(
                'membership_1',
                ['announcement', 'group_comms']
            );
        });

        it('should replace phone numbers with UUIDs in the members list', async () => {
            const mockGroupInfo = {
                members: ['+1234567890']
            };

            const mockGroupsResponseLongPhone = {
                data: {
                    group_threads: [
                        {
                            group_id: 'group1',
                            permissions: ['announcement']
                        }
                    ],
                    memberships: [{
                        id: 'membership_1',
                        user: { phone: 'uuid-1234567890' },
                        permissions: ['onboarding'],
                        community: { id: 'community_1', bot_phone: '0987654321' }
                    }]
                }
            };

            graphql.mockResolvedValue(mockGroupsResponseLongPhone);
            Signal.get_group_info.mockResolvedValue(mockGroupInfo);
            Signal.get_contacts.mockResolvedValue(mockContacts);
            Membership.update_permissions.mockResolvedValue({
                oldPermissions: ['onboarding'],
                newPermissions: ['onboarding', 'announcement', 'group_comms']
            });

            await group_join_or_leave(bot_phone);

            // Verify get_contacts was called
            expect(Signal.get_contacts).toHaveBeenCalledWith(bot_phone);
            
            // Phone number longer than 12 chars should be treated as UUID, not converted
            // Since it's not in contacts and not registered, it should trigger new_member_joined_group
            expect(Signal.get_contacts).toHaveBeenCalled();
        });
    });


});