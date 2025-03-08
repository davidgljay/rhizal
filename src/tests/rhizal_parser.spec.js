const RhyzalParser = require('../helpers/rhizal_parser');


describe('rhyzal_parser', () => {

    const test_yaml = `
script:
    0:
        send:
            - Message with {{var1}} to {{var2}}!
        on_receive:
            if: regex(var1, /foo/)
            then:
                - user_status: 1
                - set_variable:
                    variable: name
                    value: user_name
            else:
                - user_status: done
    1:
        send:
            - Another message with no variables!
            - A second message to be sent a few seconds later.
            - attach(filevar)
        on_receive:
            user_status: done
`;

    const set_user_variable = jest.fn();
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
            const parser = new RhyzalParser('stuff and things', send_message, set_user_variable);
            expect(() => parser.send(0, {})).toThrow('Script not initialized');
        });

        it('should throw an error if the step is missing from the script', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            expect(() => parser.send(2, {})).toThrow('Step missing from script');
        });

        it('should send the appropriate message', () => {
            const message1 = 'Another message with no variables!';
            const message2 = 'A second message to be sent a few seconds later.';
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.send(1, {});
    
            expect(send_message).toHaveBeenCalledWith(message1);
            expect(send_message).toHaveBeenCalledWith(message2);
        });
    
        it ('should send the appropriate message with variables', () => {
            const message = 'Message with foo to bar!';
            const vars = {var1: 'foo', var2: 'bar'};
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.send(0, vars, send_message);
            expect(send_message).toHaveBeenCalledWith(message);
        });

    });

    describe ('receive', () => {
        it('should throw an error if the script is not initialized', () => {
            const parser = new RhyzalParser('stuff and things', send_message, set_user_variable);
            const set_user_variable = jest.fn();
            expect(() => parser.receive(0, {}, set_user_variable)).toThrow('Script not initialized');
        });

        it('should throw an error if the step is missing from the script', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            const set_user_variable = jest.fn();
            expect(() => parser.receive(2, {}, set_user_variable)).toThrow('Step missing from script');
        });


        it('should update a user\'s status on receive', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.receive(1, {user_id: 1}, set_user_variable);
            expect(set_user_variable).toHaveBeenCalledWith(1, 'status', 'done');
        });

        it('should send the appropriate message based on the new status', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);

            parser.receive(0, {user_id: 1, var1: 'foo'}, set_user_variable, send_message);

            expect(send_message).not.toHaveBeenCalledWith('Message with foo to bar!');
            expect(send_message).toHaveBeenCalledWith('Another message with no variables!');
            expect(send_message).toHaveBeenCalledWith('A second message to be sent a few seconds later.');
        });

        it ('should update a user\'s status based on a condition', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.receive(0, {user_id: 1, var1: 'foo'});
            expect(set_user_variable).toHaveBeenCalledWith(1,'status', 1);
        });

        it('should update a user\'s status differently if a different condition is met', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.receive(0, {user_id: 1, var1: 'bar'});
            expect(set_user_variable).toHaveBeenCalledWith(1, 'status', 'done');
        });

    });

    describe ('evaluate_receive', () => {
        it('should set the user status', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.evaluate_receive({user_status: 0}, {user_id: 1});
            expect(set_user_variable).toHaveBeenCalledWith(1, 'status', 0);
        });

        it('should set the user profile', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.evaluate_receive({set_variable: {variable: 'name', value: 'user_name'}}, {user_id: 1});
            expect(set_user_variable).toHaveBeenCalledWith(1, 'name', 'user_name');
        });

        it('should evaluate an if condition', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.evaluate_receive({if: 'regex(var1, /foo/)', then: [{user_status: 0}]}, {var1: 'foo', user_id: 1});
            expect(set_user_variable).toHaveBeenCalledWith(1, 'status', 0);
        });

        it('should evaluate an if condition with an else', () => {
            const parser = new RhyzalParser(test_yaml,  send_message, set_user_variable);
            parser.evaluate_receive({if: 'regex(var1, /foo/)', then: [{user_status: 0}], else: [{user_status: 'done'}]}, {var1: 'bar', user_id: 1});
            expect(set_user_variable).toHaveBeenCalledWith(1, 'status', 'done');
        });

        it('should evaluate an if condition with an and', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.evaluate_receive({if: {and: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{user_status: 0}]}, {var1: 'foo', var2: 'bar', user_id: 1});
            expect(set_user_variable).toHaveBeenCalledWith(1, 'status', 0);

        });

        if ('should evaluate an if condition with an and that is falsy', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.evaluate_receive({if: {and: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{user_status: 0}]}, {var1: 'foo', var2: 'foo', user_id: 1});
            expect(set_user_variable).not.toHaveBeenCalled();
        });


        it('should evaluate an if condition with an or', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.evaluate_receive({if: {or: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{user_status: 0}]}, {var1: 'foo', var2: 'baz', user_id: 1});
            expect(set_user_variable).toHaveBeenCalledWith(1,'status', 0);
            parser.evaluate_receive({if: {or: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{user_status: 0}]}, {var1: 'fuz', var2: 'bar', user_id: 1});
            expect(set_user_variable).toHaveBeenCalledWith(1, 'status', 0);
        });

        it ('shold evaluate an if condition with an or that is falsy', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            parser.evaluate_receive({if: {or: ['regex(var1, /foo/)', 'regex(var2, /bar/)']}, then: [{user_status: 0}]}, {var1: 'fuz', var2: 'baz', user_id: 1});
            expect(set_user_variable).not.toHaveBeenCalled();
        });
    });

    describe ('evaluate_condition', () => {
        it('should properly evaluate a regex match between a variable and a regex', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            expect(parser.evaluate_condition('regex(var1, /foo/)', {var1: 'foo'})).toBe(true);
            expect(parser.evaluate_condition('regex(var1, /foo/)', {var1: 'bar'})).toBe(false);            
        });

        it('should properly evaluate a regex match between two variables', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            expect(parser.evaluate_condition('regex(var1, var2)', {var1: 'foo', var2: 'foo'})).toBe(true);
            expect(parser.evaluate_condition('regex(var1, var2)', {var1: 'foo', var2: 'bar'})).toBe(false);
        });

        it('should properly evaluate a variable', () => {
            const parser = new RhyzalParser(test_yaml, send_message, set_user_variable);
            expect(parser.evaluate_condition('var1', {var1: true})).toBe(true);
            expect(parser.evaluate_condition('var1', {var1: false})).toBe(false);
            expect(parser.evaluate_condition('var1', {var1: 1})).toBe(true);
            expect(parser.evaluate_condition('var1', {var1: 0})).toBe(false);
        });
    });

});