const Membership = require('../models/membership');
const { graphql } = require('../apis/graphql');
const { id } = require('../models/message');

jest.mock('../apis/graphql', () => ({
    graphql: jest.fn()
}));

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
            graphql.mockResolvedValue({ data: { updateMembershipVariable: { id: '123', informal_name: 'John' } } });
            const membership = new Membership(memberData);
            await membership.set_variable('informal_name', 'John');

            const expectedQuery = `
mutation updateMembershipVariable($id:uuid!, $value:String!) {
  update_memberships(where: {id: {_eq: $id}}, _set: {informal_name: $value}) {
    returning {
      id
    }
  }
}
`

            expect(graphql).toHaveBeenCalledWith(expectedQuery, { id: '123', value: 'John' });
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
            graphql.mockResolvedValueOnce({ data: { insert_memberships_one: { id: '456', user: {id: '123', phone: '+1234567890' }, type: 'member', community: {bot_phone: 'bot_phone'} } } });
            const user = { id: '123', phone: '+1234567890' };
            const community = { id: 'community_id', bot_phone: 'bot_phone', onboarding: { id: 'onboarding_id' } };
            const membership = await Membership.create('+1234567890', community, user);

            expect(graphql).toHaveBeenNthCalledWith(1, expect.stringContaining('mutation CreateMembership($user_id:uuid!, $community_id:uuid!, $current_script_id:uuid!)'), { user_id: '123', community_id: 'community_id', current_script_id: 'onboarding_id'});
            expect(membership.id).toBe('456');
            expect(membership.user.phone).toBe('+1234567890');
            expect(membership.user.id).toBe('123');
        });

        it('should call graphql with correct mutation and variables if the user does not exist', async () => {
            graphql.mockResolvedValueOnce({ data: { insert_memberships_one: { id: '456', user: {id: '123', phone: '+1234567890' }, type: 'member', community: {bot_phone: 'bot_phone'} } } });
            const user = null;
            const community = { id: 'community_id', bot_phone: 'bot_phone', onboarding: { id: 'onboarding_id' } };
            const membership = await Membership.create('+1234567890', community, user);

            expect(graphql).toHaveBeenNthCalledWith(1, expect.stringContaining('mutation CreateUserAndMembership($phone:String!, $community_id:uuid!, $current_script_id:uuid!)'), { phone: '+1234567890', community_id: 'community_id', current_script_id: 'onboarding_id' });
            expect(membership.id).toBe('456');
            expect(membership.user.phone).toBe('+1234567890');
            expect(membership.user.id).toBe('123');
        });

        it('should return a Membership object', async () => {
            graphql.mockResolvedValueOnce({ data: { insert_memberships_one: { id: '456', user: {id: '123', phone: '+1234567890' }, type: 'member', community: {bot_phone: 'bot_phone'} } } });
            const user = null;
            const community = { id: 'community_id', bot_phone: 'bot_phone', onboarding: { id: 'onboarding_id' } };
            const membership = await Membership.create('+1234567890', community, user);

            expect(membership).toBeInstanceOf(Membership);
            expect(membership.id).toBe('456');
            expect(membership.user.phone).toBe('+1234567890');
            expect(membership.user.id).toBe('123');
        });

        it('should log an error if graphql request fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            graphql.mockRejectedValue(new Error('GraphQL Error'));
            const user = null;
            const community = { id: 'community_id', bot_phone: 'bot_phone', onboarding: { id: 'onboarding_id' } };
            const membership = await Membership.create('+1234567890', community, user);

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
            expect(membership.user.phone).toBe('+1234567890');
            expect(membership.user.id).toBe('123');
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