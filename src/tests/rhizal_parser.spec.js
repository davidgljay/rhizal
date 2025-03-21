const RhyzalParser = require('../helpers/rhizal_parser');


describe('rhyzal_parser', () => {

    const test_yaml = `
    0:
        send:
            - Message with {{var1}} to {{var2}}!
        on_receive:
            if: regex(var1, /foo/)
            then:
                - step: 1
                - set_variable:
                    variable: name
                    value: user_name
            else:
                - step: done
    1:
        send:
            - Another message with no variables!
            - A second message to be sent a few seconds later.
            - attach(filevar)
        on_receive:
            step: done
`;

    const set_variable = jest.fn();
    const send_message = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should throw an error for invalid input', () => {
            const invalid = `
    invalid_yaml: {{ action }} message {{ message_type }}
            `;
            expect(() => new RhyzalParser(invalid)).toThrowError(/^Invalid yaml input/);
        });
    });

    describe('send', () => {
        it('should throw an error if the script is not initialized', () => {
            const parser = new RhyzalParser(null, send_message, set_variable);
            expect(() => parser.send(0, {})).toThrow('Script not initialized');
        });

        it('should throw an error if the step is missing from the script', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            expect(() => parser.send(2, {})).toThrow('Step missing from script');
        });

        it('should send the appropriate message', () => {
            const message1 = 'Another message with no variables!';
            const message2 = 'A second message to be sent a few seconds later.';
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.send(1, {phone: '+1234567890', bot_phone: '+0987654321'});
    
            expect(send_message).toHaveBeenCalledWith('+1234567890', '+0987654321', message1);
            expect(send_message).toHaveBeenCalledWith('+1234567890', '+0987654321', message2);
        });
    
        it ('should send the appropriate message with variables', () => {
            const message = 'Message with foo to bar!';
            const vars = {var1: 'foo', var2: 'bar', phone: '+1234567890', bot_phone: '+0987654321'};
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.send(0, vars, send_message);
            expect(send_message).toHaveBeenCalledWith('+1234567890', '+0987654321', message);
        });

    });

    describe ('receive', () => {
        it('should throw an error if the script is not initialized', () => {
            const parser = new RhyzalParser(null, send_message, set_variable);
            const set_variable = jest.fn();
            expect(() => parser.receive(0, {}, set_variable)).toThrow('Script not initialized');
        });

        it('should throw an error if the step is missing from the script', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            const set_variable = jest.fn();
            expect(() => parser.receive(2, {}, set_variable)).toThrow('Step missing from script');
        });


        it('should update a user\'s status on receive', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.receive(1, {id: "1"}, set_variable);
            expect(set_variable).toHaveBeenCalledWith("1", 'step', 'done');
        });

        it('should send the appropriate message based on the new status', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);

            parser.receive(0, {id: 1, var1: 'foo', phone: '+1234567890', bot_phone: '+0987654321'}, set_variable, send_message);

            expect(send_message).not.toHaveBeenCalledWith('Message with foo to bar!');
            expect(send_message).toHaveBeenCalledWith('+1234567890', '+0987654321', 'Another message with no variables!');
            expect(send_message).toHaveBeenCalledWith('+1234567890', '+0987654321', 'A second message to be sent a few seconds later.');
        });

        it ('should update a user\'s status based on a condition', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.receive(0, {id: 1, var1: 'foo'});
            expect(set_variable).toHaveBeenCalledWith(1,'step', 1);
        });

        it('should update a user\'s status differently if a different condition is met', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.receive(0, {id: 1, var1: 'bar'});
            expect(set_variable).toHaveBeenCalledWith(1, 'step', 'done');
        });

    });

    describe ('evaluate_receive', () => {
        it('should set the user status', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.evaluate_receive({step: 0}, {id: 1});
            expect(set_variable).toHaveBeenCalledWith(1, 'step', 0);
        });

        it('should set the user profile', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.evaluate_receive({set_variable: {variable: 'name', value: 'user_name'}}, {id: "1"});
            expect(set_variable).toHaveBeenCalledWith("1", 'name', 'user_name');
        });

        it('should evaluate an if condition', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.evaluate_receive({if: 'regex(var1, /foo/)', then: [{step: 0}]}, {var1: 'foo', id: "1"});
            expect(set_variable).toHaveBeenCalledWith("1", 'step', 0);
        });

        it('should evaluate an if condition with an else', () => {
            const parser = new RhyzalParser(test_yaml,  send_message, set_variable);
            parser.evaluate_receive({if: 'regex(var1, /foo/)', then: [{step: 0}], else: [{step: 'done'}]}, {var1: 'bar', id: 1});
            expect(set_variable).toHaveBeenCalledWith(1, 'step', 'done');
        });

        it('should evaluate an if condition with an and', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.evaluate_receive({if: {and: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{step: 0}]}, {var1: 'foo', var2: 'bar', id: 1});
            expect(set_variable).toHaveBeenCalledWith(1, 'step', 0);

        });

        if ('should evaluate an if condition with an and that is falsy', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.evaluate_receive({if: {and: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{step: 0}]}, {var1: 'foo', var2: 'foo', id: 1});
            expect(set_variable).not.toHaveBeenCalled();
        });


        it('should evaluate an if condition with an or', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.evaluate_receive({if: {or: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{step: 0}]}, {var1: 'foo', var2: 'baz', id: 1});
            expect(set_variable).toHaveBeenCalledWith(1,'step', 0);
            parser.evaluate_receive({if: {or: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{step: 0}]}, {var1: 'fuz', var2: 'bar', id: 1});
            expect(set_variable).toHaveBeenCalledWith(1, 'step', 0);
        });

        it ('shold evaluate an if condition with an or that is falsy', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            parser.evaluate_receive({if: {or: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{user_status: 0}]}, {var1: 'fuz', var2: 'baz', id: 1});
            expect(set_variable).not.toHaveBeenCalled();
        });
    });

    describe ('evaluate_condition', () => {
        it('should properly evaluate a regex match between a variable and a regex', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            expect(parser.evaluate_condition('regex(var1, /foo/)', {var1: 'foo'})).toBe(true);
            expect(parser.evaluate_condition('regex(var1, /foo/)', {var1: 'bar'})).toBe(false);            
        });

        it('should properly evaluate a regex match between two variables', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            expect(parser.evaluate_condition('regex(var1, var2)', {var1: 'foo', var2: 'foo'})).toBe(true);
            expect(parser.evaluate_condition('regex(var1, var2)', {var1: 'foo', var2: 'bar'})).toBe(false);
        });

        it('should properly evaluate a variable', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_variable);
            expect(parser.evaluate_condition('var1', {var1: true})).toBe(true);
            expect(parser.evaluate_condition('var1', {var1: false})).toBe(false);
            expect(parser.evaluate_condition('var1', {var1: 1})).toBe(true);
            expect(parser.evaluate_condition('var1', {var1: 0})).toBe(false);
        });
    });

});