const { graphql } = require('../apis/graphql');
const Script = require('../models/script');

jest.mock('../apis/graphql');

describe('Script', () => {
    describe('get_targets', () => {
        const scriptInstance = new Script();

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should return targets data when the response is successful', async () => {
            scriptInstance.targetquery = 'target query';
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
        const scriptInstance = new Script();

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should return vars data when the response is successful', async () => {
            scriptInstance.varsquery = 'vars query';
            const mockResponse = {
                data: { vars: [{ id: 1, name: 'Var 1' }] },
            };
            graphql.mockResolvedValue(mockResponse);

            const data = await scriptInstance.get_vars(1);

            expect(graphql).toHaveBeenCalledWith({
                query: 'vars query',
                variables: { user_id: 1 },
            });
            expect(data).toEqual(mockResponse.data);
        });

        it('should throw an error when the response is not successful', async () => {
            graphql.mockRejectedValue(new Error('Error message'));

            await expect(scriptInstance.get_vars(1)).rejects.toThrow('Error message');
        });

    });

    describe('init', () => {
        const scriptInstance = new Script();
        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should return a new Script instance when the response is successful', async () => {
            const mockResponse = {
                data: {
                    GetScript: {
                            script: {
                            id: 1,
                            name: 'Test Script',
                            yaml: 'yaml content',
                            varsquery: 'vars query',
                            targetquery: 'target query',
                        },
                    },
                },
            };
            graphql.mockResolvedValue(mockResponse);

            await scriptInstance.init('Test Script');

            expect(graphql).toHaveBeenCalledWith({
                query: `
query GetScript($name: String!) {
    script(name: $name) {
        id
        name
        yaml
        varsquery
        targetquery
    }
}
`,
                variables: { name: 'Test Script' },
            });
            expect(scriptInstance).toBeInstanceOf(Script);
            expect(scriptInstance.id).toBe(1);
            expect(scriptInstance.name).toBe('Test Script');
            expect(scriptInstance.yaml).toBe('yaml content');
            expect(scriptInstance.varsquery).toBe('vars query');
            expect(scriptInstance.targetquery).toBe('target query');
        });

        it('should throw an error when the response is not successful', async () => {
            graphql.mockRejectedValue(new Error('Error message'));

            await expect(scriptInstance.init('Test Script')).rejects.toThrow('Error message');
        });

    });

    describe('send', () => {
        it('should send a message via the parser', () => {
            const scriptInstance = new Script();
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
        it('should properly process a received message via the parser', () => {
            const scriptInstance = new Script();
            scriptInstance.parser = {
                receive: jest.fn(),
            };
            scriptInstance.vars = { var1: 'value1' };

            scriptInstance.receive('step', 'message_content');

            expect(scriptInstance.parser.receive).toHaveBeenCalledWith('step', { var1: 'value1' }, 'message_content');
        })
    })
});