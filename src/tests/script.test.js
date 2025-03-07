const { graphql } = require('../apis/graphql');
const Script = require('../models/script');

jest.mock('../apis/graphql');

describe('Script', () => {
    describe('get_targets', () => {
        const scriptInstance = new Script(1, 'Test Script', 'yaml content', 'vars query', 'target query');

        afterEach(() => {
            jest.clearAllMocks();
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

        it('should throw an unknown error when the response is not successful and no error message is provided', async () => {
            graphql.mockRejectedValue(new Error());

            await expect(scriptInstance.get_targets()).rejects.toThrow('Unknown error');
        });
    });


    describe('get_vars', () => {
        const scriptInstance = new Script(1, 'Test Script', 'yaml content', 'vars query', 'target query');

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should return vars data when the response is successful', async () => {
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

        it('should throw an unknown error when the response is not successful and no error message is provided', async () => {
            graphql.mockRejectedValue(new Error());

            await expect(scriptInstance.get_vars(1)).rejects.toThrow('Unknown error');
        });
    });

    describe(Script.get, () => {
        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should return a new Script instance when the response is successful', async () => {
            const mockResponse = {
                data: {
                    script: {
                        id: 1,
                        name: 'Test Script',
                        yaml: 'yaml content',
                        varsquery: 'vars query',
                        targetquery: 'target query',
                    },
                },
            };
            graphql.mockResolvedValue(mockResponse);

            const script = await Script.get('Test Script');

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
            expect(script).toBeInstanceOf(Script);
            expect(script.id).toBe(1);
            expect(script.name).toBe('Test Script');
            expect(script.yaml).toBe('yaml content');
            expect(script.varsquery).toBe('vars query');
            expect(script.targetquery).toBe('target query');
        });

        it('should throw an error when the response is not successful', async () => {
            graphql.mockRejectedValue(new Error('Error message'));

            await expect(Script.get('Test Script')).rejects.toThrow('Error message');
        });

        it('should throw an unknown error when the response is not successful and no error message is provided', async () => {
            graphql.mockRejectedValue(new Error());

            await expect(Script.get('Test Script')).rejects.toThrow('Unknown error getting script data');
        });
    });
});