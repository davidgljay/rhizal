const User = require('../models/user');
const Message = require('../models/message');
const Script = require('../models/script');
const { new_user, no_script_message, script_message, receive_message  } = require('../handlers/receive_message');

jest.mock('../models/user', () => {
    return {
        create: jest.fn((phone) => ({ id: '1', phone })),
        get: jest.fn()
    };
});

jest.mock('../models/message', () => {
    return {
        create: jest.fn(),
        send: jest.fn()
    };
});

jest.mock('../models/script', () => {
    return jest.fn().mockImplementation(() => {
        return {
            init: jest.fn(),
            send: jest.fn(),
            receive: jest.fn()
        };
    });
});

describe('new_user', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a new user with the given phone number', async () => {
        const phone = '1234567890';
        await new_user(phone);
        expect(User.create).toHaveBeenCalledWith(phone);
    });

    it('should initialize and send the onboarding script', async () => {
        const phone = '1234567890';
        const mockScriptInstance = {
            init: jest.fn(),
            send: jest.fn()
        };
        Script.mockImplementation(() => mockScriptInstance);

        await new_user(phone);

        expect(Script).toHaveBeenCalled();
        expect(mockScriptInstance.init).toHaveBeenCalledWith('onboarding', '1');
        expect(mockScriptInstance.send).toHaveBeenCalledWith('0');
    });
});

describe('no_script_message', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should send a message to the user', async () => {
        const user = { phone: '1234567890' };
        await no_script_message(user);
        expect(Message.send).toHaveBeenCalledWith(user.phone, 'Thanks for letting me know, I\'ll pass your message on to an organizer who may get back to you.');
    });
});

describe('script_message', () => {
    beforeEach(() => {    
        jest.clearAllMocks();
    });

    it('should initialize the user\'s script', async () => {
        const user = { id: '1', script: 'test_script' };
        const message = 'test message';
        const mockScriptInstance = {
            init: jest.fn(),
            receive: jest.fn(),
            send: jest.fn()
        };
        Script.mockImplementation(() => mockScriptInstance);

        await script_message(user, message);

        expect(Script).toHaveBeenCalled();
        expect(mockScriptInstance.init).toHaveBeenCalledWith(user.script, user.id);
    });

    it('should receive the user\'s message', async () => {
        const user = { id: '1', script: 'test_script' };
        const message = 'test message';
        const mockScriptInstance = {
            init: jest.fn(),
            receive: jest.fn()
        };
        Script.mockImplementation(() => mockScriptInstance);

        await script_message(user, message);

        expect(mockScriptInstance.receive).toHaveBeenCalledWith(user.step, message);
    });
});

describe('receive_message', () => {
    let mockScriptInstance;
    beforeEach(() => {
        jest.clearAllMocks();
        mockScriptInstance = {
            init: jest.fn(),
            receive: jest.fn(),
            send: jest.fn()
        };
        Script.mockImplementation(() => mockScriptInstance);
    });

    it('should log a message', async () => {
        const sender = '1234567890';
        const recipients = ['0987654321'];
        const message = 'test message';
        const sent_time = new Date();

        await receive_message(sender, recipients, message, sent_time);

        expect(Message.create).toHaveBeenCalledWith(sender, recipients, message, sent_time);
    });

    it('should get the user', async () => {
        const sender = '1234567890';
        const recipient = '0987654321';
        const message = 'test message';
        const sent_time = new Date();

        await receive_message(sender, recipient, message, sent_time);

        expect(User.get).toHaveBeenCalledWith(sender);
    });

    it('should create a new user if the user does not exist', async () => {
        const sender = '1234567890';
        const recipient = '0987654321';
        const message = 'test message';
        const sent_time = new Date();
        User.get.mockReturnValue(null);

        await receive_message(sender, recipient, message, sent_time);

        expect(User.get).toHaveBeenCalledWith(sender);
    });

    it('should send a message if the user\'s step is done', async () => {
        const sender = '1234567890';
        const recipient = '0987654321';
        const message = 'test message';
        const sent_time = new Date();
        User.get.mockReturnValue({ step: 'done' });

        await receive_message(sender, recipient, message, sent_time);

        expect(Message.send).toHaveBeenCalled();
    });

    it('should process the user\'s message', async () => {
        const sender = '1234567890';
        const recipient = '0987654321';
        const message = 'test message';
        const sent_time = new Date();
        User.get.mockReturnValue({ id: '1', step: 'step1', script: 'test_script' });

        await receive_message(sender, recipient, message, sent_time);

        expect(mockScriptInstance.init).toHaveBeenCalledWith('test_script', '1');
        expect(mockScriptInstance.receive).toHaveBeenCalledWith('step1', message);
    });
});