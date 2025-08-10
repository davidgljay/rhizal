const { graphql } = require('../apis/graphql');
const fetch = require('node-fetch');

jest.mock('node-fetch');

describe('graphql', () => {
    const GRAPHQL_URL = 'https://test.hasura.app/v1/graphql';
    const GRAPHQL_ADMIN_SECRET = 'test-secret';

    beforeEach(() => {
        process.env.GRAPHQL_URL = GRAPHQL_URL
        process.env.GRAPHQL_ADMIN_SECRET = GRAPHQL_ADMIN_SECRET;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return data when the response is successful', async () => {
        const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({ data: { test: 'test' } }),
        };
        fetch.mockResolvedValue(mockResponse);

        const data = await graphql('{test}', {variables: { test: 'test' }});

        expect(fetch).toHaveBeenCalledWith(GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': GRAPHQL_ADMIN_SECRET,
            },
            body: "{\"query\":\"{test}\",\"variables\":{\"variables\":{\"test\":\"test\"}}}",
        });
        expect(data).toEqual({ data: { test: 'test' } });
    });

    it('should throw an error when the response is not successful', async () => {
        const mockResponse = {
            ok: false,
            json: jest.fn().mockResolvedValue({ errors: [{ message: 'Error message' }] }),
        };
        fetch.mockResolvedValue(mockResponse);

        const query = JSON.stringify({ query: '{ test }' });

        await expect(graphql(query)).rejects.toThrow('Error message');
    });

    it('should throw an unknown error when the response is not successful and no error message is provided', async () => {
        const mockResponse = {
            ok: false,
            json: jest.fn().mockResolvedValue({}),
        };
        fetch.mockResolvedValue(mockResponse);

        const query = JSON.stringify({ query: '{ test }' });

        await expect(graphql(query)).rejects.toThrow('Unknown error');
    });
});