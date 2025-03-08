const User = require('../models/user');
const Message = require('../models/message');
const Script = require('../models/script');
const { new_user, no_script_message, script_message  } = require('../handlers/receive_message');

jest.mock('../models/user' , () => {
    return {
        create: jest.fn((phone) => ({ id: '1', phone}))
    };
});
jest.mock('../models/message');
jest.mock('../models/script');

describe('new_user', () => {
    beforeEach(() => {
        User.create.mockClear();
        Script.mockClear();
    });

    it('should create a new user with the given phone number', () => {
        const phone = '1234567890';
        new_user(phone);
        expect(User.create).toHaveBeenCalledWith(phone);
    });

    it('should initialize and send the onboarding script', () => {
        const phone = '1234567890';
        const mockScriptInstance = {
            init: jest.fn(),
            send: jest.fn()
        };
        Script.mockImplementation(() => mockScriptInstance);

        new_user(phone);

        expect(Script).toHaveBeenCalled();
        expect(mockScriptInstance.init).toHaveBeenCalledWith('onboarding', '1');
        expect(mockScriptInstance.send).toHaveBeenCalledWith('0');
    });
});

describe('no_script_message', () => {
    beforeEach(() => {
        Message.send_message.mockClear();
    });

    it('should send a message to the user', () => {
        const user = { phone: '1234567890' };
        no_script_message(user);
        expect(Message.send_message).toHaveBeenCalledWith(user.phone, 'Thanks for letting me know, I\'ll pass your message on to an organizer who may get back to you.');
    });
});

describe('script_message', () => {
    beforeEach(() => {
        Script.mockClear();
    });

    it('should initialize the user\'s script', () => {
        const user = { id: '1', script: 'test_script' };
        const message = 'test message';
        const mockScriptInstance = {
            init: jest.fn(),
            receive: jest.fn()
        };
        Script.mockImplementation(() => mockScriptInstance);

        script_message(user, message);

        expect(Script).toHaveBeenCalled();
        expect(mockScriptInstance.init).toHaveBeenCalledWith(user.script, user.id);
    });

    it('should receive the user\'s message', () => {
        const user = { id: '1', script: 'test_script' };
        const message = 'test message';
        const mockScriptInstance = {
            init: jest.fn(),
            receive: jest.fn()
        };
        Script.mockImplementation(() => mockScriptInstance);

        script_message(user, message);

        expect(mockScriptInstance.receive).toHaveBeenCalledWith(user.step, message);
    });
});