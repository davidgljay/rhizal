const Membership = require('../models/membership');
const Message = require('../models/message');
const Script = require('../models/script');
const Community = require('../models/community');
const { new_member, no_script_message, script_message, receive_message  } = require('../handlers/receive_message');

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
    let mockScriptInstance;
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should log a message', async () => {
        const sender = '1234567890';
        const recipients = ['0987654321'];
        const message = 'test message';
        const sent_time = new Date();
        Community.get = jest.fn(() => {
            return {
                id: "1",
                name: 'Mock Community',
                data: { onboarding_id: 'mock_onboarding_script' }
            };
        });

        await receive_message(sender, recipients, message, sent_time);

        expect(Message.create).toHaveBeenCalledWith(sender, recipients, message, sent_time);
    });

    it('should get the member and a community', async () => {
        const sender = '1234567890';
        const recipients = ['0987654321'];
        const message = 'test message';
        const sent_time = new Date();
        Community.get = jest.fn(() => {
            return {
                id: "1",
                name: 'Mock Community',
                data: { onboarding_id: 'mock_onboarding_script' }
            };
        });

        await receive_message(sender, recipients, message, sent_time);

        expect(Membership.get).toHaveBeenCalledWith(sender, recipients[0]);
        expect(Community.get).toHaveBeenCalledWith(recipients[0]);
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
        expect(mockGetVars).toHaveBeenCalledWith({ id: '1', step: 'step1', current_script_id: 'test_script' }); 
        expect(mockScriptReceive).toHaveBeenCalledWith('step1', message);
    });
});