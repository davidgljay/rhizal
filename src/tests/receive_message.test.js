const Membership = require('../models/membership');
const Message = require('../models/message');
const Script = require('../models/script');
const Community = require('../models/community');
const GroupThread = require('../models/group_thread');
const Signal = require('../apis/signal');
const { graphql } = require('../apis/graphql');
const { new_member, no_script_message, receive_message, receive_group_message, receive_reply, relay_message_to_admins  } = require('../handlers/receive_message');
const { bot_message_hashtag } = require('../helpers/hashtag_commands');

jest.mock('../models/membership', () => {
    return {
        create: jest.fn((phone) => ({ 
            id: '1', 
            phone,
            set_variable: jest.fn(),
        })),
        set_variable: jest.fn(),
        get: jest.fn()
    };
});

jest.mock('../models/message', () => {
    return {
        create: jest.fn(),
        send: jest.fn(),
        send_to_admins: jest.fn()
    };
});

jest.mock('../apis/signal', () => ({
    send: jest.fn(),
    show_typing_indicator: jest.fn(),
    emoji_reaction: jest.fn(),
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
    return jest.fn().mockImplementation((id, name, data) => {
        return {
            id,
            name,
            data
        };
    }); 
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
            expect(Message.send_to_admins).toHaveBeenCalledWith('community_1', 'membership_1', 'Message relayed from Test User: \"Test message\" Reply to respond.', community);
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

        it('should log a message', async () => {
            graphql.mockResolvedValue(mockQueryResponse);

            await receive_message(sender, recipient, message, sent_time);

            expect(Message.create).toHaveBeenCalledWith("community_1", "membership_1", message, sent_time, true);
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

            expect(Message.send_to_admins).toHaveBeenCalledWith('community_1', 'membership_1', 'Message relayed from Test User: \"test message\" Reply to respond.', doneResponse.data.communities[0]);
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

        it('should call the appropriate function if the message includes a hashtag', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message with #command';
            const sent_time = new Date();
            graphql.mockResolvedValue(mockQueryResponse);
            await receive_message(sender, recipient, message, sent_time);

            expect(bot_message_hashtag).toHaveBeenCalledWith('#command', expect.objectContaining({ id: 'membership_1' }), expect.objectContaining({ id: 'community_1' }), message);

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
        const mockQueryResponse = { data: {communities: [{ id: 'community_id', bot_phone: '0987654321' }] }};

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
            expect(GroupThread.find_or_create_group_thread).toHaveBeenCalledWith(base64_group_id, 'community_id');
            expect(GroupThread.run_script).toHaveBeenCalledWith(mockGroupThread, {user: {phone: from_phone}, community: { id: 'community_id', bot_phone }}, message, timestamp);
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
    });

    describe('receive_reply', () => {
        const mockQueryResponse = {
            data: {
                memberships: [
                    {
                        id: 'membership_1',
                        type: 'admin',
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
                true
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
                            type: 'member',
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
});