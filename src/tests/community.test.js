const Community = require('../models/community');
const { graphql } = require('../apis/graphql');

jest.mock('../apis/graphql', () => ({
    graphql: jest.fn()
}));

describe('Community Model', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });
    

    describe('get', () => {
        it('should fetch community data successfully', async () => {
            const bot_phone = '+1234567890';
            const mockResponse = {
                data: {
                    communities: [
                        { id: 1, name: 'Test Community' }
                    ]
                }
            };
    
            graphql.mockResolvedValue(mockResponse);
    
            const community = await Community.get(bot_phone);
    
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('query GetCommunities($bot_phone:String!)'), { bot_phone });
            expect(community).toEqual(new Community(1, 'Test Community', { id: 1, name: 'Test Community' }));
        });
    
        it('should throw an error if graphql returns errors', async () => {
            const bot_phone = '+1234567890';
            const mockError = new Error('GraphQL error');
            graphql.mockResolvedValue({ errors: [mockError] });
    
            await expect(Community.get(bot_phone)).rejects.toThrow('GraphQL error');
            expect(graphql).toHaveBeenCalledWith(expect.any(String), { bot_phone });
        });
    
        it('should throw an error if graphql request fails', async () => {
            const bot_phone = '+1234567890';
            const mockError = new Error('Network error');
            graphql.mockRejectedValue(mockError);
    
            await expect(new Community.get(bot_phone)).rejects.toThrow('Network error');
            expect(graphql).toHaveBeenCalledWith(expect.any(String), { bot_phone });
        });
    })

    describe('get_bot_phones', () => {
        it('should fetch bot phones successfully', async () => {
            const mockResponse = {
                data: {
                    communities: [
                        { bot_phone: '+1234567890' },
                        { bot_phone: '+0987654321' }
                    ]
                }
            };
    
            graphql.mockResolvedValue(mockResponse);
    
            const bot_phones = await Community.get_bot_phones();
            console.log(bot_phones);
    
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('query GetCommunities()'));
            expect(bot_phones).toEqual(['+1234567890', '+0987654321']);
        });

        it('should throw an error if graphql returns errors', async () => {
            const mockError = new Error('GraphQL error');
            graphql.mockResolvedValue({ errors: [mockError] });
    
            await expect(Community.get_bot_phones()).rejects.toThrow('GraphQL error');
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('query GetCommunities()'));
        });

        it('should return an empty array if no communities are found', async (  ) => {
            const mockResponse = {
                data: {
                    communities: []
                }
            };
    
            graphql.mockResolvedValue(mockResponse);
    
            const bot_phones = await Community.get_bot_phones();
    
            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('query GetCommunities()'));
            expect(bot_phones).toEqual([]);
        });
    })
    
});