const Membership = require('../models/membership');
const { graphql } = require('../apis/graphql');

jest.mock('../apis/graphql');

describe('Membership Model', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('set_variable', () => {
        it('should throw an error for an invalid variable', async () => {
            const memberData = { id: '123', phone: '1234567890', user_id: 'user_id', type: 'member', community: {bot_phone: 'bot_phone'} };
            const membership = new Membership(memberData);
            await expect(membership.set_variable('invalidVar', 'value')).rejects.toThrow('Invalid variable. Valid variables are: name, informal_name, location, email, profile');
        });

        it('should call graphql with correct mutation and variables', async () => {
            const memberData = { id: '123', phone: '1234567890', user_id: 'user_id', type: 'member', community: {bot_phone: 'bot_phone'} };
            graphql.mockResolvedValue({ data: { updateMembershipVariable: { id: '123', fname: 'John' } } });
            const membership = new Membership(memberData);
            await membership.set_variable('informal_name', 'John');

            const expectedQuery = `
mutation updateMembershipVariable($id:uuid!, $value:String!) {
    updateMembershipVariable(id: $id, informal_name: $value) {
        id
        informal_name
    }
}
`

            expect(graphql).toHaveBeenCalledWith(expectedQuery, { id: '123', informal_name: 'John' });
        });

        it('should log an error if graphql request fails', async () => {
            const memberData = { id: '123', phone: '1234567890', user_id: 'user_id', type: 'member', community: {bot_phone: 'bot_phone'} };
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            graphql.mockRejectedValue(new Error('GraphQL Error'));
            const membership = new Membership(memberData);

            await membership.set_variable('informal_name', 'John');

            expect(consoleSpy).toHaveBeenCalledWith('Error updating membership informal_name:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('create', () => {
        it('should call graphql with correct mutation and variables if the user already exists', async () => {
            graphql.mockResolvedValueOnce({ data: { users: [{ id: '123', phone: '+1234567890' }] }});
            graphql.mockResolvedValueOnce({ data: { insert_memberships_one: { id: '456', user: {id: '123', phone: '+1234567890' }, type: 'member', community: {bot_phone: 'bot_phone'} } } });

            const membership = await Membership.create('+1234567890', 'community_id');

            expect(graphql).toHaveBeenNthCalledWith(1, expect.stringContaining('query GetUser'), { phone: '+1234567890' });
            expect(graphql).toHaveBeenNthCalledWith(2, expect.stringContaining('mutation CreateMembership'), { user_id: '123', community_id: 'community_id' });
            expect(membership.id).toBe('456');
            expect(membership.phone).toBe('+1234567890');
            expect(membership.user_id).toBe('123');
        });

        it('should call graphql with correct mutation and variables if the user does not exist', async () => {
            graphql.mockResolvedValueOnce({ data: { users: [] }});
            graphql.mockResolvedValueOnce({ data: { insert_memberships_one: { id: '456', user: {id: '123', phone: '+1234567890' }, type: 'member', community: {bot_phone: 'bot_phone'} } } });

            const membership = await Membership.create('+1234567890', 'community_id');

            expect(graphql).toHaveBeenNthCalledWith(1, expect.stringContaining('query GetUser'), { phone: '+1234567890' });
            expect(graphql).toHaveBeenNthCalledWith(2, expect.stringContaining('mutation CreateUserAndMembership'), { phone: '+1234567890', community_id: 'community_id' });
            expect(membership.id).toBe('456');
            expect(membership.phone).toBe('+1234567890');
            expect(membership.user_id).toBe('123');
        });

        it('should return a Membership object', async () => {
            graphql.mockResolvedValueOnce({ data: { users: [] }});
            graphql.mockResolvedValueOnce({ data: { insert_memberships_one: { id: '456', user: {id: '123', phone: '+1234567890' }, type: 'member', community: {bot_phone: 'bot_phone'} } } });

            const membership = await Membership.create('+1234567890', 'community_id');

            expect(membership).toBeInstanceOf(Membership);
            expect(membership.id).toBe('456');
            expect(membership.phone).toBe('+1234567890');
            expect(membership.user_id).toBe('123');
        });

        it('should log an error if graphql request fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            graphql.mockRejectedValue(new Error('GraphQL Error'));

            await Membership.create('1234567890');

            expect(consoleSpy).toHaveBeenCalledWith('Error creating membership:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('get', () => {
        it('should call graphql with correct query and variables', async () => {
            graphql.mockResolvedValue({ data: {memberships: [{ id: '456', type: 'member', user: { id: '123', phone: '+1234567890' } }] }});
            await Membership.get('+1234567890', '+0987654321');

            expect(graphql).toHaveBeenCalledWith(expect.stringContaining('query GetMembership'), { phone: '+1234567890', bot_phone: '+0987654321' });
        });

        it('should return a membership object', async () => {
            graphql.mockResolvedValueOnce({ data: { memberships: [{ id: '456', user: {id: '123', phone: '+1234567890' }, type: 'member', community: {bot_phone: 'bot_phone'} }] }});


            const membership = await Membership.get('+1234567890');

            expect(membership).toBeInstanceOf(Membership);
            expect(membership.id).toBe('456');
            expect(membership.phone).toBe('+1234567890');
            expect(membership.user_id).toBe('123');
            expect(membership.type).toBe('member');
        });

        it('should return null if membership is not found', async () => {
            graphql.mockResolvedValue({ data: { memberships: []}});

            const membership = await Membership.get('123');
            expect(membership).toBeNull();
        });

        it('should log an error if graphql request fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            graphql.mockRejectedValue(new Error('GraphQL Error'));

            await Membership.get('123');

            expect(consoleSpy).toHaveBeenCalledWith('Error getting membership:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });



});