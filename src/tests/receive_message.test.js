const Membership = require('../models/membership');
const Message = require('../models/message');
const Script = require('../models/script');
const Community = require('../models/community');
const GroupThread = require('../models/group_thread');
const Signal = require('../apis/signal');
const { new_member, no_script_message, script_message, receive_message, receive_group_message  } = require('../handlers/receive_message');

jest.mock('../models/membership', () => {
    return {
        create: jest.fn((phone) => ({ 
            id: '1', 
            phone,
            set_variable: jest.fn(),
        })),
        get: jest.fn()
    };
});

jest.mock('../models/message', () => {
    return {
        create: jest.fn(),
        send: jest.fn()
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

const mockScriptSend = jest.fn();
const mockScriptReceive = jest.fn();
const mockGetVars = jest.fn();
const mockScriptMessage = jest.fn();

Script.init = jest.fn().mockImplementation(() => {
    return {
        send: mockScriptSend,
        receive: mockScriptReceive,
        get_vars: mockGetVars,
        script_message: mockScriptMessage
    };
});
describe('receive_message', () => {
    describe('new_member', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should create a new member with the given phone number', async () => {
            const phone = '1234567890';
            const community = new Community('1', 'Test Community', { onboarding_id: 'onboarding_script' });
            const membership = await new_member(phone, community);
            expect(Membership.create).toHaveBeenCalledWith(phone, community.id);
            expect(membership.set_variable).toHaveBeenCalledWith('current_script_id', community.data.onboarding_id);
        });

        it('should initialize and send the appropriate message', async () => {
            const phone = '1234567890';
            const community = new Community('1', 'Test Community', { onboarding_id: 'onboarding_script' });
            await new_member(phone, community);

            expect(Script.init).toHaveBeenCalledWith('onboarding_script');
            expect(mockScriptSend).toHaveBeenCalledWith('0');
        });
    });

    describe('no_script_message', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should send a message to the member', async () => {
            const member = { phone: '1234567890' };
            await no_script_message(member);
            expect(Message.send).toHaveBeenCalledWith(member.phone, 'Thanks for letting me know, I\'ll pass your message on to an organizer who may get back to you.');
        });
    });

    describe('script_message', () => {
        beforeEach(() => {    
            jest.clearAllMocks();
        });

        it('should initialize the member\'s script', async () => {
            const member = { id: '1', current_script_id: '2', step: '0' };
            const message = 'test message';

            await script_message(member, message);

            expect(Script.init).toHaveBeenCalledWith('2');
        });

        it('should receive the member\'s message', async () => {
            const member = { id: '1', current_script_id: '2', step: '0' };
            const message = 'test message';

            await script_message(member, message);

            expect(Script.init).toHaveBeenCalledWith('2');
            expect(mockScriptReceive).toHaveBeenCalledWith(member.step, message);
        });
    });

    describe('receive_message', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should log a message', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message';
            const sent_time = new Date();
            Community.get = jest.fn(() => {
                return {
                    id: "1",
                    name: 'Mock Community',
                    data: { onboarding_id: 'mock_onboarding_script' }
                };
            });

            Membership.get = jest.fn(() => {
                return {
                    id: "membership_1",
                    };
            });

            await receive_message(sender, recipient, message, sent_time);

            expect(Message.create).toHaveBeenCalledWith("1", "membership_1", message, sent_time, true);
        });

        it('should get the member and a community', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message';
            const sent_time = new Date();
            Community.get = jest.fn(() => {
                return {
                    id: "1",
                    name: 'Mock Community',
                    data: { onboarding_id: 'mock_onboarding_script' }
                };
            });

            await receive_message(sender, recipient, message, sent_time);

            expect(Membership.get).toHaveBeenCalledWith(sender, recipient);
            expect(Community.get).toHaveBeenCalledWith(recipient);
        });

        it('should create a new member if the member does not exist', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message';
            const sent_time = new Date();
            Membership.get.mockReturnValue(null);
            const mockCommunity = {
                id: "1",
                name: 'Mock Community',
                data: { onboarding_id: 'mock_onboarding_script' }
            }
            Community.get = jest.fn(() => mockCommunity);

            await receive_message(sender, recipient, message, sent_time);

            expect(Membership.create).toHaveBeenCalledWith(sender, mockCommunity.id);
        });

        it('should send a message if the member\'s step is done', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message';
            const sent_time = new Date();
            Membership.get.mockReturnValue({ step: 'done' });

            await receive_message(sender, recipient, message, sent_time);

            expect(Message.send).toHaveBeenCalled();
        });

        it('should process the member\'s message', async () => {
            const sender = '1234567890';
            const recipient = '0987654321';
            const message = 'test message';
            const sent_time = new Date();
            Community.get.mockReturnValue({
                id: "1",
                name: 'Mock Community',
                data: { onboarding_id: 'test_script' }
            });
            Membership.get.mockReturnValue({ id: '1', step: 'step1', current_script_id: 'test_script' });

            await receive_message(sender, recipient, message, sent_time);

            expect(Script.init).toHaveBeenCalledWith('test_script');
            expect(mockGetVars).toHaveBeenCalledWith({ id: '1', step: 'step1', current_script_id: 'test_script' }, message); 
            expect(mockScriptReceive).toHaveBeenCalledWith('step1', message);
        });
    });

    describe('receive_group_message', () => {

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

            const mockMembership = { data: { community: { id: 'community_id' } } };
            const mockGroupThread = { step: '0' };

            jest.spyOn(GroupThread, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);
            jest.spyOn(Membership, 'get').mockResolvedValue(mockMembership);

            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name);

            expect(Membership.get).toHaveBeenCalledWith(from_phone, bot_phone);
            expect(GroupThread.find_or_create_group_thread).toHaveBeenCalledWith(base64_group_id, 'community_id');
            expect(GroupThread.run_script).toHaveBeenCalledWith(mockGroupThread, mockMembership, message);
        });

        it('should return if there is no message and the group step is done', async () => {
            const group_id = 'test_group_id';
            const message = null;
            const from_phone = '1234567890';
            const bot_phone = '0987654321';
            const sender_name = 'Test Sender';
            const mockGroupThread = { step: 'done' };
            const mockMembership = { data: { community: { id: 'community_id' } } };

            jest.spyOn(Membership, 'get').mockResolvedValue(mockMembership);
            jest.spyOn(GroupThread, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);

            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name);

            expect(Membership.get).toHaveBeenCalled();
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
            const mockMembership = { data: { community: { id: 'community_id' } } };

            jest.spyOn(Membership, 'get').mockResolvedValue(mockMembership);
            jest.spyOn(GroupThread, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);

            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name);

            expect(Membership.get).toHaveBeenCalled();
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

            jest.spyOn(GroupThread, 'find_or_create_group_thread').mockResolvedValue(mockGroupThread);
            jest.spyOn(GroupThread, 'leave_group').mockResolvedValue();
            

            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name);

            expect(GroupThread.leave_group).toHaveBeenCalledWith(base64_group_id, bot_phone);
            expect(Membership.get).toHaveBeenCalled();
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

            const mockMembership = { data: { community: { id: 'community_id' } } };
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
            jest.spyOn(Membership, 'get').mockResolvedValue(mockMembership);
            jest.spyOn(Message, 'send').mockResolvedValue();

            await receive_group_message(group_id, message, from_phone, bot_phone, sender_name);

            const expectedMessage = `Message relayed from ${from_phone}(${sender_name}) in ${mockGroupThread.hashtag}: ${message}`;
            expect(Message.send).toHaveBeenCalledWith(null, null, 'group.1', bot_phone, expectedMessage, false);
            expect(Message.send).not.toHaveBeenCalledWith(null, null, 'group.2', bot_phone, expectedMessage, false);
        });
    });
});