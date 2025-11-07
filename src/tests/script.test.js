const { graphql } = require('../apis/graphql');
const { signal_timestamp } = require('../models/message');
const Script = require('../models/script');

jest.mock('../apis/graphql');

const mockGetScriptResponse = {
    data: {
            scripts: [{
                id: 1,
                name: 'Test Script',
                script_json: '{"json": "json content"}',
                vars_query: 'vars query',
                targets_query: 'target query',
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
            scriptInstance = new Script(mockGetScriptResponse.data.scripts[0]);
        });



        it('should return vars data when the response is successful', async () => {
            scriptInstance.varsquery = 'vars query';
            const mockResponse = {
                data: { vars: [{ id: '123', name: 'Var 1' }] },
            };
            graphql.mockResolvedValue(mockResponse);
            const membership = { id: '123', user: { phone: 'member_phone' }, community: { bot_phone: 'bot_phone', id:'456'} };

            const data = await scriptInstance.get_vars(membership, 'message');

            expect(graphql).toHaveBeenCalledWith('vars query', { membership_id: "123" });
            expect(data).toEqual({bot_phone: 'bot_phone', phone: 'member_phone', id: "123", message: 'message', name: 'Var 1', community_id: '456' });
        });

        it('should return phone and bot_phone if no vars query is defined', async () => {
            scriptInstance.vars_query = '';

            const vars = await scriptInstance.get_vars({id: '123', user: {phone: 'member_phone'}, community: {bot_phone: 'bot_phone', id:'456'}}, 'message', 1234567890);

            expect(graphql).not.toHaveBeenCalled();
            expect(vars).toEqual({id: '123', bot_phone: 'bot_phone', phone: 'member_phone', community_id: '456', message: 'message', signal_timestamp: 1234567890 });
            expect(scriptInstance.vars).toEqual({id: '123', bot_phone: 'bot_phone', phone: 'member_phone', community_id: '456', message: 'message', signal_timestamp: 1234567890 });
        });

        it('should throw an error when the response is not successful', async () => {
            graphql.mockRejectedValue(new Error('Error message'));

            await expect(scriptInstance.get_vars({id: '123', user: {phone: 'member_phone'}, community: {bot_phone: 'bot_phone', id:'456'}}, 'message', 1234567890)).rejects.toThrow('Error message');
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

    describe('get_system_script', () => {
        it('should return a new Script instance when the response is successful', async () => {
            const mockResponse = {
                data: {
                    scripts: [{
                        id: 1,
                        name: 'Test Script',
                        script_json: '{"json": "json content"}',
                        vars_query: 'vars query',
                        targets_query: 'target query',
                    }],
                },
            };
            graphql.mockResolvedValue(mockResponse);

            const scriptInstance = await Script.get_system_script('Test Script');

            expect(graphql).toHaveBeenCalledWith(expect.stringContaining("query GetSystemScript($script_name: String!)"), { script_name: 'Test Script' });
            expect(scriptInstance).toBeInstanceOf(Script);
            expect(scriptInstance.id).toBe(1);
            expect(scriptInstance.name).toBe('Test Script');
        });
        it('should throw an error when the response is not successful', async () => {
            graphql.mockRejectedValue(new Error('Error message'));

            await expect(Script.get_system_script('Test Script')).rejects.toThrow('Error message');
        });
        it('should throw an error if the script is not found', async () => {
            const mockResponse = {
                data: {
                    scripts: [],
                },
            };
            graphql.mockResolvedValue(mockResponse);

            await expect(Script.get_system_script('Nonexistent Script')).rejects.toThrow('Script not found');
        });
    });

    describe('get', () => {
        it('should return a new Script instance when the response is successful', async () => {
            const mockResponse = {
                data: {
                    scripts: [{ id: 1, name: 'Test Script', script_json: '{"json": "json content"}' }],
                },
            };
            graphql.mockResolvedValue(mockResponse);

            const scriptInstance = await Script.get('Test Script');

            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('query GetScript($name:String!)'), { name: 'Test Script' });
            expect(scriptInstance.id).toBe(1);
            expect(scriptInstance).toBeInstanceOf(Script);
            expect(scriptInstance.name).toBe('Test Script');
        });
    })

    describe('update', () => {
        it('should update script data successfully', async () => {
            const mockResponse = {
                data: {
                    update_scripts: {
                        returning: [{ community_id: 2, id: 1, name: 'Test Script', script_json: '{"json": "json content"}' }],
                    }
                },
            };
            graphql.mockResolvedValue(mockResponse);

            const scriptInstance = await Script.update(mockResponse.data.update_scripts.returning[0]);

            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('mutation UpdateScript($community_id:uuid!, $name:String!, $script_json:String!)'), { community_id: 2, name: mockResponse.data.update_scripts.returning[0].name, script_json: mockResponse.data.update_scripts.returning[0].script_json });
            expect(scriptInstance).toBeInstanceOf(Script);
        });
    })

    describe('create', () => {
        it('should create script data successfully', async () => {
            const mockResponse = {
                data: {
                    insert_scripts_one: { id: 1, name: 'Test Script', script_json: '{"json": "json content"}' },
                },
            };
            graphql.mockResolvedValue(mockResponse);

            const scriptInstance = await Script.create({name: 'Test Script', community_id: '1', script_json: '{"json": "json content"}'});

            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('mutation CreateScript($script_json:String!, $name:String!, $community_id:uuid!)'), { community_id: '1', name: 'Test Script', script_json: mockResponse.data.insert_scripts_one.script_json });
            expect(scriptInstance).toBeInstanceOf(Script);
        });
    })
});