const RhyzalParser = require('../helpers/rhizal_parser');
const { community_id } = require('../models/message');
const Membership = require('../models/membership');
const Message = require('../models/message');
const GroupThread = require('../models/group_thread');

jest.mock('../models/message', () => ({
    send: jest.fn(),
    send_announcement: jest.fn(),
    set_message_type: jest.fn(),
    send_to_admins: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../models/membership', () => ({
    set_variable: jest.fn(),
}));

jest.mock('../models/group_thread', () => ({
    set_variable: jest.fn(),
}));



describe('rhyzal_parser', () => {

    const test_script = {
        "0": {
            "send": [
                "Message with {{var1}} to {{var2}}!"
            ],
            "on_receive": [{
                "if": "regex(var1, /foo/)",
                "then": [
                    { "step": 1 },
                    { "set_variable": { "variable": "name", "value": "user_name" } }
                ],
                "else": [
                    { "step": "done" }
                ]
            }]
        },
        "1": {
            "send": [
                "Another message with no variables!",
                "A second message to be sent a few seconds later.",
                "attach(filevar)"
            ],
            "on_receive": [{
                "step": "done"
            }]
        }
    };
    const test_json = JSON.stringify(test_script);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should throw an error for invalid input', () => {
            const invalid = `
    invalid_yaml: {{ action }} message {{ message_type }}
            `;
            expect(() => new RhyzalParser(invalid)).toThrowError(/^Invalid JSON input/);
        });
    });

    describe('send', () => {
        it('should throw an error if the script is not initialized', async () => {
            const parser = new RhyzalParser(null);
            await expect(parser.send(0, {})).rejects.toThrow('Script not initialized');
        });

        it('should throw an error if the step is missing from the script', async () => {
            const parser = new RhyzalParser(test_json);
            await expect(parser.send(2, {})).rejects.toThrow('Step missing from script');
        });

        it('should send the appropriate message', async () => {
            const message1 = 'Another message with no variables!';
            const message2 = 'A second message to be sent a few seconds later.';
            const parser = new RhyzalParser(test_json);
            await parser.send(1, {phone: '+1234567890', bot_phone: '+0987654321', community_id: '123', id: '456'});
    
            expect(Message.send).toHaveBeenCalledWith('123', '456', '+1234567890', '+0987654321', message1, true);
            expect(Message.send).toHaveBeenCalledWith('123', '456', '+1234567890', '+0987654321', message2, true);
        });

        it('should send a message but not log it if it is going to a group', async () => {
            const message1 = 'Another message with no variables!';
            const message2 = 'A second message to be sent a few seconds later.';
            const parser = new RhyzalParser(test_json);
            await parser.send(1, {group_id: '789', phone: '+1234567890', bot_phone: '+0987654321', community_id: '123', id: '456'});
    
            expect(Message.send).toHaveBeenCalledWith('123', '456', 'group.789', '+0987654321', message1, false);
            expect(Message.send).toHaveBeenCalledWith('123', '456', 'group.789', '+0987654321', message2, false);
        });
    
        it ('should send the appropriate message with variables', async () => {
            const message = 'Message with foo to bar!';
            const vars = {var1: 'foo', var2: 'bar', phone: '+1234567890', bot_phone: '+0987654321', community_id: '123', id: '456'};
            const parser = new RhyzalParser(test_json);
            await parser.send(0, vars);
            expect(Message.send).toHaveBeenCalledWith('123', '456', '+1234567890', '+0987654321', message, true);
        });

    });

    describe ('receive', () => {
        it('should throw an error if the script is not initialized', async () => {
            const parser = new RhyzalParser(null);
            const set_variable = jest.fn();
            await expect(parser.receive(0, {}, set_variable)).rejects.toThrow('Script not initialized');
        });

        it('should throw an error if the step is missing from the script', async () => {
            const parser = new RhyzalParser(test_json);
            await expect(parser.receive(2, {})).rejects.toThrow('Step missing from script');
        });


        it('should update a user\'s status on receive', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.receive("1", {id: "1"});
            expect(Membership.set_variable).toHaveBeenCalledWith("1", 'step', 'done');
        });

        it('should send the appropriate message based on the new status', async () => {
            const parser = new RhyzalParser(test_json);

            await parser.receive("0", {id: "123", var1: 'foo', phone: '+1234567890', bot_phone: '+0987654321', community_id:'456'});

            expect(Message.send).not.toHaveBeenCalledWith('Message with foo to bar!');
            expect(Message.send).toHaveBeenCalledWith('456', '123', '+1234567890', '+0987654321', 'Another message with no variables!', true);
            expect(Message.send).toHaveBeenCalledWith('456', '123', '+1234567890', '+0987654321', 'A second message to be sent a few seconds later.', true);
        });

        it ('should update a user\'s status based on a condition', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.receive("0", {id: 1, var1: 'foo'});
            expect(Membership.set_variable).toHaveBeenCalledWith(1,'step', "1");
        });

        it('should update a user\'s status differently if a different condition is met', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.receive("0", {id: 1, var1: 'bar'});
            expect(Membership.set_variable).toHaveBeenCalledWith(1, 'step', 'done');
        });

        it('should call evaluate_receive if the step is an object', async () => {
            const script2 ={
                "0": {
                "send": [
                    "Message with {{var1}} to {{var2}}!"
                ],
                "on_receive": {step: "done"}
            }};
            const test_json2 = JSON.stringify(script2);
            const parser = new RhyzalParser(test_json2);
            const evaluate_receive = jest.spyOn(parser, 'evaluate_receive');
            await parser.receive("0", {id: 1});
            expect(evaluate_receive).toHaveBeenCalledWith({step: "done"}, {id: 1});
        });

        it('should call evaluate_receive if the step is an array', async () => {
            const script3 ={
                "0": {
                "send": [
                    "Message with {{var1}} to {{var2}}!"
                ],
                "on_receive": [{step: "done"}]
            }};
            const test_json3 = JSON.stringify(script3);
            const parser = new RhyzalParser(test_json3);
            const evaluate_receive = jest.spyOn(parser, 'evaluate_receive');
            await parser.receive("0", {id: 1});
            expect(evaluate_receive).toHaveBeenCalledWith({step: "done"}, {id: 1});
        });

    });

    describe ('evaluate_receive', () => {
        it('should set the user status', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({step: 0}, {id: 1});
            expect(Membership.set_variable).toHaveBeenCalledWith(1, 'step', "0");
        });

        it('should set the user profile', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({set_variable: {variable: 'name', value: 'user_name'}}, {id: "1"});
            expect(Membership.set_variable).toHaveBeenCalledWith("1", 'name', 'user_name');
        });

        it('should set a variable both my making a call to set_variable and by setting vars', async () => {
            const parser = new RhyzalParser(test_json);
            let vars = { id: "1", var1: 'foo', var2: 'bar'};
            await parser.evaluate_receive({set_variable: {variable: 'name', value: 'user_name'}}, vars);
            expect(Membership.set_variable).toHaveBeenCalledWith("1", 'name', 'user_name');
            expect(vars.name).toBe('user_name');
        });

        it('should set a variable with regex', async () => {
            const parser = new RhyzalParser(test_json);
            let vars = { id: "1", var1: 'foo', var2: 'bar'};
            await parser.evaluate_receive({set_variable: {variable: 'name', value: 'regex(var1, /foo/)'}}, vars);
            expect(Membership.set_variable).toHaveBeenCalledWith("1", 'name', 'foo');
            expect(vars.name).toBe('foo');
        });

        it('should set a variable with regex and set the vars', async () => {
            const parser = new RhyzalParser(test_json);
            let vars = { id: "1", var1: 'foo', var2: 'bar'};
            await parser.evaluate_receive({set_variable: {variable: 'name', value: 'regex(var1, /foo/)'}}, vars);
            expect(Membership.set_variable).toHaveBeenCalledWith("1", 'name', 'foo');
            expect(vars.name).toBe('foo');
        });

        it('should evaluate an if condition', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({if: 'regex(var1, /foo/)', then: [{step: 0}]}, {var1: 'foo', id: "1"});
            expect(Membership.set_variable).toHaveBeenCalledWith("1", 'step', "0");
        });

        it('should evaluate an if condition with an else', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({if: 'regex(var1, /foo/)', then: [{step: 0}], else: [{step: 'done'}]}, {var1: 'bar', id: 1});
            expect(Membership.set_variable).toHaveBeenCalledWith(1, 'step', 'done');
        });

        it('should evaluate an if condition with an and', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({if: {and: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{step: 0}]}, {var1: 'foo', var2: 'bar', id: 1});
            expect(Membership.set_variable).toHaveBeenCalledWith(1, 'step', "0");

        });

        if ('should evaluate an if condition with an and that is falsy', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({if: {and: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{step: 0}]}, {var1: 'foo', var2: 'foo', id: 1});
            expect(Membership.set_variable).not.toHaveBeenCalled();
        });


        it('should evaluate an if condition with an or', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({if: {or: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{step: 0}]}, {var1: 'foo', var2: 'baz', id: 1});
            expect(Membership.set_variable).toHaveBeenCalledWith(1,'step', "0");
            await parser.evaluate_receive({if: {or: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{step: 0}]}, {var1: 'fuz', var2: 'bar', id: 1});
            expect(Membership.set_variable).toHaveBeenCalledWith(1, 'step', "0");
        });

        it ('shold evaluate an if condition with an or that is falsy', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({if: {or: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{user_status: 0}]}, {var1: 'fuz', var2: 'baz', id: 1});
            expect(Membership.set_variable).not.toHaveBeenCalled();
        });
    });

    describe ('evaluate_condition', () => {
        it('should properly evaluate a regex match between a variable and a regex', () => {
            const parser = new RhyzalParser(test_json);
            expect(parser.evaluate_condition('regex(var1, /foo/)', {var1: 'foo'})).toBe(true);
            expect(parser.evaluate_condition('regex(var1, /foo/)', {var1: 'bar'})).toBe(false);            
        });

        it('should properly evaluate a regex match between a variable and a regex and ignore case', () => {
            const parser = new RhyzalParser(test_json);
            expect(parser.evaluate_condition('regex(var1, /foo/)', {var1: 'FOO'})).toBe(true);          
        });

        it('should properly evaluate a regex match between two variables', () => {
            const parser = new RhyzalParser(test_json);
            expect(parser.evaluate_condition('regex(var1, var2)', {var1: 'foo', var2: 'foo'})).toBe(true);
            expect(parser.evaluate_condition('regex(var1, var2)', {var1: 'foo', var2: 'bar'})).toBe(false);
        });

        it('should properly evaluate a variable', () => {
            const parser = new RhyzalParser(test_json);
            expect(parser.evaluate_condition('var1', {var1: true})).toBe(true);
            expect(parser.evaluate_condition('var1', {var1: false})).toBe(false);
            expect(parser.evaluate_condition('var1', {var1: 1})).toBe(true);
            expect(parser.evaluate_condition('var1', {var1: 0})).toBe(false);
        });
    });

    describe('set_variable', () => {
        it('should set a variable correctly', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({set_variable: {variable: 'name', value: 'user_name'}}, {id: 'member_1'});
            expect(Membership.set_variable).toHaveBeenCalledWith('member_1', 'name', 'user_name');
        });

        it('should set a variable with regex correctly', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({set_variable: {variable: 'name', value: 'regex(var1, /foo/)'}}, {id: 'member_1', var1: 'foo'});
            expect(Membership.set_variable).toHaveBeenCalledWith('member_1', 'name', 'foo');
        });

        it('should set a variable to a key in vars', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({set_variable: {variable: 'name', value: 'var1'}}, {id: 'member_1', var1: 'foo'});
            expect(Membership.set_variable).toHaveBeenCalledWith('member_1', 'name', 'foo');
        });
    });

    describe('set_group_variable', () => {
        it('should set a group variable correctly', async () => {
            const parser = new RhyzalParser(test_json);
            parser.evaluate_receive({set_group_variable: {variable: 'group_name', value: 'test_group'}}, {group_id: 'group1'});
            await expect(GroupThread.set_variable).toHaveBeenCalledWith('group1', 'group_name', 'test_group');
        });

        it('should handle setting multiple group variables', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({set_group_variable: {variable: 'group_name', value: 'test_group'}}, {group_id: 'group1'});
            await parser.evaluate_receive({set_group_variable: {variable: 'group_status', value: 'active'}}, {group_id: 'group1'});
            await expect(GroupThread.set_variable).toHaveBeenCalledWith('group1', 'group_name', 'test_group');
            await expect(GroupThread.set_variable).toHaveBeenCalledWith('group1', 'group_status', 'active');
        });

        it('should throw an error if group_id is missing', async () => {
            const set_group_variable = jest.fn();
            const parser = new RhyzalParser(test_json);
            await expect(() => parser.evaluate_receive({set_group_variable: {variable: 'group_name', value: 'test_group'}}, {})).rejects.toThrowError('Group ID not found in vars');
        });

        it('should handle setting variables with regex', async () => {
            const parser = new RhyzalParser(test_json);
            parser.evaluate_receive({set_variable: {variable: 'group_name', value: 'regex(var1, /foo/)'}}, { id: 'member_1', var1: 'foo'});
            await expect(Membership.set_variable).toHaveBeenCalledWith('member_1', 'group_name', 'foo');
        });

        it('should handle setting group variables with regex', async () => {
            const parser = new RhyzalParser(test_json);
            parser.evaluate_receive({set_group_variable: {variable: 'group_name', value: 'regex(var1, /foo/)'}}, {group_id: 'group1', var1: 'foo'});
            await expect(GroupThread.set_variable).toHaveBeenCalledWith('group1', 'group_name', 'foo');
        });
    });

    describe('set_message_type', () => {
        it('should set the message type correctly', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({set_message_type: {type: 'text'}}, {signal_timestamp: 123456789});
            expect(Message.set_message_type).toHaveBeenCalledWith(123456789, 'text');
        });

        it('should throw an error if signal_timestamp is not found', async () => {
            const parser = new RhyzalParser(test_json);
            await expect(() => parser.evaluate_receive({set_message_type: {type: 'text'}}, {})).rejects.toThrowError('Signal timestamp not found in vars');
        });
    }
    );

    describe('send_announcement', () => {
        it('should send an announcement correctly', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({send_announcement: true}, {community_id: '123', id: '456'});
            expect(Message.send_announcement).toHaveBeenCalledWith('123', '456');
        });

        it('should throw an error if community_id is not found', async () => {
            const parser = new RhyzalParser(test_json);
            await expect(() => parser.evaluate_receive({send_announcement: {message: 'Hello, world!'}}, {})).rejects.toThrowError('Community ID not found in vars');
        });
    });

    describe('send_to_admins', () => {
        it('should send a message to admins correctly', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({send_to_admins: {preamble: 'Test preamble'}}, {community_id: '123', id: '456', message: 'Hello, world!'});
            expect(Message.send_to_admins).toHaveBeenCalledWith('123', '456', 'Test preamble\n\nHello, world!');
        });

        it('should replace variables in the preamble', async () => {
            const parser = new RhyzalParser(test_json);
            await parser.evaluate_receive({send_to_admins: {preamble: 'Test preamble {{var1}}'}}, {community_id: '123', id: '456', message: 'Hello, world!', var1: 'foo'});
            expect(Message.send_to_admins).toHaveBeenCalledWith('123', '456', 'Test preamble foo\n\nHello, world!');
        });

        it('should throw an error if community_id is not found', async () => {
            const parser = new RhyzalParser(test_json);
            await expect(() => parser.evaluate_receive({send_to_admins: true}, {})).rejects.toThrowError('Community ID not found in vars');
        });
    });

    describe('save_message', () => {
        it('should save a message with all required parameters', async () => {
            const parser = new RhyzalParser(test_json);
            const vars = {
                community_id: 'comm-123',
                id: 'member-456',
                message: 'Hello, world!',
                signal_timestamp: 1234567890,
                phone: '+1234567890'
            };
            
            await parser.evaluate_receive({save_message: true}, vars);
            
            expect(Message.create).toHaveBeenCalledWith(
                'comm-123',
                'member-456',
                'Hello, world!',
                1234567890,
                '+1234567890'
            );
        });

        it('should extract parameters correctly from vars object', async () => {
            const parser = new RhyzalParser(test_json);
            const vars = {
                community_id: 'community-abc',
                id: 'membership-def',
                message: 'Test message content',
                signal_timestamp: 9876543210,
                phone: '+9876543210',
                other_var: 'should_be_ignored'
            };
            
            await parser.evaluate_receive({save_message: true}, vars);
            
            expect(Message.create).toHaveBeenCalledWith(
                'community-abc',
                'membership-def',
                'Test message content',
                9876543210,
                '+9876543210'
            );
        });

        it('should handle empty message content', async () => {
            const parser = new RhyzalParser(test_json);
            const vars = {
                community_id: 'comm-123',
                id: 'member-456',
                message: '',
                signal_timestamp: 1234567890,
                phone: '+1234567890'
            };
            
            await parser.evaluate_receive({save_message: true}, vars);
            
            expect(Message.create).toHaveBeenCalledWith(
                'comm-123',
                'member-456',
                '',
                1234567890,
                '+1234567890'
            );
        });

        it('should handle numeric signal_timestamp', async () => {
            const parser = new RhyzalParser(test_json);
            const vars = {
                community_id: 'comm-123',
                id: 'member-456',
                message: 'Numeric timestamp test',
                signal_timestamp: 1234567890,
                phone: '+1234567890'
            };
            
            await parser.evaluate_receive({save_message: true}, vars);
            
            expect(Message.create).toHaveBeenCalledWith(
                'comm-123',
                'member-456',
                'Numeric timestamp test',
                1234567890,
                '+1234567890'
            );
        });

        it('should handle string signal_timestamp', async () => {
            const parser = new RhyzalParser(test_json);
            const vars = {
                community_id: 'comm-123',
                id: 'member-456',
                message: 'String timestamp test',
                signal_timestamp: '1234567890',
                phone: '+1234567890'
            };
            
            await parser.evaluate_receive({save_message: true}, vars);
            
            expect(Message.create).toHaveBeenCalledWith(
                'comm-123',
                'member-456',
                'String timestamp test',
                '1234567890',
                '+1234567890'
            );
        });

        it('should handle undefined parameters gracefully', async () => {
            const parser = new RhyzalParser(test_json);
            const vars = {
                community_id: undefined,
                id: undefined,
                message: undefined,
                signal_timestamp: undefined,
                phone: undefined
            };
            
            await parser.evaluate_receive({save_message: true}, vars);
            
            expect(Message.create).toHaveBeenCalledWith(
                undefined,
                undefined,
                undefined,
                undefined,
                undefined
            );
        });

        it('should work with minimal vars object', async () => {
            const parser = new RhyzalParser(test_json);
            const vars = {
                community_id: 'comm-123',
                id: 'member-456',
                message: 'Minimal test',
                signal_timestamp: 1234567890,
                phone: '+1234567890'
            };
            
            await parser.evaluate_receive({save_message: true}, vars);
            
            expect(Message.create).toHaveBeenCalledTimes(1);
            expect(Message.create).toHaveBeenCalledWith(
                'comm-123',
                'member-456',
                'Minimal test',
                1234567890,
                '+1234567890'
            );
        });
    });

});