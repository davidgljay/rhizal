const { graphql } = require('../apis/graphql');
const Script = require('../models/script');

jest.mock('../apis/graphql');

const mockGetScriptResponse = {
    data: {
            scripts: [{
                id: 1,
                name: 'Test Script',
                script_json: '{"json": "json content"}',
                varsquery: 'vars query',
                targetquery: 'target query',
            }],
    },
};

describe('Script', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('get_targets', () => {
        let scriptInstance;
        beforeEach(async () => {
            graphql.mockResolvedValueOnce(mockGetScriptResponse);
            scriptInstance = await Script.init('1');
        });

        it('should return targets data when the response is successful', async () => {
            const mockResponse = {
                data: { targets: [{ id: 1, name: 'Target 1' }] },
            };
            graphql.mockResolvedValue(mockResponse);

            const data = await scriptInstance.get_targets();

            expect(graphql).toHaveBeenCalledWith({
                query: 'target query',
            });
            expect(data).toEqual(mockResponse.data);
        });

        it('should throw an error when the response is not successful', async () => {
            graphql.mockRejectedValue(new Error('Error message'));

            await expect(scriptInstance.get_targets()).rejects.toThrow('Error message');
        });

    });


    describe('get_vars', () => {
        let scriptInstance;
        beforeEach(async () => {
            graphql.mockResolvedValueOnce(mockGetScriptResponse);
            scriptInstance = await Script.init('1');
        });



        it('should return vars data when the response is successful', async () => {
            scriptInstance.varsquery = 'vars query';
            const mockResponse = {
                data: { vars: [{ id: '123', name: 'Var 1' }] },
            };
            graphql.mockResolvedValue(mockResponse);

            const data = await scriptInstance.get_vars({id: '123', user: {phone: 'member_phone'}, community: {bot_phone: 'bot_phone', id:'456'}}, 'message');

            expect(graphql).toHaveBeenCalledWith('vars query', { membership_id: "123" });
            expect(data).toEqual({bot_phone: 'bot_phone', phone: 'member_phone', id: "123", message: 'message', name: 'Var 1', community_id: '456' });
        });

        it('should return phone and bot_phone if no vars query is defined', async () => {
            scriptInstance.varsquery = '';

            const vars = await scriptInstance.get_vars({id: '123', user: {phone: 'member_phone'}, community: {bot_phone: 'bot_phone', id:'456'}}, 'message');

            expect(graphql).toHaveBeenCalledTimes(1);
            expect(vars).toEqual({id: '123', bot_phone: 'bot_phone', phone: 'member_phone', community_id: '456', message: 'message' });
            expect(scriptInstance.vars).toEqual({id: '123', bot_phone: 'bot_phone', phone: 'member_phone', community_id: '456', message: 'message' });
        });

        it('should throw an error when the response is not successful', async () => {
            graphql.mockRejectedValue(new Error('Error message'));

            await expect(scriptInstance.get_vars(1)).rejects.toThrow('Error message');
        });

    });

    describe('init', () => {

        it('should return a new Script instance when the response is successful', async () => {
            const mockResponse = {
                data: {
                        scripts: [{
                            id: 1,
                            name: 'Test Script',
                            script_json: '{"json": "json content"}',
                            varsquery: 'vars query',
                            targetquery: 'target query',
                        }],
                },
            };
            graphql.mockResolvedValue(mockResponse);

            const scriptInstance = await Script.init('1');

            expect(graphql).toHaveBeenCalledWith(`
query GetScript($id:uuid!) {
    scripts(where: {id: {_eq:$id}}) {
        id
        name
        script_json
        vars_query
        targets_query
    }
}
`,{ id: '1' });
            expect(scriptInstance).toBeInstanceOf(Script);
            expect(scriptInstance.id).toBe(1);
            expect(scriptInstance.name).toBe('Test Script');
            expect(scriptInstance.script_json).toBe('{"json": "json content"}');
            expect(scriptInstance.varsquery).toBe('vars query');
            expect(scriptInstance.targetquery).toBe('target query');
        });

        it('should throw an error when the response is not successful', async () => {
            graphql.mockRejectedValue(new Error('Error message'));

            await expect(Script.init('1')).rejects.toThrow('Error message');
        });

    });

    describe('send', () => {
        let scriptInstance;
        beforeEach(async () => {
            graphql.mockResolvedValueOnce(mockGetScriptResponse);
            scriptInstance = await Script.init('1');
        });

        it('should send a message via the parser', () => {
            scriptInstance.parser = {
                send: jest.fn(),
            };
            scriptInstance.vars = { var1: 'value1' };

            const step = 'step1';

            scriptInstance.send(step);

            expect(scriptInstance.parser.send).toHaveBeenCalledWith(step, scriptInstance.vars);
        });
    })

    describe('receive', () => {
        let scriptInstance;
        beforeEach(async () => {
            graphql.mockResolvedValueOnce(mockGetScriptResponse);
            scriptInstance = await Script.init('1');
        });
        it('should properly process a received message via the parser', () => {
            scriptInstance.parser = {
                receive: jest.fn(),
            };
            scriptInstance.vars = { var1: 'value1' };

            scriptInstance.receive('step', 'message_content');

            expect(scriptInstance.parser.receive).toHaveBeenCalledWith('step', { var1: 'value1' }, 'message_content');
        })
    })
});